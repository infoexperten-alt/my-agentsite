import { useState, useEffect } from "react";
import { Copy, Check, File as FileIcon } from "@phosphor-icons/react";
import { listVersionFiles } from "../../api/projects";
import { API_BASE } from "../../api/client";

export default function CodeView({ projectId, slug, version, width }) {
  const [files, setFiles] = useState([]);
  const [contents, setContents] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [copied, setCopied] = useState(false);

  // Fetch file list when version changes
  useEffect(() => {
    if (!projectId || !slug || !version) return;
    let cancelled = false;
    listVersionFiles(projectId, slug, version).then((res) => {
      if (cancelled) return;
      const fileList = res.files || [];
      setFiles(fileList);
      setContents({});
      if (fileList.length > 0) setActiveFile(fileList[0]);
      else setActiveFile(null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, slug, version]);

  // Fetch file content when active file changes
  useEffect(() => {
    if (!activeFile || contents[activeFile]) return;
    const url = `${API_BASE}/preview/${projectId}/${slug}/v/${version}/${activeFile}`;
    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        setContents((prev) => ({ ...prev, [activeFile]: text }));
      })
      .catch(() => {
        setContents((prev) => ({ ...prev, [activeFile]: "// Failed to load file" }));
      });
  }, [activeFile, contents, projectId, slug, version]);

  const handleCopy = () => {
    const text = contents[activeFile] || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentContent = contents[activeFile] || "";

  return (
    <div
      className="relative h-full bg-[#0d1117] rounded-lg shadow-2xl overflow-hidden flex flex-col border border-slate-800 ring-1 ring-white/5 z-10 transition-all duration-500"
      style={{ width: width || "100%", maxWidth: "1200px" }}
    >
      {/* Tab bar */}
      <div className="h-10 bg-[#161b22] border-b border-slate-800 flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
        {files.map((file) => (
          <button
            key={file}
            onClick={() => setActiveFile(file)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors shrink-0 ${
              activeFile === file
                ? "bg-[#0d1117] text-white border border-slate-700"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <FileIcon size={12} />
            {file}
          </button>
        ))}
      </div>

      {/* Source code */}
      <div className="flex-1 overflow-auto relative">
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
        <pre className="p-4 text-sm font-mono text-slate-300 leading-relaxed whitespace-pre overflow-x-auto min-h-full">
          <code>{currentContent || (activeFile ? "Loading..." : "No files available")}</code>
        </pre>
      </div>
    </div>
  );
}
