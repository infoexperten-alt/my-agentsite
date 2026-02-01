import { useState, useCallback, useRef, useEffect } from "react";
import { startGeneration } from "../api/generate";
import useWebSocket from "./useWebSocket";

export default function useGeneration(projectId) {
  const [generating, setGenerating] = useState(false);
  const [agents, setAgents] = useState({});
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const ws = useWebSocket(projectId);
  const versionRefreshRef = useRef(null);

  useEffect(() => {
    const unsubs = [
      ws.on("agent_start", (msg) => {
        setAgents((prev) => ({
          ...prev,
          [msg.agent]: { status: "running", ...msg.data },
        }));
      }),
      ws.on("agent_complete", (msg) => {
        setAgents((prev) => ({
          ...prev,
          [msg.agent]: { status: "complete", ...msg.data },
        }));
      }),
      ws.on("file_written", (msg) => {
        setFiles((prev) => [...prev, msg.data]);
      }),
      ws.on("generation_complete", () => {
        setGenerating(false);
        ws.disconnect();
        versionRefreshRef.current?.();
      }),
      ws.on("error", (msg) => {
        setError(msg.data?.message || "Generation failed");
        setGenerating(false);
        ws.disconnect();
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [ws]);

  const start = useCallback(
    async (slug, data) => {
      setGenerating(true);
      setAgents({});
      setFiles([]);
      setError(null);
      ws.connect();
      try {
        await startGeneration(projectId, slug, data);
      } catch (err) {
        setError(err.message);
        setGenerating(false);
        ws.disconnect();
      }
    },
    [projectId, ws]
  );

  const onVersionRefresh = useCallback((fn) => {
    versionRefreshRef.current = fn;
  }, []);

  return { generating, agents, files, error, start, onVersionRefresh };
}
