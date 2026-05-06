import { type ReactNode, useCallback, useState } from "react";
import type { TrackedFile } from "../../domain/tracked-file";
import { useInputFocusEffect } from "./input-focus-context";
import { ConfirmModal } from "./confirm-modal";

export interface TrackingConfirmsCallbacks {
  /** Untrack a single tracked file. */
  onUntrack(file: TrackedFile): void;
  /** Track every pending candidate under a top-level segment. */
  onTrackGroup?(segment: string): void;
  /** Defer every pending candidate under a top-level segment. */
  onIgnoreGroup?(segment: string): void;
}

export interface TrackingConfirmsState {
  readonly modal: ReactNode;
  /** True when any modal is showing — block panel input. */
  readonly active: boolean;
  promptUntrack(file: TrackedFile): void;
  promptTrackGroup(segment: string): void;
  promptIgnoreGroup(segment: string): void;
}

/**
 * Shared confirm-modal flow used by panels that mutate the tracked set:
 * untrack a file, or bulk-track / bulk-ignore a top-level segment. Owns the
 * pending state, blocks panel input while a modal is showing, and renders the
 * modal node ready to drop into the panel tree.
 */
export function useTrackingConfirms(callbacks: TrackingConfirmsCallbacks): TrackingConfirmsState {
  const [pendingUntrack, setPendingUntrack] = useState<TrackedFile | null>(null);
  const [pendingTrackGroup, setPendingTrackGroup] = useState<string | null>(null);
  const [pendingIgnoreGroup, setPendingIgnoreGroup] = useState<string | null>(null);

  const active =
    pendingUntrack !== null || pendingTrackGroup !== null || pendingIgnoreGroup !== null;
  useInputFocusEffect(active);

  const promptUntrack = useCallback((file: TrackedFile) => setPendingUntrack(file), []);
  const promptTrackGroup = useCallback((segment: string) => setPendingTrackGroup(segment), []);
  const promptIgnoreGroup = useCallback((segment: string) => setPendingIgnoreGroup(segment), []);

  const modal = (
    <>
      {pendingUntrack !== null ? (
        <ConfirmModal
          title="Untrack file"
          summary={`Untrack ${pendingUntrack.target}? The symlink is replaced with the file at its current dotfiles content; jj history is preserved.`}
          paths={[pendingUntrack.target, pendingUntrack.source]}
          confirmLabel="Untrack"
          onConfirm={() => {
            callbacks.onUntrack(pendingUntrack);
            setPendingUntrack(null);
          }}
          onCancel={() => setPendingUntrack(null)}
        />
      ) : null}
      {pendingTrackGroup !== null ? (
        <ConfirmModal
          title="Track group"
          summary={`Track every pending candidate under ${pendingTrackGroup}? Each will be moved into the dotfiles repo and replaced with a symlink.`}
          paths={[pendingTrackGroup]}
          confirmLabel="Track"
          onConfirm={() => {
            callbacks.onTrackGroup?.(pendingTrackGroup);
            setPendingTrackGroup(null);
          }}
          onCancel={() => setPendingTrackGroup(null)}
        />
      ) : null}
      {pendingIgnoreGroup !== null ? (
        <ConfirmModal
          title="Ignore group"
          summary={`Defer every pending candidate under ${pendingIgnoreGroup}? Future scans will skip them.`}
          paths={[pendingIgnoreGroup]}
          confirmLabel="Ignore"
          onConfirm={() => {
            callbacks.onIgnoreGroup?.(pendingIgnoreGroup);
            setPendingIgnoreGroup(null);
          }}
          onCancel={() => setPendingIgnoreGroup(null)}
        />
      ) : null}
    </>
  );

  return { modal, active, promptUntrack, promptTrackGroup, promptIgnoreGroup };
}
