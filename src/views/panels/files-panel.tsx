import { useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { UntrackedNode, UseFilesPanel } from "../../controllers/files.controller";
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
import { SectionTitle } from "../components/section-title";
import { useTrackingConfirms } from "../components/tracking-confirms";
import { relativeAge } from "../lib/relative-age";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const NAME_MAX = 32;
const ROW_NAME_MAX = 40;
const META_VALUE_MAX = 64;
const PREVIEW_LINE_MAX = 96;
const PREVIEW_MAX_LINES = 200;
const INDENT = "  ";

type Column = "tracked" | "untracked";

interface VisibleRow {
  readonly node: UntrackedNode;
  readonly depth: number;
}

const TRACKED_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "tab", description: "col" },
  { keys: "d", description: "diff" },
  { keys: "u", description: "untrack" },
  { keys: "s", description: "sync" },
];
const UNTRACKED_DIR_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "tab", description: "col" },
  { keys: "space", description: "expand" },
  { keys: "t", description: "track" },
  { keys: "i", description: "ignore" },
  { keys: "s", description: "sync" },
];
const UNTRACKED_FILE_BINDINGS: readonly PanelBinding[] = [
  { keys: "↑/↓", description: "select" },
  { keys: "tab", description: "col" },
  { keys: "t", description: "track" },
  { keys: "i", description: "ignore" },
  { keys: "s", description: "sync" },
];

const TRACKED_EXTRAS: readonly PanelBinding[] = [{ keys: "shift+U", description: "untrack group" }];
const UNTRACKED_EXTRAS: readonly PanelBinding[] = [
  { keys: "shift+T", description: "track all" },
  { keys: "shift+I", description: "ignore all" },
];

export interface FilesPanelProps {
  readonly model: UseFilesPanel;
  /** Open the logs view filtered by a tracked file's target. */
  onViewLog?(target: string): void;
  /** Track every pending candidate at or under this absolute path. */
  onTrackPath?(absPath: string): void;
  /** Defer every pending candidate at or under this absolute path. */
  onIgnorePath?(absPath: string): void;
  /** Lazily list the contents of a directory the user is opening. */
  onExpandDir?(absPath: string): void;
}

/**
 * View 2 — `files`. Two equal columns:
 *
 *   - Left: split tracked (top) / untracked (bottom). Each scrolls.
 *   - Right: focused-row metadata + line-numbered contents preview.
 */
