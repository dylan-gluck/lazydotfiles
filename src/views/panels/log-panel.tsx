import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { type ReactNode, useState } from "react";
import type { UseLogPanel } from "../../controllers/log.controller";
import type { OperationKind, OperationView } from "../../domain/repo";
import { ConfirmModal } from "../components/confirm-modal";
import { useInputFocusEffect } from "../components/input-focus-context";
import { summarizeServiceError } from "../components/summarize-error";
import { relativeAge } from "../lib/relative-age";
import { useTheme } from "../theme";

export interface LogPanelProps {
  readonly model: UseLogPanel;
}

const FOOTER_HINT = "[j/k] move · [enter] diff · [R] restore · [B] backup · [PgUp/PgDn] scroll";
const PAGE_LINES = 16;

function kindIcon(k: OperationKind): string {
  switch (k) {
    case "init":
      return "●";
    case "track":
      return "+";
    case "untrack":
      return "-";
    case "sync":
      return "↻";
    case "edit":
      return "·";
  }
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

type PendingRestore = { kind: "op" | "backup"; op: OperationView } | null;

export function LogPanel({ model }: LogPanelProps): ReactNode {
  const t = useTheme();
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

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} gap={t.space.sm}>
        <box flexBasis={42} flexShrink={0} flexDirection="column">
          {model.operations.length === 0 && model.status === "ready" ? (
            <text fg={t.fg.dim}>No operations</text>
          ) : null}
          {model.operations.map((o) => {
            const isFocused = o.opId === model.focusId;
            return (
              <box key={o.opId} flexDirection="row" gap={t.space.sm}>
                <text fg={isFocused ? t.fg.accent : t.fg.default}>
                  {isFocused ? "›" : " "} {kindIcon(o.kind)} {o.description}
                </text>
                <text fg={t.fg.dim}>{shortId(o.opId)}</text>
                <text fg={t.fg.dim}>{relativeAge(o.at)}</text>
              </box>
            );
          })}
        </box>
        <box flexGrow={1} flexDirection="column">
          {focused === undefined ? (
            <text fg={t.fg.dim}>(no selection)</text>
          ) : (
            <>
              <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
                {focused.description}
              </text>
              <text fg={t.fg.dim}>
                {focused.kind} · {shortId(focused.opId)} · {focused.at}
              </text>
              {focused.filesTouched.length > 0 ? (
                <text fg={t.fg.dim}>files: {focused.filesTouched.join(", ")}</text>
              ) : (
                <text fg={t.fg.dim}>files: (none)</text>
              )}
              <box flexDirection="column" flexGrow={1} marginTop={t.space.sm}>
                {model.diffLoading ? (
                  <text fg={t.fg.dim}>loading diff…</text>
                ) : visibleDiff.length === 0 ? (
                  <text fg={t.fg.dim}>(press enter for diff)</text>
                ) : (
                  visibleDiff.map((line, i) => (
                    <text key={`${scrollOffset + i}`} fg={t.fg.default}>
                      {line}
                    </text>
                  ))
                )}
              </box>
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
          {model.restoring !== null
            ? `restoring (${model.restoring.kind})…`
            : `${model.operations.length} operations`}
        </text>
        <text fg={t.fg.dim}>{FOOTER_HINT}</text>
      </box>
      {pending !== null
        ? (() => {
            const isOp = pending.kind === "op";
            return (
              <ConfirmModal
                title={isOp ? "Restore working copy" : "Restore from backup"}
                summary={
                  isOp
                    ? `Rewind to operation ${shortId(pending.op.opId)} (${pending.op.description})?`
                    : `Restore the most recent backup before ${shortId(pending.op.opId)}?`
                }
                paths={pending.op.filesTouched}
                confirmLabel="Restore"
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
