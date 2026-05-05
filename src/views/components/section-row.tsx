import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface SectionRowProps {
  /** Draws the focus chevron in the cursor slot when true. */
  readonly focused?: boolean;
  /** Right-aligned gutter content (counts, ages, ids). Strings get muted text. */
  readonly margin?: ReactNode;
  /** Body content (label, name, description). Strings get default text. */
  readonly body?: ReactNode;
}

/**
 * Three-slot row used by every section line:
 *
 *   1. cursor glyph          — width=1
 *   2. right-aligned margin  — flexBasis=20
 *   3. body                  — takes remaining space, clips on overflow
 */
export function SectionRow({ focused, margin, body }: SectionRowProps): ReactNode {
  const t = useTheme();
  const cursorChar = focused === true ? "›" : " ";
  const cursorColor = focused === true ? t.fg.focus : t.fg.default;
  return (
    <box flexDirection="row" gap={2}>
      <box width={1}>
        <text fg={cursorColor}>{cursorChar}</text>
      </box>
      <box flexBasis={12} flexGrow={0} flexShrink={0} flexDirection="row" justifyContent="flex-end">
        {typeof margin === "string" ? <text fg={t.fg.muted}>{margin}</text> : margin}
      </box>
      <box flexGrow={1} flexShrink={1} flexDirection="row" overflow="hidden">
        {typeof body === "string" ? <text>{body}</text> : body}
      </box>
    </box>
  );
}
