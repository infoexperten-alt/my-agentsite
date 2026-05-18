const STRATEGY_COLORS = {
  fast: "bg-cyan-500",
  cost_optimized: "bg-emerald-500",
  balanced: "bg-amber-500",
  quality_first: "bg-purple-500",
  explicit: "bg-pink-500",
  "": "bg-slate-500",
};

const STRATEGY_LABELS = {
  fast: "Fast",
  cost_optimized: "Cost-optimized",
  balanced: "Balanced",
  quality_first: "Quality-first",
  explicit: "Explicit override",
  "": "Default",
};

export default function CostByRoutingChart({ runs, loading = false }) {
  // Aggregate cost by strategy
  const byStrategy = new Map();
  let totalCost = 0;
  for (const r of runs || []) {
    const k = r.strategy || "";
    const cost = Number(r.cost || 0);
    if (cost <= 0) continue;
    byStrategy.set(k, (byStrategy.get(k) || 0) + cost);
    totalCost += cost;
  }
  const entries = Array.from(byStrategy.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">Cost by Routing</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          strategy
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-500 text-sm text-center">
          <p>No routed runs yet.</p>
          <p className="text-xs mt-1">
            Configure <code className="font-mono text-slate-400">settings.agent_routing</code> to populate.
          </p>
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          {entries.map(([strategy, cost]) => {
            const pct = totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0;
            return (
              <div key={strategy || "default"}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${STRATEGY_COLORS[strategy] || "bg-slate-500"}`} />
                    {STRATEGY_LABELS[strategy] || strategy}
                  </span>
                  <span className="text-slate-400 font-mono">
                    ${cost.toFixed(2)} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`${STRATEGY_COLORS[strategy] || "bg-slate-500"} h-full rounded-full`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
