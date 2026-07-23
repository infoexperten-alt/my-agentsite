import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { PROJECTS_DIR, QUALITY_DIR } from '../paths';
import { chromium, type Browser, type Page } from 'playwright-core';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const PREVIEW_API = 'http://127.0.0.1:3000/api/preview';
const CHROMIUM_PATHS = ['/usr/bin/chromium-browser', '/snap/bin/chromium'];
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]{4,80}$/;
const MAX_LOG_ITEMS = 40;
const activeRuns = new Set<string>();

interface ViewportMetrics {
  bodyTextLength: number;
  documentHeight: number;
  horizontalOverflow: number;
  headings: number;
  h1: number;
  sections: number;
  links: number;
  buttons: number;
  navigation: number;
  forms: number;
  images: number;
  loadedImages: number;
  imagesWithoutAlt: number;
  interactiveElements: number;
  visibleDialogs: number;
  blockingOverlays: number;
  placeholderLinks: number;
  buttonsWithoutName: number;
  privateUseGlyphs: number;
  formsWithoutSubmit: number;
}

interface ViewportReport {
  name: 'desktop' | 'mobile';
  width: number;
  height: number;
  httpStatus: number | null;
  title: string;
  screenshot: string;
  metrics: ViewportMetrics;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
}

interface VisionAudit {
  available: boolean;
  model?: string;
  score?: number;
  summary?: string;
  strengths?: string[];
  issues?: string[];
  correctionPrompt?: string;
  error?: string;
}

function resolveProject(projectId: unknown) {
  if (typeof projectId !== 'string' || !PROJECT_ID_PATTERN.test(projectId)) {
    throw new Error('Valid projectId required');
  }
  const projectDirectory = join(PROJECTS_DIR(), projectId);
  if (!existsSync(projectDirectory)) throw new Error('Project not found');
  return { projectId, projectDirectory };
}

function compact(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, MAX_LOG_ITEMS);
}

type SemanticTheme = 'stationery' | 'medical' | 'landscape' | 'grocery' | 'unknown';

const SEMANTIC_KEYWORDS: Record<Exclude<SemanticTheme, 'unknown'>, string[]> = {
  stationery: ['канцеляр', 'ручк', 'тетрад', 'бумаг', 'офис', 'карандаш', 'маркер', 'папк', 'скрепк', 'блокнот', 'товар', 'каталог', 'корзин', 'заказ', 'stationery', 'paper', 'pen', 'notebook', 'office supplies'],
  medical: ['больниц', 'клиник', 'медицин', 'пациент', 'врач', 'доктор', 'стационар', 'диагност', 'лечение', 'поликлиник', 'medical', 'clinic', 'hospital', 'patient', 'doctor', 'diagnostic'],
  landscape: ['ландшафт', 'сад', 'растен', 'коттедж', 'парк', 'террас', 'озелен', 'водоём', 'landscape', 'garden', 'park', 'terrace', 'planting'],
  grocery: ['\\bмед(?:а|у|е|ом|овый|овая|овое|овые|ов)?\\b', '\\bмёд\\b', 'варень', 'джем', 'конфитюр', 'мармелад', 'ягод', 'пасек', 'пчел', 'пчёл', 'сладост', 'натуральн', 'фермер', 'grocery', 'honey', 'jam', 'jelly', 'marmalade', 'preserve', 'confiture', 'berry', 'apiary', 'sweet pantry'],
};

function normalizeSemanticText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е');
}

function countSemanticKeywords(value: string, theme: Exclude<SemanticTheme, 'unknown'>) {
  const normalized = normalizeSemanticText(value);
  return SEMANTIC_KEYWORDS[theme].reduce((sum, keyword) => sum + (normalized.match(new RegExp(keyword, 'g')) || []).length, 0);
}

function detectSemanticTheme(value: string): SemanticTheme {
  const scores = (Object.keys(SEMANTIC_KEYWORDS) as Array<Exclude<SemanticTheme, 'unknown'>>)
    .map((theme) => ({ theme, score: countSemanticKeywords(value, theme) }))
    .sort((left, right) => right.score - left.score);
  return scores[0] && scores[0].score > 0 ? scores[0].theme : 'unknown';
}

