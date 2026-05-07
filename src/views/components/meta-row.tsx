import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface MetaRowProps {
  readonly label: string;
  readonly value: string;
}

/** Aligned label/value row used in panel detail views. */
export function MetaRow({ label, value }: MetaRowProps): ReactNode {
  const t = useTheme();

  return (
    <box flexDirection="row" paddingX={2}>
      <text flexBasis={30} fg={t.fg.muted}>
        {label}
      </text>
      <text flexBasis={70} fg={t.fg.default}>
        {value}
      </text>
    </box>
  );
}
