import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { type ReactNode, useState } from "react";
import type { UseConfigPanel } from "../../controllers/config.controller";
import type { Config } from "../../domain/config";
import { useInputFocusEffect } from "../components/input-focus-context";
import {
  type PanelBinding,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../components/panel-bindings-context";
import { summarizeServiceError } from "../components/summarize-error";
import { useTheme } from "../theme";

const BINDINGS: readonly PanelBinding[] = [
  { keys: "j/k", description: "move" },
  { keys: "enter", description: "edit / toggle" },
  { keys: "esc", description: "cancel" },
];

export interface ConfigPanelProps {
  readonly model: UseConfigPanel;
}

interface FieldRow {
  readonly option: string;
  readonly value: unknown;
  readonly editable: "scalar" | "bool" | "readonly";
}

interface Section {
  readonly title: string;
  readonly rows: readonly FieldRow[];
}

function sectionsFor(cfg: Config): readonly Section[] {
  return [
    {
      title: "Paths",
      rows: [
        { option: "path.home", value: cfg.path.home, editable: "scalar" },
        { option: "path.dotfiles", value: cfg.path.dotfiles, editable: "scalar" },
        { option: "path.backup", value: cfg.path.backup, editable: "scalar" },
      ],
    },
    {
      title: "Discovery",
      rows: [
        { option: "discovery.auto_track", value: cfg.discovery.auto_track, editable: "bool" },
        { option: "discovery.include", value: cfg.discovery.include, editable: "readonly" },
        { option: "discovery.exclude", value: cfg.discovery.exclude, editable: "readonly" },
      ],
    },
    {
      title: "Options",
      rows: [
        { option: "options.vcs", value: cfg.options.vcs, editable: "readonly" },
        { option: "options.auto_commit", value: cfg.options.auto_commit, editable: "bool" },
        { option: "options.auto_sync", value: cfg.options.auto_sync, editable: "bool" },
        {
          option: "options.auto_sync_interval",
          value: cfg.options.auto_sync_interval,
          editable: "scalar",
        },
      ],
    },
    {
      title: "Experimental",
      rows: [
        {
          option: "experimental.detect_api_keys",
          value: cfg.experimental.detect_api_keys,
          editable: "bool",
        },
      ],
    },
  ];
}

function renderValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => String(x)).join(", ")}]`;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "";
  return String(v);
}

interface FlatRow extends FieldRow {
  readonly section: string;
  readonly globalIndex: number;
}

function flatten(sections: readonly Section[]): readonly FlatRow[] {
  const out: FlatRow[] = [];
  let i = 0;
  for (const s of sections) {
    for (const r of s.rows) {
      out.push({ ...r, section: s.title, globalIndex: i++ });
    }
  }
  return out;
}

export function ConfigPanel({ model }: ConfigPanelProps): ReactNode {
  const t = useTheme();
  usePublishPanelLabel("config");
  usePublishPanelBindings(BINDINGS);
  const [focusIdx, setFocusIdx] = useState(0);
  const [draft, setDraft] = useState<{ option: string; text: string } | null>(null);
  useInputFocusEffect(draft !== null);

  if (model.status === "loading" && model.config === null) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <text fg={t.fg.dim}>loading config…</text>
      </box>
    );
  }

  if (model.config === null) {
    return (
      <box flexGrow={1} alignItems="center" justifyContent="center">
        <box
          backgroundColor={t.bg.surface}
          borderStyle={t.border.emphasis}
          flexDirection="column"
          padding={t.space.md}
          gap={t.space.sm}
        >
          <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
            Config unavailable
          </text>
          <text fg={t.fg.default}>
            {model.error !== null ? summarizeServiceError(model.error) : "(no config loaded)"}
          </text>
        </box>
      </box>
    );
  }

  const sections = sectionsFor(model.config);
  const flat = flatten(sections);
  const focused: FlatRow | undefined = flat[focusIdx];

  useKeyboard((event) => {
    if (draft !== null) {
      // editor owns input
      switch (event.name) {
        case "escape":
          setDraft(null);
          return;
        case "return":
          model.set(draft.option, draft.text);
          setDraft(null);
          return;
        case "backspace":
          setDraft((d) => (d === null ? null : { ...d, text: d.text.slice(0, -1) }));
          return;
        default:
          if (event.sequence !== undefined && event.sequence.length === 1) {
            const ch = event.sequence;
            setDraft((d) => (d === null ? null : { ...d, text: d.text + ch }));
          }
          return;
      }
    }
    switch (event.name) {
      case "j":
      case "down":
        if (flat.length > 0) setFocusIdx((i) => Math.min(i + 1, flat.length - 1));
        return;
      case "k":
      case "up":
        if (flat.length > 0) setFocusIdx((i) => Math.max(i - 1, 0));
        return;
      case "return":
        if (focused === undefined) return;
        if (focused.editable === "bool") {
          model.set(focused.option, !(focused.value as boolean));
        } else if (focused.editable === "scalar") {
          setDraft({ option: focused.option, text: String(focused.value ?? "") });
        }
        return;
    }
  });

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="column" flexGrow={1} padding={t.space.sm} gap={t.space.sm}>
        {sections.map((s) => (
          <box
            key={s.title}
            flexDirection="column"
            borderStyle={t.border.default}
            padding={t.space.sm}
          >
            <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
              {s.title}
            </text>
            {s.rows.map((r) => {
              const idx = flat.findIndex((f) => f.option === r.option);
              const isFocused = idx === focusIdx;
              const isReadonly = r.editable === "readonly";
              return (
                <box key={r.option} flexDirection="row" gap={t.space.md}>
                  <box flexGrow={1} flexBasis={0}>
                    <text fg={isFocused ? t.fg.focus : t.fg.default}>
                      {isFocused ? "› " : "  "}
                      {r.option}
                    </text>
                  </box>
                  <box flexGrow={2} flexBasis={0}>
                    <text fg={isReadonly ? t.fg.dim : t.fg.default}>{renderValue(r.value)}</text>
                  </box>
                </box>
              );
            })}
          </box>
        ))}
      </box>

      {model.error !== null ? (
        <box flexDirection="column" paddingLeft={1} paddingRight={1} backgroundColor={t.bg.surface}>
          <text fg={t.fg.danger}>{summarizeServiceError(model.error)}</text>
        </box>
      ) : null}

      <box height={1} flexDirection="row" paddingLeft={1} paddingRight={1}>
        <text fg={t.fg.dim}>
          {model.status === "saving" ? "saving…" : `${flat.length} options`}
        </text>
      </box>

      {draft !== null ? (
        <box
          flexGrow={1}
          alignItems="center"
          justifyContent="center"
          backgroundColor={t.bg.default}
        >
          <box
            backgroundColor={t.bg.elevated}
            borderStyle={t.border.emphasis}
            flexDirection="column"
            padding={t.space.md}
            gap={t.space.sm}
          >
            <text fg={t.fg.heading} attributes={TextAttributes.BOLD}>
              {draft.option}
            </text>
            <text fg={t.fg.default}>{draft.text || "(empty)"}</text>
            <text fg={t.fg.dim}>enter save · esc cancel · backspace delete</text>
          </box>
        </box>
      ) : null}
    </box>
  );
}
