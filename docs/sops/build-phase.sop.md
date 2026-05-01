# Build Phase

## Overview

Orchestrates a full build-phase cycle for the `lazydotfiles` project: **Research -> Plan -> Implement -> Validate**. A "phase" is one epic in the beans issue tracker, containing a set of tasks that together deliver a coherent slice of the system. This SOP is invoked once per phase and drives it from inception to completion, producing tested, committed code that satisfies the epic's requirements.

Use this SOP when starting work on a new phase (epic) or resuming an incomplete one. The SOP handles task discovery, technical specification, parallel implementation, and verification against acceptance criteria before committing.

## Parameters

- **milestone_id** (optional): Beans milestone ID to scope phase selection (e.g. `ldf-euyx`). When omitted, the agent discovers the first in-progress or todo milestone automatically.
- **phase_id** (optional): Beans epic ID to work on (e.g. `ldf-j9pe`). When omitted, the agent selects the first unblocked, incomplete epic within the milestone by priority and dependency order.
- **dry_run** (optional, default: "false"): When `"true"`, execute Steps 1-2 (Research + Plan/SPECs) only. Do not implement or commit. Useful for reviewing specs before committing to implementation.

**Constraints for parameter acquisition:**
- If all required parameters are already provided, You MUST proceed to the Steps
- If any required parameters are missing, You MUST ask for them before proceeding
- When asking for parameters, You MUST request all parameters in a single prompt
- When asking for parameters, You MUST use the exact parameter names as defined
- Since all parameters are optional, You MUST always proceed to the Steps without asking unless explicitly blocked

## Steps

### 1. Research — Context Gathering and Requirements

Establish the full context for the phase: which epic, what tasks, what's already built, what the governing documents require.

#### 1.1 Identify the Phase

Locate the target milestone and epic from the beans tracker, then read the epic and all its child tasks.

**Constraints:**
- You MUST run `beans list --json --ready` to find actionable work
- If **milestone_id** is provided, You MUST run `beans show --json <milestone_id>` to scope the search
- If **phase_id** is provided, You MUST use that epic directly
- If neither is provided, You MUST select the first unblocked epic (not `in-progress`, `completed`, or `scrapped`) within the first active milestone, preferring higher priority and earlier dependency order
- If an epic is already `in-progress`, You MUST resume it rather than starting a new one
- You MUST run `beans show --json <phase_id>` to read the epic body, which contains scope, acceptance criteria, and PRD cross-references
- You MUST run `beans query` to fetch all child tasks of the epic with their `id`, `title`, `status`, `body`, and `blockedBy` relationships
- You MUST identify which tasks are already `completed` and which remain

#### 1.2 Read Governing Documentation

Load the project's architectural constraints and the requirements this phase must satisfy.

**Constraints:**
- You MUST read the following documents:
  - `docs/CONSTITUTION.md` — non-negotiable engineering rules
  - `docs/adrs/001_project.md` — layered architecture, directory layout, contract conventions
  - `docs/adrs/002_tui.md` — TUI runtime, actor protocol, theme, keymap, view isolation
  - `docs/prds/001_mvp.md` — feature requirements, domain model, acceptance criteria
- You MUST read any additional ADRs or PRDs referenced in the epic body
- You SHOULD read relevant skill documents (`skill://opentui`, `skill://Bun`) when the phase involves those domains
- You MUST NOT skip documentation reads because they appear familiar since the documents may have been updated since the last phase

#### 1.3 Explore Codebase State

Understand what exists today so specs and implementation build on reality, not assumptions.

**Constraints:**
- You MUST read the current directory structure of `src/` to understand which layers exist
- You MUST read `src/index.tsx` (composition root) to understand current wiring
- You MUST read any existing files in layers this phase will touch (e.g. if the phase adds a service, read `src/services/` contents and any existing service for patterns)
- You MUST run `jj log --limit 20` to understand recent changes and current branch state
- You MUST run `jj status` to check for uncommitted work
- If uncommitted work exists that is unrelated to this phase, You MUST NOT proceed until it is resolved because mixing unrelated changes in a commit obscures history
- You SHOULD run `bun test` to verify the codebase is green before starting since a red baseline makes it impossible to know if your changes broke something
- You MUST check for existing spec files at `docs/specs/` to avoid duplicating or contradicting prior specs
- You MUST check the previous phase's specs (if any) for contracts this phase depends on

#### 1.4 Build the Task Graph

Determine the dependency sequence and parallelization opportunities among the phase's tasks.

