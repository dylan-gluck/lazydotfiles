# Constitution — `lazydotfiles`

| Revision | Date       | Author |
| -------- | ---------- | ------ |
| 1        | 2026-05-01 | core   |
| 2        | 2026-05-04 | core   |

The key words "**MUST**", "**MUST NOT**", "**REQUIRED**", "**SHALL**", "**SHALL NOT**", "**SHOULD**", "**SHOULD NOT**", "**RECOMMENDED**", "**MAY**", and "**OPTIONAL**" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

This constitution governs every commit. Conflict with any other doc → constitution wins. ADRs refine; they **MUST NOT** override.

## 1. Architecture

### 1.1 Actor model

State **MUST** live inside actors. An actor is a single owner of a piece of state with a typed inbox (`Message`) and a typed outbox (`Event`). Actors **MUST NOT** share mutable state. Coordination **MUST** be by message passing.

- One actor → one bounded context (one aggregate root).
- Actors **MUST** be deterministic given `(state, message)` → `(state', events)`.
- Side effects (FS, child process, network) **MUST** be issued through repositories invoked by services, not from inside the reducer.
- Cross-actor calls **MUST** be events on the bus, not direct method calls.

### 1.2 Entity-first, domain-driven

Every feature **MUST** start from a domain entity, not a screen. Define `Entity → Aggregate → Repository → Service → Controller → View`. Build outward. Views **MUST NOT** invent domain concepts.

- Entities **MUST** be plain data with explicit identity (`id`).
- Aggregates **MUST** own their invariants. No setter bypass.
- Repository **MUST** be the only path to persistence (filesystem, git, kv).
- Service **MUST** be the only place business logic lives.
- Controller **MUST** translate UI/input intent into service calls or actor messages.
- View **MUST** be stateless: render `(props) → ui`. No side effects beyond local UI state (focus, hover, scroll position).

### 1.3 SOLID, DRY, YAGNI

- **SRP**: one file → one reason to change. Mixed concerns **MUST** be split.
- **OCP**: extend via new types/strategies, not by editing closed call sites.
- **LSP**: subtypes **MUST** honor parent contracts. No `throw new Error("not impl")` on a public method.
- **ISP**: callers **MUST** depend on the narrowest interface they use. No god-interfaces.
- **DIP**: services depend on repository **interfaces**, not concrete implementations. Wire concretes at the composition root only.
- **DRY**: second occurrence of a pattern → extract. Third **MUST** trigger an abstraction.
- **YAGNI**: speculative abstractions **MUST NOT** land. Add the seam when the second consumer arrives, not before.

### 1.4 Contract-first, schema-first

Every boundary that crosses trust (filesystem read, child process output, user input, IPC) **MUST** have a schema. The schema **MUST** be the single source of truth — types are derived from it, not the other way around.

- Define the contract first, in code (TypeScript types + a runtime validator). Then implement.
- Outbound data **MUST** also be validated when shape correctness matters (e.g. writing a config the next launch must read back).
- A repository return type **MUST** be a parsed domain entity, never `unknown` or `any`.
- Inter-actor messages and events **MUST** be discriminated unions tagged by `kind` (or `type`).

## 2. Code quality

### 2.1 Truth, not plausibility

Code **MUST** tell the truth about the system. Functions that "look like they work" but silently swallow failure are forbidden.

- A function that can fail **MUST** return `Result<T, E>` (or throw a typed error if the call site convention is throw). Returning `null`/`undefined` for "failed" is **PROHIBITED** when the failure mode carries information.
- Error types **MUST** be narrow enough to discriminate; `Error` alone is insufficient at domain boundaries.
- Logs **MUST NOT** be the recovery mechanism. `console.warn` is **NOT** error handling.

### 2.2 Layout discipline (TUI)

OpenTUI handles ANSI sizing. Hand-computed widths and heights drift on resize.

- Layout **MUST** use flexbox properties (`flexDirection`, `flexGrow`, `flexShrink`, `flexBasis`, `gap`, `justifyContent`, `alignItems`, `flexWrap`).
- `width`/`height` **MUST NOT** be hard-coded numeric pixels for layout flow. Exception: fixed UI affordances (1-line status bar `height={1}`, fixed-glyph borders) where the value is part of the design, not a sizing guess.
- Percentages (`"100%"`) are **PERMITTED** when the parent has explicit size; otherwise **MUST** use `flexGrow={1}`.
- "Grid" layouts **MUST** be expressed as `flexDirection="row"` + `flexWrap="wrap"`. There is no CSS grid in OpenTUI.
- Centering **MUST** use `justifyContent` + `alignItems`, never margin math.

