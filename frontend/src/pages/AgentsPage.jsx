import {
  Strategy,
  PaintBrushBroad,
  Code,
  CheckCircle,
} from "@phosphor-icons/react";
import useAgents from "../hooks/useAgents";
import AgentCard from "../components/agents/AgentCard";
import AgentMetricsBar from "../components/agents/AgentMetricsBar";
import AgentActivityPanel from "../components/agents/AgentActivityPanel";
import Spinner from "../components/shared/Spinner";

const AGENT_META = {
  pm: {
    label: "Product Manager",
    step: "Step 1: Planning & Structure",
    icon: Strategy,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    iconBorder: "border-orange-500/20",
    iconShadow: "0 0 15px rgba(249,115,22,0.1)",
  },
  designer: {
    label: "Designer",
    step: "Step 2: UI/UX & Tokens",
    icon: PaintBrushBroad,
    iconColor: "text-pink-500",
    iconBg: "bg-pink-500/10",
    iconBorder: "border-pink-500/20",
    iconShadow: "0 0 15px rgba(236,72,153,0.1)",
  },
  developer: {
    label: "Developer",
    step: "Step 3: HTML & Tailwind",
    icon: Code,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/20",
    iconShadow: "0 0 15px rgba(59,130,246,0.1)",
  },
  reviewer: {
    label: "Reviewer",
    step: "Step 4: Quality Assurance",
    icon: CheckCircle,
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
    iconBorder: "border-red-500/20",
    iconShadow: "0 0 15px rgba(239,68,68,0.1)",
  },
};

export default function AgentsPage() {
  const { agents, stats, runs, loading, updateAgent } = useAgents();

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

  // Merge API data with visual metadata
  const mergedAgents = agents.map((cfg) => ({
    ...cfg,
    ...AGENT_META[cfg.agent_name],
    key: cfg.agent_name,
    creativity: Math.round(cfg.temperature * 100),
    prompt: cfg.system_prompt_override || "",
  }));

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

          <h2 className="text-lg font-bold text-white mb-4">
            Pipeline Agents
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mergedAgents.map((agent) => (
              <AgentCard
                key={agent.key}
                agent={agent}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      </div>

      <AgentActivityPanel runs={runs} />
    </div>
  );
}