**Constraints:**
- You MUST examine each task's `blockedBy` relationships from beans
- You MUST identify intra-phase dependencies by analyzing which tasks produce types, interfaces, or implementations that other tasks consume (e.g. a domain schema task MUST precede the repository task that imports it)
- You MUST identify tasks that can execute in parallel (tasks touching disjoint files or layers with no import relationship)
- You MUST produce an ordered task list noting which tasks can be parallelized as groups
- You SHOULD visualize the dependency graph as a simple list:
  ```
  Group 1 (parallel): [task-a, task-b]  — domain schemas, no shared types
  Group 2 (parallel): [task-c, task-d]  — repositories, depend on Group 1
  Group 3 (sequential): [task-e]        — service wiring, depends on Group 2
  ```

### 2. Plan — Write Technical Specifications

Produce contract-first specs for each task before writing any implementation code. Specs are the design phase — they establish the interfaces, types, and contracts that implementation must satisfy.

#### 2.1 Write Spec Documents

For each incomplete task in the phase, write a specification document.

**Constraints:**
- You MUST save each spec to `docs/specs/<phase_slug>/<task_slug>.md` where `<phase_slug>` is a kebab-case short name for the epic (e.g. `foundation`, `config-bootstrap`) and `<task_slug>` is derived from the task title
- You MUST create the `docs/specs/<phase_slug>/` directory if it does not exist
- Each spec MUST include these sections:
  - **Task**: Bean ID and title
  - **Objective**: One sentence stating what this task delivers
  - **Dependencies**: Which tasks or existing modules this builds on, with file paths
  - **Contracts**: Exact TypeScript types, interfaces, or function signatures being introduced or modified. Include the full type definition, not a summary.
  - **Implementation Notes**: Key decisions, algorithm sketches, error handling strategy, which layer the code lives in per ADR-001
  - **File Manifest**: Every file to be created or modified, with its layer and purpose
  - **Test Plan**: What tests to write, what they assert, which test category (unit/integration/snapshot)
  - **Acceptance**: Observable criteria for this task being done (derived from the bean body and epic acceptance)
- You MUST write contracts (types, interfaces, signatures) as valid TypeScript in fenced code blocks so the implementing agent can copy them directly
- You MUST cross-reference types across specs within the same phase — if task A defines `Result<T,E>` and task B uses it, task B's spec MUST reference task A's spec and use the exact same type
- You MUST ensure specs respect the layer import rules from ADR-001 §4.1:
  - `domain/*` MUST NOT import from any other layer because domain is the innermost ring and has no outward dependencies
  - `repositories/*` MUST NOT import from services, actors, controllers, views, routes because repositories sit below services in the dependency graph
  - `services/*` MUST depend on `repositories/types.ts` interfaces only
  - `controllers/*` MUST NOT import repositories because controllers go through services or send actor messages
  - `views/*` MUST NOT import services, repositories, or actors because views receive props from controllers only
- You MUST NOT write implementation code in specs because specs define the contract (the what), and implementation details discovered during spec writing will drift from the actual code

#### 2.2 Review Specs for Consistency

After all specs are written, review them as a set.

**Constraints:**
- You MUST verify that every type referenced across specs has exactly one definition location
- You MUST verify that import paths in file manifests are consistent (no circular dependencies, no layer violations)
- You MUST verify that the union of all spec acceptance criteria covers the epic's acceptance criteria from the bean body
- You MUST verify that every file in any spec's file manifest lives in the correct layer directory per ADR-001
- If inconsistencies are found, You MUST fix the affected specs before proceeding
- You SHOULD verify spec contracts against the PRD domain model (PRD §6) to catch missing fields or wrong types
- If **dry_run** is `"true"`, You MUST stop here and report the specs produced with a summary of the task graph and any open questions

### 3. Implement — Build the Phase

Execute the task graph, delegating work to subagents where possible, sequencing where dependencies require it.

#### 3.1 Update Bean Status

Mark the phase as in-progress in the tracker.

**Constraints:**
- You MUST run `beans update --json <phase_id> -s in-progress` to mark the epic active
- You MUST mark each task `in-progress` as you begin it via `beans update --json <task_id> -s in-progress`

#### 3.2 Execute Task Groups

Implement tasks following the dependency graph from Step 1.4, parallelizing independent groups.

**Constraints:**
- You MUST implement tasks in dependency order — a task MUST NOT begin until all tasks it depends on are complete because downstream tasks build on the types and interfaces produced by upstream tasks
- You MUST parallelize independent tasks within a group using the `task` tool to delegate to subagents
- Each delegated task assignment MUST include:
  - The spec document path (e.g. `docs/specs/foundation/result-type.md`) for the agent to read
  - The governing document paths (`CONSTITUTION.md`, relevant ADRs)
  - The exact file manifest from the spec
  - The test plan from the spec
  - Explicit instructions to write tests before implementation (constitution §3.1: red -> green -> refactor)
  - The acceptance criteria from the spec
