import { useState, useEffect, useCallback, useMemo } from "react";
import * as agentsApi from "../api/agents";

export default function useAgents() {
  const [agents, setAgents] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [agentList, agentCatalog, agentStats, agentRuns] = await Promise.all([
        agentsApi.listAgents(),
        agentsApi.getCatalog(),
        agentsApi.getAgentStats(),
        agentsApi.getAgentRuns(20),
      ]);
      setAgents(agentList);
      setCatalog(agentCatalog);
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

  // Group catalog by category for section rendering
  const catalogByCategory = useMemo(() => {
    const groups = {};
    for (const item of catalog) {
      const cat = item.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [catalog]);

  return { agents, catalog, catalogByCategory, stats, runs, loading, refresh, updateAgent };
}
