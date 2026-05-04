---
name: lazydotfiles
description: A typeset record of your working setup, jj-versioned and keyboard-first.
colors:
  page: "ansi:default-bg"
  body: "ansi:default-fg"
  the-mark: "ansi:bright-yellow"
  the-approval: "ansi:bright-green"
  the-correction: "ansi:bright-red"
  margin: "ansi:bright-black"
  verso-dark: "ansi:black"
  elevated-verso-dark: "ansi:bright-black"
  verso-light: "ansi:white"
  elevated-verso-light: "ansi:bright-white"
typography:
  body:
    fontFamily: "user-terminal-monospace"
    fontWeight: 400
  heading:
    fontFamily: "user-terminal-monospace"
    fontWeight: 700
  margin-note:
    fontFamily: "user-terminal-monospace"
    fontWeight: 400
  inverse-chip:
    fontFamily: "user-terminal-monospace"
    fontWeight: 700
spacing:
  sm: "1ch"
  md: "2ch"
  lg: "4ch"
components:
  panel-header-title:
    textColor: "{colors.body}"
    typography: "{typography.heading}"
  panel-header-summary:
    textColor: "{colors.margin}"
    typography: "{typography.margin-note}"
  list-row-default:
    textColor: "{colors.body}"
    typography: "{typography.body}"
  list-row-focused:
    textColor: "{colors.the-mark}"
    typography: "{typography.body}"
  list-row-success:
    textColor: "{colors.the-approval}"
    typography: "{typography.body}"
  list-row-danger:
    textColor: "{colors.the-correction}"
    typography: "{typography.body}"
  list-row-deferred:
    textColor: "{colors.margin}"
    typography: "{typography.body}"
  filter-chip-active:
    textColor: "{colors.the-approval}"
    typography: "{typography.heading}"
  filter-chip-inactive:
    textColor: "{colors.margin}"
    typography: "{typography.body}"
  footer-label-chip:
    backgroundColor: "{colors.the-mark}"
    textColor: "{colors.page}"
    typography: "{typography.inverse-chip}"
    padding: "0 1ch"
  footer-binding-key:
    textColor: "{colors.the-mark}"
    typography: "{typography.body}"
  footer-binding-desc:
    textColor: "{colors.margin}"
    typography: "{typography.margin-note}"
  modal-surface:
    backgroundColor: "{colors.elevated-verso-dark}"
    textColor: "{colors.body}"
    padding: "2ch"
  modal-confirm-label:
    textColor: "{colors.the-approval}"
    typography: "{typography.heading}"
  modal-cancel-label:
    textColor: "{colors.margin}"
    typography: "{typography.body}"
  toast-success:
    textColor: "{colors.the-approval}"
    typography: "{typography.body}"
  toast-default:
    textColor: "{colors.margin}"
    typography: "{typography.margin-note}"
  toast-danger:
    textColor: "{colors.the-correction}"
    typography: "{typography.body}"
---

# Design System: lazydotfiles

## 1. Overview

**Creative North Star: "The Manuscript"**

`ldf` reads like a typeset record of a working life. The `jj` op log is its manuscript: every change carries a description, a parent, and a hand. Surfaces are pages, focus is a margin mark, errors are red-pencil corrections, and secondary copy lives in the gutter. The reader is trusted; the chrome is absent.

This system explicitly rejects the four lanes named in PRODUCT.md: the generic lazy-family TUI clone (bordered tri-pane, cyan/magenta status bar); the Tokyo Night / Catppuccin pastel sea (it owns no hex, only ANSI); the hacker-maximalist ASCII flourish (no banners, no scanlines, no neon); and the SaaS dashboard hero-metric chrome (no card grids, no gradients).

Voice carries through visually. Composed, exact, quiet. Hierarchy comes from weight and rhythm, not borders or color. Color appears only when it changes the meaning of the row — focus, accept, defer, reject, danger.

**Key Characteristics:**

- Type does the layout work. Bold for emphasis, dim for secondary, default for body, color for state.
- Borders are an admission, not a default. Two exceptions: the modal surface (`border.emphasis`, "double") and any boxed input.
- One chrome chip exists on the whole shell — the active panel label in the footer, set in BOLD on a reversed-fg ground.
- Status is signaled at the row level, never through a separate badge column.
- Empty states are two lines: a default-weight statement and a dim hint.

## 2. Colors: The Manuscript Palette

`ldf` does not own its colors; the user's terminal does. Every value below is an ANSI token (default fg/bg or one of indices 0–15). The renderer hands them to the terminal unchanged, so re-skinning is a matter of changing the terminal theme, not editing this file.

### Primary
- **The Body** (`ansi:default-fg`): primary text. The voice of every panel.
- **The Mark** (`ansi:bright-yellow`, ANSI 11): the focused row, the active binding key in the footer, the cursor glyph `›`, the page-fg behind the panel-label chip. The single most-loaded color in the system.

