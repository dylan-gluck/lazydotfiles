# Build Phase

## Overview

This SOP orchestrates one full build-phase cycle of the `lazydotfiles` MVP: **Research → Plan → Implement → Validate**. A "phase" is one epic bean (child of milestone `ldf-euyx`) and its task children. The agent runs this SOP once per phase, taking the epic from `todo` (or `in-progress`) through to `completed` with all tasks satisfied, all spec docs written, all tests green, and the change committed via `jj`.

Use this SOP whenever the user asks to "build the next phase", "work on the foundation epic", "advance the MVP", or after a previous phase has just been merged. It is the single entry point for forward-progress work on the MVP build plan recorded in beans.

The SOP enforces the engineering rules in [`docs/CONSTITUTION.md`](../CONSTITUTION.md), the layered architecture in [`docs/adrs/001_project.md`](../adrs/001_project.md), and the TUI runtime contract in [`docs/adrs/002_tui.md`](../adrs/002_tui.md). It assumes the build plan in [`docs/prds/001_mvp.md`](../prds/001_mvp.md) and the bean structure created from it.

## Parameters

- **phase_id** (optional): Bean ID of the epic to build (e.g. `ldf-j9pe` for Foundation). When absent, the agent picks the first epic that is `in-progress`; if none, the first `todo` epic in dependency order under milestone `ldf-euyx`.
- **mode** (optional, default: `"auto"`): `"auto"` runs the full cycle without intermediate confirmations; `"interactive"` pauses after Research, after Plan, and before Validate to let the user review.
- **scope** (optional, default: `"all"`): `"all"` processes every incomplete task in the phase; `"<task-id>[,<task-id>...]"` restricts the cycle to a comma-separated list of task IDs within the phase.

**Constraints for parameter acquisition:**

- If all required parameters are already provided, You **MUST** proceed to the Steps.
- If any required parameters are missing, You **MUST** ask for them before proceeding.
- When asking for parameters, You **MUST** request all parameters in a single prompt.
- When asking for parameters, You **MUST** use the exact parameter names as defined.
- All parameters here are optional; if none are supplied, You **MUST** proceed using the defaults.

## Steps

### 1. Identify the phase

Resolve the active phase from beans before reading any code.

**Constraints:**

- You **MUST** run `beans show --json ldf-euyx` to read the milestone and confirm it is the MVP target.
- If `phase_id` is provided, You **MUST** verify the bean exists, has `type = "epic"`, and has parent `ldf-euyx`; if any check fails, You **MUST** stop and report the mismatch instead of guessing.
- If `phase_id` is absent, You **MUST** select the epic via this priority order:
  1. The single epic with `status = "in-progress"` under `ldf-euyx`.
  2. If no epic is in-progress, the first `status = "todo"` epic whose own `--blocked-by` set is fully `completed`.
- You **MUST NOT** start a phase whose blockers are not all `completed`, because downstream tasks in that phase depend on contracts the upstream epic has not yet shipped.
- You **MUST** mark the selected epic `in-progress` via `beans update --json <phase_id> -s in-progress` before continuing, so concurrent agents see the work is claimed.
- You **MUST** record the resolved `phase_id` and proceed to Step 2 in the same turn.

### 2. Enumerate incomplete tasks and gather context

Build the work list, then read every doc and code path the phase touches before writing anything.

**Constraints:**

- You **MUST** list incomplete tasks via `beans query --json '{ bean(id: "<phase_id>") { children { id title status body } } }'` and filter to children whose `status` is not `completed` or `scrapped`.
- If `scope` is a task-ID list, You **MUST** restrict the work list to those IDs and **MUST** verify each ID is a child of `phase_id`; reject any ID that is not.
- You **MUST** read every task body via `beans show --json <id>` to capture acceptance criteria, PRD references, and any progress notes.
- You **MUST** read the documents referenced in each task body, at minimum:
  - [`docs/prds/001_mvp.md`](../prds/001_mvp.md) sections cited by the task (F-numbers, A-numbers, §-numbers).
  - [`docs/CONSTITUTION.md`](../CONSTITUTION.md).
  - [`docs/adrs/001_project.md`](../adrs/001_project.md) and [`docs/adrs/002_tui.md`](../adrs/002_tui.md) sections relevant to the layer being built.
