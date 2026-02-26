import { useState, useEffect } from "react";
import {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
  SpinnerGap,
  Check,
  ArrowCounterClockwise,
  FileHtml,
  FileCss,
  FileJs,
  ImageSquare,
  TextAa,
  MagnifyingGlass,
  WheelchairMotion,
  Waveform,
  GitFork,
  GitMerge,
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

// Icon name to component mapping
const ICON_MAP = {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
  FileHtml,
  FileCss,
  FileJs,
  ImageSquare,
  TextAa,
  MagnifyingGlass,
  WheelchairMotion,
  Waveform,
};

// Default agent metadata (fallback when pipeline_plan doesn't include agent_meta)
const DEFAULT_AGENTS = {
  pm: { label: "PM", icon: Strategy, color: "text-orange-500" },
  designer: { label: "Designer", icon: PaintBrushBroad, color: "text-pink-500" },
  developer: { label: "Developer", icon: Code, color: "text-blue-500" },
  reviewer: { label: "Reviewer", icon: CheckCircle, color: "text-red-500" },
  markup: { label: "Markup", icon: FileHtml, color: "text-orange-400" },
  style: { label: "Style", icon: FileCss, color: "text-blue-400" },
  style_scss: { label: "SCSS", icon: FileCss, color: "text-purple-400" },
  script: { label: "Script", icon: FileJs, color: "text-yellow-400" },
  image: { label: "Image", icon: ImageSquare, color: "text-emerald-400" },
  copywriter: { label: "Copywriter", icon: TextAa, color: "text-teal-400" },
  seo: { label: "SEO", icon: MagnifyingGlass, color: "text-lime-400" },
  accessibility: { label: "A11y", icon: WheelchairMotion, color: "text-cyan-400" },
  animation: { label: "Animation", icon: Waveform, color: "text-violet-400" },
};

const DEFAULT_ORDER = ["pm", "designer", "image", "developer", "markup", "style", "style_scss", "script", "copywriter", "seo", "accessibility", "animation", "reviewer"];

function formatCost(cost) {
  if (!cost || cost === 0) return null;
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function shortModelName(model) {
  if (!model) return null;
  const parts = model.split("/");
  return parts[parts.length - 1];
}

function AgentChip({ agentKey, agents, meta }) {
  const { label, icon: Icon, color } = meta;
  const status = agents[agentKey]?.status;
  const isRunning = status === "running";
  const isComplete = status === "complete";
  const isRetrying = status === "retrying";

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
        isRetrying
          ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
          : isRunning
            ? "bg-brand-500/10 border border-brand-500/30 text-brand-400"
            : isComplete
              ? "bg-slate-800 text-green-400"
              : "bg-slate-900 border border-slate-800 text-slate-500"
      }`}
    >
      {isRetrying ? (
        <ArrowCounterClockwise className="animate-spin" size={12} />
      ) : isRunning ? (
        <SpinnerGap className="animate-spin" size={12} />
      ) : isComplete ? (
        <Check size={12} />
      ) : (
        <Icon size={12} className={isComplete ? "text-green-400" : ""} />
      )}
      {label}
      {isRetrying && (
        <span className="text-[10px] opacity-70">Retrying</span>
      )}
      {agents[agentKey]?.model && !isRetrying && (
        <span className="text-[10px] opacity-50 font-normal">
          {shortModelName(agents[agentKey].model)}
        </span>
      )}
      {isRunning && agents[agentKey]?.startedAt && (
        <ElapsedTimer since={agents[agentKey].startedAt} />
      )}
      {isComplete && agents[agentKey]?.duration_s != null && (
        <span
          className="text-[10px] tabular-nums opacity-70"
          title={`${agents[agentKey].input_tokens || 0} in / ${agents[agentKey].output_tokens || 0} out tokens${agents[agentKey].cost ? ` · ${formatCost(agents[agentKey].cost)}` : ""}`}
        >
          {formatDuration(agents[agentKey].duration_s)}
          {formatCost(agents[agentKey]?.cost) && (
            <span className="ml-1 text-emerald-400/70">{formatCost(agents[agentKey].cost)}</span>
          )}
        </span>
      )}
    </div>
  );
}

function Connector({ active }) {
  return (
    <div className={`w-6 h-px ${active ? "bg-brand-500" : "bg-slate-700"}`} />
  );
}

export default function ProgressPipeline({ agents, pipelineAgents, agentMeta, parallelGroups }) {
  // Build metadata map: merge dynamic agent_meta from pipeline_plan with defaults
  const metaMap = { ...DEFAULT_AGENTS };
  if (agentMeta) {
    for (const [key, meta] of Object.entries(agentMeta)) {
      const IconComp = ICON_MAP[meta.icon] || Code;
      metaMap[key] = {
        label: meta.name || key,
        icon: IconComp,
        color: meta.icon_color || "text-slate-400",
      };
    }
  }

  // Use dynamic agent list if available
  const agentKeys = pipelineAgents && pipelineAgents.length > 0
    ? DEFAULT_ORDER.filter((k) => pipelineAgents.includes(k))
    : DEFAULT_ORDER.filter((k) => k in DEFAULT_AGENTS && ["pm", "designer", "developer", "reviewer"].includes(k));

  // Build set of parallel agent keys for visual grouping
  const parallelSet = new Set();
  if (parallelGroups) {
    for (const group of parallelGroups) {
      for (const key of group) {
        parallelSet.add(key);
      }
    }
  }

  // Split agents into sequential and parallel segments for rendering
  const segments = [];
  let i = 0;
  while (i < agentKeys.length) {
    const key = agentKeys[i];
    if (parallelSet.has(key)) {
      // Collect consecutive parallel agents
      const group = [];
      while (i < agentKeys.length && parallelSet.has(agentKeys[i])) {
        group.push(agentKeys[i]);
        i++;
      }
      segments.push({ type: "parallel", keys: group });
    } else {
      segments.push({ type: "sequential", key });
      i++;
    }
  }

  const hasParallel = segments.some((s) => s.type === "parallel");

  // Check if any agent in a group is active or complete
  const isGroupActive = (keys) =>
    keys.some((k) => agents[k]?.status === "running" || agents[k]?.status === "complete");

  return (
    <div className="flex items-center gap-2 px-4">
      {segments.map((seg, idx) => {
        const isFirst = idx === 0;
        const prevComplete = idx > 0 && (() => {
          const prev = segments[idx - 1];
          if (prev.type === "sequential") {
            return agents[prev.key]?.status === "complete" || agents[prev.key]?.status === "running";
          }
          return prev.keys.some((k) => agents[k]?.status === "complete" || agents[k]?.status === "running");
        })();

        if (seg.type === "sequential") {
          const meta = metaMap[seg.key];
          if (!meta) return null;
          return (
            <div key={seg.key} className="flex items-center gap-2">
              {!isFirst && <Connector active={prevComplete} />}
              <AgentChip agentKey={seg.key} agents={agents} meta={meta} />
            </div>
          );
        }

        // Parallel group
        const groupActive = isGroupActive(seg.keys);
        return (
          <div key={`parallel-${idx}`} className="flex items-center gap-2">
            {!isFirst && <Connector active={prevComplete} />}

            {/* Fork indicator */}
            <GitFork size={14} className={`${groupActive ? "text-brand-400" : "text-slate-600"} rotate-90`} />

            {/* Parallel agents stacked */}
            <div className="flex flex-col gap-1">
              {seg.keys.map((key) => {
                const meta = metaMap[key];
                if (!meta) return null;
                return (
                  <AgentChip key={key} agentKey={key} agents={agents} meta={meta} />
                );
              })}
            </div>

            {/* Merge indicator */}
            <GitMerge size={14} className={`${groupActive ? "text-brand-400" : "text-slate-600"} rotate-90`} />
          </div>
        );
      })}
    </div>
  );
}
