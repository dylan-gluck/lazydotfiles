# Spec: HelpOverlay (PRD §8.7)

- **Bean:** `ldf-73of` (parent epic `ldf-kkzc`)
- **PRD:** §8.7
- **ADR:** ADR-002 §4.5 (keymap is the source of truth).

## Goal

A modal overlay that lists `globalKeymap` as `keys → description` rows. Toggled by `?`; closes on `?` again or `Esc`.

## Public surface

`src/views/components/help-overlay.tsx`:

```tsx
export interface HelpOverlayProps {
  readonly bindings: readonly Binding[];
  onClose(): void;
}
export function HelpOverlay(props: HelpOverlayProps): ReactNode;
```

`src/views/components/help-overlay-context.tsx`:

```ts
export interface HelpOverlayController {
  readonly open: boolean;
  toggle(): void;
  close(): void;
}
export const HelpOverlayContext: Context<HelpOverlayController>;
export function HelpOverlayProvider(p: { children: ReactNode }): ReactNode;
export function useHelpOverlay(): HelpOverlayController;
```

`global-keys.tsx` consumes `useHelpOverlay()` and binds the `?` key via the existing keymap entry by passing `toggleHelp: ctrl.toggle` into the `KeymapContext`.

`index.tsx` wraps the app: `<HelpOverlayProvider><GlobalKeys/><RouterProvider/>{help.open && <HelpOverlay …/>}</HelpOverlayProvider>`.

## Internal design

- `HelpOverlayProvider` owns `useState<boolean>(false)`; exposes `toggle` and `close`. This is transient UI state (allowed by §2.3 — modal stack is interaction-local; we are intentionally not introducing a `ui` actor for a single-flag toggle, per YAGNI §1.3). If a second cross-route modal arrives, extract to a `ui` actor at that point.
- `HelpOverlay` `useKeyboard`: `"escape"` → `onClose()`; `"?"` → `onClose()`. Renders centered modal box (`flexGrow=1 alignItems=center justifyContent=center`).
- Two-column layout: left column lists `binding.keys.join(", ")`, right column lists `binding.description`. Implemented with two `flexDirection="column"` siblings inside a `flexDirection="row"` parent (no CSS grid).

## Dependencies

- `controllers/keymap.ts` for the binding type and the live table.
- `views/theme` for tokens.

## Tests

`src/views/components/help-overlay.test.tsx`:

- `renders one row per binding`
- `renders keys and description columns`
- `escape calls onClose`

`src/views/components/help-overlay-context.test.tsx`:

- `provider initial state is closed`
- `toggle flips open`
- `close sets to false`

## Acceptance

- Pressing `?` from any route opens the overlay listing the current `globalKeymap`.
- `?` and `Esc` close it.

## Review

ADR-002 §4.5 explicitly names this as a derived view. Implementation matches.
