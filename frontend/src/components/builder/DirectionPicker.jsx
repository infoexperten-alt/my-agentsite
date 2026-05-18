import { useEffect, useState } from "react";
import { fetchJSON } from "../../api/client";

export default function DirectionPicker({ onPick, onSkip }) {
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJSON("/api/directions")
      .then((d) => {
        if (!cancelled) {
          setDirections(d || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        Loading direction library…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 text-sm">
      <div>
        <h4 className="text-white font-medium">Pick a direction</h4>
        <p className="text-slate-400 text-xs mt-1">
          Each one ships with a real palette, font stack, and posture. You can override later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {directions.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onPick?.(d.id)}
            className="text-left rounded-lg border border-slate-700 hover:border-brand-500 bg-slate-950/60 p-3 transition group"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-white text-xs font-medium">{d.label}</span>
              <span className="text-[10px] text-slate-500 font-mono">{d.id}</span>
            </div>
            <div className="flex gap-1 mb-2">
              {["bg", "surface", "border", "muted", "fg", "accent"].map((k) => (
                <div
                  key={k}
                  title={`${k}: ${d.palette[k]}`}
                  className="w-6 h-6 rounded border border-slate-700"
                  style={{ background: d.palette[k] }}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{d.mood}</p>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-slate-500 hover:text-slate-300 px-2"
        >
          Let the designer decide
        </button>
      </div>
    </div>
  );
}
