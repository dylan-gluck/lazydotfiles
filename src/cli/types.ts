import type { Services } from "../composition/services";

export interface CliIO {
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}

export interface CliDeps {
  readonly services: Services;
  readonly io: CliIO;
  readonly launchTui?: () => Promise<number>;
}
