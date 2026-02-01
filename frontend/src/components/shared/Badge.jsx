const variants = {
  live: "bg-green-500/10 text-green-400 border-green-500/20",
  published: "bg-green-500/10 text-green-400 border-green-500/20",
  draft: "bg-slate-700/50 text-slate-300 border-slate-600",
  generating: "bg-brand-500/10 text-brand-400 border-brand-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  active: "bg-brand-500/20 text-brand-300 border-brand-500/30",
};

export default function Badge({ status, children }) {
  const cls = variants[status] || variants.draft;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border backdrop-blur-sm ${cls}`}
    >
      {children || status}
    </span>
  );
}
