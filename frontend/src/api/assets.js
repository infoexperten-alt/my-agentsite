import { fetchJSON, uploadFile, API_BASE } from "./client";

export const listAssets = (projectId) =>
  fetchJSON(`/api/projects/${projectId}/assets`);

export const uploadAsset = (projectId, file) =>
  uploadFile(`/api/projects/${projectId}/assets`, file);

export const getPreviewUrl = (projectId, slug, version) => {
  if (version) {
    return `${API_BASE}/preview/${projectId}/${slug}/v/${version}/index.html`;
  }
  return `${API_BASE}/preview/${projectId}/${slug}`;
};

export const getExportUrl = (projectId) =>
  `${API_BASE}/api/projects/${projectId}/export`;
