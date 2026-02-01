import { MagnifyingGlass, Bell, Plus } from "@phosphor-icons/react";
import { useApp } from "../../context/AppContext";
import { useNavigate, useMatch } from "react-router-dom";
import SettingsModal from "../shared/SettingsModal";

export default function TopHeader() {
  const { search, setSearch, settingsOpen, setSettingsOpen } = useApp();
  const navigate = useNavigate();
  const isDashboard = useMatch("/");

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="relative w-96 group">
          <MagnifyingGlass
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-500 transition-colors"
            size={16}
          />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg py-1.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all placeholder:text-slate-600"
          />
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950" />
          </button>
          {isDashboard && (
            <button
              onClick={() => navigate("/?new=1")}
              className="bg-white text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/5"
            >
              <Plus weight="bold" size={14} />
              New Project
            </button>
          )}
        </div>
      </header>
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
