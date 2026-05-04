import type { KeyEvent } from "@opentui/core";
import type { useRouter } from "@tanstack/react-router";

export interface KeymapContext {
  readonly router: ReturnType<typeof useRouter>;
  readonly renderer: { destroy(): void };
  readonly ui: { toggleHelp(): void };
  /** True when a panel is actively consuming text input (editor, draft, …). */
  readonly inputActive: boolean;
}

export interface Binding {
  readonly keys: readonly string[];
  readonly description: string;
  readonly when?: (ctx: KeymapContext) => boolean;
  readonly run: (ctx: KeymapContext) => void;
}

const whenIdle = (ctx: KeymapContext): boolean => !ctx.inputActive;

export const globalKeymap: readonly Binding[] = [
  {
    keys: ["1"],
    description: "Home",
    when: whenIdle,
    run: ({ router }) => {
      void router.navigate({ to: "/" });
    },
  },
  {
    keys: ["2"],
    description: "Discover",
    when: whenIdle,
    run: ({ router }) => {
      void router.navigate({ to: "/discover" });
    },
  },
  {
    keys: ["3"],
    description: "Log",
    when: whenIdle,
    run: ({ router }) => {
      void router.navigate({ to: "/log" });
    },
  },
  {
    keys: ["?"],
    description: "Help",
    when: whenIdle,
    run: ({ ui }) => ui.toggleHelp(),
  },
  {
    keys: ["q"],
    description: "Quit",
    when: whenIdle,
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
