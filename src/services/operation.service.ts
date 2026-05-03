import { type OperationView, parseOperationKind } from "../domain/repo";
import { err, ok, type Result } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import type { ServiceError } from "./types";

export interface OperationService {
  /** Paginated, newest-first. `limit` defaults to 50, `offset` defaults to 0. */
  list(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<Result<readonly OperationView[], ServiceError>>;
  /** Git-format unified diff for an op's `@` change. Empty string when the op has no @ change. */
  diff(opId: string): Promise<Result<string, ServiceError>>;
}

const INIT_OP_RE = /^add workspace\b|^initialize repo\b|^init\b/i;

function deriveFallbackKind(opDescription: string): "init" | "edit" {
  return INIT_OP_RE.test(opDescription) ? "init" : "edit";
}

export function createOperationService(deps: { jj: JjRepository; root: string }): OperationService {
  return {
    async list(opts) {
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;
      const ops = await deps.jj.opLog({ root: deps.root, limit: limit + offset });
      if (!ops.ok) return err({ tag: "Repository", cause: ops.error });
      const window = ops.value.slice(offset, offset + limit);

      const out: OperationView[] = [];
      for (const op of window) {
        const change = await deps.jj.logAtOp({ root: deps.root, opId: op.id });
        if (!change.ok) return err({ tag: "Repository", cause: change.error });
        if (change.value === null) {
          out.push({
            opId: op.id,
            changeId: null,
            parentOpId: op.parentId,
            kind: deriveFallbackKind(op.description),
            description: op.description,
            at: op.at,
            filesTouched: [],
          });
          continue;
        }
        const summary = await deps.jj.diffSummaryAtOp({ root: deps.root, opId: op.id });
        if (!summary.ok) return err({ tag: "Repository", cause: summary.error });
        const description = change.value.description;
        out.push({
          opId: op.id,
          changeId: change.value.id,
          parentOpId: op.parentId,
          kind: parseOperationKind(description),
          description,
          at: op.at,
          filesTouched: [...summary.value],
        });
      }
      return ok(out);
    },

    async diff(opId) {
      const change = await deps.jj.logAtOp({ root: deps.root, opId });
      if (!change.ok) return err({ tag: "Repository", cause: change.error });
      if (change.value === null) return ok("");
      const r = await deps.jj.diffAtOp({ root: deps.root, opId });
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },
  };
}
