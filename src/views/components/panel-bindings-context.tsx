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
  readonly label: string | null;
  publishBindings(b: readonly PanelBinding[]): void;
  clearBindings(): void;
  publishLabel(l: string): void;
  clearLabel(): void;
}

const NOOP_CTRL: PanelBindingsController = {
  bindings: [],
  label: null,
  publishBindings: () => {},
  clearBindings: () => {},
  publishLabel: () => {},
  clearLabel: () => {},
};

const PanelBindingsContext = createContext<PanelBindingsController>(NOOP_CTRL);

export function PanelBindingsProvider(props: { children: ReactNode }): ReactNode {
  const [bindings, setBindings] = useState<readonly PanelBinding[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const ctrl: PanelBindingsController = {
    bindings,
    label,
    publishBindings: setBindings,
    clearBindings: () => setBindings([]),
    publishLabel: setLabel,
    clearLabel: () => setLabel(null),
  };
  return (
    <PanelBindingsContext.Provider value={ctrl}>{props.children}</PanelBindingsContext.Provider>
  );
}

/** Read the active panel's bindings — used by the AppShell footer. */
export function useActivePanelBindings(): readonly PanelBinding[] {
  return useContext(PanelBindingsContext).bindings;
}

/** Read the active panel's chip label — used by the AppShell footer. */
export function useActivePanelLabel(): string | null {
  return useContext(PanelBindingsContext).label;
}

/**
 * Publish a panel's bindings into the AppShell footer for the lifetime of the
 * caller. Pass a stable array (memoize at the call site) to avoid spurious
 * re-publishes on each render.
 */
export function usePublishPanelBindings(bindings: readonly PanelBinding[]): void {
  const ctrl = useContext(PanelBindingsContext);
  const ownedRef = useRef<readonly PanelBinding[] | null>(null);
  useEffect(() => {
    ctrl.publishBindings(bindings);
    ownedRef.current = bindings;
    return () => {
      if (ownedRef.current === bindings) ctrl.clearBindings();
    };
  }, [bindings, ctrl]);
}

/**
 * Publish the panel's chip label (e.g. "discover", "tracked") into the
 * AppShell footer. Same ownership semantics as bindings.
 */
export function usePublishPanelLabel(label: string): void {
  const ctrl = useContext(PanelBindingsContext);
  const ownedRef = useRef<string | null>(null);
  useEffect(() => {
    ctrl.publishLabel(label);
    ownedRef.current = label;
    return () => {
      if (ownedRef.current === label) ctrl.clearLabel();
    };
  }, [label, ctrl]);
}