- You MUST NOT delegate tasks that modify the composition root (`src/index.tsx`) in parallel with other tasks that also modify it because concurrent edits to the same file will conflict
- You MUST NOT delegate more than 5 tasks in a single parallel batch because resource contention degrades quality
- After each group completes, You MUST verify the group's outputs before starting the next group:
  - Read key files to confirm they match the spec contracts
  - Run `bun test` to confirm no regressions
  - Run `bun check` to confirm type safety
- If a task fails or produces output that violates its spec, You MUST fix it before proceeding to dependent tasks because downstream tasks will build on a broken foundation
- You MUST mark each task as `completed` in beans only after its acceptance criteria are verified: `beans update --json <task_id> -s completed`
- If a task cannot be completed (blocked by external factor, missing API, etc.), You MUST update the bean with a note explaining the blocker and leave it as `in-progress`

#### 3.3 Wire the Composition Root

After all tasks in the phase are implemented, integrate them at the composition root if the phase introduced new services, actors, or providers.

**Constraints:**
- You MUST read `src/index.tsx` fresh before editing because other task agents may have modified it
- You MUST wire new concrete implementations to their interfaces following ADR-001 §4.6 (composition root is the only place where concretes meet interfaces)
- You MUST NOT introduce new module-level mutable state in `index.tsx` because all state lives in actors per constitution §1.1
- You SHOULD verify the wiring by reading the file after editing and tracing each dependency chain from renderer -> app -> providers -> services/actors

### 4. Validate and Clean Up

Verify the phase as a whole against its acceptance criteria, run full checks, update the tracker, and commit.

#### 4.1 Run the Full Test Suite

**Constraints:**
- You MUST run `bun test` and verify all tests pass
- You MUST run `bun check` (TypeScript type checking) and verify no errors
- You MUST run `bun run lint` and fix any lint violations
- You MUST run `bun run fmt` to format all files
- You MUST run `bun run fmt:check` after formatting to confirm consistency
- If any check fails, You MUST fix the issue and re-run all checks because a fix in one area can introduce regressions elsewhere
- You MUST NOT skip any check because "it was passing earlier" since integration between task outputs can surface new issues

#### 4.2 Review Against Requirements

Compare the implemented phase against its requirements.

**Constraints:**
- You MUST re-read the epic bean body and verify every acceptance criterion listed there
- You MUST re-read each task bean and verify its acceptance criteria
- You MUST check each CONSTITUTION §6 non-negotiable:
  1. No `process.exit()` — use `renderer.destroy()`
  2. No mutable shared state outside actors
  3. No domain logic in components
  4. No repository call outside services
  5. No untyped boundary — every parsed input has a schema
  6. No hand-rolled width/height for layout flow — use flexbox
  7. No untested service or reducer
  8. No `any` outside the carve-outs in §4
- For each criterion: if met, note it as satisfied. If not met, You MUST fix the violation before proceeding.
- You SHOULD search the codebase for common violations:
  - `process.exit` in `src/` (excluding `node_modules`)
  - `as any` or `: any` in `src/` (excluding `routeTree.gen.ts`)
  - Hex color literals (`#[0-9a-fA-F]{3,8}`) in `src/views/` outside `src/views/theme/`

#### 4.3 Update Beans

Update the tracker to reflect the phase outcome.

**Constraints:**
- For each task: if all acceptance criteria are met, You MUST mark it `completed` via `beans update --json <task_id> -s completed`
- For each task: if any acceptance criteria are not met, You MUST leave it `in-progress` and append a note to the bean body describing what remains: `beans update --json <task_id> --body-append "## Progress Notes\n\n- <description of what is done and what remains>"`
- For the epic: You MUST mark it `completed` via `beans update --json <phase_id> -s completed` ONLY if every child task is `completed`
- For the epic: if any child task is not `completed`, You MUST leave the epic as `in-progress` and append a summary: `beans update --json <phase_id> --body-append "## Phase Progress\n\n- Completed: <N>/<total> tasks\n- Remaining: <list of incomplete task titles and reasons>"`
- You MUST NOT mark a bean `completed` when requirements are unmet because this creates false progress that misleads future planning

#### 4.4 Commit Changes

Commit the phase's work to version control.

