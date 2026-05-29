import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { fetchJSON } from "../../api/client";

export default function TemplateGallery({ onPick }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJSON("/api/prompt-templates")
      .then((data) => {
        if (!cancelled) {
          setTemplates(data || []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-slate-500">Loading templates…</div>
    );
  }

  if (!templates.length) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkle className="text-brand-400" size={16} weight="fill" />
        <h3 className="text-sm font-semibold text-white">Start from a template</h3>
        <span className="text-xs text-slate-500">{templates.length} ready-to-go briefs</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick?.(t)}
            className="text-left rounded-xl border border-slate-800 hover:border-brand-500 bg-slate-900/50 p-4 transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-white font-medium">{t.name}</span>
              {t.direction_id && (
                <span className="text-[10px] font-mono text-slate-500">{t.direction_id}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{t.prompt}</p>
            {t.skill_id && (
              <span className="inline-block mt-2 text-[10px] font-mono text-brand-400/80">
                skill: {t.skill_id}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
