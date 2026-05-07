import { useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type {
  UntrackedDirEntry,
  UntrackedEntry,
  UntrackedFileEntry,
  UseFilesPanel,
} from "../../controllers/files.controller";
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
const QUEUE_MAX = 32;
const META_VALUE_MAX = 64;
const PREVIEW_LINE_MAX = 96;
const PREVIEW_MAX_LINES = 200;
const CHILD_MAX = 30;

type Column = "tracked" | "untracked";

type Visible =
  | { readonly row: "entry"; readonly entry: UntrackedEntry }
  | {
      readonly row: "child";
      readonly parent: UntrackedDirEntry;
      readonly child: UntrackedDirEntry["children"][number];
    };

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
  { keys: "shift+T", description: "track group" },
  { keys: "shift+I", description: "ignore group" },
];

export interface FilesPanelProps {
  readonly model: UseFilesPanel;
  /** Open the logs view filtered by a tracked file's target. */
  onViewLog?(target: string): void;
  /** Track every pending candidate in this top-level segment. */
  onTrackGroup?(segment: string): void;
  /** Defer every pending candidate in this top-level segment. */
  onIgnoreGroup?(segment: string): void;
  /** Lazily fetch siblings under a top-level segment when first expanded. */
  onExpandGroup?(segment: string): void;
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
  onTrackGroup,
  onIgnoreGroup,
  onExpandGroup,
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
    onTrackGroup,
    onIgnoreGroup,
  });
  const inputBlocked = confirms.active;

  const visible: readonly Visible[] = useMemo(() => {
    const out: Visible[] = [];
    for (const entry of model.untrackedEntries) {
      out.push({ row: "entry", entry });
      if (entry.kind === "dir" && expanded.has(entry.segment)) {
        for (const child of entry.children.slice(0, CHILD_MAX)) {
          out.push({ row: "child", parent: entry, child });
        }
      }
    }
    return out;
  }, [model.untrackedEntries, expanded]);

  const focusedVisible: Visible | undefined = visible[untrackedIdx];

  const focusedUntrackedEntry: UntrackedEntry | null =
    focusedVisible === undefined
      ? null
      : focusedVisible.row === "entry"
        ? focusedVisible.entry
        : focusedVisible.parent;

  const bindings: readonly PanelBinding[] =
    column === "tracked"
      ? TRACKED_BINDINGS
      : focusedUntrackedEntry !== null && focusedUntrackedEntry.kind === "dir"
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
    if (focusedVisible === undefined) return null;
    if (focusedVisible.row === "child") return focusedVisible.child.path;
    if (focusedVisible.entry.kind === "file") return focusedVisible.entry.path;
    return null;
  }, [column, focusedTracked, focusedVisible]);

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

  function toggleExpand(entry: UntrackedDirEntry): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(entry.segment)) next.delete(entry.segment);
      else next.add(entry.segment);
      return next;
    });
    if (!requested.has(entry.segment)) {
      setRequested((prev) => {
        const next = new Set(prev);
        next.add(entry.segment);
        return next;
      });
      onExpandGroup?.(entry.segment);
    }
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
        if (column === "untracked" && focusedUntrackedEntry !== null) {
          confirms.promptTrackGroup(focusedUntrackedEntry.segment);
        }
        return;
      case "i":
        if (column === "untracked" && focusedUntrackedEntry !== null) {
          confirms.promptIgnoreGroup(focusedUntrackedEntry.segment);
        }
        return;
      case "return":
      case "space":
        if (
          column === "untracked" &&
          focusedVisible !== undefined &&
          focusedVisible.row === "entry" &&
          focusedVisible.entry.kind === "dir"
        ) {
          toggleExpand(focusedVisible.entry);
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
              : focusedVisible === undefined
                ? { kind: "empty" }
                : focusedVisible.row === "child"
                  ? {
                      kind: "untracked-file",
                      path: focusedVisible.child.path,
                      tracked: focusedVisible.child.tracked,
                    }
                  : focusedVisible.entry.kind === "file"
                    ? {
                        kind: "untracked-file",
                        path: focusedVisible.entry.path,
                        tracked: false,
                        candidateKind: focusedVisible.entry.candidateKind,
                      }
                    : { kind: "untracked-dir", entry: focusedVisible.entry }
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
  readonly visible: readonly Visible[];
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
        <scrollbox flexGrow={1} flexShrink={1} scrollY scrollX={false}>
          {visible.length === 0 ? (
            <box flexDirection="column">
              <text fg={t.fg.default}>No untracked candidates.</text>
              <text fg={t.fg.muted}>press r to rescan</text>
            </box>
          ) : (
            visible.map((v, i) => {
              const focused = column === "untracked" && i === untrackedIdx;
              if (v.row === "entry") {
                if (v.entry.kind === "dir") {
                  const open = expanded.has(v.entry.segment);
                  const glyph = open ? "▼" : "▶";
                  return (
                    <AlignedRow
                      key={`d:${v.entry.segment}`}
                      focused={focused}
                      left={`${glyph} ${truncateToWidth(v.entry.segment, QUEUE_MAX)}`}
                      right={String(v.entry.count)}
                    />
                  );
                }
                return (
                  <AlignedRow
                    key={`f:${v.entry.path}`}
                    focused={focused}
                    left={`  ${truncateToWidth(v.entry.segment, QUEUE_MAX)}`}
                    right={kindGlyph(v.entry.candidateKind)}
                  />
                );
              }
              return (
                <AlignedRow
                  key={`c:${v.parent.segment}:${v.child.path}`}
                  focused={focused}
                  dim={!focused}
                  left={`    ${truncateToWidth(leafName(v.child.path), QUEUE_MAX - 2)}`}
                  right={
                    <text fg={v.child.tracked ? t.fg.success : t.fg.muted}>
                      {v.child.tracked ? "tracked" : "pending"}
                    </text>
                  }
                />
              );
            })
          )}
        </scrollbox>
      </box>
      <box border={["bottom"]} borderColor={t.fg.muted} />
      <box flexBasis={0} flexGrow={1} flexShrink={1} flexDirection="column" paddingX={1}>
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
    </box>
  );
}

