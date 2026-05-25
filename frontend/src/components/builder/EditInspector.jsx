import { useEffect, useMemo, useState } from "react";
import {
  X,
  Cursor,
  TextT,
  PaintBrush,
  ArrowsOut,
  Sparkle,
  Link as LinkIcon,
  Image as ImageIcon,
  CaretRight,
  CaretDown,
  Code,
  PuzzlePiece,
} from "@phosphor-icons/react";
import { getBlock } from "../../api/blocks";
import BlockConfigForm from "./BlockConfigForm";

/* ----------------------------- style helpers ----------------------------- */

function parseStyle(str) {
  const out = {};
  if (!str) return out;
  str.split(";").forEach((decl) => {
    const [k, ...rest] = decl.split(":");
    if (!k || rest.length === 0) return;
    out[k.trim()] = rest.join(":").trim();
  });
  return out;
}

function splitUnit(value) {
  if (value == null || value === "") return { n: "", u: "px" };
  const m = String(value).trim().match(/^(-?\d*\.?\d+)\s*(px|rem|em|%|vh|vw|pt)?$/i);
  if (!m) return { n: value, u: "" };
  return { n: m[1], u: (m[2] || "px").toLowerCase() };
}

function toHex(value) {
  if (!value) return "#000000";
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return "#" + v.slice(1).split("").map((c) => c + c).join("");
  }
  const rgb = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((x) => Number(x).toString(16).padStart(2, "0"));
    return `#${r}${g}${b}`;
  }
  return "#000000";
}

const FONT_FAMILIES = [
  { label: "System sans", value: "system-ui, sans-serif" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
];
const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];
const TEXT_ALIGNS = ["left", "center", "right", "justify"];
const DISPLAYS = ["block", "inline", "inline-block", "flex", "grid", "none"];

/* -------------------------------- component ------------------------------ */

