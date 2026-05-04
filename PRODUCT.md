# Product

## Register

product

## Users

Two cohorts, one design — both live in a terminal, both keyboard-first.

- **Power user (primary).** Already in tmux + nvim + lazygit. Knows `jj` or has the shape of git. Reaches for `ldf` to triage discovered dotfiles, audit `jj op log`, recover from a bad change. Wants speed, density, and to be left alone. Hates hand-holding copy and decorative chrome.
- **Newcomer.** Comfortable in a shell, never used `jj` / `stow` / `chezmoi`. Reaches for `ldf` to start tracking dotfiles without ceremony. Needs an honest first run, defaults that don't bite, and recovery paths that work before they understand what they did. Should never feel talked down to.

The job, both cohorts: **make a dotfile change without losing yesterday's working setup**.

## Product Purpose

`ldf` is the keyboard-first surface for a `jj`-versioned dotfile repo — discover, track, version, sync, restore. Every destructive operation has a recoverable backup; every change has a `jj` op pointer. The TUI is the primary surface; the CLI is a thin shell over the same services.

Success = a power user runs `ldf` daily without thinking about it, and a first-time user gets from "no config" to "tracked `.zshrc` with rollback in the log" inside a single session.

## Brand Personality

**Composed. Exact. Quiet.**

Reads like a well-set technical book, not a control panel. Confidence shows through precision — accurate counts, honest state, exact paths — not through volume, color, or punctuation. No exclamation marks, no "Awesome!", no emoji. Errors name what failed and where the backup landed; they don't apologize. Empty states give one sentence and one action.

## Anti-references

What `ldf` must not look like:

- **Generic lazy-family clone.** Bordered tri-pane with cyan/magenta accents and a single-letter status bar of hints. The reflex answer for "TUI tool".
- **Tokyo Night / Catppuccin pastel.** The placeholder palette in `views/theme/theme.tsx` is a starting point, not the destination. Pastel sea on dark is the dev-tool cliche; `ldf` belongs to the ANSI lane.
- **Hacker-maximalist ASCII.** No banners, no scanlines, no neon. Wrong register entirely.
- **SaaS dashboard chrome.** No hero metric template, no card-grid, no gradient anything.

## Design Principles

1. **Type carries the rank.** Hierarchy comes from weight, scale, and spacing — not from borders or color. Borders are an admission that typography failed; reach for them last.
2. **ANSI as constraint, not aesthetic.** Work inside the 16-color terminal palette. Color signals state (dirty, conflict, danger, ok). Color never decorates. The user's terminal owns the actual hues.
3. **Density without clamor.** Show what's there at full fidelity — paths, counts, hashes, timestamps — and trust the reader. No decorative scaffolding to "soften" the data.
4. **Recoverable by default, visible by design.** Every destructive op surfaces its backup destination at the moment of the action. Trust comes from transparency about state, not from confirmation walls.
5. **Honest first run.** Onboarding, empty states, and recovery paths are designed surfaces, not afterthoughts — but they never assume the user is slow. One sentence, one action, then out of the way.

## Accessibility & Inclusion

- **ANSI palette only.** Ship colors as ANSI named values (`red`, `cyan`, etc.) or 256-index, never hex. The terminal owns the actual rendering; contrast is the user's theme's responsibility, not ours. Contrast ratios are not asserted in DESIGN.md and not gated in CI.
- **Never color-only state.** Pair every color signal with a glyph, weight, or label. A user with a monochrome terminal must still read the same UI.
- **Reduced motion respected.** Honor `NO_MOTION` / equivalent terminal hints; default motion stays subtle (no decorative animation, only state-transition feedback).
- **Keyboard parity.** Every action reachable from a keystroke. Mouse is not assumed.
