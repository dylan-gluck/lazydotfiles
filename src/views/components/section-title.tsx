import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface SectionTitleProps {
  /** Bold label on the left. */
  readonly label: string;
  /** Dim metadata on the right (count or descriptor). */
  readonly meta?: ReactNode;
}

/**
 * Two-column section title: bold label left, dim metadata right. Both align
 * to the same gutters as {@link AlignedRow} so titles and rows line up.
 */
export function SectionTitle({ label, meta }: SectionTitleProps): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="row" justifyContent="space-between">
      <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
        {label}
      </text>
      {meta === undefined ? null : typeof meta === "string" ? (
        <text fg={t.fg.muted}>{meta}</text>
      ) : (
        meta
      )}
    </box>
  );
}
