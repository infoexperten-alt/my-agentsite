import { randomUUID } from 'crypto';
import { spawn, execSync } from 'child_process';
import { NextRequest } from 'next/server';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises';
import { existsSync, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { PROJECTS_DIR, STAGING_DIR, REVISIONS_DIR } from '../paths';

const MAX_ARTIFACT_FILES = 300;
const MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const MAX_REMOTE_IMAGE_BYTES = 4 * 1024 * 1024;
// Asset normalization must not hold the artifact commit for minutes when a
// model returns a dead or unreachable image URL. Healthy remote assets still
// use the normal path; failures fall back to a local generated SVG quickly.
const REMOTE_IMAGE_TIMEOUT_MS = 10_000;
const REMOTE_PROXY_TIMEOUT_MS = 7_000;
const IMAGE_GENERATION_TIMEOUT_MS = 45_000;
const GENERATED_IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;
const TEXT_FILE_PATTERN = /\.(?:html?|css|scss|sass|less|[cm]?[jt]sx?|json|md)$/i;
const REMOTE_URL_PATTERN = /https?:\/\/[^\s\"'`()<>]+/gi;
const IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)/i;
const IMAGE_SERVICE_PATTERN = /(?:picsum\.photos|via\.placeholder\.com|placehold\.co|images\.unsplash\.com|source\.unsplash\.com)/i;
const STABLE_ARCHITECTURE_IMAGES = [
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=85',
];
const STABLE_FURNITURE_IMAGES = [
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85',
];
const STABLE_PORTRAIT_IMAGES = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=800&q=85',
];
const STABLE_HEADPHONE_IMAGES = [
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?auto=format&fit=crop&w=1200&q=85',
];
const STABLE_SHOE_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=85',
];
const STABLE_AUTOPARTS_IMAGES = [
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=85',
];
const STABLE_SOAP_IMAGES = [
  'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1584305574647-0cc949a2bb9f?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1200&q=85',
];

const STABLE_GROCERY_IMAGES = [
  'https://images.unsplash.com/photo-1468577760773-139c2f1c335f?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=1200&q=85',
  'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=85',
];
const STABLE_POTTERY_IMAGES = [
  'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1400&q=88',
  'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1400&q=88',
  'https://images.unsplash.com/photo-1493106819501-66d381c466f1?auto=format&fit=crop&w=1400&q=88',
  'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=1400&q=88',
  'https://images.unsplash.com/photo-1565193298357-c5b5b3f2c5e6?auto=format&fit=crop&w=1400&q=88',
];

type ImageTheme = 'landscape' | 'headphone' | 'shoe' | 'auto' | 'soap' | 'dental' | 'furniture' | 'architecture' | 'grocery' | 'pottery';

const IMAGE_THEME_PATTERNS: Array<[ImageTheme, RegExp]> = [
  ['landscape', /(\u043b\u0430\u043d\u0434\u0448\u0430\u0444\u0442|\u043e\u0437\u0435\u043b\u0435\u043d|\u0441\u0430\u0434|\u043f\u0430\u0440\u043a|landscape|garden|park\b|outdoor)/i],
  ['headphone', /(наушник|гарнитур|аудио|звук|headphone|headset|earbud|audio|sound)/i],
  ['shoe', /(обув|туфл|ботин|кроссов|босонож|shoe|footwear|sneaker|boot|heel)/i],
  ['auto', /(автозапчаст|запчаст|автомобил|детал|vin|autopart|car|vehicle|brake|filter|engine)/i],
  ['grocery', /(\bмед(?:а|у|е|ом|овый|овая|овое|овые|ов)?\b|\bмёд\b|варень|джем|конфитюр|мармелад|ягод|пасек|пчел|пчёл|сладост|натуральн|фермер|grocery|honey|jam|jelly|marmalade|preserve|confiture|berry|apiary|sweet pantry)/i],
  ['soap', /(мыл|космет|уход|натурал|soap|cosmetic|skincare|beauty|bath|wellness|lavender|лаванд|мед|овес|oat|honey)/i],
  ['dental', /(стомат|зуб|ортодонт|имплант|dent|tooth|orthodont|implant)/i],
  ['pottery', /(керамик|гончар|глин|ваз|чаш|тарел|посуд|pottery|ceramic|clay|ceramist|wheel\s?throw|stoneware|tableware)/i],
  ['furniture', /(мебел|диван|кресл|стул|декор|furniture|sofa|chair|decor)/i],
  ['architecture', /(архитект|дизайн|интерьер|недвиж|architecture|architect|real\s?estate|property)/i],
];

