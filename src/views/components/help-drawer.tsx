import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { globalKeymap } from "../../controllers/keymap";
import { useTheme } from "../theme";
import type { PanelBinding } from "./panel-bindings-context";

export interface HelpDrawerProps {
  readonly activeLabel: string | null;
  readonly activeBindings: readonly PanelBinding[];
  onClose(): void;
}

const COLUMNS = 3;

/** A normalized binding row that the help drawer renders. */
interface HelpRow {
  readonly key: string;
  readonly desc: string;
}

/**
 * Chunk into N columns, filling each top-to-bottom (column-major). Mirrors the
 * reading order in the reference design: scan column 1 down, then column 2.
 */
function chunkColumnMajor<T>(items: readonly T[], cols: number): T[][] {
  const out: T[][] = Array.from({ length: cols }, () => []);
  if (items.length === 0) return out;
  const rowsPerCol = Math.ceil(items.length / cols);
  items.forEach((item, i) => {
    const c = Math.min(Math.floor(i / rowsPerCol), cols - 1);
    out[c]!.push(item);
  });
  return out;
}

function maxKeyWidth(rows: readonly HelpRow[]): number {
  let w = 0;
  for (const r of rows) if (r.key.length > w) w = r.key.length;
  return w;
}

/**
 * Bottom-anchored help drawer: replaces the AppShell footer when help is open.
 * Two sections — the active panel's bindings and the global keymap — each laid
 * out in 3 column-major columns of `key  desc` rows.
 */
export function HelpDrawer({ activeLabel, activeBindings, onClose }: HelpDrawerProps): ReactNode {
  const t = useTheme();
  useKeyboard((e) => {
    if (e.name === "escape" || e.name === "?") onClose();
  });
  const activeRows: readonly HelpRow[] = activeBindings.map((b) => ({
    key: b.keys,
    desc: b.description,
  }));
  const globalRows: readonly HelpRow[] = globalKeymap.map((b) => ({
    key: b.keys.join("/"),
    desc: b.description.toLowerCase(),
  }));
  return (
    <box
      flexDirection="column"
      backgroundColor={t.bg.surface}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      {activeRows.length > 0 ? <Section title={activeLabel ?? "Panel"} rows={activeRows} /> : null}
      {activeRows.length > 0 ? <box height={1} /> : null}
      <Section title="Global" rows={globalRows} />
      <box height={1} />
      <CloseHint />
    </box>
  );
}

function Section({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly HelpRow[];
}): ReactNode {
  const t = useTheme();
  const columns = chunkColumnMajor(rows, COLUMNS);
  return (
    <box flexDirection="column">
      <text fg={t.fg.focus} attributes={TextAttributes.BOLD}>
        {title}
      </text>
      <box flexDirection="row" gap={t.space.lg}>
        {columns.map((col, ci) => {
          const keyWidth = maxKeyWidth(col);
          return (
            <box key={ci} flexDirection="column">
              {col.map((row, ri) => (
                <Row key={ri} row={row} keyWidth={keyWidth} />
              ))}
            </box>
          );
        })}
      </box>
    </box>
  );
}

function Row({ row, keyWidth }: { readonly row: HelpRow; readonly keyWidth: number }): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="row">
      <text fg={t.fg.focus}>{row.key.padEnd(keyWidth)}</text>
      <text fg={t.fg.muted}>{` ${row.desc}`}</text>
    </box>
  );
}

function CloseHint(): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="row">
      <text fg={t.fg.focus}>?/esc</text>
      <text fg={t.fg.muted}> close help</text>
    </box>
  );
}
