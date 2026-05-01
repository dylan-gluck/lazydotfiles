# Spec: `controllers/keymap.ts` + `<GlobalKeys>`

- Source bean: `ldf-zcqm`
- Parent epic: `ldf-j9pe`
- References: ADR-002 §4.5

## Goal

Provide a single global keymap table, a pure `dispatchKeymap` function, and a `<GlobalKeys>` view component that installs exactly one root `useKeyboard` consuming it.

## Public surface

```ts
// src/controllers/keymap.ts
import type { KeyEvent } from "@opentui/core";
import type { useRouter } from "@tanstack/react-router";

export interface KeymapContext {
  readonly router: ReturnType<typeof useRouter>;
  readonly renderer: { destroy(): void };
  readonly ui: { toggleHelp(): void };
}

export interface Binding {
  readonly keys: readonly string[]; // event.name values
  readonly description: string;
  readonly when?: (ctx: KeymapContext) => boolean;
  readonly run: (ctx: KeymapContext) => void;
}

export const globalKeymap: readonly Binding[];

export function dispatchKeymap(
  table: readonly Binding[],
  event: KeyEvent,
  ctx: KeymapContext,
): boolean;
```

```tsx
// src/views/components/global-keys.tsx
import type { ReactNode } from "react";
export function GlobalKeys(props: { children?: ReactNode }): JSX.Element | null;
```

`globalKeymap` content (this phase):

```ts
[
  { keys: ["1"], description: "Status", run: ({ router }) => router.navigate({ to: "/" }) },
  { keys: ["2"], description: "About", run: ({ router }) => router.navigate({ to: "/about" }) },
  {
    keys: ["3"],
    description: "Settings",
    run: ({ router }) => router.navigate({ to: "/settings" }),
  },
  { keys: ["?"], description: "Help", run: ({ ui }) => ui.toggleHelp() },
  { keys: ["q"], description: "Quit", run: ({ renderer }) => renderer.destroy() },
];
```

## Internal design

- `dispatchKeymap` iterates `table`, returns `true` and calls `run` on the **first** binding whose `keys` includes `event.name` (and `when` returns truthy if defined). Otherwise returns `false`.
- `<GlobalKeys>` resolves `router` via `useRouter`, `renderer` via `useRenderer` (`@opentui/react`), and `ui` via a temporary stub `{ toggleHelp: () => {} }` (Help overlay lands in the View phase). It calls `useKeyboard((event) => dispatchKeymap(globalKeymap, event, ctx))` and renders `null` (or its `children`).

## Dependencies

- `@opentui/core` (`KeyEvent`), `@opentui/react` (`useKeyboard`, `useRenderer`).
- `@tanstack/react-router` (`useRouter`).

## Tests

- `tests/controllers/keymap.test.ts`:
  - `dispatchKeymap` runs the first matching binding and stops.
  - Returns `false` on no match.
  - Honors `when` predicate (skips when false).
  - Calling `run` for `"q"` invokes `renderer.destroy()`.
  - `globalKeymap` contains entries for `1`, `2`, `3`, `?`, `q`.

`<GlobalKeys>` itself is exercised via the app-shell smoke test; no isolated render test needed.

## Acceptance

- One root keyboard listener; root layout no longer contains an inline `useKeyboard`.
- Tests pass.