function detectImageTheme(themeText: string, context = ''): ImageTheme | null {
  const text = `${themeText} ${context}`
    .replace(/https?:\/\/[^\s\"'`()<>]+/gi, ' ')
    .replace(/(?:[\w-]+\.)?(?:avif|gif|jpe?g|png|svg|webp)\b/gi, ' ')
    .replace(/[\/\\._-]+/g, ' ')
    .toLowerCase();
  return IMAGE_THEME_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function selectStableImage(themeText: string, context: string, index: number) {
  const theme = detectImageTheme(themeText, context);
  if (!theme) return null;
  if (theme === 'headphone') return STABLE_HEADPHONE_IMAGES[(index - 1) % STABLE_HEADPHONE_IMAGES.length];
  if (theme === 'shoe') return STABLE_SHOE_IMAGES[(index - 1) % STABLE_SHOE_IMAGES.length];
  if (theme === 'auto') return STABLE_AUTOPARTS_IMAGES[(index - 1) % STABLE_AUTOPARTS_IMAGES.length];
  if (theme === 'grocery') return STABLE_GROCERY_IMAGES[(index - 1) % STABLE_GROCERY_IMAGES.length];
  if (theme === 'soap') return STABLE_SOAP_IMAGES[(index - 1) % STABLE_SOAP_IMAGES.length];
  if (theme === 'furniture') return STABLE_FURNITURE_IMAGES[(index - 1) % STABLE_FURNITURE_IMAGES.length];
  if (theme === 'architecture') return STABLE_ARCHITECTURE_IMAGES[(index - 1) % STABLE_ARCHITECTURE_IMAGES.length];
  if (theme === 'pottery') return STABLE_POTTERY_IMAGES[(index - 1) % STABLE_POTTERY_IMAGES.length];
  return null;
}

function isLogoContext(context: string) {
  return /(logo|логотип|brand|бренд|эмблем|wordmark)/i.test(context);
}

function logoSvg(context = '') {
  const title = context.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    || context.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]
    || 'Новый бренд';
  const brand = title.replace(/&[^;]+;/g, ' ').split(/[—|]/, 1)[0].replace(/[^a-zA-Zа-яА-ЯёЁ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Новый бренд';
  const initials = brand.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const hue = [...brand].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 72" role="img" aria-label="${brand}"><rect width="72" height="72" rx="20" fill="hsl(${hue} 42% 20%)"/><text x="36" y="46" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#fff">${initials}</text><text x="92" y="44" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="currentColor">${brand}</text></svg>`;
}

function stableImageSource(url: string, _index: number, _context: string) {
  return url.replace(/&amp;/g, '&').replace(/[\\]+$/g, '');
}

function normalizeRepeatedRemoteImageReferences(content: string) {
  const seen = new Map<string, number>();
  return content.replace(/(<img\b[^>]*\bsrc=["'])(https?:\/\/[^"']+)(["'][^>]*>)/gi, (_match, prefix, source, suffix) => {
    const normalized = String(source).trim();
    const count = seen.get(normalized) || 0;
    seen.set(normalized, count + 1);
    if (count === 0) return _match;
    const separator = normalized.includes('?') ? '&' : '?';
    return `${prefix}${normalized}${separator}wedevVariant=${count + 1}${suffix}`;
  });
}

function knownImageTheme(url: string): ImageTheme | null {
  const normalized = url.replace(/&amp;/g, '&');
  if (STABLE_HEADPHONE_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'headphone';
  if (STABLE_SHOE_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'shoe';
  if (STABLE_AUTOPARTS_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'auto';
  if (STABLE_GROCERY_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'grocery';
  if (STABLE_SOAP_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'soap';
  if (STABLE_FURNITURE_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'furniture';
  if (STABLE_ARCHITECTURE_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'architecture';
  if (STABLE_POTTERY_IMAGES.some((item) => normalized.includes(item.split('?')[0]))) return 'pottery';
  return null;
}

function imageNeedsRegeneration(url: string, context: string) {
  const expected = detectImageTheme(context);
  const known = knownImageTheme(url);
  if (!expected || !known) return false;
  if (expected === 'landscape') return known === 'furniture' || known === 'headphone' || known === 'shoe' || known === 'auto' || known === 'soap' || known === 'grocery';
  return expected !== known;
}

function normalizeArtifactContent(content: string, filePath = "") {
  let value = content.replace(/^\uFEFF/, '').trimStart();
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed.content === 'string') value = parsed.content;
  } catch {}
  value = value.replace(/^\uFEFF/, '').trimStart();
  if (/\.(?:html?|svg)$/i.test(filePath)) {
    value = value.replace(/^```(?:html|xml|svg)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  const wrappedCdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  if (wrappedCdata) return wrappedCdata[1].replace(/^\uFEFF/, '').trimStart();
  if (/^<!\[CDATA\[/i.test(value)) value = value.replace(/^<!\[CDATA\[/i, '');
  if (/\]\]>\s*$/i.test(value)) value = value.replace(/\]\]>\s*$/i, '');
  if (/\.(?:html?|svg)$/i.test(filePath) && /\\n|\\"/.test(value)) {
    value = value
      .replace(/\\r?\\n/g, '\n')
      .replace(/\\"/g, '\"')
      .replace(/\\\\'/g, "'");
  }
  // Model JSON responses can escape URL slashes. Decode them before asset
  // discovery so https:// images are materialized instead of rejected later.
  value = value
    .split('https:\\/\\/').join('https://')
    .split('http:\\/\\/').join('http://');
  return value;
}

const runningProcesses = new Map<string, any>();

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidProjectId(projectId: unknown): projectId is string {
  return typeof projectId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,80}$/.test(projectId);
}

function resolveInside(root: string, relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const target = resolve(root, normalized);
  const resolvedRoot = resolve(root);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Unsafe project path: ${relativePath}`);
  }
  return target;
}

function killPreviewServers() {
  const command = "for pid in $(ss -ltnp 2>/dev/null | grep -E ':(517[4-9]|51[89][0-9]|52[0-9][0-9])' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); do kill -9 $pid 2>/dev/null; done; true";
  try { execSync(command, { timeout: 5000 }); } catch {}
}

async function ensureProjectDir(projectId: string) {
  const directory = join(PROJECTS_DIR(), projectId);
  if (!existsSync(directory)) await mkdir(directory, { recursive: true });
  return directory;
}

async function collectFiles(directory: string, prefix = ''): Promise<Array<{ path: string; size: number }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: Array<{ path: string; size: number }> = [];
  for (const entry of entries) {
    if (['node_modules', 'dist', '.next', '.git'].includes(entry.name)) continue;
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath, relativePath));
    else if (entry.isFile()) files.push({ path: relativePath, size: (await stat(fullPath)).size });
  }
  return files;
}

function contextualArtworkSvg(context: string, index: number) {
  const clean = context.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  const hash = [...clean].reduce((sum, character, position) => sum + character.charCodeAt(0) * (position + 1), index * 97);
  const hue = Math.abs(hash) % 360;
  const secondHue = (hue + 42 + index * 11) % 360;
  const angle = Math.abs(hash % 360);
  const scale = 0.82 + (Math.abs(hash) % 18) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100" role="img" aria-label="?????????? ?????????? ?????????? ${index}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)"><stop stop-color="hsl(${hue} 34% 13%)"/><stop offset=".52" stop-color="hsl(${secondHue} 42% 27%)"/><stop offset="1" stop-color="hsl(${(secondHue + 65) % 360} 48% 9%)"/></linearGradient><radialGradient id="glow"><stop stop-color="hsl(${(hue + 18) % 360} 90% 76%)" stop-opacity=".8"/><stop offset="1" stop-color="hsl(${hue} 70% 48%)" stop-opacity="0"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="34"/></filter></defs><rect width="1600" height="1100" fill="url(#bg)"/><ellipse cx="1220" cy="240" rx="360" ry="250" fill="url(#glow)" filter="url(#blur)" opacity=".8"/><path d="M-80 910 C 260 610, 470 1080, 820 760 S 1360 560, 1730 850" fill="none" stroke="hsl(${(hue + 35) % 360} 70% 82%)" stroke-opacity=".28" stroke-width="18"/><circle cx="420" cy="310" r="${Math.round(220 * scale)}" fill="none" stroke="hsl(${secondHue} 72% 82%)" stroke-opacity=".26" stroke-width="3"/><circle cx="420" cy="310" r="${Math.round(120 * scale)}" fill="hsl(${secondHue} 72% 82%)" fill-opacity=".08"/><g fill="none" stroke="hsl(${(secondHue + 20) % 360} 70% 88%)" stroke-opacity=".18" stroke-width="2"><path d="M120 150h340M120 182h210M1180 820h260M1180 852h180"/></g></svg>`;
}

function fallbackArtworkBuffer(context: string, index: number) {
  return Buffer.from(contextualArtworkSvg(context, index), 'utf8');
}


function imageExtension(contentType: string | null) {
  if (contentType?.includes('svg')) return 'svg';
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('avif')) return 'avif';
  return 'jpg';
}

async function generateUniqueImage(context: string, index: number) {
  const apiUrl = (process.env.THIRD_API_URL || 'http://127.0.0.1:3001/v1').replace(/\/$/, '');
  const apiKey = process.env.THIRD_API_KEY || '';
  if (!apiKey) throw new Error('Image generation API key is not configured');
  const cleanContext = context.replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1400);
  const prompt = `Создай уникальное премиальное изображение для живого сайта. Кадр ${index}. Контекст: ${cleanContext}. Фотореалистичная редакционная съемка, осмысленная композиция, без текста, водяных знаков, логотипов и случайных объектов.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_GENERATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl}/images/generations`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'auto', prompt, n: 1, size: '1024x1024' }),
    });
    const result = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new Error(result?.error?.message || `image generation ${response.status}`);
    const image = result?.data?.[0];
    if (typeof image?.b64_json === 'string' && image.b64_json) return Buffer.from(image.b64_json, 'base64');
    if (typeof image?.url === 'string' && image.url) {
      const generated = await fetch(image.url, {
        signal: AbortSignal.timeout(GENERATED_IMAGE_DOWNLOAD_TIMEOUT_MS),
        redirect: 'follow',
        headers: { 'User-Agent': 'De0AssetBot/2.0', Accept: 'image/*' },
      });
      if (!generated.ok) throw new Error(`generated image download ${generated.status}`);
      const bytes = Buffer.from(await generated.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_REMOTE_IMAGE_BYTES) throw new Error('generated image is empty or too large');
      return bytes;
    }
    throw new Error('image provider returned no image');
  } finally {
    clearTimeout(timeout);
  }
}

