import { fetchJSON } from "./client";

export const startGeneration = (projectId, slug, data) =>
  fetchJSON(`/api/projects/${projectId}/pages/${slug}/generate`, {
    method: "POST",
    body: JSON.stringify(data),
  });
