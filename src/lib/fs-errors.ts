export function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

export function isExdev(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "EXDEV";
}
