import { useEffect, useState, useCallback } from "react";
import { Brain, Plus, Trash } from "@phosphor-icons/react";
import { fetchJSON } from "../../api/client";

const KINDS = ["preference", "constraint", "brand", "other"];

const KIND_STYLES = {
  preference: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  constraint: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  brand: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  other: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

export default function MemoryPanel({ projectId }) {
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("preference");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJSON(`/api/projects/${projectId}/memories`);
      setFacts(data || []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { if (projectId) load(); }, [projectId, load]);

  const add = async () => {
    if (!body.trim()) return;
    await fetchJSON(`/api/projects/${projectId}/memories`, {
      method: "POST",
      body: JSON.stringify({ body: body.trim(), kind, confidence: 0.9 }),
    });
    setBody("");
    setKind("preference");
    setAdding(false);
    await load();
  };

  const remove = async (id) => {
    await fetchJSON(`/api/projects/${projectId}/memories/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="text-brand-400" size={18} />
          <h3 className="text-white font-bold">Project memory</h3>
        </div>
        <button
          onClick={() => setAdding((s) => !s)}
          className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
        >
          <Plus size={12} /> Add fact
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Durable facts the agents will see on the next run. Auto-extracted from briefs + steers.
      </p>

      {adding && (
        <div className="mb-4 p-3 rounded-md border border-slate-800 bg-slate-950 space-y-2">
          <div className="flex gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-2 py-0.5 rounded text-[10px] border transition ${
                  kind === k
                    ? KIND_STYLES[k]
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="You prefer serif headers."
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setAdding(false); setBody(""); }}
              className="text-xs text-slate-500 px-2"
            >Cancel</button>
            <button
              type="button"
              onClick={add}
              className="bg-brand-500 hover:bg-brand-600 text-white text-xs px-3 py-1 rounded"
            >Save</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : facts.length === 0 ? (
        <p className="text-xs text-slate-500">No memory yet. Generate a page to populate.</p>
      ) : (
        <ul className="space-y-1.5">
          {facts.map((f) => (
            <li
              key={f.id}
              className="group flex items-start gap-2 p-2 rounded border border-slate-800 hover:border-slate-700"
            >
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] border ${KIND_STYLES[f.kind] || KIND_STYLES.other}`}
              >
                {f.kind}
              </span>
              <span className="flex-1 text-xs text-slate-300">{f.body}</span>
              <span className="text-[10px] font-mono text-slate-600 mt-0.5">
                {Math.round((f.confidence || 0) * 100)}%
              </span>
              <button
                onClick={() => remove(f.id)}
                className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                title="Delete"
              >
                <Trash size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
