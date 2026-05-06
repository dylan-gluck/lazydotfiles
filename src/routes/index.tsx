import { createFileRoute, useRouter } from "@tanstack/react-router";
import { TRACK_ACTOR_ID, type TrackMessage } from "../actors/track.actor";
import { useActor } from "../actors/use-actor";
import { useHomePanel } from "../controllers/home.controller";
import { StatusPanel } from "../views/panels/status-panel";
import { useDecideGroup } from "../lib/use-decide-group";

export const Route = createFileRoute("/")({
  component: Status,
});

function Status() {
  const model = useHomePanel();
  const router = useRouter();
  const track = useActor<unknown, TrackMessage>(TRACK_ACTOR_ID);
  const home = model.home;

  const decideGroup = useDecideGroup(home);

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
