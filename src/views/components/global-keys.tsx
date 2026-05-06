import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryMessage } from "../../actors/discovery.actor";
import { SYNC_ACTOR_ID, type SyncMessage } from "../../actors/sync.actor";
import { useActor } from "../../actors/use-actor";
import { dispatchKeymap, globalKeymap, type KeymapContext } from "../../controllers/keymap";
import { useHelpOverlay } from "./help-overlay-context";
import { useInputFocus } from "./input-focus-context";

/**
 * Mounts the global keymap. MUST be rendered inside `<RouterProvider>` so
 * `useRouter()` resolves to the live router instance.
 */
export function GlobalKeys(): null {
  const router = useRouter();
  const renderer = useRenderer();
  const help = useHelpOverlay();
  const inputFocus = useInputFocus();
  const sync = useActor<unknown, SyncMessage>(SYNC_ACTOR_ID);
  const discovery = useActor<unknown, DiscoveryMessage>(DISCOVERY_ACTOR_ID);
  const ctx = useMemo<KeymapContext>(
    () => ({
      router,
      renderer: { destroy: () => renderer.destroy() },
      ui: { toggleHelp: help.toggle },
      actions: {
        sync: () => sync.send({ kind: "runSync", payload: undefined }),
        fetch: () => sync.send({ kind: "runFetch", payload: undefined }),
        push: () => sync.send({ kind: "runPush", payload: undefined }),
        rescan: () => discovery.send({ kind: "rescan", payload: undefined }),
      },
      inputActive: inputFocus.active,
    }),
    [router, renderer, help, sync, discovery, inputFocus.active],
  );
  useKeyboard((event: KeyEvent) => {
    dispatchKeymap(globalKeymap, event, ctx);
  });
  return null;
}
