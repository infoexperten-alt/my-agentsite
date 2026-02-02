import { useParams } from "react-router-dom";
import { CaretRight, List, Sparkle } from "@phosphor-icons/react";
import useProject from "../hooks/useProject";

export default function ProjectNavigationPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-slate-400">{project?.name || "..."}</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Navigation</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 min-h-[calc(100vh-12rem)]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-6">
            <List className="text-slate-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Navigation</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Visually manage your site menu — reorder pages, add external links,
            create dropdowns, and configure header and footer navigation.
          </p>
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 px-4 py-2 rounded-full text-sm font-medium">
            <Sparkle size={14} weight="fill" />
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
