import { fetchJSON } from "./client";

export const getProviders = () => fetchJSON("/api/providers");

export const updateProvider = (name, value) =>
  fetchJSON(`/api/providers/${name}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });

export const deleteProvider = (name) =>
  fetchJSON(`/api/providers/${name}`, { method: "DELETE" });
