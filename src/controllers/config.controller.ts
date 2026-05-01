import { useCallback, useEffect } from "react";
import { CONFIG_ACTOR_ID, type ConfigMessage, type ConfigState } from "../actors/config.actor";
import { useActor } from "../actors/use-actor";
import type { Config } from "../domain/config";
import type { ServiceError } from "../services/types";

export interface UseConfigPanel {
  readonly status: ConfigState["status"];
  readonly config: Config | null;
  readonly error: ServiceError | null;
  set(option: string, value: unknown): void;
  reload(): void;
}

export function useConfigPanel(): UseConfigPanel {
  const { state, send } = useActor<ConfigState, ConfigMessage>(CONFIG_ACTOR_ID);

  useEffect(() => {
    if (state.status === "idle") send({ kind: "load", payload: undefined });
    // mount-only: actor remembers its own load state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = useCallback(
    (option: string, value: unknown) => send({ kind: "set", payload: { option, value } }),
    [send],
  );
  const reload = useCallback(() => send({ kind: "load", payload: undefined }), [send]);

  return {
    status: state.status,
    config: state.config,
    error: state.error,
    set,
    reload,
  };
}
