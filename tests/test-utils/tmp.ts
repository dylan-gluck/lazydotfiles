import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TmpDir {
  readonly path: string;
  cleanup(): Promise<void>;
}

export async function makeTmpDir(prefix = "ldf-"): Promise<TmpDir> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  return {
    path,
    async cleanup() {
      await rm(path, { recursive: true, force: true });
    },
  };
}

export async function withTmpDir<T>(fn: (dir: TmpDir) => Promise<T>, prefix?: string): Promise<T> {
  const dir = await makeTmpDir(prefix);
  try {
    return await fn(dir);
  } finally {
    await dir.cleanup();
  }
}
