const AGENT_COLORS = {
  pm: { color: "bg-orange-500", textColor: "text-orange-400", label: "PM Agent" },
  designer: { color: "bg-pink-500", textColor: "text-pink-400", label: "Designer Agent" },
  developer: { color: "bg-blue-500", textColor: "text-blue-400", label: "Developer Agent" },
  reviewer: { color: "bg-red-500", textColor: "text-red-400", label: "Reviewer Agent" },
};

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentActivityPanel({ runs = [] }) {
  const hasRuns = runs.length > 0;

  return (
    <div className="w-80 border-l border-slate-800 bg-slate-950/50 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h3 className="font-bold text-white text-sm">Agent Activity</h3>
        <p className="text-xs text-slate-500">
          {hasRuns ? "Recent agent runs" : "No runs yet"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasRuns ? (
          runs.map((run, i) => {
            const meta = AGENT_COLORS[run.agent_name] || AGENT_COLORS.developer;
            const isActive = run.status === "running";
            const isFailed = run.status === "failed";
            const tokens = (run.input_tokens || 0) + (run.output_tokens || 0);

            return (
              <div key={run.id || i} className={`flex gap-3 ${i > 5 ? "opacity-60" : ""}`}>
                <div className="mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${meta.color} ${isActive ? "animate-pulse" : ""}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${isFailed ? "text-red-400" : meta.textColor}`}>
                    {meta.label}
                    {isFailed && " (failed)"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {run.page_slug ? `Page: ${run.page_slug}` : "Generation run"}
                    {tokens > 0 && ` · ${tokens.toLocaleString()} tokens`}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1 font-mono">
                    {formatTimeAgo(run.started_at)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <p className="text-xs text-slate-600">
              Agent activity will appear here after your first generation.
            </p>
          </div>
        )}
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
