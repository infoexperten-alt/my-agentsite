export default function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  trend,
  children,
  className = "",
}) {
  return (
    <div
      className={`bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden group ${className}`}
    >
      {Icon && (
        <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Icon size={48} className={iconColor || "text-brand-500"} />
        </div>
      )}
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <div>
        <h3 className="text-3xl font-bold text-white font-mono">{value}</h3>
        {trend && (
          <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
            {trend}
          </p>
        )}
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
