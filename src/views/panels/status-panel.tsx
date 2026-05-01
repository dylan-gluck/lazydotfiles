import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import type { UseStatusPanel } from "../../controllers/status.controller";
import { relativeAge } from "../lib/relative-age";
import { useTheme } from "../theme";

export interface StatusPanelProps {
  readonly model: UseStatusPanel;
}

export function StatusPanel({ model }: StatusPanelProps): ReactNode {
  const t = useTheme();
  const dirtyLabel = model.dirty ? "dirty" : "clean";
  const lastSyncLabel =
    model.sync.lastSyncAt === null ? "never" : relativeAge(model.sync.lastSyncAt);
  const remoteLabel = model.sync.remote ?? "(no remote)";

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <box
        flexDirection="row"
        gap={t.space.md}
        paddingLeft={1}
        paddingRight={1}
        justifyContent="space-between"
      >
        <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
          {model.repoRoot}
        </text>
        <text fg={model.dirty ? t.fg.danger : t.fg.dim}>{dirtyLabel}</text>
      </box>

      {/* Cards 3-up */}
      <box flexDirection="row" gap={t.space.md} padding={t.space.sm}>
        <box
          flexGrow={1}
          flexBasis={0}
          flexDirection="column"
          borderStyle={t.border.default}
          padding={t.space.sm}
          gap={t.space.xs}
        >
          <text fg={t.fg.dim}>Tracked</text>
          <text fg={t.fg.default} attributes={TextAttributes.BOLD}>
            {String(model.trackedCount)}
          </text>
        </box>
        <box
          flexGrow={1}
          flexBasis={0}
          flexDirection="column"
          borderStyle={t.border.default}
          padding={t.space.sm}
          gap={t.space.xs}
        >
          <text fg={t.fg.dim}>Discovery queue</text>
          <text fg={t.fg.default} attributes={TextAttributes.BOLD}>
            {String(model.queueCount)}
          </text>
        </box>
        <box
          flexGrow={1}
          flexBasis={0}
          flexDirection="column"
          borderStyle={t.border.default}
          padding={t.space.sm}
          gap={t.space.xs}
        >
          <text fg={t.fg.dim}>Sync</text>
          <text fg={t.fg.default}>{lastSyncLabel}</text>
          <text fg={t.fg.dim}>
            ↑{model.sync.ahead} ↓{model.sync.behind}
          </text>
          <text fg={t.fg.dim}>{remoteLabel}</text>
        </box>
      </box>

      {/* Recent operations */}
      <box flexDirection="column" flexGrow={1} padding={t.space.sm} gap={t.space.xs}>
        <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
          Recent operations
        </text>
        {model.recentOperations.length === 0 ? (
          <text fg={t.fg.dim}>(no operations yet)</text>
        ) : (
          model.recentOperations.map((op) => (
            <box key={op.id} flexDirection="row" gap={t.space.sm}>
              <text fg={t.fg.dim}>{op.id.slice(0, 8)}</text>
              <text fg={t.fg.default}>{op.description}</text>
              <text fg={t.fg.dim}>{relativeAge(op.at)}</text>
            </box>
          ))
        )}
      </box>

      {/* Toast / error rail (1-line, anchored bottom by being last) */}
      <box
        height={1}
        flexDirection="row"
        paddingLeft={1}
        paddingRight={1}
        justifyContent="space-between"
      >
        {model.toast === null ? (
          <text fg={t.fg.dim}>{`${model.trackedCount} tracked · ${model.queueCount} queued`}</text>
        ) : (
          <text fg={model.toast.tone === "danger" ? t.fg.danger : t.fg.dim}>
            {model.toast.message}
          </text>
        )}
        <text fg={t.fg.dim}>[?] help · [q] quit</text>
      </box>
    </box>
  );
}
