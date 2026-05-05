import type { Operation, SyncState } from "../domain/repo";
import type { TrackedFile } from "../domain/tracked-file";
import { err, ok, type Result } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import type { TrackedFileRepository } from "../repositories/tracked-file.repository";
import type { ServiceError } from "./types";

export interface RepoService {
  head(): Promise<Result<Operation, ServiceError>>;
  operations(opts?: { limit?: number }): Promise<Result<readonly Operation[], ServiceError>>;
  syncState(): Promise<Result<SyncState, ServiceError>>;
  dirty(): Promise<Result<boolean, ServiceError>>;
  restoreOp(id: string): Promise<Result<void, ServiceError>>;
  trackedFiles(): Promise<Result<readonly TrackedFile[], ServiceError>>;
  /**
   * Idempotently configure the dotfiles repo's `origin` remote (or the named
   * one). Adds when missing, sets URL otherwise.
   */
  setRemote(opts: {
    root?: string;
    url: string;
    name?: string;
  }): Promise<Result<void, ServiceError>>;
}

export function createRepoService(deps: {
  jj: JjRepository;
  tracked: TrackedFileRepository;
  root: string;
}): RepoService {
  return {
    async head() {
      const r = await deps.jj.opLog({ root: deps.root, limit: 1 });
      if (!r.ok) return err({ tag: "Repository", cause: r.error });
      const first = r.value[0];
      if (first === undefined) {
        return err({ tag: "NotFound", resource: "Operation", id: "@" });
      }
      return ok(first);
    },

    async operations(opts) {
      const r = await deps.jj.opLog({ root: deps.root, limit: opts?.limit });
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },

    async syncState() {
      const r = await deps.jj.status({ root: deps.root });
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },

    async dirty() {
      const r = await deps.jj.status({ root: deps.root });
      return r.ok ? ok(r.value.dirty) : err({ tag: "Repository", cause: r.error });
    },

    async restoreOp(id) {
      const r = await deps.jj.opRestore({ root: deps.root, opId: id });
      return r.ok ? ok(undefined) : err({ tag: "Repository", cause: r.error });
    },

    async trackedFiles() {
      const r = await deps.tracked.list();
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },

    async setRemote({ root, url, name }) {
      const r = await deps.jj.gitRemoteSet({ root: root ?? deps.root, url, name });
      return r.ok ? ok(undefined) : err({ tag: "Repository", cause: r.error });
    },
  };
}
