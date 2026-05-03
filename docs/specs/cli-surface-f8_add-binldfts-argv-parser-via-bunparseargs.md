# cli-surface-f8 — argv parser & dispatcher

- **Bean:** ldf-xnsc
- **Parent epic:** ldf-zfcv (CLI surface, F8)
- **PRD:** §F8, §G5, §A1
- **ADR:** ADR-001 §4.1 (composition root, no biz logic in entry), §4.5 (CLI is shell over services)
- **Constitution:** §2.1 (Result, no swallowed errors), §2.4 (no `process.exit` outside binary entry), §6.1, §6.4

## Goal

A single, testable CLI entry that parses argv with `node:util.parseArgs` (Bun-supported, no extra dep), routes to subcommand handlers, and returns an exit code. The binary `bin/ldf.ts` is the only place `process.exit` is permitted.

## Public surface

```ts
// src/cli/index.ts
export interface CliIO {
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}

export interface CliDeps {
  readonly services: import("../composition/services").Services;
  readonly io: CliIO;
  /** Optional TUI launcher. When absent, `ldf` no-arg returns 0 after bootstrap. */
  readonly launchTui?: () => Promise<number>;
}

/** Entry point. argv is the program args (no node, no script). Returns exit code. */
export function runCli(argv: readonly string[], deps: CliDeps): Promise<number>;

/** The set of recognized subcommands. */
export type Subcommand = "status" | "log" | "add" | "rm" | "config" | "sync";
```

```ts
// bin/ldf.ts
// Wires real services via wireServices and calls runCli; the only place we set
// `process.exitCode`. No `process.exit()` (CONSTITUTION §6.1).
```

Exit codes (PRD §F8):

- `0` success
- `1` user error: unknown subcommand, bad path, unknown option, malformed value
- `2` operational failure: bootstrap failed, rollback engaged, conflict, push failure

## Internal design

- Parse with `parseArgs({ args, options, allowPositionals: true, strict: false })` so per-subcommand flag parsing is local.
- First positional is the subcommand. Empty argv → no-arg path: run bootstrap, then `launchTui?.()` if provided, else return 0.
- Bootstrap is invoked once before any subcommand except none-arg path (where it precedes TUI launch). Bootstrap failure → exit 2 with the error message on stderr.
- Dispatch table is a `Record<Subcommand, (rest, deps) => Promise<number>>`. Unknown subcommand → stderr "unknown command: <x>", exit 1.
- Every handler returns `Promise<number>` and writes via `deps.io.stdout`/`deps.io.stderr`. No console calls anywhere in `src/cli/`.

## Dependencies

- `composition/services.ts::Services`, `composition/services.ts::wireServices` (binary entry only).
- `lib/format.ts` (this phase) for output formatting.
- Per-subcommand handler specs (status, log, add/rm, config, sync).

## Tests

- `runCli([], deps)` runs bootstrap and returns 0 when `launchTui` absent.
- `runCli(["unknown"], deps)` → exit 1, stderr contains "unknown command".
- `runCli(["status"], …)` dispatches to `status` handler (verified via spy stdout).
- Bootstrap error from `services.bootstrap.run()` → exit 2, stderr non-empty.
- `bin/ldf.ts` is the only file in the repo containing `process.exit*` references (verified by `search`).

## Acceptance

- A1 (TUI launch path): `ldf` no-arg bootstraps and (when wired) opens TUI.
- F8 row 1.
- No domain logic in CLI: handlers call only service methods.
- All errors typed via `ServiceError`, formatted to actionable strings on stderr.

## Review

Approved after Step 4 review: dispatcher is the only owner of `process.exitCode`; handlers are pure-ish functions parameterized by `CliIO`, enabling capture-stdout unit tests without spawn.
