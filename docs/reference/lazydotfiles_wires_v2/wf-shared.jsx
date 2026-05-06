// Shared bits for ldf wireframes
// Exposes: TabStrip, Footer, Row, SectionH, Anno, Legend, sample data

const ldfData = {
  repo: "~/dotfiles",
  branch: "main @ 650fcf3e",
  remote: "git@github.com:dylan-gluck/dotfiles.git",
  // tracked files (~20 realistic)
  tracked: [
    { path: ".zshrc",                          src: "~/.zshrc",                    added: "12d", touched: "2h",  bk: 4 },
    { path: ".config/fish/config.fish",        src: "~/.config/fish/config.fish",  added: "12d", touched: "1d",  bk: 2 },
    { path: ".config/fish/functions/fzf.fish", src: "~/.config/fish/functions/fzf.fish", added: "9d", touched: "9d", bk: 1 },
    { path: ".config/nvim/init.lua",           src: "~/.config/nvim/init.lua",     added: "12d", touched: "4h",  bk: 6 },
    { path: ".config/nvim/lua/plugins.lua",    src: "~/.config/nvim/lua/plugins.lua", added: "8d", touched: "4h", bk: 3 },
    { path: ".config/nvim/lua/keymap.lua",     src: "~/.config/nvim/lua/keymap.lua", added: "8d", touched: "1d", bk: 2 },
    { path: ".config/ghostty/config",          src: "~/.config/ghostty/config",    added: "11d", touched: "3d",  bk: 1 },
    { path: ".config/starship.toml",           src: "~/.config/starship.toml",     added: "10d", touched: "5d",  bk: 1 },
    { path: ".config/tmux/tmux.conf",          src: "~/.config/tmux/tmux.conf",    added: "10d", touched: "10d", bk: 0 },
    { path: ".config/aerospace/aerospace.toml",src: "~/.config/aerospace/aerospace.toml", added: "9d", touched: "9d", bk: 1 },
    { path: ".config/lazygit/config.yml",      src: "~/.config/lazygit/config.yml",added: "9d",  touched: "9d",  bk: 0 },
    { path: ".gitconfig",                      src: "~/.gitconfig",                added: "12d", touched: "12d", bk: 0 },
    { path: ".gitignore_global",               src: "~/.gitignore_global",         added: "12d", touched: "12d", bk: 0 },
    { path: ".ssh/config",                     src: "~/.ssh/config",               added: "12d", touched: "6d",  bk: 1, warn: "perms 0644 → expected 0600" },
    { path: ".config/bat/config",              src: "~/.config/bat/config",        added: "8d",  touched: "8d",  bk: 0 },
    { path: ".config/atuin/config.toml",       src: "~/.config/atuin/config.toml", added: "7d",  touched: "7d",  bk: 0 },
    { path: ".config/mise/config.toml",        src: "~/.config/mise/config.toml",  added: "7d",  touched: "2d",  bk: 1 },
    { path: ".config/wezterm/wezterm.lua",     src: "~/.config/wezterm/wezterm.lua", added: "5d", touched: "5d", bk: 0, status: "broken", warn: "symlink target missing" },
    { path: ".hammerspoon/init.lua",           src: "~/.hammerspoon/init.lua",     added: "4d",  touched: "4d",  bk: 0 },
    { path: ".claude/CLAUDE.md",               src: "~/.claude/CLAUDE.md",         added: "1d",  touched: "5h",  bk: 1 },
  ],
  // discovery tree (a slice of the 5769 candidates)
  discoveryTree: [
    { name: ".claude",    n: 5364, kind: "dir",  open: false },
    { name: ".config",    n: 405,  kind: "dir",  open: true, children: [
      { name: "starship.toml",      n: 0, kind: "glob" },
      { name: ".crush",             n: 6, kind: "dir", open: true, children: [
        { name: ".gitignore",  n: 0, kind: "glob" },
        { name: "crush.db",    n: 0, kind: "glob", focused: true },
        { name: "crush.db-shm",n: 0, kind: "glob" },
        { name: "crush.db-wal",n: 0, kind: "glob" },
        { name: "init",        n: 0, kind: "glob" },
        { name: "logs",        n: 1, kind: "dir" },
      ]},
      { name: "aerospace",          n: 1, kind: "dir", open: true, children: [
        { name: "aerospace.toml", n: 0, kind: "glob" },
      ]},
      { name: "atuin",              n: 1, kind: "dir" },
      { name: "better-auth",        n: 1, kind: "dir" },
      { name: "broot",              n: 13,kind: "dir" },
      { name: "cagent",             n: 1, kind: "dir" },
      { name: "calcure",            n: 5, kind: "dir" },
      { name: "ccstatusline",       n: 1, kind: "dir" },
      { name: "configstore",        n: 2, kind: "dir", open: true, children: [
        { name: "update-notifier-react-devtools.json", n: 0, kind: "glob" },
        { name: "update-notifier-@perryrh0dan", n: 1, kind: "dir" },
      ]},
      { name: "containers",         n: 5, kind: "dir" },
      { name: "crush",              n: 13, kind: "dir" },
    ]},
    { name: ".local",     n: 0,   kind: "dir" },
    { name: ".cache",     n: 0,   kind: "dir" },
  ],
  // recent ops
  ops: [
    { hash: "a4f29c1", desc: "track .config/nvim/lua/plugins.lua", at: "4h ago", kind: "track" },
    { hash: "9b14002", desc: "edit .zshrc", at: "2h ago", kind: "edit" },
    { hash: "3e88a7d", desc: "track .claude/CLAUDE.md", at: "1d ago", kind: "track" },
    { hash: "1f0ee92", desc: "sync · pushed 4 / pulled 0", at: "1d ago", kind: "sync" },
    { hash: "650fcf3e",desc: "add workspace 'default'", at: "3d ago", kind: "init" },
  ],
};

