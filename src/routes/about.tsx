import { TextAttributes } from "@opentui/core";
import { createFileRoute } from "@tanstack/react-router";
import { CONFIG_ACTOR_ID, type ConfigState } from "../actors/config.actor";
import { useActor } from "../actors/use-actor";
import { useStatusPanel } from "../controllers/status.controller";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../views/components/panel-bindings-context";
import { tildify } from "../views/lib/truncate-path";
import { useTheme } from "../views/theme";

export const Route = createFileRoute("/about")({
  component: About,
});

const BINDINGS: readonly PanelBinding[] = [
  { keys: "1", description: "status" },
  { keys: "4", description: "discover" },
];

function About() {
  const t = useTheme();
  usePublishPanelLabel("about");
  usePublishPanelBindings(BINDINGS);
  const status = useStatusPanel();
  const config = useActor<ConfigState>(CONFIG_ACTOR_ID);
  const home = config.state.config?.path.home ?? "";
  const dotfilesPath = config.state.config?.path.dotfiles ?? status.repoRoot;
  const backupPath = config.state.config?.path.backup ?? "";
  const vcs = config.state.config?.options.vcs ?? "jj";

  return (
    <box flexDirection="column" flexGrow={1} padding={t.space.md} gap={t.space.sm}>
      <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
        lazydotfiles
      </text>
      <text fg={t.fg.default}>
        A terminal for discovering, tracking, versioning, and syncing dotfiles.
      </text>

      <box flexDirection="column" marginTop={t.space.sm}>
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          Repository
        </text>
        <text
          fg={t.fg.muted}
        >{`path: ${tildify(dotfilesPath, home)}  ·  vcs: ${vcs}  ·  ${status.dirty ? "dirty" : "clean"}`}</text>
        <text fg={t.fg.muted}>
          {`tracked: ${status.trackedCount}  ·  queued: ${status.queueCount}  ·  remote: ${status.sync.remote ?? "(unset)"}`}
        </text>
        <text fg={t.fg.muted}>
          jj is a git-compatible version control system. Every change you make here is captured as a
          jj operation and is reachable from the log.
        </text>
      </box>

      <box flexDirection="column" marginTop={t.space.sm}>
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          Discovery vocabulary
        </text>
        <text fg={t.fg.muted}>
          glob · path matched a discovery.include pattern from your config.
        </text>
        <text fg={t.fg.muted}>
          near · file is a sibling of one you already accepted (same parent dir).
        </text>
        <text fg={t.fg.muted}>auto · auto-tracked from a non-glob include.</text>
      </box>

      <box flexDirection="column" marginTop={t.space.sm}>
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          Safety
        </text>
        <text fg={t.fg.default}>
          Every destructive action saves a snapshot under{" "}
          {backupPath.length > 0 ? tildify(backupPath, home) : "(unset)"}.
        </text>
        <text fg={t.fg.muted}>
          Press 6 to open the log, then R to rewind or B to restore a backup.
        </text>
      </box>

      <box flexDirection="column" marginTop={t.space.sm}>
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          Get started
        </text>
        <text fg={t.fg.default}>
          {status.trackedCount === 0
            ? "Press 4 to triage candidates discovered in your home directory."
            : `${status.trackedCount} files already tracked. Press 5 to manage them, or 4 to find more.`}
        </text>
        <text fg={t.fg.muted}>Press ? at any time to open the keymap reference.</text>
      </box>
    </box>
  );
}
