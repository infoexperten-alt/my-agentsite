import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import useProject from "../hooks/useProject";
import useVersions from "../hooks/useVersions";
import useGeneration from "../hooks/useGeneration";
import { useApp } from "../context/AppContext";
import { getPreviewUrl } from "../api/assets";
import { uploadAsset } from "../api/assets";
import PageBuilderHeader from "../components/layout/PageBuilderHeader";
import ChatSidebar from "../components/builder/ChatSidebar";
import PreviewFrame from "../components/builder/PreviewFrame";
import VersionSelector from "../components/builder/VersionSelector";
import ZoomControls from "../components/builder/ZoomControls";
import ProgressPipeline from "../components/builder/ProgressPipeline";
import Spinner from "../components/shared/Spinner";

export default function PageBuilderPage() {
  const { projectId, slug } = useParams();
  const { project, pages } = useProject(projectId);
  const { versions, refresh: refreshVersions } = useVersions(projectId, slug);
  const { models } = useApp();
  const gen = useGeneration(projectId);

  const [messages, setMessages] = useState([]);
  const [device, setDevice] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [activeVersion, setActiveVersion] = useState(null);

  const page = pages.find((p) => p.slug === slug);

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

  // Build agent status text
  const agentStatus = useMemo(() => {
    const running = Object.entries(gen.agents).find(
      ([, a]) => a.status === "running"
    );
    if (running) return `${running[0]} agent working...`;
    return gen.generating ? "Starting pipeline..." : null;
  }, [gen.agents, gen.generating]);

  const previewUrl = activeVersion
    ? getPreviewUrl(projectId, slug, activeVersion)
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

    // Pick model
    const model =
      project?.model ||
      (models.models.length ? models.models[0].id : "openai/gpt-4o");

    gen.start(slug, { prompt: text, model });
  };

  // Add agent completion messages to chat
  useEffect(() => {
    const completedAgents = Object.entries(gen.agents).filter(
      ([, a]) => a.status === "complete"
    );
    // We only add messages for newly completed agents
    completedAgents.forEach(([name, data]) => {
      const agentLabel = name.charAt(0).toUpperCase() + name.slice(1);
      setMessages((prev) => {
        const exists = prev.some(
          (m) => m.role === "agent" && m.agentKey === name
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            role: "agent",
            content: `${agentLabel} agent completed.`,
            agentKey: name,
          },
        ];
      });
    });
  }, [gen.agents]);

  // Add error message
  useEffect(() => {
    if (gen.error) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: `Error: ${gen.error}` },
      ]);
    }
  }, [gen.error]);

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
          agentStatus={agentStatus}
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
              {gen.generating && <ProgressPipeline agents={gen.agents} />}
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
