import type { StandardSchemaV1 } from "../domain/schema";
import type { RepoError } from "../repositories/types";

export type ServiceError =
  | { readonly tag: "NotFound"; readonly resource: string; readonly id: string }
  | { readonly tag: "Validation"; readonly issues: readonly StandardSchemaV1.Issue[] }
  | { readonly tag: "Repository"; readonly cause: RepoError };
