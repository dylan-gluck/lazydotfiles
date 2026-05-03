---
# ldf-payt
title: Rewrite src/index.tsx composition root
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:23:18Z
updated_at: 2026-05-01T15:30:30Z
parent: ldf-j9pe
---

Single createCliRenderer, single createRoot, router context carries services+actors, top-level useEffect calls actors.dispose() on shutdown. No process.exit.
