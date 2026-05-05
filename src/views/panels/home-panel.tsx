import { useKeyboard } from "@opentui/react";
import { type ReactNode, useState } from "react";
import type { HomeQueueGroup, UseHomePanel } from "../../controllers/home.controller";
import type { Operation } from "../../domain/repo";
import type { TrackedFile } from "../../domain/tracked-file";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { Section } from "../components/section";
import { SectionRow } from "../components/section-row";
import { relativeAge } from "../lib/relative-age";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const BINDINGS: readonly PanelBinding[] = [
  { keys: "j/k", description: "move" },
  { keys: "enter", description: "open" },
  { keys: "2", description: "discover" },
  { keys: "3", description: "log" },
  { keys: "s", description: "sync" },
];

const TRACKED_PATH_MAX = 60;
const QUEUE_NAME_MAX = 50;
const OP_DESC_MAX = 60;

export interface HomePanelProps {
  readonly model: UseHomePanel;
  /** Open the log scoped to a tracked file's target path. */
  onViewLog?(target: string): void;
  /** Navigate to the discovery view (typically when enter on a queue group). */
  onOpenDiscover?(): void;
  /** Navigate to the sync view (the `s` binding). */
  onOpenSync?(): void;
}

type RowKind = "tracked" | "queue" | "op";

interface FocusableRow {
  readonly kind: RowKind;
  readonly id: string;
  readonly trackedTarget?: string;
}

export function HomePanel({
  model,
  onViewLog,
  onOpenDiscover,
  onOpenSync,
}: HomePanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("home");
  usePublishPanelBindings(BINDINGS);

  const focusable: readonly FocusableRow[] = [
    ...model.tracked.map<FocusableRow>((tf) => ({
      kind: "tracked",
      id: tf.id,
      trackedTarget: tf.target,
    })),
    ...model.queueGroups.map<FocusableRow>((g) => ({
      kind: "queue",
      id: `q:${g.segment}`,
    })),
    ...model.recentOperations.map<FocusableRow>((op) => ({
      kind: "op",
      id: `o:${op.id}`,
    })),
  ];
  const [focusIdx, setFocusIdx] = useState(0);

  useKeyboard((event) => {
    switch (event.name) {
      case "j":
      case "down":
        if (focusable.length > 0) {
          setFocusIdx((i) => Math.min(i + 1, focusable.length - 1));
        }
        return;
      case "k":
      case "up":
        if (focusable.length > 0) setFocusIdx((i) => Math.max(i - 1, 0));
        return;
      case "return": {
        const here = focusable[focusIdx];
        if (here === undefined) return;
        if (here.kind === "tracked" && here.trackedTarget !== undefined) {
          onViewLog?.(here.trackedTarget);
        } else if (here.kind === "queue") {
          onOpenDiscover?.();
        } else if (here.kind === "op") {
          onViewLog?.("");
        }
        return;
      }
      case "s":
        onOpenSync?.();
        return;
    }
  });

  const focused = focusable[focusIdx];
  const isFocused = (kind: RowKind, id: string): boolean =>
    focused !== undefined && focused.kind === kind && focused.id === id;

  return (
    <box flexDirection="column" flexGrow={1}>
      <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false}>
        <Section>
          <SectionRow
            margin={`${model.trackedCount} tracked`}
            body={<text fg={t.fg.heading}>tracked</text>}
          />
          {model.tracked.length === 0 ? (
            <SectionRow
              margin="—"
              body={<text fg={t.fg.muted}>nothing tracked yet · press 2 to discover</text>}
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
            margin={model.queueCount > 0 ? `${model.queueCount} pending` : "queue empty"}
            body={<text fg={t.fg.heading}>discovery</text>}
          />
          {model.queueGroups.length === 0 ? (
            <SectionRow
              margin="—"
              body={<text fg={t.fg.muted}>nothing pending · press r to rescan</text>}
            />
          ) : (
            model.queueGroups.map((g) => (
              <QueueGroupRow
                key={g.segment}
                group={g}
                focused={isFocused("queue", `q:${g.segment}`)}
              />
            ))
          )}
          {model.queueGroupCount > model.queueGroups.length ? (
            <SectionRow
              margin="…"
              body={
                <text fg={t.fg.muted}>
                  {`${model.queueGroupCount - model.queueGroups.length} more groups · press 2`}
                </text>
              }
            />
          ) : null}
        </Section>

        <Section>
          <SectionRow
            margin={model.dirty ? "1 dirty" : `↑${model.sync.ahead} ↓${model.sync.behind}`}
            body={<text fg={t.fg.heading}>sync</text>}
          />
          <SectionRow
            margin={model.sync.lastSyncAt === null ? "never" : relativeAge(model.sync.lastSyncAt)}
            body={<text fg={t.fg.muted}>{`· ${model.sync.remote ?? "(no remote)"}`}</text>}
          />
          <SectionRow
            margin={model.sync.autoInterval ?? "off"}
            body={
              <text fg={t.fg.muted}>
                {model.sync.autoInterval === null
                  ? "· auto-sync off"
                  : model.sync.nextAutoSyncIso === null
                    ? `· ${model.sync.autoInterval} · scheduled`
                    : `· ${model.sync.autoInterval} · next ${relativeAge(model.sync.nextAutoSyncIso)}`}
              </text>
            }
          />
        </Section>

        <Section>
          <SectionRow
            margin={
              model.totalOperations > 0
                ? `${model.recentOperations.length} of ${model.totalOperations}`
                : "0 ops"
            }
            body={<text fg={t.fg.heading}>recent</text>}
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
    </box>
  );
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
      body={
        <text fg={focused ? t.fg.focus : t.fg.muted}>
          {`? ${segment}${focused ? "  enter triage" : ""}`}
        </text>
      }
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
