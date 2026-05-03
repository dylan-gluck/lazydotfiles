# Spec: DiscoveryPanel snapshot test

- Bean: `ldf-6jbc`
- Parent: `ldf-auiv` (Discovery F2)
- ADR: 002 §4.7 (snapshot tests via `@opentui/react/test-utils`).
- Constitution §3.1, A8.

## Goal

Snapshot tests covering the four DiscoveryPanel rendering states: empty, scanning, ready-with-candidates, error. Stubbed model (no actor wiring) so the test verifies the view layer in isolation.

## Public surface

`src/views/panels/discovery-panel.test.tsx`. No exports.

## Internal design

- Imports `testRender` from `@opentui/react/test-utils` and the `DiscoveryPanel` view.
- Stubs `UseDiscoveryPanel` model objects per case. Each test uses a fixed viewport `width=80, height=24`.
- Wraps the component in `<ThemeProvider mode="dark">` so tokens resolve.
- Each test calls `renderOnce()` then `captureCharFrame().toMatchSnapshot()`.
- `afterEach` destroys the renderer.

## Tests

- `renders empty state when queue is empty` — model has `status: "ready", queue: []`. Frame contains `"No candidates"`.
- `renders sidebar entries grouped by parent dir for ready state` — model has two candidates under `/h/.config/fish/` and one under `/h`. Frame contains both basenames and the parent-dir labels.
- `renders scanning indicator` — model has `status: "scanning"`. Frame contains `"scanning"`.
- `renders error state` — model has `status: "error", error: { tag: "Repository", cause: { tag: "IoError", path: "/h", cause: new Error("boom") } }`. Frame contains `"boom"`.

## Acceptance

- All four snapshots stable across runs (terminal width fixed, no time/random in panel).
- Test passes under `bun test`.

## Review

Approved.
