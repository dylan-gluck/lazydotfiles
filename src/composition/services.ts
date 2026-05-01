import { defaultConfig } from "../domain/config";
import { expandPaths } from "../lib/path";
import { createConfigRepository } from "../repositories/config.repository";
import { createFsRepository } from "../repositories/fs.repository";
import { createJjRepository } from "../repositories/jj.repository";
import { createTrackedFileRepository } from "../repositories/tracked-file.repository";
import { type BootstrapService, createBootstrapService } from "../services/bootstrap.service";
import { type ConfigService, createConfigService } from "../services/config.service";
import { createRepoService, type RepoService } from "../services/repo.service";

export interface Services {
  readonly home: string;
  readonly config: ConfigService;
  readonly bootstrap: BootstrapService;
  readonly repo: RepoService;
}

export function wireServices(deps: { home: string }): Services {
  const configPath = `${deps.home}/.config/lazydotfiles/config.toml`;
  const configRepo = createConfigRepository(configPath);
  const fs = createFsRepository();
  const jj = createJjRepository();
  const dotfilesRoot = `${deps.home}/dotfiles`;
  const trackedRepo = createTrackedFileRepository({ dotfilesRoot });
  const config = createConfigService({
    repo: configRepo,
    defaults: () => {
      const base = defaultConfig();
      return { ...base, path: expandPaths(base.path, deps.home) };
    },
  });
  const bootstrap = createBootstrapService({ config, jj, fs });
  const repo = createRepoService({ jj, tracked: trackedRepo, root: dotfilesRoot });
  return { home: deps.home, config, bootstrap, repo };
}
