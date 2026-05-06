# `ldf` — Views & Layout Spec (v2)

This document captures the consolidated TUI layout shipped in `Wireframes v2.html`. It supersedes the 7-page MVP layout. Three views replace the previous tabs: **status**, **files**, **logs**. Config and help are modal/overlay-only.

All views share one global header and one global footer. Sections inside a view are separated by a dotted rule and 1 line of padding above and below.

---

## 1. Global components

### 1.1 Header

A single row at the top of every view. No borders. Two slots, both reading-line height.

| Slot | Content | Style |
|------|---------|-------|
| Left | `~/dotfiles  ·  main @ <short-hash>` | Path is body weight (BOLD); branch + hash is margin-fg |
| Right | `<n> tracked · <m> untracked` | margin-fg |

- The header is identical across **status**, **files**, **logs**.
- Counts in the right slot reflect repo-wide totals, not the current view's filter.
- A rule separates the header from the body.
- The header **MUST NOT** carry the dirty chip, view name, or any keybind hints. Those belong elsewhere.

### 1.2 Footer

A single row at the bottom of every view. Three slots.

| Slot | Content | Style |
|------|---------|-------|
| Left | View label chip — `status` / `files` / `logs` | BOLD, page-fg on the-mark bg (the One Chip) |
| Center | Context-sensitive bindings, separated by ` · ` | Keys in body weight, descriptions in margin-fg |
| Right | `↑<ahead> ↓<behind>` | Bold counter; margin-fg when both are 0, body-fg when non-zero |

- The footer is the **only** place ahead/behind appears.
- The footer **MUST NOT** carry a current-path string.
- Bindings shown in the center slot are scoped to the **focused element** (see §5).

### 1.3 Sections

Every page is composed of `Section` blocks.

- Each section has 1 line of padding above and 1 line of padding below.
- Adjacent sections are divided by a dotted horizontal rule.
- Section titles are formatted as a two-column row: bold label on the left, dim metadata (count or descriptor) on the right. Both align to a consistent left + right gutter so titles in adjacent columns line up.

---

## 2. View 1 — `status`

Margin-note manuscript layout. One scrollable column. The whole repo at a glance.

### 2.1 Layout

```
┌─ header ───────────────────────────────────────────┐
│ ~/dotfiles · main @ 650fcf3e   20 tracked · 5769 untracked │
├─ rule ─────────────────────────────────────────────┤
│                                                    │
│ Section: tracked                                   │
│   <margin>     <body>                              │
│   20 tracked   tracked                             │
│   2h · bk·4    + .zshrc                            │
│   1d · bk·2    + .config/fish/config.fish          │
│   …            14 more                             │
│                                                    │
│ — divider —                                        │
│                                                    │
│ Section: untracked                                 │
│   5769 pending  untracked                          │
│   5d            ? .config/wezterm/wezterm.lua  !   │
│   5364          ? .claude                          │
│   …             48 more groups · enter to open     │
│                                                    │
│ — divider —                                        │
│                                                    │
│ Section: remote                                    │
│   ↑0 ↓0         remote                             │
│   2m ago        · git@github.com:…/dotfiles.git    │
│   auto          · hourly · next 58m                │
│                                                    │
│ — divider —                                        │
│                                                    │
│ Section: logs                                      │
│   5 of 142      logs                               │
│   4h ago        a4f29c1  track …/plugins.lua       │
│   …                                                │
├─ footer ───────────────────────────────────────────┤
│ [status]  ↑/↓ select · enter details · u untrack · s sync · ? help   ↑0 ↓0 │
└────────────────────────────────────────────────────┘
```

### 2.2 Sections

The view always renders four sections in order:

1. **`tracked`** — first ~6 tracked files plus a "N more" footer row.
2. **`untracked`** — top untracked groups by candidate count, plus warnings.
3. **`remote`** — ahead/behind, remote URL, auto-sync schedule.
4. **`logs`** — last 5 ops; each row shows time · short-hash · description.

### 2.3 Empty states

When `untracked` is empty:

```
—   nothing pending · press r to rescan
```

(Two-line empty state rule: default-weight statement + dim hint.)

---

## 3. View 2 — `files`

Two equal columns. Left column lists every file, split into `tracked` and `untracked` halves. Right column shows the focused file's detail and contents.

### 3.1 Layout

