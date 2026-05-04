import { TextAttributes } from "@opentui/core";
import type { ServiceError } from "../../services/types";
import { useTheme } from "../theme";

function summarize(error: ServiceError): string[] {
  switch (error.tag) {
    case "NotFound":
      return [`${error.resource} not found: ${error.id}`];
    case "Validation":
      return error.issues.map((i) => `${(i.path ?? []).join(".") || "(root)"}: ${i.message}`);
    case "InvalidTarget":
      return [`invalid target (${error.reason}): ${error.path}`];
    case "Rollback":
      return [`rolled back at step "${error.failedStep}"`, ...summarize(error.original)];
    case "Repository": {
      const c = error.cause;
      switch (c.tag) {
        case "NotFound":
          return [`missing path: ${c.path}`];
        case "ParseError":
          return [
            `parse error at ${c.path}`,
            ...c.issues.map((i) => `  ${(i.path ?? []).join(".") || "(root)"}: ${i.message}`),
          ];
        case "IoError": {
          const cause = c.cause instanceof Error ? c.cause.message : String(c.cause);
          return [`I/O error at ${c.path}: ${cause}`];
        }
        case "Spawn":
          return [
            `command failed (exit ${c.exitCode}): ${c.command.join(" ")}`,
            ...(c.stderr.length > 0 ? [c.stderr] : []),
          ];
      }
    }
  }
}

export function BootstrapErrorPanel(props: { error: ServiceError }) {
  const t = useTheme();
  const lines = summarize(props.error);
  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
      <text attributes={TextAttributes.BOLD} fg={t.fg.danger}>
        Bootstrap failed
      </text>
      <text fg={t.fg.muted}>tag: {props.error.tag}</text>
      {lines.map((line, idx) => (
        <text fg={t.fg.default} key={idx}>
          {line}
        </text>
      ))}
      <box flexDirection="row" marginTop={t.space.sm}>
        <text fg={t.fg.focus}>q</text>
        <text fg={t.fg.muted}> quit</text>
      </box>
    </box>
  );
}
