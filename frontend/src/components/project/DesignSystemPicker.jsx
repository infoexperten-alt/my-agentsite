import { useEffect, useState } from "react";
import { Palette } from "@phosphor-icons/react";
import { fetchJSON } from "../../api/client";

export default function DesignSystemPicker({ projectId, currentId, onPick }) {
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJSON("/api/design-systems")
      .then((data) => {
        if (!cancelled) {
          setSystems(data || []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const pick = async (id) => {
    if (!projectId || busy) return;
    setBusy(true);
    try {
      const project = await fetchJSON(`/api/projects/${projectId}`);
      const ss = project.style_spec || {};
      ss.inherits_from = id;
      await fetchJSON(`/api/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify({ style_spec: ss }),
      });
      onPick?.(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="text-brand-400" size={18} />
          <h3 className="text-white font-bold">Inherit a design system</h3>
        </div>
        {currentId && (
          <span className="text-[10px] font-mono text-brand-300 px-2 py-0.5 rounded border border-brand-500/30">
            current: {currentId}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        The Designer extends these tokens instead of inventing fresh ones. Affects the next generation only.
      </p>

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {systems.map((s) => {
            const active = s.id === currentId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                disabled={busy}
                className={`text-left rounded-lg border p-3 transition ${
                  active
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-slate-700 hover:border-slate-600 bg-slate-950/40"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-white font-medium truncate">{s.name}</span>
                  {s.source === "user" && (
                    <span className="text-[9px] font-mono text-amber-400">USER</span>
                  )}
                </div>
                <div className="flex gap-0.5">
                  {(s.palette_preview || []).slice(0, 6).map((c, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-sm border border-slate-700"
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
