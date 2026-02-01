export default function PreviewFrame({ src, width }) {
  return (
    <div
      className="relative h-full bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col border border-slate-800 ring-1 ring-white/5 z-10 transition-all duration-500"
      style={{ width: width || "100%", maxWidth: "1200px" }}
    >
      {/* Browser chrome */}
      <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-2 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-white border border-slate-200 rounded px-3 py-0.5 text-[10px] text-slate-400 font-mono w-64 text-center truncate">
            {src || "about:blank"}
          </div>
        </div>
      </div>

      {/* iframe */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {src ? (
          <iframe
            key={src}
            src={src}
            className="w-full h-full border-none"
            title="Page Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No preview available yet
          </div>
        )}
      </div>
    </div>
  );
}
