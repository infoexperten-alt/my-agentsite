import { fetchJSON } from "./client";

export const getModels = () => fetchJSON("/api/models");
