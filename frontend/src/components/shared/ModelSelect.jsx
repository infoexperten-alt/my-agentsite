import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MagnifyingGlass,
  CaretDown,
  Check,
  PencilSimple,
} from "@phosphor-icons/react";
import { useApp } from "../../context/AppContext";

function formatTokens(n) {
  if (!n) return null;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq",
  grok: "Grok",
  openrouter: "OpenRouter",
  ollama: "Ollama",
  lmstudio: "LM Studio",
};

function providerLabel(key) {
  return PROVIDER_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export default function ModelSelect({
  value,
  onChange,
  placeholder = "System Default",
  className = "",
}) {
  const { models } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const manualRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
        setManualMode(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Update position when opening and on scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  // Focus search when opened
  useEffect(() => {
    if (open && !manualMode && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, manualMode]);

  // Focus manual input when switching to manual mode
  useEffect(() => {
    if (manualMode && manualRef.current) {
      manualRef.current.focus();
    }
  }, [manualMode]);

  const groups = models.groups || {};

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return groups;
    const result = {};
    for (const [provider, items] of Object.entries(groups)) {
      const matches = items.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          provider.toLowerCase().includes(q)
      );
      if (matches.length > 0) result[provider] = matches;
    }
    return result;
  }, [groups, search]);

  const totalCount = Object.values(filtered).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  const selectedModel = value
    ? Object.values(groups)
        .flat()
        .find((m) => m.id === value)
    : null;

  const handleManualSubmit = () => {
    const trimmed = manualValue.trim();
    if (trimmed) {
      onChange(trimmed);
    }
    setOpen(false);
    setManualMode(false);
    setManualValue("");
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch("");
          setManualMode(false);
        }}
        className="w-full bg-slate-950 border border-slate-700 text-sm rounded-lg py-2 px-3 pr-8 focus:border-brand-500 focus:outline-none text-left flex items-center justify-between gap-2"
      >
        <span
          className={
            value
              ? "text-white truncate font-mono text-xs"
              : "text-slate-500"
          }
        >
          {value || placeholder}
        </span>
        <CaretDown
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          size={14}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {manualMode ? (
              /* Manual input mode */
              <div className="p-2">
                <p className="text-[10px] text-slate-500 mb-1.5 px-1">
                  Enter model in provider/model format
                </p>
                <div className="flex gap-1.5">
                  <input
                    ref={manualRef}
                    type="text"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleManualSubmit();
                      if (e.key === "Escape") {
                        setManualMode(false);
                        setManualValue("");
                      }
                    }}
                    placeholder="openrouter/moonshotai/kimi-k2.5"
                    className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs font-mono rounded-md py-1.5 px-2 focus:border-brand-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={!manualValue.trim()}
                    className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
                  >
                    Set
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search input */}
                <div className="p-2 border-b border-slate-800">
                  <div className="relative">
                    <MagnifyingGlass
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                      size={14}
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search models..."
                      className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-md py-1.5 pl-8 pr-3 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Model list */}
                <div className="max-h-64 overflow-y-auto">
                  {/* Clear / default option */}
                  {!search && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange("");
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors flex items-center justify-between ${
                        !value ? "text-brand-400" : "text-slate-400"
                      }`}
                    >
                      <span>{placeholder}</span>
                      {!value && (
                        <Check size={14} className="text-brand-500" />
                      )}
                    </button>
                  )}

                  {Object.entries(filtered)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([provider, items]) => (
                      <div key={provider}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-950/50 sticky top-0">
                          {providerLabel(provider)}
                          <span className="ml-1.5 text-slate-600">
                            {items.length}
                          </span>
                        </div>
                        {items.map((m) => {
                          const isSelected = value === m.id;
                          const ctx = formatTokens(m.context_window);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                onChange(m.id);
                                setOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 ${
                                isSelected
                                  ? "text-brand-400 bg-brand-500/5"
                                  : "text-slate-300"
                              }`}
                            >
                              <span className="truncate font-mono text-xs">
                                {m.id}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                {ctx && (
                                  <span className="text-[10px] text-slate-600">
                                    {ctx}
                                  </span>
                                )}
                                {m.supports_vision && (
                                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">
                                    vision
                                  </span>
                                )}
                                {m.is_reasoning && (
                                  <span className="text-[9px] bg-purple-900/40 text-purple-400 px-1 rounded">
                                    reasoning
                                  </span>
                                )}
                                {isSelected && (
                                  <Check
                                    size={14}
                                    className="text-brand-500"
                                  />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}

                  {totalCount === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-slate-500">
                      {Object.keys(groups).length === 0
                        ? "No models available. Configure API keys first."
                        : "No models match your search."}
                    </div>
                  )}
                </div>

                {/* Manual entry option */}
                <div className="border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setManualValue(value || "");
                      setManualMode(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <PencilSimple size={12} />
                    Enter manually
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
