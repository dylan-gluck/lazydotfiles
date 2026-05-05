import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import type { ServiceError } from "../../services/types";
import { useTheme } from "../theme";
import { summarizeServiceError } from "./summarize-error";

export interface PanelErrorProps {
  readonly title: string;
  readonly error: ServiceError;
  readonly footer?: ReactNode;
}

export function PanelError({ title, error, footer }: PanelErrorProps): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
      <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
        {title}
      </text>
      <text fg={t.fg.default}>{summarizeServiceError(error)}</text>
      {footer ?? null}
    </box>
  );
}
