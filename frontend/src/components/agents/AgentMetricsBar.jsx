import { Robot, Money, Clock } from "@phosphor-icons/react";

const METRICS = [
  {
    icon: Robot,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-400",
    label: "Total Agents",
    value: "4",
    sub: "Active",
  },
  {
    icon: Money,
    iconBg: "bg-green-500/10",
    iconColor: "text-green-400",
    label: "Est. Cost/Build",
    value: "$0.14",
    sub: "avg",
  },
  {
    icon: Clock,
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-400",
    label: "Avg. Generation Time",
    value: "42s",
    sub: "",
  },
];

export default function AgentMetricsBar() {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {METRICS.map((m) => (
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
