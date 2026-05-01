# ADR-002: TUI Architecture — OpenTUI, Routing, Actors, and View Isolation

| Revision | Date       | Author |
| -------- | ---------- | ------ |
| 1        | 2026-05-01 | core   |

## Summary

We adopt OpenTUI + React with TanStack file-based routing for the view layer, an in-process actor runtime for domain state, and React context as the dependency-injection seam between layers. Views are stateless and theme-driven; controllers translate input into messages; actors own state and emit events that views subscribe to. This ADR fixes the lifecycle (renderer creation, teardown), the routing model, the actor protocol, and the rules that keep views from learning about disk, git, or business logic.

## Context

ADR-001 fixed the layered structure (`domain → repository → service → controller → view`) and named the composition root. ADR-002 fills in the runtime: how the renderer boots, how actors mediate between services and views, how the router fits, and what makes a "view" a view.

The bootstrap template gives:

```typescript
// src/index.tsx
const memoryHistory = createMemoryHistory({ initialEntries: ["/"] })
const router = createRouter({ routeTree, history: memoryHistory })
await router.load()
const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
```

Plus `__root.tsx` with a `useKeyboard` block hard-coding navigation keys and a `renderer.destroy()` on `q`. This is acceptable for a demo and unacceptable as a foundation: keybindings are inlined, view holds router knowledge, no theme, no actor system, no service injection.

### Deficiencies

#### D1. Keybindings hard-coded in views

`__root.tsx` does `if (event.name === "1") router.navigate(...)`. Adding a keybinding is editing a view. Discoverability is zero (no help screen). Conflicts (component-level `useKeyboard` shadowing global) are silent.

#### D2. No state seam

State today would land in `useState` inside route components. Cross-route state (current profile, sync status) has no home.

#### D3. No theme

Hex colors are scattered (`fg="cyan"`, `fg="red"`). A reskin requires a grep.

#### D4. Width/height drift

Layouts that work at 80×24 break at 120×40 because elements size in cells.

## Options

### Option 1: View state via React state + lifted props

Pros: simple, no new abstractions.
Cons: cross-route state requires lifting to `__root`, which becomes the de facto application state container, with no boundaries. Reducers grow without invariants. Side effects pile up in `useEffect`. Violates the constitution's actor-model rule.

### Option 2: Redux/Zustand/Jotai

Pros: well-known.
Cons: all global stores conflate the bus and the storage. None enforce the message-in / events-out contract we want. Adds a dependency for a problem we can solve in <100 LOC.

### Option 3: In-process actor runtime (chosen)

Build a tiny actor runtime: `Actor<State, Message, Event>` with a typed inbox, a pure reducer `(state, msg) => [state', events]`, and an effects channel handled by services. React subscribes via a hook.

Pros: enforces SRP per actor; cross-actor coupling is observable (events on the bus); reducers are pure → trivially testable; no new dependency; matches the constitution.
Cons: we own the implementation. Acceptable — the surface is small.

We pick Option 3.

## Solution

### 4.1 Lifecycle

The composition root in `src/index.tsx` is the **only** caller of `createCliRenderer` and `createRoot`. Every other module receives the renderer (or an abstraction over it) via context.

```typescript
// src/index.tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { wireServices } from "./composition/services"
import { createActorRuntime } from "./actors/runtime"
import { App } from "./app"

const services = wireServices({ home: process.env["HOME"]! })
const actors = createActorRuntime({ services })

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
  context: { services, actors },
})
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
await router.load()

const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<App router={router} services={services} actors={actors} />)
```

Lifecycle invariants:

- **Single renderer.** Created once. Stored on the React tree via `useRenderer` (provided by `@opentui/react`).
- **Single exit path.** Quit handlers call `renderer.destroy()`. `process.exit()` is **PROHIBITED**.
- **Actor cleanup.** `createActorRuntime` returns a `dispose()` method called from a top-level `useEffect` cleanup so actors stop their timers/subscriptions on shutdown.
- **No top-level state.** `index.tsx` wires; it does not own any mutable variable beyond the runtime instances it creates.

### 4.2 Routing — TanStack file-based

