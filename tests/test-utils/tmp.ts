import { afterEach, beforeEach } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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

export interface TmpDirContext {
  /** Tmp dir, fresh per test. */
  readonly dir: () => TmpDir;
  /** Create an empty file at `rel` under the tmp dir, mkdir-p'ing parents. */
  touch(rel: string): Promise<void>;
}

/**
 * Wire `beforeEach`/`afterEach` to give each test in a suite its own tmp dir
 * plus a `touch(rel)` helper. Returns accessors so the test body can read the
 * dir and create files without re-implementing the boilerplate.
 */
export function useTmpDir(prefix = "ldf-"): TmpDirContext {
  let current: TmpDir | undefined;
  beforeEach(async () => {
    current = await makeTmpDir(prefix);
  });
  afterEach(async () => {
    if (current) {
      await current.cleanup();
      current = undefined;
    }
  });
  const dir = () => {
    if (current === undefined) throw new Error("tmp dir not initialized");
    return current;
  };
  const touch = async (rel: string) => {
    const abs = join(dir().path, rel);
    await mkdir(join(abs, ".."), { recursive: true });
    await Bun.write(abs, "");
  };
  return { dir, touch };
}
