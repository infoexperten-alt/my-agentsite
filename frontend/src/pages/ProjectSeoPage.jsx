import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  CaretRight,
  MagnifyingGlass,
  Globe,
  FileText,
  ChartLineUp,
  Image as ImageIcon,
  Check,
  Warning,
  X,
  Link as LinkIcon,
  ShareNetwork,
  TwitterLogo,
  FacebookLogo,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import Spinner from "../components/shared/Spinner";

const DEFAULT_SITE = {
  site_title: "",
  site_description: "",
  default_og_image: "",
  canonical_base: "",
  robots_txt:
    "User-agent: *\nAllow: /\n\nSitemap: {{canonical_base}}/sitemap.xml",
  sitemap_enabled: true,
  google_verification: "",
  bing_verification: "",
  twitter_handle: "",
  default_robots: "index,follow",
};

const DEFAULT_PAGE_SEO = {
  title: "",
  description: "",
  og_title: "",
  og_description: "",
  og_image: "",
  canonical: "",
  robots: "index,follow",
  keywords: "",
  twitter_card: "summary_large_image",
};

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 160;

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
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

function CharCounter({ value, min, max }) {
  const len = (value || "").length;
  let tone = "text-slate-500";
  if (len === 0) tone = "text-slate-600";
  else if (len < min) tone = "text-amber-400";
  else if (len > max) tone = "text-rose-400";
  else tone = "text-emerald-400";
  return (
    <span className={`text-[10px] font-mono ${tone}`}>
      {len} / {max}
    </span>
  );
}

function Field({ label, hint, children, counter }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-medium text-slate-400">{label}</label>
        {counter}
      </div>
      {children}
      {hint && <p className="text-[11px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, mono }) {
  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none ${
        mono ? "font-mono text-xs" : ""
      }`}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3, mono }) {
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none resize-none ${
        mono ? "font-mono text-xs" : ""
      }`}
    />
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-800/60 last:border-0">
      <div className="flex-1">
        <p className="text-sm text-white font-medium">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-brand-500" : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SerpPreview({ canonicalBase, page, seo }) {
  const url = `${canonicalBase || "https://yoursite.com"}${
    page.slug === "home" ? "" : "/" + page.slug
  }`;
  const title = seo.title || page.title || "Untitled page";
  const desc =
    seo.description ||
    "No meta description set. Search engines will generate one from page content.";
  return (
    <div className="bg-white rounded-lg p-4 font-sans">
      <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-700">
        <div className="w-4 h-4 bg-slate-200 rounded-full" />
        <span className="font-medium">{new URL(url.replace(/\/$/, "") || "https://yoursite.com").host}</span>
        <span className="text-slate-400">›</span>
        <span className="text-slate-500 truncate">{page.slug}</span>
      </div>
      <h3 className="text-[#1a0dab] text-lg leading-snug hover:underline cursor-pointer mb-1 truncate">
        {title}
      </h3>
      <p className="text-sm text-slate-600 leading-snug line-clamp-2">{desc}</p>
    </div>
  );
}

function SocialPreview({ projectId, page, seo, defaultOg }) {
  const title = seo.og_title || seo.title || page.title;
  const desc = seo.og_description || seo.description;
  const img = seo.og_image || defaultOg;
  const imgSrc = img ? `/preview/${projectId}/assets/${img}` : null;

  return (
    <div className="bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
      <div className="aspect-[1.91/1] bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
        {imgSrc ? (
          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-400 flex flex-col items-center gap-2">
            <ImageIcon size={32} />
            <span className="text-xs">No OG image set</span>
          </div>
        )}
      </div>
      <div className="p-3 bg-slate-50">
        <p className="text-[10px] uppercase text-slate-500 tracking-wide mb-0.5">
          yoursite.com
        </p>
        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1">
          {title || "Untitled"}
        </p>
        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
          {desc || "No description"}
        </p>
      </div>
    </div>
  );
}

