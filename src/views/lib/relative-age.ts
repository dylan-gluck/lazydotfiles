/**
 * Render an ISO-8601 timestamp as a coarse, monotonically-increasing relative
 * age string ("just now", "5m ago", "2h ago", "3d ago"). Returns the input
 * verbatim when the timestamp does not parse so callers never display "NaN".
 */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = now.getTime() - then;
  if (diffMs < 60_000) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
