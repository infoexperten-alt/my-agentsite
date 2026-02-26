import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CaretRight,
  CaretDown,
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
  const [expandedAgents, setExpandedAgents] = useState({});

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
        const hasEnabled = overrides.enabled !== undefined;
        const hasModel = overrides.model && overrides.model.trim();
        const hasTemp = overrides.temperature !== undefined && overrides.temperature !== null;
        const hasPrompt = overrides.system_prompt_override && overrides.system_prompt_override.trim();
        if (hasEnabled || hasModel || hasTemp || hasPrompt) {
          cleaned[key] = {};
          if (hasEnabled) cleaned[key].enabled = overrides.enabled;
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

  // Build agents with catalog metadata — show ALL agents so users can toggle them
  const agentEntries = catalog.map((item) => {
    const iconColor = item.icon_color || "text-slate-400";
    const global = globalLookup[item.key] || {};
    const overrides = agentOverrides[item.key] || {};
    // Project-level enabled state: explicit override > global setting > true
    const globalEnabled = global.enabled !== undefined ? global.enabled : true;
    const enabled = overrides.enabled !== undefined ? overrides.enabled : globalEnabled;
    return {
      key: item.key,
      label: item.name,
      description: item.description,
      category: item.category,
      legacy: item.legacy,
      singleton: item.singleton,
      icon: ICON_MAP[item.icon] || Code,
      iconColor,
      iconBg: iconBgFromColor(iconColor),
      iconBorder: iconBorderFromColor(iconColor),
      globalModel: global.model || "",
      globalTemp: global.temperature,
      globalEnabled,
      enabled,
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
                Enable or disable agents and override model, creativity, and system prompt per agent for this project. Disabled agents will be excluded from the generation pipeline.
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
                      const hasOverride = overrides.model || overrides.temperature != null || overrides.system_prompt_override || overrides.enabled !== undefined;
                      const creativity = overrides.temperature != null
                        ? Math.round(overrides.temperature * 100)
                        : 50;
                      const isExpanded = expandedAgents[agent.key];

                      return (
                        <div
                          key={agent.key}
                          className={`bg-slate-900 border rounded-xl transition-colors ${
                            !agent.enabled
                              ? "border-slate-800/50 opacity-60"
                              : hasOverride
                                ? "border-brand-500/30 hover:border-brand-500/50"
                                : "border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-lg flex-shrink-0 ${agent.iconBg} ${agent.iconColor} border ${agent.iconBorder} flex items-center justify-center ${!agent.enabled ? "grayscale" : ""}`}
                              >
                                <Icon size={20} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className={`font-bold ${agent.enabled ? "text-white" : "text-slate-500"}`}>{agent.label}</h4>
                                  {agent.legacy && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      Legacy
                                    </span>
                                  )}
                                  {agent.singleton && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                      Core
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-1">{agent.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {hasOverride && (
                                <button
                                  onClick={() => handleResetAgent(agent.key)}
                                  className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                  title="Reset to global defaults"
                                >
                                  Reset
                                </button>
                              )}
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={agent.enabled}
                                  onChange={(e) => handleAgentChange(agent.key, "enabled", e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                              </label>
                            </div>
                          </div>

                          {agent.enabled && (
                            <>
                              <button
                                onClick={() => setExpandedAgents(prev => ({ ...prev, [agent.key]: !prev[agent.key] }))}
                                className="w-full flex items-center gap-1.5 px-5 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-400 transition-colors border-t border-slate-800/50"
                              >
                                {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                Configure
                              </button>
                              {isExpanded && (
                                <div className="px-5 pb-5 space-y-4">
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
                              )}
                            </>
                          )}
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