### Secondary
- **The Approval** (`ansi:bright-green`, ANSI 10): "accepted", "tracked ok", "clean" repo, the active filter chip, the confirm button label. Affirmation only.
- **The Correction** (`ansi:bright-red`, ANSI 9): destructive verbs, "dirty" repo, "rejected" rows, panel error surfaces. Never used for decoration.

### Neutral
- **The Margin** (`ansi:bright-black`, ANSI 8): all secondary copy. Counts, hints, deferred rows, the binding descriptions in the footer, the toast rail when no event is in flight. Carries the most words on screen.
- **The Page** (`ansi:default-bg`): the canvas. Never tinted, never inverted outside the two named exceptions.
- **The Verso** (`ansi:black` dark / `ansi:white` light): a quieter surface used for the discovery-error inset and any boxed input that needs to read as "set apart" without claiming elevation.
- **The Elevated Verso** (`ansi:bright-black` dark / `ansi:bright-white` light): modal surface only.

### Named Rules

**The ANSI-Only Rule.** No hex literals in views. The codebase enforces this with a unit test (`views/theme/no-hex-literals.test.ts`); any color leaving the theme module MUST come from `RGBA.fromIndex(0–15)` or `RGBA.defaultForeground/Background()`. A hex string anywhere under `views/` is a merge blocker.

**The Color-Means-State Rule.** A row's color is its state — focused, ok, warning, deferred, error. If a row's color does not change the user's understanding of what it is, drop the color and use type weight instead.

**The One Chip Rule.** The reversed-fg label chip in the footer is the only inverse-color region in the chrome. A second chip, anywhere, is wrong.

## 3. Typography

**Display / Body / Mono Font:** the user's terminal monospace. There is exactly one font family. Hierarchy is built from text attributes and color, not size.

**Character:** terminal-grid, 1em-everywhere. Voice is composed and exact, the same rhythm a well-set technical book uses.

### Hierarchy
- **Heading** (`TextAttributes.BOLD`, fg = body): panel titles like `/discover`, `/log`, `/sync`, plus the modal title, the active filter chip, and the confirm-button label. Used sparingly; a heading on every line is no hierarchy.
- **Body** (default attribute, fg = body): the main reading line. List rows in default state, modal summary, status-panel header label.
- **Margin Note** (default attribute, fg = margin): every secondary or hinting line. Counts, descriptions, deferred status, footer binding descriptions, "scanning…", "remaining", trailing hint copy.
- **State** (default attribute, fg = role color): a list row carries its state in the foreground color of the line itself. No separate badge column.
- **Inverse Chip** (`TextAttributes.BOLD`, fg = page, bg = the-mark): the one footer label chip. Never used elsewhere.
- **Cursor Glyph** (`›`, fg = the-mark): single character at column 0 of a focused row. Substitutes for a focus ring; flexes around indented rows.

### Named Rules

**The Type-Carries-Rank Rule.** Sequence of fallbacks for emphasis: (1) weight (`BOLD`); (2) color role; (3) spacing or alignment; (4) a border, last resort. If you find yourself adding a border to make something read as important, you skipped a step.

**The No-Italics Rule.** Italics in a terminal monospace are unreliable across themes. Some render obliquely, some not at all. Don't reach for them. Use weight + color, never italics, for emphasis.

**The Two-Line Empty-State Rule.** Every empty state is a default-weight sentence followed by a dim hint. Three lines is too many; one line is too few.

## 4. Elevation

Flat-by-default. There are no shadows. The terminal cannot cast them, and the design refuses to fake them with characters. Depth shows up in exactly two regions:

- **The footer label chip.** A reversed-fg ground (the-mark behind page-fg) raises the active panel label out of the binding line. This is the only inverse region in the chrome.
- **Modal surfaces.** Confirm modals and the discovery-error inset use `bg.elevated` as a quiet ground, plus a `border.emphasis` ("double") outline. The double border is part of the depth signal — modal vs. panel — not decoration.

Everything else lives on `bg.default`. Panel headers, content bodies, footer-equivalent rows: all share one plane.

### Named Rules

**The Two-Region Depth Rule.** If a region is not the footer label chip or a modal, it is on `bg.default` with no border. No card-as-container. No nested surface tints. Depth is a switch with two positions.

**The Double-Border-Means-Modal Rule.** `border.emphasis` is reserved for modals and the discovery-error inset. A double border anywhere else is a mis-signal — the user expects modal semantics where there are none.

## 5. Components

Set in type, not built in boxes. Buttons are bracketed labels, rows are typeset lines with a cursor glyph, chips are filter labels with brackets when active. There are essentially no buttons-as-boxes, no cards-as-containers, no nested affordance shells.

### Buttons

- **Shape:** none. A button is a bracketed label inside a row, e.g. `[Confirm]`, `[Reject]`, `[u] undo`.
- **Confirm action:** BOLD + the-approval. Verb taken from the prop, never abbreviated.
- **Cancel / secondary:** default attribute + margin.
- **Hover / focus:** terminals have no hover. Focus is conveyed by the cursor glyph (`›`) at the start of the row that contains the action, or by the action being the only one rendered when context demands it.

### Rows (lists)