```
┌─ header ──────────────────────────────────────────────────────────┐
│ ~/dotfiles · main @ 650fcf3e         20 tracked · 5769 untracked  │
├─ rule ────────────────────────────────────────────────────────────┤
│ ── LEFT ─────────────────────│ ── RIGHT ───────────────────────── │
│ Section: tracked    touched  │ Section: .config/fish/config.fish  │
│   .zshrc                 2h  │   tracked                          │
│ › .config/fish/config.f… 1d  │                                    │
│   .config/nvim/init.lua  4h  │   source    ~/.config/fish/conf…   │
│   …                          │   target    ~/dotfiles/.config/…   │
│   (scrolls)                  │   kind      shell-config · 1.4 KB  │
│                              │   added     12d ago                │
│ — divider —                  │   backups   2 · most recent 1d ago │
│ Section: untracked   count   │   jj op     a4f29c1 track …        │
│ ▶ .claude               5364 │   perms     0644 · symlink valid   │
│ ▼ .config                405 │                                    │
│   ▶ .crush                 6 │ — divider —                        │
│   ▶ aerospace              1 │ Section: contents                  │
│   …                          │   1  # ~/.config/fish/config.fish  │
│   (scrolls independently)    │   2                                │
│                              │   3  set -gx EDITOR nvim           │
│                              │   …  (scrolls)                     │
├─ footer ──────────────────────────────────────────────────────────┤
│ [files]  ↑/↓ select · tab col · d diff · u untrack · i ignore · s sync · ? help   ↑0 ↓0 │
└───────────────────────────────────────────────────────────────────┘
```

### 3.2 Left column — equal halves

- The left column is split vertically into two equal halves: `tracked` (top) and `untracked` (bottom).
- Each half scrolls independently. The split line stays fixed regardless of overflow.
- Both halves share a column structure: section title row (`label` left, dim meta right), then a list of aligned rows.
- Aligned rows use the same left + right gutter as the section titles, so file names align across the divide and so do their right-side metadata (`touched` for tracked, `count` for untracked).

### 3.3 Right column — focused file detail

Two sections, top to bottom:

1. **Metadata header** — section title is the file's tracked path; right meta says `tracked` / `untracked` / `broken`. Body is a key-value block: `source`, `target`, `kind`, `added`, `backups`, `jj op`, `perms`.
2. **`contents`** — preview of the file using the shared line-numbered code block (see §6.1). Right meta on the title says `d for diff vs working copy`.

The right column scrolls as a single region.

### 3.4 Empty states

- Untracked half empty → "No untracked candidates. / press r to rescan".
- No tracked file focused → metadata header reads "select a file" with no body.

---

## 4. View 3 — `logs`

Two equal columns. Left column lists revisions. Right column shows focused revision metadata + diff.

### 4.1 Layout

