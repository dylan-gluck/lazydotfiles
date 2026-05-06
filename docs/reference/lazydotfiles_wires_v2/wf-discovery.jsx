// Discovery detail view (inline expand)
// Same flat tree, focused candidate expands inline to show preview underneath.
// One artboard, two tweak states (focused on a glob vs. on a dir).

function DiscoveryDetail({ tweaks }) {
  const focusGlob = tweaks.dirty; // reuse 'dirty' toggle as detail-mode for compactness; but better: dedicated tweak below

  return (
    <div className="wf">
      <div className="wf-header">
        <div>
          <span className="wf-header__path">/discover</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span className="wf-header__meta">~/.config/.crush/crush.db</span>
        </div>
        <div className="wf-header__right">
          <span style={{color:"#999"}}>5769 candidates</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span style={{color:"#999"}}>0 accepted</span>
          <span style={{color:"#c8c8c4"}}>  ·  </span>
          <span style={{color:"#999"}}>0 deferred</span>
        </div>
      </div>
      <hr className="wf-rule"/>

      <div style={{flex:"1 1 auto", overflow:"auto", paddingTop:"0.4ch"}}>
        <Row indent={0}>{`▶ .claude`.padEnd(28)} <span style={{color:"#999"}}>5364 pending</span></Row>
        <Row indent={0}>{`▼ .config`.padEnd(28)} <span style={{color:"#999"}}>405 pending</span></Row>
        <Row indent={1}>{`glob starship.toml`}</Row>
        <Row indent={1}>{`▼ .crush`.padEnd(26)} <span style={{color:"#999"}}>6 pending</span></Row>
        <Row indent={2}>{`glob .gitignore`}</Row>

        {/* The focused row */}
        <Row indent={2} focus hint="a·d·x">
          {`glob crush.db`}
        </Row>

        {/* Inline expanded preview block */}
        <div className="wf-preview">
          <div className="ttl">crush.db <span className="meta" style={{fontWeight:400, color:"#999"}}>· sqlite database · 12.4 MB · binary</span></div>
          <div className="meta">{"  path        ~/.config/.crush/crush.db"}</div>
          <div className="meta">{"  matched     glob include  .config/.crush/*"}</div>
          <div className="meta">{"  reason      sibling-of  .config/.crush/init"}</div>
          <div className="meta">{"  perms       0644 · owner you · modified 2h ago"}</div>
          <div className="meta">{"  siblings    5 in same directory"}</div>
          <div className="meta" style={{marginTop:"0.4em"}}>{"  preview     binary file · skipped"}</div>
          <div className="meta" style={{color:"#b13a2e"}}>{"  warn        large binary · likely build artefact, not config"}</div>
          <div className="meta" style={{marginTop:"0.4em"}}>{"  on accept   move ~/.config/.crush/crush.db  →  ~/dotfiles/.config/.crush/crush.db"}</div>
          <div className="meta">{"              symlink replaces original"}</div>
          <div className="meta">{"              backup     ~/.dotfiles.bak/9c41/2026-05-04T01-23/"}</div>
          <div className="meta">{"              jj describe -m \"track .config/.crush/crush.db\""}</div>
        </div>

        <Row indent={2}>{`glob crush.db-shm`}</Row>
        <Row indent={2}>{`glob crush.db-wal`}</Row>
        <Row indent={2}>{`glob init`}</Row>
        <Row indent={2}>{`▶ logs`.padEnd(20)} <span style={{color:"#999"}}>1 pending</span></Row>
        <Row indent={1}>{`▶ aerospace`.padEnd(26)} <span style={{color:"#999"}}>1 pending</span></Row>
        <Row indent={1}>{`▶ atuin`.padEnd(26)} <span style={{color:"#999"}}>1 pending</span></Row>
        <Row indent={1}>{`▶ broot`.padEnd(26)} <span style={{color:"#999"}}>13 pending</span></Row>
        <Row dim>{"  … 48 more groups · scroll with j/k"}</Row>
      </div>

      <Footer
        chip="discover"
        bindings={<>
          <b>j/k</b> move · <b>space</b> expand · <b>a/A</b> accept · <b>d/D</b> defer · <b>X</b> reject group · <b>/</b> search · <b>?</b> help
        </>}
        path="/.config/.crush/crush.db"
      />
    </div>
  );
}

window.DiscoveryDetail = DiscoveryDetail;