async function inspectSemanticQuality(projectDirectory: string) {
  const htmlPath = existsSync(join(projectDirectory, 'dist', 'index.html'))
    ? join(projectDirectory, 'dist', 'index.html')
    : join(projectDirectory, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] || '';
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  const expectedTheme = detectSemanticTheme(`${title} ${description} ${h1}`);
  if (expectedTheme === 'unknown') {
    return { score: 100, issues: [] as string[], expectedTheme, expectedHits: 0, foreignTheme: 'unknown', foreignHits: 0 };
  }
  const semanticText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const expectedHits = countSemanticKeywords(semanticText, expectedTheme);
  const foreign = (Object.keys(SEMANTIC_KEYWORDS) as Array<Exclude<SemanticTheme, 'unknown'>>)
    .filter((theme) => theme !== expectedTheme)
    .map((theme) => ({ theme, score: countSemanticKeywords(semanticText, theme) }))
    .sort((left, right) => right.score - left.score)[0] || { theme: 'unknown' as const, score: 0 };
  let score = 100;
  const issues: string[] = [];
  if (expectedHits < 4) {
    score -= 35;
    issues.push(`semantic: expected ${expectedTheme} content, but found only ${expectedHits} relevant mentions`);
  }
  if (foreign.score >= 4 && foreign.score > expectedHits + 1) {
    score -= 45;
    issues.push(`semantic: expected ${expectedTheme}, but ${foreign.theme} content dominates (${foreign.score} vs ${expectedHits})`);
  }
  return {
    score: Math.max(0, score),
    issues: compact(issues),
    expectedTheme,
    expectedHits,
    foreignTheme: foreign.theme,
    foreignHits: foreign.score,
  };
}

function findChromium() {
  const executablePath = CHROMIUM_PATHS.find((path) => existsSync(path));
  if (!executablePath) throw new Error('Chromium executable not found');
  return executablePath;
}

async function ensurePreview(projectId: string) {
  const response = await fetch(PREVIEW_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
    signal: AbortSignal.timeout(240000),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok || !payload.built) {
    throw new Error(payload.error || `Preview build failed with HTTP ${response.status}`);
  }
  if (typeof payload.previewPath !== 'string') throw new Error('Preview path missing');
  return payload;
}

async function inspectViewport(
  browser: Browser,
  reportDirectory: string,
  name: ViewportReport['name'],
  width: number,
  height: number,
  previewUrl: string,
): Promise<ViewportReport> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} вЂ” ${request.failure()?.errorText || 'failed'}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    try {
      const responseUrl = new URL(response.url());
      const previewOrigin = new URL(previewUrl).origin;
      if (responseUrl.origin === previewOrigin && !/favicon\.ico$/i.test(responseUrl.pathname)) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    } catch {}
  });

  const response = await page.goto(previewUrl, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const height = Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight || 0);
    for (let y = 0; y < height; y += Math.max(320, Math.floor(window.innerHeight * 0.75))) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    window.scrollTo(0, 0);
    await Promise.all(Array.from(document.images).map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener('load', done, { once: true });
          image.addEventListener('error', done, { once: true });
          setTimeout(done, 2000);
        })));
  });
  await page.waitForTimeout(300);

  const metrics = await page.evaluate((): ViewportMetrics => {
    const images = Array.from(document.images);
    const interactiveSelector = 'a[href],button,input,select,textarea,[role="button"]';
    const isVisible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0.05 && rect.width > 1 && rect.height > 1;
    };
    const visibleDialogs = Array.from(document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"]')).filter(isVisible);
    const blockingOverlays = Array.from(document.querySelectorAll('body *')).filter((element) => {
      if (!isVisible(element)) return false;
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      if (!['fixed', 'sticky'].includes(style.position) || style.pointerEvents === 'none') return false;
      const rect = htmlElement.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return visibleWidth * visibleHeight >= window.innerWidth * window.innerHeight * 0.35;
    });
    const placeholderLinks = Array.from(document.querySelectorAll('a[href]')).filter((link) => {
      const href = (link.getAttribute('href') || '').trim().toLowerCase();
      return href === '#' || href === 'javascript:void(0)' || href === 'javascript:void(0);';
    });
    const buttonsWithoutName = Array.from(document.querySelectorAll('button,[role="button"]')).filter((element) => {
      const text = (element.textContent || '').trim();
      const label = element.getAttribute('aria-label')?.trim() || element.getAttribute('title')?.trim() || '';
      return !text && !label;
    });
    const privateUseGlyphs = (document.body?.innerText.match(/[\uE000-\uF8FF]/g) || []).length;
    const formsWithoutSubmit = Array.from(document.forms).filter((form) => !form.querySelector('button[type="submit"],input[type="submit"],button:not([type])')).length;
    return {
      bodyTextLength: document.body?.innerText.trim().length || 0,
      documentHeight: Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight || 0),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      headings: document.querySelectorAll('h1,h2,h3,h4,h5,h6').length,
      h1: document.querySelectorAll('h1').length,
      sections: document.querySelectorAll('main,section,article').length,
      links: document.querySelectorAll('a[href]').length,
      buttons: document.querySelectorAll('button,[role="button"]').length,
      navigation: document.querySelectorAll('nav,[role="navigation"]').length,
      forms: document.querySelectorAll('form').length,
      images: images.length,
      loadedImages: images.filter((image) => image.complete && image.naturalWidth > 0).length,
      imagesWithoutAlt: images.filter((image) => !image.alt.trim()).length,
      interactiveElements: document.querySelectorAll(interactiveSelector).length,
      visibleDialogs: visibleDialogs.length,
      blockingOverlays: blockingOverlays.length,
      placeholderLinks: placeholderLinks.length,
      buttonsWithoutName: buttonsWithoutName.length,
      privateUseGlyphs,
      formsWithoutSubmit,
    };
  });

  const screenshotName = `${name}.jpg`;
  await page.screenshot({
    path: join(reportDirectory, screenshotName),
    type: 'jpeg',
    quality: 72,
    fullPage: false,
  });
  const title = await page.title();
  await page.close();

  return {
    name,
    width,
    height,
    httpStatus: response?.status() || null,
    title,
    screenshot: screenshotName,
    metrics,
    consoleErrors: compact(consoleErrors),
    pageErrors: compact(pageErrors),
    failedRequests: compact(failedRequests),
    badResponses: compact(badResponses),
  };
}

