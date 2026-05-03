import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useState } from "react";
import type { UseSyncPanel } from "../../controllers/sync.controller";
import { INTERVAL_MS } from "../../services/sync.scheduler";
import { summarizeServiceError } from "../components/summarize-error";
import { relativeAge } from "../lib/relative-age";
import { useTheme } from "../theme";

export interface SyncPanelProps {
  readonly model: UseSyncPanel;
}

const FOOTER_HINT =
  "[f] fetch · [p] push · [s] sync · [j/k] move · [o] ours · [t] theirs · [e] edit";

function nextAutoSyncIso(model: UseSyncPanel): string | null {
  const interval = model.schedule.interval;
  const last = model.state.lastSyncAt;
  if (!model.schedule.running || interval === null || last === null) return null;
  const t = Date.parse(last);
  if (Number.isNaN(t)) return null;
  return new Date(t + INTERVAL_MS[interval]).toISOString();
}

export function SyncPanel({ model }: SyncPanelProps): ReactNode {
  const t = useTheme();
  const [conflictIdx, setConflictIdx] = useState(0);
  const inFlight =
    model.phase === "fetching" ||
    model.phase === "pushing" ||
    model.phase === "syncing" ||
    model.phase === "resolving" ||
    model.phase === "refreshing";

  useEffect(() => {
    if (conflictIdx >= model.conflicts.length) setConflictIdx(0);
  }, [model.conflicts.length, conflictIdx]);

  const focused = model.conflicts[conflictIdx];

  useKeyboard((event) => {
    switch (event.name) {
      case "f":
        if (!inFlight) model.fetch();
        return;
      case "p":
        if (!inFlight) model.push();
        return;
      case "s":
        if (!inFlight) model.syncNow();
        return;
      case "j":
      case "down":
        if (model.conflicts.length > 0) {
          setConflictIdx((i) => Math.min(i + 1, model.conflicts.length - 1));
        }
        return;
      case "k":
      case "up":
        if (model.conflicts.length > 0) setConflictIdx((i) => Math.max(i - 1, 0));
        return;
      case "o":
        if (focused !== undefined) model.resolve(focused.path, "ours");
        return;
      case "t":
        if (focused !== undefined) model.resolve(focused.path, "theirs");
        return;
      case "e":
        if (focused !== undefined) model.resolve(focused.path, "edit");
        return;
    }
  });

  const remoteLabel = model.state.remote ?? "(no remote)";
  const aheadBehind = `↑${model.state.ahead} ↓${model.state.behind}`;
  const dirtyLabel = model.state.dirty ? "dirty" : "clean";

  const showError = model.phase === "error" && model.error !== null;
  const showConflicts = model.conflicts.length > 0 && !showError;

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <box flexDirection="row" gap={t.space.md} paddingLeft={1} paddingRight={1}>
        <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
          {remoteLabel}
        </text>
        <text fg={t.fg.default}>{aheadBehind}</text>
        <text fg={model.state.dirty ? t.fg.danger : t.fg.dim}>{dirtyLabel}</text>
      </box>

      {/* Action row */}
      <box flexDirection="row" gap={t.space.md} paddingLeft={1} paddingRight={1}>
        <text fg={inFlight ? t.fg.dim : t.fg.success} attributes={TextAttributes.BOLD}>
          [Fetch]
        </text>
        <text fg={inFlight ? t.fg.dim : t.fg.success} attributes={TextAttributes.BOLD}>
          [Push]
        </text>
        <text fg={inFlight ? t.fg.dim : t.fg.success} attributes={TextAttributes.BOLD}>
          [Sync]
        </text>
      </box>

      {/* Body */}
      <box flexGrow={1} flexDirection="column" padding={t.space.sm}>
        {showError ? (
          <box
            backgroundColor={t.bg.surface}
            borderStyle={t.border.emphasis}
            flexDirection="column"
            padding={t.space.md}
            gap={t.space.sm}
          >
            <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
              Sync failed
            </text>
            <text fg={t.fg.default}>
              {model.error !== null ? summarizeServiceError(model.error) : ""}
            </text>
          </box>
        ) : showConflicts ? (
          <box flexDirection="column" gap={t.space.sm}>
            <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
              {model.conflicts.length} conflict{model.conflicts.length === 1 ? "" : "s"}
            </text>
            {model.conflicts.map((c, idx) => {
              const isFocused = idx === conflictIdx;
              return (
                <box key={c.path} flexDirection="row" gap={t.space.sm}>
                  <text fg={isFocused ? t.fg.accent : t.fg.default}>
                    {isFocused ? "› " : "  "}
                    {c.path}
                  </text>
                  <text fg={t.fg.dim}>[{c.kind}]</text>
                  <text fg={t.fg.dim}>[Ours] [Theirs] [Edit]</text>
                </box>
              );
            })}
          </box>
        ) : inFlight ? (
          <text fg={t.fg.dim}>{model.phase}…</text>
        ) : (
          <box flexDirection="column" gap={t.space.sm}>
            <text fg={t.fg.dim}>
              last sync ·{" "}
              {model.state.lastSyncAt === null ? "never" : relativeAge(model.state.lastSyncAt)}
            </text>
            {model.schedule.running && model.schedule.interval !== null ? (
              <text fg={t.fg.dim}>
                next auto-sync ·{" "}
                {(() => {
                  const next = nextAutoSyncIso(model);
                  return next === null
                    ? `(scheduled ${model.schedule.interval})`
                    : relativeAge(next);
                })()}
              </text>
            ) : (
              <text fg={t.fg.dim}>auto-sync · off</text>
            )}
          </box>
        )}
      </box>

      {/* Footer */}
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={t.fg.dim}>
          {inFlight ? `${model.phase}…` : `${model.conflicts.length} conflicts`}
        </text>
        <text fg={t.fg.dim}>{FOOTER_HINT}</text>
      </box>
    </box>
  );
}
