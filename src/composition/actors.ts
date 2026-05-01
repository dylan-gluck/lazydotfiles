import { createActorRuntime, type ActorRuntime } from "../actors/runtime";
import type { Services } from "./services";

export function wireActors(services: Services): ActorRuntime<Services> {
  return createActorRuntime({ services });
}
