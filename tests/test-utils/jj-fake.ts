import { ok } from "../../src/lib/result";
import type { JjRepository } from "../../src/repositories/jj.repository";

/**
 * No-op JjRepository: every method resolves to ok with sensible empty values.
 * Tests spread this and override only the methods they care about.
 */
export function baseJjRepo(): JjRepository {
  return {
    kind: "JjRepository",
    isRepo: async () => ok(true),
    initColocated: async () => ok(undefined),
    describe: async () => ok(undefined),
    snapshot: async () => ok(undefined),
    newChange: async () => ok(undefined),
    opLog: async () => ok([]),
    log: async () => ok([]),
    opRestore: async () => ok(undefined),
    logAtOp: async () => ok(null),
    diffSummaryAtOp: async () => ok([]),
    diffAtOp: async () => ok(""),
    status: async () =>
      ok({ lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null, conflicts: [] }),
    gitFetch: async () => ok(undefined),
    gitPush: async () => ok(undefined),
    aheadBehind: async () => ok({ ahead: 0, behind: 0 }),
    listConflicts: async () => ok([]),
    gitRemoteSet: async () => ok(undefined),
    gitRemoteList: async () => ok([]),
    bookmarkSet: async () => ok(undefined),
  };
}
