import { useEffect, useState } from "react";
import { fetchJSON } from "../../api/client";

export default function DiscoveryForm({ initialPrompt = "", onSubmit, onSkip }) {
  const [schema, setSchema] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJSON("/api/discovery/form")
      .then((s) => {
        if (!cancelled) {
          setSchema(s);
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

  const setValue = (id, value) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const toggleCheckbox = (id, value, max) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[id]) ? prev[id] : [];
      if (cur.includes(value)) {
        return { ...prev, [id]: cur.filter((v) => v !== value) };
      }
      if (max && cur.length >= max) return prev;
      return { ...prev, [id]: [...cur, value] };
    });
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    onSubmit?.(answers);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        Loading discovery form…
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
        Discovery form unavailable. <button className="underline" onClick={onSkip}>Skip & build</button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4 text-sm"
    >
      <div>
        <h4 className="text-white font-medium">{schema.title || "Quick brief"}</h4>
        {schema.description && (
          <p className="text-slate-400 text-xs mt-1">{schema.description}</p>
        )}
        {initialPrompt && (
          <p className="text-slate-500 italic text-xs mt-2">Your brief: "{initialPrompt}"</p>
        )}
      </div>

      {(schema.questions || []).map((q) => (
        <div key={q.id} className="space-y-1.5">
          <label className="block text-slate-300 text-xs font-medium">
            {q.label}
            {q.required && <span className="text-red-400 ml-1">*</span>}
          </label>

          {q.type === "radio" && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const value = typeof opt === "string" ? opt : opt.value;
                const label = typeof opt === "string" ? opt : opt.label;
                const selected = answers[q.id] === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setValue(q.id, value)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition ${
                      selected
                        ? "bg-brand-500/20 border-brand-500 text-white"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "checkbox" && (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((opt) => {
                const value = typeof opt === "string" ? opt : opt.value;
                const label = typeof opt === "string" ? opt : opt.label;
                const cur = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                const selected = cur.includes(value);
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => toggleCheckbox(q.id, value, q.maxSelections)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition ${
                      selected
                        ? "bg-brand-500/20 border-brand-500 text-white"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "text" && (
            <input
              type="text"
              value={answers[q.id] || ""}
              onChange={(e) => setValue(q.id, e.target.value)}
              placeholder={q.placeholder || ""}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />
          )}

          {q.type === "textarea" && (
            <textarea
              value={answers[q.id] || ""}
              onChange={(e) => setValue(q.id, e.target.value)}
              placeholder={q.placeholder || ""}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-md transition"
        >
          Build with these answers
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-slate-500 hover:text-slate-300 px-2"
        >
          Skip
        </button>
      </div>
    </form>
  );
}
