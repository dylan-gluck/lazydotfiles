import { err, ok, type Result } from "../lib/result";
import type { ServiceError } from "./types";

export interface EditorRunner {
  /** Resolves to ok on exit 0; Repository(Spawn) error otherwise. */
  run(absPath: string): Promise<Result<void, ServiceError>>;
}

export interface EditorOptions {
  readonly env?: Record<string, string | undefined>;
  readonly fallback?: string;
  /** Hook for the TUI to suspend the renderer around the spawn. */
  readonly suspend?: <T>(fn: () => Promise<T>) => Promise<T>;
}

/** Split a command string on whitespace, preserving simple quoted segments. */
export function splitEditorCommand(cmd: string): readonly string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3]!);
  }
  return out;
}

export function createEditorRunner(opts: EditorOptions = {}): EditorRunner {
  const env = opts.env ?? (process.env as Record<string, string | undefined>);
  const fallback = opts.fallback ?? "vi";
  const suspend = opts.suspend ?? (async <T>(fn: () => Promise<T>) => fn());
  return {
    async run(absPath) {
      const raw = env["EDITOR"]?.trim();
      const parts = raw && raw.length > 0 ? splitEditorCommand(raw) : [fallback];
      const command = [...parts, absPath];
      return suspend(async () => {
        let proc: ReturnType<typeof Bun.spawn>;
        try {
          proc = Bun.spawn(command, {
            stdin: "inherit",
            stdout: "inherit",
            stderr: "inherit",
          });
        } catch (cause) {
          return err({
            tag: "Repository",
            cause: { tag: "IoError", path: absPath, cause },
          } satisfies ServiceError);
        }
        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          return err({
            tag: "Repository",
            cause: { tag: "Spawn", command, exitCode, stderr: "" },
          } satisfies ServiceError);
        }
        return ok(undefined);
      });
    },
  };
}
