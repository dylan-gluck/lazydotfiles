import { useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useState } from "react";
import type { UntrackedGroup, UseFilesPanel } from "../../controllers/files.controller";
import type { TrackedFile } from "../../domain/tracked-file";
import { AlignedRow } from "../components/aligned-row";
import { CodeBlock, type CodeLine } from "../components/code-block";
import { MetaRow } from "../components/meta-row";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelExtras,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { Section } from "../components/section";
import { SectionRow } from "../components/section-row";
import { SectionTitle } from "../components/section-title";
import { useTrackingConfirms } from "../components/tracking-confirms";
import { relativeAge } from "../lib/relative-age";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const NAME_MAX = 32;
const QUEUE_MAX = 32;
const META_VALUE_MAX = 64;
const PREVIEW_LINE_MAX = 96;
const PREVIEW_MAX_LINES = 200;

type Column = "tracked" | "untracked";

const TRACKED_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "tab", description: "col" },
  { keys: "d", description: "diff" },
  { keys: "u", description: "untrack" },
  { keys: "s", description: "sync" },
];
const UNTRACKED_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "tab", description: "col" },
  { keys: "t", description: "track" },
  { keys: "i", description: "ignore" },
  { keys: "s", description: "sync" },
];

const TRACKED_EXTRAS: readonly PanelBinding[] = [{ keys: "shift+U", description: "untrack group" }];
const UNTRACKED_EXTRAS: readonly PanelBinding[] = [
  { keys: "shift+T", description: "track group" },
  { keys: "shift+I", description: "ignore group" },
  { keys: "enter", description: "expand" },
];

export interface FilesPanelProps {
  readonly model: UseFilesPanel;
  /** Open the logs view filtered by a tracked file's target. */
  onViewLog?(target: string): void;
  /** Track every pending candidate in this top-level segment. */
  onTrackGroup?(segment: string): void;
  /** Defer every pending candidate in this top-level segment. */
  onIgnoreGroup?(segment: string): void;
  /** Expand a top-level segment so siblings appear in the queue. */
  onExpandGroup?(segment: string): void;
}

/**
 * View 2 — `files`. Two equal columns:
 *
 *   - Left: split tracked (top) / untracked (bottom). Each scrolls.
 *   - Right: focused-file metadata + line-numbered contents preview.
 */
export function FilesPanel({
  model,
  onViewLog,
  onTrackGroup,
  onIgnoreGroup,
  onExpandGroup,
}: FilesPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("files");

  const [column, setColumn] = useState<Column>("tracked");
  const [trackedIdx, setTrackedIdx] = useState(0);
  const [untrackedIdx, setUntrackedIdx] = useState(0);
  const confirms = useTrackingConfirms({
    onUntrack: (file) => model.remove(file.target),
    onTrackGroup,
    onIgnoreGroup,
  });
  const inputBlocked = confirms.active;

  const bindings: readonly PanelBinding[] =
    column === "tracked" ? TRACKED_BINDINGS : UNTRACKED_BINDINGS;
  usePublishPanelBindings(bindings);
  const extras: readonly PanelBinding[] = column === "tracked" ? TRACKED_EXTRAS : UNTRACKED_EXTRAS;
  usePublishPanelExtras(extras);

  // Clamp focus when row counts shrink.
  useEffect(() => {
    if (trackedIdx >= model.tracked.length && trackedIdx > 0) setTrackedIdx(0);
  }, [model.tracked.length, trackedIdx]);
  useEffect(() => {
    if (untrackedIdx >= model.untrackedGroups.length && untrackedIdx > 0) setUntrackedIdx(0);
  }, [model.untrackedGroups.length, untrackedIdx]);

  const focusedTracked: TrackedFile | undefined = model.tracked[trackedIdx];
  const focusedUntracked: UntrackedGroup | undefined = model.untrackedGroups[untrackedIdx];

  // Load contents preview for the focused tracked file.
  const [preview, setPreview] = useState<{ path: string; lines: readonly CodeLine[] } | null>(null);
  const previewSource = focusedTracked?.source ?? null;
  useEffect(() => {
    if (previewSource === null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await model.readContents(previewSource);
      if (cancelled) return;
      if (r.text === null) {
        setPreview({ path: previewSource, lines: [{ text: "(unreadable)", kind: "hunk" }] });
        return;
      }
      const lines = r.text
        .split("\n")
        .slice(0, PREVIEW_MAX_LINES)
        .map<CodeLine>((line) => ({ text: truncateToWidth(line, PREVIEW_LINE_MAX) }));
      setPreview({ path: previewSource, lines });
    })();
    return () => {
      cancelled = true;
    };
  }, [previewSource, model]);

  useKeyboard((event) => {
    if (inputBlocked) return;
    switch (event.name) {
      case "tab":
        setColumn((c) => (c === "tracked" ? "untracked" : "tracked"));
        return;
      case "j":
      case "down":
        if (column === "tracked" && model.tracked.length > 0) {
          setTrackedIdx((i) => Math.min(i + 1, model.tracked.length - 1));
        } else if (column === "untracked" && model.untrackedGroups.length > 0) {
          setUntrackedIdx((i) => Math.min(i + 1, model.untrackedGroups.length - 1));
        }
        return;
      case "k":
      case "up":
        if (column === "tracked" && model.tracked.length > 0) {
          setTrackedIdx((i) => Math.max(i - 1, 0));
        } else if (column === "untracked" && model.untrackedGroups.length > 0) {
          setUntrackedIdx((i) => Math.max(i - 1, 0));
        }
        return;
      case "u":
        if (column === "tracked" && focusedTracked !== undefined) {
          confirms.promptUntrack(focusedTracked);
        }
        return;
      case "d":
        if (column === "tracked" && focusedTracked !== undefined) {
          onViewLog?.(focusedTracked.target);
        }
        return;
      case "t":
        if (column === "untracked" && focusedUntracked !== undefined) {
          confirms.promptTrackGroup(focusedUntracked.segment);
        }
        return;
      case "i":
        if (column === "untracked" && focusedUntracked !== undefined) {
          confirms.promptIgnoreGroup(focusedUntracked.segment);
        }
        return;
      case "return":
        if (column === "untracked" && focusedUntracked !== undefined) {
          onExpandGroup?.(focusedUntracked.segment);
        }
        return;
    }
  });

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} flexShrink={1} overflow="hidden">
        <LeftColumn
          column={column}
          tracked={model.tracked}
          untrackedGroups={model.untrackedGroups}
          home={model.home}
          trackedIdx={trackedIdx}
          untrackedIdx={untrackedIdx}
        />
        <box width={1} flexShrink={0} border={["right"]} borderColor={t.fg.muted} />
        <RightColumn
          focused={column === "tracked" ? (focusedTracked ?? null) : null}
          focusedUntracked={column === "untracked" ? (focusedUntracked ?? null) : null}
          home={model.home}
          dotfilesRoot={model.dotfilesRoot}
          preview={preview}
        />
      </box>
      {confirms.modal}
    </box>
  );
}