function scorePageSeo(seo, page) {
  const checks = [];
  const t = seo.title || page.title || "";
  const d = seo.description || "";

  checks.push({
    label: "Title length",
    ok: t.length >= TITLE_MIN && t.length <= TITLE_MAX,
    warn: t.length > 0 && (t.length < TITLE_MIN || t.length > TITLE_MAX),
    msg:
      t.length === 0
        ? "Missing"
        : t.length < TITLE_MIN
        ? `Too short (${t.length})`
        : t.length > TITLE_MAX
        ? `Too long (${t.length})`
        : `${t.length} chars`,
  });
  checks.push({
    label: "Meta description",
    ok: d.length >= DESC_MIN && d.length <= DESC_MAX,
    warn: d.length > 0 && (d.length < DESC_MIN || d.length > DESC_MAX),
    msg:
      d.length === 0
        ? "Missing"
        : d.length < DESC_MIN
        ? `Too short (${d.length})`
        : d.length > DESC_MAX
        ? `Too long (${d.length})`
        : `${d.length} chars`,
  });
  checks.push({
    label: "Open Graph image",
    ok: !!seo.og_image,
    warn: false,
    msg: seo.og_image ? "Set" : "Missing",
  });
  checks.push({
    label: "Canonical URL",
    ok: !!seo.canonical,
    warn: false,
    msg: seo.canonical ? "Set" : "Missing",
  });
  checks.push({
    label: "Robots directive",
    ok: !!seo.robots,
    warn: false,
    msg: seo.robots || "Missing",
  });

  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, checks };
}