function calculateTechnicalScore(viewports: ViewportReport[]) {
  let score = 100;
  const issues: string[] = [];

  for (const viewport of viewports) {
    const label = viewport.name;
    if (!viewport.httpStatus || viewport.httpStatus >= 400) {
      score -= 45;
      issues.push(`${label}: preview HTTP status is ${viewport.httpStatus ?? 'missing'}`);
    }
    if (viewport.metrics.bodyTextLength < 80) {
      score -= 35;
      issues.push(`${label}: page has too little visible content`);
    }
    if (viewport.metrics.h1 === 0) {
      score -= 15;
      issues.push(`${label}: missing H1`);
    }
    if (viewport.metrics.horizontalOverflow > 2) {
      score -= 12;
      issues.push(`${label}: horizontal overflow ${viewport.metrics.horizontalOverflow}px`);
    }
    if (viewport.consoleErrors.length > 0 || viewport.pageErrors.length > 0) {
      score -= Math.min(40, (viewport.consoleErrors.length + viewport.pageErrors.length) * 15);
      issues.push(`${label}: runtime errors detected`);
    }
    if (viewport.badResponses.length > 0) {
      score -= 20;
      issues.push(`${label}: same-origin resources returned errors`);
    }
    const unloadedImages = viewport.metrics.images - viewport.metrics.loadedImages;
    if (unloadedImages > 0) {
      score -= Math.min(20, unloadedImages * 5);
      issues.push(`${label}: ${unloadedImages} images failed to load`);
    }
    const visualContentExpected = viewport.metrics.sections >= 4 && viewport.metrics.bodyTextLength >= 700;
    if (visualContentExpected && viewport.metrics.images < 3) {
      score -= 22;
      issues.push(`${label}: visually rich page expected, but only ${viewport.metrics.images} images found`);
    }
    if (viewport.metrics.imagesWithoutAlt > 0) {
      score -= Math.min(8, viewport.metrics.imagesWithoutAlt * 2);
      issues.push(`${label}: ${viewport.metrics.imagesWithoutAlt} images have empty alt text`);
    }
    if (viewport.metrics.interactiveElements === 0) {
      score -= 10;
      issues.push(`${label}: no interactive elements found`);
    }
    if (viewport.metrics.visibleDialogs > 0) {
      score -= 35;
      issues.push(`${label}: ${viewport.metrics.visibleDialogs} dialog or modal is visible on initial load`);
    }
    if (viewport.metrics.blockingOverlays > 0) {
      score -= 30;
      issues.push(`${label}: ${viewport.metrics.blockingOverlays} large interactive overlay blocks the initial page`);
    }
    if (viewport.metrics.placeholderLinks > 0) {
      score -= Math.min(24, viewport.metrics.placeholderLinks * 4);
      issues.push(`${label}: ${viewport.metrics.placeholderLinks} links use placeholder href values`);
    }
    if (viewport.metrics.buttonsWithoutName > 0) {
      score -= Math.min(12, viewport.metrics.buttonsWithoutName * 3);
      issues.push(`${label}: ${viewport.metrics.buttonsWithoutName} buttons have no accessible name`);
    }
    if (viewport.metrics.privateUseGlyphs > 0) {
      score -= Math.min(12, viewport.metrics.privateUseGlyphs * 2);
      issues.push(`${label}: ${viewport.metrics.privateUseGlyphs} private-use icon glyphs may render as broken characters`);
    }
    if (viewport.metrics.formsWithoutSubmit > 0) {
      score -= Math.min(20, viewport.metrics.formsWithoutSubmit * 10);
      issues.push(`${label}: ${viewport.metrics.formsWithoutSubmit} forms have no submit control`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), issues: compact(issues) };
}

function parseJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || value.slice(value.indexOf('{'), value.lastIndexOf('}') + 1);
  if (!candidate) throw new Error('Vision response did not contain JSON');
  return JSON.parse(candidate);
}

