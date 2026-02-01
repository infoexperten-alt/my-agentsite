import { useNavigate, useParams } from "react-router-dom";
import { DotsThreeVertical, Robot, Spinner as SpinnerIcon } from "@phosphor-icons/react";
import Badge from "../shared/Badge";

function PagePreview() {
  return (
    <div className="absolute inset-0 bg-slate-950 p-3 overflow-hidden">
      <div className="flex justify-between items-center mb-3 opacity-50">
        <div className="w-4 h-4 rounded-full bg-slate-700" />
        <div className="flex gap-1">
          <div className="w-8 h-1 bg-slate-700 rounded" />
          <div className="w-8 h-1 bg-slate-700 rounded" />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center mt-4 space-y-2">
        <div className="w-3/4 h-2 bg-slate-700 rounded-full" />
        <div className="w-1/2 h-2 bg-slate-800 rounded-full" />
        <div className="mt-2 w-16 h-4 bg-brand-500/20 rounded border border-brand-500/30" />
      </div>
    </div>
  );
}

export default function PageCard({ page, status = "draft", onDelete }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const isGenerating = status === "generating";

  if (isGenerating) {
    return (
      <div className="group bg-slate-900 border border-brand-500/40 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.1)] flex flex-col relative">
        <div className="absolute inset-0 bg-brand-500/5 animate-pulse z-0 pointer-events-none" />
        <div className="h-40 bg-slate-950 relative flex flex-col items-center justify-center border-b border-slate-800 z-10">
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mb-3 shadow-lg">
            <Robot className="text-brand-400 text-xl animate-bounce" size={24} />
          </div>
          <p className="text-xs text-brand-300 font-medium animate-pulse">
            Designing layout...
          </p>
        </div>
        <div className="p-4 bg-slate-900 z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-medium">{page.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                <p className="text-xs text-brand-400">Agent Active</p>
              </div>
            </div>
            <SpinnerIcon className="animate-spin text-slate-500" size={16} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all hover:shadow-lg flex flex-col cursor-pointer"
      onClick={() => navigate(`/project/${projectId}/page/${page.slug}`)}
    >
      <div className="h-40 bg-slate-800 relative group-hover:opacity-90 transition-opacity border-b border-slate-800">
        <PagePreview />
        <div className="absolute top-2 right-2">
          <Badge status={status}>{status === "live" ? "Published" : "Draft"}</Badge>
        </div>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">
          <span className="bg-white text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
            Open Builder
          </span>
        </div>
      </div>
      <div className="p-4 bg-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              {page.title}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-1">/{page.slug}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(page.slug);
            }}
            className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800"
          >
            <DotsThreeVertical weight="bold" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
