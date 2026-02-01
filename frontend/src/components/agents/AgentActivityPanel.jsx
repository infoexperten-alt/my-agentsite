const ACTIVITY = [
  {
    agent: "Developer Agent",
    color: "bg-blue-500",
    textColor: "text-blue-400",
    message: "Writing CSS for Hero Section...",
    project: "Project: SaaS Landing",
    active: true,
  },
  {
    agent: "Designer Agent",
    color: "bg-pink-500",
    textColor: "text-pink-400",
    message: "Completed Color Palette #4",
    project: "Project: Portfolio",
    active: false,
  },
  {
    agent: "PM Agent",
    color: "bg-orange-500",
    textColor: "text-orange-400",
    message: 'Structuring "About" page wireframe.',
    project: "2 mins ago",
    active: false,
    opacity: "opacity-60",
  },
  {
    agent: "Reviewer Agent",
    color: "bg-red-500",
    textColor: "text-red-400",
    message: "Flagged contrast issue on Button.",
    project: "5 mins ago",
    active: false,
    opacity: "opacity-40",
  },
];

export default function AgentActivityPanel() {
  return (
    <div className="w-80 border-l border-slate-800 bg-slate-950/50 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h3 className="font-bold text-white text-sm">Live Agent Activity</h3>
        <p className="text-xs text-slate-500">Real-time inference logs</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {ACTIVITY.map((a, i) => (
          <div key={i} className={`flex gap-3 ${a.opacity || ""}`}>
            <div className="mt-1">
              <div
                className={`w-2 h-2 rounded-full ${a.color} ${a.active ? "animate-pulse" : ""}`}
              />
            </div>
            <div>
              <p className={`text-xs font-semibold ${a.textColor}`}>
                {a.agent}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{a.message}</p>
              <p className="text-[10px] text-slate-600 mt-1 font-mono">
                {a.project}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>Status</span>
          <span className="text-green-400">All Systems Online</span>
        </div>
      </div>
    </div>
  );
}
