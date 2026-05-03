import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface ConfirmModalProps {
  readonly title: string;
  readonly summary: string;
  readonly paths: readonly string[];
  readonly backupDestination?: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmModal(props: ConfirmModalProps): ReactNode {
  const t = useTheme();
  useKeyboard((event) => {
    switch (event.name) {
      case "return":
      case "y":
        props.onConfirm();
        return;
      case "escape":
      case "n":
        props.onCancel();
        return;
    }
  });
  const confirmLabel = props.confirmLabel ?? "Confirm";
  const cancelLabel = props.cancelLabel ?? "Cancel";
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
    >
      <box
        backgroundColor={t.bg.elevated}
        borderStyle={t.border.emphasis}
        flexDirection="column"
        padding={t.space.md}
        gap={t.space.sm}
      >
        <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
          {props.title}
        </text>
        <text fg={t.fg.default}>{props.summary}</text>
        {props.paths.map((p) => (
          <text key={p} fg={t.fg.dim}>
            • {p}
          </text>
        ))}
        {props.backupDestination !== undefined ? (
          <text fg={t.fg.dim}>backup → {props.backupDestination}</text>
        ) : null}
        <box flexDirection="row" gap={t.space.md} marginTop={t.space.sm}>
          <text fg={t.fg.success} attributes={TextAttributes.BOLD}>
            [{confirmLabel}]
          </text>
          <text fg={t.fg.dim}>[{cancelLabel}]</text>
        </box>
        <text fg={t.fg.dim}>enter/y confirm · esc/n cancel</text>
      </box>
    </box>
  );
}
