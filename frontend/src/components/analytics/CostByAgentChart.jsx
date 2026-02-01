const AGENTS = [
  { label: "Developer Agent", color: "bg-blue-500", dotColor: "bg-blue-500", cost: "$24.10", pct: 56 },
  { label: "Designer Agent", color: "bg-pink-500", dotColor: "bg-pink-500", cost: "$10.40", pct: 24 },
  { label: "PM Agent", color: "bg-orange-500", dotColor: "bg-orange-500", cost: "$4.30", pct: 10 },
  { label: "Reviewer Agent", color: "bg-red-500", dotColor: "bg-red-500", cost: "$4.00", pct: 10 },
];

export default function CostByAgentChart() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <h3 className="text-white font-bold mb-6">Cost by Agent</h3>
      <div className="space-y-6 flex-1">
        {AGENTS.map((a) => (
          <div key={a.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${a.dotColor}`} />
                {a.label}
              </span>
              <span className="text-slate-400 font-mono">
                {a.cost} ({a.pct}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`${a.color} h-full rounded-full`}
                style={{ width: `${a.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
