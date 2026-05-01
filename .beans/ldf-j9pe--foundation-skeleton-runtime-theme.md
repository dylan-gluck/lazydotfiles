---
# ldf-j9pe
title: Foundation - skeleton, runtime, theme
status: todo
type: epic
priority: high
created_at: 2026-05-01T04:21:41Z
updated_at: 2026-05-01T04:21:41Z
parent: ldf-euyx
---

Lay the layered skeleton from ADR-001 and the TUI runtime from ADR-002 so every later phase plugs into stable seams. **No domain features land here** — this epic is the wall.

## Scope
- ADR-001 §4.1 directory skeleton: `domain/`, `repositories/`, `services/`, `controllers/`, `actors/`, `views/`, `lib/`, `test-utils/`, `tests/`, plus the carve-outs in `views/theme/` and `views/components/`, `views/panels/`.
- `lib/result.ts` — `Result<T,E>` with `ok`/`err`/`map`/`flatMap`.
- `domain/schema.ts` — minimal Standard-Schema-conforming validator (`string`, `number`, `boolean`, `literal`, `union`, `object`, `array`, `optional`).
- `domain/errors.ts` — `DomainError` tagged union.
- `actors/runtime.ts` — `Actor<S,M,E>`, inbox queue, pure reducer dispatch, effect runner, subscribers, event bus, `dispose()`.
- `actors/use-actor.ts` — React hook subscribing for component lifetime.
- `controllers/keymap.ts` — `Binding` table + `dispatchKeymap` + `<GlobalKeys>` view.
- `views/theme/` — `ThemeProvider`, dark/light tokens, `useTheme` hook.
- `views/components/app-shell.tsx` — header / `<Outlet/>` / status-bar shell.
- `composition/services.ts` + `composition/actors.ts` — wireServices, wireActors stubs that later phases extend.
- Composition root rewrite of `src/index.tsx` per ADR-002 §4.1 (single renderer, single exit, router context carries `services` + `actors`, top-level `useEffect` calls `actors.dispose()`).
- `bunfig.toml` `[test] preload` once shared setup exists.
- `test-utils/tmp.ts` — `withTmpDir` factory using `fs.mkdtemp`.

## Acceptance
- All non-negotiables in CONSTITUTION §6 hold post-merge.
- `bun test` passes (counter-actor unit test + schema validator unit test + result unit test).
- `bun dev` boots, renders empty Status route, exits cleanly via `q` (no `process.exit`).
- No layer cross-imports (verified by review checklist; oxlint rule deferred per ADR-001 §4.8).

## Maps to PRD
Substrate for **all** features. No PRD requirement closes here, but every later epic is **blocked-by** this one.
