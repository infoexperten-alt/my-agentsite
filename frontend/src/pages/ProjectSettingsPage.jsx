import { useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  CaretRight,
  Trash,
  UploadSimple,
  Palette,
  Gear,
  Image,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import * as projectsApi from "../api/projects";
import * as assetsApi from "../api/assets";
import ModelSelect from "../components/shared/ModelSelect";
import Spinner from "../components/shared/Spinner";

const DEFAULT_STYLE_SPEC = {
  primary_color: "#2563eb",
  secondary_color: "#1e40af",
  accent_color: "#f59e0b",
  background_color: "#ffffff",
  text_color: "#1f2937",
  font_heading: "Inter",
  font_body: "Inter",
  border_radius: "8px",
  spacing_unit: "1rem",
};

const TABS = [
  { key: "general", label: "General", icon: Gear },
  { key: "brand", label: "Brand Identity", icon: Palette },
];

function GeneralTab({ project, refresh }) {
  const navigate = useNavigate();
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [model, setModel] = useState(project?.model || "");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  return (
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
  );
}

function FileUpload({ label, currentUrl, onUpload, projectId }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await assetsApi.uploadAsset(projectId, file);
      onUpload(result.path);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-lg bg-black border border-slate-700 flex items-center justify-center relative group cursor-pointer overflow-hidden"
        >
          {currentUrl ? (
            <img
              src={`/preview/${projectId}/assets/${currentUrl}`}
              alt={label}
              className="w-full h-full object-contain"
            />
          ) : (
            <Image className="text-slate-600" size={24} />
          )}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Spinner size={16} />
            ) : (
              <UploadSimple className="text-white" size={20} />
            )}
          </div>
        </div>
        <div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium"
          >
            {uploading ? "Uploading..." : currentUrl ? "Replace" : "Upload"}
          </button>
          {currentUrl && (
            <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate max-w-[200px]">
              {currentUrl}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

function BrandTab({ project, refresh }) {
  const ss = project?.style_spec;
  const [primaryColor, setPrimaryColor] = useState(ss?.primary_color || DEFAULT_STYLE_SPEC.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(ss?.secondary_color || DEFAULT_STYLE_SPEC.secondary_color);
  const [accentColor, setAccentColor] = useState(ss?.accent_color || DEFAULT_STYLE_SPEC.accent_color);
  const [bgColor, setBgColor] = useState(ss?.background_color || DEFAULT_STYLE_SPEC.background_color);
  const [textColor, setTextColor] = useState(ss?.text_color || DEFAULT_STYLE_SPEC.text_color);
  const [fontHeading, setFontHeading] = useState(ss?.font_heading || DEFAULT_STYLE_SPEC.font_heading);
  const [fontBody, setFontBody] = useState(ss?.font_body || DEFAULT_STYLE_SPEC.font_body);
  const [borderRadius, setBorderRadius] = useState(ss?.border_radius || DEFAULT_STYLE_SPEC.border_radius);
  const [spacingUnit, setSpacingUnit] = useState(ss?.spacing_unit || DEFAULT_STYLE_SPEC.spacing_unit);
  const [logoUrl, setLogoUrl] = useState(project?.logo_url || "");
  const [iconUrl, setIconUrl] = useState(project?.icon_url || "");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(!!ss);

  const handleSetupBrand = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(project.id, {
        style_spec: DEFAULT_STYLE_SPEC,
      });
      setInitialized(true);
      refresh();
    } catch (err) {
      console.error("Failed to set up brand:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(project.id, {
        logo_url: logoUrl,
        icon_url: iconUrl,
        style_spec: {
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          background_color: bgColor,
          text_color: textColor,
          font_heading: fontHeading,
          font_body: fontBody,
          border_radius: borderRadius,
          spacing_unit: spacingUnit,
        },
      });
      refresh();
    } catch (err) {
      console.error("Failed to save brand:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (path) => {
    setLogoUrl(path);
    try {
      await projectsApi.updateProject(project.id, { logo_url: path });
      refresh();
    } catch (err) {
      console.error("Failed to save logo:", err);
    }
  };

  const handleIconUpload = async (path) => {
    setIconUrl(path);
    try {
      await projectsApi.updateProject(project.id, { icon_url: path });
      refresh();
    } catch (err) {
      console.error("Failed to save icon:", err);
    }
  };

  if (!ss && !initialized) {
    return (
      <div className="max-w-2xl">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Palette className="text-slate-600 mx-auto mb-4" size={48} />
          <h3 className="text-white font-semibold mb-2">No Brand Identity Yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Set up a brand identity to define colors, typography, and visual
            guidelines for your generated pages.
          </p>
          <button
            onClick={handleSetupBrand}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? "Setting up..." : "Set Up Brand Identity"}
          </button>
        </div>
      </div>
    );
  }

  const colorFields = [
    { label: "Primary", value: primaryColor, set: setPrimaryColor },
    { label: "Secondary", value: secondaryColor, set: setSecondaryColor },
    { label: "Accent", value: accentColor, set: setAccentColor },
    { label: "Background", value: bgColor, set: setBgColor },
    { label: "Text", value: textColor, set: setTextColor },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Logo & Icon */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Logo & Icon</h3>
        <div className="grid grid-cols-2 gap-6">
          <FileUpload
            label="Project Logo"
            currentUrl={logoUrl}
            onUpload={handleLogoUpload}
            projectId={project.id}
          />
          <FileUpload
            label="Favicon / Icon"
            currentUrl={iconUrl}
            onUpload={handleIconUpload}
            projectId={project.id}
          />
        </div>
      </div>

      {/* Colors */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Color Palette</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {colorFields.map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs text-slate-500 mb-1.5">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent shrink-0"
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

      {/* Typography */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Typography</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Heading Font
            </label>
            <input
              type="text"
              value={fontHeading}
              onChange={(e) => setFontHeading(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Body Font
            </label>
            <input
              type="text"
              value={fontBody}
              onChange={(e) => setFontBody(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Spacing & Radius */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Spacing & Radius</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Border Radius
            </label>
            <input
              type="text"
              value={borderRadius}
              onChange={(e) => setBorderRadius(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Spacing Unit
            </label>
            <input
              type="text"
              value={spacingUnit}
              onChange={(e) => setSpacingUnit(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-slate-950 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Brand Identity"}
        </button>
      </div>
    </div>
  );
}

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, loading, refresh } = useProject(projectId);

  const activeTab = searchParams.get("tab") || "general";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Breadcrumb header */}
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
          <h1 className="text-2xl font-bold text-white mb-6">
            Project Settings
          </h1>

          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-slate-800 mb-8">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSearchParams({ tab: key })}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === key
                    ? "border-brand-500 text-brand-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "general" && project && (
            <GeneralTab project={project} refresh={refresh} />
          )}
          {activeTab === "brand" && project && (
            <BrandTab project={project} refresh={refresh} />
          )}
        </div>
      </div>
    </div>
  );
}
