/**
 * Replace a leading `~/` (or bare `~`) and every `$HOME` token with `home`.
 * Returns the input unchanged when neither token is present.
 */
export function expandHome(input: string, home: string): string {
  let out = input;
  if (out === "~") {
    out = home;
  } else if (out.startsWith("~/")) {
    out = home + out.slice(1);
  }
  if (out.includes("$HOME")) {
    out = out.split("$HOME").join(home);
  }
  return out;
}

/**
 * Expand `home`, `dotfiles`, `backup` in a `Paths`-shaped aggregate. Pure;
 * returns a new object preserving any extra fields the caller carries.
 */
export function expandPaths<P extends { home: string; dotfiles: string; backup: string }>(
  paths: P,
  home: string,
): P {
  return {
    ...paths,
    home: expandHome(paths.home, home),
    dotfiles: expandHome(paths.dotfiles, home),
    backup: expandHome(paths.backup, home),
  };
}
