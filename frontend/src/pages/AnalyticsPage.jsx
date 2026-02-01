import { useState } from "react";
import {
  CurrencyDollar,
  Lightning,
  ChartBar,
  DownloadSimple,
} from "@phosphor-icons/react";
import MetricCard from "../components/analytics/MetricCard";
import TokenChart from "../components/analytics/TokenChart";
import CostByAgentChart from "../components/analytics/CostByAgentChart";
import ActivityTable from "../components/analytics/ActivityTable";
import { useAnalytics } from "../hooks/useAnalytics";

const TIME_FILTERS = ["Last 30 Days", "Month to Date", "All Time"];

function formatTokens(n) {
  if (n == null || n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n) {
  if (n == null) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export default function AnalyticsPage() {
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS[0]);
  const { stats, dailyStats, runs, loading } = useAnalytics(timeFilter);

  const totalInputTokens = stats
    ? Object.values(stats.per_agent).reduce((s, a) => s + a.total_input_tokens, 0)
    : 0;
  const totalOutputTokens = stats
    ? Object.values(stats.per_agent).reduce((s, a) => s + a.total_output_tokens, 0)
    : 0;
  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalRuns = stats?.total_runs ?? 0;
  const avgTokensPerRun = totalRuns > 0 ? Math.round(totalTokens / totalRuns) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sub-header */}
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <span className="text-sm font-bold text-white">Usage Overview</span>
          <span className="text-xs text-slate-500 ml-3">
            Monitor token consumption and agent performance.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            {TIME_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  timeFilter === f
                    ? "bg-slate-800 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-900 transition-colors"
            title="Download CSV"
          >
            <DownloadSimple size={18} />
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <MetricCard
              label="Total Spend (Est.)"
              value={loading ? "—" : formatCost(stats?.total_cost)}
              icon={CurrencyDollar}
            />
            <MetricCard
              label="Total Tokens"
              value={loading ? "—" : formatTokens(totalTokens)}
              icon={Lightning}
              sub={
                totalTokens > 0 ? (
                  <>
                    <span className="text-brand-400">{formatTokens(totalInputTokens)}</span> in /{" "}
                    <span className="text-purple-400">{formatTokens(totalOutputTokens)}</span> out
                  </>
                ) : null
              }
            />
            <MetricCard
              label="Generations"
              value={loading ? "—" : String(totalRuns)}
              icon={ChartBar}
              sub={
                totalRuns > 0 ? (
                  <>
                    Avg. <span className="text-white">{formatTokens(avgTokensPerRun)} tokens</span> per run
                  </>
                ) : null
              }
            />
            <MetricCard
              label="Avg Duration"
              value={
                loading
                  ? "—"
                  : stats?.avg_duration_seconds != null
                    ? `${stats.avg_duration_seconds.toFixed(1)}s`
                    : "N/A"
              }
              sub={totalRuns > 0 ? `Across ${totalRuns} completed runs` : null}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
            <TokenChart data={dailyStats} loading={loading} />
            <CostByAgentChart agents={stats?.per_agent} loading={loading} />
          </div>

          {/* Activity table */}
          <ActivityTable runs={runs} loading={loading} />
        </div>
      </div>
    </div>
  );
}
