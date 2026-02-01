import { useState, useEffect, useCallback } from "react";
import { getAgentStats, getAgentRuns, getAgentDailyStats } from "../api/agents";

function timeFilterToParams(timeFilter) {
  const now = new Date();
  if (timeFilter === "Last 30 Days") {
    const since = new Date(now);
    since.setDate(since.getDate() - 30);
    return { since: since.toISOString(), days: 30 };
  }
  if (timeFilter === "Month to Date") {
    const since = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = Math.ceil((now - since) / (1000 * 60 * 60 * 24)) || 1;
    return { since: since.toISOString(), days };
  }
  // All Time
  return { since: null, days: 365 };
}

export function useAnalytics(timeFilter = "Last 30 Days") {
  const [stats, setStats] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { since, days } = timeFilterToParams(timeFilter);
    try {
      const [statsRes, dailyRes, runsRes] = await Promise.all([
        getAgentStats(since),
        getAgentDailyStats(days),
        getAgentRuns(100, since),
      ]);
      setStats(statsRes);
      setDailyStats(dailyRes);
      setRuns(runsRes);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, dailyStats, runs, loading, refresh: fetchData };
}
