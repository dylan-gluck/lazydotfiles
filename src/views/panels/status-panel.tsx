import { useKeyboard } from "@opentui/react";
import { type ReactNode, useMemo, useState } from "react";
import type { HomeQueueGroup, UseHomePanel } from "../../controllers/home.controller";
import type { Operation } from "../../domain/repo";
import type { TrackedFile } from "../../domain/tracked-file";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelExtras,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { Section } from "../components/section";
import { SectionRow } from "../components/section-row";
import { useTrackingConfirms } from "../components/tracking-confirms";
import { relativeAge } from "../lib/relative-age";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const TRACKED_PATH_MAX = 60;
const QUEUE_NAME_MAX = 50;
const OP_DESC_MAX = 60;
const REMOTE_LABEL_MAX = 60;

export interface StatusPanelProps {
  readonly model: UseHomePanel;
  /** Open the logs view. Optional id focuses a specific op. */
  onViewLog?(opId?: string): void;
  /** Switch to the files view (typically when enter on an untracked group). */
  onOpenFiles?(): void;
  /** Untrack a single tracked file. */
  onUntrack?(target: string): void;
  /** Track every pending candidate in this top-level segment. */
  onTrackGroup?(segment: string): void;
  /** Defer every pending candidate in this top-level segment. */
  onIgnoreGroup?(segment: string): void;
}

type RowKind = "tracked" | "untracked" | "op";

interface FocusableRow {
  readonly kind: RowKind;
  readonly id: string;
  readonly trackedTarget?: string;
  readonly trackedFile?: TrackedFile;
  readonly groupSegment?: string;
  readonly opId?: string;
}

const TRACKED_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "enter", description: "details" },
  { keys: "u", description: "untrack" },
  { keys: "s", description: "sync" },
];
const UNTRACKED_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "enter", description: "details" },
  { keys: "t", description: "track" },
  { keys: "i", description: "ignore" },
  { keys: "s", description: "sync" },
];
const OP_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "enter", description: "details" },
  { keys: "f", description: "fetch" },
  { keys: "p", description: "push" },
  { keys: "s", description: "sync" },
];
const DEFAULT_BINDINGS: readonly PanelBinding[] = TRACKED_BINDINGS;

const TRACKED_EXTRAS: readonly PanelBinding[] = [{ keys: "shift+U", description: "untrack group" }];
const UNTRACKED_EXTRAS: readonly PanelBinding[] = [
  { keys: "shift+T", description: "track group" },
  { keys: "shift+I", description: "ignore group" },
];
const NO_EXTRAS: readonly PanelBinding[] = [];

/**
 * View 1 — `status`. Margin-note manuscript layout. One scrollable column with
 * four sections: `tracked`, `untracked`, `remote`, `logs`.
 */
