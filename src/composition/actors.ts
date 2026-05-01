import { spawnConfigActor } from "../actors/config.actor";
import { spawnDiscoveryActor } from "../actors/discovery.actor";
import { spawnRepoActor } from "../actors/repo.actor";
import { spawnSyncActor } from "../actors/sync.actor";
import { spawnTrackActor } from "../actors/track.actor";
import { type ActorRuntime, createActorRuntime } from "../actors/runtime";
import type { Services } from "./services";

export function wireActors(services: Services): ActorRuntime<Services> {
  const runtime = createActorRuntime({ services });
  spawnConfigActor(runtime);
  spawnRepoActor(runtime);
  spawnDiscoveryActor(runtime);
  spawnTrackActor(runtime);
  spawnSyncActor(runtime);
  return runtime;
}
