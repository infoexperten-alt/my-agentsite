import { useState } from "react";
import { useApp } from "../../context/AppContext";
import Modal from "./Modal";
import ModelSelect from "./ModelSelect";
import { Eye, EyeSlash, Trash } from "@phosphor-icons/react";

const PROVIDER_INFO = {
  openai: { label: "OpenAI", env: "OPENAI_API_KEY", placeholder: "sk-..." },
  anthropic: { label: "Anthropic", env: "CLAUDE_API_KEY", placeholder: "sk-ant-..." },
  google: { label: "Google", env: "GOOGLE_API_KEY", placeholder: "AIza..." },
  groq: { label: "Groq", env: "GROQ_API_KEY", placeholder: "gsk_..." },
  openrouter: { label: "OpenRouter", env: "OPENROUTER_API_KEY", placeholder: "sk-or-..." },
};

export default function SettingsModal({ onClose }) {
  const { providers, models } = useApp();
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

  const handleDefaultModel = async (modelId) => {
    setSaving("default_model");
    try {
      await models.updateDefaultModel(modelId);
    } catch {}
    setSaving(null);
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-6">
        {/* Default Model */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Default Model</h3>
          <p className="text-xs text-slate-500 mb-3">
            Used when no project or agent override is set.
          </p>
          <ModelSelect
            value={models.defaultModel}
            onChange={handleDefaultModel}
            placeholder="openai/gpt-4o"
          />
        </div>

        <div className="border-t border-slate-800" />

        {/* API Keys */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">API Provider Keys</h3>
          <div className="space-y-4">
            {Object.entries(PROVIDER_INFO).map(([key, info]) => {
              const current = providers.providers.find((p) => p.name === key);
              const isConfigured = current?.configured;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-white">
                      {info.label}
                    </label>
                    {isConfigured && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400">Configured</span>
                        <button
                          onClick={() => providers.remove(key)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={visible[key] ? "text" : "password"}
                        placeholder={isConfigured ? "********" : info.placeholder}
                        value={values[key] || ""}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [key]: e.target.value }))
                        }
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
                      className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {saving === key ? "..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