// utility components
function TabStrip({ active = "home", reduced = true }) {
  const tabs = reduced
    ? [["1", "home"], ["2", "discover"], ["3", "log"]]
    : [["1","status"],["2","about"],["3","config"],["4","discover"],["5","tracked"],["6","log"],["7","sync"]];
  const items = [];
  tabs.forEach(([k,n], i) => {
    if (i > 0) items.push(<span key={"s"+i} className="wf-sep">·</span>);
    const isActive = n === active || (active === "home" && n === "home");
    items.push(
      <span key={k} className={"wf-tab " + (isActive ? "wf-tab--active" : "")}>{k} {n}</span>
    );
  });
  return <div className="wf-tabs">{items}</div>;
}

function Footer({ chip = "home", bindings, path = "/" }) {
  return (
    <div className="wf-footer">
      <span className="wf-footer__chip">{chip}</span>
      <span className="wf-footer__bindings">{bindings}</span>
      <span className="wf-footer__path">{path}</span>
    </div>
  );
}

function Row({ children, focus, dim, ghost, ok, danger, indent = 0, hint }) {
  const cls = [
    "wf-row",
    focus && "wf-row--focus",
    dim && "wf-row--dim",
    ghost && "wf-row--ghost",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <span className="cur"></span>
      {"  ".repeat(indent)}{children}
      {hint && <span style={{color:"#999", marginLeft:"2ch"}}>{hint}</span>}
    </div>
  );
}

function SectionH({ label, count, hint }) {
  return (
    <div className="wf-section-h">
      {label} {count != null && <span className="count">{count}</span>} {hint && <span style={{color:"#c8c8c4"}}>· {hint}</span>}
    </div>
  );
}

// Loose handwritten annotation overlay (positioned absolute inside artboard)
function Anno({ x, y, w = 200, children }) {
  return (
    <div className="wf-anno" style={{ left: x, top: y, maxWidth: w + "px", whiteSpace: "normal" }}>
      {children}
    </div>
  );
}

function Legend({ children }) {
  return <div className="wf-legend">{children}</div>;
}

Object.assign(window, { ldfData, TabStrip, Footer, Row, SectionH, Anno, Legend });
