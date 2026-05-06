import { resolve } from "node:path";
import type { CliDeps } from "../types";
import { reportTrackResult } from "./util";

export async function addHandler(rest: readonly string[], deps: CliDeps): Promise<number> {
  if (rest.length !== 1) {
    deps.io.stderr("usage: ldf add <path>\n");
    return 1;
  }
  const abs = resolve(deps.io.cwd, rest[0]!);
  return reportTrackResult(deps, "tracked", await deps.services.track.add(abs));
}
