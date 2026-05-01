import type { Services } from "../composition/services";
import { addHandler } from "./handlers/add";
import { configHandler } from "./handlers/config";
import { logHandler } from "./handlers/log";
import { removeHandler } from "./handlers/remove";
import { statusHandler } from "./handlers/status";
import { syncHandler } from "./handlers/sync";

export interface CliIO {
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}

export interface CliDeps {
  readonly services: Services;
  readonly io: CliIO;
  /**
   * Optional TUI launcher invoked for the `ldf` no-arg path. When absent
   * (e.g. in unit tests), `runCli([], …)` returns 0 after a successful
   * bootstrap.
   */
  readonly launchTui?: () => Promise<number>;
}

export type Subcommand = "status" | "log" | "add" | "rm" | "config" | "sync";

type Handler = (rest: readonly string[], deps: CliDeps) => Promise<number>;

const HANDLERS: Record<Subcommand, Handler> = {
  status: statusHandler,
  log: logHandler,
  add: addHandler,
  rm: removeHandler,
  config: configHandler,
  sync: syncHandler,
};

const KNOWN: ReadonlySet<string> = new Set(Object.keys(HANDLERS));

const USAGE = `usage:
  ldf                       launch TUI (bootstraps if needed)
  ldf status                print health summary
  ldf log [--limit N] [--offset N]
  ldf add <path>            track a file
  ldf rm <path>             untrack a file
  ldf config [<key> [<value>]]
  ldf sync                  fetch + push once
`;

export async function runCli(argv: readonly string[], deps: CliDeps): Promise<number> {
  // Cheap pre-check for `--help` at top level.
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    deps.io.stdout(USAGE);
    return 0;
  }

  // Every code path requires a bootstrapped repo; do it once up front.
  const boot = await deps.services.bootstrap.run();
  if (!boot.ok) {
    const { formatServiceError } = await import("../lib/format");
    deps.io.stderr(`bootstrap failed: ${formatServiceError(boot.error)}\n`);
    return 2;
  }

  if (argv.length === 0) {
    if (deps.launchTui === undefined) return 0;
    return deps.launchTui();
  }

  const [sub, ...rest] = argv;
  if (sub === undefined || !KNOWN.has(sub)) {
    deps.io.stderr(`unknown command: ${sub ?? ""}\n${USAGE}`);
    return 1;
  }
  const handler = HANDLERS[sub as Subcommand];
  return handler(rest, deps);
}
