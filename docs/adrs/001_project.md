# ADR-001: Project Layout, Contracts, and Layered Architecture

| Revision | Date       | Author |
| -------- | ---------- | ------ |
| 1        | 2026-05-01 | core   |

## Summary

We adopt a domain-driven, layered project structure for `lazy-dotfiles`: `domain → repository → service → controller → view`, with schemas as the single source of truth at every trust boundary. The runtime is Bun; tests run on `bun:test`. This ADR fixes the directory layout, the contract-definition convention, and the responsibilities of each layer so that subsequent ADRs (TUI, sync, profiles) can reference a stable skeleton.

## Context

The repo was bootstrapped from the OpenTUI "React + TanStack Router (File-Based)" template. Today it has:

```
src/
  index.tsx           // renderer + router boot
  routes/             // file-based tanstack routes
  routeTree.gen.ts    // generated
docs/
  CONSTITUTION.md
  adrs/
```

The template gives us nothing about where domain code lives, how filesystem access is isolated, or how data crossing trust boundaries is validated. Without that, every feature will invent its own folder, its own validation strategy, and its own coupling between view and disk. The constitution mandates entity-first DDD with controller/service/repository separation, schema-first contracts, actor-owned state, and Bun-builtin IO. This ADR turns that into a layout.

### Deficiencies in the current state

#### D1. No layer boundaries

Routes can `import "node:fs"` directly. Nothing prevents a `<box>` from running `git pull`. Without a wall, business logic leaks into views and disk access leaks into reducers.

#### D2. No contract location

There is no convention for where a `Dotfile`, `Profile`, or `SymlinkPlan` is defined, nor how its on-disk shape is validated.

#### D3. No test home

`bun test` has no root convention. Co-located `*.test.ts` vs `tests/` mirrors is undecided.

#### D4. No composition root

`src/index.tsx` builds the renderer and the router. Future features (config loader, actor system, theme) will accrete here unless a root is named.

## Options

### Option 1: Flat by feature

```
src/features/profiles/{view,service,repo}.ts
```

Pros: feature locality.
Cons: violates DIP — services would import sibling repos by relative path, making the seam invisible. Hard to enforce "service depends on repository **interface**". Discourages cross-feature reuse of domain primitives.

### Option 2: Strict layer-per-folder (chosen)

```
src/{domain,repositories,services,controllers,actors,views,routes}
```

Pros: layer boundaries are syntactically obvious. Lint rule "controllers must not import repositories" is trivial to enforce. Imports always flow downward. Cross-feature reuse is natural.
Cons: a single feature touches ≥4 folders. Acceptable cost — discoverability is `grep`, layering is the architecture.

### Option 3: Hexagonal with `ports/adapters`

Pros: maximal decoupling, swappable adapters.
Cons: overkill for a TUI with one filesystem and one git. YAGNI.

We pick Option 2.

## Solution

### 4.1 Directory layout

```
src/
  index.tsx                 # composition root: renderer + router + actor system
  app.tsx                   # <App> shell: providers, router outlet
  routes/                   # tanstack file-based routes — controllers + view glue only
    __root.tsx
    index.tsx
    ...
  routeTree.gen.ts          # generated — never hand-edit, lint-ignored

  domain/                   # pure types, schemas, entity invariants
    dotfile.ts
    profile.ts
    plan.ts
    schema.ts               # schema primitives (StandardSchemaV1-shaped)
    errors.ts               # domain error union
    index.ts                # barrel — re-export public surface

  repositories/             # DAL — only place that touches FS, git, env, network
    dotfile.repository.ts
    profile.repository.ts
    git.repository.ts
    types.ts                # repository interfaces (depend on these from services)

  services/                 # business logic — pure where possible, IO via repos
    profile.service.ts
    plan.service.ts
    sync.service.ts
    types.ts                # service interfaces

  actors/                   # actor system: inbox, reducer, event emission
    runtime.ts              # tiny scheduler (single-threaded, message queue)
    profile.actor.ts
    sync.actor.ts
    types.ts                # Message<T>, Event<T>, Actor<S,M,E>

  controllers/              # input → message translation
    keymap.ts               # global keybindings → actor messages
    profile.controller.ts   # route-level controllers, hooks for views

  views/                    # stateless components: render(props) → ui
    components/             # primitives: <Card>, <List>, <Field>, <StatusBar>
    panels/                 # feature panels: <ProfilePanel>, <PlanPreview>
    theme/                  # theme provider, tokens, useTheme hook

  lib/                      # framework-agnostic helpers (no domain knowledge)
    result.ts               # Result<T, E>
    fs.ts                   # Bun.file/Bun.write thin wrappers if needed
    id.ts                   # ulid/uuid

  test-utils/               # shared fixtures, tmp dir factories
    tmp.ts
    fixtures.ts

tests/                      # integration tests that span layers (repositories + FS)
docs/
  CONSTITUTION.md
  adrs/
```

