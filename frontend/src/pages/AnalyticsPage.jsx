import { useState } from "react";
import {
  CurrencyDollar,
  TrendUp,
  DownloadSimple,
} from "@phosphor-icons/react";
import MetricCard from "../components/analytics/MetricCard";
import TokenChart from "../components/analytics/TokenChart";
import CostByAgentChart from "../components/analytics/CostByAgentChart";
import ActivityTable from "../components/analytics/ActivityTable";

const TIME_FILTERS = ["Last 30 Days", "Month to Date", "All Time"];

export default function AnalyticsPage() {
  const [timeFilter, setTimeFilter] = useState(TIME_FILTERS[0]);

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
              value="$42.80"
              icon={CurrencyDollar}
              trend={
                <>
                  <TrendUp size={12} /> +12% from last month
                </>
              }
            />
            <MetricCard label="Total Tokens" value="1.2M">
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full w-[65%]" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                65% of monthly limit
              </p>
            </MetricCard>
            <MetricCard
              label="Generations"
              value="18"
              sub={
                <>
                  Avg. <span className="text-white">66k tokens</span> per build
                </>
              }
            />
            <div className="bg-gradient-to-br from-brand-700/40 to-slate-900 border border-brand-500/20 p-5 rounded-xl flex flex-col justify-between h-32 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <p className="text-sm font-bold text-brand-400">Pro Plan</p>
                <span className="bg-brand-500/20 text-brand-300 text-[10px] px-2 py-0.5 rounded border border-brand-500/30">
                  Active
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  Renews in 12 days
                </p>
                <button className="w-full py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded transition-colors shadow-lg">
                  Manage Subscription
                </button>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
            <TokenChart />
            <CostByAgentChart />
          </div>

          {/* Activity table */}
          <ActivityTable />
        </div>
      </div>
    </div>
  );
}
