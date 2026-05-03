import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

export interface HelpOverlayController {
  readonly open: boolean;
  toggle(): void;
  close(): void;
}

const NOOP_CTRL: HelpOverlayController = {
  open: false,
  toggle: () => {},
  close: () => {},
};

export const HelpOverlayContext = createContext<HelpOverlayController>(NOOP_CTRL);

export function HelpOverlayProvider(props: { children: ReactNode }): ReactNode {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <HelpOverlayContext.Provider value={{ open, toggle, close }}>
      {props.children}
    </HelpOverlayContext.Provider>
  );
}

export function useHelpOverlay(): HelpOverlayController {
  return useContext(HelpOverlayContext);
}
