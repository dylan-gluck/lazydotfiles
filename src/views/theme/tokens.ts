import type { BorderStyle } from "@opentui/core";

/**
 * Semantic theme tokens. Values are hand-picked hex codes whose perceptual
 * lightness/chroma curves mirror an OKLCH-driven palette (warm-tinted neutrals
 * with one signature amber for focus and a calm sage green for action).
 *
 * Naming reflects role, not appearance:
 *   - `heading`: titles, section labels — slightly brighter than default
 *   - `focus`:   the active selection marker — used only on the focused row
 *   - `action`:  interactive verbs (modal confirm button, toast on success)
 *   - `muted`:   secondary copy (counts, hints) — formerly `dim`
 *   - `subtle`:  between muted and elevated background — borders, quiet rails
 *   - `success`: completed state ("accepted", "tracked OK")
 *   - `danger`:  error / destructive surface
 *
 * `dim` and `accent` remain as aliases for `muted` and `focus` to avoid a
 * sweeping rename across panels; new code should reach for the semantic name.
 */
export interface Tokens {
  readonly mode: "dark" | "light";
  readonly fg: {
    readonly default: string;
    readonly heading: string;
    readonly focus: string;
    readonly action: string;
    readonly muted: string;
    readonly subtle: string;
    readonly success: string;
    readonly danger: string;
    /** @deprecated alias of `muted` */
    readonly dim: string;
    /** @deprecated alias of `focus` */
    readonly accent: string;
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
    readonly sm: 1;
    readonly md: 2;
    readonly lg: 4;
  };
}

const darkBase = {
  default: "#ebe6e0",
  heading: "#f5efe7",
  focus: "#e0a85c",
  action: "#a3c47e",
  muted: "#9b958e",
  subtle: "#5e5953",
  success: "#a3c47e",
  danger: "#d97a6c",
} as const;

export const dark: Tokens = {
  mode: "dark",
  fg: {
    ...darkBase,
    dim: darkBase.muted,
    accent: darkBase.focus,
  },
  bg: {
    default: "#1a1816",
    surface: "#262320",
    elevated: "#2f2b27",
  },
  border: { default: "single", emphasis: "double" },
  space: { sm: 1, md: 2, lg: 4 },
};

const lightBase = {
  default: "#2a2620",
  heading: "#1a1612",
  focus: "#9c5e1a",
  action: "#5b7a3f",
  muted: "#6b665e",
  subtle: "#a8a39a",
  success: "#5b7a3f",
  danger: "#a14d3c",
} as const;

export const light: Tokens = {
  mode: "light",
  fg: {
    ...lightBase,
    dim: lightBase.muted,
    accent: lightBase.focus,
  },
  bg: {
    default: "#f8f5f0",
    surface: "#efeae3",
    elevated: "#e6e0d6",
  },
  border: { default: "single", emphasis: "double" },
  space: { sm: 1, md: 2, lg: 4 },
};
