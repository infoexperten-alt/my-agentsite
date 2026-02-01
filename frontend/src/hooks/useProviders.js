import { useState, useEffect, useCallback } from "react";
import * as providersApi from "../api/providers";

export default function useProviders() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await providersApi.getProviders();
      setProviders(data);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    async (name, value) => {
      await providersApi.updateProvider(name, value);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (name) => {
      await providersApi.deleteProvider(name);
      await refresh();
    },
    [refresh]
  );

  return { providers, loading, refresh, update, remove };
}