async function generateOrArtwork(context: string, index: number) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return { bytes: await generateUniqueImage(`${context} Unique visual variant ${attempt}.`, index + attempt - 1), extension: 'jpg' };
    } catch {
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1800));
    }
  }
  return { bytes: fallbackArtworkBuffer(context, index), extension: 'svg' };
}

async function materializeRemoteImages(directory: string) {
  const files = await collectFiles(directory);
  const textFiles = files.filter((file) => TEXT_FILE_PATTERN.test(file.path));
  const documents = await Promise.all(textFiles.map(async (file) => ({
    file,
    content: normalizeRepeatedRemoteImageReferences(await readFile(join(directory, file.path), 'utf8')),
  })));
  const themeText = documents.map((document) => document.content).join(' ');
  const contexts = new Map<string, string>();
  for (const document of documents) {
    const urls = [...new Set(document.content.match(REMOTE_URL_PATTERN) || [])]
      .filter((url) => IMAGE_URL_PATTERN.test(url) || IMAGE_SERVICE_PATTERN.test(url));
    for (const url of urls) {
      if (contexts.has(url)) continue;
      const position = document.content.indexOf(url);
      const contextStart = Math.max(0, position - 500);
      contexts.set(url, document.content.slice(contextStart, Math.min(document.content.length, position + url.length + 1000)));
    }
  }

  const urls = [...contexts.keys()];
  if (urls.length === 0) return;
  await mkdir(join(directory, 'public', 'wedev-assets'), { recursive: true });
  const replacements = new Map<string, string>();
  let cursor = 0;

  const materialize = async (url: string, assetIndex: number) => {
    const imageContext = contexts.get(url) || url;
    // Preserve the model-selected source. Replacing it with a shared themed
    // stock list makes every client receive the same visual content.
    const sourceUrl = stableImageSource(url, assetIndex, imageContext);
    const forceGeneration = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT_MS);
    let localPath = '';
    try {
      if (forceGeneration) throw new Error('Known image theme does not match page context');
      const response = await fetch(sourceUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; De0AssetBot/2.0)', Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
      });
      const contentType = response.headers.get('content-type');
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (!response.ok || !contentType?.startsWith('image/') || contentLength > MAX_REMOTE_IMAGE_BYTES) throw new Error(`Remote image rejected (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_REMOTE_IMAGE_BYTES) throw new Error('Remote image is empty or too large');
      localPath = `wedev-assets/image-${assetIndex}.${imageExtension(contentType)}`;
      await writeFile(join(directory, 'public', localPath), bytes);
    } catch {
      const stableSource = selectStableImage(themeText, imageContext, assetIndex);
      localPath = `wedev-assets/image-${assetIndex}.jpg`;
      try {
        if (forceGeneration) throw new Error('Skip proxy for semantically mismatched image');
        const proxySource = stableSource || sourceUrl;
        const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(proxySource)}&output=jpg&q=88`;
        const proxied = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(REMOTE_PROXY_TIMEOUT_MS),
          redirect: 'follow',
          headers: { 'User-Agent': 'De0AssetBot/2.0', Accept: 'image/*' },
        });
        if (!proxied.ok) throw new Error(`media proxy ${proxied.status}`);
        const proxiedBytes = Buffer.from(await proxied.arrayBuffer());
        if (!proxiedBytes.length || proxiedBytes.length > MAX_REMOTE_IMAGE_BYTES) throw new Error('proxied image is empty or too large');
        await writeFile(join(directory, 'public', localPath), proxiedBytes);
      } catch {
        const artwork = await generateOrArtwork(`${themeText.slice(0, 1800)} ${imageContext}`, assetIndex);
        localPath = `wedev-assets/image-${assetIndex}.${artwork.extension}`;
        await writeFile(join(directory, 'public', localPath), artwork.bytes);
      }
    } finally {
      clearTimeout(timeout);
    }
    replacements.set(url, localPath);
  };

  const workers = Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      await materialize(urls[index], index + 1);
    }
  });
  await Promise.all(workers);

  await Promise.all(documents.map(async ({ file, content }) => {
    let updated = content;
    for (const [url, localPath] of replacements) updated = updated.split(url).join(localPath);
    if (updated !== content) await writeFile(join(directory, file.path), updated, 'utf8');
  }));
}


