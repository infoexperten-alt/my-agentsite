import { Plus } from "@phosphor-icons/react";

export default function CreateProjectCard({ onClick }) {
  return (
    <div
      onClick={onClick}
      className="group border border-dashed border-slate-700 bg-slate-900/20 hover:bg-slate-900/40 rounded-xl p-6 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:border-brand-500/50 h-[300px]"
    >
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        <Plus size={24} className="text-slate-400 group-hover:text-brand-500" />
      </div>
      <div className="text-center">
        <h3 className="text-white font-medium">Create New Project</h3>
        <p className="text-sm text-slate-500 mt-1">Start a new agent pipeline</p>
      </div>
    </div>
  );
}
