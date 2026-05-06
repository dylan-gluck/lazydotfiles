import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { globalKeymap } from "../../controllers/keymap";
import { useTheme } from "../theme";
import type { PanelBinding } from "./panel-bindings-context";

export interface HelpDrawerProps {
  readonly activeLabel: string | null;
  readonly activeBindings: readonly PanelBinding[];
  readonly activeExtras: readonly PanelBinding[];
  onClose(): void;
}

const COLUMNS = 3;

interface HelpRow {
  readonly key: string;
  readonly desc: string;
}

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
 * Bottom-anchored help drawer. Replaces the footer while open. Two sections:
 * context-aware (panel footer + extras for the focused element) and global.
 * Closed by `?` or `Esc`.
 */
export function HelpDrawer({
  activeLabel,
  activeBindings,
  activeExtras,
  onClose,
}: HelpDrawerProps): ReactNode {
  const t = useTheme();
  useKeyboard((e) => {
    if (e.name === "escape" || e.name === "?") onClose();
  });
  const contextRows: readonly HelpRow[] = [...activeBindings, ...activeExtras].map((b) => ({
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
      <box flexDirection="row" gap={t.space.lg}>
        {contextRows.length > 0 ? (
          <Section title={activeLabel ?? "panel"} rows={contextRows} />
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
      <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
        {title}
      </text>
      <box flexDirection="row" gap={t.space.lg}>
        {columns.map((col, ci) => (
          <box key={ci} flexDirection="column">
            {col.map((row, ri) => (
              <Row key={ri} row={row} />
            ))}
          </box>
        ))}
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