```
┌─ header ──────────────────────────────────────────────────────────┐
│ ~/dotfiles · main @ 650fcf3e         20 tracked · 5769 untracked  │
├─ rule ────────────────────────────────────────────────────────────┤
│ ── LEFT ─────────────────────│ ── RIGHT ───────────────────────── │
│ Section: revisions     142   │ Section: track …/plugins.lua       │
│ › a4f29c1f track …pl 4h ago  │   track · 4h ago                   │
│   9b14002a edit .zsh 2h ago  │                                    │
│   3e88a7d2 track .cl 1d ago  │   hash      a4f29c1f3b8e2c105d…    │
│   1f0ee92b sync · pu 1d ago  │   parent    9b14002a · edit .zshrc │
│   ee14b890 track …mi 2d ago  │   kind      track                  │
│   c302a781 edit …key 2d ago  │   author    you · @ghostty         │
│   …                          │   at        2026-05-06 12:12       │
│   (extends to column         │   files     1 changed · +11 −0     │
│    bottom and scrolls)       │   jj op     describe -m "track …"  │
│                              │   backup    ~/.dotfiles.bak/a4f2/… │
│                              │                                    │
│                              │ — divider —                        │
│                              │ Section: diff       …+11 −0        │
│                              │     --- a/.config/nvim/…           │
│                              │     +++ b/.config/nvim/…           │
│                              │     @@ -1,4 +1,12 @@               │
│                              │   1 return {                       │
│                              │   2   { 'folke/tokyonight.nvim' }, │
│                              │   3   { 'nvim-lua/plenary.nvim' }, │
│                              │   4 + { 'nvim-telescope/…' },      │
│                              │   …  (scrolls)                     │
├─ footer ──────────────────────────────────────────────────────────┤
│ [logs]  ↑/↓ select · f fetch · p push · s sync · ? help              ↑0 ↓0 │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Left column — revisions list

- Single section titled `revisions`. Right meta shows visible-count and total (`21 · 142 total`).
- Each row: `<short-hash>  <description>` on the left, `<at>` on the right.
- The list extends to the bottom of the column and overflows with a scrollbar.
- The focused revision is body-fg with the `›` cursor; all others are margin-fg.

### 4.3 Right column — focused revision detail

Two sections:

1. **Revision title + metadata** — section title is the revision's description (e.g. `track .config/nvim/lua/plugins.lua`); right meta says `<kind> · <at>`. Body is a key-value block: `hash`, `parent`, `kind`, `author`, `at`, `files`, `jj op`, `backup`.
2. **`diff`** — shared line-numbered code block (see §6.1). Right meta on the title shows `<file> · +<a> −<d>`. Lines are colored: hunk headers dim, additions BOLD body-fg, deletions the-correction.

The right column scrolls as a single region.

---

## 5. Keybinds — by focused context

The footer's center slot reflects the actions available **on the currently focused element**. The list is short and verb-first.

### 5.1 `status` view

| Focused element | Bindings |
|------------------|----------|
| any tracked row | `↑/↓` select · `enter` details · `u` untrack · `s` sync · `?` help |
| any untracked row | `↑/↓` select · `enter` details · `t` track · `i` ignore · `s` sync · `?` help |
| any log row | `↑/↓` select · `enter` details · `f` fetch · `p` push · `s` sync · `?` help |

### 5.2 `files` view

| Focused element | Bindings |
|------------------|----------|
| left column · tracked row | `↑/↓` select · `tab` col · `d` diff · `u` untrack · `i` ignore · `s` sync · `?` help |
| left column · untracked row | `↑/↓` select · `tab` col · `t` track · `i` ignore · `s` sync · `?` help |

### 5.3 `logs` view

| Focused element | Bindings |
|------------------|----------|
| left column · revision | `↑/↓` select · `f` fetch · `p` push · `s` sync · `?` help |

### 5.4 `?` — extended keybind drawer

The footer's center slot is intentionally short — it shows only the most-likely actions for the focused element. Pressing `?` opens an overlay drawer that lists **everything** available right now, organised in two sections.

**Context-aware commands** — additional verbs available on the current focus that didn't make it into the footer. Examples:

| Context | Extra commands |
|---------|----------------|
| `files` · untracked row | `shift+T` track group · `shift+I` ignore group · `enter` expand · `e` edit pattern |
| `files` · tracked row | `e` edit · `b` backups · `shift+U` untrack group |
| `status` · untracked row | `shift+T` track group · `shift+I` ignore group |
| `logs` · revision | `shift+R` restore to here · `b` open backup · `y` yank hash |
| `logs` · diff line | `shift+R` restore to here · `b` restore from backup |

**Global commands** — always available, no matter what's focused:

| Key | Action |
|-----|--------|
| `1` | switch to **status** |
| `2` | switch to **files** |
| `3` | switch to **logs** |
| `r` | rescan filesystem (refresh untracked candidates) |
| `shift+R` | full re-index (drop discovery cache + rescan) |
| `s` | sync (fetch + push, run hooks) |
| `f` | fetch from remote |
| `p` | push to remote |
| `?` | toggle this drawer |
| `q` | quit |

The drawer is non-modal-blocking for read-only browsing: arrow keys still navigate the underlying view so you can scan a binding and execute it without closing the drawer first. Any verb command (`u`, `i`, `s`, etc.) closes the drawer as it runs.

---

## 6. Shared building blocks

### 6.1 Line-numbered code block

Used by the `contents` section in `files` and the `diff` section in `logs`. Identical structure in both:

- Each line is a flex row of `<num>` + 1ch gap + `<text>`.
- `<num>` is right-aligned, dim, fixed at 4ch, non-selectable.
- Hunk headers (`---`, `+++`, `@@ … @@`) render with no number and use margin-fg.
- Additions render BOLD body-fg with their post-image line number.
- Deletions render the-correction without a line number (they don't exist in the new file).
- Plain context lines render in body weight with their post-image line number.

### 6.2 Aligned two-column row

Used by section titles, tracked/untracked rows in `files`, and revision rows in `logs`.

- Left cell starts at the column's left padding, can truncate with ellipsis.
- Right cell hugs the column's right padding and never truncates.
- Two such rows stacked in the same column — title and data — line up gutter to gutter.

---

## 7. Notes on dropped surfaces

- `/about`, `/config`, `/sync`, `/tracked`, `/log` (as separate pages) are removed. Their content is folded:
  - **home** → `status` view
  - **tracked + untracked** → `files` view
  - **log** → `logs` view
  - **config** → removed
  - **about** → removed
- Reduced-tab navigation (`1 status`, `2 files`, `3 logs`) is **not** drawn in the chrome. View switching is keyboard-only via the digits and `g s` / `g f` / `g l` aliases.
- The dirty chip is gone. Repo state is read from the ahead/behind footer counter, the `remote` section in `status`, and per-file warnings in `files`.