export function FilesPanel({
  model,
  onViewLog,
  onTrackPath,
  onIgnorePath,
  onExpandDir,
}: FilesPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("files");

  const [column, setColumn] = useState<Column>("untracked");
  const [trackedIdx, setTrackedIdx] = useState(0);
  const [untrackedIdx, setUntrackedIdx] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [requested, setRequested] = useState<ReadonlySet<string>>(() => new Set());
  const confirms = useTrackingConfirms({
    onUntrack: (file) => model.remove(file.target),
    onTrackGroup: onTrackPath,
    onIgnoreGroup: onIgnorePath,
  });
  const inputBlocked = confirms.active;

  const visible: readonly VisibleRow[] = useMemo(
    () => flattenTree(model.untrackedTree, expanded),
    [model.untrackedTree, expanded],
  );

  const focusedNode: UntrackedNode | undefined = visible[untrackedIdx]?.node;

  const bindings: readonly PanelBinding[] =
    column === "tracked"
      ? TRACKED_BINDINGS
      : focusedNode !== undefined && focusedNode.kind === "dir"
        ? UNTRACKED_DIR_BINDINGS
        : UNTRACKED_FILE_BINDINGS;
  usePublishPanelBindings(bindings);
  const extras: readonly PanelBinding[] = column === "tracked" ? TRACKED_EXTRAS : UNTRACKED_EXTRAS;
  usePublishPanelExtras(extras);

  // Clamp focus when row counts shrink.
  useEffect(() => {
    if (trackedIdx >= model.tracked.length && trackedIdx > 0) setTrackedIdx(0);
  }, [model.tracked.length, trackedIdx]);
  useEffect(() => {
    if (untrackedIdx >= visible.length && untrackedIdx > 0) setUntrackedIdx(0);
  }, [visible.length, untrackedIdx]);

  // Resolve focused tracked file or focused-untracked file path for the right pane.
  const focusedTracked: TrackedFile | undefined = model.tracked[trackedIdx];
  const focusedFilePath: string | null = useMemo(() => {
    if (column === "tracked") return focusedTracked?.source ?? null;
    if (focusedNode === undefined) return null;
    if (focusedNode.kind === "file") return focusedNode.path;
    return null;
  }, [column, focusedTracked, focusedNode]);

  // Load contents preview for whichever side is focused on a file.
  const [preview, setPreview] = useState<{ path: string; lines: readonly CodeLine[] } | null>(null);
  useEffect(() => {
    if (focusedFilePath === null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await model.readContents(focusedFilePath);
      if (cancelled) return;
      if (r.text === null) {
        setPreview({ path: focusedFilePath, lines: [{ text: "(unreadable)", kind: "hunk" }] });
        return;
      }
      const lines = r.text
        .split("\n")
        .slice(0, PREVIEW_MAX_LINES)
        .map<CodeLine>((line) => ({ text: truncateToWidth(line, PREVIEW_LINE_MAX) }));
      setPreview({ path: focusedFilePath, lines });
    })();
    return () => {
      cancelled = true;
    };
  }, [focusedFilePath, model]);

  function toggleExpand(node: UntrackedNode): void {
    if (node.kind !== "dir") return;
    if (node.children.length === 0 && !requested.has(node.path)) {
      setRequested((prev) => {
        const next = new Set(prev);
        next.add(node.path);
        return next;
      });
      onExpandDir?.(node.path);
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      return next;
    });
  }

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
        } else if (column === "untracked" && visible.length > 0) {
          setUntrackedIdx((i) => Math.min(i + 1, visible.length - 1));
        }
        return;
      case "k":
      case "up":
        if (column === "tracked" && model.tracked.length > 0) {
          setTrackedIdx((i) => Math.max(i - 1, 0));
        } else if (column === "untracked" && visible.length > 0) {
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
        if (column === "untracked" && focusedNode !== undefined) {
          confirms.promptTrackGroup(focusedNode.path);
        }
        return;
      case "i":
        if (column === "untracked" && focusedNode !== undefined) {
          confirms.promptIgnoreGroup(focusedNode.path);
        }
        return;
      case "return":
      case "space":
        if (column === "untracked" && focusedNode !== undefined) {
          toggleExpand(focusedNode);
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
          visible={visible}
          home={model.home}
          trackedIdx={trackedIdx}
          untrackedIdx={untrackedIdx}
          expanded={expanded}
        />
        <box width={1} flexShrink={0} border={["right"]} borderColor={t.fg.muted} />
        <RightColumn
          focused={
            column === "tracked"
              ? { kind: "tracked", file: focusedTracked ?? null }
              : focusedNode === undefined
                ? { kind: "empty" }
                : focusedNode.kind === "file"
                  ? { kind: "untracked-file", node: focusedNode }
                  : { kind: "untracked-dir", node: focusedNode }
          }
          home={model.home}
          dotfilesRoot={model.dotfilesRoot}
          preview={preview}
        />
      </box>
      {confirms.modal}
    </box>
  );
}

function flattenTree(
  nodes: readonly UntrackedNode[],
  expanded: ReadonlySet<string>,
  depth = 0,
  out: VisibleRow[] = [],
): readonly VisibleRow[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.kind === "dir" && node.children.length > 0 && expanded.has(node.path)) {
      flattenTree(node.children, expanded, depth + 1, out);
    }
  }
  return out;
}

function LeftColumn({
  column,
  tracked,
  visible,
  home,
  trackedIdx,
  untrackedIdx,
  expanded,
}: {
  readonly column: Column;
  readonly tracked: readonly TrackedFile[];
  readonly visible: readonly VisibleRow[];
  readonly home: string;
  readonly trackedIdx: number;
  readonly untrackedIdx: number;
  readonly expanded: ReadonlySet<string>;
}): ReactNode {
  const t = useTheme();
  return (
    <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column">
      <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column" paddingX={1}>
        <SectionTitle
          label="untracked"
          meta={visible.length === 0 ? "0" : `${visible.length} · rows`}
        />
        <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false} paddingRight={1}>
          {visible.length === 0 ? (
            <box flexDirection="column">
              <text fg={t.fg.default}>No untracked candidates.</text>
              <text fg={t.fg.muted}>press r to rescan</text>
            </box>
          ) : (
            visible.map((row, i) => {
              const focused = column === "untracked" && i === untrackedIdx;
              return (
                <UntrackedRow
                  key={row.node.path}
                  node={row.node}
                  depth={row.depth}
                  focused={focused}
                  expanded={expanded.has(row.node.path)}
                />
              );
            })
          )}
        </scrollbox>
      </box>
      <box border={["bottom"]} borderColor={t.fg.muted} />
      <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column" paddingX={1}>
        <SectionTitle label="tracked" meta={`${tracked.length} · touched`} />
        <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false} paddingRight={1}>
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
    </box>
  );
}