Rules enforced by review (and, where possible, by `oxlint` import restrictions):

- `domain/*` **MUST NOT** import from any other layer.
- `repositories/*` **MUST NOT** import from `services`, `actors`, `controllers`, `views`, `routes`.
- `services/*` **MUST** depend on `repositories/types.ts` only — never on a concrete repository — except at the composition root.
- `controllers/*` **MUST NOT** import `repositories/*`. Controllers go through services or send actor messages.
- `views/*` **MUST NOT** import `services`, `repositories`, `actors`. Views receive props or call hooks exposed by `controllers/`.
- `routes/*` are thin: a route file wires a controller hook to a view.

### 4.2 Domain entities

Entities are plain TypeScript types with explicit identity. Each entity has a **schema** (runtime validator) and the type is **derived from the schema**, not the other way around.

```typescript
// src/domain/dotfile.ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { object, string, literal, union } from "./schema";

export const DotfileKindSchema = union([
  literal("file"),
  literal("directory"),
  literal("template"),
]);
export type DotfileKind = StandardSchemaV1.InferOutput<typeof DotfileKindSchema>;

export const DotfileSchema = object({
  id: string(), // stable id (path hash)
  source: string(), // absolute path in the dotfiles repo
  target: string(), // absolute path in $HOME
  kind: DotfileKindSchema,
});
export type Dotfile = StandardSchemaV1.InferOutput<typeof DotfileSchema>;
```

Aggregates own invariants:

```typescript
// src/domain/profile.ts
export const ProfileSchema = object({
  id: string(),
  name: string(),
  dotfiles: array(DotfileSchema), // members
});
export type Profile = StandardSchemaV1.InferOutput<typeof ProfileSchema>;

export function profileWithDotfile(p: Profile, d: Dotfile): Profile {
  if (p.dotfiles.some((x) => x.target === d.target)) {
    throw new DomainError("DUPLICATE_TARGET", { target: d.target });
  }
  return { ...p, dotfiles: [...p.dotfiles, d] };
}
```

`DomainError` is a tagged union in `domain/errors.ts`. Domain code throws it; service layer converts to `Result`.

#### Schema choice

