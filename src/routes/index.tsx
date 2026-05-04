import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useHomePanel } from "../controllers/home.controller";
import { HomePanel } from "../views/panels/home-panel";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const model = useHomePanel();
  const router = useRouter();
  return (
    <HomePanel
      model={model}
      onViewLog={(target) => {
        if (target.length > 0) {
          void router.navigate({ to: "/log", search: { file: target } });
        } else {
          void router.navigate({ to: "/log" });
        }
      }}
      onOpenDiscover={() => {
        void router.navigate({ to: "/discover" });
      }}
      onOpenSync={() => {
        void router.navigate({ to: "/sync" });
      }}
    />
  );
}
