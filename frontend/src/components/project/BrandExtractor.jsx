import { useState } from "react";
import { Link, Image, FilePdf } from "@phosphor-icons/react";
import { fetchJSON } from "../../api/client";

const TABS = [
  { id: "url", label: "From URL", icon: Link },
  { id: "image", label: "From screenshot", icon: Image },
  { id: "pdf", label: "Upload PDF", icon: FilePdf },
];

export default function BrandExtractor({ projectId, onExtracted }) {
  const [tab, setTab] = useState("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [persist, setPersist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let data;
      if (tab === "url") {
        data = await fetchJSON(`/api/projects/${projectId}/brand/extract/url`, {
          method: "POST",
          body: JSON.stringify({ url, persist }),
        });
      } else if (tab === "image" || tab === "pdf") {
        if (!file) throw new Error("Pick a file first.");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("persist", String(persist));
        const resp = await fetch(
          `/api/projects/${projectId}/brand/extract/${tab}`,
          { method: "POST", body: fd }
        );
        if (!resp.ok) throw new Error(await resp.text());
        data = await resp.json();
      }
      setResult(data);
      onExtracted?.(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-bold">Extract brand</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pull tokens from a live site, a screenshot, or a brand-book PDF.
          </p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-800">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(null); setError(null); }}
              className={`flex items-center gap-2 px-3 py-2 text-xs border-b-2 transition ${
                tab === t.id
                  ? "border-brand-500 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {tab === "url" && (
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://stripe.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
          />
        )}
        {(tab === "image" || tab === "pdf") && (
          <input
            type="file"
            accept={tab === "image" ? "image/*" : "application/pdf"}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
          />
        )}

        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={persist}
            onChange={(e) => setPersist(e.target.checked)}
          />
          Save the result as this project's brand
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={run}
            disabled={busy || (tab === "url" ? !url : !file)}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-medium px-4 py-1.5 rounded-md transition"
          >
            {busy ? "Extracting…" : "Extract"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}
        {result?.style_spec && (
          <div className="mt-3 p-3 rounded-md border border-slate-800 bg-slate-950">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
              Result preview
            </p>
            <div className="flex gap-1.5">
              {["background_color", "surface_color", "text_color", "primary_color", "accent_color"].map((k) => (
                <div
                  key={k}
                  className="w-6 h-6 rounded border border-slate-700"
                  style={{ background: result.style_spec[k] }}
                  title={`${k}: ${result.style_spec[k]}`}
                />
              ))}
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-2">
              fonts: {result.style_spec.font_body} / {result.style_spec.font_heading}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
