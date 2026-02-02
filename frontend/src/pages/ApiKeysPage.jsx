import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Eye, EyeSlash, Trash, CheckCircle, WarningCircle } from "@phosphor-icons/react";

const PROVIDER_INFO = {
  openai: { label: "OpenAI", env: "OPENAI_API_KEY", placeholder: "sk-...", description: "GPT-4o, GPT-4.1, o3 and more.", category: "cloud" },
  claude: { label: "Anthropic", env: "CLAUDE_API_KEY", placeholder: "sk-ant-...", description: "Claude Opus, Sonnet, Haiku.", category: "cloud" },
  google: { label: "Google", env: "GOOGLE_API_KEY", placeholder: "AIza...", description: "Gemini 2.5 Pro, Flash and more.", category: "cloud" },
  groq: { label: "Groq", env: "GROQ_API_KEY", placeholder: "gsk_...", description: "Fast inference for open-source models.", category: "cloud" },
  grok: { label: "xAI Grok", env: "GROK_API_KEY", placeholder: "xai-...", description: "Grok models from xAI.", category: "cloud" },
  openrouter: { label: "OpenRouter", env: "OPENROUTER_API_KEY", placeholder: "sk-or-...", description: "Unified gateway to 100+ models.", category: "cloud" },
  moonshot: { label: "Moonshot AI", env: "MOONSHOT_API_KEY", placeholder: "sk-...", description: "Kimi models from Moonshot AI.", category: "cloud" },
  zai: { label: "Z.ai (Zhipu)", env: "ZHIPU_API_KEY", placeholder: "...", description: "GLM models from Zhipu AI.", category: "cloud" },
  modelscope: { label: "ModelScope", env: "MODELSCOPE_API_KEY", placeholder: "...", description: "Alibaba Cloud model inference.", category: "cloud" },
  azure: { label: "Azure OpenAI", env: "AZURE_API_KEY", placeholder: "...", description: "Azure-hosted OpenAI models.", category: "cloud" },
  ollama: { label: "Ollama", env: "OLLAMA_ENDPOINT", placeholder: "http://localhost:11434/api/generate", description: "Local models via Ollama.", category: "local" },
  lmstudio: { label: "LM Studio", env: "LMSTUDIO_ENDPOINT", placeholder: "http://127.0.0.1:1234/v1/chat/completions", description: "Local models via LM Studio.", category: "local" },
  local_http: { label: "Local HTTP", env: "LOCAL_HTTP_ENDPOINT", placeholder: "http://localhost:8000/generate", description: "Custom local HTTP endpoint.", category: "local" },
};

const CATEGORIES = [
  { key: "cloud", label: "Cloud Providers" },
  { key: "local", label: "Local / Self-Hosted" },
];

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
  const totalCount = Object.keys(PROVIDER_INFO).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 sticky top-0 z-10">
        <span className="text-sm font-bold text-white">API Keys</span>
        <span className="text-xs text-slate-500 ml-3">
          Configure provider credentials to enable model access.
        </span>
      </div>

      <div className="p-8">
        <div className="max-w-6xl mx-auto space-y-8">
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
                {configuredCount} of {totalCount} providers configured
              </p>
              <p className="text-xs text-slate-500">
                {configuredCount > 0
                  ? "You can start generating websites."
                  : "Add at least one API key to get started."}
              </p>
            </div>
          </div>

          {/* Provider cards by category */}
          {CATEGORIES.map((cat) => {
            const entries = Object.entries(PROVIDER_INFO).filter(
              ([, info]) => info.category === cat.key
            );
            if (entries.length === 0) return null;
            return (
              <div key={cat.key}>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {cat.label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {entries.map(([key, info]) => {
                    const current = providers.providers.find((p) => p.name === key);
                    const isConfigured = current?.configured;
                    return (
                      <div
                        key={key}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">
                              {info.label}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {info.description}
                            </p>
                          </div>
                          {isConfigured ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                                Active
                              </span>
                              <button
                                onClick={() => providers.remove(key)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-800"
                                title="Remove key"
                              >
                                <Trash size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                              Not set
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-auto">
                          <div className="relative flex-1 min-w-0">
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
                              className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-lg py-2 px-3 pr-8 focus:border-brand-500 focus:outline-none font-mono"
                            />
                            <button
                              onClick={() =>
                                setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                              {visible[key] ? <EyeSlash size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <button
                            onClick={() => handleSave(key)}
                            disabled={!values[key] || saving === key}
                            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0"
                          >
                            {saving === key ? "..." : "Save"}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
