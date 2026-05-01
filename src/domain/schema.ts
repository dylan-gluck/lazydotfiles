// Inline minimal subset of the Standard Schema spec (https://standardschema.dev).
// Avoids adding a runtime dep until a concrete need arrives.

export namespace StandardSchemaV1 {
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey>;
  }
  export type SuccessResult<O> = { readonly value: O; readonly issues?: undefined };
  export type FailureResult = { readonly value?: undefined; readonly issues: readonly Issue[] };
  export type Result<O> = SuccessResult<O> | FailureResult;
  export interface Props<I, O> {
    readonly version: 1;
    readonly vendor: "lazy-dotfiles";
    readonly validate: (value: unknown) => Result<O>;
    readonly types?: { readonly input: I; readonly output: O };
  }
}

export interface Schema<T> {
  readonly "~standard": StandardSchemaV1.Props<unknown, T>;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

function makeSchema<T>(validate: (value: unknown) => StandardSchemaV1.Result<T>): Schema<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "lazy-dotfiles",
      validate,
    },
  };
}

function ok<T>(value: T): StandardSchemaV1.SuccessResult<T> {
  return { value };
}

function fail(message: string, path?: ReadonlyArray<PropertyKey>): StandardSchemaV1.FailureResult {
  return { issues: path === undefined ? [{ message }] : [{ message, path }] };
}

const prefixPath = (
  issues: readonly StandardSchemaV1.Issue[],
  key: PropertyKey,
): readonly StandardSchemaV1.Issue[] =>
  issues.map((i) => ({
    message: i.message,
    path: i.path === undefined ? [key] : [key, ...i.path],
  }));

export function string(): Schema<string> {
  return makeSchema<string>((v) =>
    typeof v === "string" ? ok(v) : fail(`expected string, got ${typeof v}`),
  );
}

export function number(): Schema<number> {
  return makeSchema<number>((v) =>
    typeof v === "number" && !Number.isNaN(v) ? ok(v) : fail(`expected number, got ${typeof v}`),
  );
}

export function boolean(): Schema<boolean> {
  return makeSchema<boolean>((v) =>
    typeof v === "boolean" ? ok(v) : fail(`expected boolean, got ${typeof v}`),
  );
}

export function literal<const L extends string | number | boolean>(value: L): Schema<L> {
  return makeSchema<L>((v) =>
    v === value
      ? ok(value)
      : fail(`expected literal ${JSON.stringify(value)}, got ${JSON.stringify(v)}`),
  );
}

export function union<S extends readonly Schema<unknown>[]>(members: S): Schema<Infer<S[number]>> {
  type Out = Infer<S[number]>;
  return makeSchema<Out>((v) => {
    const allIssues: StandardSchemaV1.Issue[] = [];
    for (const m of members) {
      const r = m["~standard"].validate(v);
      if (r.issues === undefined) {
        return ok(r.value as Out);
      }
      allIssues.push(...r.issues);
    }
    return { issues: allIssues.length > 0 ? allIssues : [{ message: "no union member matched" }] };
  });
}

export function object<F extends Record<string, Schema<unknown>>>(
  fields: F,
): Schema<{ [K in keyof F]: Infer<F[K]> }> {
  type Out = { [K in keyof F]: Infer<F[K]> };
  return makeSchema<Out>((v) => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      return fail(
        `expected object, got ${v === null ? "null" : Array.isArray(v) ? "array" : typeof v}`,
      );
    }
    const source = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const issues: StandardSchemaV1.Issue[] = [];
    for (const key of Object.keys(fields)) {
      const schema = fields[key]!;
      const r = schema["~standard"].validate(source[key]);
      if (r.issues === undefined) {
        out[key] = r.value;
      } else {
        issues.push(...prefixPath(r.issues, key));
      }
    }
    return issues.length > 0 ? { issues } : ok(out as Out);
  });
}

export function array<S extends Schema<unknown>>(item: S): Schema<Infer<S>[]> {
  type Out = Infer<S>[];
  return makeSchema<Out>((v) => {
    if (!Array.isArray(v)) {
      return fail(`expected array, got ${typeof v}`);
    }
    const out: unknown[] = [];
    const issues: StandardSchemaV1.Issue[] = [];
    for (let i = 0; i < v.length; i++) {
      const r = item["~standard"].validate(v[i]);
      if (r.issues === undefined) {
        out.push(r.value);
      } else {
        issues.push(...prefixPath(r.issues, i));
      }
    }
    return issues.length > 0 ? { issues } : ok(out as Out);
  });
}

export function optional<S extends Schema<unknown>>(inner: S): Schema<Infer<S> | undefined> {
  type Out = Infer<S> | undefined;
  return makeSchema<Out>((v) => {
    if (v === undefined) return ok(undefined as Out);
    const r = inner["~standard"].validate(v);
    return r.issues === undefined ? ok(r.value as Out) : { issues: r.issues };
  });
}
