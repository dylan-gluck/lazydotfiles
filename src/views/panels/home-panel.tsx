import { type ColorInput } from "@opentui/core";
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

/**
 * Width of the dim-fg margin gutter that fronts every line on the home page.
 * Holds the typographic counts/timestamps/ids that frame each row, the way
 * a typeset book runs page numbers in the gutter.
 *
 * Implemented as `padStart` on a string — not a flex column — because the
 * margin and the body are rendered as siblings in a single row box. A
 * width prop would violate CONSTITUTION §2.2 (no hand-rolled width for
 * layout flow) without belonging to the design-language exception.
 */
const MARGIN_WIDTH = 14;
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

  const headerSummary = model.queueCount > 0 ? `${model.queueCount} candidates` : "queue empty";

  return (
    <box flexDirection="column" flexGrow={1}>
      <Header model={model} summary={headerSummary} />

      <box flexDirection="column" flexGrow={1} flexShrink={0} overflow="hidden">
        {/* Tracked section */}
        <SectionRow margin={`${model.trackedCount} tracked`} label="tracked" />
        {model.tracked.length === 0 ? (
          <MarginRow margin="—" body="nothing tracked yet · press 2 to discover" dim />
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
          <MarginRow margin="…" body={`${model.trackedCount - model.tracked.length} more`} dim />
        ) : null}

        <DimRule />

        {/* Discovery queue section */}
        <SectionRow
          margin={model.queueCount > 0 ? `${model.queueCount} pending` : "queue empty"}
          label="discovery"
        />
        {model.queueGroups.length === 0 ? (
          <MarginRow margin="—" body="nothing pending · press r to rescan" dim />
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
          <MarginRow
            margin="…"
            body={`${model.queueGroupCount - model.queueGroups.length} more groups · press 2`}
            dim
          />
        ) : null}

        <DimRule />

        {/* Sync section */}
        <SectionRow
          margin={model.dirty ? "1 dirty" : `↑${model.sync.ahead} ↓${model.sync.behind}`}
          label="sync"
        />
        <MarginRow
          margin={model.sync.lastSyncAt === null ? "never" : relativeAge(model.sync.lastSyncAt)}
          body={`· ${model.sync.remote ?? "(no remote)"}`}
          dim
        />
        <MarginRow
          margin={model.sync.autoInterval ?? "off"}
          body={
            model.sync.autoInterval === null
              ? "· auto-sync off"
              : model.sync.nextAutoSyncIso === null
                ? `· ${model.sync.autoInterval} · scheduled`
                : `· ${model.sync.autoInterval} · next ${relativeAge(model.sync.nextAutoSyncIso)}`
          }
          dim
        />

        <DimRule />

        {/* Recent ops section */}
        <SectionRow
          margin={
            model.totalOperations > 0
              ? `${model.recentOperations.length} of ${model.totalOperations}`
              : "0 ops"
          }
          label="recent"
        />
        {model.recentOperations.length === 0 ? (
          <MarginRow margin="—" body="no operations yet" dim />
        ) : (
          model.recentOperations.map((op) => (
            <OperationRow key={op.id} op={op} focused={isFocused("op", `o:${op.id}`)} />
          ))
        )}
      </box>

      {/* Toast row: only when a toast exists. */}
      {model.toast !== null ? (
        <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
          <text fg={model.toast.tone === "danger" ? t.fg.danger : t.fg.muted}>
            {model.toast.message}
          </text>
        </box>
      ) : null}
    </box>
  );
}

function Header({
  model,
  summary,
}: {
  readonly model: UseHomePanel;
  readonly summary: string;
}): ReactNode {
  const t = useTheme();
  const repoLabel = truncateToWidth(tildify(model.repoRoot, model.home), 40);
  return (
    <box
      flexShrink={0}
      flexDirection="row"
      gap={t.space.md}
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
      border={["bottom"]}
      borderColor={t.fg.muted}
    >
      <box flexDirection="row" gap={t.space.sm}>
        <text fg={t.fg.heading}>{repoLabel}</text>
        <text fg={t.fg.subtle}>·</text>
        <text fg={t.fg.muted}>{model.branchSummary}</text>
      </box>
      <box flexDirection="row" gap={t.space.sm}>
        <text fg={model.dirty ? t.fg.danger : t.fg.success}>{model.dirty ? "dirty" : "clean"}</text>
        <text fg={t.fg.subtle}>·</text>
        <text fg={t.fg.muted}>{summary}</text>
      </box>
    </box>
  );
}

function DimRule(): ReactNode {
  const t = useTheme();
  return (
    <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1} overflow="hidden">
      <text fg={t.fg.subtle}>{"· ".repeat(200)}</text>
    </box>
  );
}

interface SectionRowProps {
  readonly margin: string;
  readonly label: string;
}

function SectionRow({ margin, label }: SectionRowProps): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="row" paddingLeft={1} paddingRight={1}>
      <text fg={t.fg.muted}>{margin.padStart(MARGIN_WIDTH)}</text>
      <text fg={t.fg.muted}>{"  "}</text>
      <text fg={t.fg.heading}>{label}</text>
    </box>
  );
}

interface MarginRowProps {
  readonly margin: string;
  readonly body: string;
  readonly focused?: boolean;
  readonly dim?: boolean;
  readonly tone?: "default" | "danger" | "success";
  readonly hint?: string;
}

function MarginRow({
  margin,
  body,
  focused,
  dim,
  tone = "default",
  hint,
}: MarginRowProps): ReactNode {
  const t = useTheme();
  const cursor = focused === true ? "›" : " ";
  const bodyColor: ColorInput =
    focused === true
      ? t.fg.focus
      : tone === "danger"
        ? t.fg.danger
        : tone === "success"
          ? t.fg.success
          : dim === true
            ? t.fg.muted
            : t.fg.default;
  const cursorColor: ColorInput = focused === true ? t.fg.focus : t.fg.default;
  return (
    <box flexDirection="row" paddingLeft={1} paddingRight={1}>
      <text fg={cursorColor}>{cursor}</text>
      <text fg={t.fg.muted}>{margin.padStart(MARGIN_WIDTH)}</text>
      <text fg={t.fg.muted}>{"  "}</text>
      <text fg={bodyColor}>{body}</text>
      {hint !== undefined && hint.length > 0 ? (
        <>
          <text fg={t.fg.muted}>{"  "}</text>
          <text fg={t.fg.muted}>{hint}</text>
        </>
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
  const display = truncateToWidth(tildify(tracked.target, home), TRACKED_PATH_MAX);
  const margin = relativeAge(tracked.addedAt);
  return (
    <MarginRow
      margin={margin}
      body={`+ ${display}`}
      focused={focused}
      hint={focused ? "enter log · u untrack" : undefined}
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
  const segment = truncateToWidth(group.segment, QUEUE_NAME_MAX);
  const margin = String(group.count);
  return (
    <MarginRow
      margin={margin}
      body={`? ${segment}`}
      focused={focused}
      dim={!focused}
      hint={focused ? "enter triage" : undefined}
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
  const desc = op.description.trim().length > 0 ? op.description : `(${op.kind})`;
  const truncated = truncateToWidth(desc, OP_DESC_MAX);
  const margin = relativeAge(op.at);
  const body = `${op.id.slice(0, 7)}  ${truncated}`;
  return <MarginRow margin={margin} body={body} focused={focused} dim={!focused} />;
}
