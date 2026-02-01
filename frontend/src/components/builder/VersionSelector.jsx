import { CaretDown } from "@phosphor-icons/react";

export default function VersionSelector({ versions, active, onChange }) {
  if (!versions.length) return null;

  const current =
    versions.find((v) => v.version_number === active) || versions[0];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 uppercase">
        Version
      </span>
      <div className="relative">
        <select
          value={active || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="appearance-none flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sm text-white hover:border-slate-600 transition-colors pr-8 cursor-pointer"
        >
          {versions.map((v) => (
            <option key={v.version_number} value={v.version_number}>
              v{v.version_number}{" "}
              {v.status === "completed"
                ? "(Complete)"
                : v.status === "generating"
                  ? "(Generating...)"
                  : `(${v.status})`}
            </option>
          ))}
        </select>
        <CaretDown
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          size={14}
        />
      </div>
    </div>
  );
}
