import { relative } from "node:path";
import { formatServiceError } from "../../lib/format";
import type { ServiceError } from "../../services/types";
import type { CliDeps } from "../types";

/**
 * Make sure config is loaded before a handler proceeds. Bootstrap.run() loads
 * it first, but handlers that may run alone (tests, scripts) call this defensively.
 *
 * Returns 0 on success, 2 on load failure (after writing to stderr).
 */
export async function ensureConfigLoaded(deps: CliDeps): Promise<number> {
  if (deps.services.config.current() !== null) return 0;
  const loaded = await deps.services.config.loadOrInit();
  if (!loaded.ok) {
    deps.io.stderr(`${formatServiceError(loaded.error)}\n`);
    return 2;
  }
  return 0;
}

/**
 * Report a track-service result (add/remove). On success prints `<verb> <rel>`;
 * on failure writes the error and returns 1 for missing target, 2 otherwise.
 */
export function reportTrackResult(
  deps: CliDeps,
  verb: string,
  result: { ok: true; value: { target: string } } | { ok: false; error: ServiceError },
): number {
  if (result.ok) {
    const rel = relative(deps.services.home, result.value.target);
    deps.io.stdout(`${verb} ${rel}\n`);
    return 0;
  }
  deps.io.stderr(`${formatServiceError(result.error)}\n`);
  if (result.error.tag === "InvalidTarget" && result.error.reason === "missing") return 1;
  return 2;
}
