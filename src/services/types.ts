import type { StandardSchemaV1 } from "../domain/schema";
import type { RepoError } from "../repositories/types";

export type TrackStep =
  // shared
  | "validate"
  | "snapshot"
  | "describe"
  | "record"
  // add-only
  | "move"
  | "symlink"
  // remove-only
  | "unlink-symlink"
  | "materialize"
  | "unlink-source";

export type ServiceError =
  | { readonly tag: "NotFound"; readonly resource: string; readonly id: string }
  | { readonly tag: "Validation"; readonly issues: readonly StandardSchemaV1.Issue[] }
  | { readonly tag: "Repository"; readonly cause: RepoError }
  | {
      readonly tag: "InvalidTarget";
      readonly reason: "missing" | "already-symlinked" | "under-dotfiles" | "not-tracked-symlink";
      readonly path: string;
    }
  | {
      readonly tag: "Rollback";
      readonly failedStep: TrackStep;
      readonly original: ServiceError;
      readonly rollbackErrors: readonly ServiceError[];
    };
