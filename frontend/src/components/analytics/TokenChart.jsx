function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TokenChart({ data = [], loading = false }) {
  const maxTokens = Math.max(1, ...data.map((d) => d.input_tokens + d.output_tokens));

  return (
    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-bold">Daily Token Consumption</h3>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-brand-500" />
            Input
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Output
          </span>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 px-2 pb-2 border-b border-slate-800 relative">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="w-full h-px bg-slate-600" />
          <div className="w-full h-px bg-slate-600" />
          <div className="w-full h-px bg-slate-600" />
          <div className="w-full h-px bg-slate-600" />
        </div>

        {loading || data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            {loading ? "Loading..." : "No data yet"}
          </div>
        ) : (
          data.map((d, i) => {
            const total = d.input_tokens + d.output_tokens;
            const heightPct = (total / maxTokens) * 100;
            const inputPct = total > 0 ? (d.input_tokens / total) * 100 : 0;
            const outputPct = total > 0 ? (d.output_tokens / total) * 100 : 0;
            return (
              <div
                key={i}
                className="w-full bg-slate-800 rounded-t flex flex-col justify-end group relative"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
              >
                <div
                  className="w-full bg-purple-500 opacity-80 rounded-t"
                  style={{ height: `${outputPct}%` }}
                />
                <div
                  className="w-full bg-brand-500 opacity-80"
                  style={{ height: `${inputPct}%` }}
                />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {formatTokens(total)} tokens
                </div>
              </div>
            );
          })
        )}
      </div>

      {data.length > 0 && (
        <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2 font-mono">
          {data.map((d, i) => (
            <span key={i} className={data.length > 14 && i % 2 !== 0 ? "invisible" : ""}>
              {formatDate(d.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
