import { useEffect, useState } from "react";

/**
 * Renders the typed config form for a block instance.
 * Drives the inspector when the user has a `data-ve-block` element selected.
 *
 * Props:
 *   - definition: BlockDefinition
 *   - config: current Record<string,string>
 *   - onCommit: (newConfig) => void   — emits the FULL new config; host
 *     re-renders via htmlstudio's renderBlockUpdate + set-outer-html patch.
 */
export default function BlockConfigForm({ definition, config, onCommit }) {
  const [draft, setDraft] = useState({});

  useEffect(() => {
    // Merge defaults with whatever's stored on the instance.
    const defaults = {};
    for (const f of definition.fields) if (f.default != null) defaults[f.key] = String(f.default);
    setDraft({ ...defaults, ...(config || {}) });
  }, [definition, config]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-3.5">
      {definition.fields.map((f) => (
        <FieldRow key={f.key} field={f} value={draft[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
      ))}
      <button
        onClick={() => onCommit(draft)}
        className="w-full mt-1 px-3 py-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold rounded transition-colors"
      >
        Apply changes
      </button>
    </div>
  );
}

function FieldRow({ field, value, onChange }) {
  const Label = (
    <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
      {field.label}
      {field.optional && <span className="text-slate-700 ml-1">(optional)</span>}
    </label>
  );

  const base =
    "w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:border-brand-500 focus:outline-none";

  switch (field.type) {
    case "textarea":
      return (
        <div>
          {Label}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className={base}
            placeholder={field.help || ""}
          />
        </div>
      );
    case "color":
      return (
        <div>
          {Label}
          <div className="flex gap-1">
            <input
              type="color"
              value={normalizeHex(value)}
              onChange={(e) => onChange(e.target.value)}
              className="w-9 h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`${base} flex-1 font-mono`}
              placeholder="#000000"
            />
          </div>
        </div>
      );
    case "url":
    case "image":
      return (
        <div>
          {Label}
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${base} font-mono`}
            placeholder={field.type === "image" ? "https://… (image)" : "https://…"}
          />
        </div>
      );
    case "number":
      return (
        <div>
          {Label}
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={base}
          />
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">{field.label}</span>
          <input
            type="checkbox"
            checked={value === "true" || value === true}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="accent-brand-500"
          />
        </label>
      );
    case "select":
      return (
        <div>
          {Label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
            {(field.options || []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    case "text":
    default:
      return (
        <div>
          {Label}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={base}
            placeholder={field.help || ""}
          />
        </div>
      );
  }
}

function normalizeHex(v) {
  if (!v) return "#000000";
  const s = String(v).trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("");
  return "#000000";
}
