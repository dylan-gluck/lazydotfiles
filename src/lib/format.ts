import type { RepoError } from "../repositories/types";
import type { ServiceError } from "../services/types";

/**
 * Render an ISO-8601 timestamp as a coarse, monotonically-increasing relative
 * age string ("just now", "5m ago", "2h ago", "3d ago"). Returns the input
 * verbatim when the timestamp does not parse so callers never display "NaN".
 */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = now.getTime() - then;
  if (diffMs < 60_000) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function padRight(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`;
}

export interface FormatOpts {
  /**
   * UI-facing rendering: omit Spawn stderr and rollback-error counts; render
   * issue counts instead of joined messages. CLI/stderr default uses the long
   * form so operators can act on it.
   */
  readonly brief?: boolean;
}

/**
 * Format a `ServiceError` as a single-line, actionable message. Default tone
 * is operator-facing (CLI/stderr); pass `{ brief: true }` for compact UI
 * surfaces. Discriminates on `tag` so each variant surfaces the field that
 * matters (CONSTITUTION §2.1: errors must carry information).
 */
export function formatServiceError(e: ServiceError, opts: FormatOpts = {}): string {
  const brief = opts.brief === true;
  switch (e.tag) {
    case "NotFound":
      return brief ? `${e.resource} not found: ${e.id}` : `not found: ${e.resource}#${e.id}`;
    case "Validation":
      return brief
        ? `validation failed (${e.issues.length} issues)`
        : `validation failed: ${e.issues.map((i) => i.message).join("; ")}`;
    case "InvalidTarget":
      return `invalid target (${e.reason}): ${e.path}`;
    case "Repository":
      return formatRepoError(e.cause, brief);
    case "Rollback": {
      const inner = formatServiceError(e.original, opts);
      if (brief) return `rolled back at step "${e.failedStep}": ${inner}`;
      const errs =
        e.rollbackErrors.length === 0
          ? "rollback clean"
          : `rollback errors: ${e.rollbackErrors.length}`;
      return `rollback at step '${e.failedStep}': ${inner}; ${errs}`;
    }
  }
}

function formatRepoError(c: RepoError, brief: boolean): string {
  switch (c.tag) {
    case "NotFound":
      return brief ? `missing path: ${c.path}` : `repository not found: ${c.path}`;
    case "ParseError":
      return `parse error at ${c.path}`;
    case "IoError":
      return brief
        ? `I/O error at ${c.path}: ${stringifyCause(c.cause)}`
        : `io error at ${c.path}: ${stringifyCause(c.cause)}`;
    case "Spawn":
      return brief
        ? `command failed (exit ${c.exitCode}): ${c.command.join(" ")}`
        : `command failed (exit ${c.exitCode}): ${c.command.join(" ")}${c.stderr ? `\n${c.stderr}` : ""}`;
  }
}

function stringifyCause(cause: unknown): string {
  if (cause === null || cause === undefined) return "(no detail)";
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