`src/routes/` is the source of truth; `tsr generate` produces `routeTree.gen.ts`. The router uses **memory history** (no URL bar in a terminal). Per-route `loader`s **MAY** call services via `router.context.services` to preload data.

Rules:

- A route file (`src/routes/profile.tsx`) **MUST** be a thin shell: it calls a controller hook from `controllers/`, passes the result to a view from `views/panels/`. It **MUST NOT** instantiate a service, read FS, or own non-trivial state.
- Route loaders **MUST** be pure orchestration: pull data via `context.services`, return what the view needs. No business logic.
- The root route (`__root.tsx`) renders the `<AppShell>` — header, content `<Outlet />`, footer/status bar — and installs the global keymap (see §4.5).

```typescript
// src/routes/profiles.tsx
import { createFileRoute } from "@tanstack/react-router"
import { ProfilesPanel } from "../views/panels/profiles-panel"
import { useProfilePanel } from "../controllers/profile.controller"

export const Route = createFileRoute("/profiles")({
  component: ProfilesScreen,
  loader: async ({ context }) => {
    const r = await context.services.profile.list()
    return r.ok ? { profiles: r.value } : { profiles: [], error: r.error }
  },
})

function ProfilesScreen() {
  const initial = Route.useLoaderData()
  const ctrl = useProfilePanel(initial)
  return <ProfilesPanel {...ctrl} />
}
```

### 4.3 Actor runtime

#### 4.3.1 Types

```typescript
// src/actors/types.ts
export type Message<K extends string = string, P = unknown> = { kind: K; payload: P };
export type Event<K extends string = string, P = unknown> = { kind: K; payload: P };

export type Reducer<S, M extends Message, E extends Event> = (
  state: S,
  msg: M,
) => { state: S; events: E[]; effects: Effect<M>[] };

export type Effect<M extends Message> = (services: Services) => Promise<M | null>;

export interface Actor<S, M extends Message, E extends Event> {
  readonly id: string;
  send(msg: M): void;
  subscribe(listener: (state: S, event: E | null) => void): () => void;
  getState(): S;
}
```

#### 4.3.2 Reducer purity

A reducer **MUST** be a pure function. Side effects are returned as `Effect<M>` thunks; the runtime executes them off-cycle and feeds their results back as messages. This makes reducers trivially unit-testable:

```typescript
// src/actors/profile.actor.ts
type State = { profiles: Profile[]; loading: boolean; error: ServiceError | null };
type Msg =
  | Message<"load">
  | Message<"loaded", { profiles: Profile[] }>
  | Message<"loadFailed", { error: ServiceError }>;

const reducer: Reducer<State, Msg, ProfileEvent> = (state, msg) => {
  switch (msg.kind) {
    case "load":
      return {
        state: { ...state, loading: true, error: null },
        events: [],
        effects: [
          async ({ profile }) => {
            const r = await profile.list();
            return r.ok
              ? { kind: "loaded", payload: { profiles: r.value } }
              : { kind: "loadFailed", payload: { error: r.error } };
          },
        ],
      };
    case "loaded":
      return {
        state: { ...state, loading: false, profiles: msg.payload.profiles },
        events: [{ kind: "profilesLoaded", payload: { count: msg.payload.profiles.length } }],
        effects: [],
      };
    case "loadFailed":
      return {
        state: { ...state, loading: false, error: msg.payload.error },
        events: [{ kind: "profilesFailed", payload: { error: msg.payload.error } }],
        effects: [],
      };
  }
};
```

#### 4.3.3 React binding

```typescript
// src/actors/use-actor.ts
export function useActor<S, M extends Message, E extends Event>(
  id: string,
): { state: S; send: (msg: M) => void } {
  const runtime = useContext(ActorRuntimeContext);
  const actor = runtime.get<S, M, E>(id);
  const [state, setState] = useState(actor.getState());
  useEffect(() => actor.subscribe((s) => setState(s)), [actor]);
  return { state, send: actor.send };
}
```

`useActor` subscribes for the component's lifetime and unsubscribes on unmount. Multiple subscribers are cheap — the runtime broadcasts.

#### 4.3.4 Cross-actor events

Actors **MUST NOT** call each other directly. To react to another actor's event, an actor subscribes via `runtime.on("profilesLoaded", (e) => actor.send({ kind: "...", payload: ... }))` at construction time. This wiring lives in the actor's factory, not in views.

