#!/usr/bin/env bun
import { wireActors } from "../src/composition/actors";
import { wireServices } from "../src/composition/services";
import { runCli } from "../src/cli";
import { launchTui } from "../src/tui/launch";

const home = process.env["HOME"] ?? "";
const services = wireServices({ home });
const actors = wireActors(services);

actors.onEffectFailure(({ actorId, cause }) => {
  process.stderr.write(`actor ${actorId} effect failed: ${String(cause)}\n`);
});

const code = await runCli(process.argv.slice(2), {
  services,
  io: {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    env: process.env,
    cwd: process.cwd(),
  },
  launchTui: () => launchTui({ services, actors }),
});

actors.dispose();

// The composition root is the only place we set the exit code.
// (CONSTITUTION §6.1: no `process.exit()` in app code.)
process.exitCode = code;
