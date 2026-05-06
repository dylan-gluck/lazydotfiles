// V2 wireframes — three views: status / files / logs
// Header: ~/dotfiles · main · 20 tracked · 5769 untracked (consistent across views)
// Footer: chip + bindings on left, ahead/behind on the right (consistent)
// Section: 1 line padding top/bottom, dotted divider between sections

function V2Header({ tweaks }) {
  const fullQueue = tweaks.fullQueue;
  return (
    <>
      <div className="wf-header">
        <div>
          <span className="wf-header__path">~/dotfiles</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span className="wf-header__meta">main @ 650fcf3e</span>
        </div>
        <div className="wf-header__right">
          <span style={{color:"#999"}}>20 tracked · {fullQueue ? "5769" : "0"} untracked</span>
        </div>
      </div>
      <hr className="wf-rule"/>
    </>
  );
}

function V2Footer({ chip, bindings, tweaks }) {
  const dirty = tweaks.dirty;
  const ahead = dirty ? 3 : 0;
  const behind = dirty ? 1 : 0;
  return (
    <div className="wf-footer">
      <span className="wf-footer__chip">{chip}</span>
      <span className="wf-footer__bindings">{bindings}</span>
      <span className="wf-footer__path" style={{color: dirty ? "#1a1a1a" : "#999", fontWeight: 700}}>
        ↑{ahead} ↓{behind}
      </span>
    </div>
  );
}

const Margin = ({ children }) => (
  <span style={{display:"inline-block", width:"14ch", color:"#999", textAlign:"right", paddingRight:"2ch"}}>{children}</span>
);

// Section wrapper — gives 1 line padding top + bottom and a dotted divider between sections
function Section({ children }) {
  return <div className="wf-section">{children}</div>;
}

// Two-column section title: label on the left, count/timestamp on the right.
// Used in files view to align tracked/untracked headers AND row metadata.
function SectionTitle({ label, right }) {
  return (
    <div style={{display:"flex", justifyContent:"space-between", padding:"0 2ch", color:"#999"}}>
      <span><b style={{color:"#1a1a1a"}}>{label}</b></span>
      {right && <span>{right}</span>}
    </div>
  );
}

// Aligned two-column row: name on the left, meta on the right. Same column structure as SectionTitle.
function AlignedRow({ left, right, focus, dim, danger }) {
  const cls = "wf-row " + (focus ? "wf-row--focus " : "") + (dim ? "wf-row--dim " : "");
  return (
    <div className={cls} style={{display:"flex", justifyContent:"space-between"}}>
      <span style={{display:"flex", minWidth:0}}>
        <span className="cur"></span>
        <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{left}</span>
        {danger && <span style={{color:"#b13a2e", marginLeft:"1ch"}}>!</span>}
      </span>
      <span style={{color: focus ? "inherit" : "#999", whiteSpace:"nowrap", paddingLeft:"2ch"}}>{right}</span>
    </div>
  );
}

