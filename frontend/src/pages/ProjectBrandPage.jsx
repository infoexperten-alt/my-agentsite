import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  CaretRight,
  UploadSimple,
  Palette,
  Image,
} from "@phosphor-icons/react";
import useProject from "../hooks/useProject";
import * as projectsApi from "../api/projects";
import * as assetsApi from "../api/assets";
import Spinner from "../components/shared/Spinner";

const DEFAULT_STYLE_SPEC = {
  // Colors
  primary_color: "#2563eb",
  secondary_color: "#1e40af",
  accent_color: "#f59e0b",
  background_color: "#ffffff",
  surface_color: "#f8fafc",
  text_color: "#1f2937",
  text_secondary_color: "#6b7280",
  border_color: "#e5e7eb",
  // Typography
  font_heading: "Inter",
  font_body: "Inter",
  font_mono: "JetBrains Mono",
  font_size_base: "16px",
  font_size_sm: "14px",
  font_size_lg: "18px",
  font_size_xl: "20px",
  font_size_2xl: "24px",
  font_size_3xl: "30px",
  font_size_4xl: "36px",
  line_height: "1.6",
  letter_spacing: "0",
  font_weight_normal: "400",
  font_weight_medium: "500",
  font_weight_bold: "700",
  // Layout
  layout_style: "top-nav",
  nav_position: "sticky",
  footer_style: "standard",
  max_width: "1200px",
  container_padding: "1.5rem",
  section_gap: "4rem",
  // Spacing
  spacing_unit: "1rem",
  spacing_xs: "0.25rem",
  spacing_sm: "0.5rem",
  spacing_md: "1rem",
  spacing_lg: "1.5rem",
  spacing_xl: "2rem",
  spacing_2xl: "3rem",
  // Borders
  border_radius: "8px",
  border_radius_sm: "4px",
  border_radius_lg: "12px",
  border_radius_full: "9999px",
  border_width: "1px",
  // Shadows
  shadow_sm: "0 1px 2px rgba(0,0,0,0.05)",
  shadow_md: "0 4px 6px rgba(0,0,0,0.07)",
  shadow_lg: "0 10px 15px rgba(0,0,0,0.1)",
  // Effects
  transition_speed: "150ms",
  backdrop_blur: "8px",
};

function SectionHeader({ title, description }) {
  return (
    <div className="mb-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs font-mono rounded py-1.5 px-2 focus:border-brand-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, mono, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-slate-950 border border-slate-700 text-white text-sm rounded-lg py-2 px-3 focus:border-brand-500 focus:outline-none ${mono ? "font-mono text-xs" : ""}`}
      />
    </div>
  );
}

function LayoutThumb({ type, active }) {
  const bar = active ? "bg-brand-400" : "bg-slate-600";
  const area = active ? "bg-brand-500/20" : "bg-slate-800";
  const line = active ? "bg-brand-500/30" : "bg-slate-700";

  if (type === "top-nav") {
    return (
      <div className="w-full h-14 rounded bg-slate-950 border border-slate-800 overflow-hidden">
        <div className={`h-2.5 ${bar} w-full`} />
        <div className="p-1.5 space-y-1">
          <div className={`h-1 ${line} w-3/4 rounded-full`} />
          <div className={`h-1 ${line} w-1/2 rounded-full`} />
          <div className={`h-4 ${area} rounded`} />
        </div>
      </div>
    );
  }

  if (type === "sidebar") {
    return (
      <div className="w-full h-14 rounded bg-slate-950 border border-slate-800 overflow-hidden flex">
        <div className={`w-4 ${bar} shrink-0`} />
        <div className="flex-1 p-1.5 space-y-1">
          <div className={`h-1 ${line} w-3/4 rounded-full`} />
          <div className={`h-1 ${line} w-1/2 rounded-full`} />
          <div className={`h-4 ${area} rounded`} />
        </div>
      </div>
    );
  }

  if (type === "minimal") {
    return (
      <div className="w-full h-14 rounded bg-slate-950 border border-slate-800 overflow-hidden">
        <div className="h-2.5 flex items-center justify-between px-1.5">
          <div className={`w-2 h-1 ${bar} rounded`} />
          <div className="flex gap-0.5">
            <div className={`w-1.5 h-0.5 ${bar} rounded-full`} />
            <div className={`w-1.5 h-0.5 ${bar} rounded-full`} />
          </div>
        </div>
        <div className="px-1.5 space-y-1">
          <div className={`h-1 ${line} w-1/2 rounded-full mx-auto`} />
          <div className={`h-5 ${area} rounded`} />
        </div>
      </div>
    );
  }

  // centered
  return (
    <div className="w-full h-14 rounded bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="h-2.5 flex items-center justify-center gap-1 px-1">
        <div className={`w-2 h-0.5 ${bar} rounded-full`} />
        <div className={`w-1.5 h-1 ${bar} rounded`} />
        <div className={`w-2 h-0.5 ${bar} rounded-full`} />
      </div>
      <div className="px-1.5 space-y-1">
        <div className={`h-1 ${line} w-1/2 rounded-full mx-auto`} />
        <div className={`h-5 ${area} rounded`} />
      </div>
    </div>
  );
}

