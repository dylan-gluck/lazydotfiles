import { createContext, type ReactNode, useContext } from "react";
import { dark, light, type Tokens } from "./tokens";

const ThemeContext = createContext<Tokens>(dark);

export function ThemeProvider(props: { mode?: "dark" | "light"; children: ReactNode }): ReactNode {
  const tokens = props.mode === "light" ? light : dark;
  return <ThemeContext.Provider value={tokens}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): Tokens {
  return useContext(ThemeContext);
}