We adopt the **Standard Schema** spec ([standardschema.dev](https://standardschema.dev)) as the contract — a tiny interface implementations agree on. We ship a minimal in-tree implementation in `src/domain/schema.ts` that satisfies `StandardSchemaV1`. Rationale:

- Bun has no built-in schema validator. We refuse to add a heavy dep (`zod`, `valibot`) without need.
- Standard Schema lets us swap in `zod`/`valibot` later by importing their `~standard` property — no call-site changes.
- The minimal implementation covers `string`, `number`, `boolean`, `literal`, `union`, `object`, `array`, `optional` — sufficient for filesystem and config shapes.

If validation needs outgrow the in-tree validator, a future ADR **MAY** swap the implementation; consumers are insulated by the spec.

### 4.3 Repositories

Repositories are interface-first. The interface lives in `repositories/types.ts`; the implementation lives next to it.

```typescript
// src/repositories/types.ts
import type { Result } from "../lib/result";
import type { Dotfile, Profile } from "../domain";

export interface DotfileRepository {
  readonly kind: "DotfileRepository";
  list(): Promise<Result<Dotfile[], RepoError>>;
  read(id: string): Promise<Result<Dotfile, RepoError>>;
  write(dotfile: Dotfile): Promise<Result<void, RepoError>>;
}

export interface ProfileRepository {
  readonly kind: "ProfileRepository";
  list(): Promise<Result<Profile[], RepoError>>;
  upsert(profile: Profile): Promise<Result<Profile, RepoError>>;
}

export type RepoError =
  | { tag: "NotFound"; id: string }
  | { tag: "ParseError"; path: string; cause: unknown }
  | { tag: "IoError"; path: string; cause: unknown };
```

```typescript
// src/repositories/dotfile.repository.ts
import { Bun } from "bun";
import { DotfileSchema } from "../domain";
import { ok, err, type Result } from "../lib/result";
import type { DotfileRepository, RepoError } from "./types";

export function createDotfileRepository(root: string): DotfileRepository {
  return {
    kind: "DotfileRepository",
    async read(id) {
      const path = `${root}/${id}.json`;
      const file = Bun.file(path);
      if (!(await file.exists())) return err({ tag: "NotFound", id });
      const raw = await file.json();
      const parsed = await DotfileSchema["~standard"].validate(raw);
      if (parsed.issues) return err({ tag: "ParseError", path, cause: parsed.issues });
      return ok(parsed.value);
    },
    // ...
  };
}
```

Repository invariants:

- Every repository method returns `Promise<Result<T, RepoError>>`. No naked throws across the layer boundary.
- Every read **MUST** validate against the schema. A repository **MUST NOT** return `unknown`.
- IO **MUST** use Bun builtins: `Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.$`. `node:fs` is permitted only where Bun lacks the operation (e.g. `fs.mkdtemp` for tests until Bun ships an equivalent).

### 4.4 Services

Services orchestrate. They depend on repository **interfaces** (DIP) and emit events.

```typescript
// src/services/types.ts
import type { Profile, Dotfile } from "../domain";
import type { Result } from "../lib/result";

export type ServiceError =
  | { tag: "NotFound"; resource: string; id: string }
  | { tag: "Conflict"; reason: string }
  | { tag: "Repository"; cause: unknown };

export interface ProfileService {
  list(): Promise<Result<Profile[], ServiceError>>;
  addDotfileToProfile(profileId: string, dotfile: Dotfile): Promise<Result<Profile, ServiceError>>;
}
```

```typescript
// src/services/profile.service.ts
export function createProfileService(deps: {
  profiles: ProfileRepository;
  dotfiles: DotfileRepository;
}): ProfileService {
  return {
    async addDotfileToProfile(profileId, dotfile) {
      const p = await deps.profiles.list();
      if (!p.ok) return err({ tag: "Repository", cause: p.error });
      const profile = p.value.find((x) => x.id === profileId);
      if (!profile) return err({ tag: "NotFound", resource: "Profile", id: profileId });
      const next = profileWithDotfile(profile, dotfile); // domain invariant
      const saved = await deps.profiles.upsert(next);
      if (!saved.ok) return err({ tag: "Repository", cause: saved.error });
      return ok(saved.value);
    },
    // ...
  };
}
```

Service invariants:

- A service is a closure over its dependencies. No singletons, no module-level state.
- A service **MUST NOT** import a concrete repository factory. It receives interfaces.
- A service **MUST** translate `RepoError` to its own `ServiceError` so callers do not depend on the storage layer's error vocabulary.

### 4.5 Controllers

Controllers live in `controllers/` and expose **hooks** that views consume. A controller's job: take user intent (a key, a click, a selection), call a service or send an actor message, expose state to the view.

```typescript
// src/controllers/profile.controller.ts
export function useProfilePanel() {
  const service = useService("profile");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<ServiceError | null>(null);

  useEffect(() => {
    service.list().then((r) => (r.ok ? setProfiles(r.value) : setError(r.error)));
  }, [service]);

  const addDotfile = useCallback(
    async (profileId: string, dotfile: Dotfile) => {
      const r = await service.addDotfileToProfile(profileId, dotfile);
      if (r.ok) setProfiles((xs) => xs.map((x) => (x.id === r.value.id ? r.value : x)));
      else setError(r.error);
    },
    [service],
  );

  return { profiles, error, addDotfile };
}
```

Routes (`routes/profiles.tsx`) **MUST** stay thin — call the hook, render the view.

### 4.6 Composition root

`src/index.tsx` is the only place where concrete repositories meet concrete services. It is the only place where `createCliRenderer` runs.

```typescript
// src/index.tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { createDotfileRepository } from "./repositories/dotfile.repository"
import { createProfileRepository } from "./repositories/profile.repository"
import { createProfileService } from "./services/profile.service"
import { createActorRuntime } from "./actors/runtime"
import { App } from "./app"

const root = `${process.env["HOME"]}/.config/lazy-dotfiles`
const dotfiles = createDotfileRepository(`${root}/dotfiles`)
const profiles = createProfileRepository(`${root}/profiles`)
const services = {
  profile: createProfileService({ profiles, dotfiles }),
  // ...
}
const actors = createActorRuntime({ services })

const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<App services={services} actors={actors} renderer={renderer} />)
```

`App` injects services + actor runtime via React context. Hooks (`useService("profile")`, `useActor("sync")`) read from that context. Tests **MUST** be able to substitute test doubles by providing a different context.

### 4.7 Bun runtime + bun:test

- `package.json` `scripts` **MUST** be Bun-native: `bun run`, `bun test`, `bun build`. No npm scripts shadowed by `node`.
- Tests use `bun:test`. File pattern: co-located `*.test.ts` for unit (services, reducers, domain), and `tests/` for integration (repositories against tmp dirs).
- `tsconfig.json` already has `jsxImportSource: "@opentui/react"`, `strict: true`, `noUncheckedIndexedAccess: true`. We **MUST NOT** loosen these.
- `bunfig.toml` **SHOULD** be added with `[test] preload = ["./test-utils/tmp.ts"]` once we have shared setup.

### 4.8 Tooling

- `oxlint` — `correctness: error` already configured. We **SHOULD** add layered import restrictions when oxlint supports them, or as a custom check via `bun build --no-bundle` typecheck pass.
- `oxfmt` — single-source-of-truth formatter. CI **MUST** run `bun run fmt:check`.
- `tsr generate` produces `routeTree.gen.ts`. The file already has `/* eslint-disable */` and `// @ts-nocheck` — leave it.

## Implementation Plan

1. Create directory skeleton: `domain/`, `repositories/`, `services/`, `actors/`, `controllers/`, `views/`, `lib/`, `test-utils/`, `tests/`.
2. Land `lib/result.ts` (`Result<T, E>` with `ok`/`err`/`map`/`flatMap`).
3. Land `domain/schema.ts` — minimal Standard-Schema-conforming validator (string, number, boolean, literal, union, object, array, optional).
4. Define first entity (`Dotfile`) + schema + a red unit test for `DotfileSchema.validate`.
5. Define first repository interface + implementation against a tmp dir, with integration tests.
6. Define first service + unit tests with a fake repository.
7. Wire composition root in `src/index.tsx`; expose services/actors via context.
8. Migrate existing routes (`index`, `about`, `settings`) to use a controller hook each, even if trivial — establishes the pattern.
9. Add `bunfig.toml` with `[test]` block once a preload is needed.
10. Add a layered-import lint rule (oxlint or `bun run check:layers` script using `bun build --no-bundle` + a small AST pass).

Each step lands behind tests. Step (10) is "if performance/scale requires it" — for a small repo, code review + a smoke test of imports is sufficient until violations appear.
