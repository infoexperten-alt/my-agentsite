import { useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

const MOCK_DATA = [
  {
    timestamp: "Oct 24, 10:42:05",
    project: "Portfolio Dark Mode",
    agent: "Developer",
    agentColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    model: "claude-3-sonnet",
    tokens: "4,205",
    cost: "$0.063",
  },
  {
    timestamp: "Oct 24, 10:41:12",
    project: "Portfolio Dark Mode",
    agent: "Designer",
    agentColor: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    model: "gpt-4o",
    tokens: "1,100",
    cost: "$0.015",
  },
  {
    timestamp: "Oct 24, 10:39:55",
    project: "SaaS Landing",
    agent: "PM Agent",
    agentColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    model: "gpt-4o",
    tokens: "850",
    cost: "$0.012",
  },
  {
    timestamp: "Oct 24, 10:38:10",
    project: "E-commerce Store",
    agent: "Reviewer",
    agentColor: "bg-red-500/10 text-red-400 border-red-500/20",
    model: "claude-3-opus",
    tokens: "2,400",
    cost: "$0.180",
  },
];

export default function ActivityTable() {
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? MOCK_DATA.filter(
        (r) =>
          r.project.toLowerCase().includes(filter.toLowerCase()) ||
          r.agent.toLowerCase().includes(filter.toLowerCase())
      )
    : MOCK_DATA;

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
              <th className="px-6 py-3 font-semibold">Project</th>
              <th className="px-6 py-3 font-semibold">Agent</th>
              <th className="px-6 py-3 font-semibold">Model</th>
              <th className="px-6 py-3 font-semibold text-right">Tokens</th>
              <th className="px-6 py-3 font-semibold text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-800">
            {filtered.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                  {row.timestamp}
                </td>
                <td className="px-6 py-4 text-white font-medium">
                  {row.project}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded border text-xs ${row.agentColor}`}
                  >
                    {row.agent}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs">
                  {row.model}
                </td>
                <td className="px-6 py-4 text-slate-300 font-mono text-xs text-right">
                  {row.tokens}
                </td>
                <td className="px-6 py-4 text-slate-300 font-mono text-xs text-right">
                  {row.cost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center">
        <button className="text-xs text-slate-500 hover:text-white transition-colors">
          View All Logs
        </button>
      </div>
    </div>
  );
}
