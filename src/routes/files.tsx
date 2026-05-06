import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useFilesPanel } from "../controllers/files.controller";
import { FilesPanel } from "../views/panels/files-panel";

export const Route = createFileRoute("/files")({ component: Files });

function Files() {
  const model = useFilesPanel();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <FilesPanel model={model} />;
}
