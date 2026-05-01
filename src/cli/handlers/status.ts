import { formatServiceError, relativeAge } from "../../lib/format";
import type { CliDeps } from "../index";

export async function statusHandler(_rest: readonly string[], deps: CliDeps): Promise<number> {
  const { services, io } = deps;

  const cfgRes = services.config.current() ?? null;
  let dotfilesRoot: string;
  if (cfgRes === null) {
    const loaded = await services.config.loadOrInit();
    if (!loaded.ok) {
      io.stderr(`${formatServiceError(loaded.error)}\n`);
      return 2;
    }
    dotfilesRoot = loaded.value.path.dotfiles;
  } else {
    dotfilesRoot = cfgRes.path.dotfiles;
  }

  const tracked = await services.repo.trackedFiles();
  if (!tracked.ok) {
    io.stderr(`${formatServiceError(tracked.error)}\n`);
    return 2;
  }
  const trackedCount = tracked.value.filter((t) => t.status === "tracked").length;

  const cfgForScan = services.config.current();
  let queueCount: number | "?" = "?";
  if (cfgForScan !== null) {
    const scan = await services.discovery.scan(cfgForScan);
    if (scan.ok) queueCount = scan.value.queued.length;
  }

  const sync = await services.sync.state();
  if (!sync.ok) {
    io.stderr(`${formatServiceError(sync.error)}\n`);
    return 2;
  }

  // Count backups by summing per-tracked-file lists.
  let backupCount = 0;
  for (const t of tracked.value) {
    const list = await services.backups.list(t.id);
    if (list.ok) backupCount += list.value.length;
  }

  const dirtyFlag = sync.value.dirty ? "dirty" : "clean";
  const last = sync.value.lastSyncAt === null ? "never" : relativeAge(sync.value.lastSyncAt);
  const remote = sync.value.remote ?? "none";

  io.stdout(
    [
      `repo:    ${dotfilesRoot}  ${dirtyFlag}`,
      `tracked: ${trackedCount} files`,
      `queue:   ${queueCount} candidates`,
      `sync:    last ${last}, ahead ${sync.value.ahead}, behind ${sync.value.behind}, remote ${remote}`,
      `backups: ${backupCount} snapshots`,
      "",
    ].join("\n"),
  );
  return 0;
}
