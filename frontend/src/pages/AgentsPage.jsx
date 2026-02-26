import {
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
import useAgents from "../hooks/useAgents";
import AgentCard from "../components/agents/AgentCard";
import AgentMetricsBar from "../components/agents/AgentMetricsBar";
import AgentActivityPanel from "../components/agents/AgentActivityPanel";
import Spinner from "../components/shared/Spinner";

// Map icon names from catalog to Phosphor components
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

// Fallback visual metadata for agents not in catalog
const FALLBACK_META = {
  pm: { icon: "Strategy", icon_color: "text-orange-500" },
  designer: { icon: "PaintBrushBroad", icon_color: "text-pink-500" },
  developer: { icon: "Code", icon_color: "text-blue-500" },
  reviewer: { icon: "CheckCircle", icon_color: "text-red-500" },
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
  // "text-orange-500" -> "bg-orange-500/10"
  return color.replace("text-", "bg-") + "/10";
}

function iconBorderFromColor(color) {
  return color.replace("text-", "border-") + "/20";
}

function iconShadowFromColor(color) {
  // Extract the color family for a subtle glow
  const shadowMap = {
    "text-orange-500": "0 0 15px rgba(249,115,22,0.1)",
    "text-orange-400": "0 0 15px rgba(251,146,60,0.1)",
    "text-pink-500": "0 0 15px rgba(236,72,153,0.1)",
    "text-blue-500": "0 0 15px rgba(59,130,246,0.1)",
    "text-blue-400": "0 0 15px rgba(96,165,250,0.1)",
    "text-red-500": "0 0 15px rgba(239,68,68,0.1)",
    "text-yellow-400": "0 0 15px rgba(250,204,21,0.1)",
    "text-purple-400": "0 0 15px rgba(192,132,252,0.1)",
    "text-emerald-400": "0 0 15px rgba(52,211,153,0.1)",
    "text-teal-400": "0 0 15px rgba(45,212,191,0.1)",
    "text-lime-400": "0 0 15px rgba(163,230,53,0.1)",
    "text-cyan-400": "0 0 15px rgba(34,211,238,0.1)",
    "text-violet-400": "0 0 15px rgba(167,139,250,0.1)",
  };
  return shadowMap[color] || "0 0 15px rgba(100,100,100,0.1)";
}

export default function AgentsPage() {
  const { agents, catalog, catalogByCategory, stats, runs, loading, updateAgent } = useAgents();

  const handleChange = async (agentName, updates) => {
    try {
      await updateAgent(agentName, updates);
    } catch (err) {
      console.error("Failed to update agent:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // Build catalog lookup for visual metadata
  const catalogLookup = {};
  for (const item of catalog) {
    catalogLookup[item.key] = item;
  }

  // Merge API configs with catalog metadata
  const mergedAgents = agents.map((cfg) => {
    const catMeta = catalogLookup[cfg.agent_name] || FALLBACK_META[cfg.agent_name] || {};
    const iconColor = catMeta.icon_color || "text-slate-400";
    return {
      ...cfg,
      label: catMeta.name || cfg.agent_name,
      step: catMeta.description || "",
      icon: ICON_MAP[catMeta.icon] || Code,
      iconColor,
      iconBg: iconBgFromColor(iconColor),
      iconBorder: iconBorderFromColor(iconColor),
      iconShadow: iconShadowFromColor(iconColor),
      key: cfg.agent_name,
      category: catMeta.category || cfg.category || "",
      legacy: catMeta.legacy || false,
      creativity: Math.round(cfg.temperature * 100),
      prompt: cfg.system_prompt_override || "",
    };
  });

  // Group agents by category
  const agentsByCategory = {};
  for (const agent of mergedAgents) {
    const cat = agent.category || "other";
    if (!agentsByCategory[cat]) agentsByCategory[cat] = [];
    agentsByCategory[cat].push(agent);
  }

  // Render categories in canonical order
  const categories = CATEGORY_ORDER.filter((cat) => agentsByCategory[cat]?.length > 0);

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-white">Agent Pipeline</h1>
            <p className="text-xs text-slate-500">
              Configure the AI models powering your workflow.
            </p>
          </div>

          <AgentMetricsBar stats={stats} agents={agents} />

          {categories.map((cat) => (
            <div key={cat} className="mb-8">
              <h2 className="text-lg font-bold text-white mb-4">
                {CATEGORY_LABELS[cat] || cat}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agentsByCategory[cat].map((agent) => (
                  <AgentCard
                    key={agent.key}
                    agent={agent}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AgentActivityPanel runs={runs} />
    </div>
  );
}
