// Wireframe E — "Three-pane summary header"
// Top: status header strip with three loose typographic groups (tracked / queue / sync), no boxes.
// Below: alternating bands for tracked rows + queue tree, sharing one body.
// Header treats the three counts as headlines; body is one shared list.

function WireframeE({ tweaks }) {
  const dirty = tweaks.dirty;
  const fullQueue = tweaks.fullQueue;

  const Big = ({ n, label, hint, danger }) => (
    <div style={{flex:"1 1 0", padding:"0 2ch"}}>
      <div style={{fontSize:"22px", fontWeight:700, lineHeight:1.1, color: danger ? "#b13a2e" : "#1a1a1a"}}>{n}</div>
      <div style={{color:"#1a1a1a"}}>{label}</div>
      <div style={{color:"#999", fontSize:"12px"}}>{hint}</div>
    </div>
  );

  return (
    <div className="wf">
      <div className="wf-header" style={{paddingBottom:"0.4ch"}}>
        <div>
          <span className="wf-header__path">~/dotfiles</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span className="wf-header__meta">main @ 650fcf3e</span>
        </div>
        <div className="wf-header__right">
          {dirty ? <span className="wf-dirty"> dirty </span> : <b>clean</b>}
        </div>
      </div>

      {/* Headline summary row — three groups, no boxes, just type */}
      <div style={{display:"flex", padding:"0.6ch 0 1ch 0", borderBottom:"1px dashed #c8c8c4"}}>
        <Big n="20" label="tracked" hint={dirty ? "1 dirty · 2 warnings" : "clean · 2 warnings"} danger={dirty}/>
        <Big n={fullQueue ? "5769" : "0"} label="queued" hint={fullQueue ? "0 accepted · 0 deferred" : "rescan with r"}/>
        <Big n={dirty ? "↑1" : "↑0 ↓0"} label="sync" hint="2m ago · hourly"/>
      </div>

      {/* Body — split horizontally between tracked and queue tree */}
      <div className="wf-body">
        <div className="wf-col">
          <SectionH label="tracked" hint="recent first" />
          {ldfData.tracked.slice(0, 9).map((t, i) => (
            <Row key={t.path} focus={i===0}>
              {t.path.padEnd(34)} <span style={{color:"#999"}}>{t.touched}</span>
              {t.warn && <span style={{color:"#b13a2e", marginLeft:"1ch"}}>!</span>}
            </Row>
          ))}
          <Row dim>{"  … 11 more"}</Row>
        </div>
        <div className="wf-col">
          <SectionH label="discovery queue" count={fullQueue ? "5769" : ""} />
          {fullQueue ? (
            <>
              <Row indent={0}>{`▶ .claude`.padEnd(22)} <span style={{color:"#999"}}>5364</span></Row>
              <Row indent={0}>{`▼ .config`.padEnd(22)} <span style={{color:"#999"}}>405</span></Row>
              <Row indent={1}>{`▼ .crush`.padEnd(20)} <span style={{color:"#999"}}>6</span></Row>
              <Row indent={2}>{`glob crush.db`}</Row>
              <Row indent={2}>{`glob crush.db-shm`}</Row>
              <Row indent={1}>{`▶ aerospace`.padEnd(20)} <span style={{color:"#999"}}>1</span></Row>
              <Row indent={1}>{`▶ atuin`.padEnd(20)} <span style={{color:"#999"}}>1</span></Row>
              <Row indent={1}>{`▶ broot`.padEnd(20)} <span style={{color:"#999"}}>13</span></Row>
              <Row dim>{"  … 48 more"}</Row>
            </>
          ) : (
            <div className="wf-empty">
              <div className="ttl">Queue is empty.</div>
              <div>r to rescan · / to filter scope</div>
            </div>
          )}
        </div>
      </div>

      <Footer
        chip="home"
        bindings={<><b>tab</b> col · <b>j/k</b> move · <b>a</b> accept · <b>2</b> discover · <b>s</b> sync · <b>?</b> help</>}
        path="~/dotfiles"
      />
    </div>
  );
}

window.WireframeE = WireframeE;
