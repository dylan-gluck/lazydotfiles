import type { ServiceError } from "../../services/types";

export function summarizeServiceError(err: ServiceError): string {
  switch (err.tag) {
    case "NotFound":
      return `${err.resource} not found: ${err.id}`;
    case "Validation":
      return `validation failed (${err.issues.length} issues)`;
    case "InvalidTarget":
      return `invalid target (${err.reason}): ${err.path}`;
    case "Rollback":
      return `rolled back at step "${err.failedStep}": ${summarizeServiceError(err.original)}`;
    case "Repository": {
      const c = err.cause;
      switch (c.tag) {
        case "NotFound":
          return `missing path: ${c.path}`;
        case "ParseError":
          return `parse error at ${c.path}`;
        case "IoError":
          return `I/O error at ${c.path}: ${
            c.cause instanceof Error ? c.cause.message : String(c.cause)
          }`;
        case "Spawn":
          return `command failed (exit ${c.exitCode}): ${c.command.join(" ")}`;
      }
    }
  }
}
