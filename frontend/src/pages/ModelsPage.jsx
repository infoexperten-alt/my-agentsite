import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  Brain,
  Eye,
  Wrench,
  ListBullets,
  Lightning,
  MagnifyingGlass,
  Star,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react";

const PROVIDER_LABELS = {
  openai: "OpenAI",
  claude: "Anthropic",
  google: "Google",
  groq: "Groq",
  grok: "xAI Grok",
  openrouter: "OpenRouter",
  moonshot: "Moonshot AI",
  zai: "Z.ai (Zhipu)",
  modelscope: "ModelScope",
  azure: "Azure OpenAI",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  local_http: "Local HTTP",
};

function formatNumber(n) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function CapBadge({ icon: Icon, label, active }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
      <Icon size={11} weight="fill" />
      {label}
    </span>
  );
}

export default function ModelsPage() {
  const { models, providers } = useApp();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});

  // Refresh models when page mounts
  useEffect(() => {
    models.refresh();
  }, []);

  const groups = models.groups || {};
  const defaultModel = models.defaultModel || "";

  // Build a set of configured provider names
  const configuredProviders = new Set(
    (providers.providers || []).filter((p) => p.configured).map((p) => p.name)
  );

  // Filter models by search
  const filteredGroups = {};
  for (const [provider, modelList] of Object.entries(groups)) {
    const filtered = modelList.filter((m) =>
      m.id.toLowerCase().includes(search.toLowerCase())
    );
    if (filtered.length > 0) {
      filteredGroups[provider] = filtered;
    }
  }

  const totalModels = Object.values(groups).reduce((s, g) => s + g.length, 0);
  const filteredTotal = Object.values(filteredGroups).reduce(
    (s, g) => s + g.length,
    0
  );
  const providerCount = Object.keys(groups).length;

  const toggleCollapse = (provider) =>
    setCollapsed((prev) => ({ ...prev, [provider]: !prev[provider] }));

  const handleSetDefault = async (modelId) => {
    await models.updateDefaultModel(modelId);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 sticky top-0 z-10">
        <span className="text-sm font-bold text-white">Models</span>
        <span className="text-xs text-slate-500 ml-3">
          All available models from configured providers.
        </span>
      </div>

      <div className="p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats + Search */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Brain size={20} className="text-brand-400" weight="fill" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {totalModels} model{totalModels !== 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-slate-500">
                  {providerCount} provider{providerCount !== 1 ? "s" : ""} active
                </p>
              </div>
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <MagnifyingGlass
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-white text-sm rounded-lg py-2 pl-9 pr-3 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {search && (
              <span className="text-xs text-slate-500">
                {filteredTotal} result{filteredTotal !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Loading */}
          {models.loading && (
            <div className="text-sm text-slate-500 py-12 text-center">
              Discovering models...
            </div>
          )}

          {/* Empty state */}
          {!models.loading && totalModels === 0 && (
            <div className="text-center py-16 space-y-3">
              <Brain size={40} className="text-slate-700 mx-auto" />
              <p className="text-sm text-slate-400">No models available</p>
              <p className="text-xs text-slate-600">
                Configure at least one provider API key to discover models.
              </p>
            </div>
          )}

          {/* Provider groups */}
          {Object.entries(filteredGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([provider, modelList]) => {
              const isCollapsed = collapsed[provider];
              const label = PROVIDER_LABELS[provider] || provider;
              const isConfigured = configuredProviders.has(provider);
              return (
                <div
                  key={provider}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
                >
                  {/* Provider header */}
                  <button
                    onClick={() => toggleCollapse(provider)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? (
                        <CaretRight size={14} className="text-slate-500" />
                      ) : (
                        <CaretDown size={14} className="text-slate-500" />
                      )}
                      <span className="text-sm font-semibold text-white">
                        {label}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {modelList.length} model{modelList.length !== 1 ? "s" : ""}
                      </span>
                      {isConfigured && (
                        <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Model list */}
                  {!isCollapsed && (
                    <div className="border-t border-slate-800">
                      {modelList.map((m) => {
                        const isDefault = m.id === defaultModel;
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-4 px-5 py-3 border-b border-slate-800/50 last:border-b-0 hover:bg-slate-800/30 transition-colors ${
                              isDefault ? "bg-brand-500/5" : ""
                            }`}
                          >
                            {/* Model name */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white font-mono truncate">
                                  {m.id}
                                </span>
                                {isDefault && (
                                  <span className="text-[10px] text-brand-400 bg-brand-500/10 border border-brand-500/20 px-1.5 py-0.5 rounded shrink-0">
                                    Default
                                  </span>
                                )}
                                {m.is_reasoning && (
                                  <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded shrink-0">
                                    Reasoning
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Capabilities */}
                            <div className="hidden md:flex items-center gap-1.5 shrink-0">
                              <CapBadge
                                icon={Eye}
                                label="Vision"
                                active={m.supports_vision}
                              />
                              <CapBadge
                                icon={Wrench}
                                label="Tools"
                                active={m.supports_tool_use}
                              />
                              <CapBadge
                                icon={ListBullets}
                                label="Structured"
                                active={m.supports_structured_output}
                              />
                            </div>

                            {/* Context window */}
                            <div className="hidden lg:block text-right shrink-0 w-20">
                              <p className="text-[10px] text-slate-600">Context</p>
                              <p className="text-xs text-slate-400 font-mono">
                                {formatNumber(m.context_window)}
                              </p>
                            </div>

                            {/* Max output */}
                            <div className="hidden lg:block text-right shrink-0 w-20">
                              <p className="text-[10px] text-slate-600">Output</p>
                              <p className="text-xs text-slate-400 font-mono">
                                {formatNumber(m.max_output_tokens)}
                              </p>
                            </div>

                            {/* Set as default */}
                            {!isDefault && (
                              <button
                                onClick={() => handleSetDefault(m.id)}
                                className="text-[10px] text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 px-2 py-1 rounded transition-colors shrink-0"
                                title="Set as default model"
                              >
                                <Star size={14} />
                              </button>
                            )}
                            {isDefault && (
                              <div className="w-[30px] shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
