import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  CaretRight,
  Rocket,
  Globe,
  Plus,
  Check,
  CircleNotch,
  Trash,
  ArrowSquareOut,
  GithubLogo,
  Lightning,
  ShieldCheck,
  Eye,
  EyeSlash,
  Copy,
  Clock,
  GitBranch,
  Lock,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import Spinner from "../components/shared/Spinner";

const PROVIDERS = [
  {
    id: "vercel",
    name: "Vercel",
    desc: "Edge network, instant rollbacks",
    color: "from-white to-slate-200 text-slate-900",
    accent: "border-white/20",
  },
  {
    id: "netlify",
    name: "Netlify",
    desc: "Atomic deploys, deploy previews",
    color: "from-teal-400 to-cyan-500 text-slate-950",
    accent: "border-teal-400/30",
  },
  {
    id: "cloudflare",
    name: "Cloudflare Pages",
    desc: "Free unlimited bandwidth",
    color: "from-orange-400 to-amber-500 text-slate-950",
    accent: "border-orange-400/30",
  },
  {
    id: "github",
    name: "GitHub Pages",
    desc: "Static hosting on your repo",
    color: "from-slate-700 to-slate-900 text-white",
    accent: "border-slate-500/30",
  },
];

const ENVS = [
  { id: "production", label: "Production", icon: Lightning },
  { id: "staging", label: "Staging", icon: ShieldCheck },
  { id: "preview", label: "Preview", icon: Eye },
];

const DEPLOY_STAGES = [
  { id: "queue", label: "Queued", duration: 400 },
  { id: "build", label: "Building", duration: 2400 },
  { id: "upload", label: "Uploading assets", duration: 1600 },
  { id: "deploy", label: "Deploying to edge", duration: 1400 },
  { id: "live", label: "Live", duration: 0 },
];

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function fmtRelative(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusDot({ status }) {
  const tones = {
    ready: "bg-emerald-400 shadow-emerald-400/50",
    building: "bg-amber-400 shadow-amber-400/50 animate-pulse",
    failed: "bg-rose-400 shadow-rose-400/50",
    queued: "bg-slate-500 shadow-slate-500/50",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shadow-[0_0_8px] ${
        tones[status] || tones.queued
      }`}
    />
  );
}

function StatusPill({ status }) {
  const cfg = {
    ready: { label: "Live", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    building: { label: "Building", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
    queued: { label: "Queued", cls: "bg-slate-700/40 text-slate-400 border-slate-600/30" },
  };
  const c = cfg[status] || cfg.queued;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${c.cls}`}
    >
      <StatusDot status={status} />
      {c.label}
    </span>
  );
}

function ProviderCard({ provider, connected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(provider.id)}
      className={`group relative p-4 rounded-xl border text-left transition-all ${
        connected
          ? "border-brand-500/40 bg-brand-500/5"
          : "border-slate-800 bg-slate-900 hover:border-slate-700"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center font-bold text-sm mb-3 border ${provider.accent}`}
      >
        {provider.name[0]}
      </div>
      <p className="text-sm font-semibold text-white">{provider.name}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{provider.desc}</p>
      {connected && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
          <Check size={12} weight="bold" className="text-white" />
        </span>
      )}
    </button>
  );
}

