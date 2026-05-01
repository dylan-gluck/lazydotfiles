import {
  array,
  boolean,
  type Infer,
  literal,
  number,
  object,
  type Schema,
  string,
  union,
} from "./schema";

export const OperationKindSchema: Schema<"init" | "track" | "untrack" | "edit" | "sync"> = union([
  literal("init"),
  literal("track"),
  literal("untrack"),
  literal("edit"),
  literal("sync"),
]);
export type OperationKind = Infer<typeof OperationKindSchema>;
// `literal(null)` doesn't work in our schema (`null` is not a `string|number|boolean`).
// Inline a string-or-null combinator so optional fields stay typed honestly.
const nullableString = (): Schema<string | null> => ({
  "~standard": {
    version: 1,
    vendor: "lazy-dotfiles",
    validate: (v) => {
      if (v === null) return { value: null };
      if (typeof v === "string") return { value: v };
      return {
        issues: [
          { message: `expected string or null, got ${v === undefined ? "undefined" : typeof v}` },
        ],
      };
    },
  },
});

export const OperationSchema = object({
  id: string(),
  parentId: nullableString(),
  kind: OperationKindSchema,
  description: string(),
  at: string(),
  filesTouched: array(string()),
});
export type Operation = Infer<typeof OperationSchema>;

/**
 * Unified projection of `jj op log` enriched with the change at `@` as of that op.
 * `opId` is what `jj op restore` accepts; `changeId` is the short change id (or null
 * for ops with no `@` change, like `add workspace`).
 */
export const OperationViewSchema = object({
  opId: string(),
  changeId: nullableString(),
  parentOpId: nullableString(),
  kind: OperationKindSchema,
  description: string(),
  at: string(),
  filesTouched: array(string()),
});
export type OperationView = Infer<typeof OperationViewSchema>;

export const SyncStateSchema = object({
  lastSyncAt: nullableString(),
  ahead: number(),
  behind: number(),
  dirty: boolean(),
  remote: nullableString(),
});
export type SyncState = Infer<typeof SyncStateSchema>;

export const RepoSchema = object({
  root: string(),
  vcs: literal("jj"),
  head: OperationSchema,
});
export type Repo = Infer<typeof RepoSchema>;

/**
 * Map a `jj describe` message prefix to a canonical `OperationKind`.
 * Pure; total over `string`. Unknown prefixes collapse to `"edit"`.
 */
export function parseOperationKind(description: string): OperationKind {
  const trimmed = description.trimStart();
  if (trimmed.startsWith("track ") || trimmed === "track") return "track";
  if (trimmed.startsWith("untrack ") || trimmed === "untrack") return "untrack";
  if (trimmed === "sync" || trimmed.startsWith("sync ")) return "sync";
  if (trimmed === "init" || trimmed.startsWith("init ")) return "init";
  return "edit";
}
