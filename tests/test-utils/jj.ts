/**
 * Single source of truth for the "is `jj` available?" gate used by every
 * acceptance/integration test that shells out to it.
 *
 * Default behavior (local dev): if `jj` is missing, gated `describe.if(HAS_JJ)`
 * blocks become no-ops and a sibling `if (!HAS_JJ)` block emits a "skipped"
 * marker so the suite stays green.
 *
 * CI behavior: set `LDF_REQUIRE_JJ=1` (or `CI=1`) to turn missing-jj into a
 * hard failure at module load. This prevents the case where a CI runner
 * without jj reports A1/A3/A4/A5/A6/A7 all "passing" because every gated
 * `describe` was silently skipped.
 */

const JJ_PRESENT = Bun.which("jj") !== null;

function isHardRequired(): boolean {
  if (process.env["LDF_REQUIRE_JJ"] === "1") return true;
  // CI runners conventionally set CI=true. Treat any truthy value as "must
  // exercise the full suite"; teams that genuinely need to skip can unset CI
  // or set LDF_REQUIRE_JJ=0.
  if (process.env["LDF_REQUIRE_JJ"] === "0") return false;
  return process.env["CI"] === "true" || process.env["CI"] === "1";
}

if (!JJ_PRESENT && isHardRequired()) {
  throw new Error(
    "jj binary not found on PATH but LDF_REQUIRE_JJ=1 (or CI=1) was set. " +
      "Acceptance tests cannot silently skip in CI — install jj or unset the flag.",
  );
}

export const HAS_JJ = JJ_PRESENT;
