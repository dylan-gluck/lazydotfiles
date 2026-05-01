import { type Infer, literal, object, type Schema, string, union } from "./schema";

export const DotfileKindSchema: Schema<"file" | "directory" | "template"> = union([
  literal("file"),
  literal("directory"),
  literal("template"),
]);
export type DotfileKind = Infer<typeof DotfileKindSchema>;

export const TrackedStatusSchema: Schema<"tracked" | "untracked"> = union([
  literal("tracked"),
  literal("untracked"),
]);
export type TrackedStatus = Infer<typeof TrackedStatusSchema>;

export const TrackedFileSchema = object({
  id: string(),
  source: string(),
  target: string(),
  kind: DotfileKindSchema,
  addedAt: string(),
  status: TrackedStatusSchema,
});
export type TrackedFile = Infer<typeof TrackedFileSchema>;

/** Compute the canonical id for a target path via sha256(target). */
export function trackedFileId(target: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(target);
  return hasher.digest("hex");
}

export interface MakeTrackedFileInput {
  readonly source: string;
  readonly target: string;
  readonly kind: DotfileKind;
  readonly addedAt: string;
  readonly status?: TrackedStatus;
}

/** Construct a TrackedFile with `id = sha256(target)`. */
export function makeTrackedFile(input: MakeTrackedFileInput): TrackedFile {
  return {
    id: trackedFileId(input.target),
    source: input.source,
    target: input.target,
    kind: input.kind,
    addedAt: input.addedAt,
    status: input.status ?? "tracked",
  };
}
