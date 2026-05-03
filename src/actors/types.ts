export type Message<K extends string = string, P = unknown> = {
  readonly kind: K;
  readonly payload: P;
};

export type Event<K extends string = string, P = unknown> = {
  readonly kind: K;
  readonly payload: P;
};

export type Effect<M extends Message, Services> = (services: Services) => Promise<M | null>;

export type Reducer<S, M extends Message, E extends Event, Services> = (
  state: S,
  msg: M,
) => { state: S; events: E[]; effects: Effect<M, Services>[] };

export interface Actor<S, M extends Message, E extends Event> {
  readonly id: string;
  send(msg: M): void;
  subscribe(listener: (state: S, event: E | null) => void): () => void;
  getState(): S;
}
