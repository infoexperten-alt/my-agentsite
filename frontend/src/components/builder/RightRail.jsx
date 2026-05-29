import { useEffect, useState } from "react";
import { Cursor, Stack } from "@phosphor-icons/react";
import EditInspector from "./EditInspector";
import BlocksPanel from "./BlocksPanel";

/**
 * Right rail of the page builder in edit mode.
 *
 * Tabs at the top: [Inspector | Blocks]. Auto-switches to Inspector
 * when the user selects an element; user can manually flip back. The
 * Inspector tab is disabled when nothing is selected (initial state
 * defaults to Blocks).
 */
export default function RightRail({
  selection,
  selections,
  onApply,
  onApplyMany,
  onRerenderBlock,
  onSaveAsComponent,
  onClearSelection,
  saveState,
  projectComponents,
  onInsertBlock,
}) {
  const hasSelection = !!selection || (selections && selections.length > 0);
  const [tab, setTab] = useState(hasSelection ? "inspector" : "blocks");

  // Auto-switch to Inspector when a selection arrives. Honor manual
  // overrides by not switching if the user explicitly chose blocks
  // while a selection is active.
  useEffect(() => {
    if (hasSelection) setTab("inspector");
    else setTab((t) => (t === "inspector" ? "blocks" : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.id, selections?.length]);

  const selectionLabel = selection
    ? `<${selection.tag}> ${selection.id}`
    : (selections && selections.length > 1
        ? `${selections.length} elements`
        : null);

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col">
      <div className="flex border-b border-slate-800/70 shrink-0">
        <Tab
          active={tab === "inspector"}
          disabled={!hasSelection}
          onClick={() => setTab("inspector")}
          icon={<Cursor size={12} />}
          label="Inspector"
          badge={hasSelection ? (selections?.length > 1 ? selections.length : null) : null}
        />
        <Tab
          active={tab === "blocks"}
          onClick={() => setTab("blocks")}
          icon={<Stack size={12} />}
          label="Blocks"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "inspector" ? (
          <EditInspector
            selection={selection}
            selections={selections}
            onApply={onApply}
            onApplyMany={onApplyMany}
            onRerenderBlock={onRerenderBlock}
            onSaveAsComponent={onSaveAsComponent}
            onClose={onClearSelection}
            saveState={saveState}
          />
        ) : (
          <BlocksPanel
            projectComponents={projectComponents}
            selectionLabel={selectionLabel}
            onInsert={onInsertBlock}
          />
        )}
      </div>
    </aside>
  );
}

function Tab({ active, disabled, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
        active
          ? "border-brand-500 text-white"
          : disabled
            ? "border-transparent text-slate-700 cursor-not-allowed"
            : "border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
      {badge != null && (
        <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[9px] font-mono">
          {badge}
        </span>
      )}
    </button>
  );
}
