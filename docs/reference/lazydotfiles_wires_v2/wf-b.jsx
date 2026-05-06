// Wireframe B — "Two Column Split"
// Left: tracked + queue stacked. Right: focused detail / sync state.
// Symmetric, reading-room layout. Hard fold.

function WireframeB({ tweaks }) {
  const dirty = tweaks.dirty;
  const fullQueue = tweaks.fullQueue;

  return (
    <div className="wf">
      <div className="wf-header">
        <div>
          <span className="wf-header__path">~/dotfiles</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span className="wf-header__meta">main · 20 tracked · {fullQueue ? "405 queued" : "queue empty"} · sync 2m ago</span>
        </div>
        <div className="wf-header__right">
          {dirty ? <span className="wf-dirty"> dirty </span> : <b>clean</b>}
        </div>
      </div>
      <hr className="wf-rule"/>

      <div className="wf-body">
        {/* Left column — combined lists */}
        <div className="wf-col">
          <SectionH label="tracked" count="20" />
          {ldfData.tracked.slice(0, 7).map((t, i) => (
            <Row key={t.path} focus={i===1}>
              {t.path.padEnd(34)} <span style={{color:"#999"}}>{t.touched}</span>
            </Row>
          ))}
          <Row dim>{"  … 13 more"}</Row>

          <hr className="wf-dim-rule"/>

          <SectionH label="discovery" count={fullQueue ? "5769" : "0"} hint="queue" />
          {fullQueue ? (
            <>
              <Row indent={0}>{`▶ .claude`.padEnd(24)} <span style={{color:"#999"}}>5364</span></Row>
              <Row indent={0}>{`▼ .config`.padEnd(24)} <span style={{color:"#999"}}>405</span></Row>
              <Row indent={1}>{`▶ .crush`.padEnd(22)} <span style={{color:"#999"}}>6</span></Row>
              <Row indent={1}>{`▶ aerospace`.padEnd(22)} <span style={{color:"#999"}}>1</span></Row>
              <Row indent={1}>{`▶ atuin`.padEnd(22)} <span style={{color:"#999"}}>1</span></Row>
              <Row indent={1}>{`▶ broot`.padEnd(22)} <span style={{color:"#999"}}>13</span></Row>
              <Row indent={0}>{`▶ .local`.padEnd(24)} <span style={{color:"#999"}}>0</span></Row>
              <Row dim>{"  … 48 more groups"}</Row>
            </>
          ) : (
            <div className="wf-empty">
              <div className="ttl">No candidates.</div>
              <div>press r to rescan</div>
            </div>
          )}
        </div>

        {/* Right column — detail + sync + ops */}
        <div className="wf-col">
          <SectionH label="focus" hint=".config/fish/config.fish" />
          <Row dim>{"  source   ~/.config/fish/config.fish"}</Row>
          <Row dim>{"  symlink  → ~/dotfiles/.config/fish/config.fish"}</Row>
          <Row dim>{"  added    12d ago · last touched 1d ago"}</Row>
          <Row dim>{"  backups  2 · most recent 1d ago"}</Row>
          <Row>{" "}</Row>
          <Row dim>{"  preview"}</Row>
          <div className="wf-preview">
            <div className="meta">{"  1  # ~/.config/fish/config.fish"}</div>
            <div className="meta">{"  2  set -gx EDITOR nvim"}</div>
            <div className="meta">{"  3  fish_add_path ~/bin"}</div>
            <div className="meta">{"  4  if status is-interactive"}</div>
            <div className="meta">{"  5      starship init fish | source"}</div>
            <div className="meta">{"  6  end"}</div>
          </div>

          <hr className="wf-dim-rule"/>

          <SectionH label="sync" hint={dirty ? "1 dirty file" : "clean · 2m ago"} />
          <Row dim>{"  ↑0 ↓0  ·  hourly  ·  next 58m"}</Row>
          <Row dim>{"  remote  git@github.com:dylan-gluck/dotfiles.git"}</Row>

          <hr className="wf-dim-rule"/>

          <SectionH label="recent" hint="last 5 ops" />
          {ldfData.ops.slice(0, 5).map((op) => (
            <Row key={op.hash} dim>
              {op.hash.slice(0,7)}{"  "}{op.desc.length > 36 ? op.desc.slice(0,33)+"…" : op.desc.padEnd(36)} {op.at}
            </Row>
          ))}
        </div>
      </div>

      <Footer
        chip="home"
        bindings={<><b>tab</b> switch col · <b>j/k</b> move · <b>enter</b> open · <b>s</b> sync · <b>?</b> help</>}
        path="~/dotfiles"
      />
    </div>
  );
}

window.WireframeB = WireframeB;
