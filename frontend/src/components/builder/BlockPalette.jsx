import { useMemo, useState } from "react";
import { X, MagnifyingGlass } from "@phosphor-icons/react";
import { listBlocks } from "../../api/blocks";

/**
 * Modal palette — pick a block + click Insert. The host component handles
 * what "Insert" means (replace selected element vs. append at root) since
 * it owns the visual editor state.
 *
 * Props:
 *   - open: boolean
 *   - onClose: () => void
 *   - onInsert: (block: BlockDefinition) => void  — host renders + patches
 *   - selectionLabel?: string — shown in the footer so the user knows
 *     WHERE the block will land (e.g. "replaces <section> p-0-1")
 */
export default function BlockPalette({ open, onClose, onInsert, selectionLabel }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const blocks = listBlocks();
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(blocks.map((b) => b.category)))],
    [blocks],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blocks.filter((b) => {
      if (category !== "all" && b.category !== category) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    });
  }, [blocks, query, category]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[680px] max-h-[80vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Insert a block</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reusable sections with editable fields. Pick one to insert at the cursor.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </header>

        {/* Filter row */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks…"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex bg-slate-950 border border-slate-800 rounded overflow-hidden">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-wider capitalize transition-colors ${
                  category === c ? "bg-brand-500 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-12">
              No blocks match "{query}".
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((b) => (
                <button
                  key={b.id}
                  onClick={() => onInsert(b)}
                  className="text-left p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-brand-500/60 rounded-lg transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl shrink-0 group-hover:scale-110 transition-transform">
                      {b.thumbnail}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-white font-semibold text-sm truncate">{b.name}</h3>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
                          {b.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{b.description}</p>
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">
                        {b.fields.length} field{b.fields.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 text-[11px] text-slate-500">
          {selectionLabel ? (
            <>Inserting will replace <span className="font-mono text-slate-400">{selectionLabel}</span></>
          ) : (
            <>Inserting will append to the page body</>
          )}
        </footer>
      </div>
    </div>
  );
}
