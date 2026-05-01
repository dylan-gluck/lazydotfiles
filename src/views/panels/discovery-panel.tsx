import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { basename, dirname } from "node:path";
import { type ReactNode, useEffect, useState } from "react";
import type { DiscoveryCandidate } from "../../domain/candidate";
import type { UseDiscoveryPanel } from "../../controllers/discovery.controller";
import { summarizeServiceError } from "../components/summarize-error";
import { useTheme } from "../theme";
import type { Tokens } from "../theme";

export interface DiscoveryPanelProps {
  readonly model: UseDiscoveryPanel;
}

const FOOTER_HINT = "[a] accept · [r] rescan · [d] defer · [j/k] move · [space] expand siblings";

function statusFg(status: DiscoveryCandidate["status"], t: Tokens): string {
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

function reasonBadge(reason: DiscoveryCandidate["reason"]): string {
  switch (reason) {
    case "include":
      return "[inc]";
    case "sibling-of":
      return "[sib]";
    case "auto":
      return "[aut]";
  }
}

function groupByDir(
  queue: readonly DiscoveryCandidate[],
): readonly { dir: string; entries: readonly DiscoveryCandidate[] }[] {
  const map = new Map<string, DiscoveryCandidate[]>();
  for (const c of queue) {
    const d = dirname(c.path);
    let arr = map.get(d);
    if (arr === undefined) {
      arr = [];
      map.set(d, arr);
    }
    arr.push(c);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, entries]) => ({
      dir,
      entries: [...entries].sort((a, b) => a.path.localeCompare(b.path)),
    }));
}

function summarizeError(err: NonNullable<UseDiscoveryPanel["error"]>): string {
  return summarizeServiceError(err);
}

export function DiscoveryPanel({ model }: DiscoveryPanelProps): ReactNode {
  const t = useTheme();
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    if (focusIdx >= model.queue.length) setFocusIdx(0);
  }, [model.queue.length, focusIdx]);

  const focused = model.queue[focusIdx];

  useKeyboard((event) => {
    switch (event.name) {
      case "j":
      case "down":
        if (model.queue.length > 0) setFocusIdx((i) => Math.min(i + 1, model.queue.length - 1));
        return;
      case "k":
      case "up":
        if (model.queue.length > 0) setFocusIdx((i) => Math.max(i - 1, 0));
        return;
      case "a":
        if (focused !== undefined) model.accept(focused.id);
        return;
      case "d":
        if (focused !== undefined) model.defer(focused.id);
        return;
      case "x":
        if (focused !== undefined) model.reject(focused.id);
        return;
      case "space":
        if (focused !== undefined) model.expand(focused.path);
        return;
    }
  });

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
          <text fg={t.fg.default}>{summarizeError(model.error)}</text>
          <text fg={t.fg.dim}>[r] retry</text>
        </box>
      </box>
    );
  }

  const isEmpty = model.queue.length === 0 && model.status !== "scanning";
  const groups = groupByDir(model.queue);

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row" flexGrow={1} gap={t.space.sm}>
        {isEmpty ? (
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <text fg={t.fg.dim}>No candidates. Press r to rescan.</text>
          </box>
        ) : (
          <>
            <box flexBasis={42} flexShrink={0} flexDirection="column">
              {groups.map((g) => (
                <box key={g.dir} flexDirection="column" marginBottom={1}>
                  <text fg={t.fg.dim} attributes={TextAttributes.DIM}>
                    {g.dir}
                  </text>
                  {g.entries.map((c) => {
                    const isFocused = focused !== undefined && c.id === focused.id;
                    return (
                      <text key={c.id} fg={statusFg(c.status, t)}>
                        {isFocused ? "› " : "  "}
                        {reasonBadge(c.reason)} {basename(c.path)}
                      </text>
                    );
                  })}
                </box>
              ))}
            </box>
            <box flexGrow={1} flexDirection="column">
              {focused === undefined ? (
                <text fg={t.fg.dim}>(no selection)</text>
              ) : (
                <>
                  <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
                    {focused.path}
                  </text>
                  <text fg={t.fg.dim}>kind: {focused.kind}</text>
                  <text fg={t.fg.dim}>reason: {focused.reason}</text>
                  <text fg={t.fg.dim}>status: {focused.status}</text>
                  <text fg={t.fg.dim}>siblings tracked: {focused.siblings.length}</text>
                </>
              )}
            </box>
          </>
        )}
      </box>
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={t.fg.dim}>
          {model.status === "scanning"
            ? "scanning…"
            : `${model.counts.pending} pending · ${model.counts.accepted} accepted · ${model.counts.rejected} rejected · ${model.counts.deferred} deferred`}
        </text>
        <text fg={t.fg.dim}>{FOOTER_HINT}</text>
      </box>
    </box>
  );
}
