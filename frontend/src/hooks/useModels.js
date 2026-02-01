import { useState, useEffect, useCallback } from "react";
import { getModels } from "../api/models";

export default function useModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getModels();
      setModels(data);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, refresh };
}
