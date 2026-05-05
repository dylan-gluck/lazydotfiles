import { addHandler } from "./handlers/add";
import { configHandler } from "./handlers/config";
import { logHandler } from "./handlers/log";
import { remoteHandler } from "./handlers/remote";
import { removeHandler } from "./handlers/remove";
import { statusHandler } from "./handlers/status";
import { syncHandler } from "./handlers/sync";
import type { CliDeps } from "./types";

export type { CliDeps, CliIO } from "./types";

type Subcommand = "status" | "log" | "add" | "rm" | "config" | "sync" | "remote";

type Handler = (rest: readonly string[], deps: CliDeps) => Promise<number>;

const HANDLERS: Record<Subcommand, Handler> = {
  status: statusHandler,
  log: logHandler,
  add: addHandler,
  rm: removeHandler,
  config: configHandler,
  sync: syncHandler,
  remote: remoteHandler,
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
  ldf remote [<url>]        get/set git remote (persists to config.toml)
`;

export async function runCli(argv: readonly string[], deps: CliDeps): Promise<number> {
  // Cheap pre-check for `--help` at top level.
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) {
    deps.io.stdout(USAGE);
    return 0;
  }

  // The TUI path owns its own bootstrap so it can render `BootstrapErrorPanel`
  // rather than a stderr line.
  if (argv.length === 0 && deps.launchTui !== undefined) {
    return deps.launchTui();
  }

  // Every CLI subcommand requires a bootstrapped repo; do it once up front.
  const boot = await deps.services.bootstrap.run();
  if (!boot.ok) {
    const { formatServiceError } = await import("../lib/format");
    deps.io.stderr(`bootstrap failed: ${formatServiceError(boot.error)}\n`);
    return 2;
  }

  if (argv.length === 0) {
    // No `launchTui` (e.g. unit tests). Bootstrap succeeded; nothing more to do.
    return 0;
  }

  const [sub, ...rest] = argv;
  if (sub === undefined || !KNOWN.has(sub)) {
    deps.io.stderr(`unknown command: ${sub ?? ""}\n${USAGE}`);
    return 1;
  }
  const handler = HANDLERS[sub as Subcommand];
  return handler(rest, deps);
}
