// Wireframe A — "One Column Reading View"
// Stacked sections, scrolls vertically. Status header → tracked → queue → sync.
// The most type-driven, manuscript-like. Hard fold: everything visible.

function WireframeA({ tweaks }) {
  const dirty = tweaks.dirty;
  const fullQueue = tweaks.fullQueue;

  return (
    <div className="wf">
      {/* Header / status line */}
      <div className="wf-header">
        <div>
          <span className="wf-header__path">~/dotfiles</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span className="wf-header__meta">main @ 650fcf3e · 20 tracked · {fullQueue ? "405" : "0"} queued · sync 2m ago · ↑0 ↓0</span>
        </div>
        <div className="wf-header__right">
          {dirty
            ? <span className="wf-dirty"> dirty </span>
            : <b style={{color:"#1a1a1a"}}>clean</b>}
        </div>
      </div>
      <hr className="wf-rule"/>

      <div style={{flex:"1 1 auto", overflow:"auto"}}>
        {/* Tracked */}
        <SectionH label="tracked" count="20" hint="recent first" />
        {ldfData.tracked.slice(0, 8).map((t, i) => (
          <Row key={t.path} focus={i===2}>
            {t.path.padEnd(36)} <span style={{color:"#999"}}>{("touched "+t.touched).padEnd(13)} bk·{t.bk}</span>
            {t.warn && <span style={{color:"#b13a2e", marginLeft:"2ch"}}>! {t.warn}</span>}
          </Row>
        ))}
        <Row dim>{`  … 12 more · enter to expand`}</Row>

        <hr className="wf-dim-rule"/>

        {/* Discovery queue */}
        <SectionH label="discovery" count={fullQueue ? "5769 candidates" : "queue empty"} hint={fullQueue ? "0 accepted · 0 deferred" : "rescan with r"} />
        {fullQueue ? (
          <>
            <Row indent={0}>{`▼ .config`.padEnd(28)} <span style={{color:"#999"}}>405 pending</span></Row>
            <Row indent={1}>{`▼ .crush`.padEnd(26)} <span style={{color:"#999"}}>6 pending</span></Row>
            <Row indent={2}>{`glob crush.db`.padEnd(24)} <span style={{color:"#999"}}>open with space</span></Row>
            <Row indent={2}>{`glob crush.db-shm`}</Row>
            <Row indent={2}>{`glob crush.db-wal`}</Row>
            <Row indent={1}>{`▶ aerospace`.padEnd(26)} <span style={{color:"#999"}}>1 pending</span></Row>
            <Row indent={1}>{`▶ atuin`.padEnd(26)} <span style={{color:"#999"}}>1 pending</span></Row>
            <Row indent={1}>{`▶ broot`.padEnd(26)} <span style={{color:"#999"}}>13 pending</span></Row>
            <Row indent={0}>{`▶ .claude`.padEnd(28)} <span style={{color:"#999"}}>5364 pending</span></Row>
            <Row dim>{`  … 48 more groups · jump with /`}</Row>
          </>
        ) : (
          <div className="wf-empty">
            <div className="ttl">No candidates pending.</div>
            <div>press r to rescan ~/ · q to quit</div>
          </div>
        )}

        <hr className="wf-dim-rule"/>

        {/* Sync + log */}
        <SectionH label="sync" hint={dirty ? "1 dirty file · staging needed" : "clean · last 2m ago"} />
        <Row dim>{"  remote   git@github.com:dylan-gluck/dotfiles.git"}</Row>
        <Row dim>{"  branch   main · ↑0 ↓0"}</Row>
        <Row dim>{"  next     auto-sync hourly"}</Row>

        <hr className="wf-dim-rule"/>
        <SectionH label="recent ops" hint="open log with 3" />
        {ldfData.ops.map((op) => (
          <Row key={op.hash} dim>
            {op.hash}{"  "}{op.desc.padEnd(48)}{op.at}
          </Row>
        ))}
      </div>

      <Footer
        chip="home"
        bindings={
          <>
            <b>j/k</b> move · <b>enter</b> open · <b>2</b> discover · <b>s</b> sync · <b>r</b> rescan · <b>?</b> help
          </>
        }
        path="~/dotfiles"
      />
    </div>
  );
}

window.WireframeA = WireframeA;