### 2.3 Stateless components, global theme

UI components **MUST** be stateless except for transient interaction state (focus, hover, scroll, edit buffer). Domain state lives in actors.

- Theme **MUST** come from a single `ThemeProvider`. Hard-coded color hexes in components are **PROHIBITED** outside the theme module.
- Components **MUST** read theme via a hook (`useTheme`), not import a colors module directly.

### 2.4 Lifecycle

- The renderer **MUST** be created exactly once at the composition root.
- Exit **MUST** go through `renderer.destroy()`. `process.exit()` is **PROHIBITED** in app code.
- Actors and subscriptions **MUST** be torn down on unmount; `useEffect` cleanups are **REQUIRED** for any side-effecting hook.

## 3. Testing

### 3.1 Red → green → refactor

Every domain service, every reducer, every repository **MUST** have tests. Tests **MUST** be written red before the code that makes them green. A merge with a service untested at the unit level **MUST NOT** land.

- Unit tests cover services and reducers (pure logic).
- Integration tests cover repositories against a real filesystem in a tmp dir (`Bun.file`, `fs.mkdtemp`).
- Snapshot tests cover view layout via `@opentui/react/test-utils`.
- Mocks **SHOULD** be avoided. When a real dependency is too heavy, prefer a fake (a real implementation with simplified backing) over a mock.

### 3.2 Test location

Tests **MUST** live under `tests/` mirroring the `src/` directory layout (e.g. a unit covering `src/services/foo.ts` lives at `tests/services/foo.test.ts`). Co-located `*.test.ts(x)` files inside `src/` are **PROHIBITED**.

- Shared test fixtures and helpers **MUST** live under `tests/test-utils/` (no parallel `src/test-utils/`).
- The Bun preload (`bunfig.toml [test] preload`) **MUST** point into `tests/test-utils/`.
- Acceptance pointers and audit references **MUST** use the `tests/...` path.

### 3.3 Meaningful

A test **MUST** fail for a specific reason. Tests that only assert "did not throw" are **PROHIBITED** unless the production code's only contract is "does not throw".

- Each test name **MUST** state the behavior, not the function name.
- Each test **MUST** assert the observable outcome (state, event emitted, file written), not internal calls.

## 4. Tooling

- Runtime: **Bun**. `bun run`, `bun test`, `bun build`. Node binaries **MUST NOT** be invoked in scripts.
- IO: prefer Bun builtins (`Bun.file`, `Bun.write`, `Bun.spawn`, `Bun.$`) over `node:fs`/`node:child_process`. Only fall back to `node:` when Bun lacks the API.
- Lint: `oxlint`. Format: `oxfmt`. Pre-merge **MUST** be clean.
- TypeScript: `strict: true`, `noUncheckedIndexedAccess: true`. `any` is **PROHIBITED** outside generated code (`routeTree.gen.ts`) and narrowly-scoped `as unknown as T` at validated boundaries.
- Generated files (`routeTree.gen.ts`) **MUST NOT** be edited by hand and **MUST** be excluded from lint/format.

## 5. Process

- Every architecturally significant change **MUST** land an ADR before or with the change. "Significant" = it constrains future code.
- ADRs **MUST** follow the structure in `skill://architecture-decision-records`.
- The constitution **MAY** be amended by an ADR that explicitly supersedes a clause and bumps the constitution's revision.

## 6. Non-negotiables

The following are inviolable; their violation **MUST** block merge:

1. No `process.exit()`. Use `renderer.destroy()`.
2. No mutable shared state outside actors.
3. No domain logic in components.
4. No repository call outside services.
5. No untyped boundary. Every parsed input has a schema.
6. No hand-rolled width/height for layout flow. Use flexbox.
7. No untested service or reducer.
8. No `any` outside the carve-outs in §4.
9. No co-located `*.test.ts(x)` inside `src/`. Tests live under `tests/` mirroring `src/`.
