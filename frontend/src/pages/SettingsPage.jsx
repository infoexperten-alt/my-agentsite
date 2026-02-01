import { useState } from "react";
import { useApp } from "../context/AppContext";
import ModelSelect from "../components/shared/ModelSelect";

export default function SettingsPage() {
  const { models } = useApp();
  const [saving, setSaving] = useState(false);

  const handleDefaultModel = async (modelId) => {
    setSaving(true);
    try {
      await models.updateDefaultModel(modelId);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 sticky top-0 z-10">
        <span className="text-sm font-bold text-white">General Settings</span>
        <span className="text-xs text-slate-500 ml-3">
          Application preferences and configuration.
        </span>
      </div>

      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Default Model
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Used when no project or agent override is set.
              </p>
              <ModelSelect
                value={models.defaultModel}
                onChange={handleDefaultModel}
                placeholder="openai/gpt-4o"
              />
              {saving && (
                <p className="text-xs text-slate-500 mt-2">Saving...</p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Data Directory
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Where projects and generated files are stored.
              </p>
              <div className="bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-400 font-mono">
                ~/.agentsite
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Default Port
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                The port the server runs on.
              </p>
              <div className="bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-400 font-mono">
                6391
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
