import type { BackupRecord, BackupTrigger } from "../domain/backup";
import { err, ok, type Result } from "../lib/result";
import type { BackupRepository } from "../repositories/backup.repository";
import type { ServiceError } from "./types";

export interface BackupService {
  snapshot(input: {
    srcPath: string;
    trackedFileId: string;
    trigger: BackupTrigger;
    now?: () => Date;
  }): Promise<Result<BackupRecord, ServiceError>>;
  list(trackedFileId: string): Promise<Result<readonly BackupRecord[], ServiceError>>;
  read(id: string): Promise<Result<BackupRecord, ServiceError>>;
  payloadPath(record: BackupRecord): string;
}

export function createBackupService(deps: {
  repo: BackupRepository;
  now?: () => Date;
}): BackupService {
  return {
    async snapshot(input) {
      const r = await deps.repo.snapshot({ ...input, now: input.now ?? deps.now });
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },
    async list(trackedFileId) {
      const r = await deps.repo.list(trackedFileId);
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },
    async read(id) {
      const r = await deps.repo.read(id);
      return r.ok ? ok(r.value) : err({ tag: "Repository", cause: r.error });
    },
    payloadPath(record) {
      return deps.repo.payloadPath(record);
    },
  };
}
