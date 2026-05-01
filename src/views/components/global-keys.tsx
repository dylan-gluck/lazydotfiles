import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { dispatchKeymap, globalKeymap, type KeymapContext } from "../../controllers/keymap";
import { useHelpOverlay } from "./help-overlay-context";

/**
 * Mounts the global keymap. MUST be rendered inside `<RouterProvider>` so
 * `useRouter()` resolves to the live router instance.
 */
export function GlobalKeys(): null {
  const router = useRouter();
  const renderer = useRenderer();
  const help = useHelpOverlay();
  const ctx = useMemo<KeymapContext>(
    () => ({
      router,
      renderer: { destroy: () => renderer.destroy() },
      ui: { toggleHelp: help.toggle },
    }),
    [router, renderer, help],
  );
  useKeyboard((event: KeyEvent) => {
    dispatchKeymap(globalKeymap, event, ctx);
  });
  return null;
}
