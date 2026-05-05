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
      backgroundColor={t.bg.default}
      padding={1}
      border={["top"]}
      borderColor={t.fg.muted}
      flexShrink={0}
    >
      <box flexDirection="row" gap={1}>
        {activeRows.length > 0 ? (
          <Section title={activeLabel ?? "Panel"} rows={activeRows} />
        ) : null}
        <Section title="global" rows={globalRows} />
      </box>
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
    <box flexDirection="column" paddingBottom={1} flexGrow={1} flexShrink={0}>
      <text fg={t.fg.default} attributes={TextAttributes.BOLD}>
        {title}
      </text>
      <box flexDirection="row" gap={t.space.lg}>
        {columns.map((col, ci) => {
          return (
            <box key={ci} flexDirection="column">
              {col.map((row, ri) => (
                <Row key={ri} row={row} />
              ))}
            </box>
          );
        })}
      </box>
    </box>
  );
}

function Row({ row }: { readonly row: HelpRow }): ReactNode {
  const t = useTheme();
  return (
    <box flexDirection="row">
      <text fg={t.fg.focus}>{row.key}</text>
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
