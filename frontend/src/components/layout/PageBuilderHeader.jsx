import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Lightning,
  Eye,
  Code as CodeIcon,
  RocketLaunch,
} from "@phosphor-icons/react";
import DeviceSwitcher from "../builder/DeviceSwitcher";
import Badge from "../shared/Badge";

export default function PageBuilderHeader({
  projectId,
  page,
  device,
  onDeviceChange,
}) {
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-4 shrink-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/project/${projectId}`)}
          className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="h-4 w-px bg-slate-800" />
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">
            {page?.title || "..."}
          </span>
          <span className="text-slate-600 text-xs">/{page?.slug}</span>
        </div>
      </div>

      <DeviceSwitcher active={device} onChange={onDeviceChange} />

      <div className="flex items-center gap-3">
        <div className="flex items-center text-xs text-slate-500 mr-2 gap-4">
          <span className="flex items-center gap-1">
            <Lightning className="text-yellow-500" size={12} /> Preview
          </span>
        </div>
        <button
          className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-900 transition-colors"
          title="Code View"
        >
          <CodeIcon size={18} />
        </button>
        <button className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-colors">
          Publish Updates
          <RocketLaunch size={14} />
        </button>
      </div>
    </header>
  );
}
