#!/usr/bin/env bun
import { wireServices } from "../src/composition/services";
import { runCli } from "../src/cli";

const home = process.env["HOME"] ?? "";
const services = wireServices({ home });

const code = await runCli(process.argv.slice(2), {
  services,
  io: {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    env: process.env,
    cwd: process.cwd(),
  },
});

// The composition root is the only place we set the exit code.
// (CONSTITUTION §6.1: no `process.exit()` in app code.)
process.exitCode = code;
