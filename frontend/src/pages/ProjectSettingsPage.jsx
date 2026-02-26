import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CaretRight,
  Trash,
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
  FileHtml,
  FileCss,
  FileJs,
  ImageSquare,
  TextAa,
  MagnifyingGlass,
  WheelchairMotion,
  Waveform,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import * as projectsApi from "../api/projects";
import * as agentsApi from "../api/agents";
import ModelSelect from "../components/shared/ModelSelect";
import Spinner from "../components/shared/Spinner";

const ICON_MAP = {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
  FileHtml,
  FileCss,
  FileJs,
  ImageSquare,
  TextAa,
  MagnifyingGlass,
  WheelchairMotion,
  Waveform,
};

const CATEGORY_LABELS = {
  planning: "Planning",
  design: "Design",
  content: "Content",
  development: "Development",
  assets: "Assets",
  seo: "SEO",
  qa: "Quality Assurance",
};

const CATEGORY_ORDER = ["planning", "design", "content", "development", "assets", "seo", "qa"];

function iconBgFromColor(color) {
  return color.replace("text-", "bg-") + "/10";
}

function iconBorderFromColor(color) {
  return color.replace("text-", "border-") + "/20";
}

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

  // Catalog + global agent configs
  const [catalog, setCatalog] = useState([]);
  const [globalAgents, setGlobalAgents] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    Promise.all([agentsApi.getCatalog(), agentsApi.listAgents()])
      .then(([cat, agents]) => {
        setCatalog(cat);
        setGlobalAgents(agents);
      })
      .catch((err) => console.error("Failed to load agent catalog:", err))
      .finally(() => setCatalogLoading(false));
  }, []);

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

  const handleResetAgent = (agentKey) => {
    setAgentOverrides((prev) => {
      const next = { ...prev };
      delete next[agentKey];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
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

  if (loading || catalogLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // Build lookup for global agent configs (enabled status, global model, etc.)
  const globalLookup = {};
  for (const g of globalAgents) {
    globalLookup[g.agent_name] = g;
  }

  // Build agents with catalog metadata, only show enabled agents
  const agentEntries = catalog
    .filter((item) => {
      const global = globalLookup[item.key];
      return global && global.enabled;
    })
    .map((item) => {
      const iconColor = item.icon_color || "text-slate-400";
      const global = globalLookup[item.key] || {};
      return {
        key: item.key,
        label: item.name,
        description: item.description,
        category: item.category,
        legacy: item.legacy,
        icon: ICON_MAP[item.icon] || Code,
        iconColor,
        iconBg: iconBgFromColor(iconColor),
        iconBorder: iconBorderFromColor(iconColor),
        globalModel: global.model || "",
        globalTemp: global.temperature,
      };
    });

  // Group by category
  const agentsByCategory = {};
  for (const agent of agentEntries) {
    const cat = agent.category || "other";
    if (!agentsByCategory[cat]) agentsByCategory[cat] = [];
    agentsByCategory[cat].push(agent);
  }

  const categories = CATEGORY_ORDER.filter((cat) => agentsByCategory[cat]?.length > 0);

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
        <div className="max-w-5xl mx-auto">
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
              <p className="text-sm text-slate-500 mb-6">
                Override model, creativity, and system prompt per agent for this project. Empty fields inherit from global agent settings.
              </p>

              {categories.map((cat) => (
                <div key={cat} className="mb-8">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                    {CATEGORY_LABELS[cat] || cat}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {agentsByCategory[cat].map((agent) => {
                      const Icon = agent.icon;
                      const overrides = agentOverrides[agent.key] || {};
                      const hasOverride = overrides.model || overrides.temperature != null || overrides.system_prompt_override;
                      const creativity = overrides.temperature != null
                        ? Math.round(overrides.temperature * 100)
                        : 50;

                      return (
                        <div
                          key={agent.key}
                          className={`bg-slate-900 border rounded-xl p-6 transition-colors ${
                            hasOverride
                              ? "border-brand-500/30 hover:border-brand-500/50"
                              : "border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-lg ${agent.iconBg} ${agent.iconColor} border ${agent.iconBorder} flex items-center justify-center`}
                              >
                                <Icon size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-white font-bold">{agent.label}</h4>
                                  {agent.legacy && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Legacy
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">{agent.description}</p>
                              </div>
                            </div>
                            {hasOverride && (
                              <button
                                onClick={() => handleResetAgent(agent.key)}
                                className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                title="Reset to global defaults"
                              >
                                Reset
                              </button>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                                Model
                              </label>
                              <ModelSelect
                                value={overrides.model || ""}
                                onChange={(val) => handleAgentChange(agent.key, "model", val)}
                                placeholder={agent.globalModel ? `Inherit (${agent.globalModel})` : "Inherit"}
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
                                  handleAgentChange(agent.key, "temperature", Number(e.target.value) / 100)
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
                                  handleAgentChange(agent.key, "system_prompt_override", e.target.value)
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
              ))}
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
