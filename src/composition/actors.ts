import { spawnConfigActor } from "../actors/config.actor";
import { spawnRepoActor } from "../actors/repo.actor";
import { type ActorRuntime, createActorRuntime } from "../actors/runtime";
import type { Services } from "./services";

export function wireActors(services: Services): ActorRuntime<Services> {
  const runtime = createActorRuntime({ services });
  spawnConfigActor(runtime);
  spawnRepoActor(runtime);
  return runtime;
}