- You **MUST** explore the current codebase for files the phase will touch using `find`, `search`, and `read` (not bash equivalents). For each file You **MUST** read the surrounding context, not only the matched line.
- You **MUST** run `jj log -r 'all() & ~empty()' --no-graph --limit 20` (or `jj log` plus `jj op log --limit 10`) to understand recent commits and the current working-copy state.
- You **MUST** identify pre-existing patterns, helpers, or abstractions that the phase should reuse, and note them. Inventing a parallel convention is **PROHIBITED** by the constitution.
- You **MUST NOT** write any code or spec in this step, because the goal of Research is to map the territory before committing to a design.
- If `mode = "interactive"`, You **MUST** summarize findings (PRD requirements, related code, reuse opportunities, risks) and pause for user review before continuing.

### 3. Write component specs (fan-out)

Produce a contract-first technical spec per task in the work list. Specs land before any implementation so the agent commits to interfaces in writing first.

**Constraints:**

- You **MUST** create one spec per task at `docs/specs/<phase-slug>_<task-slug>.md`, where `<phase-slug>` is the epic's bean slug (kebab-case, e.g. `foundation-skeleton-runtime-theme`) and `<task-slug>` is the task's bean slug.
- Each spec **MUST** contain, in order:
  1. **Header** — title, source bean ID, parent epic ID, PRD/ADR references.
  2. **Goal** — one sentence describing the deliverable.
  3. **Public surface** — exported types, function signatures, schemas, message/event shapes (whichever apply to the layer). Names, parameters, return types **MUST** be concrete; placeholders such as `TODO` or `tbd` are **PROHIBITED** because the spec is the contract the implementer writes against.
  4. **Internal design** — data structures, control flow, error handling, side effects, and which repositories/services are called.
  5. **Dependencies** — other specs (by file path) and external libraries this spec relies on.
  6. **Tests** — one bullet per test case, naming the behavior being asserted.
  7. **Acceptance** — observable outcomes that map directly to the task's acceptance criteria from beans / PRD.
- You **MUST** sequence specs by dependency: a spec **MUST NOT** reference a public surface that has not yet been written or approved, because later specs build on the contracts established by earlier ones.
- You **SHOULD** parallelize spec authoring across independent tasks via the `task` tool when more than three specs are needed, batching tasks that touch disjoint files.
- You **MUST NOT** copy task body text verbatim into the spec; the spec **MUST** add concrete signatures, edge cases, and test outlines that the bean does not contain.
- You **MUST** validate every spec against the constitution non-negotiables (`§6`) before declaring the spec complete; specs that imply `process.exit`, hex literals in components, hand-rolled width/height for layout flow, or untyped boundaries **MUST** be rewritten.

### 4. Review specs for consistency

Before writing code, audit the spec set against the requirements as a whole.

**Constraints:**

- You **MUST** re-read every spec written in Step 3 and verify:
  1. Every PRD requirement assigned to the phase is covered by at least one spec.
  2. Spec-to-spec interfaces match (a caller's expected return type equals the callee's declared return type, byte-for-byte).
  3. No two specs invent the same abstraction; if duplication appears, You **MUST** consolidate into one spec and update references.
  4. Each spec's `Tests` list collectively satisfies the phase's acceptance criteria.
- You **MUST** record the review outcome by appending a `## Review` section to each spec noting any rewrites and the final approval state.
- If a contradiction with PRD or ADR is discovered, You **MUST** stop, surface the conflict, and resolve it (typically by updating the spec; only updating PRD/ADR if the user explicitly authorizes).
- If `mode = "interactive"`, You **MUST** pause and present the spec list for user approval before Step 5.

### 5. Implement (fan-out, dependency-sequenced)

Execute each task against its spec, parallelizing where the dependency graph allows.

**Constraints:**

