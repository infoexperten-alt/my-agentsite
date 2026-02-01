import { useState, useEffect, useCallback } from "react";
import { getModels, getDefaultModel, setDefaultModel } from "../api/models";

export default function useModels() {
  const [groups, setGroups] = useState({});
  const [defaultModel, setDefault] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, dm] = await Promise.all([getModels(), getDefaultModel()]);
      setGroups(data);
      setDefault(dm);
    } catch {
      setGroups({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateDefaultModel = useCallback(async (model) => {
    await setDefaultModel(model);
    setDefault(model);
  }, []);

  // Flat list for backwards compat
  const models = Object.values(groups).flat();

  return { groups, models, defaultModel, updateDefaultModel, loading, refresh };
}
