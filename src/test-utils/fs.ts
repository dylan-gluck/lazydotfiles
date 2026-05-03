import { lstat, readlink } from "node:fs/promises";

export async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

export async function readSymlinkTarget(path: string): Promise<string | null> {
  try {
    return await readlink(path);
  } catch {
    return null;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

export interface ClassifyInput {
  readonly target: string;
  readonly source: string;
  readonly original: string;
}

export type FsClassification = "fully-tracked" | "fully-restored" | "broken";

export async function classifyFs(input: ClassifyInput): Promise<FsClassification> {
  const targetIsLink = await isSymlink(input.target);
  const sourceExists = await fileExists(input.source);
  if (targetIsLink && sourceExists) {
    const sourceContent = await Bun.file(input.source).text();
    if (sourceContent === input.original) return "fully-tracked";
    return "broken";
  }
  if (!targetIsLink) {
    if (await fileExists(input.target)) {
      const content = await Bun.file(input.target).text();
      if (content === input.original && !sourceExists) return "fully-restored";
    }
  }
  return "broken";
}
