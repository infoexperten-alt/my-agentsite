const AGENT_COLORS = {
  developer: { bg: "bg-blue-500", dot: "bg-blue-500" },
  designer: { bg: "bg-pink-500", dot: "bg-pink-500" },
  pm: { bg: "bg-orange-500", dot: "bg-orange-500" },
  reviewer: { bg: "bg-red-500", dot: "bg-red-500" },
};

const AGENT_LABELS = {
  developer: "Developer Agent",
  designer: "Designer Agent",
  pm: "PM Agent",
  reviewer: "Reviewer Agent",
};

function getColors(name) {
  const key = name.toLowerCase();
  return AGENT_COLORS[key] || { bg: "bg-slate-500", dot: "bg-slate-500" };
}

function getLabel(name) {
  return AGENT_LABELS[name.toLowerCase()] || name;
}

export default function CostByAgentChart({ agents, loading = false }) {
  const entries = agents ? Object.entries(agents) : [];
  const totalCost = entries.reduce((s, [, a]) => s + (a.total_cost || 0), 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <h3 className="text-white font-bold mb-6">Cost by Agent</h3>
      <div className="space-y-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            No data yet
          </div>
        ) : (
          entries.map(([name, data]) => {
            const pct = totalCost > 0 ? Math.round((data.total_cost / totalCost) * 100) : 0;
            const colors = getColors(name);
            return (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    {getLabel(name)}
                  </span>
                  <span className="text-slate-400 font-mono">
                    ${data.total_cost.toFixed(2)} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`${colors.bg} h-full rounded-full`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
