import type { KeyEvent } from "@opentui/core";
import type { useRouter } from "@tanstack/react-router";

export interface KeymapContext {
  readonly router: ReturnType<typeof useRouter>;
  readonly renderer: { destroy(): void };
  readonly ui: { toggleHelp(): void };
  readonly actions: {
    sync(): void;
    fetch(): void;
    push(): void;
    rescan(): void;
  };
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

/**
 * Global keymap for v2 chrome. View nav is keyboard-only:
 *
 *   1 → status (`/`)   2 → files (`/files`)   3 → logs (`/logs`)
 *
 * Verb commands (s/f/p/r) are global so they execute from any view; panels
 * still publish them in the footer where relevant.
 */
export const globalKeymap: readonly Binding[] = [
  {
    keys: ["1"],
    description: "status",
    when: whenIdle,
    run: ({ router }) => {
      void router.navigate({ to: "/" });
    },
  },
  {
    keys: ["2"],
    description: "files",
    when: whenIdle,
    run: ({ router }) => {
      void router.navigate({ to: "/files" });
    },
  },
  {
    keys: ["3"],
    description: "logs",
    when: whenIdle,
    run: ({ router }) => {
      void router.navigate({ to: "/logs" });
    },
  },
  {
    keys: ["s"],
    description: "sync",
    when: whenIdle,
    run: ({ actions }) => actions.sync(),
  },
  {
    keys: ["f"],
    description: "fetch",
    when: whenIdle,
    run: ({ actions }) => actions.fetch(),
  },
  {
    keys: ["p"],
    description: "push",
    when: whenIdle,
    run: ({ actions }) => actions.push(),
  },
  {
    keys: ["r"],
    description: "rescan",
    when: whenIdle,
    run: ({ actions }) => actions.rescan(),
  },
  {
    keys: ["?"],
    description: "help",
    when: whenIdle,
    run: ({ ui }) => ui.toggleHelp(),
  },
  {
    keys: ["q"],
    description: "quit",
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
