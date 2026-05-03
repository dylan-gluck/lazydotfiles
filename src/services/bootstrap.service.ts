import { err, ok, type Result } from "../lib/result";
import type { Config } from "../domain/config";
import type { FsRepository } from "../repositories/fs.repository";
import type { JjRepository } from "../repositories/jj.repository";
import type { ConfigService } from "./config.service";
import type { ServiceError } from "./types";

export interface BootstrapOutcome {
  readonly config: Config;
  /** True when bootstrap created the config, the dotfiles repo, or the backup dir. */
  readonly initialized: boolean;
}

export interface BootstrapService {
  run(): Promise<Result<BootstrapOutcome, ServiceError>>;
}

export function createBootstrapService(deps: {
  config: ConfigService;
  jj: JjRepository;
  fs: FsRepository;
}): BootstrapService {
  return {
    async run() {
      const cfg = await deps.config.loadOrInit();
      if (!cfg.ok) return cfg;

      let initialized = false;

      const present = await deps.jj.isRepo(cfg.value.path.dotfiles);
      if (!present.ok) return err({ tag: "Repository", cause: present.error });
      if (!present.value) {
        const init = await deps.jj.initColocated(cfg.value.path.dotfiles);
        if (!init.ok) return err({ tag: "Repository", cause: init.error });
        initialized = true;
      }

      const ensure = await deps.fs.ensureDir(cfg.value.path.backup);
      if (!ensure.ok) return err({ tag: "Repository", cause: ensure.error });
      if (ensure.value.created) initialized = true;

      return ok({ config: cfg.value, initialized });
    },
  };
}
