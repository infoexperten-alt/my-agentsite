import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Eye, EyeSlash, Trash, CheckCircle, WarningCircle } from "@phosphor-icons/react";

const PROVIDER_INFO = {
  openai: { label: "OpenAI", env: "OPENAI_API_KEY", placeholder: "sk-...", description: "Powers GPT-4o and other OpenAI models." },
  anthropic: { label: "Anthropic", env: "CLAUDE_API_KEY", placeholder: "sk-ant-...", description: "Powers Claude models." },
  google: { label: "Google", env: "GOOGLE_API_KEY", placeholder: "AIza...", description: "Powers Gemini models." },
  groq: { label: "Groq", env: "GROQ_API_KEY", placeholder: "gsk_...", description: "Fast inference for open-source models." },
  openrouter: { label: "OpenRouter", env: "OPENROUTER_API_KEY", placeholder: "sk-or-...", description: "Unified gateway to 100+ models." },
};

export default function ApiKeysPage() {
  const { providers } = useApp();
  const [values, setValues] = useState({});
  const [visible, setVisible] = useState({});
  const [saving, setSaving] = useState(null);

  const handleSave = async (name) => {
    const val = values[name];
    if (!val) return;
    setSaving(name);
    try {
      await providers.update(name, val);
      setValues((prev) => ({ ...prev, [name]: "" }));
    } catch {}
    setSaving(null);
  };

  const configuredCount = providers.providers.filter((p) => p.configured).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 sticky top-0 z-10">
        <span className="text-sm font-bold text-white">API Keys</span>
        <span className="text-xs text-slate-500 ml-3">
          Configure provider credentials to enable model access.
        </span>
      </div>

      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Status summary */}
          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${configuredCount > 0 ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
              {configuredCount > 0 ? (
                <CheckCircle size={22} className="text-green-400" weight="fill" />
              ) : (
                <WarningCircle size={22} className="text-yellow-400" weight="fill" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {configuredCount} of {Object.keys(PROVIDER_INFO).length} providers configured
              </p>
              <p className="text-xs text-slate-500">
                {configuredCount > 0
                  ? "You can start generating websites."
                  : "Add at least one API key to get started."}
              </p>
            </div>
          </div>

          {/* Provider cards */}
          {Object.entries(PROVIDER_INFO).map(([key, info]) => {
            const current = providers.providers.find((p) => p.name === key);
            const isConfigured = current?.configured;
            return (
              <div
                key={key}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {info.label}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {info.description}
                    </p>
                  </div>
                  {isConfigured ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                        Configured
                      </span>
                      <button
                        onClick={() => providers.remove(key)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-800"
                        title="Remove key"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      Not set
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={visible[key] ? "text" : "password"}
                      placeholder={isConfigured ? "••••••••" : info.placeholder}
                      value={values[key] || ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave(key);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 pr-10 focus:border-brand-500 focus:outline-none font-mono"
                    />
                    <button
                      onClick={() =>
                        setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {visible[key] ? <EyeSlash size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(key)}
                    disabled={!values[key] || saving === key}
                    className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {saving === key ? "Saving..." : "Save"}
                  </button>
                </div>

                <p className="text-[10px] text-slate-600 font-mono">
                  {info.env}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
