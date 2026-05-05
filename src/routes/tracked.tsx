import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { CONFIG_ACTOR_ID, type ConfigState } from "../actors/config.actor";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useTrackedPanel } from "../controllers/track.controller";
import { TrackedPanel } from "../views/panels/tracked-panel";

export const Route = createFileRoute("/tracked")({ component: Tracked });

function Tracked() {
  const model = useTrackedPanel();
  const router = useRouter();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  const config = useActor<ConfigState>(CONFIG_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // mount-only refresh
  }, []);
  const onViewLog = useCallback(
    (file: string) => {
      void router.navigate({ to: "/log", search: { file } });
    },
    [router],
  );
  return (
    <TrackedPanel
      model={model}
      backupRoot={config.state.config?.path.backup}
      home={config.state.config?.path.home}
      onViewLog={onViewLog}
    />
  );
}
