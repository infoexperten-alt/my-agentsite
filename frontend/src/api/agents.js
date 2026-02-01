import { fetchJSON } from "./client";

export async function listAgents() {
  return fetchJSON("/api/agents");
}

export async function updateAgent(name, config) {
  return fetchJSON(`/api/agents/${name}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function getAgentRuns(limit = 50) {
  return fetchJSON(`/api/agents/runs?limit=${limit}`);
}

export async function getAgentStats() {
  return fetchJSON("/api/agents/stats");
}
