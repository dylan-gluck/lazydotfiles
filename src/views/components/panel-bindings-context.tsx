import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

/** A single panel-scoped key hint to render in the AppShell footer. */
export interface PanelBinding {
  /** Display label for the key, e.g. "a", "A", "/", "↑/↓". */
  readonly keys: string;
  /** Short verb for the action this key triggers, e.g. "accept", "search". */
  readonly description: string;
}

interface PanelBindingsController {
  readonly bindings: readonly PanelBinding[];
  publish(bindings: readonly PanelBinding[]): void;
  clear(): void;
}

const NOOP_CTRL: PanelBindingsController = {
  bindings: [],
  publish: () => {},
  clear: () => {},
};

const PanelBindingsContext = createContext<PanelBindingsController>(NOOP_CTRL);

export function PanelBindingsProvider(props: { children: ReactNode }): ReactNode {
  const [bindings, setBindings] = useState<readonly PanelBinding[]>([]);
  const ctrl: PanelBindingsController = {
    bindings,
    publish: (b) => setBindings(b),
    clear: () => setBindings([]),
  };
  return (
    <PanelBindingsContext.Provider value={ctrl}>{props.children}</PanelBindingsContext.Provider>
  );
}

/** Read the active panel's bindings — used by the AppShell footer. */
export function useActivePanelBindings(): readonly PanelBinding[] {
  return useContext(PanelBindingsContext).bindings;
}

/**
 * Publish a panel's bindings into the AppShell footer for the lifetime of the
 * caller. Pass a stable array (memoize at the call site) to avoid spurious
 * re-publishes on each render.
 */
export function usePublishPanelBindings(bindings: readonly PanelBinding[]): void {
  const ctrl = useContext(PanelBindingsContext);
  // Track latest publish call so unmount cleanup only clears bindings we own.
  const ownedRef = useRef<readonly PanelBinding[] | null>(null);
  useEffect(() => {
    ctrl.publish(bindings);
    ownedRef.current = bindings;
    return () => {
      // Only clear if we still own the active bindings — otherwise another
      // panel mounted in our place and already overwrote them.
      if (ownedRef.current === bindings) ctrl.clear();
    };
  }, [bindings, ctrl]);
}
