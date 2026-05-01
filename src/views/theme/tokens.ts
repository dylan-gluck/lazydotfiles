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
  readonly bg: {
    readonly default: string;
    readonly surface: string;
    readonly elevated: string;
  };
  readonly border: {
    readonly default: BorderStyle;
    readonly emphasis: BorderStyle;
  };
  readonly space: {
    readonly xs: 0;
    readonly sm: 1;
    readonly md: 2;
    readonly lg: 4;
  };
}

export const dark: Tokens = {
  mode: "dark",
  fg: {
    default: "#e6e6e6",
    dim: "#888888",
    accent: "#7aa2f7",
    danger: "#f7768e",
    success: "#9ece6a",
  },
  bg: {
    default: "transparent",
    surface: "#1f2335",
    elevated: "#24283b",
  },
  border: { default: "single", emphasis: "double" },
  space: { xs: 0, sm: 1, md: 2, lg: 4 },
};

export const light: Tokens = {
  mode: "light",
  fg: {
    default: "#1a1b26",
    dim: "#5c6370",
    accent: "#1d4ed8",
    danger: "#b91c1c",
    success: "#15803d",
  },
  bg: {
    default: "#fafafa",
    surface: "#f1f1f4",
    elevated: "#e8e8ee",
  },
  border: { default: "single", emphasis: "double" },
  space: { xs: 0, sm: 1, md: 2, lg: 4 },
};
