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
import DiscoveryForm from "../components/builder/DiscoveryForm";
import PreviewFrame from "../components/builder/PreviewFrame";
import CodeView from "../components/builder/CodeView";
import ZoomControls from "../components/builder/ZoomControls";

export default function PageBuilderPage() {
  const { projectId, slug } = useParams();
  const { project, pages, refresh: refreshProject } = useProject(projectId);
  const { versions, refresh: refreshVersions } = useVersions(projectId, slug);
  const { models } = useApp();
  const gen = useGeneration(projectId);

  const [messages, setMessages] = useState([]);
  const [pageReady, setPageReady] = useState(false);
  const [device, setDevice] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [activeVersion, setActiveVersion] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState("preview");
  const [pendingBrief, setPendingBrief] = useState(null); // { text, image } awaiting discovery answers
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

  // Wire generation to project refresh (brand data auto-updates after generation)
  useEffect(() => {
    gen.onProjectRefresh(refreshProject);
  }, [gen, refreshProject]);

  // Detect generation completion: refresh preview and auto-select new version
  useEffect(() => {
    if (prevGenerating.current && !gen.generating) {
      setRefreshKey((k) => k + 1);
      setTimeout(() => {
        setActiveVersion(null);
      }, 500);
    }
    prevGenerating.current = gen.generating;
  }, [gen.generating]);

  const previewUrl = activeVersion
    ? getPreviewUrl(projectId, slug, activeVersion) + `?t=${refreshKey}`
    : getPreviewUrl(projectId, slug);

  const isFirstBrief = (versions?.length || 0) === 0 && messages.every((m) => m.role !== "user");

  const startBuild = async ({ text, image, brief }) => {
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
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    createMessage(projectId, slug, {
      role: "user",
      content: text,
      image: imageUrl,
    }).catch(() => {});

    const model =
      project?.model ||
      (models.models.length ? models.models[0].id : "openai/gpt-4o");

    const payload = { prompt: text, model };
    if (brief) payload.discovery_brief = brief;
    gen.start(slug, payload);
  };

  const handleSend = async ({ text, image }) => {
    if (isFirstBrief) {
      // Defer until discovery form is answered (or skipped).
      setPendingBrief({ text, image });
      return;
    }
    await startBuild({ text, image });
  };

  const handleDiscoverySubmit = async (answers) => {
    const pending = pendingBrief;
    setPendingBrief(null);
    if (!pending) return;
    await startBuild({ ...pending, brief: answers });
  };

  const handleDiscoverySkip = async () => {
    const pending = pendingBrief;
    setPendingBrief(null);
    if (!pending) return;
    await startBuild(pending);
  };

  const getAgentLabel = useCallback((name) => {
    const labels = {
      pm: "PM",
      designer: "Designer",
      developer: "Developer",
      reviewer: "Reviewer",
      markup: "Markup",
      style: "Style",
      style_scss: "SCSS",
      script: "Script",
      image: "Image",
    };
    return labels[name] || name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  // Maintain a single agent-progress message that updates as events arrive
  useEffect(() => {
    if (!gen.generating && Object.keys(gen.agents).length === 0) return;

    const agentEntries = Object.entries(gen.agents);
    if (agentEntries.length === 0 && !gen.pipelineAgents) return;

    const CANONICAL_ORDER = ["pm", "designer", "image", "developer", "markup", "style", "style_scss", "script", "reviewer"];
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
        full_output: agentData.full_output || "",
        tool_calls_count: agentData.tool_calls_count || 0,
        model: agentData.model || "",
        reasoning: agentData.reasoning || "",
        thinking: agentData.thinking || "",
        steps: agentData.steps || [],
        iteration: agentData.iteration || 0,
        retryReason: agentData.retryReason || "",
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
        versions={versions}
        activeVersion={activeVersion}
        onVersionChange={setActiveVersion}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="flex-1 flex overflow-hidden">
        <ChatSidebar
          messages={messages}
          onSend={handleSend}
          generating={gen.generating}
          discoveryForm={
            pendingBrief ? (
              <DiscoveryForm
                initialPrompt={pendingBrief.text}
                onSubmit={handleDiscoverySubmit}
                onSkip={handleDiscoverySkip}
              />
            ) : null
          }
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

          {/* Preview or Code view */}
          <div
            className="relative flex items-center justify-center w-full h-full z-10"
            style={{ zoom: `${zoom}%` }}
          >
            {viewMode === "code" ? (
              <CodeView
                projectId={projectId}
                slug={slug}
                version={activeVersion}
                width={device}
              />
            ) : (
              <PreviewFrame src={previewUrl} width={device} />
            )}
          </div>

          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </main>
      </div>
    </div>
  );
}
