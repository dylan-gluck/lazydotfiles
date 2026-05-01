import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useRenderer } from "@opentui/react";
import { useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { dispatchKeymap, globalKeymap, type KeymapContext } from "../../controllers/keymap";

export function GlobalKeys(): null {
  const router = useRouter();
  const renderer = useRenderer();
  const ctx = useMemo<KeymapContext>(
    () => ({
      router,
      renderer: { destroy: () => renderer.destroy() },
      ui: { toggleHelp: () => {} },
    }),
    [router, renderer],
  );
  useKeyboard((event: KeyEvent) => {
    dispatchKeymap(globalKeymap, event, ctx);
  });
  return null;
}