type RightFocus =
  | { readonly kind: "empty" }
  | { readonly kind: "tracked"; readonly file: TrackedFile | null }
  | {
      readonly kind: "untracked-file";
      readonly path: string;
      readonly tracked: boolean;
      readonly candidateKind?: UntrackedFileEntry["candidateKind"];
    }
  | { readonly kind: "untracked-dir"; readonly entry: UntrackedDirEntry };

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
    const path = focused.path;
    return (
      <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
        <Section>
          <SectionTitle
            label={truncateToWidth(tildify(path, home), 56)}
            meta={focused.tracked ? "tracked" : "untracked"}
          />
          <MetaRow label="path" value={truncateToWidth(tildify(path, home), META_VALUE_MAX)} />
          <MetaRow label="kind" value={focused.candidateKind ?? "file"} />
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
  const dir = focused.entry;
  return (
    <scrollbox flexBasis={0} flexGrow={1} flexShrink={1} scrollY scrollX={false}>
      <Section>
        <SectionTitle label={truncateToWidth(tildify(dir.path, home), 56)} meta="untracked group" />
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
        <SectionTitle label="files" meta="T track all · I ignore all" />
        {dir.children.length === 0 ? (
          <text fg={t.fg.muted}>(no children loaded — press ↵ to expand)</text>
        ) : (
          dir.children.map((c) => (
            <AlignedRow
              key={c.path}
              left={truncateToWidth(tildify(c.path, home), META_VALUE_MAX)}
              right={
                <text fg={c.tracked ? t.fg.success : t.fg.muted}>
                  {c.tracked ? "tracked" : "pending"}
                </text>
              }
            />
          ))
        )}
      </Section>
    </scrollbox>
  );
}

function leafName(absPath: string): string {
  const slash = absPath.lastIndexOf("/");
  return slash === -1 ? absPath : absPath.slice(slash + 1);
}

function kindGlyph(kind: UntrackedFileEntry["candidateKind"]): string {
  switch (kind) {
    case "directory":
      return "dir";
    case "template":
      return "tpl";
    default:
      return "file";
  }
}
