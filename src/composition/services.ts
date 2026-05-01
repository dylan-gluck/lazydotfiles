import { defaultConfig } from "../domain/config";
import { expandPaths } from "../lib/path";
import { createBackupRepository } from "../repositories/backup.repository";
import { createConfigRepository } from "../repositories/config.repository";
import { createFsScannerRepository } from "../repositories/fs-scanner.repository";
import { createFsRepository } from "../repositories/fs.repository";
import { createJjRepository } from "../repositories/jj.repository";
import { createSymlinkRepository } from "../repositories/symlink.repository";
import { createTrackedFileRepository } from "../repositories/tracked-file.repository";
import { type BackupService, createBackupService } from "../services/backup.service";
import { type BootstrapService, createBootstrapService } from "../services/bootstrap.service";
import { type ConfigService, createConfigService } from "../services/config.service";
import { type DiscoveryService, createDiscoveryService } from "../services/discovery.service";
import { createRepoService, type RepoService } from "../services/repo.service";
import { createOperationService, type OperationService } from "../services/operation.service";
import { createRestoreService, type RestoreService } from "../services/restore.service";
import { createEditorRunner } from "../services/sync.editor";
import { createSyncService, type SyncService } from "../services/sync.service";
import { createTrackService, type TrackService } from "../services/track.service";

export interface Services {
  readonly home: string;
  readonly config: ConfigService;
  readonly bootstrap: BootstrapService;
  readonly repo: RepoService;
  readonly discovery: DiscoveryService;
  readonly backups: BackupService;
  readonly track: TrackService;
  readonly operation: OperationService;
  readonly restore: RestoreService;
  readonly sync: SyncService;
}

export function wireServices(deps: { home: string }): Services {
  const configPath = `${deps.home}/.config/lazydotfiles/config.toml`;
  const configRepo = createConfigRepository(configPath);
  const fs = createFsRepository();
  const jj = createJjRepository();
  const dotfilesRoot = `${deps.home}/dotfiles`;
  const backupRoot = `${deps.home}/.dotfiles.bak`;
  const trackedRepo = createTrackedFileRepository({ dotfilesRoot });
  const symlinks = createSymlinkRepository();
  const config = createConfigService({
    repo: configRepo,
    defaults: () => {
      const base = defaultConfig();
      return { ...base, path: expandPaths(base.path, deps.home) };
    },
  });
  const bootstrap = createBootstrapService({ config, jj, fs });
  const repo = createRepoService({ jj, tracked: trackedRepo, root: dotfilesRoot });
  const scanner = createFsScannerRepository();
  const discovery = createDiscoveryService({ scanner });
  const backupRepo = createBackupRepository({ backupRoot });
  const backups = createBackupService({ repo: backupRepo });
  const track = createTrackService({
    home: deps.home,
    dotfilesRoot,
    fs,
    symlinks,
    tracked: trackedRepo,
    jj,
    backups,
  });
  const operation = createOperationService({ jj, root: dotfilesRoot });
  const sync = createSyncService({
    jj,
    root: dotfilesRoot,
    editor: createEditorRunner(),
  });
  const restore = createRestoreService({
    home: deps.home,
    dotfilesRoot,
    jj,
    tracked: trackedRepo,
    symlinks,
    fs,
    backups: backupRepo,
  });
  return {
    home: deps.home,
    config,
    bootstrap,
    repo,
    discovery,
    backups,
    track,
    operation,
    restore,
    sync,
  };
}
