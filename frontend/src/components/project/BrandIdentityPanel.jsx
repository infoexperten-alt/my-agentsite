import { Brain, UploadSimple } from "@phosphor-icons/react";

function PaletteEditor({ styleSpec }) {
  if (!styleSpec) return null;
  const colors = [
    { hex: styleSpec.primary_color, label: "Primary" },
    { hex: styleSpec.secondary_color, label: "Secondary" },
    { hex: styleSpec.accent_color, label: "Accent" },
    { hex: styleSpec.background_color, label: "Background" },
  ];

  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
        Palette
      </label>
      <div className="grid grid-cols-4 gap-2">
        {colors.map((c) => (
          <div key={c.label} className="group cursor-pointer">
            <div
              className="h-10 w-full rounded-md shadow-sm ring-1 ring-white/10 mb-1"
              style={{ backgroundColor: c.hex }}
            />
            <p className="text-[10px] text-center text-slate-400 font-mono">
              {c.hex}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypographyDisplay({ styleSpec }) {
  if (!styleSpec) return null;
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
        Typography
      </label>
      <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 space-y-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">Headings</p>
          <p className="text-xl text-white font-display">
            {styleSpec.font_heading}
          </p>
        </div>
        <div className="w-full h-px bg-slate-800" />
        <div>
          <p className="text-xs text-slate-500 mb-1">Body</p>
          <p className="text-sm text-slate-300">{styleSpec.font_body}</p>
        </div>
      </div>
    </div>
  );
}

export default function BrandIdentityPanel({ project, onEditBrand }) {
  const styleSpec = project?.style_spec;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Brand Identity</h2>
        <button
          onClick={onEditBrand}
          className="text-xs text-brand-400 hover:text-brand-300 font-medium"
        >
          Edit Brand
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 shadow-xl relative overflow-hidden">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">
            Project Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-black border border-slate-700 flex items-center justify-center relative group cursor-pointer overflow-hidden">
              {project?.logo_url ? (
                <img
                  src={`/preview/${project.id}/assets/${project.logo_url}`}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-2xl text-white">
                  {project?.name?.[0]?.toUpperCase() || "?"}
                </span>
              )}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UploadSimple className="text-white" size={20} />
              </div>
            </div>
            <div>
              <p className="text-sm text-white font-medium">
                {project?.name || "Untitled"}
              </p>
              <p className="text-xs text-slate-500">Upload a logo</p>
            </div>
          </div>
        </div>

        {styleSpec ? (
          <>
            <PaletteEditor styleSpec={styleSpec} />
            <TypographyDisplay styleSpec={styleSpec} />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Generate a page to create a brand identity.
          </p>
        )}
      </div>

      {styleSpec && (
        <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="text-brand-400" size={20} />
            <h3 className="text-white font-medium text-sm">Context</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Border radius:{" "}
            <span className="text-slate-200">{styleSpec.border_radius}</span>,
            Spacing:{" "}
            <span className="text-slate-200">{styleSpec.spacing_unit}</span>
          </p>
        </div>
      )}
    </div>
  );
}
