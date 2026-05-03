import { array, type Infer, literal, object, type Schema, string, union } from "./schema";
import { DotfileKindSchema } from "./tracked-file";

export const ReasonSchema: Schema<"include" | "sibling-of" | "auto"> = union([
  literal("include"),
  literal("sibling-of"),
  literal("auto"),
]);
export type Reason = Infer<typeof ReasonSchema>;

export const CandidateStatusSchema: Schema<"pending" | "accepted" | "rejected" | "deferred"> =
  union([literal("pending"), literal("accepted"), literal("rejected"), literal("deferred")]);
export type CandidateStatus = Infer<typeof CandidateStatusSchema>;

export const DiscoveryCandidateSchema = object({
  id: string(),
  path: string(),
  kind: DotfileKindSchema,
  reason: ReasonSchema,
  siblings: array(string()),
  status: CandidateStatusSchema,
});
export type DiscoveryCandidate = Infer<typeof DiscoveryCandidateSchema>;

/** id = sha256(path). Stable across rescans for the same absolute path. */
export function candidateId(path: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(path);
  return hasher.digest("hex");
}

export interface MakeCandidateInput {
  readonly path: string;
  readonly kind: DiscoveryCandidate["kind"];
  readonly reason: Reason;
  readonly siblings?: readonly string[];
  readonly status?: CandidateStatus;
}

export function makeCandidate(input: MakeCandidateInput): DiscoveryCandidate {
  return {
    id: candidateId(input.path),
    path: input.path,
    kind: input.kind,
    reason: input.reason,
    siblings: input.siblings === undefined ? [] : [...input.siblings],
    status: input.status ?? "pending",
  };
}
