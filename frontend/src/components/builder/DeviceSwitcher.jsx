import {
  Desktop,
  DeviceTablet,
  DeviceMobile,
  DeviceMobileCamera,
  AppleLogo,
  AndroidLogo,
  Laptop,
} from "@phosphor-icons/react";

const DEVICES = [
  { key: "desktop", icon: Desktop, label: "Desktop", width: null, frame: null },
  { key: "tablet", icon: DeviceTablet, label: "Tablet", width: "768px", frame: null },
  { key: "mobile", icon: DeviceMobile, label: "Mobile", width: "375px", frame: null },
];

const FRAMES = [
  { key: "iphone", icon: AppleLogo, label: "iPhone 15 Pro", width: "390px", frame: "iphone" },
  { key: "android", icon: AndroidLogo, label: "Pixel", width: "412px", frame: "android" },
  { key: "ipad", icon: DeviceMobileCamera, label: "iPad Pro", width: "834px", frame: "ipad" },
  { key: "macbook", icon: Laptop, label: "MacBook", width: "1440px", frame: "macbook" },
];

export default function DeviceSwitcher({ active, onChange }) {
  // onChange is called with (width, frameKey). Old callers ignoring the
  // second arg keep working unchanged.
  return (
    <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
      {DEVICES.map(({ key, icon: Icon, label, width, frame }) => (
        <button
          key={key}
          onClick={() => onChange(width, frame)}
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
      <div className="w-px h-4 bg-slate-700 mx-0.5" />
      {FRAMES.map(({ key, icon: Icon, label, width, frame }) => (
        <button
          key={key}
          onClick={() => onChange(width, frame)}
          title={`${label} (frame)`}
          className={`p-1.5 rounded transition-colors ${
            active === width
              ? "bg-slate-700 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <Icon size={16} weight="fill" />
        </button>
      ))}
    </div>
  );
}
