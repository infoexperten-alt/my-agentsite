import { useState, useEffect } from "react";
import {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
} from "@phosphor-icons/react";
import { useApp } from "../context/AppContext";
import AgentCard from "../components/agents/AgentCard";
import AgentMetricsBar from "../components/agents/AgentMetricsBar";
import AgentActivityPanel from "../components/agents/AgentActivityPanel";

const STORAGE_KEY = "agentsite_agent_config";

const DEFAULT_AGENTS = [
  {
    key: "pm",
    label: "Product Manager",
    step: "Step 1: Planning & Structure",
    icon: Strategy,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    iconBorder: "border-orange-500/20",
    iconShadow: "0 0 15px rgba(249,115,22,0.1)",
    enabled: true,
    model: "openai/gpt-4o",
    creativity: 20,
    prompt:
      "You are an expert PM. Focus on user conversion flow. Ensure every page has a clear CTA.",
    tags: null,
    tagsLabel: null,
  },
  {
    key: "designer",
    label: "Designer",
    step: "Step 2: UI/UX & Tokens",
    icon: PaintBrushBroad,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10",
    iconBorder: "border-pink-500/20",
    iconShadow: "0 0 15px rgba(236,72,153,0.1)",
    enabled: true,
    model: "anthropic/claude-3.5-sonnet",
    creativity: 60,
    prompt: "",
    tags: ["Modern", "Dark Mode"],
    tagsLabel: "Style Bias",
  },
  {
    key: "developer",
    label: "Developer",
    step: "Step 3: HTML & Tailwind",
    icon: Code,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/20",
    iconShadow: "0 0 15px rgba(59,130,246,0.1)",
    enabled: true,
    model: "anthropic/claude-3.5-sonnet",
    creativity: 10,
    prompt: "",
    tags: ["Tailwind", "HTML5"],
    tagsLabel: "Frameworks",
  },
  {
    key: "reviewer",
    label: "Reviewer",
    step: "Step 4: Quality Assurance",
    icon: CheckCircle,
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
    iconBorder: "border-red-500/20",
    iconShadow: "0 0 15px rgba(239,68,68,0.1)",
    enabled: true,
    model: "openai/gpt-4o",
    creativity: 85,
    prompt: "",
    tags: ["Responsive", "Contrast"],
    tagsLabel: "Focus Area",
  },
];

function loadConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to preserve icon/component references
      return DEFAULT_AGENTS.map((def) => {
        const saved = parsed.find((s) => s.key === def.key);
        if (saved) {
          return {
            ...def,
            enabled: saved.enabled,
            model: saved.model,
            creativity: saved.creativity,
            prompt: saved.prompt,
          };
        }
        return def;
      });
    }
  } catch {}
  return DEFAULT_AGENTS;
}

function saveConfig(agents) {
  const serializable = agents.map(({ key, enabled, model, creativity, prompt }) => ({
    key,
    enabled,
    model,
    creativity,
    prompt,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export default function AgentsPage() {
  const { models } = useApp();
  const [agents, setAgents] = useState(loadConfig);

  useEffect(() => {
    saveConfig(agents);
  }, [agents]);

  const handleChange = (key, updated) => {
    setAgents((prev) => prev.map((a) => (a.key === key ? updated : a)));
  };

  const modelList =
    models.models.length > 0
      ? models.models
      : [
          { id: "openai/gpt-4o", name: "GPT-4o (OpenAI)" },
          { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
        ];

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

          <AgentMetricsBar />

          <h2 className="text-lg font-bold text-white mb-4">
            Pipeline Agents
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {agents.map((agent) => (
              <AgentCard
                key={agent.key}
                agent={agent}
                models={modelList}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      </div>

      <AgentActivityPanel />
    </div>
  );
}