- You **MUST** mark each task `in-progress` via `beans update --json <task-id> -s in-progress` immediately before starting it, and `completed` immediately after its acceptance criteria hold.
- You **MUST** order task execution by dependency: a task whose spec references another task's public surface **MUST** start after that task is `completed`.
- You **MUST** parallelize tasks with disjoint file sets via the `task` tool. Independent tasks **MUST NOT** be sequenced; sequential execution of independent work is **PROHIBITED** because it wastes the user's wall time.
- Each delegated subagent **MUST** receive the spec file path, the task body, and explicit pointers to the constitution / ADR sections it must respect, because subagents have no access to this conversation.
- You **MUST** write tests red-before-green for every domain service, reducer, repository, and panel touched, per CONSTITUTION §3.1; merging a service untested at the unit level is **PROHIBITED**.
- You **MUST NOT** silently expand scope beyond the task's spec; if a touch outside the spec is required to make tests pass, You **MUST** either (a) update the spec and Step 4 review notes in-place, or (b) file a new follow-up bean and leave the work for it.
- You **MUST** keep task body checklists current: as bullets in the bean's `### N` checklists complete, update them via `beans update --json <task-id> --body-replace-old "- [ ] X" --body-replace-new "- [x] X"`.
- You **MUST NOT** mark a task `completed` while any acceptance criterion is unmet, because the milestone's QA epic relies on each completed task being demonstrably done.

### 6. Validate the phase

Run the full verification matrix before declaring the phase complete.

**Constraints:**

- You **MUST** run `bun test` for the entire repo and assert exit code `0`. If any test fails, You **MUST** fix the failure (or revert the offending change) before proceeding; suppressing tests to make code pass is **PROHIBITED** by the contract.
- You **MUST** run typecheck via the project's check recipe (e.g. `bun check`) and assert exit code `0`.
- You **MUST** run `bun lint` and `bun fmt` (or `bun lint:fix` and `bun fmt`) and commit the resulting whitespace-only changes alongside the code, because pre-merge linters and formatters are required to be clean by CONSTITUTION §4.
- You **MUST** re-read each spec written in Step 3 and confirm the implemented code matches its `Public surface` and `Acceptance` sections. Any drift **MUST** be reconciled by either fixing the code or updating the spec — never both silently.
- You **MUST** verify the phase's PRD acceptance criteria (e.g. `A1`, `A3`) by running the specific scenario the criterion describes; "the unit tests passed" is **NOT** sufficient evidence for an acceptance criterion that names an end-to-end behavior.
- For destructive or filesystem-heavy phases (Track, Sync, Restore), You **MUST** run the integration tests against a tmp `$HOME` from `test-utils/tmp.ts`, never against the real `$HOME`, because operating on the real home would risk user data.

### 7. Update beans and reconcile state

Project the validation result back into the bean graph so the next agent picks up the correct state.

**Constraints:**

- For every task whose acceptance criteria fully hold, You **MUST** mark it `completed` via `beans update --json <task-id> -s completed` and append a `## Summary of Changes` section to its body via `--body-append` describing what landed and where.
- For every task with **any** unmet criterion, You **MUST** keep its status as `in-progress`, append a `## Notes` section describing the gap and the next concrete step, and **MUST NOT** mark it `completed`. Pretending an incomplete task is done is **PROHIBITED** because it corrupts the milestone's QA gate.
- If every task in the phase is `completed`, You **MUST** mark the epic itself `completed` via `beans update --json <phase_id> -s completed` and append a `## Summary of Changes` section linking the spec files written and the most relevant commit hashes.
- If any task is incomplete, You **MUST** leave the epic as `in-progress` and append a `## Outstanding` section to the epic body listing the unmet bean IDs and a one-line reason each.
- You **SHOULD** offer to create follow-up beans for any non-urgent work uncovered during the phase that does not belong to an existing task, citing the bean ID(s) it relates to.
- You **MUST NOT** archive any beans; archival is a user-initiated step.

### 8. Commit the change

Persist the work to the repo via `jj`, including bean files alongside code.

**Constraints:**

