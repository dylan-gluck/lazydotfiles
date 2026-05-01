# Spec: DiscoveryPanel view

- Bean: `ldf-bisk`
- Parent: `ldf-auiv` (Discovery F2)
- PRD: §8.2.
- ADR: 002 §4.6 (stateless, theme-driven, flexbox-only).

## Goal

Stateless component rendering the discovery triage UI: sidebar list grouped by parent dir, main detail pane, footer keymap hint, empty state. Receives all data + actions as props (from `useDiscoveryPanel`).

## Public surface

```ts
// src/views/panels/discovery-panel.tsx
import type { UseDiscoveryPanel } from "../../controllers/discovery.controller";

export interface DiscoveryPanelProps {
  readonly model: UseDiscoveryPanel;
}

export function DiscoveryPanel(props: DiscoveryPanelProps): ReactNode;
```

## Internal design

- Layout: outer `<box flexDirection="column" flexGrow={1}>`.
  - **Body** `<box flexDirection="row" flexGrow={1} gap={t.space.sm}>`
    - **Sidebar** `<box flexBasis={40} flexShrink={0} flexDirection="column">` listing candidates grouped by `dirname(path)`. Each row: `<text>` with `Reason` badge (`[inc]`/`[sib]`/`[auto]`) + path basename, color from theme by status (pending=default, accepted=success, rejected=danger, deferred=dim).
    - **Detail** `<box flexGrow={1} flexDirection="column">` showing focused candidate's absolute path, kind, sibling count. (File preview deferred to a future panel; current MVP shows metadata only — file content read is future-phase work.)
  - **Footer** `<box height={1} flexDirection="row" justifyContent="space-between">` with hint text from theme: `a accept · r rescan · d defer · o open · space expand siblings`.
- **Empty state**: when `model.queue.length === 0 && model.status !== "scanning"`, replace body with `<box flexGrow={1} justifyContent="center" alignItems="center"><text fg={t.fg.dim}>No candidates. Press r to rescan.</text></box>`.
- **Scanning state**: when `model.status === "scanning"`, render footer hint with a spinner-style char (`⠋ scanning…`) using `t.fg.accent`. Static character only (no animation in this phase).
- **Error state**: `model.status === "error"`: render error panel using same theme tokens as `BootstrapErrorPanel`.
- **Local state**: focused-row index `useState<number>(0)`. Reset to 0 when `queue.length` changes from 0 → non-zero.
- **Keyboard**: NOT installed here. The panel is purely visual; key dispatch is handled by `GlobalKeys` + a panel-scoped `useKeyboard` only when this route is active. Per ADR-002 §4.5 the global keymap covers `r`, and panel-scoped `a/d/o/space` install in a future controller iteration. For MVP discovery, we install a `useKeyboard` inside `DiscoveryPanel` that fires only when the panel is mounted, calling `model.accept(id)`, `model.reject(id)`, `model.defer(id)`, `model.expand(path)` against the currently-focused candidate. This is allowed under §4.5 because mount-scoped consumption is bounded.
- **Theme**: every color/border/spacing comes from `useTheme()`. Zero hex literals in the file.
- **Layout**: zero `width`/`height` numeric values for layout flow; `height={1}` on the footer is the §4.6 carve-out.

## Dependencies

- `src/views/theme/index.ts` (`useTheme`)
- `src/controllers/discovery.controller.ts`
- `node:path` (`dirname`, `basename`) for grouping/labels

## Tests

Covered by the snapshot test in `ldf-6jbc`.

## Acceptance

- Renders without throwing for empty queue, scanning, ready (with candidates), and error states.
- No hex literals; no width/height for layout flow (only `height={1}` footer).
- Sidebar groups candidates by parent directory with stable ordering (alphabetical).

## Review

Reviewed against §6 non-negotiables: no process.exit, no hex, no hand-rolled width/height for layout flow. Approved.
