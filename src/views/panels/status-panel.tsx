import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import type { UseStatusPanel } from "../../controllers/status.controller";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { relativeAge } from "../lib/relative-age";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const BINDINGS: readonly PanelBinding[] = [
  { keys: "4", description: "discover" },
  { keys: "5", description: "tracked" },
  { keys: "6", description: "log" },
  { keys: "7", description: "sync" },
];

export interface StatusPanelProps {
  readonly model: UseStatusPanel;
  /** Home dir used to tildify the repo path. */
  readonly home?: string;
}

const HEADER_PATH_MAX = 40;
const OP_DESC_MAX = 80;

export function StatusPanel({ model, home }: StatusPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("status");
  usePublishPanelBindings(BINDINGS);

  const homeDir = home ?? "";
  const repoLabel = truncateToWidth(tildify(model.repoRoot, homeDir), HEADER_PATH_MAX);
  const lastSyncLabel =
    model.sync.lastSyncAt === null ? "never" : relativeAge(model.sync.lastSyncAt);
  const remoteSummary = model.sync.remote === null ? "no remote" : "remote ok";

  // Header summary: counts + sync state + dirty flag, in one line.
  const summaryParts = [
    `${model.trackedCount} tracked`,
    `${model.queueCount} queued`,
    `sync ${lastSyncLabel}`,
    `↑${model.sync.ahead} ↓${model.sync.behind}`,
    remoteSummary,
  ];
  const summary = summaryParts.join(" · ");

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Header — one line: repo path · summary · dirty flag. */}
      <box
        flexDirection="row"
        gap={t.space.md}
        paddingLeft={1}
        paddingRight={1}
        justifyContent="space-between"
      >
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          {repoLabel}
        </text>
        <text fg={t.fg.dim}>{summary}</text>
        <text fg={model.dirty ? t.fg.danger : t.fg.success}>{model.dirty ? "dirty" : "clean"}</text>
      </box>

      {/* First-run banner: queue waiting, nothing tracked yet. */}
      {model.trackedCount === 0 && model.queueCount > 0 ? (
        <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingTop={1}>
          <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
            {model.queueCount} candidates ready to triage
          </text>
          <text fg={t.fg.muted}>
            Press 4 to open discovery. Use a/A to accept files, d/D to defer.
          </text>
        </box>
      ) : null}

      {/* Recent operations fill the body. */}
      <box
        flexDirection="column"
        flexGrow={1}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        overflow="hidden"
      >
        {model.recentOperations.length === 0 ? (
          <box flexGrow={1} alignItems="center" justifyContent="center">
            <box flexDirection="column" alignItems="center">
              <text fg={t.fg.default}>No operations yet</text>
              <text fg={t.fg.muted}>
                {model.queueCount > 0
                  ? `Press 4 to triage ${model.queueCount} discovered files`
                  : "Press 4 to discover files in your home directory"}
              </text>
            </box>
          </box>
        ) : (
          model.recentOperations.map((op) => {
            const desc = op.description.trim().length > 0 ? op.description : `(${op.kind})`;
            const line = `${op.id.slice(0, 8)}  ${truncateToWidth(desc, OP_DESC_MAX)}  ${relativeAge(op.at)}`;
            return (
              <text key={op.id} fg={t.fg.default}>
                {line}
              </text>
            );
          })
        )}
      </box>

      {/* Toast row only when a toast exists. */}
      {model.toast !== null ? (
        <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
          <text fg={model.toast.tone === "danger" ? t.fg.danger : t.fg.dim}>
            {model.toast.message}
          </text>
        </box>
      ) : null}
    </box>
  );
}
