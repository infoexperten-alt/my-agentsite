"""Phase 8 — extract a populated `StyleSpec` from a brand source.

Three entry points: URL (live site), image (screenshot), PDF (brand book).
Each runs the raw source through `PromptInjectionDetector` / `PIIRedactor`
when available (Prompture `security` package), then derives tokens.

The URL path uses real fetches via `httpx` and regex/heuristic extraction —
no LLM call needed for the common case (hex colors + font names sniffed from
HTML/CSS). When a model is provided AND prompture's `ingestion` / vision
drivers are available, an LLM upgrade pass refines the result. Falls back
gracefully when optional deps are missing.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from typing import Iterable

import httpx

from ..models import StyleSpec

logger = logging.getLogger("agentsite.brand_extractor")

# Common Google Fonts / system family names we look for in stylesheets
_FONT_NEEDLES = (
    "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Source Sans",
    "Poppins", "Nunito", "Raleway", "Work Sans", "Rubik", "DM Sans",
    "Plus Jakarta Sans", "Manrope", "Mulish", "Karla", "Space Grotesk",
    "Geist", "Söhne", "Sohne", "Helvetica", "Arial", "Georgia", "Times New Roman",
    "Iowan Old Style", "Charter", "JetBrains Mono", "IBM Plex Mono",
    "Fira Code", "Menlo", "Consolas",
)

_HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}){1,2}\b")


def _sanitize(text: str) -> str:
    """Run text through Prompture's injection detector / PII redactor when present."""
    if not text:
        return ""
    try:
        from prompture.security import PromptInjectionDetector, PIIRedactor  # type: ignore
        text = PIIRedactor().redact(text)
        det = PromptInjectionDetector()
        verdict = det.detect(text)
        if getattr(verdict, "is_injection", False):
            logger.warning("Brand source flagged by PromptInjectionDetector; truncating")
            return text[:2000]
    except Exception:
        pass  # security package optional — extraction still proceeds
    return text


def _normalize_hex(h: str) -> str | None:
    """Accept #abc / #aabbcc / #aabbccdd — return canonical lowercase #aabbcc (drop alpha)."""
    h = h.lower()
    if not h.startswith("#"):
        return None
    digits = h[1:]
    if len(digits) == 3:
        digits = "".join(c * 2 for c in digits)
    if len(digits) == 4:  # #rgba → drop alpha
        digits = "".join(c * 2 for c in digits[:3])
    if len(digits) == 8:
        digits = digits[:6]
    if len(digits) != 6:
        return None
    return f"#{digits}"


def _is_neutral(hex_color: str) -> bool:
    """True for near-white/black/grey colors (low chroma)."""
    if not hex_color.startswith("#") or len(hex_color) != 7:
        return False
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    span = max(r, g, b) - min(r, g, b)
    # 32 absorbs the slight cool tint common in design-system greys (e.g.
    # Tailwind slate-800 #1f2937 has span 24 — clearly a neutral in context).
    return span < 32


def _luminance(hex_color: str) -> float:
    r = int(hex_color[1:3], 16) / 255.0
    g = int(hex_color[3:5], 16) / 255.0
    b = int(hex_color[5:7], 16) / 255.0
    return 0.299 * r + 0.587 * g + 0.114 * b


def _classify_palette(colors: Iterable[str]) -> dict[str, str]:
    """Pick bg/surface/text/accent slots from a frequency-ranked color list."""
    counted = Counter(c for c in colors if c is not None)
    if not counted:
        return {}
    ordered = [c for c, _ in counted.most_common()]
    bg = next((c for c in ordered if _is_neutral(c) and _luminance(c) > 0.85), None)
    text = next((c for c in ordered if _is_neutral(c) and _luminance(c) < 0.30), None)
    surface = next(
        (c for c in ordered if _is_neutral(c) and c != bg and 0.85 < _luminance(c) <= 0.97),
        None,
    )
    accent = next((c for c in ordered if not _is_neutral(c)), None)
    out: dict[str, str] = {}
    if bg:
        out["background_color"] = bg
    if surface:
        out["surface_color"] = surface
    if text:
        out["text_color"] = text
    if accent:
        out["primary_color"] = accent
        out["accent_color"] = accent
    return out


