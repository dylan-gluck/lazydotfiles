import { TextAttributes } from "@opentui/core";
import type { ServiceError } from "../../services/types";
import { useTheme } from "../theme";

function summarize(error: ServiceError): string[] {
  switch (error.tag) {
    case "NotFound":
      return [`${error.resource} not found: ${error.id}`];
    case "Validation":
      return error.issues.map((i) => `${(i.path ?? []).join(".") || "(root)"}: ${i.message}`);
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
    <box alignItems="center" flexGrow={1} justifyContent="center">
      <box
        backgroundColor={t.bg.surface}
        borderStyle={t.border.emphasis}
        flexDirection="column"
        gap={t.space.sm}
        padding={t.space.md}
      >
        <text attributes={TextAttributes.BOLD} fg={t.fg.danger}>
          Bootstrap failed
        </text>
        <text fg={t.fg.dim}>tag: {props.error.tag}</text>
        {lines.map((line, idx) => (
          <text fg={t.fg.default} key={idx}>
            {line}
          </text>
        ))}
        <text fg={t.fg.dim}>[q] quit</text>
      </box>
    </box>
  );
}
