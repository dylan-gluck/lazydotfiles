import { wireServices, type Services } from "../../src/composition/services";
import { runCli } from "../../src/cli";
import { withTmpDir } from "../test-utils/tmp";

export interface E2eRun {
  readonly home: string;
  readonly services: Services;
  /**
   * Runs the production CLI against the e2e $HOME with a capturing IO.
   * Mirrors the real `bin/ldf.ts` wiring; uses no real stdio.
   */
  runCli(argv: readonly string[]): Promise<{ code: number; out: string; err: string }>;
}

/**
 * Builds an isolated tmp $HOME, wires the full Services graph against it,
 * runs `services.bootstrap.run()` (asserts ok via thrown error on fail),
 * and hands the body a working harness. Cleans up on return.
 *
 * The acceptance suite relies on this helper so every Aₙ scenario uses the
 * same composition root the binary uses (`bin/ldf.ts`) — no parallel wiring,
 * no test-only services.
 */
export async function withE2eHome(fn: (run: E2eRun) => Promise<void>): Promise<void> {
  await withTmpDir(async (dir) => {
    const home = dir.path;
    const services = wireServices({ home });
    const boot = await services.bootstrap.run();
    if (!boot.ok) {
      throw new Error(`e2e bootstrap failed: ${JSON.stringify(boot.error)}`);
    }

    async function captureRun(argv: readonly string[]) {
      let out = "";
      let err = "";
      const code = await runCli([...argv], {
        services,
        io: {
          stdout: (s) => {
            out += s;
          },
          stderr: (s) => {
            err += s;
          },
          env: { HOME: home },
          cwd: home,
        },
      });
      return { code, out, err };
    }

    await fn({ home, services, runCli: captureRun });
  });
}