### 4.4 State seam: who owns what

| Concern                               | Owner            |
| ------------------------------------- | ---------------- |
| Selected profile, loading status      | `profile` actor  |
| Pending sync plan, in-flight progress | `sync` actor     |
| Current theme mode                    | `theme` actor    |
| Focused field, scroll position        | local `useState` |
| Form draft (uncommitted edit)         | local `useState` |
| Last error displayed                  | local `useState` |

Rule: anything that survives a screen unmount or is shared across screens **MUST** live in an actor. Anything bound to a specific component's interaction lifetime stays in `useState`/`useReducer`.

### 4.5 Input — global keymap

A single `Keymap` table lives in `controllers/keymap.ts`. The root layout installs **one** global `useKeyboard`. Component-level `useKeyboard` hooks **MUST** be limited to focus-scoped contexts (modal open, input focused), and **MUST** check focus before consuming.

```typescript
// src/controllers/keymap.ts
export type Binding = {
  keys: string[]; // e.g. ["g p"] or ["?"]
  description: string;
  when?: (ctx: KeymapContext) => boolean;
  run: (ctx: KeymapContext) => void;
};

export const globalKeymap: Binding[] = [
  { keys: ["1"], description: "Home", run: ({ router }) => router.navigate({ to: "/" }) },
  {
    keys: ["2"],
    description: "Profiles",
    run: ({ router }) => router.navigate({ to: "/profiles" }),
  },
  { keys: ["?"], description: "Help", run: ({ ui }) => ui.toggleHelp() },
  { keys: ["q"], description: "Quit", run: ({ renderer }) => renderer.destroy() },
];
```

```typescript
// src/views/components/global-keys.tsx
export function GlobalKeys() {
  const ctx = useKeymapContext(); // router + renderer + ui actor + ...
  useKeyboard((event) => dispatchKeymap(globalKeymap, event, ctx));
  return null;
}
```

This pattern delivers two benefits the template lacks:

