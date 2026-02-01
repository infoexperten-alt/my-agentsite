import {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
  SpinnerGap,
  Check,
} from "@phosphor-icons/react";

const AGENTS = [
  { key: "pm", label: "PM", icon: Strategy, color: "text-orange-500" },
  {
    key: "designer",
    label: "Designer",
    icon: PaintBrushBroad,
    color: "text-pink-500",
  },
  { key: "developer", label: "Developer", icon: Code, color: "text-blue-500" },
  {
    key: "reviewer",
    label: "Reviewer",
    icon: CheckCircle,
    color: "text-red-500",
  },
];

export default function ProgressPipeline({ agents }) {
  return (
    <div className="flex items-center gap-2 px-4">
      {AGENTS.map(({ key, label, icon: Icon, color }, i) => {
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
