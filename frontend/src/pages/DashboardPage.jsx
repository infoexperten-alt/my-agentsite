import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import useProjects from "../hooks/useProjects";
import { useApp } from "../context/AppContext";
import ProjectCard from "../components/dashboard/ProjectCard";
import CreateProjectCard from "../components/dashboard/CreateProjectCard";
import ProjectFilterBar from "../components/dashboard/ProjectFilterBar";
import Modal from "../components/shared/Modal";
import Spinner from "../components/shared/Spinner";

export default function DashboardPage() {
  const { projects, loading, create, remove } = useProjects();
  const { search } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreate(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    let list = projects;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    if (filter === "Live") {
      list = list.filter((p) => p.style_spec);
    } else if (filter === "Drafts") {
      list = list.filter((p) => !p.style_spec);
    }
    return list;
  }, [projects, search, filter]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await create({ name: newName.trim(), description: newDesc.trim() });
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
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

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Projects</h1>
            <p className="text-slate-500 text-sm">
              Manage your AI-generated sites and deployments.
            </p>
          </div>
          <ProjectFilterBar active={filter} onChange={setFilter} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CreateProjectCard onClick={() => setShowCreate(true)} />
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(id) => {
                if (confirm("Delete this project?")) remove(id);
              }}
            />
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <p className="text-center text-slate-500 mt-12">
            No projects found. Create one to get started.
          </p>
        )}
      </div>

      {showCreate && (
        <Modal title="Create New Project" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Awesome Site"
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="A brief description..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="w-full bg-white text-slate-950 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Project"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
