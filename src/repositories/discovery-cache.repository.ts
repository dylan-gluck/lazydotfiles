import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type DiscoveryCandidate, DiscoveryCandidateSchema } from "../domain/candidate";
import type { Config } from "../domain/config";
import { array } from "../domain/schema";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface DiscoveryCacheSnapshot {
  readonly queued: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
  readonly scannedAt: string;
}

export interface DiscoveryCacheRepository {
  readonly kind: "DiscoveryCacheRepository";
  load(configHash: string): Promise<Result<DiscoveryCacheSnapshot | null, RepoError>>;
  save(
    configHash: string,
    snapshot: { queued: readonly DiscoveryCandidate[]; autoTracked: readonly string[] },
  ): Promise<Result<void, RepoError>>;
  /**
   * Drop a single path from the cached snapshot if its config hash matches.
   * No-op when the cache is cold or stored under a different hash — a fresh
   * scan will rebuild the snapshot from the live filesystem anyway.
   */
  removePath(configHash: string, path: string): Promise<Result<void, RepoError>>;
  markDeferred(path: string): Promise<Result<void, RepoError>>;
  unmarkDeferred(path: string): Promise<Result<void, RepoError>>;
  loadDeferred(): Promise<Result<readonly string[], RepoError>>;
  close(): void;
}

export interface DiscoveryCacheRepositoryDeps {
  readonly getDbPath: () => string;
}

const QueuedSchema = array(DiscoveryCandidateSchema);

interface CacheRow {
  config_hash: string;
  scanned_at: string;
  payload: string;
}

/**
 * Compute the cache key from inputs that materially affect a scan's output.
 * Cache misses on home/include/exclude/auto_track changes; matches survive
 * unrelated edits (e.g. options.remote).
 */
export function discoveryConfigHash(config: Config): string {
  const slice = {
    home: config.path.home,
    auto_track: config.discovery.auto_track,
    include: [...config.discovery.include],
    exclude: [...config.discovery.exclude],
  };
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(JSON.stringify(slice));
  return hasher.digest("hex");
}

export function createDiscoveryCacheRepository(
  deps: DiscoveryCacheRepositoryDeps,
): DiscoveryCacheRepository {
  let db: Database | null = null;
  let openPath: string | null = null;

  async function ensureOpen(): Promise<Result<{ db: Database; path: string }, RepoError>> {
    const path = deps.getDbPath();
    if (db !== null && openPath === path) return ok({ db, path });
    if (db !== null) {
      db.close(false);
      db = null;
      openPath = null;
    }
    try {
      await mkdir(dirname(path), { recursive: true });
      const next = new Database(path, { create: true });
      next.run("PRAGMA journal_mode = WAL");
      next.run(
        "CREATE TABLE IF NOT EXISTS discovery_cache (id INTEGER PRIMARY KEY CHECK (id = 1), config_hash TEXT NOT NULL, scanned_at TEXT NOT NULL, payload TEXT NOT NULL)",
      );
      next.run(
        "CREATE TABLE IF NOT EXISTS deferred_paths (path TEXT PRIMARY KEY, deferred_at TEXT NOT NULL)",
      );
      db = next;
      openPath = path;
      return ok({ db: next, path });
    } catch (cause) {
      return err({ tag: "IoError", path, cause });
    }
  }

  return {
    kind: "DiscoveryCacheRepository",

    async load(configHash) {
      const opened = await ensureOpen();
      if (!opened.ok) return err(opened.error);
      const row = opened.value.db
        .query<CacheRow, []>(
          "SELECT config_hash, scanned_at, payload FROM discovery_cache WHERE id = 1",
        )
        .get();
      if (row === null) return ok(null);
      if (row.config_hash !== configHash) return ok(null);
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.payload);
      } catch (cause) {
        return err({
          tag: "ParseError",
          path: opened.value.path,
          issues: [{ message: cause instanceof Error ? cause.message : String(cause) }],
        });
      }
      if (typeof parsed !== "object" || parsed === null) {
        return err({
          tag: "ParseError",
          path: opened.value.path,
          issues: [{ message: "cache payload is not an object" }],
        });
      }
      const obj = parsed as { queued?: unknown; autoTracked?: unknown };
      const queuedRes = QueuedSchema["~standard"].validate(obj.queued ?? []);
      if (queuedRes.issues !== undefined) {
        return err({ tag: "ParseError", path: opened.value.path, issues: queuedRes.issues });
      }
      const autoTracked = obj.autoTracked;
      if (!Array.isArray(autoTracked) || autoTracked.some((s) => typeof s !== "string")) {
        return err({
          tag: "ParseError",
          path: opened.value.path,
          issues: [{ message: "autoTracked must be string[]" }],
        });
      }
      return ok({
        queued: queuedRes.value,
        autoTracked: autoTracked as readonly string[],
        scannedAt: row.scanned_at,
      });
    },

    async save(configHash, snapshot) {
      const opened = await ensureOpen();
      if (!opened.ok) return err(opened.error);
      const payload = JSON.stringify({
        queued: snapshot.queued,
        autoTracked: snapshot.autoTracked,
      });
      const scannedAt = new Date().toISOString();
      try {
        opened.value.db
          .query(
            "INSERT INTO discovery_cache (id, config_hash, scanned_at, payload) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET config_hash = excluded.config_hash, scanned_at = excluded.scanned_at, payload = excluded.payload",
          )
          .run(configHash, scannedAt, payload);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path: opened.value.path, cause });
      }
    },

    async removePath(configHash, path) {
      const current = await this.load(configHash);
      if (!current.ok) return err(current.error);
      if (current.value === null) return ok(undefined);
      const queued = current.value.queued.filter((c) => c.path !== path);
      const autoTracked = current.value.autoTracked.filter((p) => p !== path);
      if (
        queued.length === current.value.queued.length &&
        autoTracked.length === current.value.autoTracked.length
      ) {
        return ok(undefined);
      }
      return this.save(configHash, { queued, autoTracked });
    },

    async markDeferred(path) {
      const opened = await ensureOpen();
      if (!opened.ok) return err(opened.error);
      try {
        opened.value.db
          .query(
            "INSERT INTO deferred_paths (path, deferred_at) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET deferred_at = excluded.deferred_at",
          )
          .run(path, new Date().toISOString());
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path: opened.value.path, cause });
      }
    },

    async unmarkDeferred(path) {
      const opened = await ensureOpen();
      if (!opened.ok) return err(opened.error);
      try {
        opened.value.db.query("DELETE FROM deferred_paths WHERE path = ?").run(path);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path: opened.value.path, cause });
      }
    },

    async loadDeferred() {
      const opened = await ensureOpen();
      if (!opened.ok) return err(opened.error);
      try {
        const rows = opened.value.db
          .query<{ path: string }, []>("SELECT path FROM deferred_paths ORDER BY path")
          .all();
        return ok(rows.map((r) => r.path));
      } catch (cause) {
        return err({ tag: "IoError", path: opened.value.path, cause });
      }
    },

    close() {
      if (db !== null) {
        db.close(false);
        db = null;
        openPath = null;
      }
    },
  };
}
