import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { listBlocks } from "../../api/blocks";
import { wireframeFor } from "htmlstudio";

/**
 * Right-rail Blocks library — inline (not modal) version of the old
 * BlockPalette. Tabbed: Built-in vs This project. Each card renders an
 * SVG wireframe instead of an emoji thumbnail.
 *
 * Props:
 *   - projectComponents: ProjectComponent[]
 *   - selectionLabel: string|null — used as a hint in the footer
 *   - onInsert(def): host renders + patches
 */
export default function BlocksPanel({ projectComponents = [], selectionLabel, onInsert }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState("builtin"); // "builtin" | "project"

  const builtins = listBlocks();
  const blocks = tab === "project" ? projectComponents : builtins;

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
        (b.description || "").toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    });
  }, [blocks, query, category]);

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* Tabs */}
      <div className="px-3 pt-2 flex gap-1 border-b border-slate-800/70">
        <TabButton
          active={tab === "builtin"}
          onClick={() => { setTab("builtin"); setCategory("all"); }}
        >
          Built-in <span className="text-[10px] text-slate-500 ml-1">({builtins.length})</span>
        </TabButton>
        <TabButton
          active={tab === "project"}
          onClick={() => { setTab("project"); setCategory("all"); }}
          badge={projectComponents.length > 0 && tab !== "project"}
        >
          Project <span className="text-[10px] text-slate-500 ml-1">({projectComponents.length})</span>
        </TabButton>
      </div>

      {/* Filter row */}
      <div className="px-3 py-2 border-b border-slate-800/70 space-y-2">
        <div className="relative">
          <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-7 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:border-brand-500 focus:outline-none"
          />
        </div>
        {categories.length > 1 && (
          <div className="flex bg-slate-950 border border-slate-800 rounded overflow-hidden">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-1 px-2 py-1 text-[10px] uppercase tracking-wider capitalize transition-colors ${
                  category === c ? "bg-brand-500 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid (1-up for the narrow rail) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === "project" && projectComponents.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8">
            <div className="text-2xl mb-2">🧱</div>
            No saved components yet.
            <div className="mt-1 text-[10px] text-slate-600 leading-snug">
              Select a section → <span className="text-slate-400">Save as</span> in the inspector.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-xs text-slate-500 py-8">No matches.</div>
        ) : (
          filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => onInsert(b)}
              className="w-full text-left p-2 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-brand-500/60 rounded-lg transition-all group"
            >
              <div
                className="w-full aspect-[16/9] rounded bg-slate-950 border border-slate-800/70 text-slate-300 flex items-center justify-center overflow-hidden group-hover:text-brand-300 transition-colors"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: wireframeFor(b) }}
              />
              <div className="mt-2 flex items-start justify-between gap-1.5">
                <h3 className="text-white font-semibold text-xs leading-tight truncate flex-1">
                  {b.name}
                </h3>
                <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 shrink-0 mt-0.5">
                  {b.category}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 font-mono">
                {(b.fields || []).length} field{(b.fields || []).length === 1 ? "" : "s"}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/60 text-[10px] text-slate-500 leading-snug">
        {selectionLabel ? (
          <>Click inserts → replaces <span className="font-mono text-slate-400">{selectionLabel}</span></>
        ) : (
          <span className="text-slate-600">Select an element first — clicks replace it.</span>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 text-[11px] font-semibold border-b-2 transition-colors ${
        active
          ? "border-brand-500 text-white"
          : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
      {badge && (
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-brand-500 rounded-full" />
      )}
    </button>
  );
}
