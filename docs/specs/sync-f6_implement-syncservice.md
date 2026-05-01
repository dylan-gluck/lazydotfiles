# Spec: sync.service

| Field         | Value                                                     |
| ------------- | --------------------------------------------------------- |
| Bean          | `ldf-vfwk`                                                |
| Parent epic   | `ldf-egel` (Sync F6)                                      |
| PRD reference | §F6, §A6, §N7                                             |
| ADR reference | ADR-001 §4.4 (services), Constitution §2.1 (Result), §6.4 |

## Goal

Provide the only entry point for `jj git fetch`/`jj git push`, ahead/behind reporting, conflict surface, and per-file conflict resolution. CLI and TUI consume this service; nobody else touches `JjRepository.gitFetch`/`gitPush`.

## Public surface

`src/services/sync.service.ts`:

```ts
import type { ConflictDescriptor, SyncState } from "../domain/repo";
import type { Result } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import type { ServiceError } from "./types";

export type ResolveChoice = "ours" | "theirs" | "edit";

export interface SyncOutcome {
  readonly state: SyncState; // freshly read after the op
  readonly conflicts: readonly ConflictDescriptor[]; // mirror of state.conflicts
}

export interface SyncService {
  state(): Promise<Result<SyncState, ServiceError>>;
  fetch(): Promise<Result<SyncOutcome, ServiceError>>;
  push(): Promise<Result<SyncOutcome, ServiceError>>;
  /** fetch then push; stops at the first conflict and returns SyncOutcome with conflicts. */
  sync(): Promise<Result<SyncOutcome, ServiceError>>;
  /**
   * Resolve a single conflicted path. "ours" / "theirs" rewrite the file in the
   * dotfiles working copy by selecting the matching side from the conflict
   * markers and re-snapshotting. "edit" calls `editor.run(path)` and snapshots
   * after the editor exits; the caller (actor) is responsible for suspending
   * the renderer around the call (see `editor` dep below).
   */
  resolve(opts: {
    path: string; // dotfiles-repo-relative
    choice: ResolveChoice;
  }): Promise<Result<SyncOutcome, ServiceError>>;
}

export interface EditorRunner {
  /** Runs $EDITOR against an absolute path; resolves to ok(undefined) on exit 0. */
  run(absPath: string): Promise<Result<void, ServiceError>>;
}

export function createSyncService(deps: {
  jj: JjRepository;
  root: string; // dotfiles repo root (absolute)
  editor: EditorRunner;
  /** Optional now() override for `lastSyncAt`; defaults to () => new Date(). */
  now?: () => Date;
}): SyncService;
```

`src/services/sync.editor.ts` (separate file, same layer):

```ts
export interface EditorOptions {
  readonly env?: NodeJS.ProcessEnv; // for tests; defaults to process.env
  readonly fallback?: string; // when $EDITOR is unset; default "vi"
  /**
   * Hook invoked around the spawn so the TUI can pause/resume the renderer.
   * Defaults to `(fn) => fn()` (no-op) for CLI / non-TUI callers.
   */
  readonly suspend?: <T>(fn: () => Promise<T>) => Promise<T>;
}
export function createEditorRunner(opts?: EditorOptions): EditorRunner;
```

## Internal design

### `state()`

Wraps `jj.status({root})` and adds ahead/behind + conflicts:

- Ahead: `jj log -r 'remote_bookmarks()..@' --no-graph -T '"x\n"'` line count.
- Behind: `jj log -r '@..remote_bookmarks()' --no-graph -T '"x\n"'` line count.
- When no remote is configured, both counts are `0` and `state.remote = null`.
- Conflicts: `jj resolve --list` (exit 0 with list, exit 2 when none — treat 2-with-empty-stdout as `[]`); each non-empty line is `<status> <path>`; emit `{path, kind: "edit-pending" | "ours"}` — default to `"ours"` for unresolved entries (i.e. not yet chosen). The descriptor's `kind` is the **pending UI choice**, not jj's status; default is `"ours"` so the panel renders a focused button.

### `fetch()` / `push()` / `sync()`

