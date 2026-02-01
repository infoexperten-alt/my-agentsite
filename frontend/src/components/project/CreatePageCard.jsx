import { Plus } from "@phosphor-icons/react";

export default function CreatePageCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="border border-dashed border-slate-800 bg-slate-900/30 hover:bg-slate-900 hover:border-slate-600 rounded-xl h-[230px] flex flex-col items-center justify-center gap-3 transition-all text-slate-500 hover:text-brand-400 group"
    >
      <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:scale-110 transition-transform flex items-center justify-center">
        <Plus size={20} />
      </div>
      <span className="text-sm font-medium">Add Page</span>
    </button>
  );
}
