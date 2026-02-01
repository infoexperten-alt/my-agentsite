import ModelSelect from "../shared/ModelSelect";

export default function AgentCard({
  agent,
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
  } = agent;

  const handleField = (field, value) => {
    // Map frontend field names to API fields
    const apiUpdate = {};
    if (field === "enabled") apiUpdate.enabled = value;
    else if (field === "model") apiUpdate.model = value;
    else if (field === "creativity") apiUpdate.temperature = value / 100;
    else if (field === "prompt") apiUpdate.system_prompt_override = value;
    onChange(key, apiUpdate);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl ${iconBg} ${iconColor} border ${iconBorder} flex items-center justify-center`}
            style={{ boxShadow: iconShadow }}
          >
            {Icon && <Icon size={24} />}
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
          <ModelSelect
            value={model}
            onChange={(val) => handleField("model", val)}
            placeholder="Project Default"
          />
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

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
            System Instructions Override
          </label>
          <textarea
            value={prompt}
            onChange={(e) => handleField("prompt", e.target.value)}
            placeholder="Leave empty to use default persona"
            className="w-full bg-slate-950 border border-slate-700 text-slate-400 text-xs font-mono rounded-lg p-3 h-20 resize-none focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
