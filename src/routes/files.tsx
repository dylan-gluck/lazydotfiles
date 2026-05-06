import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryMessage } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useFilesPanel } from "../controllers/files.controller";
import { FilesPanel } from "../views/panels/files-panel";
import { useDecideGroup } from "../lib/use-decide-group";

export const Route = createFileRoute("/files")({ component: Files });

function Files() {
  const model = useFilesPanel();
  const router = useRouter();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  const discovery = useActor<unknown, DiscoveryMessage>(DISCOVERY_ACTOR_ID);
  const home = model.home;

  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
  }, []);

  const decideGroup = useDecideGroup(home);

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