export function StatusPanel({
  model,
  onViewLog,
  onOpenFiles,
  onUntrack,
  onTrackGroup,
  onIgnoreGroup,
}: StatusPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("status");

  const focusable: readonly FocusableRow[] = useMemo(
    () => [
      ...model.tracked.map<FocusableRow>((tf) => ({
        kind: "tracked",
        id: tf.id,
        trackedTarget: tf.target,
        trackedFile: tf,
      })),
      ...model.queueGroups.map<FocusableRow>((g) => ({
        kind: "untracked",
        id: `q:${g.segment}`,
        groupSegment: g.segment,
      })),
      ...model.recentOperations.map<FocusableRow>((op) => ({
        kind: "op",
        id: `o:${op.id}`,
        opId: op.id,
      })),
    ],
    [model.tracked, model.queueGroups, model.recentOperations],
  );
  const [focusIdx, setFocusIdx] = useState(0);
  const confirms = useTrackingConfirms({
    onUntrack: (file) => onUntrack?.(file.target),
    onTrackGroup,
    onIgnoreGroup,
  });

  const focused = focusable[focusIdx];
  const focusedKind: RowKind | null = focused?.kind ?? null;
  const [bindings, extras] = useMemo<
    readonly [readonly PanelBinding[], readonly PanelBinding[]]
  >(() => {
    switch (focusedKind) {
      case "tracked":
        return [TRACKED_BINDINGS, TRACKED_EXTRAS];
      case "untracked":
        return [UNTRACKED_BINDINGS, UNTRACKED_EXTRAS];
      case "op":
        return [OP_BINDINGS, NO_EXTRAS];
      default:
        return [DEFAULT_BINDINGS, NO_EXTRAS];
    }
  }, [focusedKind]);
  usePublishPanelBindings(bindings);
  usePublishPanelExtras(extras);

  useKeyboard((event) => {
    if (confirms.active) return;
    if (event.name === "j" || event.name === "down") {
      if (focusable.length > 0) setFocusIdx((i) => Math.min(i + 1, focusable.length - 1));
      return;
    }
    if (event.name === "k" || event.name === "up") {
      if (focusable.length > 0) setFocusIdx((i) => Math.max(i - 1, 0));
      return;
    }
    const here = focusable[focusIdx];
    if (here === undefined) return;
    switch (event.name) {
      case "return":
        if (here.kind === "tracked") onViewLog?.();
        else if (here.kind === "untracked") onOpenFiles?.();
        else if (here.kind === "op" && here.opId !== undefined) onViewLog?.(here.opId);
        return;
      case "u":
        if (here.kind === "tracked" && here.trackedFile !== undefined) {
          confirms.promptUntrack(here.trackedFile);
        }
        return;
      case "t":
        if (here.kind === "untracked" && here.groupSegment !== undefined) {
          confirms.promptTrackGroup(here.groupSegment);
        }
        return;
      case "i":
        if (here.kind === "untracked" && here.groupSegment !== undefined) {
          confirms.promptIgnoreGroup(here.groupSegment);
        }
        return;
    }
  });

  const isFocused = (kind: RowKind, id: string): boolean =>
    focused !== undefined && focused.kind === kind && focused.id === id;

  const aheadBehind = `↑${model.sync.ahead} ↓${model.sync.behind}`;
  const remoteLabel = truncateToWidth(model.sync.remote ?? "(no remote)", REMOTE_LABEL_MAX);
  const lastSyncLabel =
    model.sync.lastSyncAt === null ? "never" : relativeAge(model.sync.lastSyncAt);
  const autoLabel =
    model.sync.autoInterval === null
      ? "· auto-sync off"
      : model.sync.nextAutoSyncIso === null
        ? `· ${model.sync.autoInterval} · scheduled`
        : `· ${model.sync.autoInterval} · next ${relativeAge(model.sync.nextAutoSyncIso)}`;
  const autoMargin = model.sync.autoInterval ?? "off";

  return (
    <box flexDirection="column" flexGrow={1}>
      <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false}>
        <Section>
          <SectionRow
            margin={`${model.trackedCount} tracked`}
            body={<HeadingText text="tracked" />}
          />
          {model.tracked.length === 0 ? (
            <SectionRow
              margin="—"
              body={<text fg={t.fg.muted}>nothing tracked yet · press 2 to track files</text>}
            />
          ) : (
            model.tracked.map((tf) => (
              <TrackedRow
                key={tf.id}
                tracked={tf}
                home={model.home}
                focused={isFocused("tracked", tf.id)}
              />
            ))
          )}
          {model.trackedCount > model.tracked.length ? (
            <SectionRow
              margin="…"
              body={
                <text fg={t.fg.muted}>{`${model.trackedCount - model.tracked.length} more`}</text>
              }
            />
          ) : null}
        </Section>

        <Section>
          <SectionRow
            margin={model.queueCount > 0 ? `${model.queueCount} pending` : "0 pending"}
            body={<HeadingText text="untracked" />}
          />
          {model.queueGroups.length === 0 ? (
            <SectionRow
              margin="—"
              body={
                <box flexDirection="column">
                  <text fg={t.fg.default}>nothing pending</text>
                  <text fg={t.fg.muted}>press r to rescan</text>
                </box>
              }
            />
          ) : (
            model.queueGroups.map((g) => (
              <QueueGroupRow
                key={g.segment}
                group={g}
                focused={isFocused("untracked", `q:${g.segment}`)}
              />
            ))
          )}
          {model.queueGroupCount > model.queueGroups.length ? (
            <SectionRow
              margin="…"
              body={
                <text fg={t.fg.muted}>
                  {`${model.queueGroupCount - model.queueGroups.length} more groups · enter to open`}
                </text>
              }
            />
          ) : null}
        </Section>

        <Section>
          <SectionRow margin={aheadBehind} body={<HeadingText text="remote" />} />
          <SectionRow
            margin={lastSyncLabel}
            body={<text fg={t.fg.muted}>{`· ${remoteLabel}`}</text>}
          />
          <SectionRow margin={autoMargin} body={<text fg={t.fg.muted}>{autoLabel}</text>} />
        </Section>

        <Section>
          <SectionRow
            margin={
              model.totalOperations > 0
                ? `${model.recentOperations.length} of ${model.totalOperations}`
                : "0 ops"
            }
            body={<HeadingText text="logs" />}
          />
          {model.recentOperations.length === 0 ? (
            <SectionRow margin="—" body={<text fg={t.fg.muted}>no operations yet</text>} />
          ) : (
            model.recentOperations.map((op) => (
              <OperationRow key={op.id} op={op} focused={isFocused("op", `o:${op.id}`)} />
            ))
          )}
        </Section>
      </scrollbox>

      {model.toast !== null ? (
        <box flexShrink={0} flexDirection="row" paddingLeft={1} paddingRight={1}>
          <text fg={model.toast.tone === "danger" ? t.fg.danger : t.fg.muted}>
            {model.toast.message}
          </text>
        </box>
      ) : null}

      {confirms.modal}
    </box>
  );
}

