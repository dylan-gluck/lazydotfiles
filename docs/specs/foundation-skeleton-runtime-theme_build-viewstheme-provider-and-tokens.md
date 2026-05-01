# Spec: `views/theme/` provider and tokens

- Source bean: `ldf-wbss`
- Parent epic: `ldf-j9pe`
- References: ADR-002 §4.6, CONSTITUTION §2.3

## Goal

Provide a single `ThemeProvider`, a `useTheme` hook, and dark + light token sets. Every later component reads color/spacing/border tokens from this hook.

## Public surface

```ts
// src/views/theme/tokens.ts
import type { BorderStyle } from "@opentui/core";

export interface Tokens {
  readonly mode: "dark" | "light";
  readonly fg: {
    readonly default: string;
    readonly dim: string;
    readonly accent: string;
    readonly danger: string;
    readonly success: string;
  };
  readonly bg: { readonly default: string; readonly surface: string; readonly elevated: string };
  readonly border: { readonly default: BorderStyle; readonly emphasis: BorderStyle };
  readonly space: { readonly xs: 0; readonly sm: 1; readonly md: 2; readonly lg: 4 };
}

export const dark: Tokens;
export const light: Tokens;
```

```tsx
// src/views/theme/theme.tsx
import type { ReactNode } from "react";
import type { Tokens } from "./tokens";

export function ThemeProvider(props: { mode?: "dark" | "light"; children: ReactNode }): JSX.Element;
export function useTheme(): Tokens;
```

```ts
// src/views/theme/index.ts — barrel
export { ThemeProvider, useTheme } from "./theme";
export type { Tokens } from "./tokens";
```

Token values (this phase):

```ts
const dark: Tokens = {
  mode: "dark",
  fg: {
    default: "#e6e6e6",
    dim: "#888888",
    accent: "#7aa2f7",
    danger: "#f7768e",
    success: "#9ece6a",
  },
  bg: { default: "#1a1b26", surface: "#1f2335", elevated: "#24283b" },
  border: { default: "single", emphasis: "double" },
  space: { xs: 0, sm: 1, md: 2, lg: 4 },
};
const light: Tokens = {
  mode: "light",
  fg: {
    default: "#1a1b26",
    dim: "#5c6370",
    accent: "#1d4ed8",
    danger: "#b91c1c",
    success: "#15803d",
  },
  bg: { default: "#fafafa", surface: "#f1f1f4", elevated: "#e8e8ee" },
  border: { default: "single", emphasis: "double" },
  space: { xs: 0, sm: 1, md: 2, lg: 4 },
};
```

## Internal design

- `ThemeContext` is a `React.Context<Tokens>` with `dark` as the default value (so `useTheme` always returns a real object).
- `ThemeProvider` selects `dark` or `light` by `mode` prop (default `"dark"`).
- `useTheme` is `useContext(ThemeContext)`.
- Hex literals are confined to `tokens.ts`; consumers never see hex.

## Dependencies

- `react`, `@opentui/core` (`BorderStyle` type).

## Tests

- `tests/views/theme.test.tsx`:
  - `useTheme` outside `ThemeProvider` returns `dark` (default).
  - `ThemeProvider mode="light"` makes `useTheme` return `light`.
  - `ThemeProvider mode="dark"` returns `dark`.
- (Render tests use `@opentui/react` test rendering or simple React `act` with a host noop renderer — if non-trivial in the TUI sandbox, fall back to importing `useTheme` and asserting the returned object via a lightweight `renderHook` from `react`.)

## Acceptance

- Tokens file ships; provider wraps the tree at the composition root.
- No hex literal exists in any file under `src/` outside `views/theme/`.
- Tests pass.
