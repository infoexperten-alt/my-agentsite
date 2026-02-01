const FILTERS = ["All", "Live", "Drafts"];

export default function ProjectFilterBar({ active, onChange }) {
  return (
    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            active === f
              ? "bg-slate-800 text-white shadow"
              : "hover:bg-slate-800/50 text-slate-400"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
