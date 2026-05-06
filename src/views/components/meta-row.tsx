import type { ReactNode } from "react";
import { useTheme } from "../theme";

const META_LABEL_WIDTH = 10;

export interface MetaRowProps {
  readonly label: string;
  readonly value: string;
}

/** Aligned label/value row used in panel detail views. */
export function MetaRow({ label, value }: MetaRowProps): ReactNode {
  const t = useTheme();
  const padded =
    label.length >= META_LABEL_WIDTH ? label : label + " ".repeat(META_LABEL_WIDTH - label.length);
  return (
    <box flexDirection="row">
      <text fg={t.fg.muted}>{padded}</text>
      <text fg={t.fg.default}>{value}</text>
    </box>
  );
}