async function runVisionAudit(
  reportDirectory: string,
  technicalScore: number,
  technicalIssues: string[],
): Promise<VisionAudit> {
  const apiUrl = (
    process.env.QUALITY_VISION_API_URL?.trim()
    || process.env.OPENCLAW_BLOCKRUN_API_URL?.trim()
    || 'http://127.0.0.1:8402/v1'
  ).replace(/\/$/, '');
  const apiKey = process.env.QUALITY_VISION_API_KEY?.trim()
    || process.env.OPENCLAW_BLOCKRUN_API_KEY?.trim()
    || '';
  if (!apiUrl) return { available: false, error: 'Vision API URL is not configured' };

  const [desktop, mobile] = await Promise.all([
    readFile(join(reportDirectory, 'desktop.jpg'), 'base64'),
    readFile(join(reportDirectory, 'mobile.jpg'), 'base64'),
  ]);
  const prompt = [
    'You are the Vision quality gate for a production website builder.',
    'Review both desktop and mobile screenshots as a senior brand designer and visual QA engineer.',
    'Judge hierarchy, typography, spacing, composition, imagery relevance to the requested product, contrast, responsiveness, premium/corporate feel, information density, and obvious broken UI.',
    'Penalize generic template structure, repeated or semantically wrong photos, weak hero/banner, empty sections, low content density, cheap visual treatment, and a result that could belong to any unrelated business.',
    'A technically valid but generic website must not score above 70. A visually strong, coherent, product-specific result should score 85 or higher.',
    `Deterministic QA score: ${technicalScore}.`,
    `Deterministic issues: ${technicalIssues.join('; ') || 'none'}.`,
    'Return ONLY compact JSON with keys score, summary, strengths, issues, correctionPrompt. No reasoning, no markdown, maximum 120 words.',
    'correctionPrompt must be a concrete instruction for Development to fix the issues without replacing the product concept.',
  ].join('\n');
  const candidates = [
    process.env.QUALITY_VISION_MODEL?.trim() || 'free/nemotron-nano-12b-v2-vl',
    'blockrun/free/nemotron-nano-12b-v2-vl',
    'auto',
  ];
  const errors: string[] = [];

  for (const model of candidates) {
    try {
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 900,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${desktop}` } },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${mobile}` } },
            ],
          }],
        }),
        signal: AbortSignal.timeout(90000),
      });
      const raw = await response.text();
      if (!response.ok) {
        errors.push(`${model}: HTTP ${response.status} ${raw.slice(0, 240)}`);
        continue;
      }
      const payload = JSON.parse(raw);
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        errors.push(`${model}: empty response`);
        continue;
      }
      const parsed = parseJsonObject(content);
      return {
        available: true,
        model,
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        summary: String(parsed.summary || ''),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 12) : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 12) : [],
        correctionPrompt: String(parsed.correctionPrompt || ''),
      };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { available: false, error: compact(errors).join('\n') };
}