export default function EditInspector({
  selection,
  selections = [],
  onApply,
  onApplyMany,
  onRerenderBlock,
  onSaveAsComponent,
  onClose,
  saveState,
}) {
  const multi = selections.length > 1;
  const blockId = !multi && selection?.block;
  const blockDef = blockId ? getBlock(blockId) : null;
  const blockInstance = !multi && selection?.attributes?.["data-ve-block-instance"];
  // Read the current config off the instance — htmlstudio stamps it
  // into data-ve-config as base64 JSON.
  const blockConfig = useMemo(() => {
    if (!blockId) return null;
    const raw = selection?.attributes?.["data-ve-config"];
    if (!raw) return {};
    try {
      const json = typeof atob === "function" ? atob(raw) : "";
      return JSON.parse(json);
    } catch {
      return {};
    }
  }, [blockId, selection?.attributes]);
  const [content, setContent] = useState({ text: "", href: "", linkLabel: "", src: "", alt: "" });
  const [open, setOpen] = useState({ content: true, type: true, layout: true, fx: true, advanced: false });
  const [rawStyle, setRawStyle] = useState("");

  // In multi-select mode use the first element's styles as the "shared" view —
  // the user is editing all of them, so applying a value sets that property
  // across the set even if their starting styles differ.
  const styleSource = multi ? selections[0] : selection;
  const styles = useMemo(
    () => parseStyle(styleSource?.attributes?.style || ""),
    [styleSource?.attributes?.style],
  );

  useEffect(() => {
    if (!selection) return;
    setContent({
      text: selection.text || "",
      href: selection.attributes?.href || "",
      linkLabel: selection.text || "",
      src: selection.attributes?.src || "",
      alt: selection.attributes?.alt || "",
    });
    setRawStyle(selection.attributes?.style || "");
  }, [selection]);

  if (!selection && !multi) {
    return (
      <aside className="w-96 border-l border-slate-800 bg-slate-900 p-5 text-slate-400 text-sm flex flex-col gap-3">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Cursor size={16} /> Edit mode
        </div>
        <p className="text-xs leading-relaxed">
          Click an element in the preview to inspect it. Double-click any text to edit it inline.
        </p>
        <SaveBadge saveState={saveState} />
      </aside>
    );
  }

  // setStyle / clearStyle route through onApply for single-select and
  // onApplyMany for multi-select (one patch per selected id, applied
  // atomically by the hook).
  const setStyle = (prop, value) => {
    if (multi) {
      const patches = selections.map((s) => ({
        kind: "set-style",
        id: s.id,
        styles: { [prop]: value },
      }));
      onApplyMany?.(patches);
    } else {
      onApply({ kind: "set-style", id: selection.id, styles: { [prop]: value } });
    }
  };
  const clearStyle = (prop) => setStyle(prop, "");

  const setAttrs = (attributes) => {
    if (multi) {
      const patches = selections.map((s) => ({
        kind: "set-attributes",
        id: s.id,
        attributes,
      }));
      onApplyMany?.(patches);
    } else {
      onApply({ kind: "set-attributes", id: selection.id, attributes });
    }
  };

  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <aside className="w-96 border-l border-slate-800 bg-slate-900 text-slate-300 text-sm flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
        {multi ? (
          <div>
            <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wide">multi-select</div>
            <div className="font-semibold">
              <span className="text-purple-300">{selections.length} elements</span>
              <span className="text-[10px] text-slate-500 ml-1.5 uppercase tracking-wide">
                {sharedTagOrMixed(selections)}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[10px] font-mono text-slate-500">{selection.id}</div>
            <div className="font-semibold">
              <span className="text-brand-400">&lt;{selection.tag}&gt;</span>
              <span className="text-[10px] text-slate-500 ml-1.5 uppercase tracking-wide">{selection.kind}</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {!multi && selection && !selection.block && onSaveAsComponent && (
            <button
              onClick={onSaveAsComponent}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-brand-500/20 border border-slate-700 hover:border-brand-500/60 rounded transition-colors"
              title="Save this element as a reusable component"
            >
              <PuzzlePiece size={11} weight="fill" />
              Save as
            </button>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200" aria-label="Close inspector">
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {multi && (
          <div className="px-4 py-2 border-b border-slate-800/70 bg-purple-500/5 text-[11px] text-purple-300/80">
            Bulk edit — Typography / Layout / Appearance apply to all {selections.length} elements.
            Content / link / image edits are disabled.
          </div>
        )}

        {/* BLOCK CONFIG — shown when the selected element is a block instance */}
        {blockDef && blockInstance && (
          <Section
            icon={<PuzzlePiece size={14} />}
            label={`Block — ${blockDef.name}`}
            open={true}
            onToggle={() => {}}
          >
            <p className="text-[11px] text-slate-500 mb-2">{blockDef.description}</p>
            <BlockConfigForm
              definition={blockDef}
              config={blockConfig || {}}
              onCommit={(newConfig) =>
                onRerenderBlock?.({
                  blockId: blockDef.id,
                  instanceId: blockInstance,
                  targetId: selection.id,
                  config: newConfig,
                })
              }
            />
            <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
              Block fields rewrite the entire instance. Use the sections below to
              override generic CSS on child elements.
            </p>
          </Section>
        )}

        {/* CONTENT — only meaningful for single-select */}
        {!multi && (
        <Section icon={<TextT size={14} />} label="Content" open={open.content} onToggle={() => toggle("content")}>
          {selection.kind === "text" && (
            <ApplyField
              label="Text"
              textarea
              value={content.text}
              onChange={(v) => setContent((c) => ({ ...c, text: v }))}
              onApply={() => onApply({ kind: "set-text", id: selection.id, value: content.text })}
            />
          )}
          {selection.kind === "link" && (
            <>
              <ApplyField
                label="href"
                icon={<LinkIcon size={12} />}
                value={content.href}
                onChange={(v) => setContent((c) => ({ ...c, href: v }))}
                onApply={() =>
                  onApply({ kind: "set-link", id: selection.id, href: content.href, text: content.linkLabel })
                }
              />
              <ApplyField
                label="Label"
                value={content.linkLabel}
                onChange={(v) => setContent((c) => ({ ...c, linkLabel: v }))}
                onApply={() =>
                  onApply({ kind: "set-link", id: selection.id, href: content.href, text: content.linkLabel })
                }
              />
            </>
          )}
          {selection.kind === "image" && (
            <>
              <ApplyField
                label="Source URL"
                icon={<ImageIcon size={12} />}
                value={content.src}
                onChange={(v) => setContent((c) => ({ ...c, src: v }))}
                onApply={() => onApply({ kind: "set-image", id: selection.id, src: content.src, alt: content.alt })}
              />
              <ApplyField
                label="Alt text"
                value={content.alt}
                onChange={(v) => setContent((c) => ({ ...c, alt: v }))}
                onApply={() => onApply({ kind: "set-image", id: selection.id, src: content.src, alt: content.alt })}
              />
            </>
          )}
          {selection.kind === "container" && (
            <p className="text-xs text-slate-500 italic">Container element — edit its children, or use Advanced HTML below.</p>
          )}
        </Section>
        )}

        {/* TYPOGRAPHY */}
        <Section icon={<TextT size={14} />} label="Typography" open={open.type} onToggle={() => toggle("type")}>
          <Row>
            <Label>Font family</Label>
            <select
              value={styles["font-family"] || ""}
              onChange={(e) => setStyle("font-family", e.target.value)}
              className={selectCls}
            >
              <option value="">— inherit —</option>
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </Row>

          <Row>
            <Label>Size</Label>
            <UnitInput
              value={styles["font-size"]}
              onChange={(v) => v ? setStyle("font-size", v) : clearStyle("font-size")}
            />
          </Row>

          <Row>
            <Label>Weight</Label>
            <select
              value={styles["font-weight"] || ""}
              onChange={(e) => setStyle("font-weight", e.target.value)}
              className={selectCls}
            >
              <option value="">— inherit —</option>
              {FONT_WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </Row>

          <Row>
            <Label>Color</Label>
            <ColorInput
              value={styles.color}
              onChange={(v) => setStyle("color", v)}
              onClear={() => clearStyle("color")}
            />
          </Row>

          <Row>
            <Label>Align</Label>
            <SegmentedControl
              value={styles["text-align"] || ""}
              options={TEXT_ALIGNS}
              onChange={(v) => v ? setStyle("text-align", v) : clearStyle("text-align")}
            />
          </Row>

          <Row>
            <Label>Line height</Label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={styles["line-height"] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                v ? setStyle("line-height", v) : clearStyle("line-height");
              }}
              className={inputCls}
              placeholder="1.5"
            />
          </Row>

          <Row>
            <Label>Letter spacing</Label>
            <UnitInput
              value={styles["letter-spacing"]}
              onChange={(v) => v ? setStyle("letter-spacing", v) : clearStyle("letter-spacing")}
              defaultUnit="em"
            />
          </Row>
        </Section>

        {/* LAYOUT */}
        <Section icon={<ArrowsOut size={14} />} label="Layout & spacing" open={open.layout} onToggle={() => toggle("layout")}>
          <Row>
            <Label>Display</Label>
            <select
              value={styles.display || ""}
              onChange={(e) => setStyle("display", e.target.value)}
              className={selectCls}
            >
              <option value="">— default —</option>
              {DISPLAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Row>

          <Row>
            <Label>Width</Label>
            <UnitInput value={styles.width} onChange={(v) => v ? setStyle("width", v) : clearStyle("width")} />
          </Row>
          <Row>
            <Label>Height</Label>
            <UnitInput value={styles.height} onChange={(v) => v ? setStyle("height", v) : clearStyle("height")} />
          </Row>

          <BoxField label="Padding" prefix="padding" styles={styles} setStyle={setStyle} clearStyle={clearStyle} />
          <BoxField label="Margin" prefix="margin" styles={styles} setStyle={setStyle} clearStyle={clearStyle} />
        </Section>

        {/* APPEARANCE */}
        <Section icon={<PaintBrush size={14} />} label="Appearance" open={open.fx} onToggle={() => toggle("fx")}>
          <Row>
            <Label>Background</Label>
            <ColorInput
              value={styles["background-color"]}
              onChange={(v) => setStyle("background-color", v)}
              onClear={() => clearStyle("background-color")}
            />
          </Row>

          <Row>
            <Label>Opacity</Label>
            <SliderInput
              min={0}
              max={1}
              step={0.01}
              value={styles.opacity ?? 1}
              onChange={(v) => v === "1" ? clearStyle("opacity") : setStyle("opacity", v)}
            />
          </Row>

          <Row>
            <Label>Border radius</Label>
            <UnitInput
              value={styles["border-radius"]}
              onChange={(v) => v ? setStyle("border-radius", v) : clearStyle("border-radius")}
            />
          </Row>

          <Row>
            <Label>Border</Label>
            <input
              type="text"
              value={styles.border ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                v ? setStyle("border", v) : clearStyle("border");
              }}
              className={inputCls}
              placeholder="1px solid #e2e8f0"
            />
          </Row>

          <Row>
            <Label>Shadow</Label>
            <input
              type="text"
              value={styles["box-shadow"] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                v ? setStyle("box-shadow", v) : clearStyle("box-shadow");
              }}
              className={inputCls}
              placeholder="0 4px 14px rgba(0,0,0,0.1)"
            />
          </Row>
        </Section>

        {/* ADVANCED — disabled in multi-mode (raw style needs a single id) */}
        {!multi && (
          <Section icon={<Code size={14} />} label="Advanced" open={open.advanced} onToggle={() => toggle("advanced")}>
            <Row>
              <Label>Raw style</Label>
              <textarea
                value={rawStyle}
                onChange={(e) => setRawStyle(e.target.value)}
                rows={3}
                className={`${inputCls} font-mono text-[11px]`}
                placeholder="key: value; key: value;"
              />
            </Row>
            <button
              onClick={() => {
                const parsed = parseStyle(rawStyle);
                // also blank out anything we removed
                const next = { ...Object.fromEntries(Object.keys(styles).map((k) => [k, ""])), ...parsed };
                onApply({ kind: "set-style", id: selection.id, styles: next });
              }}
              className="w-full mt-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded transition-colors text-slate-200"
            >
              Apply raw style
            </button>
          </Section>
        )}
      </div>

      <SaveBadge saveState={saveState} />
    </aside>
  );
}

/* ------------------------------- helpers --------------------------------- */

function sharedTagOrMixed(items) {
  if (!items || items.length === 0) return "";
  const first = items[0].tag;
  return items.every((i) => i.tag === first) ? `all <${first}>` : "mixed tags";
}

/* ------------------------------- subcomponents --------------------------- */

function Section({ icon, label, open, onToggle, children }) {
  return (
    <section className="border-b border-slate-800/70">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-slate-300 hover:bg-slate-800/40 transition-colors"
      >
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        <span className="text-slate-500">{icon}</span>
        {label}
      </button>
      {open && <div className="px-4 py-3 space-y-2.5">{children}</div>}
    </section>
  );
}

function Row({ children }) {
  return <div className="grid grid-cols-[88px_1fr] items-center gap-2">{children}</div>;
}

function Label({ children }) {
  return <label className="text-[11px] text-slate-500">{children}</label>;
}

const inputCls =
  "w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:border-brand-500 focus:outline-none";
const selectCls = `${inputCls} appearance-none cursor-pointer`;

function ApplyField({ label, value, onChange, onApply, textarea, icon }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
      <button
        onClick={onApply}
        className="w-full px-3 py-1.5 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold rounded transition-colors"
      >
        Apply
      </button>
    </div>
  );
}

function UnitInput({ value, onChange, defaultUnit = "px" }) {
  const { n, u } = splitUnit(value);
  const unit = u || defaultUnit;
  const setNum = (newN) => {
    if (newN === "" || newN == null) return onChange("");
    onChange(`${newN}${unit}`);
  };
  const setUnit = (newU) => {
    if (n === "" || n == null) return onChange("");
    onChange(`${n}${newU}`);
  };
  return (
    <div className="flex gap-1">
      <input
        type="number"
        value={n}
        onChange={(e) => setNum(e.target.value)}
        className={`${inputCls} flex-1`}
        placeholder="auto"
      />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${selectCls} w-16`}>
        {["px", "rem", "em", "%", "vh", "vw"].map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

function ColorInput({ value, onChange, onClear }) {
  const hex = toHex(value);
  return (
    <div className="flex gap-1">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-7 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
      />
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} flex-1 font-mono`}
        placeholder="#000 / rgb()"
      />
      {value && (
        <button
          onClick={onClear}
          className="px-1.5 text-slate-500 hover:text-slate-300 text-xs"
          title="Clear"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function SliderInput({ value, onChange, min, max, step }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 accent-brand-500"
      />
      <span className="text-[11px] text-slate-400 font-mono w-9 text-right">{Number(value).toFixed(2)}</span>
    </div>
  );
}

function SegmentedControl({ value, options, onChange }) {
  return (
    <div className="flex bg-slate-950 border border-slate-800 rounded overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(value === opt ? "" : opt)}
          className={`flex-1 text-[11px] py-1.5 capitalize transition-colors ${
            value === opt ? "bg-brand-500 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function BoxField({ label, prefix, styles, setStyle, clearStyle }) {
  const sides = ["top", "right", "bottom", "left"];
  const shorthand = styles[prefix];
  // If shorthand is set, show one input; otherwise show per-side grid
  const useShorthand = !!shorthand && !sides.some((s) => styles[`${prefix}-${s}`]);
  if (useShorthand) {
    return (
      <Row>
        <Label>{label}</Label>
        <UnitInput value={shorthand} onChange={(v) => v ? setStyle(prefix, v) : clearStyle(prefix)} />
      </Row>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>{label}</Label>
        <button
          onClick={() => {
            sides.forEach((s) => clearStyle(`${prefix}-${s}`));
            clearStyle(prefix);
          }}
          className="text-[10px] text-slate-500 hover:text-slate-300"
        >
          reset
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map((s) => (
          <div key={s}>
            <UnitInput
              value={styles[`${prefix}-${s}`] || ""}
              onChange={(v) =>
                v ? setStyle(`${prefix}-${s}`, v) : clearStyle(`${prefix}-${s}`)
              }
            />
            <div className="text-[9px] text-slate-600 text-center mt-0.5 uppercase">{s[0]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveBadge({ saveState }) {
  if (!saveState) return null;
  const map = {
    idle: { color: "text-slate-500", label: "—" },
    pending: { color: "text-amber-400", label: "edits queued…" },
    saving: { color: "text-blue-400", label: "saving…" },
    saved: { color: "text-emerald-400", label: "saved ✓" },
    error: { color: "text-rose-400", label: `error: ${saveState.error || "unknown"}` },
  };
  const { color, label } = map[saveState.status] || map.idle;
  return (
    <div className={`px-4 py-2 border-t border-slate-800 text-[11px] font-mono ${color}`}>
      {label}
    </div>
  );
}
