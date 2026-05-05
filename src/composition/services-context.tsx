import { createContext, type ReactNode, useContext } from "react";
import type { Services } from "./services";

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider(props: { services: Services; children: ReactNode }): ReactNode {
  return (
    <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>
  );
}

export function useOptionalServices(): Services | null {
  return useContext(ServicesContext);
}
