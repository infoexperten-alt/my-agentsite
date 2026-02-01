import { useState, useEffect, useCallback } from "react";
import * as agentsApi from "../api/agents";

export default function useAgents() {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [agentList, agentStats, agentRuns] = await Promise.all([
        agentsApi.listAgents(),
        agentsApi.getAgentStats(),
        agentsApi.getAgentRuns(20),
      ]);
      setAgents(agentList);
      setStats(agentStats);
      setRuns(agentRuns);
    } catch (err) {
      console.error("Failed to load agent data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateAgent = useCallback(
    async (name, config) => {
      const updated = await agentsApi.updateAgent(name, config);
      setAgents((prev) =>
        prev.map((a) => (a.agent_name === name ? updated : a))
      );
      return updated;
    },
    []
  );

  return { agents, stats, runs, loading, refresh, updateAgent };
}
