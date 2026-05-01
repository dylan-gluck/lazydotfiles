import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useState } from "react";
import type { UseTrackedPanel } from "../../controllers/track.controller";
import type { TrackedFile } from "../../domain/tracked-file";
import { ConfirmModal } from "../components/confirm-modal";
import { summarizeServiceError } from "../components/summarize-error";
import { relativeAge } from "../lib/relative-age";
import { useTheme } from "../theme";

export interface TrackedPanelProps {
  readonly model: UseTrackedPanel;
  onViewLog?(target: string): void;
}

const FOOTER_HINT = "[j/k] move · [enter] log · [u] untrack · [b] toggle backups · [4] discover";

export function TrackedPanel({ model, onViewLog }: TrackedPanelProps): ReactNode {
  const t = useTheme();
  const [focusIdx, setFocusIdx] = useState(0);
  const [showBackups, setShowBackups] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<TrackedFile | null>(null);

  useEffect(() => {
    if (focusIdx >= model.tracked.length) setFocusIdx(0);
  }, [model.tracked.length, focusIdx]);

  const focused: TrackedFile | undefined = model.tracked[focusIdx];

  useKeyboard((event) => {
    if (pendingRemove !== null) return; // modal owns input
    switch (event.name) {
      case "j":
      case "down":
        if (model.tracked.length > 0) {
          setFocusIdx((i) => Math.min(i + 1, model.tracked.length - 1));
        }
        return;
      case "k":
      case "up":
        if (model.tracked.length > 0) setFocusIdx((i) => Math.max(i - 1, 0));
        return;
      case "u":
        if (focused !== undefined) setPendingRemove(focused);
        return;
      case "b":
        setShowBackups((s) => !s);
        return;
      case "return":
        if (focused !== undefined && onViewLog !== undefined) onViewLog(focused.target);
        return;
    }
  });

  if (pendingRemove !== null) {
    return (
      <ConfirmModal
        title="Untrack file"
        summary={`Untrack ${pendingRemove.target}?`}
        paths={[pendingRemove.target, pendingRemove.source]}
        backupDestination={`<backupRoot>/${pendingRemove.id}/...-remove`}
        onConfirm={() => {
          model.remove(pendingRemove.target);
          setPendingRemove(null);
        }}
        onCancel={() => setPendingRemove(null)}
      />
    );
  }

  if (model.error !== null) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <box
          backgroundColor={t.bg.surface}
          borderStyle={t.border.emphasis}
          flexDirection="column"
          padding={t.space.md}
          gap={t.space.sm}
        >
          <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
            Tracked panel error
          </text>
          <text fg={t.fg.default}>{summarizeServiceError(model.error)}</text>
          <text fg={t.fg.dim}>(any key) dismiss not yet wired</text>
        </box>
      </box>
    );
  }

  if (model.tracked.length === 0) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text fg={t.fg.dim}>No tracked files. Press 4 to discover.</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} gap={t.space.sm}>
        <box flexBasis={42} flexShrink={0} flexDirection="column">
          {model.tracked.map((tf, idx) => {
            const isFocused = idx === focusIdx;
            const count = model.backups.get(tf.id)?.length ?? 0;
            return (
              <box key={tf.id} flexDirection="row" gap={t.space.sm}>
                <text fg={isFocused ? t.fg.accent : t.fg.default}>
                  {isFocused ? "› " : "  "}
                  {tf.target}
                </text>
                <text fg={t.fg.dim}>{tf.kind}</text>
                <text fg={t.fg.dim}>{relativeAge(tf.addedAt)}</text>
                <text fg={t.fg.dim}>backups:{count}</text>
              </box>
            );
          })}
        </box>
        <box flexGrow={1} flexDirection="column">
          {focused === undefined ? (
            <text fg={t.fg.dim}>(no selection)</text>
          ) : showBackups ? (
            <>
              <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
                Backups for {focused.target}
              </text>
              {(model.backups.get(focused.id) ?? []).map((b) => (
                <text key={b.id} fg={t.fg.dim}>
                  {b.createdAt} · {b.trigger} · {b.snapshotPath}
                </text>
              ))}
              {(model.backups.get(focused.id) ?? []).length === 0 ? (
                <text fg={t.fg.dim}>(no backups)</text>
              ) : null}
            </>
          ) : (
            <>
              <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
                {focused.target}
              </text>
              <text fg={t.fg.dim}>source: {focused.source}</text>
              <text fg={t.fg.dim}>kind: {focused.kind}</text>
              <text fg={t.fg.dim}>added: {focused.addedAt}</text>
              <text fg={t.fg.dim}>status: {focused.status}</text>
            </>
          )}
        </box>
      </box>
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={t.fg.dim}>
          {model.inFlight !== null
            ? `${model.inFlight.kind === "add" ? "tracking" : "untracking"}…`
            : `${model.tracked.length} tracked`}
        </text>
        <text fg={t.fg.dim}>{FOOTER_HINT}</text>
      </box>
    </box>
  );
}
