import { join } from "node:path";
import type { ConflictDescriptor, SyncState } from "../domain/repo";
import { err, ok, type Result } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import { pickConflictSide } from "./sync.conflict-markers";
import type { EditorRunner } from "./sync.editor";
import type { ServiceError } from "./types";

export type ResolveChoice = "ours" | "theirs" | "edit";

export interface SyncOutcome {
  readonly state: SyncState;
  readonly conflicts: readonly ConflictDescriptor[];
}

export interface SyncService {
  state(): Promise<Result<SyncState, ServiceError>>;
  fetch(): Promise<Result<SyncOutcome, ServiceError>>;
  push(): Promise<Result<SyncOutcome, ServiceError>>;
  /** fetch-then-push; aborts push if fetch fails. */
  sync(): Promise<Result<SyncOutcome, ServiceError>>;
  resolve(opts: {
    path: string;
    choice: ResolveChoice;
  }): Promise<Result<SyncOutcome, ServiceError>>;
}

export interface SyncServiceDeps {
  readonly jj: JjRepository;
  readonly root: string;
  readonly editor: EditorRunner;
  readonly now?: () => Date;
}

function repoErr(cause: Parameters<typeof err>[0] extends infer _ ? unknown : never): ServiceError {
  // Helper to build a ServiceError.Repository from a RepoError cause.
  // Typed via the call sites; this signature is intentionally narrow.
  return { tag: "Repository", cause: cause as never };
}

export function createSyncService(deps: SyncServiceDeps): SyncService {
  const now = deps.now ?? (() => new Date());

  async function readState(
    opts: { lastSyncAt?: string | null } = {},
  ): Promise<Result<SyncState, ServiceError>> {
    const status = await deps.jj.status({ root: deps.root });
    if (!status.ok) return err(repoErr(status.error));
    const ahead = await deps.jj.aheadBehind({ root: deps.root });
    if (!ahead.ok) return err(repoErr(ahead.error));
    const conflicts = await deps.jj.listConflicts({ root: deps.root });
    if (!conflicts.ok) return err(repoErr(conflicts.error));
    const conflictDescriptors: ConflictDescriptor[] = conflicts.value.map((p) => ({
      path: p,
      kind: "ours" as const,
    }));
    return ok({
      lastSyncAt: opts.lastSyncAt ?? status.value.lastSyncAt,
      ahead: ahead.value.ahead,
      behind: ahead.value.behind,
      dirty: status.value.dirty,
      remote: status.value.remote,
      conflicts: conflictDescriptors,
    });
  }

  async function outcome(stamped: boolean): Promise<Result<SyncOutcome, ServiceError>> {
    const r = await readState(stamped ? { lastSyncAt: now().toISOString() } : {});
    if (!r.ok) return err(r.error);
    return ok({ state: r.value, conflicts: r.value.conflicts });
  }

  return {
    async state() {
      return readState();
    },

    async fetch() {
      const r = await deps.jj.gitFetch({ root: deps.root });
      if (!r.ok) return err(repoErr(r.error));
      return outcome(true);
    },

    async push() {
      const r = await deps.jj.gitPush({ root: deps.root });
      if (!r.ok) return err(repoErr(r.error));
      return outcome(true);
    },

    async sync() {
      const fetched = await deps.jj.gitFetch({ root: deps.root });
      if (!fetched.ok) return err(repoErr(fetched.error));
      // If fetch surfaced conflicts, surface them and skip push.
      const post = await readState({ lastSyncAt: now().toISOString() });
      if (!post.ok) return err(post.error);
      if (post.value.conflicts.length > 0) {
        return ok({ state: post.value, conflicts: post.value.conflicts });
      }
      const pushed = await deps.jj.gitPush({ root: deps.root });
      if (!pushed.ok) return err(repoErr(pushed.error));
      return outcome(true);
    },

    async resolve({ path, choice }) {
      const abs = join(deps.root, path);
      if (choice === "ours" || choice === "theirs") {
        let raw: string;
        try {
          raw = await Bun.file(abs).text();
        } catch (cause) {
          return err({
            tag: "Repository",
            cause: { tag: "IoError", path: abs, cause },
          });
        }
        const next = pickConflictSide(raw, choice);
        try {
          await Bun.write(abs, next);
        } catch (cause) {
          return err({
            tag: "Repository",
            cause: { tag: "IoError", path: abs, cause },
          });
        }
      } else {
        const r = await deps.editor.run(abs);
        if (!r.ok) return err(r.error);
      }
      const snap = await deps.jj.snapshot({ root: deps.root });
      if (!snap.ok) return err(repoErr(snap.error));
      return outcome(false);
    },
  };
}
