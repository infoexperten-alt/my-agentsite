import { NavLink } from "react-router-dom";
import { SquaresFour, Users, ChartLineUp, Key, Gear, Sparkle } from "@phosphor-icons/react";
import { useApp } from "../../context/AppContext";

const navItems = [
  { to: "/", icon: SquaresFour, label: "Projects" },
  { to: "/agents", icon: Users, label: "Team Agents" },
  { to: "/analytics", icon: ChartLineUp, label: "Analytics & Usage" },
];

export default function AppSidebar() {
  const { setSettingsOpen } = useApp();

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
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">
            Workspace
          </p>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-brand-500/10 text-brand-500 border border-brand-500/10"
                    : "hover:bg-slate-900 hover:text-white"
                }`
              }
            >
              <Icon className="text-lg" size={20} />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}

          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">
            Settings
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors w-full text-left"
          >
            <Key size={20} />
            <span className="font-medium">API Keys</span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors w-full text-left"
          >
            <Gear size={20} />
            <span className="font-medium">General</span>
          </button>
        </nav>
      </div>
    </aside>
  );
}
