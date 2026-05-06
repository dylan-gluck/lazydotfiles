// Wireframe D — "Margin-note status, single body"
// PRODUCT.md "reading-room with margin notes" interpretation.
// Left gutter holds dim margin notes (counts, hashes); body is one tall list
// that interleaves tracked + queue + ops, marked by their kind glyph.

function WireframeD({ tweaks }) {
  const dirty = tweaks.dirty;
  const fullQueue = tweaks.fullQueue;

  const Margin = ({ children }) => (
    <span style={{display:"inline-block", width:"14ch", color:"#999", textAlign:"right", paddingRight:"2ch"}}>{children}</span>
  );

  return (
    <div className="wf">
      <div className="wf-header">
        <div>
          <span className="wf-header__path">~/dotfiles</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span className="wf-header__meta">main @ 650fcf3e</span>
        </div>
        <div className="wf-header__right">
          {dirty ? <span className="wf-dirty"> dirty </span> : <b>clean</b>}
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span style={{color:"#999"}}>{fullQueue ? "5769 candidates" : "queue empty"}</span>
        </div>
      </div>
      <hr className="wf-rule"/>

      <div style={{flex:"1 1 auto", overflow:"auto", paddingTop:"0.6ch"}}>
        {/* Tracked */}
        <Row><Margin>20 tracked</Margin><b>tracked</b></Row>
        {ldfData.tracked.slice(0, 6).map((t, i) => (
          <Row key={t.path} focus={i===0}>
            <Margin>{t.touched + " · bk·" + t.bk}</Margin>
            <span>+ {t.path}</span>
            {t.warn && <span style={{color:"#b13a2e", marginLeft:"2ch"}}>! {t.warn}</span>}
          </Row>
        ))}
        <Row dim><Margin>…</Margin>14 more</Row>

        <hr className="wf-dim-rule"/>

        {/* Queue */}
        <Row>
          <Margin>{fullQueue ? "5769 pending" : "queue empty"}</Margin>
          <b>discovery</b>
        </Row>
        {fullQueue ? (
          <>
            <Row dim><Margin>5364</Margin>? .claude</Row>
            <Row dim><Margin>405</Margin>? .config <span style={{color:"#c8c8c4"}}>(8 dirs)</span></Row>
            <Row dim><Margin>13</Margin>? .config/broot</Row>
            <Row dim><Margin>13</Margin>? .config/crush</Row>
            <Row dim><Margin>6</Margin>? .config/.crush</Row>
            <Row dim><Margin>5</Margin>? .config/calcure</Row>
            <Row dim><Margin>…</Margin>48 more groups · expand with space</Row>
          </>
        ) : (
          <Row dim><Margin>—</Margin>nothing pending · press r to rescan</Row>
        )}

        <hr className="wf-dim-rule"/>

        {/* Sync */}
        <Row><Margin>{dirty ? "1 dirty" : "↑0 ↓0"}</Margin><b>sync</b></Row>
        <Row dim><Margin>2m ago</Margin>· git@github.com:dylan-gluck/dotfiles.git</Row>
        <Row dim><Margin>auto</Margin>· hourly · next 58m</Row>

        <hr className="wf-dim-rule"/>

        {/* Recent ops */}
        <Row><Margin>5 of 142</Margin><b>recent</b></Row>
        {ldfData.ops.map((op) => (
          <Row key={op.hash} dim>
            <Margin>{op.at}</Margin>
            <span>{op.hash.slice(0,7)}  {op.desc}</span>
          </Row>
        ))}
      </div>

      <Footer
        chip="home"
        bindings={<><b>j/k</b> move · <b>enter</b> open · <b>2</b> discover · <b>3</b> log · <b>s</b> sync · <b>?</b> help</>}
        path="~/dotfiles"
      />
    </div>
  );
}

window.WireframeD = WireframeD;
