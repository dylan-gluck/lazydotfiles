# Spec: ConfigPanel (PRD §8.6)

- **Bean:** `ldf-axjs` (parent epic `ldf-kkzc`)
- **PRD:** §8.6 / A8 / A9
- **ADR:** ADR-002 §4.6.

## Goal

Read-edit-save UI for `Config` under route `/config` (replaces placeholder `/settings`). Sections: `Paths`, `Discovery`, `Options`, `Experimental`. Each row label · value · `Enter` to edit; edit opens a focused inline modal; save writes through `config.service` and surfaces validation errors before save.

## Public surface

`src/controllers/config.controller.ts`:

```ts
export interface UseConfigPanel {
  readonly status: "idle" | "loading" | "ready" | "saving" | "error";
  readonly config: Config | null;
  readonly error: ServiceError | null;
  set(option: string, value: unknown): void;
}
export function useConfigPanel(): UseConfigPanel;
```

`src/views/panels/config-panel.tsx`:

```tsx
export interface ConfigPanelProps {
  readonly model: UseConfigPanel;
}
export function ConfigPanel(props: ConfigPanelProps): ReactNode;
```

Route file `src/routes/config.tsx`. The old `src/routes/settings.tsx` is **deleted**; `routeTree.gen.ts` is regenerated. Keymap binding `"3"` description changes from `Settings` to `Config` and navigates to `/config`. Root hint string updated.

## Internal design

- Controller reads `ConfigState` from `CONFIG_ACTOR_ID`. `set()` sends `{ kind: "set", payload: { option, value } }`.
- Sections rendered as ordered groups derived from `KNOWN_OPTIONS` from `services/config.service`.
- Editable rows: each non-array field is rendered with current value (booleans show `true`/`false`, strings raw, intervals as enum). Arrays (`include`, `exclude`) render as `[a, b, c]` joined; editing arrays is **out of scope** (banner `(use config.toml)`); booleans toggle on `Enter` without modal; scalars open an inline `<input/>` overlay.
- Inline editor uses local `useState` for the draft (transient interaction state, allowed by §2.3). On submit, calls `model.set(option, parsed)`. Validation errors from service surface in a footer line; the editor stays open until the user cancels.

## Layout

`column flexGrow=1` with sections — each section a labeled `<box>` with `borderStyle=t.border.default`. Row: `flexDirection="row" gap=md`, columns are siblings with `flexGrow=1` (label) and `flexGrow=2` (value). Editor modal: same shape as `ConfirmModal` (centered overlay).

## Dependencies

- `actors/config.actor.ts`, `services/config.service.ts` (existing).
- `views/components/summarize-error.ts`.

## Tests (`src/views/panels/config-panel.test.tsx`)

- `renders all sections with current values`
- `renders loading state when model.status === "loading"`
- `renders error state when service returns ServiceError`
- `boolean toggle calls set with negation`
- `scalar enter opens editor; submit calls set; validation error renders without closing`

## Acceptance

- `/config` renders the panel.
- `set` round-trips through `config.service` (covered by service unit tests already; controller wires actor).
- No hex literals; no hand-rolled width/height.

## Review

PRD §8.6 fully satisfied. Route renamed to match PRD.
