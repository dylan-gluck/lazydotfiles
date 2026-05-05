import { formatServiceError, relativeAge } from "../../lib/format";
import type { CliDeps } from "../types";

export async function syncHandler(_rest: readonly string[], deps: CliDeps): Promise<number> {
  const r = await deps.services.sync.sync();
  if (!r.ok) {
    deps.io.stderr(`${formatServiceError(r.error)}\n`);
    return 2;
  }
  if (r.value.conflicts.length > 0) {
    const lines = [`sync conflicts (${r.value.conflicts.length}):`];
    for (const c of r.value.conflicts) lines.push(`  ${c.path}`);
    deps.io.stdout(`${lines.join("\n")}\n`);
    return 2;
  }
  const last = r.value.state.lastSyncAt === null ? "never" : relativeAge(r.value.state.lastSyncAt);
  const remote = r.value.state.remote ?? "none";
  deps.io.stdout(
    `sync ok  remote=${remote}  ahead=${r.value.state.ahead} behind=${r.value.state.behind}  last=${last}\n`,
  );
  return 0;
}
