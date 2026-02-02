import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CaretRight, Trash } from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import * as projectsApi from "../api/projects";
import ModelSelect from "../components/shared/ModelSelect";
import Spinner from "../components/shared/Spinner";

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { project, loading, refresh } = useProject(projectId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync state once project loads
  if (project && !initialized) {
    setName(project.name || "");
    setDescription(project.description || "");
    setModel(project.model || "");
    setInitialized(true);
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(project.id, { name, description, model });
      refresh();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.deleteProject(project.id);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-slate-400 hover:text-white cursor-pointer">
            {project?.name || "..."}
          </span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Settings</span>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-8">
            Project Settings
          </h1>

          <div className="space-y-8 max-w-2xl">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Project Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Default Model
                  </label>
                  <ModelSelect
                    value={model}
                    onChange={setModel}
                    placeholder="System Default"
                  />
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!name.trim() || saving}
                    className="bg-white text-slate-950 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t border-slate-800 pt-8">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
              <p className="text-sm text-slate-500 mb-4">
                Permanently delete this project and all its pages.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Trash size={14} />
                  Delete Project
                </button>
              ) : (
                <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4">
                  <p className="text-sm text-red-300 mb-3">
                    Are you sure? This will permanently delete this project and all its pages.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
