// Service container. Empty in the Foundation phase; later phases register concrete services here.
export interface Services {
  readonly home: string;
}

export function wireServices(deps: { home: string }): Services {
  return { home: deps.home };
}