1. Run `jj git fetch` / `jj git push` (sync = fetch then push).
2. Re-read `state()` and return `{state, conflicts: state.conflicts}`.
3. Push failures with stderr matching `/conflict/i` are not reported as `Repository` errors — they bubble as `ServiceError.Repository{cause: Spawn}` so the actor can decide. Conflicts arise from fetch (merging incoming changes); the actor renders them from `state.conflicts`.
4. `lastSyncAt` is **derived** in the service: when fetch+push both succeed, the service writes `now().toISOString()` into the returned `SyncState.lastSyncAt`. (No persistence in MVP — the actor's in-memory state is the source of truth; CLI prints what fetch+push reported.)

### `resolve()`

For `choice ∈ {"ours","theirs"}`:

1. Read the absolute file at `${root}/${path}` via `Bun.file(...).text()`.
2. Strip jj's git-style conflict markers, keeping the chosen side. Markers:
   - `<<<<<<<` … `|||||||` … `=======` … `>>>>>>>` (the `|||||||` "base" block exists on 3-way conflicts; ignore it).
   - `ours` = lines between `<<<<<<<` and the first of `|||||||` or `=======`.
   - `theirs` = lines between `=======` and `>>>>>>>`.
3. Write the rewritten content via `Bun.write`.
4. `jj.snapshot({root})` so jj records resolution.

For `choice = "edit"`:

1. Compute `absPath = ${root}/${path}`.
2. `await deps.editor.run(absPath)`; bubble error.
3. `jj.snapshot({root})`.

After any successful resolution the service re-reads `state()` and returns `SyncOutcome`.

### Editor runner (`createEditorRunner`)

- Resolves command from `env["EDITOR"]`; falls back to `opts.fallback ?? "vi"`. Quoted args (e.g. `"code -w"`) are split on whitespace.
- Wraps `Bun.spawn` with `stdio: ["inherit","inherit","inherit"]`.
- Wraps the spawn in `await opts.suspend(() => …)` when provided.
- Returns `err({tag:"Repository", cause:{tag:"Spawn", command, exitCode, stderr:""}})` on non-zero exit.
- A separate `createSuspendingEditorRunner({renderer, base})` lives in the composition root (not in services), to keep services free of renderer knowledge. The default `editor` injected by `wireServices` is `createEditorRunner()` (no suspend); the TUI re-wires it from `App` via a context provider that decorates with renderer suspend.

## Dependencies

- Spec: `sync-f6_extend-syncstate-with-conflict-descriptors.md` (provides `SyncState.conflicts`).
- Code: `repositories/jj.repository.ts` (extended with `gitFetch`, `gitPush`, `aheadBehind`, `listConflicts`, plus `snapshot` already present).
- External: none new.

### JjRepository additions (in same task)

```ts
interface JjRepository {
  // existing: gitFetch, gitPush, status, snapshot, ...
  aheadBehind(opts: {
    root: string;
  }): Promise<Result<{ ahead: number; behind: number }, RepoError>>;
  listConflicts(opts: { root: string }): Promise<Result<readonly string[], RepoError>>;
}
```

`status({root})` is updated to populate `ahead`, `behind`, and `conflicts: []` (empty by default — service merges in conflicts via `listConflicts`).

## Tests

`src/services/sync.service.test.ts` (unit, fake `JjRepository` + fake `EditorRunner`):

- `fetch` ok → returns SyncOutcome with `state.lastSyncAt` set to injected `now()`.
- `fetch` fail → returns `ServiceError.Repository{cause: Spawn}` and does not call push.
- `push` ok on top of clean fetch → state mirrors fake repo.
- `sync` runs fetch then push in order; push not called when fetch fails.
- `state()` merges `aheadBehind` + `listConflicts` into `SyncState`.
- `resolve({path, choice:"ours"})` rewrites a fixture file (in tmp dir) keeping the ours side; calls `jj.snapshot`.
- `resolve({path, choice:"theirs"})` keeps the theirs side.
- `resolve({path, choice:"edit"})` invokes `editor.run(absPath)` exactly once.
- Conflict marker stripping handles 2-way and 3-way (`|||||||` base) markers.

`src/repositories/jj.repository.parse.test.ts` (extend):

- `parseAheadBehind` from a sample stdout (4 newlines = 4 commits).
- `parseConflictList` from `jj resolve --list` output.

## Acceptance

- `services.sync.fetch()`, `push()`, `sync()` all return typed `Result`s.
- Conflict markers are stripped correctly for both ours/theirs choices (asserted on a fixture).
- `editor.run` is invoked with the absolute path; the service does not import the renderer.
- PRD §A6 is reachable through this service: integration test (`ldf-g7e7`) calls `services.sync.sync()` against a bare-git remote and observes ahead/behind transitions.

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
