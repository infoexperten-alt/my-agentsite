import { fetchJSON } from "./client";

export const getModels = async () => {
  const data = await fetchJSON("/api/models");
  return data.groups || {};
};

export const getDefaultModel = async () => {
  const data = await fetchJSON("/api/models/default");
  return data.model;
};

export const setDefaultModel = async (model) => {
  return fetchJSON("/api/models/default", {
    method: "PUT",
    body: JSON.stringify({ model }),
  });
};
