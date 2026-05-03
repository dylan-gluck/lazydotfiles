import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { basename, dirname } from "node:path";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
// `now` is a render-time clock used only for toast expiry checks.
import type { UseDiscoveryPanel } from "../../controllers/discovery.controller";
import type { CandidateStatus, DiscoveryCandidate } from "../../domain/candidate";
import { ConfirmModal } from "../components/confirm-modal";
import { useInputFocusEffect } from "../components/input-focus-context";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { summarizeServiceError } from "../components/summarize-error";
import { shortDir, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";
import type { Tokens } from "../theme";

export interface DiscoveryPanelProps {
  readonly model: UseDiscoveryPanel;
  /** Home dir used to tildify display paths. Defaults to $HOME. */
  readonly home?: string;
}

const TOAST_MS = 4000;
const MAX_VISIBLE_ROWS = 24;
const GROUP_DIR_MAX = 48;
const CHILD_NAME_MAX = 56;

const BINDINGS: readonly PanelBinding[] = [
  { keys: "j/k", description: "move" },
  { keys: "space", description: "expand" },
  { keys: "a/A", description: "accept" },
  { keys: "d/D", description: "defer" },
  { keys: "X", description: "reject group" },
  { keys: "/", description: "search" },
  { keys: "f", description: "filter" },
  { keys: "u", description: "undo" },
  { keys: "r", description: "rescan" },
];

type StatusFilter = "all" | "pending" | "accepted" | "deferred" | "rejected";
const STATUS_CYCLE: readonly StatusFilter[] = [
  "pending",
  "accepted",
  "deferred",
  "rejected",
  "all",
];

interface DirNode {
  readonly path: string;
  readonly name: string;
  readonly files: DiscoveryCandidate[];
  readonly subdirs: Map<string, DirNode>;
  totals: Record<CandidateStatus, number>;
  total: number;
}

type Row =
  | { kind: "dir"; node: DirNode; depth: number }
  | { kind: "file"; candidate: DiscoveryCandidate; depth: number };

type LastAction = {
  readonly label: string;
  readonly entries: ReadonlyArray<{ id: string; status: CandidateStatus }>;
  readonly at: number;
};

function reasonText(reason: DiscoveryCandidate["reason"]): string {
  switch (reason) {
    case "include":
      return "glob";
    case "sibling-of":
      return "near";
    case "auto":
      return "auto";
  }
}

function statusFg(status: CandidateStatus, t: Tokens): string {
  switch (status) {
    case "accepted":
      return t.fg.success;
    case "rejected":
      return t.fg.danger;
    case "deferred":
      return t.fg.dim;
    case "pending":
      return t.fg.default;
  }
}

const zeroCounts = (): Record<CandidateStatus, number> => ({
  pending: 0,
  accepted: 0,
  rejected: 0,
  deferred: 0,
});

function buildTree(
  candidates: readonly DiscoveryCandidate[],
  home: string,
  filter: StatusFilter,
  query: string,
): DirNode {
  const q = query.trim().toLowerCase();
  const homeKey = home.length > 0 ? home : "/";
  const root: DirNode = {
    path: homeKey,
    name: "~",
    files: [],
    subdirs: new Map(),
    totals: zeroCounts(),
    total: 0,
  };

  function ensure(path: string): DirNode {
    if (path === homeKey || path === "/") return root;
    const parent = ensure(dirname(path));
    const name = basename(path);
    let dir = parent.subdirs.get(name);
    if (dir === undefined) {
      dir = {
        path,
        name,
        files: [],
        subdirs: new Map(),
        totals: zeroCounts(),
        total: 0,
      };
      parent.subdirs.set(name, dir);
    }
    return dir;
  }

  for (const c of candidates) {
    if (filter !== "all" && c.status !== filter) continue;
    if (q.length > 0 && !c.path.toLowerCase().includes(q)) continue;
    const parent = ensure(dirname(c.path));
    parent.files.push(c);
  }

  function aggregate(node: DirNode): Record<CandidateStatus, number> {
    const t = zeroCounts();
    let n = 0;
    for (const f of node.files) {
      t[f.status]++;
      n++;
    }
    for (const sub of node.subdirs.values()) {
      const st = aggregate(sub);
      t.pending += st.pending;
      t.accepted += st.accepted;
      t.deferred += st.deferred;
      t.rejected += st.rejected;
      n += sub.total;
    }
    node.totals = t;
    node.total = n;
    return t;
  }
  aggregate(root);
  return root;
}

/** Recursively gather all candidates under a node (regardless of filter). */
function collectCandidates(node: DirNode): DiscoveryCandidate[] {
  const out: DiscoveryCandidate[] = [...node.files];
  for (const sub of node.subdirs.values()) out.push(...collectCandidates(sub));
  return out;
}

function buildRows(root: DirNode, expanded: ReadonlySet<string>): readonly Row[] {
  const rows: Row[] = [];
  function visit(node: DirNode, depth: number, isRoot: boolean): void {
    if (!isRoot) rows.push({ kind: "dir", node, depth });
    const open = isRoot || expanded.has(node.path);
    if (!open) return;
    // Direct files first (sorted), then subdirs (sorted by name).
    const files = [...node.files].sort((a, b) => basename(a.path).localeCompare(basename(b.path)));
    for (const f of files) rows.push({ kind: "file", candidate: f, depth: depth + 1 });
    const subs = [...node.subdirs.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const sub of subs) visit(sub, depth + 1, false);
  }
  visit(root, -1, true);
  return rows;
}

function formatNodeCounts(node: DirNode): string {
  const c = node.totals;
  if (node.total === 0) return "";
  if (c.pending === node.total) return `${node.total} pending`;
  if (c.pending === 0) {
    if (c.accepted === node.total) return `${node.total} accepted`;
    if (c.deferred === node.total) return `${node.total} deferred`;
    if (c.rejected === node.total) return `${node.total} rejected`;
  }
  const parts: string[] = [];
  if (c.pending > 0) parts.push(`${c.pending} pending`);
  if (c.accepted > 0) parts.push(`${c.accepted}✓`);
  if (c.deferred > 0) parts.push(`${c.deferred}…`);
  if (c.rejected > 0) parts.push(`${c.rejected}✗`);
  return parts.join(" ");
}

export function DiscoveryPanel({ model, home }: DiscoveryPanelProps): ReactNode {
  const t = useTheme();
  const homeDir = home ?? process.env["HOME"] ?? "";
  usePublishPanelLabel("discover");
  usePublishPanelBindings(BINDINGS);

  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pendingRejectNode, setPendingRejectNode] = useState<DirNode | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useInputFocusEffect(searchOpen || pendingRejectNode !== null);

  const tree = useMemo(
    () => buildTree(model.queue, homeDir, filter, query),
    [model.queue, homeDir, filter, query],
  );
  const rows = useMemo(() => buildRows(tree, expanded), [tree, expanded]);

  // Reset focus when row count shrinks below current focus.
  useEffect(() => {
    if (rows.length === 0) {
      if (focusIdx !== 0) setFocusIdx(0);
      return;
    }
    if (focusIdx >= rows.length) setFocusIdx(rows.length - 1);
  }, [rows.length, focusIdx]);

  // Toast expiry. Bump `now` when the timer fires so the toast hides.
  useEffect(() => {
    if (lastAction === null) return;
    const elapsed = Date.now() - lastAction.at;
    const remaining = Math.max(0, TOAST_MS - elapsed);
    const handle = setTimeout(() => setNow(Date.now()), remaining);
    toastTimerRef.current = handle;
    return () => {
      clearTimeout(handle);
      toastTimerRef.current = null;
    };
  }, [lastAction]);

  const focusedRow: Row | undefined = rows[focusIdx];
  const focusedNode: DirNode | null = focusedRow?.kind === "dir" ? focusedRow.node : null;

  const recordAction = useCallback(
    (label: string, entries: ReadonlyArray<{ id: string; status: CandidateStatus }>): void => {
      if (entries.length === 0) return;
      const at = Date.now();
      setLastAction({ label, entries, at });
      setNow(at);
    },
    [],
  );

  const accept = useCallback(
    (cands: readonly DiscoveryCandidate[], label: string): void => {
      const ids = cands.map((c) => c.id);
      if (ids.length === 0) return;
      const prior = cands.map((c) => ({ id: c.id, status: c.status }));
      model.acceptMany(ids);
      recordAction(label, prior);
    },
    [model, recordAction],
  );
  const defer = useCallback(
    (cands: readonly DiscoveryCandidate[], label: string): void => {
      const ids = cands.map((c) => c.id);
      if (ids.length === 0) return;
      const prior = cands.map((c) => ({ id: c.id, status: c.status }));
      model.deferMany(ids);
      recordAction(label, prior);
    },
    [model, recordAction],
  );
  const reject = useCallback(
    (cands: readonly DiscoveryCandidate[], label: string): void => {
      const ids = cands.map((c) => c.id);
      if (ids.length === 0) return;
      const prior = cands.map((c) => ({ id: c.id, status: c.status }));
      model.rejectMany(ids);
      recordAction(label, prior);
    },
    [model, recordAction],
  );

  const undo = useCallback((): void => {
    if (lastAction === null) return;
    model.restore(lastAction.entries);
    const at = Date.now();
    setLastAction({ label: `Undid: ${lastAction.label}`, entries: [], at });
    setNow(at);
  }, [lastAction, model]);

  const cycleFilter = useCallback((): void => {
    const i = STATUS_CYCLE.indexOf(filter);
    const next = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] ?? "pending";
    setFilter(next);
    setFocusIdx(0);
  }, [filter]);

  const toggleExpand = useCallback((dir: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  const expandFocused = useCallback((path: string) => {
    setExpanded((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
    // After expansion, focus moves down one row to land on the first child.
    setFocusIdx((i) => i + 1);
  }, []);

  const collapseToParent = useCallback(() => {
    // Walk back up rows until we hit the parent dir of the current row.
    if (focusIdx === 0) return;
    const here = rows[focusIdx];
    if (here === undefined) return;
    for (let i = focusIdx - 1; i >= 0; i--) {
      const r = rows[i];
      if (r === undefined) continue;
      if (r.kind === "dir" && r.depth < here.depth) {
        setFocusIdx(i);
        return;
      }
    }
  }, [focusIdx, rows]);

  useKeyboard((event) => {
    if (pendingRejectNode !== null) return; // confirm modal owns input
    if (searchOpen) {
      switch (event.name) {
        case "escape":
          setSearchOpen(false);
          setQuery("");
          return;
        case "return":
          setSearchOpen(false);
          return;
        case "backspace":
          setQuery((q) => q.slice(0, -1));
          return;
        default:
          if (event.sequence !== undefined && event.sequence.length === 1) {
            const ch = event.sequence;
            if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) {
              setQuery((q) => q + ch);
            }
          }
          return;
      }
    }

    switch (event.name) {
      case "j":
      case "down":
        if (rows.length > 0) setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
        return;
      case "k":
      case "up":
        if (rows.length > 0) setFocusIdx((i) => Math.max(i - 1, 0));
        return;
      case "space":
        if (focusedRow?.kind === "dir") toggleExpand(focusedRow.node.path);
        return;
      case "tab":
      case "return":
        if (focusedRow?.kind === "dir") {
          if (expanded.has(focusedRow.node.path)) {
            // already open — go to first child
            setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
          } else {
            expandFocused(focusedRow.node.path);
          }
        }
        return;
      case "escape":
        if (focusedRow !== undefined && focusedRow.depth > 0) collapseToParent();
        return;
      case "a":
        if (focusedRow === undefined) return;
        if (focusedRow.kind === "file") {
          accept([focusedRow.candidate], `accepted ${basename(focusedRow.candidate.path)}`);
        } else {
          const cands = collectCandidates(focusedRow.node);
          accept(
            cands,
            `accepted ${shortDir(focusedRow.node.path, homeDir)} (${cands.length} files)`,
          );
        }
        return;
      case "d":
        if (focusedRow === undefined) return;
        if (focusedRow.kind === "file") {
          defer([focusedRow.candidate], `deferred ${basename(focusedRow.candidate.path)}`);
        } else {
          const cands = collectCandidates(focusedRow.node);
          defer(
            cands,
            `deferred ${shortDir(focusedRow.node.path, homeDir)} (${cands.length} files)`,
          );
        }
        return;
      case "x":
        if (focusedRow?.kind === "file") {
          reject([focusedRow.candidate], `rejected ${basename(focusedRow.candidate.path)}`);
        }
        return;
      case "A":
        if (focusedNode !== null) {
          const cands = collectCandidates(focusedNode);
          accept(cands, `accepted ${shortDir(focusedNode.path, homeDir)} (${cands.length} files)`);
        }
        return;
      case "D":
        if (focusedNode !== null) {
          const cands = collectCandidates(focusedNode);
          defer(cands, `deferred ${shortDir(focusedNode.path, homeDir)} (${cands.length} files)`);
        }
        return;
      case "X":
        if (focusedNode !== null) setPendingRejectNode(focusedNode);
        return;
      case "f":
        cycleFilter();
        return;
      case "/":
        setSearchOpen(true);
        return;
      case "u":
        undo();
        return;
      case "r":
        model.rescan();
        return;
    }
  });

  // Render error state — but still mount the keyboard handler above.
  if (model.status === "error" && model.error !== null) {
    return (
      <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        <box
          backgroundColor={t.bg.surface}
          borderStyle={t.border.emphasis}
          flexDirection="column"
          padding={t.space.md}
          gap={t.space.sm}
        >
          <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
            Discovery failed
          </text>
          <text fg={t.fg.default}>{summarizeServiceError(model.error)}</text>
          <text fg={t.fg.dim}>[r] retry</text>
        </box>
      </box>
    );
  }

  const totalPending = model.counts.pending;
  const totalAccepted = model.counts.accepted;
  const totalDeferred = model.counts.deferred;
  const totalRejected = model.counts.rejected;
  const total = totalPending + totalAccepted + totalDeferred + totalRejected;

  const filteredCandidateCount = tree.total;
  const headerLine =
    model.status === "scanning"
      ? `scanning… ${total} found so far`
      : query.length > 0
        ? `filter '${query}' · ${filteredCandidateCount} of ${total}`
        : `${total} candidates · ${totalAccepted} accepted · ${totalDeferred} deferred`;

  const showFilterStrip = searchOpen || filter !== "pending" || query.length > 0;

  const showToast = lastAction !== null && now - lastAction.at < TOAST_MS;

  // Filter chip labels with the active one inverted via accent.
  const chips: ReadonlyArray<{ key: StatusFilter; label: string }> = [
    { key: "pending", label: `pending ${totalPending}` },
    { key: "accepted", label: `accepted ${totalAccepted}` },
    { key: "deferred", label: `deferred ${totalDeferred}` },
    { key: "rejected", label: `rejected ${totalRejected}` },
    { key: "all", label: `all ${total}` },
  ];

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" paddingLeft={1} paddingRight={1}>
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          /discover
        </text>
        <text fg={t.fg.dim}>{headerLine}</text>
      </box>

      {/* Filter strip — only when searching or non-default filter */}
      {showFilterStrip ? (
        <box flexDirection="row" paddingLeft={1} paddingRight={1} gap={t.space.md}>
          <box flexDirection="row" gap={t.space.sm}>
            {chips.map((c) => {
              const active = c.key === filter;
              return active ? (
                <text key={c.key} fg={t.fg.success} attributes={TextAttributes.BOLD}>
                  [{c.label}]
                </text>
              ) : (
                <text key={c.key} fg={t.fg.dim}>
                  {" "}
                  {c.label}{" "}
                </text>
              );
            })}
          </box>
          {searchOpen ? (
            <text fg={t.fg.default}>/{query}▌</text>
          ) : query.length > 0 ? (
            <text fg={t.fg.dim}>/{query}</text>
          ) : null}
        </box>
      ) : null}

      {/* Body */}
      <box flexDirection="column" flexGrow={1} paddingLeft={1} paddingRight={1} overflow="hidden">
        {model.status === "scanning" && rows.length === 0 ? (
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg={t.fg.dim}>scanning…</text>
          </box>
        ) : rows.length === 0 ? (
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <box flexDirection="column" alignItems="center">
              {query.length > 0 ? (
                <>
                  <text fg={t.fg.default}>No matches for '{query}'</text>
                  <text fg={t.fg.dim}>esc clear filter · / edit</text>
                </>
              ) : filter !== "pending" ? (
                <>
                  <text fg={t.fg.default}>Nothing in {filter}</text>
                  <text fg={t.fg.dim}>f cycle filter · r rescan</text>
                </>
              ) : total === 0 ? (
                <>
                  <text fg={t.fg.default}>No candidates yet</text>
                  <text fg={t.fg.dim}>r rescan · 3 open config</text>
                </>
              ) : (
                <>
                  <text fg={t.fg.default}>All caught up</text>
                  <text fg={t.fg.dim}>
                    {totalAccepted} accepted · {totalDeferred} deferred · r rescan
                  </text>
                </>
              )}
            </box>
          </box>
        ) : (
          (() => {
            // Window the rendered slice around the focused row so we never paint
            // past the body. Floats focusIdx in the upper third of the viewport.
            const window = MAX_VISIBLE_ROWS;
            const start = Math.max(
              0,
              Math.min(focusIdx - Math.floor(window / 3), rows.length - window),
            );
            const end = Math.min(rows.length, start + window);
            const visible = rows.slice(start, end);
            return visible.map((row, vi) => {
              const idx = start + vi;
              const isFocused = idx === focusIdx;
              const indent = " ".repeat(row.depth * 2);
              if (row.kind === "dir") {
                const isOpen = expanded.has(row.node.path);
                const triangle = isOpen ? "▼" : "▶";
                const display = truncateToWidth(row.node.name, GROUP_DIR_MAX);
                const counts = formatNodeCounts(row.node);
                const cursor = isFocused ? "›" : " ";
                const hint = isFocused ? "  A·D·X" : "";
                const line = `${cursor} ${indent}${triangle} ${display}  ${counts}${hint}`;
                return (
                  <text key={`d:${row.node.path}`} fg={isFocused ? t.fg.focus : t.fg.default}>
                    {line}
                  </text>
                );
              }
              const c = row.candidate;
              const display = truncateToWidth(basename(c.path), CHILD_NAME_MAX);
              const cursor = isFocused ? "›" : " ";
              const reasonPad = reasonText(c.reason).padEnd(4, " ");
              const statusSuffix = c.status === "pending" ? "" : `  ${c.status}`;
              const hint = isFocused ? "  a·d·x" : "";
              const line = `${cursor} ${indent}${reasonPad} ${display}${statusSuffix}${hint}`;
              return (
                <text key={`c:${c.id}`} fg={isFocused ? t.fg.focus : statusFg(c.status, t)}>
                  {line}
                </text>
              );
            });
          })()
        )}
        {(() => {
          const overflow =
            model.status !== "scanning" && rows.length > MAX_VISIBLE_ROWS
              ? rows.length - MAX_VISIBLE_ROWS
              : 0;
          if (overflow === 0) return null;
          return <text fg={t.fg.dim}>… {overflow} more · scroll with j/k</text>;
        })()}
      </box>

      {/* Toast rail — visible until TOAST_MS has elapsed since the action. */}
      {showToast && lastAction !== null ? (
        <ToastRail
          label={lastAction.label}
          remaining={totalPending}
          canUndo={lastAction.entries.length > 0}
        />
      ) : null}

      {/* Subtree reject confirm */}
      {pendingRejectNode !== null ? (
        <ConfirmModal
          title="Reject subtree"
          summary={`Reject ${pendingRejectNode.total} files under ${shortDir(pendingRejectNode.path, homeDir)}?`}
          paths={collectCandidates(pendingRejectNode)
            .slice(0, 5)
            .map((c) => basename(c.path))}
          confirmLabel="Reject"
          onConfirm={() => {
            const n = pendingRejectNode;
            const cands = collectCandidates(n);
            reject(cands, `rejected ${shortDir(n.path, homeDir)} (${cands.length} files)`);
            setPendingRejectNode(null);
          }}
          onCancel={() => setPendingRejectNode(null)}
        />
      ) : null}
    </box>
  );
}

function ToastRail(props: {
  readonly label: string;
  readonly remaining: number;
  readonly canUndo: boolean;
}): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="row" paddingLeft={1} paddingRight={1} justifyContent="space-between">
      <text fg={t.fg.success}>
        {props.label} · {props.remaining} pending
      </text>
      {props.canUndo ? <text fg={t.fg.dim}>[u] undo</text> : null}
    </box>
  );
}
