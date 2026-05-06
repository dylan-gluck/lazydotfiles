import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { CONFIG_ACTOR_ID, type ConfigState } from "../../actors/config.actor";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoState } from "../../actors/repo.actor";
import { useActorStateSafe } from "../../actors/use-actor";
import { useOptionalServices } from "../../composition/services-context";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const REPO_LABEL_MAX = 40;
const HASH_LENGTH = 8;

/**
 * Top-of-frame header rendered globally inside {@link AppShell}. v2 layout:
 *
 *   ~/dotfiles  ·  main @ <short-hash>            <n> tracked · <m> untracked
 *
 * Counts reflect repo-wide totals, not the current view's filter. Pulls live
 * state from the repo / config / discovery actors so it works on every route
 * with no per-route wiring. Falls back to neutral placeholders when actor
 * state is unavailable.
 */
export function AppHeader(): ReactNode {
  const t = useTheme();
  const services = useOptionalServices();
  const repo = useActorStateSafe<RepoState>(REPO_ACTOR_ID);
  const discovery = useActorStateSafe<DiscoveryState>(DISCOVERY_ACTOR_ID);
  const config = useActorStateSafe<ConfigState>(CONFIG_ACTOR_ID);

  const configHome = config?.config?.path.home ?? null;
  const home = configHome ?? services?.home ?? "";
  const repoRoot =
    services !== null && services.home !== ""
      ? `${services.home}/dotfiles`
      : configHome !== null
        ? `${configHome}/dotfiles`
        : "~/dotfiles";

  const head = repo?.operations[0];
  const branchSummary = head !== undefined ? `main @ ${head.id.slice(0, HASH_LENGTH)}` : "main";
  const trackedCount = repo?.tracked.length ?? 0;
  const untrackedCount = discovery?.queue.filter((c) => c.status === "pending").length ?? 0;
  const repoLabel = truncateToWidth(tildify(repoRoot, home), REPO_LABEL_MAX);

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
        <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
          {repoLabel}
        </text>
        <text fg={t.fg.subtle}>·</text>
        <text fg={t.fg.muted}>{branchSummary}</text>
      </box>
      <box flexDirection="row" gap={t.space.sm}>
        <text fg={t.fg.muted}>{`${trackedCount} tracked`}</text>
        <text fg={t.fg.subtle}>·</text>
        <text fg={t.fg.muted}>{`${untrackedCount} untracked`}</text>
      </box>
    </box>
  );
}
