---
# ldf-95fy
title: Implement track.service.remove
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:20Z
updated_at: 2026-05-01T16:40:31Z
parent: ldf-vcv0
blocked_by:
  - ldf-zf8l
---

PRD §F4 inverse: validate symlink ownership -> snapshot current target -> materialize copy back -> jj describe + snapshot -> mark TrackedFile.status = untracked. Preserves history.
