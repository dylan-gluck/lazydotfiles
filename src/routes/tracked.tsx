import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useTrackedPanel } from "../controllers/track.controller";
import { TrackedPanel } from "../views/panels/tracked-panel";

export const Route = createFileRoute("/tracked")({ component: Tracked });

function Tracked() {
  const model = useTrackedPanel();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // mount-only refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <TrackedPanel model={model} />;
}
