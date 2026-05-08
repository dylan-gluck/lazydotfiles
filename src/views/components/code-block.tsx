import type { ReactNode } from "react";
import { useTheme } from "../theme";

export type CodeLineKind = "add" | "del" | "hunk" | "context";

export interface CodeLine {
  readonly text: string;
  readonly kind?: CodeLineKind;
}

export interface CodeBlockProps {
  /** Lines to render. `kind` defaults to `"context"`. */
  readonly lines: readonly CodeLine[];
  /** First post-image line number (default 1). */
  readonly startNumber?: number;
  /** Hide line numbers on hunk headers (default true). */
  readonly hideHunkNumber?: boolean;
}

const NUM_WIDTH = 4;

function padNum(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : " ".repeat(width - s.length) + s;
}

/**
 * Shared line-numbered block used by the `contents` section in the files view
 * and the `diff` section in the logs view. Each line is `<num> <text>`:
 *
 * - `add` rows render BOLD body-fg with their post-image line number.
 * - `del` rows render danger-fg without a line number.
 * - `hunk` rows render muted-fg without a line number.
 * - `context` rows render default-fg with their post-image line number.
 */
export function CodeBlock({
  lines,
  startNumber = 1,
  hideHunkNumber = true,
}: CodeBlockProps): ReactNode {
  const t = useTheme();
  let n = startNumber - 1;
  return (
    <box flexDirection="column">
      {lines.map((ln, i) => {
        const kind = ln.kind ?? "context";
        let num = "";
        if (kind === "hunk" && hideHunkNumber) {
          num = "";
        } else if (kind === "del") {
          num = "";
        } else {
          n += 1;
          num = padNum(n, NUM_WIDTH);
        }
        const fg =
          kind === "add"
            ? t.fg.success
            : kind === "del"
              ? t.fg.danger
              : kind === "hunk"
                ? t.fg.muted
                : t.fg.default;
        return (
          <box key={i} flexDirection="row" gap={1}>
            <box width={NUM_WIDTH} flexShrink={0}>
              <text fg={t.fg.muted}>{num.length > 0 ? num : " ".repeat(NUM_WIDTH)}</text>
            </box>
            <box flexGrow={1} flexShrink={1} overflow="hidden">
              <text fg={fg}>{ln.text}</text>
            </box>
          </box>
        );
      })}
    </box>
  );
}
