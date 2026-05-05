import { parseArgs } from "node:util";
import { formatServiceError, padRight, relativeAge, truncate } from "../../lib/format";
import type { CliDeps } from "../types";

export async function logHandler(rest: readonly string[], deps: CliDeps): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...rest],
      options: {
        limit: { type: "string" },
        offset: { type: "string" },
      },
      allowPositionals: false,
      strict: true,
    });
  } catch (cause) {
    deps.io.stderr(`bad arguments: ${cause instanceof Error ? cause.message : String(cause)}\n`);
    return 1;
  }

  const limit = parsed.values.limit === undefined ? 50 : Number(parsed.values.limit);
  const offset = parsed.values.offset === undefined ? 0 : Number(parsed.values.offset);
  if (!Number.isInteger(limit) || limit <= 0) {
    deps.io.stderr(`bad value for --limit: ${parsed.values.limit}\n`);
    return 1;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    deps.io.stderr(`bad value for --offset: ${parsed.values.offset}\n`);
    return 1;
  }

  const r = await deps.services.operation.list({ limit, offset });
  if (!r.ok) {
    deps.io.stderr(`${formatServiceError(r.error)}\n`);
    return 2;
  }
  if (r.value.length === 0) {
    deps.io.stdout("(no operations)\n");
    return 0;
  }
  const lines: string[] = [];
  for (const op of r.value) {
    const hash = op.opId.slice(0, 8);
    const kind = padRight(op.kind, 7);
    const age = padRight(relativeAge(op.at), 8);
    lines.push(`${hash}  ${kind}  ${age}  ${op.description}`);
    if (op.filesTouched.length > 0) {
      lines.push(`                                  ${truncate(op.filesTouched.join(", "), 80)}`);
    }
  }
  deps.io.stdout(`${lines.join("\n")}\n`);
  return 0;
}
