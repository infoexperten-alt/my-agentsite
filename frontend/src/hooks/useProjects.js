import { useState, useEffect, useCallback } from "react";
import * as projectsApi from "../api/projects";

export default function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.listProjects();
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (data) => {
      const project = await projectsApi.createProject(data);
      await refresh();
      return project;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id) => {
      await projectsApi.deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, loading, error, refresh, create, remove };
}
