import { Robot, Money, Clock } from "@phosphor-icons/react";

export default function AgentMetricsBar({ stats, agents }) {
  const activeCount = agents ? agents.filter((a) => a.enabled).length : 0;
  const totalAgents = agents ? agents.length : 4;

  const avgCost = stats?.total_cost
    ? `$${(stats.total_cost / Math.max(stats.total_runs, 1)).toFixed(2)}`
    : "$0.00";

  const avgTime = stats?.avg_duration_seconds
    ? `${Math.round(stats.avg_duration_seconds)}s`
    : "--";

  const metrics = [
    {
      icon: Robot,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
      label: "Active Agents",
      value: `${activeCount}`,
      sub: `of ${totalAgents}`,
    },
    {
      icon: Money,
      iconBg: "bg-green-500/10",
      iconColor: "text-green-400",
      label: "Avg Cost/Run",
      value: avgCost,
      sub: stats?.total_runs ? `${stats.total_runs} runs` : "no runs",
    },
    {
      icon: Clock,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-400",
      label: "Avg. Generation Time",
      value: avgTime,
      sub: "",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4"
        >
          <div
            className={`w-10 h-10 rounded-full ${m.iconBg} ${m.iconColor} flex items-center justify-center`}
          >
            <m.icon size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-400">{m.label}</p>
            <p className="text-2xl font-bold text-white">
              {m.value}{" "}
              {m.sub && (
                <span className="text-xs font-normal text-slate-500">
                  {m.sub}
                </span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
