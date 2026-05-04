import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useState } from "react";
import type { UseTrackedPanel } from "../../controllers/track.controller";
import type { TrackedFile } from "../../domain/tracked-file";
import { ConfirmModal } from "../components/confirm-modal";
import { useInputFocusEffect } from "../components/input-focus-context";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { summarizeServiceError } from "../components/summarize-error";
import { relativeAge } from "../lib/relative-age";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { basename } from "node:path";
import { useTheme } from "../theme";

export interface TrackedPanelProps {
  readonly model: UseTrackedPanel;
  /** Configured backup root (e.g. `$HOME/.dotfiles.bak`). */
  readonly backupRoot?: string;
  /** Home dir used to tildify display paths in the modal. */
  readonly home?: string;
  onViewLog?(target: string): void;
}

/**
 * Concrete destination preview for the untrack confirm modal. Combines the
 * configured backup root, the file's identifier prefix, and a literal
 * timestamp marker so the user sees a real, predictable path.
 */
function formatBackupDestination(
  backupRoot: string | undefined,
  home: string | undefined,
  trackedFileId: string,
): string {
  const root = backupRoot && backupRoot.length > 0 ? backupRoot : "<unset backup root>";
  const tild = home === undefined ? root : tildify(root, home);
  const idShort = trackedFileId.slice(0, 12);
  return `${tild}/${idShort}/<timestamp>-remove`;
}

const BINDINGS: readonly PanelBinding[] = [
  { keys: "j/k", description: "move" },
  { keys: "enter", description: "log" },
  { keys: "u", description: "untrack" },
  { keys: "b", description: "backups" },
];

export function TrackedPanel({ model, backupRoot, home, onViewLog }: TrackedPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("tracked");
  usePublishPanelBindings(BINDINGS);
  const [focusIdx, setFocusIdx] = useState(0);
  const [showBackups, setShowBackups] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<TrackedFile | null>(null);
  // Block global keymap (q quits, digit-nav) while the confirm modal is open.
  useInputFocusEffect(pendingRemove !== null);

  useEffect(() => {
    if (focusIdx >= model.tracked.length) setFocusIdx(0);
  }, [model.tracked.length, focusIdx]);

  const focused: TrackedFile | undefined = model.tracked[focusIdx];

  useKeyboard((event) => {
    if (pendingRemove !== null) return; // modal owns input
    if (model.error !== null) {
      // Any key dismisses the error overlay.
      model.clearError();
      return;
    }
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

  if (model.error !== null) {
    return (
      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
        <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
          Tracked panel error
        </text>
        <text fg={t.fg.default}>{summarizeServiceError(model.error)}</text>
        <text fg={t.fg.muted}>any key to dismiss</text>
      </box>
    );
  }

  if (model.tracked.length === 0) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text fg={t.fg.dim}>No tracked files. Press 2 to discover.</text>
      </box>
    );
  }

  const homeDir = home ?? "";
  const SIDEBAR_NAME_MAX = 18;
  const DETAIL_PATH_MAX = 80;

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} gap={t.space.sm} overflow="hidden">
        <box flexGrow={1} flexBasis={0} flexShrink={1} flexDirection="column" overflow="hidden">
          {model.tracked.map((tf, idx) => {
            const isFocused = idx === focusIdx;
            const count = model.backups.get(tf.id)?.length ?? 0;
            const cursor = isFocused ? "›" : " ";
            const name = truncateToWidth(basename(tf.target), SIDEBAR_NAME_MAX);
            // Sidebar shows only name + age + backup-count badge; kind goes to detail.
            const bk = count > 0 ? ` bk:${count}` : "";
            const line = `${cursor} ${name} ${relativeAge(tf.addedAt)}${bk}`;
            return (
              <text key={tf.id} fg={isFocused ? t.fg.focus : t.fg.default}>
                {line}
              </text>
            );
          })}
        </box>
        <box flexGrow={2} flexBasis={0} flexDirection="column" overflow="hidden">
          {focused === undefined ? (
            <text fg={t.fg.dim}>(no selection)</text>
          ) : showBackups ? (
            <>
              <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
                {truncateToWidth(
                  `Backups for ${tildify(focused.target, homeDir)}`,
                  DETAIL_PATH_MAX,
                )}
              </text>
              {(model.backups.get(focused.id) ?? []).map((b) => (
                <text key={b.id} fg={t.fg.dim}>
                  {truncateToWidth(
                    `${relativeAge(b.createdAt)} · ${b.trigger} · ${tildify(b.snapshotPath, homeDir)}`,
                    DETAIL_PATH_MAX,
                  )}
                </text>
              ))}
              {(model.backups.get(focused.id) ?? []).length === 0 ? (
                <text fg={t.fg.dim}>(no backups)</text>
              ) : null}
            </>
          ) : (
            <>
              <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
                {truncateToWidth(tildify(focused.target, homeDir), DETAIL_PATH_MAX)}
              </text>
              <text fg={t.fg.dim}>
                {truncateToWidth(`source: ${tildify(focused.source, homeDir)}`, DETAIL_PATH_MAX)}
              </text>
              <text fg={t.fg.dim}>kind: {focused.kind}</text>
              <text fg={t.fg.dim}>added: {relativeAge(focused.addedAt)}</text>
              <text fg={t.fg.dim}>status: {focused.status}</text>
            </>
          )}
        </box>
      </box>
      <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg={t.fg.dim}>
          {model.inFlight !== null
            ? `${model.inFlight.kind === "add" ? "tracking" : "untracking"}…`
            : `${model.tracked.length} tracked`}
        </text>
      </box>
      {pendingRemove !== null ? (
        <ConfirmModal
          title="Untrack file"
          summary={`Untrack ${pendingRemove.target}? The symlink is replaced with the file at its current dotfiles content; jj history is preserved.`}
          paths={[pendingRemove.target, pendingRemove.source]}
          backupDestination={formatBackupDestination(backupRoot, home, pendingRemove.id)}
          confirmLabel="Untrack"
          onConfirm={() => {
            model.remove(pendingRemove.target);
            setPendingRemove(null);
          }}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}
    </box>
  );
}
