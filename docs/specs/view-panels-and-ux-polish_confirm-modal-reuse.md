# Spec: Confirmation modal — reuse audit

- **Bean:** part of phase ldf-kkzc (no dedicated child task; tracked here for completeness).
- **PRD:** §8.8

## Goal

Verify the existing `ConfirmModal` covers PRD §8.8 (title, summary, paths, backup destination, two buttons, `Esc` cancels) and is reused by every destructive op.

## Audit results

- Title / summary / paths / backupDestination / confirm + cancel labels: present in `src/views/components/confirm-modal.tsx`.
- `Esc` and `n` cancel; `Enter`/`y` confirm: present.
- Reuse: `tracked-panel.tsx` (untrack), `log-panel.tsx` (restore op + restore from backup). Add wiring is via TrackedPanel (untrack) — covered. There is no add-from-Tracked path; add lives in DiscoveryPanel which is queue-driven and already routes through the `track` actor with `confirm` semantics deferred to the actor. **No new modal usage required.**

## Acceptance

- Existing snapshot test in `confirm-modal.test.tsx` passes.
- No drift; no rewrites required.

## Review

PRD §8.8 satisfied by existing component.
