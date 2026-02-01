import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import useProject from "../hooks/useProject";
import useVersions from "../hooks/useVersions";
import useGeneration from "../hooks/useGeneration";
import { useApp } from "../context/AppContext";
import { getPreviewUrl, uploadAsset } from "../api/assets";
import { getPage, createPage, listMessages, createMessage } from "../api/projects";
import PageBuilderHeader from "../components/layout/PageBuilderHeader";
import ChatSidebar from "../components/builder/ChatSidebar";
import PreviewFrame from "../components/builder/PreviewFrame";
import VersionSelector from "../components/builder/VersionSelector";
import ZoomControls from "../components/builder/ZoomControls";
import ProgressPipeline from "../components/builder/ProgressPipeline";

export default function PageBuilderPage() {
  const { projectId, slug } = useParams();
  const { project, pages } = useProject(projectId);
  const { versions, refresh: refreshVersions } = useVersions(projectId, slug);
  const { models } = useApp();
  const gen = useGeneration(projectId);

  const [messages, setMessages] = useState([]);
  const [pageReady, setPageReady] = useState(false);
  const [device, setDevice] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [activeVersion, setActiveVersion] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevGenerating = useRef(false);

  const page = pages.find((p) => p.slug === slug);

  // Ensure the page exists in the DB before loading messages
  useEffect(() => {
    if (!projectId || !slug) return;
    let cancelled = false;
    getPage(projectId, slug)
      .catch(() =>
        createPage(projectId, { slug, title: slug.charAt(0).toUpperCase() + slug.slice(1) })
      )
      .then(() => { if (!cancelled) setPageReady(true); })
      .catch(() => { if (!cancelled) setPageReady(true); });
    return () => { cancelled = true; };
  }, [projectId, slug]);

  // Load persisted messages on mount (after page exists)
  useEffect(() => {
    if (!projectId || !slug || !pageReady) return;
    listMessages(projectId, slug)
      .then((saved) => {
        const restored = saved.map((m) => {
          const msg = { role: m.role, content: m.content, time: m.created_at };
          if (m.image) msg.image = m.image;
          if (m.meta && Object.keys(m.meta).length > 0) {
            // Restore agent-progress metadata
            if (m.meta.agents) msg.agents = m.meta.agents;
            if (m.meta.done !== undefined) msg.done = m.meta.done;
          }
          return msg;
        });
        setMessages(restored);
      })
      .catch(() => {});
  }, [projectId, slug, pageReady]);

  // Keep version selector in sync
  useEffect(() => {
    if (versions.length && !activeVersion) {
      setActiveVersion(versions[versions.length - 1].version_number);
    }
  }, [versions, activeVersion]);

  // Wire generation to version refresh
  useEffect(() => {
    gen.onVersionRefresh(refreshVersions);
  }, [gen, refreshVersions]);

  // Detect generation completion: refresh preview and auto-select new version
  useEffect(() => {
    if (prevGenerating.current && !gen.generating) {
      setRefreshKey((k) => k + 1);
      // Auto-select latest version after a short delay for versions to refresh
      setTimeout(() => {
        setActiveVersion(null); // reset so the versions useEffect picks the latest
      }, 500);
    }
    prevGenerating.current = gen.generating;
  }, [gen.generating]);

  const previewUrl = activeVersion
    ? getPreviewUrl(projectId, slug, activeVersion) + `?t=${refreshKey}`
    : getPreviewUrl(projectId, slug);

  const handleSend = async ({ text, image }) => {
    let imageUrl = null;
    if (image) {
      try {
        const result = await uploadAsset(projectId, image);
        imageUrl = result.url;
      } catch {}
    }

    const userMsg = {
      role: "user",
      content: text,
      image: imageUrl,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Persist to backend
    createMessage(projectId, slug, {
      role: "user",
      content: text,
      image: imageUrl,
    }).catch(() => {});

    // Pick model
    const model =
      project?.model ||
      (models.models.length ? models.models[0].id : "openai/gpt-4o");

    gen.start(slug, { prompt: text, model });
  };

  // Build pipeline agent labels
  const getAgentLabel = useCallback((name) => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  // Maintain a single agent-progress message that updates as events arrive
  useEffect(() => {
    if (!gen.generating && Object.keys(gen.agents).length === 0) return;

    const agentEntries = Object.entries(gen.agents);
    if (agentEntries.length === 0 && !gen.pipelineAgents) return;

    // Build the agents list in canonical order, filtered to those in this pipeline
    const CANONICAL_ORDER = ["pm", "designer", "developer", "reviewer"];
    const pipelineSet = gen.pipelineAgents || agentEntries.map(([name]) => name);
    const knownAgents = CANONICAL_ORDER.filter((k) => pipelineSet.includes(k));
    const agentsList = knownAgents.map((name) => {
      const agentData = gen.agents[name] || {};
      return {
        name,
        label: getAgentLabel(name),
        status: agentData.status || "pending",
        startedAt: agentData.startedAt || null,
        duration_s: agentData.duration_s ?? null,
        input_tokens: agentData.input_tokens || 0,
        output_tokens: agentData.output_tokens || 0,
        output_preview: agentData.output_preview || "",
        tool_calls_count: agentData.tool_calls_count || 0,
      };
    });

    const done = !gen.generating;

    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.role === "agent-progress" && m._genActive);
      const progressMsg = {
        role: "agent-progress",
        agents: agentsList,
        done,
        _genActive: !done,
      };

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = progressMsg;
        return updated;
      }
      return [...prev, progressMsg];
    });

    // Persist the final agent-progress message when generation finishes
    if (done) {
      createMessage(projectId, slug, {
        role: "agent-progress",
        content: "",
        meta: { agents: agentsList, done: true },
      }).catch(() => {});
    }
  }, [gen.agents, gen.generating, gen.pipelineAgents, getAgentLabel, projectId, slug]);

  // Add error message
  useEffect(() => {
    if (gen.error) {
      const errorContent = `Error: ${gen.error}`;
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: errorContent },
      ]);
      createMessage(projectId, slug, {
        role: "agent",
        content: errorContent,
      }).catch(() => {});
    }
  }, [gen.error, projectId, slug]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-300 font-sans antialiased selection:bg-brand-500 selection:text-white">
      <PageBuilderHeader
        projectId={projectId}
        page={page}
        device={device}
        onDeviceChange={setDevice}
      />

      <div className="flex-1 flex overflow-hidden">
        <ChatSidebar
          messages={messages}
          onSend={handleSend}
          generating={gen.generating}
        />

        <main className="flex-1 bg-[#0c0e14] relative flex flex-col items-center justify-center p-8 overflow-hidden">
          {/* Grid background */}
          <div
            className="absolute inset-0 z-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(#334155 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Dimensions label */}
          <div className="absolute top-4 text-xs font-mono text-slate-500 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 z-20">
            {device || "100%"} <span className="text-slate-600">x</span> auto
          </div>

          {/* Version selector + pipeline */}
          {(versions.length > 0 || gen.generating) && (
            <div className="absolute top-4 right-4 flex items-center gap-4 z-20">
              {gen.generating && <ProgressPipeline agents={gen.agents} pipelineAgents={gen.pipelineAgents} />}
              <VersionSelector
                versions={versions}
                active={activeVersion}
                onChange={setActiveVersion}
              />
            </div>
          )}

          {/* Preview frame */}
          <div
            className="relative flex items-center justify-center w-full h-full z-10"
            style={{ zoom: `${zoom}%` }}
          >
            <PreviewFrame src={previewUrl} width={device} />
          </div>

          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </main>
      </div>
    </div>
  );
}
