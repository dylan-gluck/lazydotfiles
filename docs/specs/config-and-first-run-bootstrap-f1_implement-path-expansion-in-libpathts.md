# Spec: path expansion in `lib/path.ts`

- Source bean: `ldf-yl37`
- Parent epic: `ldf-hia6`
- References: PRD §F1, README "Configuration", CONSTITUTION §1.3 (DRY)

## Goal

Pure helper that expands `$HOME` and a leading `~` in config string fields. Lives in `lib/`, not in the schema, so the parsed `Config` retains the user's literal source until a caller decides to resolve.

## Public surface

```ts
// src/lib/path.ts
/**
 * Replace a leading `~` and every `$HOME` token with `home`.
 * Returns the string unchanged if neither token is present.
 */
export function expandHome(input: string, home: string): string;

/**
 * Expand `path.home`, `path.dotfiles`, `path.backup` in a `Paths` aggregate.
 * Pure; returns a new `Paths`.
 */
export function expandPaths<P extends { home: string; dotfiles: string; backup: string }>(
  paths: P,
  home: string,
): P;
```

## Internal design

- `expandHome` rules, in order:
  1. If `input` starts with `~/` or equals `~`, replace the leading `~` with `home`.
  2. Replace every literal occurrence of `$HOME` with `home` (substring replace, not regex group).
- `expandPaths` calls `expandHome` on each of `home`, `dotfiles`, `backup` and returns a new object spread over the input (so callers may pass extended types).
- No filesystem access. Pure.

## Dependencies

- None.

## Tests

`tests/lib/path.test.ts`:

- `expandHome("$HOME/dotfiles", "/u/x")` → `"/u/x/dotfiles"`.
- `expandHome("~/x", "/u/x")` → `"/u/x/x"`.
- `expandHome("~", "/u/x")` → `"/u/x"`.
- `expandHome("/abs", "/u/x")` returns `"/abs"` unchanged.
- `expandHome("a/$HOME/b", "/u/x")` → `"a//u/x/b"` (token replaced wherever it appears).
- `expandPaths({ home: "$HOME", dotfiles: "$HOME/d", backup: "~/.b" }, "/u/x")` → `{ home: "/u/x", dotfiles: "/u/x/d", backup: "/u/x/.b" }`.
- Mid-string `~` (`"a/~/b"`) is **not** expanded — only a leading `~/` or bare `~`.

## Acceptance

- File `src/lib/path.ts` exports `expandHome` and `expandPaths`.
- Tests pass under `bun test`.
- No service or repository hand-rolls path expansion; all callers route through this helper.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
