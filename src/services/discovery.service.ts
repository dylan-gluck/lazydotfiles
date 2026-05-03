import { relative } from "node:path";
import { type DiscoveryCandidate, makeCandidate } from "../domain/candidate";
import type { Config } from "../domain/config";
import { err, ok, type Result } from "../lib/result";
import { type FsScannerRepository, isGlobPattern } from "../repositories/fs-scanner.repository";
import type { ServiceError } from "./types";

export type DecisionKind = "accept" | "reject" | "defer";

export interface DiscoveryScanResult {
  readonly queued: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
}

export interface DiscoveryService {
  scan(config: Config): Promise<Result<DiscoveryScanResult, ServiceError>>;
  expandSiblings(
    path: string,
    depth?: number,
  ): Promise<Result<readonly DiscoveryCandidate[], ServiceError>>;
  decide(candidate: DiscoveryCandidate, decision: DecisionKind): DiscoveryCandidate;
}

export interface DiscoveryServiceDeps {
  readonly scanner: FsScannerRepository;
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
      for await (const abs of deps.scanner.scan({
        home,
        include: config.discovery.include,
        exclude: config.discovery.exclude,
      })) {
        if (auto && isAutoTrackPath(abs, home, config.discovery.include)) {
          if (deps.autoTrack !== undefined) {
            const r = await deps.autoTrack(abs);
            if (!r.ok) return err(r.error);
          }
          autoTracked.push(abs);
        } else {
          queued.push(makeCandidate({ path: abs, kind: "file", reason: "include" }));
        }
      }
      return ok({ queued, autoTracked });
    },

    async expandSiblings(path, depth) {
      const r = await deps.scanner.siblings({ path, depth: depth ?? DEFAULT_SIBLING_DEPTH });
      if (!r.ok) return err({ tag: "Repository", cause: r.error });
      return ok(r.value.map((p) => makeCandidate({ path: p, kind: "file", reason: "sibling-of" })));
    },

    decide(candidate, decision) {
      return { ...candidate, status: decisionToStatus(decision) };
    },
  };
}
