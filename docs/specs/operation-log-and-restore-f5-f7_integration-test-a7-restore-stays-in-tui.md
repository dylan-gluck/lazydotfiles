# A7 integration test — restore stays in TUI

- **Source bean**: `ldf-gxgq`
- **Parent epic**: `ldf-z560`
- **PRD**: §A7

## Goal

Demonstrate end-to-end that `restoreToOp` rewinds the working copy and re-materializes symlinks **without the test tearing the runtime down or invoking jj from the test body** — i.e. the same code path the TUI uses works against a real `jj` binary in a tmp HOME.

## Public surface

`src/services/restore.service.a7.integration.test.ts`

A single Bun test, 30 s timeout, isolated to a fresh `withTmpDir` per run.

## Internal design

```ts
test("A7: restore-to-op rewinds working copy and re-materializes symlinks", async () => {
  await withTmpDir(async (home) => {
    // 1. Bootstrap.
    const services = wireServices({ home: home.path });
    const boot = await services.bootstrap.run();
    expect(boot.ok).toBe(true);

    // 2. Track .zshrc.
    const target = join(home.path, ".zshrc");
    await writeFile(target, "alias g=jj\n", { mode: 0o600 });
    const added = await services.track.add(target);
    expect(added.ok).toBe(true);
    expect(await isSymlink(target)).toBe(true);

    // 3. Capture the op id BEFORE the next change.
    const beforeOps = await services.operation.list({ limit: 5 });
    expect(beforeOps.ok).toBe(true);
    if (!beforeOps.ok) return;
    const trackOp = beforeOps.value.find((o) => o.kind === "track");
    expect(trackOp).toBeDefined();
    if (trackOp === undefined) return;

    // 4. Untrack to advance history.
    const removed = await services.track.remove(target);
    expect(removed.ok).toBe(true);
    expect(await isSymlink(target)).toBe(false);

    // 5. Restore to the track op.
    const restoreOutcome = await services.restore.restoreToOp(trackOp.opId);
    expect(restoreOutcome.ok).toBe(true);
    if (!restoreOutcome.ok) return;
    expect(restoreOutcome.value.rematerialized.map((f) => f.target)).toContain(target);

    // 6. Working copy is rewound: target is once again the canonical symlink.
    expect(await isSymlink(target)).toBe(true);
    expect(await readSymlinkTarget(target)).toBe(`${home.path}/dotfiles/.zshrc`);
    expect(await Bun.file(`${home.path}/dotfiles/.zshrc`).text()).toBe("alias g=jj\n");
  });
}, 30_000);
```

## Dependencies

- `wireServices` (extended to expose `restore` and `operation`)
- `src/test-utils/tmp.ts` and `src/test-utils/fs.ts` helpers (existing)
- A real `jj` binary in PATH (already a CI requirement; existing integration tests rely on it)

## Tests

This file IS the test. No further test files needed.

## Acceptance

- Test passes locally and in CI.
- The PRD A7 acceptance bullet ("Restoring from `jj op log` rewinds the working copy and re-materializes symlinks; the user does not need to leave the TUI") is satisfied because every step uses the same services the TUI binds to its actors. The test never spawns `jj` directly.

## Review

- Rewrites: none.
- Approval: pending Step 4 cross-spec consistency review.
