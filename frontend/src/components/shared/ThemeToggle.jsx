import { Sun, Moon } from "@phosphor-icons/react";
import { useTheme } from "../../context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition-colors text-sm w-full ${className}`}
    >
      {isDark ? <Sun size={18} weight="fill" /> : <Moon size={18} weight="fill" />}
      <span className="font-medium">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