function LeftColumn({
  column,
  tracked,
  untrackedGroups,
  home,
  trackedIdx,
  untrackedIdx,
}: {
  readonly column: Column;
  readonly tracked: readonly TrackedFile[];
  readonly untrackedGroups: readonly UntrackedGroup[];
  readonly home: string;
  readonly trackedIdx: number;
  readonly untrackedIdx: number;
}): ReactNode {
  const t = useTheme();
  return (
    <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column">
      <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column" padding={1}>
        <SectionTitle label="tracked" meta={`${tracked.length} · touched`} />
        <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false}>
          {tracked.length === 0 ? (
            <text fg={t.fg.muted}>(no tracked files)</text>
          ) : (
            tracked.map((tf, i) => (
              <AlignedRow
                key={tf.id}
                focused={column === "tracked" && i === trackedIdx}
                left={truncateToWidth(tildify(tf.target, home), NAME_MAX)}
                right={relativeAge(tf.addedAt)}
              />
            ))
          )}
        </scrollbox>
      </box>
      <box border={["bottom"]} borderColor={t.fg.muted} />
      <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column" padding={1}>
        <SectionTitle
          label="untracked"
          meta={untrackedGroups.length === 0 ? "0" : `${untrackedGroups.length} · count`}
        />
        <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false}>
          {untrackedGroups.length === 0 ? (
            <box flexDirection="column">
              <text fg={t.fg.default}>No untracked candidates.</text>
              <text fg={t.fg.muted}>press r to rescan</text>
            </box>
          ) : (
            untrackedGroups.map((g, i) => (
              <AlignedRow
                key={g.segment}
                focused={column === "untracked" && i === untrackedIdx}
                dim
                left={`▶ ${truncateToWidth(g.segment, QUEUE_MAX)}`}
                right={String(g.count)}
              />
            ))
          )}
        </scrollbox>
      </box>
    </box>
  );
}

function RightColumn({
  focused,
  focusedUntracked,
  home,
  dotfilesRoot,
  preview,
}: {
  readonly focused: TrackedFile | null;
  readonly focusedUntracked: UntrackedGroup | null;
  readonly home: string;
  readonly dotfilesRoot: string | null;
  readonly preview: { path: string; lines: readonly CodeLine[] } | null;
}): ReactNode {
  const t = useTheme();
  if (focused === null && focusedUntracked === null) {
    return (
      <box flexBasis={0} flexGrow={1} flexShrink={1} padding={1} flexDirection="column">
        <SectionTitle label="select a file" />
      </box>
    );
  }
  if (focused === null && focusedUntracked !== null) {
    return (
      <box flexBasis={0} flexGrow={1} flexShrink={1} padding={1} flexDirection="column">
        <SectionTitle label={focusedUntracked.segment} meta="untracked group" />
        <SectionRow margin={String(focusedUntracked.count)} body="candidates pending review" />
        <SectionRow margin="t" body={<text fg={t.fg.muted}>track group</text>} />
        <SectionRow margin="i" body={<text fg={t.fg.muted}>ignore group</text>} />
        <SectionRow margin="enter" body={<text fg={t.fg.muted}>expand</text>} />
      </box>
    );
  }
  if (focused === null) return null;
  return (
    <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
      <Section>
        <SectionTitle
          label={truncateToWidth(tildify(focused.target, home), 56)}
          meta={focused.status}
        />
        <MetaRow
          label="source"
          value={truncateToWidth(tildify(focused.source, home), META_VALUE_MAX)}
        />
        <MetaRow
          label="target"
          value={truncateToWidth(tildify(focused.target, home), META_VALUE_MAX)}
        />
        <MetaRow label="kind" value={focused.kind} />
        <MetaRow label="added" value={relativeAge(focused.addedAt)} />
        <MetaRow
          label="dotfiles"
          value={dotfilesRoot === null ? "(unset)" : tildify(dotfilesRoot, home)}
        />
      </Section>
      <Section>
        <SectionTitle label="contents" meta="d for diff vs working copy" />
        {preview === null ? (
          <text fg={t.fg.muted}>loading…</text>
        ) : (
          <CodeBlock lines={preview.lines} />
        )}
      </Section>
    </scrollbox>
  );
}
