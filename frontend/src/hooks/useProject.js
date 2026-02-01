import { useState, useEffect, useCallback } from "react";
import * as projectsApi from "../api/projects";

export default function useProject(projectId) {
  const [project, setProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [proj, pgs] = await Promise.all([
        projectsApi.getProject(projectId),
        projectsApi.listPages(projectId),
      ]);
      setProject(proj);
      setPages(pgs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createPage = useCallback(
    async (data) => {
      const page = await projectsApi.createPage(projectId, data);
      await refresh();
      return page;
    },
    [projectId, refresh]
  );

  const removePage = useCallback(
    async (slug) => {
      await projectsApi.deletePage(projectId, slug);
      await refresh();
    },
    [projectId, refresh]
  );

  return { project, pages, loading, error, refresh, createPage, removePage };
}
