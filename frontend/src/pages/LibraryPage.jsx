import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  CaretRight,
  Books,
  UploadSimple,
  Copy,
  Trash,
  Image,
  CheckCircle,
  FileImage,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import { listAssets, uploadAsset, deleteAsset, getAssetUrl } from "../api/assets";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedName, setCopiedName] = useState(null);
  const [deletingName, setDeletingName] = useState(null);
  const fileInputRef = useRef(null);

  const fetchAssets = useCallback(async () => {
    try {
      const data = await listAssets(projectId);
      setAssets(data.assets || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadAsset(projectId, file);
      await fetchAssets();
    } catch {
      // silent
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCopy = async (name) => {
    const url = getAssetUrl(projectId, name);
    await navigator.clipboard.writeText(url);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const handleDelete = async (name) => {
    setDeletingName(name);
    try {
      await deleteAsset(projectId, name);
      setAssets((prev) => prev.filter((a) => a.name !== name));
    } catch {
      // silent
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-slate-400">{project?.name || "..."}</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Library</span>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Library</h1>
              <p className="text-sm text-slate-500 mt-1">
                Browse project images and assets. AI-generated images appear here automatically.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-white text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <UploadSimple size={16} weight="bold" />
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-6 h-6 border-2 border-slate-700 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6">
                  <Image className="text-slate-500" size={32} />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">No assets yet</h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Upload images manually or generate a page — the AI will create images that appear here automatically.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <UploadSimple size={16} weight="bold" />
                  Upload First Image
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div
                  key={asset.name}
                  className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors"
                >
                  <div className="aspect-square bg-slate-950 relative overflow-hidden">
                    <img
                      src={getAssetUrl(projectId, asset.name)}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleCopy(asset.name)}
                        className="p-2 bg-slate-900/90 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Copy URL"
                      >
                        {copiedName === asset.name ? (
                          <CheckCircle className="text-green-400" size={18} weight="fill" />
                        ) : (
                          <Copy className="text-white" size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(asset.name)}
                        disabled={deletingName === asset.name}
                        className="p-2 bg-slate-900/90 rounded-lg hover:bg-red-900/80 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash className="text-white" size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-slate-300 font-medium truncate" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {formatBytes(asset.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