- **Help is a derived view.** A `<HelpOverlay>` simply renders `globalKeymap.map(...)`.
- **Conflict-aware.** `dispatchKeymap` short-circuits on first match and respects `when` predicates (e.g. don't fire `q` while a textarea is focused).

### 4.6 Views — stateless and theme-driven

A view component receives props and theme tokens; it returns JSX.

- View files live under `views/` (`components/` for primitives, `panels/` for feature-shaped composites).
- Views **MUST NOT** import `services`, `repositories`, `actors`, or `routes`. If a view needs data, the route hands it props.
- Color, spacing, and border style tokens **MUST** come from `useTheme()`. Hex literals in views are **PROHIBITED** outside `views/theme/`.
- Components **MUST NOT** hard-code text content for status messages — copy comes from the theme/i18n table or from props.

```typescript
// src/views/theme/theme.tsx
type Tokens = {
  fg: { default: string; dim: string; accent: string; danger: string }
  bg: { default: string; surface: string; elevated: string }
  border: { default: BorderStyle; emphasis: BorderStyle }
  space: { xs: number; sm: number; md: number; lg: number }
}

const dark: Tokens = {
  fg: { default: "#e6e6e6", dim: "#888", accent: "#7aa2f7", danger: "#f7768e" },
  bg: { default: "#1a1b26", surface: "#1f2335", elevated: "#24283b" },
  border: { default: "single", emphasis: "double" },
  space: { xs: 0, sm: 1, md: 2, lg: 4 },
}

const ThemeContext = createContext<Tokens>(dark)
export const ThemeProvider = ({ children, mode }: { children: ReactNode; mode: "dark" | "light" }) => (
  <ThemeContext.Provider value={mode === "dark" ? dark : light}>{children}</ThemeContext.Provider>
)
export const useTheme = () => useContext(ThemeContext)
```

```typescript
// src/views/components/card.tsx
export function Card({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme()
  return (
    <box
      borderStyle={t.border.default}
      backgroundColor={t.bg.surface}
      padding={t.space.md}
      flexDirection="column"
      gap={t.space.sm}
    >
      <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
        {title}
      </text>
      {children}
    </box>
  )
}
```

#### 4.6.1 Layout — flexbox, not pixels

Layout **MUST** use Yoga flexbox — OpenTUI computes ANSI sizing for us. Hard-coded `width={N}` / `height={N}` for layout flow is **PROHIBITED** by the constitution.

| Want                   | Use                                                                   |
| ---------------------- | --------------------------------------------------------------------- |
| Fill remaining space   | `flexGrow={1}`                                                        |
| Equal columns          | siblings with `flexGrow={1}`                                          |
| Header / body / footer | `flexDirection="column"`, body has `flexGrow={1}`                     |
| Sidebar + main         | `flexDirection="row"`, sidebar fixed `flexBasis`, main `flexGrow={1}` |
| Centered modal         | `position="absolute"` + `justifyContent`+`alignItems="center"`        |
| Grid of cards          | `flexDirection="row" flexWrap="wrap"` + `flexBasis` per cell          |
| Spacing                | `gap`, `padding`, `paddingX`/`paddingY`, `margin`                     |

Exceptions — fixed glyph affordances — are permitted: `<box height={1}>` for a 1-row status bar, `<box height={3}>` for a 3-row banner. These are part of the design, not sizing guesses.

#### 4.6.2 Text styling

Text modifiers (`<strong>`, `<em>`, `<u>`, `<span>`) **MUST** be nested inside `<text>`. Do not pass `bold`/`italic` as props on `<text>` — use modifier elements.

### 4.7 Isolating layers (the wall)

The wall between layers is enforced by:

1. **Folder structure.** Imports across layers are visible in the path (`../services/...`).
2. **Interface dependencies.** Services depend on `repositories/types`, never on a concrete factory.
3. **Hooks as the only view-side seam.** Views never import a service. They use a hook from `controllers/` or `actors/use-actor`.
4. **Composition root.** `src/index.tsx` is the only place where concrete services and actors are instantiated. All other modules receive them through context.
5. **Tests.** Each layer has tests at its own granularity:
   - Domain — pure unit tests on schema / invariants.
   - Repositories — integration against tmp dirs.
   - Services — unit tests with fake repositories (real implementations, simplified state).
   - Actors — pure reducer tests; effect dispatch tested with a fake services bag.
   - Views — `@opentui/react/test-utils` snapshot tests with a `ThemeProvider` and stubbed controller hooks.

### 4.8 Performance and re-render hygiene

- Avoid inline objects/functions in JSX; pass primitives or memoized values.
- `React.memo` views that receive lists.
- Subscribe selectors via `useActor` returning a single state slice; do not subscribe to the whole runtime.
- Do not do work in render. All async kicks off in `useEffect` or actor effects.

### 4.9 Console / debug

`renderer.console.show()` exposes the OpenTUI console overlay; toggle behind a debug-mode keybinding (`Ctrl+\``) in `globalKeymap`. `console.log`from app code is **PROHIBITED** — log via a structured`logger` actor or service so output can be captured to a file in non-debug mode without poisoning the alternate screen buffer.

## Implementation Plan

1. Add `views/theme/` with dark tokens + `ThemeProvider` + `useTheme`. Replace existing color literals in routes.
2. Land `actors/runtime.ts` (≤150 LOC): inbox queue, reducer dispatch, effect runner, subscriber list, event bus. Unit tests on a counter actor.
3. Land `controllers/keymap.ts` + `<GlobalKeys>` component. Move root `useKeyboard` block out of `__root.tsx` into the keymap table.
4. Wire `services` and `actors` into the router context. Update `App` to thread them.
5. Migrate the three demo routes (`/`, `/about`, `/settings`) to: route shell → controller hook → view panel.
6. Add `<HelpOverlay>` derived from `globalKeymap`. Bind to `?`.
7. Replace any width/height layout values discovered in the migration with flexbox equivalents.
8. Add `views/__tests__/` snapshot tests for the panels via `@opentui/react/test-utils`.
9. Add a `logger` actor / service and ban `console.log` via oxlint rule once available.
10. Land a debug-mode toggle (`Ctrl+\``) that calls `renderer.console.show()`.

Steps 1–4 establish the skeleton and **MUST** land first. Steps 5–10 follow the introduction of real domain features (profiles, sync) and **MAY** be sequenced with those features rather than as a separate refactor.
