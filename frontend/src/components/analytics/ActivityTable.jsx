import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

const AGENT_STYLES = {
  developer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  designer: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  pm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  reviewer: "bg-red-500/10 text-red-400 border-red-500/20",
};

function getAgentStyle(name) {
  return AGENT_STYLES[name?.toLowerCase()] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  }) + ", " + d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTokens(n) {
  if (n == null) return "0";
  return n.toLocaleString();
}

function formatCost(n) {
  if (n == null) return "$0.000";
  return `$${n.toFixed(3)}`;
}

export default function ActivityTable({ runs = [], loading = false }) {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? runs.filter(
        (r) =>
          (r.project_id || "").toLowerCase().includes(filter.toLowerCase()) ||
          (r.agent_name || "").toLowerCase().includes(filter.toLowerCase()) ||
          (r.page_slug || "").toLowerCase().includes(filter.toLowerCase())
      )
    : runs;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 flex justify-between items-center">
        <h3 className="text-white font-bold">Recent API Activity</h3>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Filter by project or agent..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white focus:border-brand-500 outline-none"
          />
          <MagnifyingGlass
            className="absolute right-3 top-2 text-slate-500"
            size={12}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/50 text-slate-500 text-xs uppercase border-b border-slate-800">
              <th className="px-6 py-3 font-semibold">Timestamp</th>
              <th className="px-6 py-3 font-semibold">Page</th>
              <th className="px-6 py-3 font-semibold">Agent</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold text-right">Tokens</th>
              <th className="px-6 py-3 font-semibold text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No activity yet
                </td>
              </tr>
            ) : (
              filtered.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                    {formatTimestamp(run.started_at)}
                  </td>
                  <td className="px-6 py-4 text-white font-medium text-xs">
                    {run.page_slug || run.project_id?.slice(0, 8) || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded border text-xs capitalize ${getAgentStyle(run.agent_name)}`}
                    >
                      {run.agent_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs ${
                        run.status === "completed"
                          ? "text-green-400"
                          : run.status === "failed"
                            ? "text-red-400"
                            : "text-yellow-400"
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-mono text-xs text-right">
                    {formatTokens((run.input_tokens || 0) + (run.output_tokens || 0))}
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-mono text-xs text-right">
                    {formatCost(run.cost)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center">
        <span className="text-xs text-slate-500">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>
    </div>
  );
}
