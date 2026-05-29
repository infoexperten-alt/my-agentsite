import { fetchJSON } from "./client.js";

export function listComponents(projectId) {
  return fetchJSON(`/api/projects/${projectId}/components`);
}

export function createComponent(projectId, body) {
  return fetchJSON(`/api/projects/${projectId}/components`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getComponent(projectId, componentId) {
  return fetchJSON(`/api/projects/${projectId}/components/${componentId}`);
}

export function updateComponent(projectId, componentId, body) {
  return fetchJSON(`/api/projects/${projectId}/components/${componentId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteComponent(projectId, componentId) {
  return fetchJSON(`/api/projects/${projectId}/components/${componentId}`, {
    method: "DELETE",
  });
}

export function renderComponent(projectId, componentId, config, instanceId) {
  return fetchJSON(`/api/projects/${projectId}/components/${componentId}/render`, {
    method: "POST",
    body: JSON.stringify({ config, instance_id: instanceId || null }),
  });
}