function FileUpload({ label, currentUrl, onUpload, projectId }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await assetsApi.uploadAsset(projectId, file);
      onUpload(result.path);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <div
          onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-lg bg-black border border-slate-700 flex items-center justify-center relative group cursor-pointer overflow-hidden"
        >
          {currentUrl ? (
            <img
              src={`/preview/${projectId}/assets/${currentUrl}`}
              alt={label}
              className="w-full h-full object-contain"
            />
          ) : (
            <Image className="text-slate-600" size={24} />
          )}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Spinner size={16} />
            ) : (
              <UploadSimple className="text-white" size={20} />
            )}
          </div>
        </div>
        <div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium"
          >
            {uploading ? "Uploading..." : currentUrl ? "Replace" : "Upload"}
          </button>
          {currentUrl && (
            <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate max-w-[200px]">
              {currentUrl}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}

function BrandContent({ project, refresh }) {
  const ss = project?.style_spec;

  // Build state from style_spec or defaults
  const init = (key) => ss?.[key] || DEFAULT_STYLE_SPEC[key];

  // Colors
  const [primaryColor, setPrimaryColor] = useState(init("primary_color"));
  const [secondaryColor, setSecondaryColor] = useState(init("secondary_color"));
  const [accentColor, setAccentColor] = useState(init("accent_color"));
  const [bgColor, setBgColor] = useState(init("background_color"));
  const [surfaceColor, setSurfaceColor] = useState(init("surface_color"));
  const [textColor, setTextColor] = useState(init("text_color"));
  const [textSecondaryColor, setTextSecondaryColor] = useState(init("text_secondary_color"));
  const [borderColor, setBorderColor] = useState(init("border_color"));

  // Typography
  const [fontHeading, setFontHeading] = useState(init("font_heading"));
  const [fontBody, setFontBody] = useState(init("font_body"));
  const [fontMono, setFontMono] = useState(init("font_mono"));
  const [fontSizeBase, setFontSizeBase] = useState(init("font_size_base"));
  const [fontSizeSm, setFontSizeSm] = useState(init("font_size_sm"));
  const [fontSizeLg, setFontSizeLg] = useState(init("font_size_lg"));
  const [fontSizeXl, setFontSizeXl] = useState(init("font_size_xl"));
  const [fontSize2xl, setFontSize2xl] = useState(init("font_size_2xl"));
  const [fontSize3xl, setFontSize3xl] = useState(init("font_size_3xl"));
  const [fontSize4xl, setFontSize4xl] = useState(init("font_size_4xl"));
  const [lineHeight, setLineHeight] = useState(init("line_height"));
  const [letterSpacing, setLetterSpacing] = useState(init("letter_spacing"));
  const [fontWeightNormal, setFontWeightNormal] = useState(init("font_weight_normal"));
  const [fontWeightMedium, setFontWeightMedium] = useState(init("font_weight_medium"));
  const [fontWeightBold, setFontWeightBold] = useState(init("font_weight_bold"));

  // Layout
  const [layoutStyle, setLayoutStyle] = useState(init("layout_style"));
  const [navPosition, setNavPosition] = useState(init("nav_position"));
  const [footerStyle, setFooterStyle] = useState(init("footer_style"));
  const [maxWidth, setMaxWidth] = useState(init("max_width"));
  const [containerPadding, setContainerPadding] = useState(init("container_padding"));
  const [sectionGap, setSectionGap] = useState(init("section_gap"));

  // Spacing
  const [spacingUnit, setSpacingUnit] = useState(init("spacing_unit"));
  const [spacingXs, setSpacingXs] = useState(init("spacing_xs"));
  const [spacingSm, setSpacingSm] = useState(init("spacing_sm"));
  const [spacingMd, setSpacingMd] = useState(init("spacing_md"));
  const [spacingLg, setSpacingLg] = useState(init("spacing_lg"));
  const [spacingXl, setSpacingXl] = useState(init("spacing_xl"));
  const [spacing2xl, setSpacing2xl] = useState(init("spacing_2xl"));

  // Borders
  const [borderRadius, setBorderRadius] = useState(init("border_radius"));
  const [borderRadiusSm, setBorderRadiusSm] = useState(init("border_radius_sm"));
  const [borderRadiusLg, setBorderRadiusLg] = useState(init("border_radius_lg"));
  const [borderRadiusFull, setBorderRadiusFull] = useState(init("border_radius_full"));
  const [borderWidth, setBorderWidth] = useState(init("border_width"));

  // Shadows
  const [shadowSm, setShadowSm] = useState(init("shadow_sm"));
  const [shadowMd, setShadowMd] = useState(init("shadow_md"));
  const [shadowLg, setShadowLg] = useState(init("shadow_lg"));

  // Effects
  const [transitionSpeed, setTransitionSpeed] = useState(init("transition_speed"));
  const [backdropBlur, setBackdropBlur] = useState(init("backdrop_blur"));

  // Assets
  const [logoUrl, setLogoUrl] = useState(project?.logo_url || "");
  const [iconUrl, setIconUrl] = useState(project?.icon_url || "");

  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(!!ss);

  const handleSetupBrand = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(project.id, {
        style_spec: DEFAULT_STYLE_SPEC,
      });
      setInitialized(true);
      refresh();
    } catch (err) {
      console.error("Failed to set up brand:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsApi.updateProject(project.id, {
        logo_url: logoUrl,
        icon_url: iconUrl,
        style_spec: {
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          background_color: bgColor,
          surface_color: surfaceColor,
          text_color: textColor,
          text_secondary_color: textSecondaryColor,
          border_color: borderColor,
          font_heading: fontHeading,
          font_body: fontBody,
          font_mono: fontMono,
          font_size_base: fontSizeBase,
          font_size_sm: fontSizeSm,
          font_size_lg: fontSizeLg,
          font_size_xl: fontSizeXl,
          font_size_2xl: fontSize2xl,
          font_size_3xl: fontSize3xl,
          font_size_4xl: fontSize4xl,
          line_height: lineHeight,
          letter_spacing: letterSpacing,
          font_weight_normal: fontWeightNormal,
          font_weight_medium: fontWeightMedium,
          font_weight_bold: fontWeightBold,
          layout_style: layoutStyle,
          nav_position: navPosition,
          footer_style: footerStyle,
          max_width: maxWidth,
          container_padding: containerPadding,
          section_gap: sectionGap,
          spacing_unit: spacingUnit,
          spacing_xs: spacingXs,
          spacing_sm: spacingSm,
          spacing_md: spacingMd,
          spacing_lg: spacingLg,
          spacing_xl: spacingXl,
          spacing_2xl: spacing2xl,
          border_radius: borderRadius,
          border_radius_sm: borderRadiusSm,
          border_radius_lg: borderRadiusLg,
          border_radius_full: borderRadiusFull,
          border_width: borderWidth,
          shadow_sm: shadowSm,
          shadow_md: shadowMd,
          shadow_lg: shadowLg,
          transition_speed: transitionSpeed,
          backdrop_blur: backdropBlur,
        },
      });
      refresh();
    } catch (err) {
      console.error("Failed to save brand:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (path) => {
    setLogoUrl(path);
    try {
      await projectsApi.updateProject(project.id, { logo_url: path });
      refresh();
    } catch (err) {
      console.error("Failed to save logo:", err);
    }
  };

  const handleIconUpload = async (path) => {
    setIconUrl(path);
    try {
      await projectsApi.updateProject(project.id, { icon_url: path });
      refresh();
    } catch (err) {
      console.error("Failed to save icon:", err);
    }
  };

  if (!ss && !initialized) {
    return (
      <div className="max-w-2xl">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <Palette className="text-slate-600 mx-auto mb-4" size={48} />
          <h3 className="text-white font-semibold mb-2">No Brand Identity Yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Set up your brand to define the complete design system — colors,
            typography, layout, spacing, borders, shadows, and more.
          </p>
          <button
            onClick={handleSetupBrand}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? "Setting up..." : "Set Up Brand"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-3xl pb-12">
      {/* Logo & Icon */}
      <section>
        <SectionHeader title="Logo & Icon" description="Brand marks used in headers, favicons, and social previews." />
        <div className="grid grid-cols-2 gap-6">
          <FileUpload label="Project Logo" currentUrl={logoUrl} onUpload={handleLogoUpload} projectId={project.id} />
          <FileUpload label="Favicon / Icon" currentUrl={iconUrl} onUpload={handleIconUpload} projectId={project.id} />
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Colors */}
      <section>
        <SectionHeader title="Colors" description="Core palette applied to backgrounds, text, borders, and interactive elements." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
          <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
          <ColorField label="Background" value={bgColor} onChange={setBgColor} />
          <ColorField label="Surface" value={surfaceColor} onChange={setSurfaceColor} />
          <ColorField label="Text" value={textColor} onChange={setTextColor} />
          <ColorField label="Text Secondary" value={textSecondaryColor} onChange={setTextSecondaryColor} />
          <ColorField label="Border" value={borderColor} onChange={setBorderColor} />
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Typography — Font Families */}
      <section>
        <SectionHeader title="Typography" description="Font families, sizes, weights, and line height for the type scale." />
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Font Families</p>
            <div className="grid grid-cols-3 gap-4">
              <TextField label="Heading" value={fontHeading} onChange={setFontHeading} />
              <TextField label="Body" value={fontBody} onChange={setFontBody} />
              <TextField label="Monospace" value={fontMono} onChange={setFontMono} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Type Scale</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
              <TextField label="sm" value={fontSizeSm} onChange={setFontSizeSm} mono />
              <TextField label="base" value={fontSizeBase} onChange={setFontSizeBase} mono />
              <TextField label="lg" value={fontSizeLg} onChange={setFontSizeLg} mono />
              <TextField label="xl" value={fontSizeXl} onChange={setFontSizeXl} mono />
              <TextField label="2xl" value={fontSize2xl} onChange={setFontSize2xl} mono />
              <TextField label="3xl" value={fontSize3xl} onChange={setFontSize3xl} mono />
              <TextField label="4xl" value={fontSize4xl} onChange={setFontSize4xl} mono />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Weights & Rhythm</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <TextField label="Normal" value={fontWeightNormal} onChange={setFontWeightNormal} mono />
              <TextField label="Medium" value={fontWeightMedium} onChange={setFontWeightMedium} mono />
              <TextField label="Bold" value={fontWeightBold} onChange={setFontWeightBold} mono />
              <TextField label="Line Height" value={lineHeight} onChange={setLineHeight} mono />
              <TextField label="Letter Spacing" value={letterSpacing} onChange={setLetterSpacing} mono />
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Layout */}
      <section>
        <SectionHeader title="Layout" description="Choose how the site is structured — navigation placement, behavior, and page dimensions." />
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Navigation Style</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { value: "top-nav", label: "Top Nav", desc: "Horizontal menu at the top" },
                { value: "sidebar", label: "Sidebar", desc: "Vertical menu on the left" },
                { value: "minimal", label: "Minimal", desc: "Hamburger menu, clean look" },
                { value: "centered", label: "Centered", desc: "Logo center, links split" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLayoutStyle(opt.value)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    layoutStyle === opt.value
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <LayoutThumb type={opt.value} active={layoutStyle === opt.value} />
                  <span className="block text-sm font-medium mt-2">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Navigation Behavior</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "sticky", label: "Sticky", desc: "Stays visible on scroll" },
                { value: "fixed", label: "Fixed", desc: "Always at the top" },
                { value: "static", label: "Static", desc: "Scrolls with the page" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNavPosition(opt.value)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    navPosition === opt.value
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Footer</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "standard", label: "Standard", desc: "Links, logo, copyright" },
                { value: "minimal", label: "Minimal", desc: "Copyright line only" },
                { value: "none", label: "None", desc: "No footer" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFooterStyle(opt.value)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    footerStyle === opt.value
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3">Dimensions</p>
            <div className="grid grid-cols-3 gap-4">
              <TextField label="Max Width" value={maxWidth} onChange={setMaxWidth} mono />
              <TextField label="Container Padding" value={containerPadding} onChange={setContainerPadding} mono />
              <TextField label="Section Gap" value={sectionGap} onChange={setSectionGap} mono />
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Spacing */}
      <section>
        <SectionHeader title="Spacing" description="Consistent spacing scale used for margins, padding, and gaps." />
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          <TextField label="xs" value={spacingXs} onChange={setSpacingXs} mono />
          <TextField label="sm" value={spacingSm} onChange={setSpacingSm} mono />
          <TextField label="md" value={spacingMd} onChange={setSpacingMd} mono />
          <TextField label="Base" value={spacingUnit} onChange={setSpacingUnit} mono />
          <TextField label="lg" value={spacingLg} onChange={setSpacingLg} mono />
          <TextField label="xl" value={spacingXl} onChange={setSpacingXl} mono />
          <TextField label="2xl" value={spacing2xl} onChange={setSpacing2xl} mono />
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Borders */}
      <section>
        <SectionHeader title="Borders" description="Border radii and widths for cards, buttons, inputs, and containers." />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <TextField label="sm" value={borderRadiusSm} onChange={setBorderRadiusSm} mono />
          <TextField label="Default" value={borderRadius} onChange={setBorderRadius} mono />
          <TextField label="lg" value={borderRadiusLg} onChange={setBorderRadiusLg} mono />
          <TextField label="Full" value={borderRadiusFull} onChange={setBorderRadiusFull} mono />
          <TextField label="Border Width" value={borderWidth} onChange={setBorderWidth} mono />
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Shadows */}
      <section>
        <SectionHeader title="Shadows" description="Elevation levels for cards, dropdowns, and modals." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TextField label="Small" value={shadowSm} onChange={setShadowSm} mono />
          <TextField label="Medium" value={shadowMd} onChange={setShadowMd} mono />
          <TextField label="Large" value={shadowLg} onChange={setShadowLg} mono />
        </div>
      </section>

      <hr className="border-slate-800" />

      {/* Effects */}
      <section>
        <SectionHeader title="Effects" description="Transitions and visual effects applied globally." />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Transition Speed" value={transitionSpeed} onChange={setTransitionSpeed} mono />
          <TextField label="Backdrop Blur" value={backdropBlur} onChange={setBackdropBlur} mono />
        </div>
      </section>

      {/* Save */}
      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-slate-950 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Brand"}
        </button>
      </div>
    </div>
  );
}

export default function ProjectBrandPage() {
  const { projectId } = useParams();
  const { project, loading, refresh } = useProject(projectId);

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
          <span className="text-slate-400 hover:text-white cursor-pointer">
            {project?.name || "..."}
          </span>
          <CaretRight className="text-slate-600" size={12} />
          <span className="text-white font-medium">Brand</span>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Brand</h1>
            <p className="text-sm text-slate-500 mt-1">
              Define the complete design system for your project — every generated page will follow these tokens.
            </p>
          </div>
          {project && <BrandContent project={project} refresh={refresh} />}
        </div>
      </div>
    </div>
  );
}
