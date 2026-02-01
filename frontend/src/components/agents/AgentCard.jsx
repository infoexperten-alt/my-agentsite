import { CaretDown } from "@phosphor-icons/react";

export default function AgentCard({
  agent,
  models,
  onChange,
}) {
  const {
    key,
    label,
    step,
    icon: Icon,
    iconColor,
    iconBg,
    iconBorder,
    iconShadow,
    enabled,
    model,
    creativity,
    prompt,
    tags,
    tagsLabel,
  } = agent;

  const handleField = (field, value) => onChange(key, { ...agent, [field]: value });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl ${iconBg} ${iconColor} border ${iconBorder} flex items-center justify-center`}
            style={{ boxShadow: iconShadow }}
          >
            <Icon size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{label}</h3>
            <p className="text-xs text-slate-500">{step}</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleField("enabled", e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
            Model
          </label>
          <div className="relative">
            <select
              value={model}
              onChange={(e) => handleField("model", e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg p-2.5 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none appearance-none"
            >
              {models.map((m) => (
                <option key={m.id || m} value={m.id || m}>
                  {m.name || m.id || m}
                </option>
              ))}
            </select>
            <CaretDown
              className="absolute right-3 top-3 text-slate-500 pointer-events-none"
              size={14}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Creativity
            </label>
            <span className="text-xs text-slate-400">
              {creativity <= 30
                ? "Strict"
                : creativity <= 70
                  ? "Balanced"
                  : "Creative"}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={creativity}
            onChange={(e) => handleField("creativity", Number(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>

        {tags && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
              {tagsLabel || "Tags"}
            </label>
            <div className="flex gap-2 flex-wrap">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
            System Instructions
          </label>
          <textarea
            value={prompt}
            onChange={(e) => handleField("prompt", e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-400 text-xs font-mono rounded-lg p-3 h-20 resize-none focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
