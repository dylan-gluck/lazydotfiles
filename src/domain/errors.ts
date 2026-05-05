export type DomainErrorTag =
  | "DUPLICATE_TARGET"
  | "INVARIANT_VIOLATION"
  | "PARSE_ERROR"
  | "NOT_FOUND";

export interface DomainErrorDetails {
  DUPLICATE_TARGET: { target: string };
  INVARIANT_VIOLATION: { reason: string };
  PARSE_ERROR: {
    path?: string;
    issues: readonly { message: string; path?: ReadonlyArray<PropertyKey> }[];
  };
  NOT_FOUND: { resource: string; id: string };
}

export type DomainErrorOf<K extends DomainErrorTag> = { readonly tag: K } & DomainErrorDetails[K];

export class DomainError<K extends DomainErrorTag = DomainErrorTag> extends Error {
  readonly tag: K;
  readonly details: DomainErrorDetails[K];

  constructor(tag: K, details: DomainErrorDetails[K]) {
    super(`${tag}: ${JSON.stringify(details)}`);
    this.name = "DomainError";
    this.tag = tag;
    this.details = Object.freeze(details) as DomainErrorDetails[K];
  }

  toJSON(): DomainErrorOf<K> {
    return { tag: this.tag, ...this.details } as DomainErrorOf<K>;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
