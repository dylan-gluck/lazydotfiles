import { type BorderStyle, type ColorInput, RGBA } from "@opentui/core";

/**
 * Semantic theme tokens. Color values inherit from the user's terminal palette:
 * `RGBA.defaultForeground/Background` carry intent="default" (the terminal's
 * own fg/bg), and `RGBA.fromIndex(N)` carries intent="indexed" against ANSI
 * indices 0–15. The renderer translates both to whatever the user's terminal
 * actually shows, so the app re-skins itself when the user changes terminal
 * theme — no hex literals, no hard-coded brand color.
 *
 *   ANSI 0  black           ANSI 8  bright black (gray)
 *   ANSI 1  red             ANSI 9  bright red
 *   ANSI 2  green           ANSI 10 bright green
 *   ANSI 3  yellow          ANSI 11 bright yellow
 *   ANSI 4  blue            ANSI 12 bright blue
 *   ANSI 5  magenta         ANSI 13 bright magenta
 *   ANSI 6  cyan            ANSI 14 bright cyan
 *   ANSI 7  white           ANSI 15 bright white
 *
 * Naming reflects role, not appearance:
 *   - `heading`: titles, section labels — same hue as default; emphasis comes
 *                from the BOLD attribute applied at the call site
 *   - `focus`:   the active selection marker — used only on the focused row
 *   - `action`:  interactive verbs (modal confirm button, toast on success)
 *   - `muted`:   secondary copy (counts, hints) — formerly `dim`
 *   - `subtle`:  borders, quiet rails — same role as muted in the indexed palette
 *   - `success`: completed state ("accepted", "tracked OK")
 *   - `danger`:  error / destructive surface
 *
 * `dim` and `accent` remain as aliases for `muted` and `focus` to avoid a
 * sweeping rename across panels; new code should reach for the semantic name.
 */
export interface Tokens {
  readonly mode: "dark" | "light";
  readonly fg: {
    readonly default: ColorInput;
    readonly heading: ColorInput;
    readonly focus: ColorInput;
    readonly action: ColorInput;
    readonly muted: ColorInput;
    readonly subtle: ColorInput;
    readonly success: ColorInput;
    readonly danger: ColorInput;
    /** @deprecated alias of `muted` */
    readonly dim: ColorInput;
    /** @deprecated alias of `focus` */
    readonly accent: ColorInput;
  };
  readonly bg: {
    readonly default: ColorInput;
    readonly surface: ColorInput;
    readonly elevated: ColorInput;
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

const ansiFg = {
  default: RGBA.defaultForeground(),
  heading: RGBA.defaultForeground(),
  focus: RGBA.fromIndex(11),
  action: RGBA.fromIndex(14),
  muted: RGBA.fromIndex(8),
  subtle: RGBA.fromIndex(8),
  success: RGBA.fromIndex(10),
  danger: RGBA.fromIndex(1),
} as const;

const ansiFgWithAliases = {
  ...ansiFg,
  dim: ansiFg.muted,
  accent: ansiFg.focus,
} as const;

const sharedShape = {
  fg: ansiFgWithAliases,
  border: { default: "single", emphasis: "double" },
  space: { sm: 1, md: 2, lg: 4 },
} as const;

export const dark: Tokens = {
  ...sharedShape,
  mode: "dark",
  bg: {
    default: RGBA.defaultBackground(),
    surface: RGBA.fromIndex(0),
    elevated: RGBA.fromIndex(8),
  },
};

export const light: Tokens = {
  ...sharedShape,
  mode: "light",
  bg: {
    default: RGBA.defaultBackground(),
    surface: RGBA.fromIndex(7),
    elevated: RGBA.fromIndex(15),
  },
};
