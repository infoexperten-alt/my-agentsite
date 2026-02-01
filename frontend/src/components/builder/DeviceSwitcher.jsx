import { Desktop, DeviceTablet, DeviceMobile } from "@phosphor-icons/react";

const DEVICES = [
  { key: "desktop", icon: Desktop, label: "Desktop", width: null },
  { key: "tablet", icon: DeviceTablet, label: "Tablet", width: "768px" },
  { key: "mobile", icon: DeviceMobile, label: "Mobile", width: "375px" },
];

export default function DeviceSwitcher({ active, onChange }) {
  return (
    <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
      {DEVICES.map(({ key, icon: Icon, label, width }) => (
        <button
          key={key}
          onClick={() => onChange(width)}
          title={label}
          className={`p-1.5 rounded transition-colors ${
            active === width
              ? "bg-slate-700 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
