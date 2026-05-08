import { useCallback } from "react";
import {
  DISCOVERY_ACTOR_ID,
  type DiscoveryMessage,
  type DiscoveryState,
} from "../actors/discovery.actor";
import { useActor, useActorStateSafe } from "../actors/use-actor";
import { topSegment } from "./path";

export type GroupDecision = "accept" | "defer";

/**
 * Bulk-decide every pending candidate whose path falls under a top-level
 * segment (e.g. ".config"). Used by the status route's flat group rows.
 */
export function useDecideGroup(home: string): (segment: string, decision: GroupDecision) => void {
  const discovery = useActor<unknown, DiscoveryMessage>(DISCOVERY_ACTOR_ID);
  const discoveryState = useActorStateSafe<DiscoveryState>(DISCOVERY_ACTOR_ID);
  return useCallback(
    (segment, decision) => {
      if (discoveryState === null) return;
      for (const c of discoveryState.queue) {
        if (c.status !== "pending") continue;
        if (topSegment(c.path, home) !== segment) continue;
        discovery.send({ kind: decision, payload: { id: c.id } });
      }
    },
    [discovery, discoveryState, home],
  );
}

/**
 * Bulk-decide every pending candidate at or under an absolute path. Use the
 * absolute file path for a single-leaf decision, or an absolute directory path
 * to fan out across the subtree. Used by the files route's tree view.
 */
export function useDecidePath(): (absPath: string, decision: GroupDecision) => void {
  const discovery = useActor<unknown, DiscoveryMessage>(DISCOVERY_ACTOR_ID);
  const discoveryState = useActorStateSafe<DiscoveryState>(DISCOVERY_ACTOR_ID);
  return useCallback(
    (absPath, decision) => {
      if (discoveryState === null) return;
      const prefix = `${absPath}/`;
      for (const c of discoveryState.queue) {
        if (c.status !== "pending") continue;
        if (c.path !== absPath && !c.path.startsWith(prefix)) continue;
        discovery.send({ kind: decision, payload: { id: c.id } });
      }
    },
    [discovery, discoveryState],
  );
}