// Shared line-numbered code block. Items are { text, kind } where kind in
// "add" | "del" | "hunk" | undefined.
function CodeBlock({ lines, startNumber = 1, showHunkNoNumber = true }) {
  let n = startNumber - 1;
  return (
    <div className="wf-code">
      {lines.map((ln, i) => {
        const isHunk = ln.kind === "hunk";
        let num;
        if (isHunk && showHunkNoNumber) {
          num = "";
        } else if (ln.kind === "del") {
          // deletions don't increment the new-file line number
          num = "";
        } else {
          n += 1;
          num = String(n);
        }
        return (
          <div key={i} className="wf-code__line">
            <span className="wf-code__num">{num}</span>
            <span className={
              "wf-code__txt" +
              (ln.kind === "add" ? " wf-code__txt--add" : "") +
              (ln.kind === "del" ? " wf-code__txt--del" : "") +
              (ln.kind === "hunk" ? " wf-code__txt--hunk" : "")
            }>{ln.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// =================================================================
// View 1 — status (margin-note manuscript)
// =================================================================
function V2Status({ tweaks }) {
  const fullQueue = tweaks.fullQueue;

  return (
    <div className="wf">
      <V2Header tweaks={tweaks} />

      <div style={{flex:"1 1 auto", overflow:"auto"}}>
        <Section>
          <Row><Margin>20 tracked</Margin><b>tracked</b></Row>
          {ldfData.tracked.slice(0, 6).map((t, i) => (
            <Row key={t.path} focus={i===0}>
              <Margin>{t.touched + " · bk·" + t.bk}</Margin>
              <span>+ {t.path}</span>
              {t.warn && <span style={{color:"#b13a2e", marginLeft:"2ch"}}>! {t.warn}</span>}
            </Row>
          ))}
          <Row dim><Margin>…</Margin>14 more</Row>
        </Section>

        <Section>
          <Row>
            <Margin>{fullQueue ? "5769 pending" : "0 pending"}</Margin>
            <b>untracked</b>
          </Row>
          {fullQueue ? (
            <>
              <Row dim><Margin>5d</Margin>? .config/wezterm/wezterm.lua <span style={{color:"#b13a2e", marginLeft:"1ch"}}>! broken symlink</span></Row>
              <Row dim><Margin>5364</Margin>? .claude</Row>
              <Row dim><Margin>405</Margin>? .config <span style={{color:"#c8c8c4"}}>(8 dirs)</span></Row>
              <Row dim><Margin>13</Margin>? .config/broot</Row>
              <Row dim><Margin>13</Margin>? .config/crush</Row>
              <Row dim><Margin>6</Margin>? .config/.crush</Row>
              <Row dim><Margin>…</Margin>48 more groups · enter to open</Row>
            </>
          ) : (
            <Row dim><Margin>—</Margin>nothing pending · press r to rescan</Row>
          )}
        </Section>

        <Section>
          <Row><Margin>{tweaks.dirty ? "↑3 ↓1" : "↑0 ↓0"}</Margin><b>remote</b></Row>
          <Row dim><Margin>2m ago</Margin>· git@github.com:dylan-gluck/dotfiles.git</Row>
          <Row dim><Margin>auto</Margin>· hourly · next 58m</Row>
        </Section>

        <Section>
          <Row><Margin>5 of 142</Margin><b>logs</b></Row>
          {ldfData.ops.map((op) => (
            <Row key={op.hash} dim>
              <Margin>{op.at}</Margin>
              <span>{op.hash.slice(0,7)}  {op.desc}</span>
            </Row>
          ))}
        </Section>
      </div>

      <V2Footer
        chip="status"
        tweaks={tweaks}
        bindings={<>
          <b>↑/↓</b> select · <b>enter</b> details · <b>u</b> untrack · <b>s</b> sync · <b>?</b> help
        </>}
      />
    </div>
  );
}

// =================================================================
// View 2 — files (two columns: lists ↔ detail)
// Tracked & untracked are equal-height, each scrolls. Aligned columns.
// =================================================================
function V2Files({ tweaks }) {
  const fullQueue = tweaks.fullQueue;

  const previewLines = [
    { text: "# ~/.config/fish/config.fish" },
    { text: "" },
    { text: "set -gx EDITOR nvim" },
    { text: "set -gx VISUAL nvim" },
    { text: "set -gx PAGER less" },
    { text: "" },
    { text: "fish_add_path ~/bin" },
    { text: "fish_add_path ~/.local/bin" },
    { text: "fish_add_path ~/.cargo/bin" },
    { text: "" },
    { text: "if status is-interactive" },
    { text: "    starship init fish | source" },
    { text: "    atuin init fish | source" },
    { text: "    zoxide init fish | source" },
    { text: "end" },
    { text: "" },
    { text: "alias g=git" },
    { text: "alias gs='git status'" },
    { text: "alias gco='git checkout'" },
    { text: "alias jj='jj --no-pager'" },
    { text: "" },
    { text: "abbr -a -- - 'cd -'" },
    { text: "abbr -a gp 'git push'" },
  ];

  // Untracked list (flat — meta on the right matches tracked column)
  const untracked = fullQueue ? [
    { name: "▶ .claude",            indent: 0, count: "5364" },
    { name: "▼ .config",            indent: 0, count: "405"  },
    { name: "▶ .crush",             indent: 1, count: "6"    },
    { name: "▶ aerospace",          indent: 1, count: "1"    },
    { name: "▶ atuin",              indent: 1, count: "1"    },
    { name: "▶ broot",              indent: 1, count: "13"   },
    { name: "▶ calcure",            indent: 1, count: "5"    },
    { name: "▶ containers",         indent: 1, count: "5"    },
    { name: "▶ crush",              indent: 1, count: "13"   },
    { name: "▶ wezterm",            indent: 1, count: "2"    },
    { name: "▶ .local",             indent: 0, count: "0"    },
    { name: "▶ .cache",             indent: 0, count: "0"    },
    { name: "▶ .ssh",               indent: 0, count: "3"    },
    { name: "▶ .gnupg",             indent: 0, count: "2"    },
    { name: "▶ Library/Preferences",indent: 0, count: "84"   },
  ] : [];

  return (
    <div className="wf">
      <V2Header tweaks={tweaks} />

      <div className="wf-body">
        {/* LEFT column: tracked + untracked, equal halves, each scrolls */}
        <div className="wf-col" style={{padding: 0, display:"flex", flexDirection:"column"}}>
          {/* tracked half */}
          <div style={{flex:"1 1 0", minHeight: 0, display:"flex", flexDirection:"column", padding:"1lh 0"}}>
            <SectionTitle label="tracked" right="touched" />
            <div style={{flex:"1 1 0", minHeight:0, overflow:"auto", marginTop: "0.4lh"}}>
              {ldfData.tracked.map((t, i) => (
                <AlignedRow
                  key={t.path}
                  focus={i===1}
                  left={"  ".repeat(0) + t.path}
                  right={t.touched}
                  danger={!!t.warn}
                />
              ))}
            </div>
          </div>

          <hr className="wf-dim-rule" style={{margin: 0}}/>

          {/* untracked half */}
          <div style={{flex:"1 1 0", minHeight: 0, display:"flex", flexDirection:"column", padding:"1lh 0"}}>
            <SectionTitle label="untracked" right="count" />
            <div style={{flex:"1 1 0", minHeight:0, overflow:"auto", marginTop:"0.4lh"}}>
              {fullQueue ? untracked.map((u, i) => (
                <AlignedRow
                  key={u.name}
                  left={"  ".repeat(u.indent) + u.name}
                  right={u.count}
                  dim
                />
              )) : (
                <div className="wf-empty">
                  <div className="ttl">No untracked candidates.</div>
                  <div>press r to rescan</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT column: focused file detail, scrolls */}
        <div className="wf-col" style={{overflow:"auto", padding:0}}>
          <Section>
            <SectionTitle label=".config/fish/config.fish" right="tracked" />
            <div style={{padding:"0.4lh 2ch 0", color:"#555"}}>
              <div>{"source    ~/.config/fish/config.fish"}</div>
              <div>{"target    ~/dotfiles/.config/fish/config.fish"}</div>
              <div>{"kind      shell-config · 1.4 KB · 24 lines"}</div>
              <div>{"added     12d ago · last touched 1d ago"}</div>
              <div>{"backups   2 · most recent 1d ago"}</div>
              <div>{"jj op     a4f29c1 track .config/fish/config.fish"}</div>
              <div>{"perms     0644 · symlink valid · clean"}</div>
            </div>
          </Section>

          <Section>
            <SectionTitle label="contents" right="d for diff vs working copy" />
            <div style={{paddingTop:"0.4lh"}}>
              <CodeBlock lines={previewLines} />
            </div>
          </Section>
        </div>
      </div>

      <V2Footer
        chip="files"
        tweaks={tweaks}
        bindings={<>
          <b>↑/↓</b> select · <b>tab</b> col · <b>d</b> diff · <b>u</b> untrack · <b>i</b> ignore · <b>s</b> sync · <b>?</b> help
        </>}
      />
    </div>
  );
}

// =================================================================
// View 3 — logs (two equal columns: revisions ↔ revision detail)
// =================================================================
function V2Logs({ tweaks }) {
  // Many ops so the left column actually overflows
  const allOps = [
    { hash: "a4f29c1f", desc: "track .config/nvim/lua/plugins.lua",     at: "4h ago",  kind: "track"   },
    { hash: "9b14002a", desc: "edit .zshrc",                            at: "2h ago",  kind: "edit"    },
    { hash: "3e88a7d2", desc: "track .claude/CLAUDE.md",                at: "1d ago",  kind: "track"   },
    { hash: "1f0ee92b", desc: "sync · pushed 4 / pulled 0",             at: "1d ago",  kind: "sync"    },
    { hash: "ee14b890", desc: "track .config/mise/config.toml",         at: "2d ago",  kind: "track"   },
    { hash: "c302a781", desc: "edit .config/nvim/lua/keymap.lua",       at: "2d ago",  kind: "edit"    },
    { hash: "78d09f4a", desc: "untrack .config/karabiner",              at: "3d ago",  kind: "untrack" },
    { hash: "650fcf3e", desc: "add workspace 'default'",                at: "3d ago",  kind: "init"    },
    { hash: "ab4471c2", desc: "sync · pushed 12 / pulled 2",            at: "5d ago",  kind: "sync"    },
    { hash: "5e1228a1", desc: "track .config/wezterm/wezterm.lua",      at: "5d ago",  kind: "track"   },
    { hash: "27ae9015", desc: "track .hammerspoon/init.lua",            at: "4d ago",  kind: "track"   },
    { hash: "11c34807", desc: "edit .config/fish/config.fish",          at: "1d ago",  kind: "edit"    },
    { hash: "9c41ef03", desc: "track .config/aerospace/aerospace.toml", at: "9d ago",  kind: "track"   },
    { hash: "44ef1129", desc: "track .config/lazygit/config.yml",       at: "9d ago",  kind: "track"   },
    { hash: "ba9a0c7e", desc: "edit .config/nvim/init.lua",             at: "10d ago", kind: "edit"    },
    { hash: "21f49801", desc: "track .config/tmux/tmux.conf",           at: "10d ago", kind: "track"   },
    { hash: "f17a8901", desc: "track .config/starship.toml",            at: "10d ago", kind: "track"   },
    { hash: "ce18803c", desc: "track .config/ghostty/config",           at: "11d ago", kind: "track"   },
    { hash: "01abf293", desc: "track .gitconfig",                       at: "12d ago", kind: "track"   },
    { hash: "7791ca0d", desc: "track .zshrc",                           at: "12d ago", kind: "track"   },
    { hash: "deadbe1f", desc: "init repo",                              at: "12d ago", kind: "init"    },
  ];

  // Focused row: a4f29c1f — track .config/nvim/lua/plugins.lua
  const focused = allOps[0];

  const diffLines = [
    { text: "--- a/.config/nvim/lua/plugins.lua",       kind: "hunk" },
    { text: "+++ b/.config/nvim/lua/plugins.lua",       kind: "hunk" },
    { text: "@@ -1,4 +1,12 @@",                          kind: "hunk" },
    { text: " return {" },
    { text: "   { 'folke/tokyonight.nvim' }," },
    { text: "   { 'nvim-lua/plenary.nvim' }," },
    { text: "+  { 'nvim-telescope/telescope.nvim' }," ,  kind: "add" },
    { text: "+  { 'nvim-treesitter/nvim-treesitter' }," , kind: "add" },
    { text: "+  { 'lewis6991/gitsigns.nvim' }," ,         kind: "add" },
    { text: "+  { 'jj-vcs/jj.nvim' }," ,                  kind: "add" },
    { text: "+  { 'stevearc/oil.nvim' }," ,               kind: "add" },
    { text: "+  { 'echasnovski/mini.nvim' }," ,           kind: "add" },
    { text: "+  { 'folke/which-key.nvim' }," ,            kind: "add" },
    { text: "+  { 'nvim-lualine/lualine.nvim' }," ,       kind: "add" },
    { text: " }" },
    { text: "@@ -22,1 +30,3 @@",                         kind: "hunk" },
    { text: " -- end of file" },
    { text: "+local M = {}",                              kind: "add" },
    { text: "+return M",                                  kind: "add" },
  ];

  return (
    <div className="wf">
      <V2Header tweaks={tweaks} />

      <div className="wf-body">
        {/* LEFT column — equal width, list extends to bottom + scrolls */}
        <div className="wf-col" style={{padding:0, display:"flex", flexDirection:"column"}}>
          <Section style={{display:"flex", flexDirection:"column", flex:"1 1 auto", minHeight:0}}>
            <SectionTitle label="revisions" right={String(allOps.length) + " · 142 total"} />
            <div style={{flex:"1 1 0", minHeight:0, overflow:"auto", marginTop:"0.4lh"}}>
              {allOps.map((op, i) => (
                <AlignedRow
                  key={op.hash}
                  focus={i===0}
                  dim={i!==0}
                  left={op.hash.slice(0,8) + "  " + op.desc}
                  right={op.at}
                />
              ))}
            </div>
          </Section>
        </div>

        {/* RIGHT column — equal width, scrolls */}
        <div className="wf-col" style={{padding:0, overflow:"auto"}}>
          <Section>
            <SectionTitle
              label={focused.desc}
              right={focused.kind + " · " + focused.at}
            />
            <div style={{padding:"0.4lh 2ch 0", color:"#555"}}>
              <div>{"hash      a4f29c1f3b8e2c105d92aa70bb16bb4d"}</div>
              <div>{"parent    9b14002a · edit .zshrc"}</div>
              <div>{"kind      track"}</div>
              <div>{"author    you · @ghostty"}</div>
              <div>{"at        2026-05-06 12:12  ·  4h ago"}</div>
              <div>{"files     1 changed · +11 −0"}</div>
              <div>{"jj op     describe -m \"track .config/nvim/lua/plugins.lua\""}</div>
              <div>{"backup    ~/.dotfiles.bak/a4f2/2026-05-06T12-12/"}</div>
            </div>
          </Section>

          <Section>
            <SectionTitle label="diff" right=".config/nvim/lua/plugins.lua · +11 −0" />
            <div style={{paddingTop:"0.4lh"}}>
              <CodeBlock lines={diffLines} />
            </div>
          </Section>
        </div>
      </div>

      <V2Footer
        chip="logs"
        tweaks={tweaks}
        bindings={<>
          <b>↑/↓</b> select · <b>f</b> fetch · <b>p</b> push · <b>s</b> sync · <b>?</b> help
        </>}
      />
    </div>
  );
}

Object.assign(window, { V2Status, V2Files, V2Logs });