function DomainRow({ domain, onRemove, onVerify }) {
  const [busy, setBusy] = useState(false);
  const handleVerify = async () => {
    setBusy(true);
    setTimeout(() => {
      onVerify(domain.host);
      setBusy(false);
    }, 1200);
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0">
      <Globe size={16} className="text-slate-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-mono text-white truncate">{domain.host}</p>
          {domain.primary && (
            <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/15 px-1.5 py-0.5 rounded">
              PRIMARY
            </span>
          )}
        </div>
        {!domain.verified && (
          <p className="text-[11px] text-amber-400 mt-0.5">
            Add CNAME → cname.agentsite.app
          </p>
        )}
      </div>
      {domain.verified ? (
        <StatusPill status="ready" />
      ) : (
        <button
          onClick={handleVerify}
          disabled={busy}
          className="text-xs font-medium text-brand-400 hover:text-brand-300 disabled:opacity-50"
        >
          {busy ? "Verifying..." : "Verify"}
        </button>
      )}
      <button
        onClick={() => onRemove(domain.host)}
        className="text-slate-600 hover:text-rose-400 transition-colors p-1"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

function EnvVarRow({ env, onUpdate, onRemove }) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center py-2 border-b border-slate-800/60 last:border-0">
      <input
        value={env.key}
        onChange={(e) => onUpdate({ ...env, key: e.target.value.toUpperCase() })}
        placeholder="VAR_NAME"
        className="bg-slate-950 border border-slate-800 text-white text-sm font-mono rounded-md py-1.5 px-2.5 focus:border-brand-500 focus:outline-none"
      />
      <input
        type={show ? "text" : "password"}
        value={env.value}
        onChange={(e) => onUpdate({ ...env, value: e.target.value })}
        placeholder="value"
        className="bg-slate-950 border border-slate-800 text-white text-sm font-mono rounded-md py-1.5 px-2.5 focus:border-brand-500 focus:outline-none"
      />
      <button
        onClick={() => setShow(!show)}
        className="p-1.5 text-slate-500 hover:text-white"
      >
        {show ? <EyeSlash size={14} /> : <Eye size={14} />}
      </button>
      <button
        onClick={() => onRemove(env.key)}
        className="p-1.5 text-slate-600 hover:text-rose-400"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

function DeployStageList({ active, stages }) {
  return (
    <div className="space-y-2">
      {DEPLOY_STAGES.slice(0, -1).map((stage, i) => {
        const idx = DEPLOY_STAGES.findIndex((s) => s.id === active);
        const status = i < idx ? "done" : i === idx ? "running" : "pending";
        return (
          <div key={stage.id} className="flex items-center gap-3">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                status === "done"
                  ? "bg-emerald-500/20 border border-emerald-500/40"
                  : status === "running"
                  ? "bg-amber-500/20 border border-amber-500/40"
                  : "bg-slate-800 border border-slate-700"
              }`}
            >
              {status === "done" && (
                <Check size={10} weight="bold" className="text-emerald-400" />
              )}
              {status === "running" && (
                <CircleNotch size={10} className="text-amber-400 animate-spin" />
              )}
            </div>
            <span
              className={`text-sm ${
                status === "done"
                  ? "text-slate-400"
                  : status === "running"
                  ? "text-white font-medium"
                  : "text-slate-600"
              }`}
            >
              {stage.label}
            </span>
            {stages[stage.id] && (
              <span className="ml-auto text-[11px] text-slate-600 font-mono">
                {stages[stage.id]}ms
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectDeploymentsPage() {
  const { projectId } = useParams();
  const { project, pages, loading } = useProject(projectId);

  const cfgKey = `agentsite:deploy:cfg:${projectId}`;
  const histKey = `agentsite:deploy:history:${projectId}`;
  const envKey = `agentsite:deploy:env:${projectId}`;
  const domKey = `agentsite:deploy:domains:${projectId}`;

  const [cfg, setCfg] = useState(() =>
    loadLS(cfgKey, {
      provider: null,
      branch: "main",
      auto_deploy: true,
      build_command: "agentsite build",
      output_dir: "dist",
    })
  );
  const [history, setHistory] = useState(() => loadLS(histKey, []));
  const [envVars, setEnvVars] = useState(() => loadLS(envKey, []));
  const [domains, setDomains] = useState(() => loadLS(domKey, []));

  const [newDomain, setNewDomain] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [stage, setStage] = useState(null);
  const [stageTimes, setStageTimes] = useState({});
  const [copied, setCopied] = useState(false);
  const stageRef = useRef(null);

  useEffect(() => saveLS(cfgKey, cfg), [cfg, cfgKey]);
  useEffect(() => saveLS(histKey, history), [history, histKey]);
  useEffect(() => saveLS(envKey, envVars), [envVars, envKey]);
  useEffect(() => saveLS(domKey, domains), [domains, domKey]);

  const primaryDomain =
    domains.find((d) => d.primary && d.verified)?.host ||
    domains.find((d) => d.verified)?.host ||
    `${projectId}.agentsite.app`;

  const lastReady = useMemo(
    () => history.find((h) => h.status === "ready"),
    [history]
  );

  const runDeploy = async (env = "production") => {
    if (deploying) return;
    setDeploying(true);
    setStageTimes({});
    const id = Math.random().toString(36).slice(2, 10);
    const startedAt = new Date().toISOString();
    const baseEntry = {
      id,
      env,
      status: "building",
      branch: cfg.branch,
      provider: cfg.provider || "agentsite",
      domain: primaryDomain,
      started_at: startedAt,
      finished_at: null,
      duration_ms: null,
      commit: `gen-${Math.random().toString(16).slice(2, 8)}`,
      message: `Deploy ${pages.length} page${pages.length === 1 ? "" : "s"} to ${env}`,
    };
    setHistory((h) => [baseEntry, ...h]);

    const t0 = Date.now();
    for (const s of DEPLOY_STAGES.slice(0, -1)) {
      setStage(s.id);
      stageRef.current = s.id;
      const t = Date.now();
      await new Promise((r) => setTimeout(r, s.duration));
      setStageTimes((st) => ({ ...st, [s.id]: Date.now() - t }));
    }

    const duration = Date.now() - t0;
    setStage("live");
    setHistory((h) =>
      h.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "ready",
              finished_at: new Date().toISOString(),
              duration_ms: duration,
            }
          : e
      )
    );
    setTimeout(() => {
      setDeploying(false);
      setStage(null);
    }, 800);
  };

  const addDomain = () => {
    const host = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "");
    if (!host || domains.find((d) => d.host === host)) return;
    setDomains([
      ...domains,
      { host, verified: false, primary: domains.length === 0 },
    ]);
    setNewDomain("");
  };

  const removeDomain = (host) =>
    setDomains(domains.filter((d) => d.host !== host));

  const verifyDomain = (host) =>
    setDomains(domains.map((d) => (d.host === host ? { ...d, verified: true } : d)));

  const setPrimary = (host) =>
    setDomains(domains.map((d) => ({ ...d, primary: d.host === host })));

  const addEnvVar = () =>
    setEnvVars([...envVars, { key: "", value: "" }]);

  const updateEnvVar = (idx, updated) => {
    const next = [...envVars];
    next[idx] = updated;
    setEnvVars(next);
  };

  const removeEnvVar = (key) => setEnvVars(envVars.filter((e) => e.key !== key));

  const copyUrl = () => {
    navigator.clipboard?.writeText(`https://${primaryDomain}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-8 z-20">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Projects</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-slate-400">{project?.name || "..."}</span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Deployments</span>
        </div>
      </div>

      <div className="p-8 pb-16">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950/40 p-8">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start justify-between gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <StatusPill status={lastReady ? "ready" : "queued"} />
                  <span className="text-xs text-slate-500">
                    {lastReady
                      ? `Deployed ${fmtRelative(lastReady.finished_at)}`
                      : "Never deployed"}
                  </span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">
                  {project?.name || "Project"}
                </h1>
                <button
                  onClick={copyUrl}
                  className="group inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
                >
                  <Lock size={12} className="text-emerald-400" />
                  <code className="font-mono">https://{primaryDomain}</code>
                  {copied ? (
                    <Check size={14} className="text-emerald-400" weight="bold" />
                  ) : (
                    <Copy size={14} className="text-slate-500 group-hover:text-white" />
                  )}
                </button>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <GitBranch size={12} />
                    {cfg.branch}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Rocket size={12} />
                    {history.length} deploy{history.length === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Globe size={12} />
                    {domains.filter((d) => d.verified).length} custom domain
                    {domains.filter((d) => d.verified).length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-3">
                <button
                  onClick={() => runDeploy("production")}
                  disabled={deploying}
                  className="inline-flex items-center gap-2 bg-white text-slate-950 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors shadow-lg shadow-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deploying ? (
                    <>
                      <CircleNotch size={16} className="animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket size={16} weight="fill" />
                      Deploy to production
                    </>
                  )}
                </button>
                <a
                  href={`https://${primaryDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1"
                >
                  Visit site <ArrowSquareOut size={11} />
                </a>
              </div>
            </div>

            {deploying && (
              <div className="relative mt-6 p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
                <DeployStageList active={stage} stages={stageTimes} />
              </div>
            )}
          </div>

          {/* Environments */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Environments
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {ENVS.map(({ id, label, icon: Icon }) => {
                const last = history.find((h) => h.env === id && h.status === "ready");
                return (
                  <div
                    key={id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-brand-400" />
                        <span className="text-sm font-semibold text-white">{label}</span>
                      </div>
                      <StatusPill status={last ? "ready" : "queued"} />
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      {last
                        ? `Updated ${fmtRelative(last.finished_at)}`
                        : "No deployments yet"}
                    </p>
                    <button
                      onClick={() => runDeploy(id)}
                      disabled={deploying}
                      className="mt-auto text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-md transition-colors disabled:opacity-50"
                    >
                      Deploy {label.toLowerCase()}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Provider + Build config */}
          <div className="grid grid-cols-[1fr_360px] gap-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Hosting provider
              </h2>
              <div className="grid grid-cols-4 gap-3">
                {PROVIDERS.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    connected={cfg.provider === p.id}
                    onSelect={(id) =>
                      setCfg({ ...cfg, provider: cfg.provider === id ? null : id })
                    }
                  />
                ))}
              </div>
              {cfg.provider && (
                <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                  <Check size={12} className="text-emerald-400" weight="bold" />
                  Connected to{" "}
                  <span className="text-slate-300 font-medium">
                    {PROVIDERS.find((p) => p.id === cfg.provider)?.name}
                  </span>
                  . The next deploy will push there.
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Build settings
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Production branch
                  </label>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5">
                    <GithubLogo size={14} className="text-slate-500" />
                    <input
                      value={cfg.branch}
                      onChange={(e) => setCfg({ ...cfg, branch: e.target.value })}
                      className="flex-1 bg-transparent text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Build command
                  </label>
                  <input
                    value={cfg.build_command}
                    onChange={(e) =>
                      setCfg({ ...cfg, build_command: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Output directory
                  </label>
                  <input
                    value={cfg.output_dir}
                    onChange={(e) => setCfg({ ...cfg, output_dir: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <label className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800 cursor-pointer">
                  <div>
                    <p className="text-sm text-white">Auto-deploy on changes</p>
                    <p className="text-[11px] text-slate-500">
                      Trigger a deploy whenever a page is generated.
                    </p>
                  </div>
                  <button
                    onClick={() => setCfg({ ...cfg, auto_deploy: !cfg.auto_deploy })}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                      cfg.auto_deploy ? "bg-brand-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        cfg.auto_deploy ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </section>
          </div>

          {/* Domains */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Custom domains
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-slate-800">
                <input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDomain()}
                  placeholder="www.example.com"
                  className="flex-1 bg-slate-950 border border-slate-800 text-white text-sm font-mono rounded-md py-2 px-3 focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={addDomain}
                  disabled={!newDomain.trim()}
                  className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-md transition-colors"
                >
                  <Plus size={14} weight="bold" />
                  Add domain
                </button>
              </div>
              {domains.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No custom domains yet. Your site is live at{" "}
                  <code className="font-mono text-slate-400">{primaryDomain}</code>
                </div>
              ) : (
                <div>
                  {domains.map((d) => (
                    <DomainRow
                      key={d.host}
                      domain={d}
                      onRemove={removeDomain}
                      onVerify={verifyDomain}
                    />
                  ))}
                </div>
              )}
            </div>
            {domains.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {domains
                  .filter((d) => d.verified && !d.primary)
                  .map((d) => (
                    <button
                      key={d.host}
                      onClick={() => setPrimary(d.host)}
                      className="text-[11px] text-slate-500 hover:text-brand-400"
                    >
                      Make {d.host} primary
                    </button>
                  ))}
              </div>
            )}
          </section>

          {/* Env vars */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Environment variables
              </h2>
              <button
                onClick={addEnvVar}
                className="text-xs font-medium text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
              >
                <Plus size={12} weight="bold" /> Add variable
              </button>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              {envVars.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">
                  No env vars yet. Add API keys and secrets here — they'll be injected
                  at build time.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1 mb-1">
                    <span>Key</span>
                    <span>Value</span>
                    <span />
                    <span />
                  </div>
                  {envVars.map((env, idx) => (
                    <EnvVarRow
                      key={idx}
                      env={env}
                      onUpdate={(updated) => updateEnvVar(idx, updated)}
                      onRemove={() => {
                        const next = [...envVars];
                        next.splice(idx, 1);
                        setEnvVars(next);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* History */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Deployment history
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {history.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock size={28} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    No deployments yet — hit{" "}
                    <span className="text-slate-300 font-medium">Deploy to production</span>{" "}
                    to ship your first version.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                      <th className="text-left px-5 py-2.5 font-semibold">Commit</th>
                      <th className="text-left px-5 py-2.5 font-semibold">Env</th>
                      <th className="text-left px-5 py-2.5 font-semibold">Branch</th>
                      <th className="text-left px-5 py-2.5 font-semibold">Duration</th>
                      <th className="text-left px-5 py-2.5 font-semibold">When</th>
                      <th className="text-right px-5 py-2.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30"
                      >
                        <td className="px-5 py-3">
                          <StatusPill status={d.status} />
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-white text-xs font-mono">{d.commit}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[260px]">
                            {d.message}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs capitalize">
                          {d.env}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs font-mono">
                          {d.branch}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs font-mono">
                          {d.duration_ms
                            ? `${(d.duration_ms / 1000).toFixed(1)}s`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {fmtRelative(d.started_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {d.status === "ready" && (
                            <button
                              onClick={() => runDeploy(d.env)}
                              disabled={deploying}
                              className="text-xs text-slate-500 hover:text-brand-400 disabled:opacity-50"
                            >
                              Redeploy
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