**Constraints:**
- You MUST run `jj status` to review all changed files
- You MUST verify that only files related to this phase are included since unrelated changes mixed into a commit make rollback and review harder
- You MUST describe the change with a meaningful message: `jj describe -m "phase: <epic-title> — <summary of what was delivered>"`
- You MUST include bean files in the commit by verifying `.beans/` changes are tracked
- You MUST include spec files in the commit (`docs/specs/<phase_slug>/`)
- You SHOULD run `jj log --limit 5` after committing to verify the change landed correctly
- If this is the final phase of the milestone, You SHOULD note that in the commit description

## Examples

### Example 1: Starting the Foundation Phase

**Input:**
- milestone_id: `ldf-euyx`
- phase_id: `ldf-j9pe`
- dry_run: `"false"`

**Expected Behavior:**

1. Agent reads epic `ldf-j9pe` and discovers 11 child tasks (skeleton, Result type, schema, errors, actor runtime, useActor hook, keymap, theme, app shell, composition root, test utils).
2. Agent reads CONSTITUTION, ADR-001, ADR-002, PRD-001.
3. Agent explores `src/` (finds only `index.tsx`, `routes/`, `routeTree.gen.ts`).
4. Agent builds task graph:
   ```
   Group 1 (parallel): [skeleton, Result type, DomainError, schema, test-utils]
   Group 2 (parallel): [actor runtime, theme, keymap] — depend on Group 1
   Group 3 (parallel): [useActor hook, app-shell] — depend on Group 2
   Group 4 (sequential): [composition root rewrite] — depends on all above
   ```
5. Agent writes 11 spec files to `docs/specs/foundation/`.
6. Agent reviews specs for consistency.
7. Agent implements Group 1 in parallel (5 subagents), verifies, then Group 2, etc.
8. Agent runs `bun test`, `bun check`, `bun run lint`, `bun run fmt`.
9. Agent updates all 11 task beans to `completed` and epic `ldf-j9pe` to `completed`.
10. Agent commits: `jj describe -m "phase: foundation — skeleton, runtime, theme, keymap, composition root"`.

### Example 2: Resuming an Incomplete Phase

**Input:**
- milestone_id: (omitted)
- phase_id: (omitted)

**Expected Behavior:**

1. Agent runs `beans list --json --ready`, finds milestone `ldf-euyx`.
2. Agent queries epics, finds `ldf-hia6` (Config & Bootstrap) is `in-progress` with 4/7 tasks completed.
3. Agent reads the epic body, finds a progress note from a prior run listing 3 remaining tasks.
4. Agent reads existing specs at `docs/specs/config-bootstrap/`, skips writing specs for completed tasks.
5. Agent writes specs only for the 3 remaining tasks.
6. Agent implements the 3 remaining tasks, respecting the dependency graph.
7. Agent validates, updates beans, commits.

### Example 3: Spec-only Dry Run

**Input:**
- phase_id: `ldf-zf8l`
- dry_run: `"true"`

**Expected Behavior:**

1. Agent reads epic `ldf-zf8l` (Repo & VCS adapter), all 7 child tasks.
2. Agent reads governing docs, explores codebase.
3. Agent writes 7 spec files to `docs/specs/repo-vcs/`.
4. Agent reviews specs, reports summary:
   ```
   Specs written: 7
   Task graph: 3 groups (schemas -> repos -> service+actor+tests)
   Open questions: none
   ```
5. Agent stops. No implementation, no beans update, no commit.

## Troubleshooting

### No Ready Beans Found
If `beans list --json --ready` returns no results:
- Check if all epics are blocked: `beans list --json` and inspect `blockedBy` fields
- A phase may need its predecessor completed first — look for the earliest blocked epic and trace its blockers
- If a predecessor phase is `in-progress`, resume that one instead

### Task Depends on Unfinished Work from Another Phase
If a task references types or modules that should exist from a prior phase but don't:
- Verify the prior phase's epic is marked `completed`
- If the prior phase is incomplete, stop and report: the current phase cannot proceed until its dependencies are satisfied
- You MUST NOT stub out missing dependencies with placeholder implementations because this creates technical debt that violates the contract-first principle

### Tests Fail After Parallel Implementation
If `bun test` fails after a parallel group completes:
- Read the full error output to identify which test(s) fail
- Check for conflicting edits to shared files (barrel exports, composition root)
- Re-read the affected files and fix merge conflicts or missing wiring
- Re-run tests after each fix

### Composition Root Conflicts
If multiple tasks modified `src/index.tsx`:
- This should not happen if the SOP was followed (Step 3.2 prohibits parallel edits to the same file)
- If it does happen, re-read the file, reconcile all changes, and re-run `bun check`

### jj Status Shows Unrelated Changes
If `jj status` shows files unrelated to the current phase:
- Do not commit mixed changes
- Use `jj split` to separate the phase's changes from unrelated ones
- Commit only the phase's changes
