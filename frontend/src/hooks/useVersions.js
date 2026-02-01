import { useState, useEffect, useCallback } from "react";
import * as projectsApi from "../api/projects";

export default function useVersions(projectId, slug) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId || !slug) return;
    setLoading(true);
    try {
      const data = await projectsApi.listVersions(projectId, slug);
      setVersions(data);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { versions, loading, refresh };
}