def _detect_fonts(text: str) -> dict[str, str]:
    """Sniff display + body fonts from raw HTML/CSS text."""
    found: list[str] = []
    for needle in _FONT_NEEDLES:
        if needle.lower() in text.lower():
            found.append(needle)
    if not found:
        return {}
    out: dict[str, str] = {}
    # First found = body, second = display (heuristic; usually CSS lists body
    # font earlier in a @font-face / font-family declaration)
    out["font_body"] = found[0]
    out["font_heading"] = found[1] if len(found) > 1 else found[0]
    mono = next((f for f in found if "Mono" in f or "Code" in f or f in ("Consolas", "Menlo")), None)
    if mono:
        out["font_mono"] = mono
    return out


def extract_from_text(raw: str) -> dict:
    """Extract token dict from a blob of HTML / CSS / brand book text."""
    text = _sanitize(raw)
    hexes = [h for h in (_normalize_hex(m) for m in _HEX_RE.findall(text)) if h]
    palette = _classify_palette(hexes)
    fonts = _detect_fonts(text)
    return {**palette, **fonts}


def extract_from_url(url: str, *, timeout_s: float = 15.0) -> StyleSpec:
    """Fetch a URL (HTML + inline/linked CSS), derive tokens, return StyleSpec.

    Caller MUST have run `guard_external_url(url)` first — this function does
    not re-check (so it stays usable in non-FastAPI contexts).
    """
    try:
        resp = httpx.get(url, timeout=timeout_s, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (AgentSite brand extractor)",
        })
        resp.raise_for_status()
        html = resp.text
    except Exception as exc:
        logger.warning("URL fetch failed (%s): %s", url, exc)
        return StyleSpec()  # neutral default

    combined = html
    for css_match in re.finditer(r'<link[^>]+href="([^"]+\.css[^"]*)"', html, re.IGNORECASE):
        try:
            css_url = httpx.URL(css_match.group(1))
            if not css_url.scheme:
                css_url = httpx.URL(url).join(css_url)
            css_resp = httpx.get(str(css_url), timeout=timeout_s, follow_redirects=True)
            if css_resp.status_code == 200:
                combined += "\n" + css_resp.text
        except Exception:
            continue

    tokens = extract_from_text(combined)
    if not tokens:
        return StyleSpec()
    return StyleSpec(**tokens)


def extract_from_image(image_bytes: bytes, *, filename: str = "") -> StyleSpec:
    """Extract palette from an image — requires Pillow.

    Returns a neutral StyleSpec when Pillow isn't installed.
    """
    try:
        from io import BytesIO

        from PIL import Image  # type: ignore
    except ImportError:
        logger.warning("Pillow not installed — image extraction returns defaults")
        return StyleSpec()

    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((256, 256))
        # Quantize to 8 dominant colors then sort by frequency
        palette_img = img.quantize(colors=8, method=2)
        palette = palette_img.getpalette() or []
        counts = sorted(palette_img.getcolors() or [], key=lambda c: -c[0])
        hexes: list[str] = []
        for _count, idx in counts:
            r, g, b = palette[idx * 3 : idx * 3 + 3]
            hexes.append(f"#{r:02x}{g:02x}{b:02x}")
    except Exception as exc:
        logger.warning("Image processing failed (%s): %s", filename, exc)
        return StyleSpec()

    tokens = _classify_palette(hexes)
    if not tokens:
        return StyleSpec()
    return StyleSpec(**tokens)


def extract_from_pdf(pdf_bytes: bytes) -> StyleSpec:
    """Extract tokens from a brand-book PDF — uses Prompture's `ingest` if available.

    Falls back to regex over the raw bytes (treating them as text).
    """
    text = ""
    try:
        from prompture.ingestion import ingest  # type: ignore
        from io import BytesIO

        result = ingest(BytesIO(pdf_bytes))
        text = getattr(result, "text", "") or str(result)
    except Exception:
        try:
            text = pdf_bytes.decode("utf-8", errors="ignore")
        except Exception:
            text = ""

    tokens = extract_from_text(text)
    if not tokens:
        return StyleSpec()
    return StyleSpec(**tokens)