- You **MUST** stage the change as a single `jj` commit covering: source code, test files, spec files in `docs/specs/`, and updated bean files in `.beans/`. The bean files are part of the change because they record the new state of the work.
- You **MUST** run `jj describe -m "<phase-slug>: <one-line summary>"` followed by `jj new` (or the project's preferred snapshot dance) so the working copy advances and the next phase starts on a clean change.
- The commit message **SHOULD** include a short body listing the PRD acceptance criteria the phase satisfied and any criteria explicitly deferred.
- You **MUST NOT** run `git push`, `jj git push`, or any sync command from this SOP, because release timing is the user's call.
- You **MUST** print the new commit hash and the final phase status as the closing output of the SOP run.

## Examples

### Example 1: Foundation phase, auto mode

**Input:**

- `phase_id`: `ldf-j9pe`
- `mode`: `"auto"`
- `scope`: `"all"`

**Expected behavior:**

The agent marks `ldf-j9pe` in-progress, reads the eleven Foundation tasks, reads the constitution + ADR-001 + ADR-002, audits `src/` for current state, and produces eleven specs at `docs/specs/foundation-skeleton-runtime-theme_*.md`. After spec review the agent fans out via `task` to implement disjoint subsystems (`lib/result.ts`, `domain/schema.ts`, `actors/runtime.ts`, theme tokens) in parallel, sequencing the composition-root rewrite last because it depends on the others. `bun test` and `bun check` pass. Each task gets a `## Summary of Changes` section; the epic flips to `completed`; a single `jj` commit lands with the message `foundation-skeleton-runtime-theme: layered skeleton, runtime, theme`.

### Example 2: Track phase, interactive mode, partial scope

**Input:**

- `phase_id`: `ldf-vcv0`
- `mode`: `"interactive"`
- `scope`: `"ldf-2lwt,ldf-d1iw,ldf-gedy"`

**Expected behavior:**

The agent processes only the three named tasks (BackupRecord schema, backup repository, symlink repository). It pauses after Research with a written summary, again after spec review, and once more before validation. Specs land at `docs/specs/track-and-untrack-with-backups-f3-f4-f7_*.md`. The other tasks in `ldf-vcv0` remain `todo`; the epic stays `in-progress` with an `## Outstanding` section listing the unfinished tasks. Commit message: `track-and-untrack-with-backups-f3-f4-f7: backup + symlink repos`.

### Example 3: Phase blocked by upstream

**Input:**

- `phase_id`: `ldf-zf8l` (Repo & VCS)
- `mode`: `"auto"`

**Expected behavior:**

Step 1 detects that `ldf-hia6` (Config & Bootstrap) is not yet `completed`. The agent stops with a message: "ldf-zf8l is blocked by ldf-hia6 (status=in-progress). Run the build-phase SOP on ldf-hia6 first." No bean state changes; no specs are written.

## Troubleshooting

### A task's acceptance criteria are ambiguous

If a task body lacks a concrete acceptance criterion, You **MUST** halt the phase and either (a) ask the user for clarification, or (b) propose a concrete criterion derived from the PRD section the task cites and update the bean before continuing. You **MUST NOT** invent acceptance silently, because the QA epic later reads these criteria literally.

### Spec contradicts the PRD or an ADR

If a spec the agent is about to write would violate the constitution or an ADR, You **MUST** stop, raise the conflict to the user, and either rewrite the spec or land a new ADR that supersedes the relevant clause. The constitution wins by default; ADRs may amend it only via the explicit supersession process in `CONSTITUTION.md` §5.

### Tests fail at Step 6

If `bun test` fails, You **MUST** fix the production code, not delete the test, unless the test itself is provably wrong (in which case the bug is in the spec and Step 4's review missed it). Either way, You **MUST NOT** mark the task `completed` while a test is red.

### A new dependency is needed mid-phase

If a task requires a third-party library not in `package.json`, You **MUST** stop, surface the dependency proposal with rationale and alternatives (including in-tree implementations), and obtain user approval before adding it. Adding a dep without approval is **PROHIBITED** because it expands the project's supply-chain surface.

### Concurrent edit detected

If `read` shows a file changed since the agent last read it, You **MUST** re-read before editing, because acting on stale content risks clobbering another agent's work. If a `beans update` returns an etag conflict, You **MUST** re-fetch the bean, reconcile, and retry.

### Phase shipped but PRD acceptance criterion still red

If the phase's specs and tasks are all complete yet a PRD `A`-criterion does not hold end-to-end, the phase is **not** done. You **MUST** create a new task under the phase capturing the gap, reopen the epic to `in-progress`, and surface the situation to the user; declaring the phase `completed` would lie to the QA epic that consumes this state.
