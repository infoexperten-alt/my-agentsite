import { Minus, Plus, ArrowsOutSimple } from "@phosphor-icons/react";

export default function ZoomControls({ zoom, onZoomChange }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
      <div className="bg-slate-900 border border-slate-800 rounded-full px-4 py-2 flex items-center gap-4 text-xs font-mono shadow-xl text-slate-400">
        <button
          onClick={() => onZoomChange(Math.max(25, zoom - 25))}
          className="hover:text-white"
        >
          <Minus size={12} />
        </button>
        <span>{zoom}%</span>
        <button
          onClick={() => onZoomChange(Math.min(200, zoom + 25))}
          className="hover:text-white"
        >
          <Plus size={12} />
        </button>
      </div>
      <button
        onClick={() => onZoomChange(100)}
        className="bg-slate-900 border border-slate-800 rounded-full w-9 h-9 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shadow-xl"
      >
        <ArrowsOutSimple size={16} />
      </button>
    </div>
  );
}
