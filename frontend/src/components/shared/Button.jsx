const base = "inline-flex items-center gap-2 font-semibold rounded-lg transition-colors text-sm";

const variants = {
  primary:
    "bg-white text-slate-950 px-4 py-2 hover:bg-slate-200 shadow-lg shadow-white/5",
  brand:
    "bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 shadow-lg shadow-brand-500/20",
  ghost:
    "text-slate-400 hover:text-white px-3 py-1.5 hover:bg-slate-900",
  outline:
    "border border-slate-700 text-slate-300 px-4 py-2 hover:bg-slate-800 hover:text-white",
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
