import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { UseLogPanel } from "../../controllers/log.controller";
import type { OperationView } from "../../domain/repo";
import { AlignedRow } from "../components/aligned-row";
import { CodeBlock, type CodeLine } from "../components/code-block";
import { ConfirmModal } from "../components/confirm-modal";
import { useInputFocusEffect } from "../components/input-focus-context";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { PanelError } from "../components/panel-error";
import { Section } from "../components/section";
import { SectionTitle } from "../components/section-title";
import { relativeAge } from "../lib/relative-age";
import { truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const REV_DESC_MAX = 28;
const META_VALUE_MAX = 56;
const DIFF_LINE_MAX = 96;
const DIFF_MAX_LINES = 400;

const BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "enter", description: "diff" },
  { keys: "R", description: "restore" },
  { keys: "B", description: "from backup" },
];

export interface LogsPanelProps {
  readonly model: UseLogPanel;
}

type PendingRestore = { kind: "op" | "backup"; op: OperationView } | null;

function classifyDiffLine(line: string): CodeLine["kind"] {
  if (line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "context";
}

function parseDiff(text: string): readonly CodeLine[] {
  return text
    .split("\n")
    .slice(0, DIFF_MAX_LINES)
    .map<CodeLine>((line) => ({
      text: truncateToWidth(line, DIFF_LINE_MAX),
      kind: classifyDiffLine(line),
    }));
}

function describeOpForConfirm(op: OperationView): string {
  const desc = op.description.trim();
  const id = op.opId.slice(0, 8);
  if (desc.length > 0) return `“${desc}” (${op.kind} · ${id})`;
  return `${op.kind} · ${id} · ${relativeAge(op.at)}`;
}

/**
 * View 3 — `logs`. Two equal columns:
 *
 *   - Left: revisions list (one section, full-height, scrolls).
 *   - Right: focused revision metadata + line-numbered diff.
 */
export function LogsPanel({ model }: LogsPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("logs");
  usePublishPanelBindings(BINDINGS);

  const [pending, setPending] = useState<PendingRestore>(null);
  useInputFocusEffect(pending !== null);

  const focused = useMemo(
    () => model.operations.find((o) => o.opId === model.focusId) ?? null,
    [model.operations, model.focusId],
  );

  // Auto-load diff for the focused op so the right pane never sits empty after
  // arrow-key navigation.
  useEffect(() => {
    if (focused === null) return;
    if (model.diff !== null && model.diff.opId === focused.opId) return;
    if (model.diffLoading) return;
    model.loadDiff(focused.opId);
    // model.loadDiff is recreated each render; tracking only the focused id
    // keeps this from looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused?.opId]);

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
        if (focused !== null) model.loadDiff(focused.opId);
        return;
      case "R":
        if (focused !== null) setPending({ kind: "op", op: focused });
        return;
      case "B":
        if (focused !== null) setPending({ kind: "backup", op: focused });
        return;
    }
  });

  if (model.status === "error" && model.error !== null) {
    return <PanelError title="Logs unavailable" error={model.error} />;
  }

  const diffLines: readonly CodeLine[] =
    model.diff !== null && focused !== null && model.diff.opId === focused.opId
      ? parseDiff(model.diff.text)
      : [];

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} flexShrink={1} overflow="hidden">
        <RevisionList
          operations={model.operations}
          focusId={model.focusId}
          status={model.status}
        />
        <box width={1} flexShrink={0} border={["right"]} borderColor={t.fg.muted} />
        <RevisionDetail
          focused={focused}
          diffLines={diffLines}
          diffLoading={model.diffLoading}
        />
      </box>
      {pending !== null
        ? (() => {
            const isOp = pending.kind === "op";
            const opLabel = describeOpForConfirm(pending.op);
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

function RevisionList({
  operations,
  focusId,
  status,
}: {
  readonly operations: readonly OperationView[];
  readonly focusId: string | null;
  readonly status: UseLogPanel["status"];
}): ReactNode {
  const t = useTheme();
  return (
    <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column" padding={1}>
      <SectionTitle
        label="revisions"
        meta={
          operations.length === 0 ? "0" : `${operations.length} · ${operations.length} total`
        }
      />
      <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false}>
        {operations.length === 0 && status === "ready" ? (
          <text fg={t.fg.muted}>(no operations)</text>
        ) : null}
        {operations.map((op) => {
          const isFocused = op.opId === focusId;
          const desc =
            op.description.trim().length > 0 ? op.description : `(${op.kind})`;
          const truncated = truncateToWidth(desc, REV_DESC_MAX);
          const left = `${op.opId.slice(0, 8)}  ${truncated}`;
          return (
            <AlignedRow
              key={op.opId}
              focused={isFocused}
              dim={!isFocused}
              left={left}
              right={relativeAge(op.at)}
            />
          );
        })}
      </scrollbox>
    </box>
  );
}

function RevisionDetail({
  focused,
  diffLines,
  diffLoading,
}: {
  readonly focused: OperationView | null;
  readonly diffLines: readonly CodeLine[];
  readonly diffLoading: boolean;
}): ReactNode {
  const t = useTheme();
  if (focused === null) {
    return (
      <box flexBasis={0} flexGrow={1} flexShrink={1} padding={1}>
        <text fg={t.fg.muted}>(no selection)</text>
      </box>
    );
  }
  const title =
    focused.description.trim().length > 0 ? focused.description : `(${focused.kind})`;
  const filesLabel =
    focused.filesTouched.length === 0
      ? "(none)"
      : `${focused.filesTouched.length} changed`;
  const firstFile = focused.filesTouched[0] ?? null;
  return (
    <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
      <Section>
        <SectionTitle
          label={truncateToWidth(title, 56)}
          meta={`${focused.kind} · ${relativeAge(focused.at)}`}
        />
        <MetaRow label="hash" value={focused.opId} />
        <MetaRow
          label="parent"
          value={focused.parentOpId === null ? "(none)" : focused.parentOpId.slice(0, 8)}
        />
        <MetaRow label="kind" value={focused.kind} />
        <MetaRow label="at" value={focused.at} />
        <MetaRow label="files" value={filesLabel} />
        {firstFile !== null ? (
          <MetaRow label="touched" value={truncateToWidth(firstFile, META_VALUE_MAX)} />
        ) : null}
      </Section>
      <Section>
        <SectionTitle
          label="diff"
          meta={firstFile === null ? undefined : truncateToWidth(firstFile, 60)}
        />
        {diffLoading ? (
          <text fg={t.fg.muted}>loading diff…</text>
        ) : diffLines.length === 0 ? (
          <text fg={t.fg.muted}>(no diff)</text>
        ) : (
          <CodeBlock lines={diffLines} />
        )}
      </Section>
    </scrollbox>
  );
}

const META_LABEL_WIDTH = 10;

function MetaRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): ReactNode {
  const t = useTheme();
  const padded =
    label.length >= META_LABEL_WIDTH ? label : label + " ".repeat(META_LABEL_WIDTH - label.length);
  return (
    <box flexDirection="row">
      <text fg={t.fg.muted}>{padded}</text>
      <text fg={t.fg.default}>{value}</text>
    </box>
  );
}
