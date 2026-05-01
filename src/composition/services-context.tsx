import { createContext, type ReactNode, useContext } from "react";
import type { Services } from "./services";

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider(props: { services: Services; children: ReactNode }): ReactNode {
  return (
    <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (s === null) throw new Error("ServicesProvider missing");
  return s;
}

export function useOptionalServices(): Services | null {
  return useContext(ServicesContext);
}
