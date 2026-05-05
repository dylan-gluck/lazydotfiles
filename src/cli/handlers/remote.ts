import { formatServiceError } from "../../lib/format";
import type { CliDeps } from "../index";

const USAGE = "usage: ldf remote [<url>]\n";

export async function remoteHandler(rest: readonly string[], deps: CliDeps): Promise<number> {
  if (rest.length > 1) {
    deps.io.stderr(USAGE);
    return 1;
  }

  const cfg = deps.services.config.current();
  if (cfg === null) {
    const loaded = await deps.services.config.loadOrInit();
    if (!loaded.ok) {
      deps.io.stderr(`${formatServiceError(loaded.error)}\n`);
      return 2;
    }
  }

  if (rest.length === 0) {
    const got = deps.services.config.get("options.remote");
    const configured = got.ok && typeof got.value === "string" ? got.value : "";
    deps.io.stdout(`${configured.length > 0 ? configured : "(unset)"}\n`);
    return 0;
  }

  const url = rest[0]!;
  const set = await deps.services.config.set("options.remote", url);
  if (!set.ok) {
    deps.io.stderr(`${formatServiceError(set.error)}\n`);
    return set.error.tag === "Validation" || set.error.tag === "NotFound" ? 1 : 2;
  }

  if (url.length > 0) {
    const root = set.value.path.dotfiles;
    const r = await deps.services.repo.setRemote({ root, url });
    if (!r.ok) {
      deps.io.stderr(`${formatServiceError(r.error)}\n`);
      return 2;
    }
  }
  deps.io.stdout(`remote = ${url.length > 0 ? url : "(unset)"}\n`);
  return 0;
}
