import { type ReactNode, useContext, useSyncExternalStore } from "react";
import { CONFIG_ACTOR_ID, type ConfigState } from "../../actors/config.actor";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoState } from "../../actors/repo.actor";
import { ActorRuntimeContext } from "../../actors/use-actor";
import { useOptionalServices } from "../../composition/services-context";
import { tildify, truncateToWidth } from "../lib/truncate-path";
import { useTheme } from "../theme";

const REPO_LABEL_MAX = 40;
const NOOP_UNSUBSCRIBE = (): void => {};

/**
 * Read an actor's state without throwing when the runtime context is absent.
 * Lets {@link AppHeader} render safely in isolated component tests that
 * don't wire the actor runtime.
 */
function useActorStateSafe<S>(id: string): S | null {
  const rt = useContext(ActorRuntimeContext);
  return useSyncExternalStore(
    (cb) => (rt === null ? NOOP_UNSUBSCRIBE : rt.get<S>(id).subscribe(() => cb())),
    () => (rt === null ? null : rt.get<S>(id).getState()),
    () => null,
  );
}

/**
 * Top-of-frame header rendered globally inside {@link AppShell}. Pulls live
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
  const branchSummary = head !== undefined ? `main @ ${head.id.slice(0, 8)}` : "main";
  const dirty = repo?.dirty ?? false;
  const queueCount = discovery?.queue.filter((c) => c.status === "pending").length ?? 0;
  const summary = queueCount > 0 ? `${queueCount} candidates` : "queue empty";
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
        <text fg={t.fg.heading}>{repoLabel}</text>
        <text fg={t.fg.subtle}>·</text>
        <text fg={t.fg.muted}>{branchSummary}</text>
      </box>
      <box flexDirection="row" gap={t.space.sm}>
        <text fg={dirty ? t.fg.danger : t.fg.success}>{dirty ? "dirty" : "clean"}</text>
        <text fg={t.fg.subtle}>·</text>
        <text fg={t.fg.muted}>{summary}</text>
      </box>
    </box>
  );
}