async function materializeMissingLocalAssets(directory: string) {
  const files = await collectFiles(directory);
  const existing = new Set(files.map((file) => file.path.replace(/\\/g, '/').toLowerCase()));
  const replacements = new Map<string, string>();
  let assetIndex = 0;
  const themeText = (await Promise.all(files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path)).map((entry) => readFile(join(directory, entry.path), 'utf8').catch(() => '')))).join(' ');
  await mkdir(join(directory, 'public', 'wedev-assets'), { recursive: true });
  await writeFile(join(directory, 'public', 'wedev-assets', 'logo.svg'), logoSvg(themeText), 'utf8');
  const referencePattern = /(?:src|href|poster|srcset)\s*=\s*(["'])([^"']+)\1|url\(\s*(["']?)([^"')]+)\3\s*\)/gi;
  for (const file of files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path))) {
    const fullPath = join(directory, file.path);
    const original = await readFile(fullPath, 'utf8');
    let updated = original;
    for (const match of original.matchAll(referencePattern)) {
      const rawReference = String(match[2] || match[4] || '').trim();
      const references = /\bsrcset\s*=\s*/i.test(match[0])
        ? rawReference.split(',').map((entry) => entry.trim().split(/\s+/, 1)[0]).filter(Boolean)
        : [rawReference];
      for (const reference of references) {
        if (!reference || /^(?:https?:|data:|blob:|#|\/\/|\/?wedev-assets\/)/i.test(reference)) continue;
        if (!/\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(reference)) continue;
        const normalized = reference.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
        const relativeDirectory = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) + '/' : '';
        const candidate = `${relativeDirectory}${normalized}`.replace(/^\.\//, '').toLowerCase();
        if (existing.has(normalized) || existing.has(candidate)) continue;
        const contextStart = Math.max(0, original.indexOf(reference) - 260);
        const context = original.slice(contextStart, Math.min(original.length, contextStart + reference.length + 260));
        let localPath = replacements.get(reference);
        if (!localPath) {
          assetIndex += 1;
          if (isLogoContext(context)) {
            localPath = 'wedev-assets/logo.svg';
            replacements.set(reference, localPath);
            updated = updated.split(reference).join(localPath);
            continue;
          }
          const artwork = await generateOrArtwork(`${themeText.slice(0, 900)} ${context}`, assetIndex);
          localPath = `wedev-assets/recovered-${assetIndex}.${artwork.extension}`;
          const target = join(directory, 'public', localPath);
          await mkdir(resolve(target, '..'), { recursive: true });
          await writeFile(target, artwork.bytes);
          replacements.set(reference, localPath);
        }
        updated = updated.split(reference).join(localPath);
      }
    }
    updated = updated.replace(/<source\b[^>]*>/gi, (tag) => /srcset=[\"']\/?wedev-assets\/[^\"']+\.(?:jpe?g|png|gif)(?:[?#][^\"']*)?[\"']/i.test(tag)
      ? tag.replace(/type=[\"']image\/(?:avif|webp)[\"']/i, 'type=\"image/jpeg\"')
      : tag);
    updated = updated.replace(/<img\b[^>]*>/gi, (tag) => /src=[\"']\/?wedev-assets\//i.test(tag)
      ? tag.replace(/loading=[\"']lazy[\"']/i, 'loading=\"eager\"')
      : tag);
    if (updated !== original) await writeFile(fullPath, updated, 'utf8');
  }
}

async function repairArtifactEntrypoint(directory: string) {
  const entries = await collectFiles(directory);
  const normalizedPaths = new Set(entries.map((file) => file.path.toLowerCase()));
  if (normalizedPaths.has('index.html')) return;

  const htmlCandidate = entries.find((file) => /(?:^|\/)index\.htm$|\.html$/i.test(file.path));
  if (htmlCandidate) {
    const source = join(directory, htmlCandidate.path);
    await cp(source, join(directory, 'index.html'));
    return;
  }

  const appCandidate = entries.find((file) => /^app\.[cm]?[jt]sx?$/i.test(file.path) || /^src\/app\.[cm]?[jt]sx?$/i.test(file.path));
  if (!appCandidate) return;

  const extension = appCandidate.path.match(/\.([cm]?[jt]sx?)$/i)?.[1] || 'tsx';
  const sourcePath = appCandidate.path.replace(/\\/g, '/');
  const mainPath = `src/main.${extension}`;
  const reactEntry = extension.endsWith('x') || /react/i.test(await readFile(join(directory, 'package.json'), 'utf8').catch(() => ''));
  if (!reactEntry) return;

  await mkdir(join(directory, 'src'), { recursive: true });
  await writeFile(join(directory, 'index.html'), `<!doctype html>\n<html lang="ru">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Проект</title></head>\n<body><div id="root"></div><script type="module" src="/${mainPath}"></script></body>\n</html>\n`, 'utf8');
  await writeFile(join(directory, 'src', 'index.css'), '', 'utf8');
  await writeFile(join(directory, mainPath), `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from '${sourcePath.startsWith('src/') ? './' + sourcePath.slice(4).replace(/\.[^.]+$/, '') : '../' + sourcePath.replace(/\.[^.]+$/, '')}';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);\n`, 'utf8');
}

async function repairMissingReferencedFiles(directory: string) {
  const files = await collectFiles(directory);
  const existing = new Set(files.map((file) => file.path.toLowerCase()));
  const references = /<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi;
  for (const file of files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path))) {
    const content = await readFile(join(directory, file.path), 'utf8');
    for (const match of content.matchAll(references)) {
      const reference = match[1].split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '');
      if (!reference || /^(?:[a-z]+:|\/\/|#|data:|@)/i.test(reference)) continue;
      if (!/\.(?:css|scss|sass|less|js|mjs|cjs|ts|jsx|tsx)$/i.test(reference)) continue;
      const normalized = reference.toLowerCase();
      if (existing.has(normalized)) continue;
      const target = resolveInside(directory, reference);
      await mkdir(resolve(target, '..'), { recursive: true });
      const extension = reference.split('.').pop()?.toLowerCase();
      const placeholder = /^(?:css|scss|sass|less)$/.test(extension || '')
        ? '/* Generated empty asset: the artifact referenced this file but did not provide it. */\n'
        : '// Generated empty asset: the artifact referenced this file but did not provide it.\n';
      await writeFile(target, placeholder, 'utf8');
      existing.add(normalized);
    }
  }
}

async function sanitizeGeneratedUi(directory: string) {
  const files = await collectFiles(directory);
  const assetFiles = files
    .filter((file) => /^public\/wedev-assets\/image-\d+\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(file.path))
    .map((file) => '/' + file.path.slice('public/'.length));
  const imagePattern = /https?:\/\/images\.unsplash\.com\/[^\s"'\x60()<>]+/gi;
  for (const file of files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path))) {
    const fullPath = join(directory, file.path);
    const original = await readFile(fullPath, 'utf8');
    let updated = original
      .replace(/<script\b[^>]*src=["'][^"']*kit\.fontawesome\.com\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
      .replace(/https:\/\/www\.google\.com\/maps\/embed\?pb=!1m18[^"']*/gi, 'about:blank')
      .replace(/<path d="M12 0C5\.37[\s\S]*?" fill="currentColor"\/>/i, '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" fill="currentColor"/>')
      .replace(/<link\b[^>]*href=["'][^"']*font-awesome[^"']*["'][^>]*>/gi, '')
      .replace(/<i\b([^>]*class=["'][^"']*(?:fa-|fas\b|far\b|fab\b|service-icon)[^"']*["'][^>]*)><\/i>/gi, (_match, attrs) => '<span' + attrs + ' aria-hidden="true">✦</span>')
      .replace(/href\s*=\s*(["'])#\1/gi, 'href="#contact"')
      .replace(/https?:\/\/kit\.fontawesome\.com\/yourkitid\.js/gi, '')
      .replace(imagePattern, (url) => {
        throw new Error(`External image remained after asset normalization: ${url}`);
      });
    if (/\.html?$/i.test(file.path)) {
      updated = updated
        .replace(/^\s*```(?:html)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .replace(/href="#"/gi, 'href="#contact"')
        .replace(/href='#'/gi, "href='#contact'")
        .replace(/(?:\u00a9|&copy;)\s*20\d{2}/gi, `\u00a9 ${new Date().getFullYear()}`);
      if (!/<link\b[^>]*rel=["'](?:shortcut )?icon["']/i.test(updated)) {
        const favicon = '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"%3E%3Crect width=\"64\" height=\"64\" rx=\"16\" fill=\"%2319231d\"/%3E%3Cpath d=\"M18 44 32 16l14 28h-8l-3-7H29l-3 7z\" fill=\"%23d4af37\"/%3E%3C/svg%3E">';
        updated = /<head\b[^>]*>/i.test(updated) ? updated.replace(/<head\b[^>]*>/i, (head) => `${head}${favicon}`) : favicon + updated;
      }
      updated = updated.replace(/<button\b([^>]*\bbtn-add\b[^>]*)>/gi, (_match, attrs) => /\baria-label=/i.test(attrs) ? _match : `<button${attrs} aria-label="Добавить в корзину">`);
      let unnamedIndex = 0;
      updated = updated.replace(/<button\b([^>]*)>(\s*<svg\b[\s\S]*?<\/svg>\s*)<\/button>/gi, (_match, attrs, icon) => {
        if (/\b(?:aria-label|title)\s*=\s*["'][^"']+["']/i.test(attrs)) return _match;
        unnamedIndex += 1;
        const label = /(?:cart|basket)/i.test(attrs + icon) ? 'Открыть корзину' : `Действие ${unnamedIndex}`;
        return `<button${attrs} aria-label="${label}">${icon}</button>`;
      });
    }
    if (/\.html?$/i.test(file.path)) {
      const style = '<style>html,body{overflow-x:hidden;max-width:100%}body{overflow-wrap:break-word;word-break:normal}main,section,header,footer,nav,div,article,aside{min-width:0}img,video,iframe{max-width:100%;height:auto}@media(max-width:768px){.hero-content,.banner-content,.masthead-content{width:calc(100% - 32px)!important;max-width:calc(100% - 32px)!important;margin-left:16px!important;margin-right:16px!important}header nav,.navlinks,[role="navigation"]{display:flex!important;flex-wrap:wrap!important;gap:10px!important;align-items:center!important;justify-content:center!important}header nav a,.navlinks a,[role="navigation"] a{white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important;font-size:clamp(11px,3vw,14px)!important}header nav img,.nav img{width:auto!important;max-width:120px!important;max-height:42px!important}}</style>';
      updated = /<\/head>/i.test(updated) && !updated.includes('overflow-x:hidden;max-width:100%')
        ? updated.replace(/<\/head>/i, style + '</head>')
        : updated;
    } else if (/\.css$/i.test(file.path) && !updated.includes('overflow-x:hidden')) {
      updated += '\nhtml,body{overflow-x:hidden;max-width:100%}\nimg,video,iframe{max-width:100%}\n';
    }
    if (updated !== original) await writeFile(fullPath, updated, 'utf8');
  }
}

async function normalizeExternalAssets(directory: string) {
  const files = await collectFiles(directory);
  const replacements = new Map<string, string>();
  const themeText = (await Promise.all(files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path)).map((entry) => readFile(join(directory, entry.path), 'utf8').catch(() => '')))).join(' ');
  let assetIndex = 0;
  for (const file of files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path))) {
    const fullPath = join(directory, file.path);
    const original = await readFile(fullPath, 'utf8');
    const urls = [...new Set(original.match(/https?:\/\/[^\s"'`()<>]+/gi) || [])]
      .map((url) => url.replace(/[),.;]+$/g, ''))
      .filter((url) => IMAGE_URL_PATTERN.test(url) || /(?:images?\.|randomuser\.me|unsplash\.com|picsum\.photos|placehold\.)/i.test(url));
    let updated = original
      .replace(/href\s*=\s*(['"])#\1/gi, 'href="#contact"')
      .replace(/href\s*=\s*(['"])javascript:void\(0\);?\1/gi, 'href="#contact"');
    for (const url of urls) {
      let localPath = replacements.get(url);
      if (!localPath) {
        assetIndex += 1;
        const contextStart = Math.max(0, original.indexOf(url) - 260);
        const context = original.slice(contextStart, Math.min(original.length, contextStart + url.length + 260));
        const artwork = await generateOrArtwork(`${themeText.slice(0, 900)} ${context}`, assetIndex);
        localPath = `wedev-assets/semantic-${assetIndex}.${artwork.extension}`;
        const target = join(directory, 'public', localPath);
        await mkdir(resolve(target, '..'), { recursive: true });
        await writeFile(target, artwork.bytes);
        replacements.set(url, localPath);
      }
      updated = updated.split(url).join(localPath.replace(/^\//, ''));
    }
    if (updated !== original) await writeFile(fullPath, updated, 'utf8');
  }
}

async function repairRepeatedLocalImages(directory: string) {
  const files = await collectFiles(directory);
  const textEntries = files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path));
  const themeText = (await Promise.all(textEntries.map((entry) => readFile(join(directory, entry.path), 'utf8').catch(() => '')))).join(' ');
  if (!/(автозапчаст|запчаст|автомобил|детал|vin|autopart|car|vehicle|brake|filter|engine)/i.test(themeText)) return;
  const htmlFiles = textEntries.filter((entry) => /\.html?$/i.test(entry.path));
  let index = 0;
  for (const entry of htmlFiles) {
    const fullPath = join(directory, entry.path);
    const original = await readFile(fullPath, 'utf8');
    const matches = [...original.matchAll(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi)];
    const counts = new Map<string, number>();
    for (const match of matches) counts.set(match[2], (counts.get(match[2]) || 0) + 1);
    const repeated = new Set([...counts.entries()].filter(([, count]) => count >= 3).map(([src]) => src));
    if (!repeated.size) continue;
    let updated = original;
    for (const src of repeated) {
      const occurrences = [...updated.matchAll(new RegExp(`(<img\\b[^>]*\\bsrc=["'])${src.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(["'][^>]*>)`, 'gi'))];
      for (let occurrence = 0; occurrence < occurrences.length; occurrence += 1) {
        const targetName = `wedev-assets/autoparts-${++index}.jpg`;
        const target = join(directory, 'public', targetName);
        await mkdir(resolve(target, '..'), { recursive: true });
        try {
          const sourceUrl = STABLE_AUTOPARTS_IMAGES[index % STABLE_AUTOPARTS_IMAGES.length];
          const response = await fetch(sourceUrl, { redirect: 'follow', headers: { 'User-Agent': 'De0AssetBot/1.0', Accept: 'image/*' } });
          if (!response.ok) throw new Error(`asset ${response.status}`);
          await writeFile(target, Buffer.from(await response.arrayBuffer()));
          const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          updated = updated.replace(new RegExp(`(<img\\b[^>]*\\bsrc=["'])${escaped}(["'][^>]*>)`, 'i'), `$1${targetName}$2`);
        } catch {
          break;
        }
      }
    }
    if (updated !== original) await writeFile(fullPath, updated, 'utf8');
  }
}

async function repairThemeLocalImages(directory: string) {
  const files = await collectFiles(directory);
  const textEntries = files.filter((entry) => TEXT_FILE_PATTERN.test(entry.path));
  const themeText = (await Promise.all(textEntries.map((entry) => readFile(join(directory, entry.path), 'utf8').catch(() => '')))).join(' ');
  const shoeTheme = /(обув|туфл|ботин|кроссов|shoe|footwear|sneaker|boot|heel)/i.test(themeText);
  const autoTheme = /(автозапчаст|запчаст|автомобил|детал|vin|autopart|car|vehicle|brake|filter|engine)/i.test(themeText);
  if (!shoeTheme && !autoTheme) return;
  const sources = shoeTheme ? STABLE_SHOE_IMAGES : STABLE_AUTOPARTS_IMAGES;
  const pattern = /(?:\/?wedev-assets\/)(?:recovered|autoparts|semantic)-\d+\.(?:jpe?g|png|webp)/gi;
  let index = 0;
  const downloaded = new Map<string, string>();
  for (const entry of textEntries) {
    const fullPath = join(directory, entry.path);
    const original = await readFile(fullPath, 'utf8');
    let updated = original;
    for (const match of [...original.matchAll(pattern)]) {
      const oldPath = match[0];
      if (!downloaded.has(oldPath)) {
        const targetName = `${shoeTheme ? 'shoes' : 'autoparts'}-${++index}.jpg`;
        const target = join(directory, 'public', 'wedev-assets', targetName);
        await mkdir(resolve(target, '..'), { recursive: true });
        try {
          if (!existsSync(target)) {
            const response = await fetch(sources[(index - 1) % sources.length], { redirect: 'follow', headers: { 'User-Agent': 'De0AssetBot/1.0', Accept: 'image/*' } });
            if (!response.ok) throw new Error(`asset ${response.status}`);
            await writeFile(target, Buffer.from(await response.arrayBuffer()));
          }
          downloaded.set(oldPath, `wedev-assets/${targetName}`);
        } catch {}
      }
      const replacement = downloaded.get(oldPath);
      if (replacement) updated = updated.split(oldPath).join(replacement);
    }
    if (updated !== original) await writeFile(fullPath, updated, 'utf8');
  }
}

async function validateCandidate(directory: string, requireProjectManifest: boolean) {
  const files = await collectFiles(directory);
  const nonEmptyFiles = files.filter((file) => file.size > 0);
  const paths = new Set(nonEmptyFiles.map((file) => file.path.toLowerCase()));
  const hasSourceEntrypoint = nonEmptyFiles.some((file) =>
    /^src\/(main|index|app)\.[cm]?[jt]sx?$/i.test(file.path),
  );
  const indexHtmlFile = nonEmptyFiles.find((file) => file.path.toLowerCase() === 'index.html');
  const hasIndexHtml = Boolean(indexHtmlFile);
  const hasPackageManifest = paths.has('package.json');
  const buildConfigFile = nonEmptyFiles.find((file) =>
    /^(vite|webpack|next|astro)\.config\.[cm]?[jt]s$/i.test(file.path),
  );
  const hasCompiledSourceEntrypoint = nonEmptyFiles.some((file) =>
    /^src\/(main|index|app)\.(?:[cm]?ts|[cm]?jsx|tsx)$/i.test(file.path),
  );
  const requiresBuildToolchain = hasPackageManifest || Boolean(buildConfigFile) || hasCompiledSourceEntrypoint;

  if (!hasIndexHtml && !hasSourceEntrypoint) {
    throw new Error('Artifact is incomplete: add a valid index.html or a source entrypoint');
  }

  if (indexHtmlFile) {
    const indexHtml = await readFile(join(directory, indexHtmlFile.path), 'utf8');
    if (/(?:src|poster)\s*=\s*[\"']https?:\/\/[^\"']+|url\(\s*[\"']?https?:\/\/[^)\"']+\)?/i.test(indexHtml)) {
      throw new Error('Artifact is incomplete: external images must be materialized into local assets');
    }
    if (/href\s*=\s*[\"](?:#(?:[\"]|$)|javascript:)/i.test(indexHtml)) {
      throw new Error('Artifact is incomplete: placeholder navigation links are not allowed');
    }
    const imageReferences = [...indexHtml.matchAll(/<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']/gi)].map((match) => match[1]);
    const duplicateImageReferences = [...new Set(imageReferences.filter((reference, index) => imageReferences.indexOf(reference) !== index))];
    if (duplicateImageReferences.length > 0) {
      throw new Error('Artifact is incomplete: repeated image references are not allowed');
    }
    const referencePattern = /<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi;
    let reference: RegExpExecArray | null;
    while ((reference = referencePattern.exec(indexHtml)) !== null) {
      const value = reference[1].trim();
      if (!value || /^(?:[a-z]+:|\/\/|#|data:)/i.test(value) || value.startsWith('/@')) continue;
      const normalized = value.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '').toLowerCase();
      if (normalized && !paths.has(normalized)) {
        throw new Error('Artifact is incomplete: index.html references missing file ' + normalized);
      }
    }
  }

  for (const file of nonEmptyFiles.filter((entry) => TEXT_FILE_PATTERN.test(entry.path))) {
    const content = await readFile(join(directory, file.path), 'utf8');
    if (/(?:src|poster)\s*[:=]\s*[\"']?https?:\/\/[^\s\"'`()<>]+|background(?:-image)?\s*:[^;]*url\(\s*[\"']?https?:\/\/[^)\"']+/i.test(content)) {
      throw new Error('Artifact is incomplete: external image URLs remain after asset materialization');
    }
  }

  if (requireProjectManifest && requiresBuildToolchain && (!hasPackageManifest || !hasIndexHtml)) {
    throw new Error('Artifact is incomplete: a new build-based project requires package.json and index.html');
  }

  if (buildConfigFile && hasPackageManifest) {
    const [buildConfig, packageJsonText] = await Promise.all([
      readFile(join(directory, buildConfigFile.path), 'utf8'),
      readFile(join(directory, 'package.json'), 'utf8'),
    ]);
    if (buildConfig.includes('@vitejs/plugin-react')) {
      let packageJson: any;
      try {
        packageJson = JSON.parse(packageJsonText);
      } catch {
        throw new Error('Artifact contains an invalid package.json');
      }
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (!dependencies['@vitejs/plugin-react']) {
        throw new Error('Artifact is incomplete: vite.config imports @vitejs/plugin-react but package.json does not declare it');
      }
    }
  }
}
async function commitArtifact(projectId: unknown, files: unknown) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('Artifact files are required');
  }
  const artifactFiles = Object.entries(files as Record<string, unknown>);
  if (artifactFiles.length === 0 || artifactFiles.length > MAX_ARTIFACT_FILES) {
    throw new Error(`Artifact must contain 1-${MAX_ARTIFACT_FILES} files`);
  }
  let artifactBytes = 0;
  for (const [filePath, content] of artifactFiles) {
    if (!filePath || typeof content !== 'string') throw new Error('Artifact contains an invalid file');
    artifactBytes += Buffer.byteLength(content, 'utf8');
  }
  if (artifactBytes > MAX_ARTIFACT_BYTES) throw new Error('Artifact is too large');

  await mkdir(STAGING_DIR(), { recursive: true });
  await mkdir(REVISIONS_DIR(), { recursive: true });

  const hasBaseProject = isValidProjectId(projectId) && existsSync(join(PROJECTS_DIR(), projectId));
  const finalProjectId = hasBaseProject
    ? projectId
    : `proj-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const finalDirectory = join(PROJECTS_DIR(), finalProjectId);
  const stagingDirectory = join(STAGING_DIR(), `${finalProjectId}-${randomUUID()}`);
  await mkdir(stagingDirectory, { recursive: true });

  try {
    if (hasBaseProject) await cp(finalDirectory, stagingDirectory, { recursive: true, force: true });
    for (const [filePath, content] of artifactFiles) {
      const fullPath = resolveInside(stagingDirectory, filePath);
      await mkdir(resolve(fullPath, '..'), { recursive: true });
      await writeFile(fullPath, normalizeArtifactContent(content as string, filePath), 'utf-8');
    }
    await materializeRemoteImages(stagingDirectory);
    await normalizeExternalAssets(stagingDirectory);
    await materializeMissingLocalAssets(stagingDirectory);
    await sanitizeGeneratedUi(stagingDirectory);
    await repairArtifactEntrypoint(stagingDirectory);
    await repairMissingReferencedFiles(stagingDirectory);
    await validateCandidate(stagingDirectory, !hasBaseProject);

    if (!hasBaseProject) {
      await rename(stagingDirectory, finalDirectory);
      return { projectId: finalProjectId, created: true };
    }

    const revisionDirectory = join(REVISIONS_DIR(), `${finalProjectId}-${Date.now()}`);
    await rename(finalDirectory, revisionDirectory);
    try {
      await rename(stagingDirectory, finalDirectory);
    } catch (error) {
      await rename(revisionDirectory, finalDirectory);
      throw error;
    }
    return { projectId: finalProjectId, created: false, revision: revisionDirectory };
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, projectId } = body;

    if (action === 'commitArtifact') {
      return jsonResponse(await commitArtifact(projectId, body.files));
    }

    if (!isValidProjectId(projectId)) return new Response('valid projectId required', { status: 400 });
    const projectDirectory = await ensureProjectDir(projectId);

    if (action === 'write') {
      const { path: filePath, content } = body;
      if (!filePath) return new Response('path required', { status: 400 });
      const fullPath = resolveInside(projectDirectory, filePath);
      await mkdir(resolve(fullPath, '..'), { recursive: true });
      await writeFile(fullPath, normalizeArtifactContent(content || '', filePath), 'utf-8');
      await materializeRemoteImages(projectDirectory);
      await normalizeExternalAssets(projectDirectory);
      await materializeMissingLocalAssets(projectDirectory);
      await sanitizeGeneratedUi(projectDirectory);
      await repairArtifactEntrypoint(projectDirectory);
      return jsonResponse({ ok: true });
    }

    if (action === 'mkdir') {
      const { path: directoryPath } = body;
      if (!directoryPath) return new Response('path required', { status: 400 });
      await mkdir(resolveInside(projectDirectory, directoryPath), { recursive: true });
      return jsonResponse({ ok: true });
    }

    if (action === 'run') {
      const { command, args } = body;
      if (!command || !command.trim()) return jsonResponse({ ok: true, skipped: true });

      if (command === 'npm' && (args || []).some((argument: string) => argument === 'dev' || argument === 'start')) {
        killPreviewServers();
        for (const processHandle of runningProcesses.values()) {
          try { process.kill(-processHandle.pid); } catch {}
          try { processHandle.kill('SIGKILL'); } catch {}
        }
        runningProcesses.clear();
      }

      let finalArgs: string[] = args || [];
      if (command === 'npm' && (finalArgs.includes('dev') || finalArgs.includes('start'))) {
        if (!finalArgs.includes('--port')) finalArgs = [...finalArgs, '--', '--host', '0.0.0.0', '--port', '5174'];
        try { writeFileSync('/tmp/current_preview.json', JSON.stringify({ projectId }), 'utf-8'); } catch {}
      }

      const child = spawn(command, finalArgs, {
        cwd: projectDirectory,
        env: { ...process.env, PATH: `${projectDirectory}/node_modules/.bin:${process.env.PATH || ''}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      runningProcesses.set(projectId, child);

      let closed = false;
      const stream = new ReadableStream({
        start(controller) {
          child.stdout.on('data', (data: Buffer) => { if (!closed) controller.enqueue(data); });
          child.stderr.on('data', (data: Buffer) => { if (!closed) controller.enqueue(data); });
          child.on('close', () => {
            if (!closed) { closed = true; controller.close(); }
          });
          child.on('error', (error: Error) => {
            if (!closed) { closed = true; controller.error(error); }
          });
        },
        cancel() {},
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'X-Exit-Code': 'pending',
        },
      });
    }

    return jsonResponse({ error: 'unknown action' }, 400);
  } catch (error: any) {
    console.error('Exec error:', error);
    return jsonResponse({ error: error.message }, 422);
  }
}
