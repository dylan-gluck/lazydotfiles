import { relative, sep } from "node:path";
import { type DiscoveryCandidate, makeCandidate } from "../domain/candidate";
import type { Config } from "../domain/config";
import { err, ok, type Result } from "../lib/result";
import {
  type DiscoveryCacheRepository,
  discoveryConfigHash,
} from "../repositories/discovery-cache.repository";
import {
  type FsScannerRepository,
  isExcludedPath,
  isGlobPattern,
} from "../repositories/fs-scanner.repository";
import type { ServiceError } from "./types";

export type DecisionKind = "accept" | "reject" | "defer";

export interface DiscoveryScanResult {
  readonly queued: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
}

export interface DiscoveryCachedResult extends DiscoveryScanResult {
  readonly scannedAt: string;
}

export interface DiscoveryService {
  scan(config: Config): Promise<Result<DiscoveryScanResult, ServiceError>>;
  loadCached(config: Config): Promise<Result<DiscoveryCachedResult | null, ServiceError>>;
  /** Drop a path from the cached snapshot once it has been tracked. */
  commitAccept(config: Config, path: string): Promise<Result<void, ServiceError>>;
  /**
   * Drop a path from the cached snapshot and add it to the persistent
   * deferred set so future scans skip it.
   */
  commitDefer(config: Config, path: string): Promise<Result<void, ServiceError>>;
  expandSiblings(
    path: string,
    depth?: number,
  ): Promise<Result<readonly DiscoveryCandidate[], ServiceError>>;
  /**
   * List the immediate (or up to `depth`) descendants of a directory the user
   * is expanding. Honors the config's exclude rules; ignores include rules
   * because the user opened the dir explicitly.
   */
  expandChildren(
    config: Config,
    path: string,
    depth?: number,
  ): Promise<Result<readonly DiscoveryCandidate[], ServiceError>>;
  decide(candidate: DiscoveryCandidate, decision: DecisionKind): DiscoveryCandidate;
}

export interface DiscoveryServiceDeps {
  readonly scanner: FsScannerRepository;
  readonly cache?: DiscoveryCacheRepository;
  readonly autoTrack?: (path: string) => Promise<Result<void, ServiceError>>;
}

export const DEFAULT_SIBLING_DEPTH = 4;

function decisionToStatus(d: DecisionKind): DiscoveryCandidate["status"] {
  switch (d) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "defer":
      return "deferred";
  }
}

/** True iff the absolute path corresponds to a non-glob include literal. */
function isAutoTrackPath(absPath: string, home: string, include: readonly string[]): boolean {
  const rel = relative(home, absPath).split(/[\\/]/).join("/");
  for (const p of include) {
    if (p.startsWith("!") || isGlobPattern(p)) continue;
    if (p === rel) return true;
  }
  return false;
}

export function createDiscoveryService(deps: DiscoveryServiceDeps): DiscoveryService {
  return {
    async scan(config) {
      const { home } = config.path;
      const queued: DiscoveryCandidate[] = [];
      const autoTracked: string[] = [];
      const auto = config.discovery.auto_track;

      // Persisted deferrals are honored across runs: a deferred path is
      // skipped at the source, so it doesn't reappear in the queue until the
      // user explicitly clears it.
      let deferredSet: Set<string> = new Set();
      if (deps.cache !== undefined) {
        const dr = await deps.cache.loadDeferred();
        if (!dr.ok) return err({ tag: "Repository", cause: dr.error });
        deferredSet = new Set(dr.value);
      }

      for await (const entry of deps.scanner.scan({
        home,
        include: config.discovery.include,
        exclude: config.discovery.exclude,
      })) {
        const abs = entry.path;
        if (deferredSet.has(abs)) continue;
        if (!entry.isDir && auto && isAutoTrackPath(abs, home, config.discovery.include)) {
          if (deps.autoTrack !== undefined) {
            const r = await deps.autoTrack(abs);
            if (!r.ok) return err(r.error);
          }
          autoTracked.push(abs);
        } else {
          queued.push(
            makeCandidate({
              path: abs,
              kind: entry.isDir ? "directory" : "file",
              reason: "include",
            }),
          );
        }
      }
      if (deps.cache !== undefined) {
        const w = await deps.cache.save(discoveryConfigHash(config), { queued, autoTracked });
        if (!w.ok) return err({ tag: "Repository", cause: w.error });
      }
      return ok({ queued, autoTracked });
    },

    async loadCached(config) {
      if (deps.cache === undefined) return ok(null);
      const r = await deps.cache.load(discoveryConfigHash(config));
      if (!r.ok) return err({ tag: "Repository", cause: r.error });
      return ok(r.value);
    },

    async commitAccept(config, path) {
      if (deps.cache === undefined) return ok(undefined);
      const r = await deps.cache.removePath(discoveryConfigHash(config), path);
      if (!r.ok) return err({ tag: "Repository", cause: r.error });
      return ok(undefined);
    },

    async commitDefer(config, path) {
      if (deps.cache === undefined) return ok(undefined);
      const removed = await deps.cache.removePath(discoveryConfigHash(config), path);
      if (!removed.ok) return err({ tag: "Repository", cause: removed.error });
      const marked = await deps.cache.markDeferred(path);
      if (!marked.ok) return err({ tag: "Repository", cause: marked.error });
      return ok(undefined);
    },

    async expandSiblings(path, depth) {
      const r = await deps.scanner.siblings({ path, depth: depth ?? DEFAULT_SIBLING_DEPTH });
      if (!r.ok) return err({ tag: "Repository", cause: r.error });
      return ok(r.value.map((p) => makeCandidate({ path: p, kind: "file", reason: "sibling-of" })));
    },

    async expandChildren(config, path, depth) {
      const r = await deps.scanner.listChildren({ path, depth: depth ?? 1 });
      if (!r.ok) return err({ tag: "Repository", cause: r.error });
      const home = config.path.home;
      const excludes = config.discovery.exclude;
      const out: DiscoveryCandidate[] = [];
      for (const entry of r.value) {
        const rel = relative(home, entry.path).split(sep).join("/");
        if (isExcludedPath(rel, excludes)) continue;
        out.push(
          makeCandidate({
            path: entry.path,
            kind: entry.isDir ? "directory" : "file",
            reason: "sibling-of",
          }),
        );
      }
      return ok(out);
    },

    decide(candidate, decision) {
      return { ...candidate, status: decisionToStatus(decision) };
    },
  };
}
