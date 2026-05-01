import { spawnConfigActor } from "../actors/config.actor";
import { type ActorRuntime, createActorRuntime } from "../actors/runtime";
import type { Services } from "./services";

export function wireActors(services: Services): ActorRuntime<Services> {
  const runtime = createActorRuntime({ services });
  spawnConfigActor(runtime);
  return runtime;
}