function ScorePill({ score }) {
  let tone = "bg-rose-500/15 text-rose-400 border-rose-500/30";
  if (score >= 80) tone = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  else if (score >= 50) tone = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${tone}`}
    >
      {score}
    </span>
  );
}

function TabButton({ active, onClick, icon: Icon, children, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? "border-brand-500 text-white"
          : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      <Icon size={16} />
      {children}
      {count != null && (
        <span className="text-[10px] font-semibold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </button>
  );
}

function SiteTab({ site, setSite }) {
  const update = (k, v) => setSite({ ...site, [k]: v });
  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h3 className="text-base font-semibold text-white mb-1">Site identity</h3>
        <p className="text-xs text-slate-500 mb-4">
          Defaults applied to every page that doesn't override them.
        </p>
        <div className="space-y-4">
          <Field
            label="Default site title"
            hint="Used as fallback and appended to page titles (e.g. 'About — Site')."
            counter={<CharCounter value={site.site_title} min={5} max={60} />}
          >
            <Input
              value={site.site_title}
              onChange={(v) => update("site_title", v)}
              placeholder="YachtMind — luxury chartering platform"
            />
          </Field>
          <Field
            label="Default meta description"
            counter={<CharCounter value={site.site_description} min={DESC_MIN} max={DESC_MAX} />}
          >
            <Textarea
              value={site.site_description}
              onChange={(v) => update("site_description", v)}
              placeholder="Describe your site in one or two sentences."
            />
          </Field>
          <Field
            label="Canonical base URL"
            hint="The production URL. Used to build canonical tags and sitemap entries."
          >
            <Input
              value={site.canonical_base}
              onChange={(v) => update("canonical_base", v)}
              placeholder="https://yachtmind.com"
              mono
            />
          </Field>
          <Field
            label="Default OG image path"
            hint="Asset path served from /preview/{project}/assets/. Used when a page has no OG image of its own."
          >
            <Input
              value={site.default_og_image}
              onChange={(v) => update("default_og_image", v)}
              placeholder="og-default.png"
              mono
            />
          </Field>
          <Field label="Twitter handle">
            <Input
              value={site.twitter_handle}
              onChange={(v) => update("twitter_handle", v)}
              placeholder="@yourhandle"
            />
          </Field>
        </div>
      </section>

      <hr className="border-slate-800" />

      <section>
        <h3 className="text-base font-semibold text-white mb-1">Indexing</h3>
        <p className="text-xs text-slate-500 mb-4">
          Control what search engines can see and crawl.
        </p>
        <div className="bg-slate-900 border border-slate-800 rounded-lg px-4">
          <ToggleRow
            label="Generate sitemap.xml"
            hint="Build a sitemap from all pages on every deploy."
            checked={site.sitemap_enabled}
            onChange={(v) => update("sitemap_enabled", v)}
          />
        </div>
        <div className="mt-4 space-y-4">
          <Field
            label="Default robots directive"
            hint="Per-page values override this."
          >
            <Input
              value={site.default_robots}
              onChange={(v) => update("default_robots", v)}
              placeholder="index,follow"
              mono
            />
          </Field>
          <Field label="robots.txt contents">
            <Textarea
              value={site.robots_txt}
              onChange={(v) => update("robots_txt", v)}
              rows={5}
              mono
            />
          </Field>
        </div>
      </section>

      <hr className="border-slate-800" />

      <section>
        <h3 className="text-base font-semibold text-white mb-1">
          Search console verification
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Meta tags rendered in &lt;head&gt; for ownership verification.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Google site verification">
            <Input
              value={site.google_verification}
              onChange={(v) => update("google_verification", v)}
              placeholder="abc123..."
              mono
            />
          </Field>
          <Field label="Bing site verification">
            <Input
              value={site.bing_verification}
              onChange={(v) => update("bing_verification", v)}
              placeholder="abc123..."
              mono
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function PagesTab({ projectId, pages, pageSeo, setPageSeo, site }) {
  const [selectedSlug, setSelectedSlug] = useState(pages[0]?.slug || null);
  const [socialView, setSocialView] = useState("facebook");

  useEffect(() => {
    if (!selectedSlug && pages[0]) setSelectedSlug(pages[0].slug);
  }, [pages, selectedSlug]);

  if (pages.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
        <FileText className="text-slate-600 mx-auto mb-3" size={32} />
        <p className="text-sm text-slate-500">
          No pages yet — create a page on the project Overview to configure SEO.
        </p>
      </div>
    );
  }

  const page = pages.find((p) => p.slug === selectedSlug) || pages[0];
  const seo = { ...DEFAULT_PAGE_SEO, ...(pageSeo[page.slug] || {}) };
  const update = (k, v) =>
    setPageSeo({ ...pageSeo, [page.slug]: { ...seo, [k]: v } });

  const { score, checks } = scorePageSeo(seo, page);

  return (
    <div className="grid grid-cols-[220px_1fr_360px] gap-6">
      {/* Page list */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">
          Pages ({pages.length})
        </p>
        {pages.map((p) => {
          const s = scorePageSeo(
            { ...DEFAULT_PAGE_SEO, ...(pageSeo[p.slug] || {}) },
            p
          ).score;
          return (
            <button
              key={p.slug}
              onClick={() => setSelectedSlug(p.slug)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                p.slug === page.slug
                  ? "bg-brand-500/10 text-white border border-brand-500/30"
                  : "text-slate-400 hover:bg-slate-900 border border-transparent"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.title || p.slug}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">
                  /{p.slug}
                </p>
              </div>
              <ScorePill score={s} />
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="space-y-5 min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white truncate">
              {page.title || page.slug}
            </h3>
            <ScorePill score={score} />
          </div>
          <p className="text-xs text-slate-500 font-mono">/{page.slug}</p>
        </div>

        <Field
          label="Title tag"
          hint={`Aim for ${TITLE_MIN}–${TITLE_MAX} characters.`}
          counter={<CharCounter value={seo.title} min={TITLE_MIN} max={TITLE_MAX} />}
        >
          <Input
            value={seo.title}
            onChange={(v) => update("title", v)}
            placeholder={page.title || "Page title"}
          />
        </Field>

        <Field
          label="Meta description"
          counter={<CharCounter value={seo.description} min={DESC_MIN} max={DESC_MAX} />}
        >
          <Textarea
            value={seo.description}
            onChange={(v) => update("description", v)}
            placeholder="What this page is about, in one or two sentences."
          />
        </Field>

        <Field label="Keywords" hint="Optional. Comma-separated. Most engines ignore this.">
          <Input
            value={seo.keywords}
            onChange={(v) => update("keywords", v)}
            placeholder="charter, yacht, mediterranean"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Canonical URL">
            <Input
              value={seo.canonical}
              onChange={(v) => update("canonical", v)}
              placeholder={`${site.canonical_base || "https://yoursite.com"}/${page.slug === "home" ? "" : page.slug}`}
              mono
            />
          </Field>
          <Field label="Robots">
            <Input
              value={seo.robots}
              onChange={(v) => update("robots", v)}
              placeholder="index,follow"
              mono
            />
          </Field>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Social sharing
          </p>
          <div className="space-y-4">
            <Field
              label="OG title"
              counter={<CharCounter value={seo.og_title} min={10} max={70} />}
            >
              <Input
                value={seo.og_title}
                onChange={(v) => update("og_title", v)}
                placeholder="Falls back to title tag"
              />
            </Field>
            <Field
              label="OG description"
              counter={<CharCounter value={seo.og_description} min={30} max={200} />}
            >
              <Textarea
                value={seo.og_description}
                onChange={(v) => update("og_description", v)}
                placeholder="Falls back to meta description"
              />
            </Field>
            <Field
              label="OG image"
              hint="Asset path (relative to project assets). Recommended 1200×630."
            >
              <Input
                value={seo.og_image}
                onChange={(v) => update("og_image", v)}
                placeholder={site.default_og_image || "share-image.png"}
                mono
              />
            </Field>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Audit
          </p>
          <div className="space-y-2">
            {checks.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2 text-slate-300">
                  {c.ok ? (
                    <Check className="text-emerald-400" size={14} weight="bold" />
                  ) : c.warn ? (
                    <Warning className="text-amber-400" size={14} weight="fill" />
                  ) : (
                    <X className="text-rose-400" size={14} weight="bold" />
                  )}
                  {c.label}
                </div>
                <span className="text-xs text-slate-500">{c.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Previews */}
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MagnifyingGlass size={14} className="text-slate-500" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Search preview
            </p>
          </div>
          <SerpPreview canonicalBase={site.canonical_base} page={page} seo={seo} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShareNetwork size={14} className="text-slate-500" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Social preview
              </p>
            </div>
            <div className="flex bg-slate-900 border border-slate-800 rounded-md p-0.5">
              <button
                onClick={() => setSocialView("facebook")}
                className={`p-1 rounded ${
                  socialView === "facebook" ? "bg-slate-800 text-white" : "text-slate-500"
                }`}
              >
                <FacebookLogo size={14} weight="fill" />
              </button>
              <button
                onClick={() => setSocialView("twitter")}
                className={`p-1 rounded ${
                  socialView === "twitter" ? "bg-slate-800 text-white" : "text-slate-500"
                }`}
              >
                <TwitterLogo size={14} weight="fill" />
              </button>
            </div>
          </div>
          <SocialPreview
            projectId={projectId}
            page={page}
            seo={seo}
            defaultOg={site.default_og_image}
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon size={12} className="text-slate-500" />
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Rendered URL
            </p>
          </div>
          <code className="text-[11px] font-mono text-emerald-300 break-all">
            {(site.canonical_base || "https://yoursite.com") +
              (page.slug === "home" ? "" : "/" + page.slug)}
          </code>
        </div>
      </div>
    </div>
  );
}

function HealthTab({ pages, pageSeo, site }) {
  const rows = pages.map((p) => {
    const seo = { ...DEFAULT_PAGE_SEO, ...(pageSeo[p.slug] || {}) };
    return { page: p, ...scorePageSeo(seo, p) };
  });

  const avg = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length)
    : 0;

  const allChecks = rows.flatMap((r) => r.checks);
  const passing = allChecks.filter((c) => c.ok).length;
  const failing = allChecks.length - passing;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Site SEO score</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">{avg}</span>
            <span className="text-sm text-slate-500">/ 100</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Pages indexed</p>
          <p className="text-3xl font-bold text-white">{pages.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Checks passing</p>
          <p className="text-3xl font-bold text-emerald-400">{passing}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Checks failing</p>
          <p className="text-3xl font-bold text-rose-400">{failing}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
          <ChartLineUp size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-white">Per-page breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800">
              <th className="text-left px-5 py-2.5 font-medium">Page</th>
              <th className="text-left px-5 py-2.5 font-medium">Title</th>
              <th className="text-left px-5 py-2.5 font-medium">Description</th>
              <th className="text-left px-5 py-2.5 font-medium">OG image</th>
              <th className="text-left px-5 py-2.5 font-medium">Canonical</th>
              <th className="text-right px-5 py-2.5 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ page, score, checks }) => (
              <tr key={page.slug} className="border-b border-slate-800/60 last:border-0">
                <td className="px-5 py-3">
                  <p className="text-white font-medium">{page.title || page.slug}</p>
                  <p className="text-[10px] text-slate-500 font-mono">/{page.slug}</p>
                </td>
                {checks.map((c) => (
                  <td key={c.label} className="px-5 py-3">
                    {c.ok ? (
                      <Check className="text-emerald-400" size={16} weight="bold" />
                    ) : c.warn ? (
                      <Warning className="text-amber-400" size={16} weight="fill" />
                    ) : (
                      <X className="text-rose-400" size={16} weight="bold" />
                    )}
                  </td>
                ))}
                <td className="px-5 py-3 text-right">
                  <ScorePill score={score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!site.canonical_base && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
          <Warning className="text-amber-400 shrink-0 mt-0.5" size={18} weight="fill" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              No canonical base URL set
            </p>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Set it under the Site tab to enable proper canonical tags, OG URLs, and
              a valid sitemap.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectSeoPage() {
  const { projectId } = useParams();
  const { project, pages, loading } = useProject(projectId);

  const siteKey = `agentsite:seo:site:${projectId}`;
  const pagesKey = `agentsite:seo:pages:${projectId}`;

  const [site, setSite] = useState(() => loadLS(siteKey, DEFAULT_SITE));
  const [pageSeo, setPageSeoState] = useState(() => {
    try {
      const raw = localStorage.getItem(pagesKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [activeTab, setActiveTab] = useState("pages");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    saveLS(siteKey, site);
  }, [site, siteKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pagesKey, JSON.stringify(pageSeo));
    } catch {
      // ignore
    }
  }, [pageSeo, pagesKey]);

  // Seed default site title from project name on first load
  useEffect(() => {
    if (project && !site.site_title) {
      setSite((s) => ({ ...s, site_title: project.name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const setPageSeo = (next) => {
    setPageSeoState(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const avgScore = useMemo(() => {
    if (!pages.length) return 0;
    const total = pages.reduce(
      (sum, p) =>
        sum + scorePageSeo({ ...DEFAULT_PAGE_SEO, ...(pageSeo[p.slug] || {}) }, p).score,
      0
    );
    return Math.round(total / pages.length);
  }, [pages, pageSeo]);

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
          <span className="text-white font-medium">SEO</span>
        </div>
      </div>

      <div className="p-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between mb-6 gap-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                Search Engine Optimization
                <ScorePill score={avgScore} />
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure meta tags, sharing previews, and indexing rules for every
                page. Changes are saved locally and applied on the next deploy.
              </p>
            </div>
            <div
              className={`text-xs px-3 py-1.5 rounded-full transition-opacity ${
                savedFlash
                  ? "opacity-100 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "opacity-0"
              }`}
            >
              <Check size={12} weight="bold" className="inline mr-1" />
              Saved
            </div>
          </div>

          <div className="border-b border-slate-800 mb-6 flex items-center gap-1">
            <TabButton
              active={activeTab === "pages"}
              onClick={() => setActiveTab("pages")}
              icon={FileText}
              count={pages.length}
            >
              Pages
            </TabButton>
            <TabButton
              active={activeTab === "site"}
              onClick={() => setActiveTab("site")}
              icon={Globe}
            >
              Site defaults
            </TabButton>
            <TabButton
              active={activeTab === "health"}
              onClick={() => setActiveTab("health")}
              icon={ChartLineUp}
            >
              Health
            </TabButton>
          </div>

          {activeTab === "pages" && (
            <PagesTab
              projectId={projectId}
              pages={pages}
              pageSeo={pageSeo}
              setPageSeo={setPageSeo}
              site={site}
            />
          )}
          {activeTab === "site" && <SiteTab site={site} setSite={setSite} />}
          {activeTab === "health" && (
            <HealthTab pages={pages} pageSeo={pageSeo} site={site} />
          )}
        </div>
      </div>
    </div>
  );
}