function buildCorrectionPrompt(technicalIssues: string[], vision: VisionAudit) {
  const issues = [...technicalIssues, ...(vision.issues || [])].filter(Boolean);
  return [
    'Исправьте технические проблемы проекта:',
    ...issues.map((issue) => `- ${issue}`),
    vision.correctionPrompt ? `Рекомендация визуальной проверки: ${vision.correctionPrompt}` : '',
    'Сохраните структуру проекта, рабочие сценарии, русский язык и корректные тематические изображения.',
    'Проверьте код, формы, кнопки, ссылки, адаптивность и предпросмотр на desktop и mobile.',
  ].filter(Boolean).join('\n');
}

async function latestRun(projectId: string) {
  const directory = join(QUALITY_DIR(), projectId);
  if (!existsSync(directory)) return null;
  const entries = await readdir(directory, { withFileTypes: true });
  const runs = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => ({
    name: entry.name,
    modified: (await stat(join(directory, entry.name))).mtimeMs,
  })));
  return runs.sort((a, b) => b.modified - a.modified)[0]?.name || null;
}

export async function POST(req: Request) {
  let browser: Browser | null = null;
  let activeProjectId = "";
  try {
    const body = await req.json();
    const { projectId, projectDirectory } = resolveProject(body.projectId);
    activeProjectId = projectId;
    if (activeRuns.has(projectId)) {
      return Response.json({ error: 'Quality run already active' }, { status: 409 });
    }
    activeRuns.add(projectId);
    const preview = await ensurePreview(projectId);
    const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const reportDirectory = join(QUALITY_DIR(), projectId, runId);
    await mkdir(reportDirectory, { recursive: true });

    browser = await chromium.launch({
      headless: true,
      executablePath: findChromium(),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const previewUrl = `http://127.0.0.1:3000${preview.previewPath}`;
    const viewports = await Promise.all([
      inspectViewport(browser, reportDirectory, 'desktop', 1440, 1000, previewUrl),
      inspectViewport(browser, reportDirectory, 'mobile', 390, 844, previewUrl),
    ]);
    await browser.close();
    browser = null;

    const technical = calculateTechnicalScore(viewports);
    const semantic = await inspectSemanticQuality(projectDirectory);
    const mergedTechnical = {
      score: Math.max(0, Math.min(100, technical.score - (semantic.score < 100 ? (100 - semantic.score) : 0))),
      issues: compact([...technical.issues, ...semantic.issues]),
    };
    const vision = await runVisionAudit(reportDirectory, mergedTechnical.score, mergedTechnical.issues);
    const finalScore = vision.available && typeof vision.score === 'number'
      ? Math.round(mergedTechnical.score * 0.55 + vision.score * 0.45)
      : mergedTechnical.score;
    const visionIssues = Array.isArray(vision.issues) ? vision.issues : [];
    const hasBlockingVisionIssue = visionIssues.some((issue) => /critical|high/i.test(String(issue)));
    const state = mergedTechnical.issues.length > 0
      ? 'needs-correction'
      : !vision.available
        ? 'vision-unavailable'
        : finalScore >= 78 && !hasBlockingVisionIssue
          ? 'passed'
          : 'needs-correction';
    const report = {
      runId,
      projectId,
      createdAt: new Date().toISOString(),
      state,
      passed: state === 'passed',
      score: finalScore,
      technical: mergedTechnical,
      semantic,
      vision,
      preview,
      viewports,
      correctionPrompt: state === 'needs-correction' ? buildCorrectionPrompt(mergedTechnical.issues, vision) : '',
    };
    await writeFile(join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    return Response.json(report);
  } catch (error) {
    if (browser) await browser.close().catch(() => undefined);
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  } finally {
    if (activeProjectId) activeRuns.delete(activeProjectId);
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { projectId } = resolveProject(url.searchParams.get('projectId'));
    const runId = url.searchParams.get('runId') || await latestRun(projectId);
    if (!runId || !/^[a-zA-Z0-9_-]{4,80}$/.test(runId)) {
      return Response.json({ error: 'Quality report not found' }, { status: 404 });
    }
    const reportDirectory = join(QUALITY_DIR(), projectId, runId);
    const asset = url.searchParams.get('asset');
    if (asset) {
      if (!['desktop.jpg', 'mobile.jpg'].includes(asset)) {
        return Response.json({ error: 'Invalid asset' }, { status: 400 });
      }
      const data = await readFile(join(reportDirectory, asset));
      return new Response(data, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'private, max-age=300',
        },
      });
    }
    const report = await readFile(join(reportDirectory, 'report.json'), 'utf8');
    return new Response(report, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 404 });
  }
}
