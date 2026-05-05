import { relative, resolve } from "node:path";
import { formatServiceError } from "../../lib/format";
import type { CliDeps } from "../types";

export async function addHandler(rest: readonly string[], deps: CliDeps): Promise<number> {
  if (rest.length !== 1) {
    deps.io.stderr("usage: ldf add <path>\n");
    return 1;
  }
  const abs = resolve(deps.io.cwd, rest[0]!);
  const r = await deps.services.track.add(abs);
  if (r.ok) {
    const rel = relative(deps.services.home, r.value.target);
    deps.io.stdout(`tracked ${rel}\n`);
    return 0;
  }
  deps.io.stderr(`${formatServiceError(r.error)}\n`);
  if (r.error.tag === "InvalidTarget" && r.error.reason === "missing") return 1;
  return 2;
}