- **Cursor:** `›` for focused, single space for everything else, both at column 0. Indent comes after the cursor, never before.
- **Focused row:** entire line foreground is the-mark.
- **Status row:** entire line foreground is the role color (the-approval, the-correction, margin, or body for default).
- **Status word:** repeated as a literal token at the end of the row when meaningful (e.g. `accepted`, `deferred`), so a monochrome terminal reads the same line.
- **Hint:** when a row is focused and has actions, append a dim trailing string of letter keys (e.g. `  a·d·x`). Removed when the row loses focus.

### Chips (filter strip)

- **Active:** BOLD + the-approval, wrapped in literal brackets: `[pending 7]`.
- **Inactive:** default attribute + margin, padded with one space on each side: ` pending 7 `.
- **Never bordered.** The brackets are the affordance.

### Cards / Containers

There are none. The "cards" mentioned in the PRD are not cards in the visual sense — they are paragraphs of summary in a header, separated by `·` or `gap`. Group with spacing, not with a box.

### Inputs / Fields

- **Search input:** opens inline in the filter strip as `/<query>▌`. No border, no label. Focus is the cursor block at the end of the typed string.
- **Config field edit:** opens in a modal. The modal is the only place a boxed input appears.

### Navigation

- **Footer.** One row, height=1. Left → reverse-fg label chip with the active panel name. Center → the active panel's bindings, plus a global `? more` hint, separated by ` · ` in margin. Right → the current path in margin.
- **Help drawer.** Opens in place of the footer. Three column-major columns of `key  desc` rows. Key in the-mark, desc in margin. Sections are the active panel's bindings followed by the global keymap. Closed by `?` or `Esc`.

### Modal (signature component)

- **Surface:** `bg.elevated` + `border.emphasis` (double).
- **Heading:** BOLD + body fg, single line.
- **Summary:** body fg, single sentence.
- **Path bullets:** margin fg, leading `•`, one path per line, truncated to width.
- **Backup line (when applicable):** `backup → <path>` in margin.
- **Action row:** `[Confirm]` in BOLD + the-approval, then `[Cancel]` in margin. The literal verb is the prop's `confirmLabel`.
- **Trailing hint:** `enter/y confirm · esc/n cancel` in margin.
- **Dismissal:** `enter`/`y` confirms; `esc`/`n` cancels. No mouse path.

### Toast / event rail

- **Position:** bottom of the panel body, height=1, padded.
- **Tone:** success → the-approval; default → margin; danger → the-correction. No icon.
- **Decay:** four seconds. Pair with an undo affordance (`[u] undo`) when the action is reversible.

## 6. Do's and Don'ts

### Do:

- **Do** read color from `useTheme()` for every fg / bg / border. The theme module is the only place ANSI tokens live.
- **Do** signal focus with the `›` cursor glyph plus the-mark foreground on the entire row. Cursor + color together; never one alone.
- **Do** repeat status as a word when it carries meaning (`accepted`, `rejected`). A monochrome reader must read the same line.
- **Do** keep the chrome to one row of footer plus one chip. The active panel label is the only inverse-fg region in the whole shell.
- **Do** fold "card" content into a header row (`tracked · queued · sync`) separated by `·`. PRD "cards" are typographic groups, not boxes.
- **Do** use `space.sm` (1ch), `space.md` (2ch), `space.lg` (4ch) as the rhythm. Don't invent intermediate values.
- **Do** make modals carry `border.emphasis` and `bg.elevated`. That pair is the modal signal; preserve it.
- **Do** finish empty states in two lines: default-weight statement, dim hint.

### Don't:

- **Don't** ship a generic lazy-family TUI clone. No bordered tri-pane, no cyan/magenta status bar, no single-letter `q/?/r` row floating alone.
- **Don't** introduce Tokyo Night, Catppuccin, or any pastel-on-dark palette. The placeholder hex stubs from ADR-002's example were never the destination; the ANSI token system replaced them.
- **Don't** add hacker-maximalist ASCII: no banner art, no scanlines, no neon, no `figlet`.
- **Don't** build SaaS-dashboard chrome: no hero-metric template, no card grid of icon + heading + text, no gradient anything.
- **Don't** use `border-left` / `border-right` greater than 1 column as a colored stripe. OpenTUI does not make this easy; keep it that way.
- **Don't** wrap regions in a card to "group" them. Use spacing (`gap`, `padding`) and a margin-fg label instead.
- **Don't** put italics in body copy or labels. Some terminal themes render them obliquely, some not at all. Emphasis is BOLD only.
- **Don't** introduce a second inverse-fg region. The footer label chip is the one chip.
- **Don't** open a modal when an inline empty state, toast, or filter strip would do. Modals are reserved for confirmation of destructive operations.
- **Don't** hard-code width/height for layout flow. Constitution §2.2 bans it; flexbox is the only path.
- **Don't** rely on color alone for state. Pair every color with a glyph (`›`, `[…]`, `•`) or a literal status word.
- **Don't** decorate with color. If a color does not change the meaning of the line, it should not be there.
