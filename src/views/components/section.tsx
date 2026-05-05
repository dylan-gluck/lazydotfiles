import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface SectionProps {
  readonly children: ReactNode;
}

/**
 * Vertical container for a group of related rows. The bottom border serves
 * as the divider between adjacent sections (replaces the ad-hoc DimRule).
 */
export function Section({ children }: SectionProps): ReactNode {
  const t = useTheme();
  return (
    <box
      flexDirection="column"
      padding={1}
      border={["bottom"]}
      borderColor={t.fg.muted}
      flexGrow={1}
      flexShrink={0}
      overflow="hidden"
    >
      {children}
    </box>
  );
}
