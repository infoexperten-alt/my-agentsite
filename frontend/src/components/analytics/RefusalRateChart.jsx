import { Warning } from "@phosphor-icons/react";

export default function RefusalRateChart({ runs, loading = false }) {
  const total = runs?.length || 0;
  const refusals = (runs || []).filter((r) => {
    const summary = r?.output_summary;
    if (!summary) return false;
    try {
      const parsed = typeof summary === "string" ? JSON.parse(summary) : summary;
      return parsed && parsed.refusal;
    } catch {
      return false;
    }
  });
  const refusalCount = refusals.length;
  const rate = total > 0 ? (refusalCount / total) * 100 : 0;

  // Group refusals by agent for breakdown
  const byAgent = {};
  for (const r of refusals) {
    const k = r.agent_name || "unknown";
    byAgent[k] = (byAgent[k] || 0) + 1;
  }
  const breakdown = Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">Refusal Rate</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">last {total} runs</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Loading…</div>
      ) : total === 0 ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">No runs yet</div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex items-baseline gap-3 mb-4">
            <span className={`text-3xl font-bold font-mono ${refusalCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {rate.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">
              {refusalCount}/{total} runs
            </span>
          </div>

          {refusalCount === 0 ? (
            <div className="flex items-center justify-center flex-1 text-emerald-400/60 text-xs">
              No refusals detected.
            </div>
          ) : (
            <div className="space-y-2 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                <Warning size={10} weight="fill" /> by agent
              </div>
              {breakdown.map(([agent, count]) => {
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={agent}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 capitalize">{agent}</span>
                      <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-red-500/70 h-full rounded-full"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
