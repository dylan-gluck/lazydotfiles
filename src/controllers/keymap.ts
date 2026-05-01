import type { KeyEvent } from "@opentui/core";
import type { useRouter } from "@tanstack/react-router";

export interface KeymapContext {
  readonly router: ReturnType<typeof useRouter>;
  readonly renderer: { destroy(): void };
  readonly ui: { toggleHelp(): void };
}

export interface Binding {
  readonly keys: readonly string[];
  readonly description: string;
  readonly when?: (ctx: KeymapContext) => boolean;
  readonly run: (ctx: KeymapContext) => void;
}

export const globalKeymap: readonly Binding[] = [
  {
    keys: ["1"],
    description: "Status",
    run: ({ router }) => {
      void router.navigate({ to: "/" });
    },
  },
  {
    keys: ["2"],
    description: "About",
    run: ({ router }) => {
      void router.navigate({ to: "/about" });
    },
  },
  {
    keys: ["3"],
    description: "Settings",
    run: ({ router }) => {
      void router.navigate({ to: "/settings" });
    },
  },
  {
    keys: ["4"],
    description: "Discover",
    run: ({ router }) => {
      void router.navigate({ to: "/discover" });
    },
  },
  {
    keys: ["?"],
    description: "Help",
    run: ({ ui }) => ui.toggleHelp(),
  },
  {
    keys: ["q"],
    description: "Quit",
    run: ({ renderer }) => renderer.destroy(),
  },
];

export function dispatchKeymap(
  table: readonly Binding[],
  event: KeyEvent,
  ctx: KeymapContext,
): boolean {
  for (const b of table) {
    if (!b.keys.includes(event.name)) continue;
    if (b.when !== undefined && !b.when(ctx)) continue;
    b.run(ctx);
    return true;
  }
  return false;
}
