import { CheckCircle, Circle, CircleNotch } from "@phosphor-icons/react";

const STATUS_ICONS = {
  completed: CheckCircle,
  in_progress: CircleNotch,
  pending: Circle,
};

const STATUS_STYLES = {
  completed: "text-emerald-400",
  in_progress: "text-amber-400 animate-spin",
  pending: "text-slate-600",
};

export default function TodoStream({ todos }) {
  if (!todos || todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-white">Plan</h4>
        <span className="text-[10px] font-mono text-slate-500">
          {completed}/{total}
        </span>
      </div>
      <ul className="space-y-1.5">
        {todos.map((t, i) => {
          const Icon = STATUS_ICONS[t.status] || Circle;
          const label = t.status === "in_progress" && t.active_form ? t.active_form : t.content;
          return (
            <li key={i} className="flex items-start gap-2 text-xs">
              <Icon
                size={12}
                weight={t.status === "completed" ? "fill" : "regular"}
                className={`shrink-0 mt-0.5 ${STATUS_STYLES[t.status] || "text-slate-600"}`}
              />
              <span
                className={`flex-1 leading-relaxed ${
                  t.status === "completed"
                    ? "text-slate-500 line-through"
                    : t.status === "in_progress"
                      ? "text-white"
                      : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
