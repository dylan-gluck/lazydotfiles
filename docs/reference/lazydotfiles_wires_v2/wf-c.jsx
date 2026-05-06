// Wireframe C — "Master rail + detail body"
// Left rail: 3 short sections (status / tracked / queue summary) acting as nav.
// Right body: focused section expands to full content.
// Hard fold preserved by always showing the rail.

function WireframeC({ tweaks }) {
  const dirty = tweaks.dirty;
  const fullQueue = tweaks.fullQueue;

  return (
    <div className="wf">
      <div className="wf-body">
        {/* Left rail */}
        <div className="wf-col wf-col-narrow">
          <div className="wf-header" style={{padding:"1ch 0 0.4ch 0"}}>
            <div>
              <div className="wf-header__path">~/dotfiles</div>
              <div className="wf-header__meta" style={{fontSize:"12px"}}>main @ 650fcf3e</div>
            </div>
          </div>
          <hr className="wf-dim-rule" style={{margin:"0.4ch 0"}}/>
          <Row>
            {"repo   "}{dirty
              ? <span className="wf-dirty"> dirty </span>
              : <b>clean</b>}
          </Row>
          <Row dim>{"sync   2m ago · ↑0 ↓0"}</Row>
          <Row dim>{"backup 1.4 GB"}</Row>

          <hr className="wf-dim-rule" style={{margin:"0.6ch 0"}}/>

          <SectionH label="tracked" count="20" />
          <Row dim>{"  by recency"}</Row>
          <Row dim>{"  by directory"}</Row>
          <Row focus>{"  with warnings  2"}</Row>

          <hr className="wf-dim-rule" style={{margin:"0.6ch 0"}}/>

          <SectionH label="queue" count={fullQueue ? "5769" : "0"} />
          <Row dim>{"  pending   5769"}</Row>
          <Row dim>{"  accepted  0"}</Row>
          <Row dim>{"  deferred  0"}</Row>

          <hr className="wf-dim-rule" style={{margin:"0.6ch 0"}}/>

          <SectionH label="recent" />
          {ldfData.ops.slice(0,3).map(op => (
            <Row key={op.hash} dim>{"  " + op.hash.slice(0,7) + " " + (op.desc.length > 18 ? op.desc.slice(0,15)+"…" : op.desc)}</Row>
          ))}
        </div>

        {/* Right body — focused: tracked with warnings */}
        <div className="wf-col">
          <SectionH label="tracked · with warnings" count="2 of 20" hint="press a/A on any row" />
          <Row danger focus>
            <span style={{color:"#b13a2e"}}>{".config/wezterm/wezterm.lua".padEnd(36)} symlink target missing</span>
          </Row>
          <Row>
            <span style={{color:"#b13a2e"}}>{".ssh/config".padEnd(36)} perms 0644 → expected 0600</span>
          </Row>

          <hr className="wf-dim-rule"/>
          <SectionH label="all tracked" count="20" />
          {ldfData.tracked.slice(0, 12).map((t, i) => (
            <Row key={t.path} dim={!t.warn}>
              {t.path.padEnd(36)} <span style={{color:"#999"}}>{("touched "+t.touched).padEnd(13)} bk·{t.bk}</span>
            </Row>
          ))}
          <Row dim>{"  … 8 more"}</Row>
        </div>
      </div>

      <Footer
        chip="home"
        bindings={<><b>tab</b> rail/body · <b>j/k</b> move · <b>enter</b> drill · <b>2</b> discover · <b>?</b> help</>}
        path="~/dotfiles · tracked/warnings"
      />
    </div>
  );
}

window.WireframeC = WireframeC;
