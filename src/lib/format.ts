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

/**
 * Format a `ServiceError` as a single-line, actionable message suitable for
 * stderr. Discriminates on `tag` so each variant surfaces the field that
 * matters (CONSTITUTION §2.1: errors must carry information).
 */
export function formatServiceError(e: ServiceError): string {
  switch (e.tag) {
    case "NotFound":
      return `not found: ${e.resource}#${e.id}`;
    case "Validation": {
      const issues = e.issues.map((i) => i.message).join("; ");
      return `validation failed: ${issues}`;
    }
    case "InvalidTarget":
      return `invalid target (${e.reason}): ${e.path}`;
    case "Repository": {
      const c = e.cause as {
        tag?: string;
        path?: string;
        cause?: unknown;
        command?: readonly string[];
        exitCode?: number;
        stderr?: string;
      };
      switch (c.tag) {
        case "IoError":
          return `io error at ${c.path}: ${stringifyCause(c.cause)}`;
        case "Spawn":
          return `command failed (exit ${c.exitCode}): ${(c.command ?? []).join(" ")}${c.stderr ? `\n${c.stderr}` : ""}`;
        case "NotFound":
          return `repository not found: ${c.path ?? "(unknown)"}`;
        default:
          return `repository error: ${c.tag ?? "unknown"}`;
      }
    }
    case "Rollback": {
      const errs =
        e.rollbackErrors.length === 0
          ? "rollback clean"
          : `rollback errors: ${e.rollbackErrors.length}`;
      return `rollback at step '${e.failedStep}': ${formatServiceError(e.original)}; ${errs}`;
    }
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
