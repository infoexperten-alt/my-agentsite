import { useEffect, useState } from "react";
import { X, FloppyDisk, Trash } from "@phosphor-icons/react";
import { createComponent, updateComponent } from "../../api/components";

const FIELD_TYPES = ["text", "textarea", "url", "image", "color", "number", "boolean"];

/**
 * Two-stage modal:
 *   1. User picks name + slug + thumbnail → server runs extractor → returns draft
 *   2. User refines fields (rename / change type / delete / set default) → PUT
 */
export default function SaveComponentModal({
  open,
  projectId,
  selection,
  getOuterHtml,
  pageSlug,
  version,
  onClose,
  onSaved,
}) {
  const [stage, setStage] = useState("meta"); // "meta" | "refine"
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [thumbnail, setThumbnail] = useState("🧱");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState(null); // ProjectComponent returned from create
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setStage("meta");
      setName("");
      setSlug("");
      setThumbnail("🧱");
      setDescription("");
      setDraft(null);
      setError(null);
    }
  }, [open]);

  // Auto-derive a kebab-case slug from name.
  useEffect(() => {
    if (stage !== "meta") return;
    setSlug(
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    );
  }, [name, stage]);

  if (!open) return null;

  const handleExtract = async () => {
    if (!selection) return;
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }
    const sourceHtml = getOuterHtml(selection.id);
    if (!sourceHtml) {
      setError("Could not read the selection's HTML — try clicking it again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await createComponent(projectId, {
        name,
        slug,
        category: "custom",
        description,
        thumbnail,
        source_html: sourceHtml,
        source_instance_id: selection.id,
        source_page_slug: pageSlug,
        source_version: version,
      });
      setDraft(saved);
      setStage("refine");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const commitRefinements = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await updateComponent(projectId, draft.id, {
        fields: draft.fields,
        name: draft.name,
        description: draft.description,
        thumbnail: draft.thumbnail,
      });
      onSaved?.(draft);
      onClose?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">
              {stage === "meta" ? "Save as component" : "Refine fields"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {stage === "meta"
                ? "Name it and the extractor will detect editable fields automatically."
                : `${draft?.fields?.length || 0} fields detected. Rename, retype, or delete what you don't need.`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {stage === "meta" ? (
            <MetaStage
              name={name}
              setName={setName}
              slug={slug}
              setSlug={setSlug}
              thumbnail={thumbnail}
              setThumbnail={setThumbnail}
              description={description}
              setDescription={setDescription}
              selection={selection}
            />
          ) : (
            <RefineStage draft={draft} setDraft={setDraft} />
          )}
          {error && (
            <div className="mt-3 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {stage === "meta" ? "Step 1 of 2" : "Step 2 of 2"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            {stage === "meta" ? (
              <button
                onClick={handleExtract}
                disabled={busy || !name.trim() || !slug.trim()}
                className="px-3 py-1.5 bg-brand-500 hover:bg-brand-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-semibold rounded transition-colors"
              >
                {busy ? "Extracting…" : "Extract fields →"}
              </button>
            ) : (
              <button
                onClick={commitRefinements}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-400 disabled:bg-slate-700 text-white text-xs font-semibold rounded transition-colors"
              >
                <FloppyDisk size={12} weight="fill" />
                {busy ? "Saving…" : "Save component"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function MetaStage({ name, setName, slug, setSlug, thumbnail, setThumbnail, description, setDescription, selection }) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-950 border border-slate-800 rounded text-[11px] text-slate-400">
        Source: <span className="font-mono text-slate-300">&lt;{selection?.tag}&gt; {selection?.id}</span>
      </div>
      <div>
        <Label>Name</Label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pricing Card"
          className={inputCls}
        />
      </div>
      <div>
        <Label>Slug</Label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="pricing-card"
          className={`${inputCls} font-mono`}
        />
        <p className="mt-1 text-[10px] text-slate-600">
          kebab-case identifier — used in render_block(slug, …). Must be unique within this project.
        </p>
      </div>
      <div className="grid grid-cols-[64px_1fr] gap-3">
        <div>
          <Label>Icon</Label>
          <input
            type="text"
            value={thumbnail}
            onChange={(e) => setThumbnail(e.target.value)}
            maxLength={4}
            className={`${inputCls} text-center text-2xl`}
          />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this used for?"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}

function RefineStage({ draft, setDraft }) {
  if (!draft) return null;
  const setField = (i, patch) => {
    setDraft((d) => {
      const fields = [...d.fields];
      fields[i] = { ...fields[i], ...patch };
      return { ...d, fields };
    });
  };
  const removeField = (i) => {
    setDraft((d) => ({ ...d, fields: d.fields.filter((_, idx) => idx !== i) }));
  };

  if (draft.fields.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-slate-400">
          No editable fields detected — this component will render as static HTML.
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          That's fine for things like dividers, footers, or fixed sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {draft.fields.map((f, i) => (
        <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded">
          <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
            <div>
              <Label>Key</Label>
              <input
                type="text"
                value={f.key}
                onChange={(e) => setField(i, { key: e.target.value })}
                className={`${inputCls} font-mono`}
              />
              <input
                type="text"
                value={f.label || ""}
                onChange={(e) => setField(i, { label: e.target.value })}
                placeholder="Label"
                className={`${inputCls} mt-1.5`}
              />
            </div>
            <div>
              <Label>Type</Label>
              <select
                value={f.type}
                onChange={(e) => setField(i, { type: e.target.value })}
                className={inputCls}
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button
              onClick={() => removeField(i)}
              className="mt-5 text-slate-600 hover:text-rose-400"
              title="Remove field"
            >
              <Trash size={14} />
            </button>
          </div>
          <div className="mt-2">
            <Label>Default value</Label>
            <input
              type="text"
              value={f.default ?? ""}
              onChange={(e) => setField(i, { default: e.target.value })}
              className={`${inputCls} text-xs`}
              placeholder="(empty)"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Label({ children }) {
  return <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{children}</label>;
}

const inputCls =
  "w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-slate-200 focus:border-brand-500 focus:outline-none";