function UntrackedRow({
  node,
  depth,
  focused,
  expanded,
}: {
  readonly node: UntrackedNode;
  readonly depth: number;
  readonly focused: boolean;
  readonly expanded: boolean;
}): ReactNode {
  const indent = INDENT.repeat(depth);
  if (node.kind === "dir") {
    const glyph = expanded ? "▼" : "▶";
    const label = `${indent}${glyph} ${truncateToWidth(node.name, ROW_NAME_MAX - depth * INDENT.length)}`;
    return <AlignedRow focused={focused} left={label} right={String(node.count)} />;
  }
  const label = `${indent}  ${truncateToWidth(node.name, ROW_NAME_MAX - depth * INDENT.length)}`;
  return <AlignedRow focused={focused} left={label} />;
}

type RightFocus =
  | { readonly kind: "empty" }
  | { readonly kind: "tracked"; readonly file: TrackedFile | null }
  | { readonly kind: "untracked-file"; readonly node: UntrackedNode }
  | { readonly kind: "untracked-dir"; readonly node: UntrackedNode };

function RightColumn({
  focused,
  home,
  dotfilesRoot,
  preview,
}: {
  readonly focused: RightFocus;
  readonly home: string;
  readonly dotfilesRoot: string | null;
  readonly preview: { path: string; lines: readonly CodeLine[] } | null;
}): ReactNode {
  const t = useTheme();
  if (focused.kind === "empty") {
    return (
      <box flexBasis={0} flexGrow={1} flexShrink={1} padding={1} flexDirection="column">
        <SectionTitle label="select a file" />
      </box>
    );
  }
  if (focused.kind === "tracked") {
    if (focused.file === null) {
      return (
        <box flexBasis={0} flexGrow={1} flexShrink={1} padding={1} flexDirection="column">
          <SectionTitle label="select a file" />
        </box>
      );
    }
    const f = focused.file;
    return (
      <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
        <Section>
          <SectionTitle label={truncateToWidth(tildify(f.target, home), 56)} meta={f.status} />
          <MetaRow
            label="source"
            value={truncateToWidth(tildify(f.source, home), META_VALUE_MAX)}
          />
          <MetaRow
            label="target"
            value={truncateToWidth(tildify(f.target, home), META_VALUE_MAX)}
          />
          <MetaRow label="kind" value={f.kind} />
          <MetaRow label="added" value={relativeAge(f.addedAt)} />
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
  if (focused.kind === "untracked-file") {
    const node = focused.node;
    return (
      <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
        <Section>
          <SectionTitle label={truncateToWidth(tildify(node.path, home), 56)} meta="untracked" />
          <MetaRow label="path" value={truncateToWidth(tildify(node.path, home), META_VALUE_MAX)} />
          <MetaRow label="kind" value={node.candidateKind ?? "file"} />
          <MetaRow
            label="dotfiles"
            value={dotfilesRoot === null ? "(unset)" : tildify(dotfilesRoot, home)}
          />
        </Section>
        <Section>
          <SectionTitle label="contents" meta="t to track · i to ignore" />
          {preview === null ? (
            <text fg={t.fg.muted}>loading…</text>
          ) : (
            <CodeBlock lines={preview.lines} />
          )}
        </Section>
      </scrollbox>
    );
  }
  const dir = focused.node;
  const meta = dir.candidateKind === null ? "intermediate dir" : "untracked dir";
  return (
    <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
      <Section>
        <SectionTitle label={truncateToWidth(tildify(dir.path, home), 56)} meta={meta} />
        <MetaRow label="path" value={truncateToWidth(tildify(dir.path, home), META_VALUE_MAX)} />
        <MetaRow label="kind" value="directory" />
        <MetaRow label="pending" value={String(dir.count)} />
        <MetaRow label="children" value={String(dir.children.length)} />
        <MetaRow
          label="dotfiles"
          value={dotfilesRoot === null ? "(unset)" : tildify(dotfilesRoot, home)}
        />
      </Section>
      <Section>
        <SectionTitle label="files" meta="space to expand · T track all · I ignore all" />
        {dir.children.length === 0 ? (
          <text fg={t.fg.muted}>(no children)</text>
        ) : (
          dir.children.map((c) => (
            <AlignedRow
              key={c.path}
              left={truncateToWidth(tildify(c.path, home), META_VALUE_MAX)}
              right={
                <text fg={t.fg.muted}>
                  {c.kind === "dir" ? `${c.count} pending` : (c.candidateKind ?? "file")}
                </text>
              }
            />
          ))
        )}
      </Section>
    </scrollbox>
  );
}
