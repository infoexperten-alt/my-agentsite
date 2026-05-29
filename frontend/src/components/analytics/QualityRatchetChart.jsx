import { useEffect, useState } from "react";
import { fetchJSON } from "../../api/client";

const DIM_LABELS = {
  visual_fidelity: "Visual",
  accessibility: "A11y",
  content_quality: "Content",
  code_health: "Code",
};

const DIM_COLORS = {
  visual_fidelity: "bg-pink-500",
  accessibility: "bg-blue-500",
  content_quality: "bg-amber-500",
  code_health: "bg-emerald-500",
};

export default function QualityRatchetChart({ loading = false }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    fetchJSON("/api/projects")
      .then(async (projects) => {
        // Fetch quality for up to the 8 most-recently-updated projects with
        // any ratchet history; skip empty ones.
        const candidates = (projects || []).slice(0, 12);
        const results = await Promise.all(
          candidates.map(async (p) => {
            try {
              const q = await fetchJSON(`/api/projects/${p.id}/quality`);
              const hasFloors = Object.values(q?.floors || {}).some((v) => v > 0);
              if (!hasFloors && (!q?.history || q.history.length === 0)) return null;
              return { project: p, ratchet: q };
            } catch {
              return null;
            }
          })
        );
        if (!cancelled) {
          setItems(results.filter(Boolean).slice(0, 5));
          setBusy(false);
        }
      })
      .catch(() => {
        if (!cancelled) setBusy(false);
      });
    return () => { cancelled = true; };
  }, []);

  const isLoading = loading || busy;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">Quality Ratchet</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">per project</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center text-slate-500 text-sm">
          <p>No critique runs yet.</p>
          <p className="text-xs mt-1">
            Enable <code className="font-mono text-slate-400">use_critique_panel</code> to populate.
          </p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 overflow-y-auto">
          {items.map(({ project, ratchet }) => {
            const accepted = (ratchet.history || []).filter((h) => h.accepted).length;
            const total = (ratchet.history || []).length;
            return (
              <div key={project.id} className="border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-white font-medium truncate" title={project.name}>
                    {project.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {accepted}/{total} accepted
                  </span>
                </div>
                <div className="space-y-1">
                  {Object.entries(ratchet.floors || {}).map(([dim, floor]) => (
                    <div key={dim}>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-slate-400">{DIM_LABELS[dim] || dim}</span>
                        <span className="text-slate-500 font-mono">{floor}/10</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`${DIM_COLORS[dim] || "bg-slate-500"} h-full rounded-full`}
                          style={{ width: `${Math.max(floor * 10, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
