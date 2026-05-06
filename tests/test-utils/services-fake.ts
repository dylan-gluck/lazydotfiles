import { ok } from "../../src/lib/result";
import type { RepoService } from "../../src/services/repo.service";

/**
 * No-op RepoService: list/state queries return empty values; mutators succeed
 * with undefined. Spread and override only what each test needs.
 */
export function baseRepoService(): RepoService {
  return {
    head: async () => ok({} as never),
    operations: async () => ok([]),
    syncState: async () =>
      ok({ lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null, conflicts: [] }),
    dirty: async () => ok(false),
    restoreOp: async () => ok(undefined),
    trackedFiles: async () => ok([]),
    setRemote: async () => ok(undefined),
  };
}
