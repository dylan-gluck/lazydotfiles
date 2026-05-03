import type { Config } from "../domain/config";
import type { StandardSchemaV1 } from "../domain/schema";
import type { Result } from "../lib/result";

export type RepoError =
  | { readonly tag: "NotFound"; readonly path: string }
  | {
      readonly tag: "ParseError";
      readonly path: string;
      readonly issues: readonly StandardSchemaV1.Issue[];
    }
  | { readonly tag: "IoError"; readonly path: string; readonly cause: unknown }
  | {
      readonly tag: "Spawn";
      readonly command: readonly string[];
      readonly exitCode: number;
      readonly stderr: string;
    };

export interface ConfigRepository {
  readonly kind: "ConfigRepository";
  readonly path: string;
  load(): Promise<Result<Config, RepoError>>;
  save(config: Config): Promise<Result<void, RepoError>>;
}
