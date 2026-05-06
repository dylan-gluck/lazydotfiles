import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryMessage, type DiscoveryState } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor, useActorStateSafe } from "../actors/use-actor";
import { useFilesPanel } from "../controllers/files.controller";
import { FilesPanel } from "../views/panels/files-panel";

export const Route = createFileRoute("/files")({ component: Files });

function topSegment(absPath: string, home: string): string | null {
  if (home.length > 0 && absPath.startsWith(`${home}/`)) {
    const rest = absPath.slice(home.length + 1);
    const slash = rest.indexOf("/");
    return slash === -1 ? rest : rest.slice(0, slash);
  }
  const cleaned = absPath.startsWith("/") ? absPath.slice(1) : absPath;
  const slash = cleaned.indexOf("/");
  return slash === -1 ? (cleaned.length > 0 ? cleaned : null) : cleaned.slice(0, slash);
}

function Files() {
  const model = useFilesPanel();
  const router = useRouter();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  const discovery = useActor<unknown, DiscoveryMessage>(DISCOVERY_ACTOR_ID);
  const discoveryState = useActorStateSafe<DiscoveryState>(DISCOVERY_ACTOR_ID);
  const home = model.home;

  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decideGroup = useCallback(
    (segment: string, decision: "accept" | "defer") => {
      if (discoveryState === null) return;
      for (const c of discoveryState.queue) {
        if (c.status !== "pending") continue;
        if (topSegment(c.path, home) !== segment) continue;
        discovery.send({ kind: decision, payload: { id: c.id } });
      }
    },
    [discovery, discoveryState, home],
  );

  return (
    <FilesPanel
      model={model}
      onViewLog={() => {
        void router.navigate({ to: "/logs" });
      }}
      onTrackGroup={(segment) => decideGroup(segment, "accept")}
      onIgnoreGroup={(segment) => decideGroup(segment, "defer")}
      onExpandGroup={(segment) => {
        const root = home.length > 0 ? `${home}/${segment}` : segment;
        discovery.send({ kind: "expand", payload: { path: root } });
      }}
    />
  );
}
