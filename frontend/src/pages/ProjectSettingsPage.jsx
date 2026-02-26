import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CaretRight,
  Trash,
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import * as projectsApi from "../api/projects";
import ModelSelect from "../components/shared/ModelSelect";
import Spinner from "../components/shared/Spinner";

const AGENT_KEYS = ["pm", "designer", "developer", "reviewer"];

const AGENT_META = {
  pm: {
    label: "Product Manager",
    step: "Step 1: Planning & Structure",
    icon: Strategy,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    iconBorder: "border-orange-500/20",
  },
  designer: {
    label: "Designer",
    step: "Step 2: UI/UX & Tokens",
    icon: PaintBrushBroad,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10",
    iconBorder: "border-pink-500/20",
  },
  developer: {
    label: "Developer",
    step: "Step 3: HTML & Tailwind",
    icon: Code,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/20",
  },
  reviewer: {
    label: "Reviewer",
    step: "Step 4: Quality Assurance",
    icon: CheckCircle,
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
    iconBorder: "border-red-500/20",
  },
};

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { project, loading, refresh } = useProject(projectId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [agentOverrides, setAgentOverrides] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync state once project loads
  if (project && !initialized) {
    setName(project.name || "");
    setDescription(project.description || "");
    setModel(project.model || "");
    setAgentOverrides(project.agent_overrides || {});
    setInitialized(true);
  }

  const handleAgentChange = (agentKey, field, value) => {
    setAgentOverrides((prev) => ({
      ...prev,
      [agentKey]: {
        ...prev[agentKey],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean agent overrides: remove agents with no meaningful values
      const cleaned = {};
      for (const [key, overrides] of Object.entries(agentOverrides)) {
        if (!overrides) continue;
        const hasModel = overrides.model && overrides.model.trim();
        const hasTemp = overrides.temperature !== undefined && overrides.temperature !== null;
        const hasPrompt = overrides.system_prompt_override && overrides.system_prompt_override.trim();
        if (hasModel || hasTemp || hasPrompt) {
          cleaned[key] = {};
          if (hasModel) cleaned[key].model = overrides.model;
          if (hasTemp) cleaned[key].temperature = overrides.temperature;
          if (hasPrompt) cleaned[key].system_prompt_override = overrides.system_prompt_override;
        }
      }
      await projectsApi.updateProject(project.id, {
        name,
        description,
        model,
        agent_overrides: Object.keys(cleaned).length > 0 ? cleaned : {},
      });
      refresh();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.deleteProject(project.id);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-slate-400 hover:text-white cursor-pointer">
            {project?.name || "..."}
          </span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Settings</span>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-8">
            Project Settings
          </h1>

          <div className="space-y-8">
            {/* Project Details */}
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">Project Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Default Model
                  </label>
                  <ModelSelect
                    value={model}
                    onChange={setModel}
                    placeholder="System Default"
                  />
                </div>
              </div>
            </div>

            {/* Pipeline Agents */}
            <div className="border-t border-slate-800 pt-8">
              <h3 className="text-lg font-semibold text-white mb-1">Pipeline Agents</h3>
              <p className="text-sm text-slate-500 mb-4">
                Override model, creativity, and system prompt per agent for this project. Empty fields inherit from global agent settings.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AGENT_KEYS.map((agentKey) => {
                  const meta = AGENT_META[agentKey];
                  const Icon = meta.icon;
                  const overrides = agentOverrides[agentKey] || {};
                  const creativity = overrides.temperature != null
                    ? Math.round(overrides.temperature * 100)
                    : 50;

                  return (
                    <div
                      key={agentKey}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className={`w-10 h-10 rounded-lg ${meta.iconBg} ${meta.iconColor} border ${meta.iconBorder} flex items-center justify-center`}
                        >
                          <Icon size={20} />
                        </div>
                        <div>
                          <h4 className="text-white font-bold">{meta.label}</h4>
                          <p className="text-xs text-slate-500">{meta.step}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                            Model
                          </label>
                          <ModelSelect
                            value={overrides.model || ""}
                            onChange={(val) => handleAgentChange(agentKey, "model", val)}
                            placeholder="Inherit"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase">
                              Creativity
                            </label>
                            <span className="text-xs text-slate-400">
                              {overrides.temperature == null
                                ? "Inherit"
                                : creativity <= 30
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
                            onChange={(e) =>
                              handleAgentChange(agentKey, "temperature", Number(e.target.value) / 100)
                            }
                            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                            System Prompt Override
                          </label>
                          <textarea
                            value={overrides.system_prompt_override || ""}
                            onChange={(e) =>
                              handleAgentChange(agentKey, "system_prompt_override", e.target.value)
                            }
                            placeholder="Leave empty to inherit"
                            className="w-full bg-slate-950 border border-slate-700 text-slate-400 text-xs font-mono rounded-lg p-3 h-20 resize-none focus:border-brand-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Save button */}
            <div className="max-w-2xl">
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="bg-white text-slate-950 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Danger zone */}
            <div className="border-t border-slate-800 pt-8 max-w-2xl">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-slate-500 mb-4">
                Permanently delete this project and all its pages.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash size={14} />
                  Delete Project
                </button>
              ) : (
                <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-300 mb-3">
                    Are you sure? This will permanently delete this project and all its pages.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
