# Spec: `views/components/app-shell.tsx`

- Source bean: `ldf-2cc0`
- Parent epic: `ldf-j9pe`
- References: ADR-002 §4.2, CONSTITUTION §2.2

## Goal

Provide the app shell: header, content `<Outlet />`, 1-row status bar. Pure flexbox layout; no domain knowledge.

## Public surface

```tsx
// src/views/components/app-shell.tsx
import type { ReactNode } from "react";

export interface AppShellProps {
  readonly title: string;
  readonly currentPath: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function AppShell(props: AppShellProps): JSX.Element;
```

## Internal design

- Outer `<box flexDirection="column" flexGrow={1}>`.
- Header: `<box flexDirection="row" justifyContent="space-between" paddingX={1} borderStyle={t.border.default} border={["bottom"]}>` showing `title` and `currentPath`.
- Content: `<box flexGrow={1} padding={t.space.sm}>{children}</box>` — children is the `<Outlet />` rendered by the route.
- Status bar: `<box height={1} flexDirection="row" justifyContent="space-between" paddingX={1}>` showing `hint ?? "[?] help · [q] quit"` on the right and `currentPath` on the left.
- Tokens via `useTheme()`. No color literals.
- `height={1}` is permitted only on the status bar (CONSTITUTION §2.2 fixed-affordance exception).

## Dependencies

- `views/theme` (`useTheme`).
- `@opentui/core` (`TextAttributes`).

## Tests

- `tests/views/app-shell.test.tsx`:
  - Renders without throwing given `title`, `currentPath`, `children`.
  - Default `hint` mentions `?` and `q`.
  - Custom `hint` overrides the default.
- Verified via `@opentui/react/test-utils` if available; otherwise a lightweight import-and-call test that asserts the returned element tree shape via React's test renderer (or a snapshot of `JSON.stringify`-able element props).

## Acceptance

- File exists; tests pass.
- No hex literal; no hand-rolled `width=` for layout flow.
