import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryMessage } from "../actors/discovery.actor";
import { TRACK_ACTOR_ID, type TrackMessage } from "../actors/track.actor";
import { useActor, useActorStateSafe } from "../actors/use-actor";
import type { DiscoveryState } from "../actors/discovery.actor";
import { useHomePanel } from "../controllers/home.controller";
import { StatusPanel } from "../views/panels/status-panel";

export const Route = createFileRoute("/")({
  component: Status,
});

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

function Status() {
  const model = useHomePanel();
  const router = useRouter();
  const track = useActor<unknown, TrackMessage>(TRACK_ACTOR_ID);
  const discovery = useActor<unknown, DiscoveryMessage>(DISCOVERY_ACTOR_ID);
  const discoveryState = useActorStateSafe<DiscoveryState>(DISCOVERY_ACTOR_ID);
  const home = model.home;

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
    <StatusPanel
      model={model}
      onViewLog={() => {
        void router.navigate({ to: "/logs" });
      }}
      onOpenFiles={() => {
        void router.navigate({ to: "/files" });
      }}
      onUntrack={(target) => track.send({ kind: "remove", payload: { path: target } })}
      onTrackGroup={(segment) => decideGroup(segment, "accept")}
      onIgnoreGroup={(segment) => decideGroup(segment, "defer")}
    />
  );
}
