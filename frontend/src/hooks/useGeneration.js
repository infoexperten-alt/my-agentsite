import { useState, useCallback, useRef, useEffect } from "react";
import { startGeneration } from "../api/generate";
import useWebSocket from "./useWebSocket";

export default function useGeneration(projectId) {
  const [generating, setGenerating] = useState(false);
  const [agents, setAgents] = useState({});
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [pipelineAgents, setPipelineAgents] = useState(null);
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
      ws.on("pipeline_plan", (msg) => {
        const agents = msg.data?.required_agents;
        if (agents && agents.length > 0) {
          setPipelineAgents(agents);
        }
      }),
      ws.on("generation_complete", (msg) => {
        setGenerating(false);
        if (msg.data?.success === false && msg.data?.error) {
          setError(msg.data.error);
        }
        ws.disconnect();
        versionRefreshRef.current?.();
      }),
      ws.on("error", (msg) => {
        setError((prev) => {
          // Avoid overwriting with a second error from the same failure
          if (prev) return prev;
          const detail = msg.data?.message || "Generation failed";
          const tb = msg.data?.traceback;
          return tb ? `${detail}\n\n${tb}` : detail;
        });
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
      setPipelineAgents(null);
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

  return { generating, agents, files, error, pipelineAgents, start, onVersionRefresh };
}
