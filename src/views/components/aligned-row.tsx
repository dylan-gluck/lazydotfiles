import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface AlignedRowProps {
  /** Draws the focus chevron in the cursor slot when true. */
  readonly focused?: boolean;
  /** When true, the body renders in muted-fg. */
  readonly dim?: boolean;
  /** Body content (left cell, can truncate). Strings get default text. */
  readonly left: ReactNode;
  /** Right-aligned metadata (counts, ages). Strings get muted text. */
  readonly right?: ReactNode;
}

/**
 * Three-slot row used by tracked/untracked lists in `files` and revision rows
 * in `logs`:
 *
 *   1. cursor glyph          — width=1
 *   2. left body             — flexGrow=1, clips on overflow
 *   3. right metadata        — auto width, never truncated
 */
export function AlignedRow({ focused, dim, left, right }: AlignedRowProps): ReactNode {
  const t = useTheme();
  const cursorChar = focused === true ? "›" : " ";
  const cursorColor = focused === true ? t.fg.focus : t.fg.default;
  const bodyFg = focused === true ? t.fg.focus : dim === true ? t.fg.muted : t.fg.default;
  return (
    <box flexDirection="row" gap={1}>
      <box width={1}>
        <text fg={cursorColor}>{cursorChar}</text>
      </box>
      <box flexGrow={1} flexShrink={1} flexDirection="row" overflow="hidden">
        {typeof left === "string" ? <text fg={bodyFg}>{left}</text> : left}
      </box>
      {right === undefined ? null : (
        <box flexShrink={0} flexDirection="row">
          {typeof right === "string" ? <text fg={t.fg.muted}>{right}</text> : right}
        </box>
      )}
    </box>
  );
}
