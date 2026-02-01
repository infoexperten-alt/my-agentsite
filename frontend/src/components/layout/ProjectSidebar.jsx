import { NavLink, useParams } from "react-router-dom";
import { ArrowLeft, Kanban, PaintBrush, Gear, Sparkle } from "@phosphor-icons/react";

export default function ProjectSidebar() {
  const { projectId } = useParams();

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0">
      <div>
        <div className="h-16 flex items-center px-6 border-b border-slate-800/50">
          <div className="flex items-center gap-2 text-white font-bold tracking-tight text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Sparkle className="text-white" weight="fill" />
            </div>
            AgentSite
          </div>
        </div>
        <nav className="p-4 space-y-1">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </NavLink>
          <div className="my-4 border-t border-slate-800" />
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Project Menu
          </p>
          <NavLink
            to={`/project/${projectId}`}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-brand-500/10 text-brand-500 border border-brand-500/10"
                  : "hover:bg-slate-900 hover:text-white"
              }`
            }
          >
            <Kanban size={20} />
            <span className="font-medium">Overview & Pages</span>
          </NavLink>
          <NavLink
            to={`/project/${projectId}/settings?tab=brand`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-brand-500/10 text-brand-500 border border-brand-500/10"
                  : "hover:bg-slate-900 hover:text-white"
              }`
            }
          >
            <PaintBrush size={20} />
            <span className="font-medium">Global Styles</span>
          </NavLink>
          <NavLink
            to={`/project/${projectId}/settings?tab=general`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-brand-500/10 text-brand-500 border border-brand-500/10"
                  : "hover:bg-slate-900 hover:text-white"
              }`
            }
          >
            <Gear size={20} />
            <span className="font-medium">Settings</span>
          </NavLink>
        </nav>
      </div>
    </aside>
  );
}
