# Spec: run bootstrap before renderer in `index.tsx`

- Source bean: `ldf-ypuh`
- Parent epic: `ldf-hia6`
- References: PRD §7.1, A1, ADR-002 §4.1, CONSTITUTION §2.4 ("No `process.exit()`")

## Goal

Move `Booting → Ready` entirely into the composition root before `createCliRenderer`. Wire the new `config`/`bootstrap` services and the `config` actor into `wireServices`/`wireActors`. On bootstrap failure, render a typed error panel — never `process.exit`.

## Public surface

```ts
// src/composition/services.ts
export interface Services {
  readonly home: string;
  readonly config: ConfigService;
  readonly bootstrap: BootstrapService;
}
export function wireServices(deps: { home: string }): Services;
```

```ts
// src/composition/actors.ts
import type { ActorRuntime } from "../actors/runtime";
import type { Services } from "./services";
export function wireActors(services: Services): ActorRuntime<Services>;
```

```tsx
// src/views/panels/bootstrap-error-panel.tsx
import type { ServiceError } from "../../services/types";
export function BootstrapErrorPanel(props: { error: ServiceError }): JSX.Element;
```

```tsx
// src/index.tsx — pseudocode
const home = process.env["HOME"] ?? "";
const services = wireServices({ home });
const actors = wireActors(services);
const outcome = await services.bootstrap.run();

const renderer = await createCliRenderer({ exitOnCtrlC: true });
function App() {
  useEffect(() => () => actors.dispose(), []);
  return (
    <ThemeProvider mode="dark">
      <ActorRuntimeContext.Provider value={actors as unknown as ActorRuntime<unknown>}>
        {outcome.ok ? (
          <>
            <GlobalKeys />
            <RouterProvider router={router} />
          </>
        ) : (
          <BootstrapErrorPanel error={outcome.error} />
        )}
      </ActorRuntimeContext.Provider>
    </ThemeProvider>
  );
}
createRoot(renderer).render(<App />);
```

## Internal design

### `wireServices`

1. Resolve `configPath = ${home}/.config/lazydotfiles/config.toml`.
2. `const configRepo = createConfigRepository(configPath)`.
3. `const fs = createFsRepository()`.
4. `const jj = createJjRepository()`.
5. `const config = createConfigService({ repo: configRepo, defaults: () => expandPaths(defaultConfig().path, home) ? ... })`.

   The defaults factory returns the README config with `path.{home,dotfiles,backup}` expanded against `home`. Implementation:

   ```ts
   const defaults = () => {
     const base = defaultConfig();
     return { ...base, path: expandPaths(base.path, home) };
   };
   ```

6. `const bootstrap = createBootstrapService({ config, jj, fs })`.
7. Return `{ home, config, bootstrap }`.

### `wireActors`

1. `const runtime = createActorRuntime({ services })`.
2. `spawnConfigActor(runtime)` — registers but does not auto-load.
3. Return `runtime`.

### `index.tsx`

1. `await services.bootstrap.run()` **before** `createCliRenderer`.
2. On `outcome.ok`:
   - `runtime.get(CONFIG_ACTOR_ID).send({ kind: "load", payload: undefined })` so the actor's cache is hot when the first view renders.
3. On failure:
   - Skip the actor `load` send.
   - Render `<BootstrapErrorPanel error={outcome.error} />` instead of the router.
   - The error panel includes a hint: "press q to quit"; the global `q` keymap → `renderer.destroy()`.

### `BootstrapErrorPanel`

- Centered `box` (`flexGrow={1}` + `justifyContent` / `alignItems="center"`).
- Title: `Bootstrap failed` in `t.fg.danger` bold.
- Body: `error.tag` + a serialized JSON of `error` (one line per `Issue` if `Validation`).
- Hint: `[q] quit`.
- Stateless. Uses `useTheme`. No domain logic.

## Dependencies

- `src/composition/services.ts`, `src/composition/actors.ts`.
- `src/services/config.service.ts`, `src/services/bootstrap.service.ts`.
- `src/repositories/config.repository.ts`, `src/repositories/fs.repository.ts`, `src/repositories/vcs.repository.ts`.
- `src/actors/config.actor.ts`.
- `src/lib/path.ts`.
- `src/views/theme/`, `@opentui/react`, `@tanstack/react-router` (existing).

## Tests

- `tests/composition/services.test.ts`:
  - `wireServices({ home: tmp }).bootstrap.run()` succeeds; the resulting config has `path.home === tmp`.
  - The same wired services pass `config.get("path.dotfiles")` returning `${tmp}/dotfiles`.
- `tests/views/bootstrap-error-panel.test.tsx` (snapshot via `@opentui/react/test-utils`):
  - Renders the title, the error tag, and the quit hint when given a `Validation` error.

`index.tsx` itself is covered by the bootstrap integration test (PRD A1 scenario).

## Acceptance

- `bun dev` against a tmp HOME (override `HOME` env) opens the TUI on `/` after creating config + repo + backup dir.
- A second launch on the same tmp HOME opens the TUI on `/` without rewriting any file.
- A forced bootstrap failure (e.g. `HOME` set to a read-only path) renders `BootstrapErrorPanel` instead of crashing; pressing `q` invokes `renderer.destroy()`.
- No `process.exit` call is added anywhere in `src/`.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
