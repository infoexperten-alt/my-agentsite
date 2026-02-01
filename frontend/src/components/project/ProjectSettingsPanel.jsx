import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash } from "@phosphor-icons/react";
import * as projectsApi from "../../api/projects";
import Modal from "../shared/Modal";
import ModelSelect from "../shared/ModelSelect";

export default function ProjectSettingsPanel({ project, onClose, onUpdate }) {
  const navigate = useNavigate();
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [model, setModel] = useState(project?.model || "");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Style spec fields
  const ss = project?.style_spec;
  const [primaryColor, setPrimaryColor] = useState(ss?.primary_color || "#2563eb");
  const [secondaryColor, setSecondaryColor] = useState(ss?.secondary_color || "#1e40af");
  const [accentColor, setAccentColor] = useState(ss?.accent_color || "#f59e0b");
  const [bgColor, setBgColor] = useState(ss?.background_color || "#ffffff");
  const [fontHeading, setFontHeading] = useState(ss?.font_heading || "Inter");
  const [fontBody, setFontBody] = useState(ss?.font_body || "Inter");

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { name, description, model };
      if (ss) {
        data.style_spec = {
          ...ss,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          background_color: bgColor,
          font_heading: fontHeading,
          font_body: fontBody,
        };
      }
      const updated = await projectsApi.updateProject(project.id, data);
      onUpdate?.(updated);
      onClose();
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await projectsApi.deleteProject(project.id);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  return (
    <Modal title="Project Settings" onClose={onClose}>
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
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
            rows={2}
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

        {ss && (
          <>
            <div className="border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-white mb-3">Brand Colors</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Primary", value: primaryColor, set: setPrimaryColor },
                  { label: "Secondary", value: secondaryColor, set: setSecondaryColor },
                  { label: "Accent", value: accentColor, set: setAccentColor },
                  { label: "Background", value: bgColor, set: setBgColor },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs font-mono rounded py-1.5 px-2 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Typography</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Heading Font</label>
                  <input
                    type="text"
                    value={fontHeading}
                    onChange={(e) => setFontHeading(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded py-1.5 px-2 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Body Font</label>
                  <input
                    type="text"
                    value={fontBody}
                    onChange={(e) => setFontBody(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded py-1.5 px-2 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
          >
            <Trash size={14} />
            Delete Project
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="bg-white text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4 mt-2">
            <p className="text-sm text-red-300 mb-3">
              Are you sure? This will permanently delete this project and all its pages.
            </p>
            <div className="flex gap-2 justify-end">
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
    </Modal>
  );
}
