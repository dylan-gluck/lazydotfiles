import { formatServiceError } from "../../lib/format";
import { KNOWN_OPTIONS } from "../../services/config.service";
import type { CliDeps } from "../types";
import { ensureConfigLoaded } from "./util";

function coerce(raw: string): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (raw === "true") return { ok: true, value: true };
  if (raw === "false") return { ok: true, value: false };
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { ok: true, value: Number(raw) };
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, reason: `bad value (expected JSON): ${(e as Error).message}` };
    }
  }
  return { ok: true, value: raw };
}

export async function configHandler(rest: readonly string[], deps: CliDeps): Promise<number> {
  const ensured = await ensureConfigLoaded(deps);
  if (ensured !== 0) return ensured;

  if (rest.length === 0) {
    const lines: string[] = [];
    for (const key of [...KNOWN_OPTIONS].sort()) {
      const r = deps.services.config.get(key);
      const repr = r.ok ? JSON.stringify(r.value) : "<error>";
      lines.push(`${key} = ${repr}`);
    }
    deps.io.stdout(`${lines.join("\n")}\n`);
    return 0;
  }

  if (rest.length === 1) {
    const key = rest[0]!;
    const r = deps.services.config.get(key);
    if (!r.ok) {
      deps.io.stderr(`unknown option: ${key}\n`);
      return 1;
    }
    deps.io.stdout(`${JSON.stringify(r.value)}\n`);
    return 0;
  }

  if (rest.length === 2) {
    const [key, raw] = rest as [string, string];
    if (!KNOWN_OPTIONS.has(key)) {
      deps.io.stderr(`unknown option: ${key}\n`);
      return 1;
    }
    const c = coerce(raw);
    if (!c.ok) {
      deps.io.stderr(`${c.reason}\n`);
      return 1;
    }
    const r = await deps.services.config.set(key, c.value);
    if (!r.ok) {
      deps.io.stderr(`${formatServiceError(r.error)}\n`);
      return r.error.tag === "Validation" || r.error.tag === "NotFound" ? 1 : 2;
    }
    return 0;
  }

  deps.io.stderr("usage: ldf config [<key> [<value>]]\n");
  return 1;
}