function HeadingText({ text }: { readonly text: string }): ReactNode {
  const t = useTheme();
  return <text fg={t.fg.heading}>{text}</text>;
}

function TrackedRow({
  tracked,
  home,
  focused,
}: {
  readonly tracked: TrackedFile;
  readonly home: string;
  readonly focused: boolean;
}): ReactNode {
  const t = useTheme();
  const display = truncateToWidth(tildify(tracked.target, home), TRACKED_PATH_MAX);
  return (
    <SectionRow
      focused={focused}
      margin={relativeAge(tracked.addedAt)}
      body={<text fg={focused ? t.fg.focus : t.fg.default}>{`+ ${display}`}</text>}
    />
  );
}

function QueueGroupRow({
  group,
  focused,
}: {
  readonly group: HomeQueueGroup;
  readonly focused: boolean;
}): ReactNode {
  const t = useTheme();
  const segment = truncateToWidth(group.segment, QUEUE_NAME_MAX);
  return (
    <SectionRow
      focused={focused}
      margin={String(group.count)}
      body={<text fg={focused ? t.fg.focus : t.fg.muted}>{`? ${segment}`}</text>}
    />
  );
}

function OperationRow({
  op,
  focused,
}: {
  readonly op: Operation;
  readonly focused: boolean;
}): ReactNode {
  const t = useTheme();
  const desc = op.description.trim().length > 0 ? op.description : `(${op.kind})`;
  const truncated = truncateToWidth(desc, OP_DESC_MAX);
  return (
    <SectionRow
      focused={focused}
      margin={relativeAge(op.at)}
      body={
        <text fg={focused ? t.fg.focus : t.fg.muted}>{`${op.id.slice(0, 7)}  ${truncated}`}</text>
      }
    />
  );
}
