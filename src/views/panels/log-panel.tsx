import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { type ReactNode, useState } from "react";
import type { UseLogPanel } from "../../controllers/log.controller";
import type { OperationKind, OperationView } from "../../domain/repo";
import { ConfirmModal } from "../components/confirm-modal";
import { useInputFocusEffect } from "../components/input-focus-context";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { summarizeServiceError } from "../components/summarize-error";
import { relativeAge } from "../lib/relative-age";
import { truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

export interface LogPanelProps {
  readonly model: UseLogPanel;
}

const BINDINGS: readonly PanelBinding[] = [
  { keys: "j/k", description: "move" },
  { keys: "enter", description: "diff" },
  { keys: "R", description: "rewind" },
  { keys: "B", description: "restore backup" },
  { keys: "PgUp/Dn", description: "scroll" },
];
const PAGE_LINES = 16;

function kindIcon(k: OperationKind): string {
  switch (k) {
    case "init":
      return "●";
    case "track":
      return "+";
    case "untrack":
      return "−";
    case "sync":
      return "↻";
    case "edit":
      return "~";
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Human label for an operation, used in confirm-modal copy. Falls back to the
 * kind + short hash when `jj` returned no description, so we never produce
 * empty parentheses like `Rewind to operation X ()?`.
 */
export function describeOp(op: OperationView): string {
  const desc = op.description.trim();
  const id = shortId(op.opId);
  if (desc.length > 0) return `“${desc}” (${op.kind} · ${id})`;
  return `${op.kind} · ${id} · ${relativeAge(op.at)}`;
}

type PendingRestore = { kind: "op" | "backup"; op: OperationView } | null;

export function LogPanel({ model }: LogPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("log");
  usePublishPanelBindings(BINDINGS);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [pending, setPending] = useState<PendingRestore>(null);
  useInputFocusEffect(pending !== null);

  const focused = model.operations.find((o) => o.opId === model.focusId);

  useKeyboard((event) => {
    if (pending !== null) return;
    switch (event.name) {
      case "j":
      case "down": {
        if (model.operations.length === 0) return;
        const idx = model.operations.findIndex((o) => o.opId === model.focusId);
        const next = model.operations[Math.min(idx + 1, model.operations.length - 1)];
        if (next !== undefined) model.focus(next.opId);
        return;
      }
      case "k":
      case "up": {
        if (model.operations.length === 0) return;
        const idx = model.operations.findIndex((o) => o.opId === model.focusId);
        const next = model.operations[Math.max(idx - 1, 0)];
        if (next !== undefined) model.focus(next.opId);
        return;
      }
      case "return":
        if (focused !== undefined) {
          setScrollOffset(0);
          model.loadDiff(focused.opId);
        }
        return;
      case "R":
        if (focused !== undefined) setPending({ kind: "op", op: focused });
        return;
      case "B":
        if (focused !== undefined) setPending({ kind: "backup", op: focused });
        return;
      case "pageup":
        setScrollOffset((o) => Math.max(0, o - PAGE_LINES));
        return;
      case "pagedown":
        setScrollOffset((o) => o + PAGE_LINES);
        return;
    }
  });

  if (model.status === "error" && model.error !== null) {
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
            Log unavailable
          </text>
          <text fg={t.fg.default}>{summarizeServiceError(model.error)}</text>
        </box>
      </box>
    );
  }

  const diffLines =
    model.diff !== null && model.diff.opId === model.focusId ? model.diff.text.split("\n") : [];
  const visibleDiff = diffLines.slice(scrollOffset, scrollOffset + 200);

  const SIDEBAR_DESC_MAX = 18;
  const DETAIL_LINE_MAX = 100;
  const focusedTitle =
    focused === undefined
      ? ""
      : focused.description.trim().length > 0
        ? focused.description
        : `(no description)`;

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} gap={t.space.sm} overflow="hidden">
        <box flexGrow={1} flexBasis={0} flexShrink={1} flexDirection="column" overflow="hidden">
          {model.operations.length === 0 && model.status === "ready" ? (
            <text fg={t.fg.dim}>No operations</text>
          ) : null}
          {model.operations.map((o) => {
            const isFocused = o.opId === model.focusId;
            const cursor = isFocused ? "›" : " ";
            const desc = truncateToWidth(
              o.description.trim().length > 0 ? o.description : `(${o.kind})`,
              SIDEBAR_DESC_MAX,
            );
            // Sidebar omits short hash — detail pane shows it.
            const line = `${cursor} ${kindIcon(o.kind)} ${desc} ${relativeAge(o.at)}`;
            return (
              <text key={o.opId} fg={isFocused ? t.fg.focus : t.fg.default}>
                {line}
              </text>
            );
          })}
        </box>
        <box flexGrow={2} flexBasis={0} flexDirection="column" overflow="hidden">
          {focused === undefined ? (
            <text fg={t.fg.dim}>(no selection)</text>
          ) : (
            <>
              <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
                {truncateToWidth(focusedTitle, DETAIL_LINE_MAX)}
              </text>
              <text fg={t.fg.dim}>
                {`${focused.kind} · ${shortId(focused.opId)} · ${relativeAge(focused.at)}`}
              </text>
              {focused.filesTouched.length > 0 ? (
                <text fg={t.fg.dim}>
                  {truncateToWidth(`files: ${focused.filesTouched.join(", ")}`, DETAIL_LINE_MAX)}
                </text>
              ) : (
                <text fg={t.fg.dim}>files: (none)</text>
              )}
              <box flexDirection="column" flexGrow={1} marginTop={t.space.sm} overflow="hidden">
                {model.diffLoading ? (
                  <text fg={t.fg.dim}>loading diff…</text>
                ) : visibleDiff.length === 0 ? (
                  <text fg={t.fg.dim}>(press enter for diff)</text>
                ) : (
                  visibleDiff.map((line, i) => (
                    <text key={`${scrollOffset + i}`} fg={t.fg.default}>
                      {truncateToWidth(line, DETAIL_LINE_MAX)}
                    </text>
                  ))
                )}
              </box>
            </>
          )}
        </box>
      </box>
      <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg={t.fg.dim}>
          {model.restoring !== null
            ? `restoring (${model.restoring.kind})…`
            : `${model.operations.length} operations`}
        </text>
      </box>
      {pending !== null
        ? (() => {
            const isOp = pending.kind === "op";
            const opLabel = describeOp(pending.op);
            return (
              <ConfirmModal
                title={isOp ? "Restore working copy" : "Restore from backup"}
                summary={
                  isOp
                    ? `Rewind to ${opLabel}? Symlinks will be re-materialized to match this point in history.`
                    : `Restore the most recent backup taken before ${opLabel}? The on-disk file is replaced with the snapshot's content.`
                }
                paths={pending.op.filesTouched}
                confirmLabel={isOp ? "Rewind" : "Restore"}
                onConfirm={() => {
                  if (pending.kind === "op") model.restoreToOp(pending.op.opId);
                  else model.restoreFromLatestBackup(pending.op.opId);
                  setPending(null);
                }}
                onCancel={() => setPending(null)}
              />
            );
          })()
        : null}
    </box>
  );
}
