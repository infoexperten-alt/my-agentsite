import { NavLink } from "react-router-dom";
import { SquaresFour, Users, ChartLineUp, Key, Gear, Sparkle, Brain, GithubLogo, Robot, ArrowUpRight } from "@phosphor-icons/react";

const navItems = [
  { to: "/", icon: SquaresFour, label: "Projects" },
  { to: "/agents", icon: Users, label: "Team Agents" },
  { to: "/analytics", icon: ChartLineUp, label: "Analytics & Usage" },
];

const settingsItems = [
  { to: "/settings/api-keys", icon: Key, label: "API Keys" },
  { to: "/settings/models", icon: Brain, label: "Models" },
  { to: "/settings", icon: Gear, label: "General" },
];

export default function AppSidebar() {
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
          {settingsItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/settings"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-brand-500/10 text-brand-500 border border-brand-500/10"
                    : "hover:bg-slate-900 hover:text-white"
                }`
              }
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800/50 space-y-3">
        <a
          href="https://github.com/jhd3197/CachiBot"
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 rounded-lg bg-gradient-to-br from-brand-500/10 to-purple-600/10 border border-brand-500/15 hover:border-brand-500/30 transition-all group"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Robot size={16} weight="fill" className="text-brand-400" />
            <span className="text-xs font-semibold text-brand-400">CachiBot</span>
            <ArrowUpRight size={12} className="text-brand-400/50 ml-auto group-hover:text-brand-400 transition-colors" />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Enjoying AgentSite? You'll love CachiBot — AI-powered multi-agent orchestration taken further.
          </p>
        </a>
        <a
          href="https://github.com/jhd3197/AgentSite"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition-colors text-sm"
        >
          <GithubLogo size={18} />
          <span className="font-medium">Star on GitHub</span>
        </a>
      </div>
    </aside>
  );
}
