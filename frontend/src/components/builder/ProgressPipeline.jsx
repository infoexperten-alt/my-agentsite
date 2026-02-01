import { useState, useEffect } from "react";
import {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
  SpinnerGap,
  Check,
} from "@phosphor-icons/react";

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function ElapsedTimer({ since }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!since) return;
    const start = new Date(since).getTime();
    const tick = () => setElapsed(Math.round((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  return <span className="text-[10px] tabular-nums opacity-70">{formatDuration(elapsed)}</span>;
}

const ALL_AGENTS = {
  pm: { key: "pm", label: "PM", icon: Strategy, color: "text-orange-500" },
  designer: {
    key: "designer",
    label: "Designer",
    icon: PaintBrushBroad,
    color: "text-pink-500",
  },
  developer: { key: "developer", label: "Developer", icon: Code, color: "text-blue-500" },
  reviewer: {
    key: "reviewer",
    label: "Reviewer",
    icon: CheckCircle,
    color: "text-red-500",
  },
};

const DEFAULT_ORDER = ["pm", "designer", "developer", "reviewer"];

export default function ProgressPipeline({ agents, pipelineAgents }) {
  // Use dynamic agent list if available, otherwise show all 4.
  // Always enforce canonical order since backend may return them in any order.
  const agentKeys = pipelineAgents && pipelineAgents.length > 0
    ? DEFAULT_ORDER.filter((k) => pipelineAgents.includes(k))
    : DEFAULT_ORDER;

  return (
    <div className="flex items-center gap-2 px-4">
      {agentKeys.map((key, i) => {
        const meta = ALL_AGENTS[key];
        if (!meta) return null;
        const { label, icon: Icon, color } = meta;
        const status = agents[key]?.status;
        const isRunning = status === "running";
        const isComplete = status === "complete";

        return (
          <div key={key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-6 h-px ${isComplete || isRunning ? "bg-brand-500" : "bg-slate-700"}`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                isRunning
                  ? "bg-brand-500/10 border border-brand-500/30 text-brand-400"
                  : isComplete
                    ? "bg-slate-800 text-green-400"
                    : "bg-slate-900 border border-slate-800 text-slate-500"
              }`}
            >
              {isRunning ? (
                <SpinnerGap className="animate-spin" size={12} />
              ) : isComplete ? (
                <Check size={12} />
              ) : (
                <Icon size={12} className={isComplete ? "text-green-400" : ""} />
              )}
              {label}
              {isRunning && agents[key]?.startedAt && (
                <ElapsedTimer since={agents[key].startedAt} />
              )}
              {isComplete && agents[key]?.duration_s != null && (
                <span
                  className="text-[10px] tabular-nums opacity-70"
                  title={`${agents[key].input_tokens || 0} in / ${agents[key].output_tokens || 0} out tokens`}
                >
                  {formatDuration(agents[key].duration_s)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
