import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, CaretRight, Globe } from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import PageCard from "../components/project/PageCard";
import CreatePageCard from "../components/project/CreatePageCard";
import BrandIdentityPanel from "../components/project/BrandIdentityPanel";
import Badge from "../components/shared/Badge";
import Modal from "../components/shared/Modal";
import Spinner from "../components/shared/Spinner";

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { project, pages, loading, createPage, removePage } =
    useProject(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const slug =
        newSlug.trim() ||
        newTitle
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      await createPage({ title: newTitle.trim(), slug });
      setShowCreate(false);
      setNewTitle("");
      setNewSlug("");
    } catch {}
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  const status = project?.style_spec ? "live" : "draft";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Breadcrumb header */}
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">
            {project?.name || "..."}
          </span>
          <span className="ml-2">
            <Badge status={status}>{status}</Badge>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-slate-400 hover:text-white transition-colors px-3 py-1.5 text-sm font-medium">
            <Globe className="inline mr-1" size={14} />
            Visit Live Site
          </button>
          <a
            href={`/api/projects/${projectId}/export`}
            className="bg-white text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors shadow-lg shadow-white/5"
          >
            Export Code
          </a>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Pages grid */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Pages</h2>
                <p className="text-slate-500 text-sm">
                  Manage the structure of your website.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-brand-500/20"
              >
                <Plus size={14} />
                New Page
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pages.map((page) => (
                <PageCard
                  key={page.id}
                  page={page}
                  status="draft"
                  onDelete={(slug) => {
                    if (confirm("Delete this page?")) removePage(slug);
                  }}
                />
              ))}
              <CreatePageCard onClick={() => setShowCreate(true)} />
            </div>
          </div>

          {/* Brand panel */}
          <div className="lg:col-span-4">
            <BrandIdentityPanel
              project={project}
              onEditBrand={() =>
                navigate(`/project/${projectId}/settings?tab=brand`)
              }
            />
          </div>
        </div>
      </div>

      {showCreate && (
        <Modal title="Add New Page" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Page Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="About Us"
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                URL Slug
              </label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="about (auto-generated if empty)"
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none font-mono"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="w-full bg-white text-slate-950 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Add Page"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
