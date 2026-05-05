import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/**
 * Tracks whether some panel is currently in a text-input mode so the global
 * keymap can suppress disruptive bindings (q quits, digit-nav, …) instead of
 * eating keystrokes from under an editor.
 */
export interface InputFocusController {
  readonly active: boolean;
  setActive(active: boolean): void;
}

const NOOP_CTRL: InputFocusController = {
  active: false,
  setActive: () => {},
};

const InputFocusContext = createContext<InputFocusController>(NOOP_CTRL);

export function InputFocusProvider(props: { children: ReactNode }): ReactNode {
  const [active, setActive] = useState(false);
  return (
    <InputFocusContext.Provider value={{ active, setActive }}>
      {props.children}
    </InputFocusContext.Provider>
  );
}

export function useInputFocus(): InputFocusController {
  return useContext(InputFocusContext);
}

/**
 * Mark the surrounding panel as input-focused while `active` is true. Cleans
 * up on unmount or when `active` flips to false.
 */
export function useInputFocusEffect(active: boolean): void {
  const ctrl = useInputFocus();
  useEffect(() => {
    if (!active) return;
    ctrl.setActive(true);
    return () => ctrl.setActive(false);
  }, [active, ctrl]);
}
