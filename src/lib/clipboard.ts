/**
 * Best-effort write to the OS clipboard. Tries platform-native commands and
 * silently swallows failures (e.g. clipboard tool not installed). Returns
 * `true` if any command succeeded.
 */
export async function yankToClipboard(text: string): Promise<boolean> {
  const candidates: readonly (readonly string[])[] =
    process.platform === "darwin"
      ? [["pbcopy"]]
      : process.platform === "win32"
        ? [["clip"]]
        : [
            ["wl-copy"],
            ["xclip", "-selection", "clipboard"],
            ["xsel", "-b", "-i"],
          ];
  for (const cmd of candidates) {
    try {
      const proc = Bun.spawn([...cmd], { stdin: "pipe", stdout: "ignore", stderr: "ignore" });
      proc.stdin.write(text);
      await proc.stdin.end();
      const code = await proc.exited;
      if (code === 0) return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}
