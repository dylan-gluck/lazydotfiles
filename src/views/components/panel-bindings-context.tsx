import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";

/** A single panel-scoped key hint. */
export interface PanelBinding {
  /** Display label for the key, e.g. "a", "A", "/", "↑/↓". */
  readonly keys: string;
  /** Short verb for the action this key triggers, e.g. "accept", "search". */
  readonly description: string;
}

interface PanelBindingsController {
  /** Bindings shown in the footer center slot. Keep short. */
  readonly bindings: readonly PanelBinding[];
  /** Extra context-aware bindings shown only in the `?` drawer. */
  readonly extras: readonly PanelBinding[];
  readonly label: string | null;
  publishBindings(b: readonly PanelBinding[]): void;
  clearBindings(): void;
  publishExtras(b: readonly PanelBinding[]): void;
  clearExtras(): void;
  publishLabel(l: string): void;
  clearLabel(): void;
}

const NOOP_CTRL: PanelBindingsController = {
  bindings: [],
  extras: [],
  label: null,
  publishBindings: () => {},
  clearBindings: () => {},
  publishExtras: () => {},
  clearExtras: () => {},
  publishLabel: () => {},
  clearLabel: () => {},
};

const PanelBindingsContext = createContext<PanelBindingsController>(NOOP_CTRL);

export function PanelBindingsProvider(props: { children: ReactNode }): ReactNode {
  const [bindings, setBindings] = useState<readonly PanelBinding[]>([]);
  const [extras, setExtras] = useState<readonly PanelBinding[]>([]);
  const [label, setLabel] = useState<string | null>(null);
  const ctrl: PanelBindingsController = {
    bindings,
    extras,
    label,
    publishBindings: setBindings,
    clearBindings: () => setBindings([]),
    publishExtras: setExtras,
    clearExtras: () => setExtras([]),
    publishLabel: setLabel,
    clearLabel: () => setLabel(null),
  };
  return (
    <PanelBindingsContext.Provider value={ctrl}>{props.children}</PanelBindingsContext.Provider>
  );
}

/** Footer reads. */
export function useActivePanelBindings(): readonly PanelBinding[] {
  return useContext(PanelBindingsContext).bindings;
}

/** Help drawer reads. */
export function useActivePanelExtras(): readonly PanelBinding[] {
  return useContext(PanelBindingsContext).extras;
}

/** Footer chip label. */
export function useActivePanelLabel(): string | null {
  return useContext(PanelBindingsContext).label;
}

/**
 * Publish a panel's footer bindings for its lifetime. Pass a stable array
 * (memoize at the call site) to avoid spurious re-publishes on each render.
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
 * Publish a panel's help-drawer-only extras for its lifetime. Same ownership
 * semantics as bindings. Stable arrays only.
 */
export function usePublishPanelExtras(extras: readonly PanelBinding[]): void {
  const ctrl = useContext(PanelBindingsContext);
  const ownedRef = useRef<readonly PanelBinding[] | null>(null);
  useEffect(() => {
    ctrl.publishExtras(extras);
    ownedRef.current = extras;
    return () => {
      if (ownedRef.current === extras) ctrl.clearExtras();
    };
  }, [extras, ctrl]);
}

/** Publish the chip label for the panel's lifetime. */
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
