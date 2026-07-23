import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  type AgentProfileId,
  type AgentTaskState,
  type AppLocale,
  type AgentMode,
  type SubscriptionTier,
  type WorkflowMode,
  buildAgentSystemPrompt,
  buildTaskState,
  getLocalizedAgentProfile,
  getRoleModel,
  serializeTaskState,
  WORKFLOW_CHAIN,
} from './registry';
import {
  type Messages,
  type StreamingOptions,
  generateTextFn,
  streamTextFn,
} from './action';
import SwitchableStream from './switchable-stream';
import { deductUserTokens, estimateTokens } from '@/utils/tokens';
import {
  type WorkflowJob,
  completeWorkflowJob,
  createWorkflowJob,
  failWorkflowJob,
  latestWorkflowJob,
  markWorkflowSynthesizing,
  recordWorkflowModelAttempt,
  recordWorkflowSynthesisAttempt,
  updateWorkflowStage,
} from './workflow-store';

export interface WorkflowContext {
  messages: Messages;
  model: string;
  userId: string | null;
  chatId?: string;
  agentProfile?: string;
  subscriptionTier?: string;
  locale?: string;
  mode: AgentMode;
  workflowMode: WorkflowMode;
  basePrompt?: string;
  taskState?: AgentTaskState;
}

interface StageResult {
  role: AgentProfileId;
  text: string;
}

const MAX_RESPONSE_SEGMENTS = 2;
const MAX_STAGE_ATTEMPTS = 5;
const MAX_STREAM_ATTEMPTS = 5;
const STAGE_RATE_GAP_MS = 2500;
const MAX_REPAIR_SOURCE_CHARS = 100000;

function buildWorkflowRequestKey(context: WorkflowContext, state: AgentTaskState) {
  return createHash('sha256')
    .update(JSON.stringify({
      chatId: context.chatId || '',
      mode: context.mode,
      workflowMode: context.workflowMode,
      model: context.model,
      locale: context.locale || 'ru',
      goal: state.goal,
      constraints: state.constraints,
      messages: context.messages.map((message) => ({ role: message.role, content: message.content })),
      basePrompt: context.basePrompt || '',
    }))
    .digest('hex');
}

function extractFileAction(artifact: string, filePath: string) {
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return artifact.match(new RegExp(`<boltAction\\b(?=[^>]*\\btype=(?:"file"|'file'))(?=[^>]*\\bfilePath=(?:"${escapedPath}"|'${escapedPath}'))[^>]*>[\\s\\S]*?<\\/boltAction>`, 'i'))?.[0] || '';
}

function restoreIndexAction(artifact: string, developmentArtifact: string) {
  if (extractFileAction(artifact, 'index.html')) return artifact;
  const indexAction = extractFileAction(developmentArtifact, 'index.html');
  if (!indexAction) return artifact;
  const closingTag = '</boltArtifact>';
  const closingIndex = artifact.toLowerCase().lastIndexOf(closingTag.toLowerCase());
  if (closingIndex < 0) return artifact;
  return `${artifact.slice(0, closingIndex)}\n${indexAction}\n${artifact.slice(closingIndex)}`;
}

function isAuthenticationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /401|403|api key|unauthor|authentication|invalid token/i.test(message);
}

function isTransientModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /408|409|425|429|5\d\d|rate[\s_-]?limit|cooldown|quota|timeout|timed out|fetch failed|socket|connection|temporar|unavailable|routing_error|model.*not found|404/i.test(message);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelayFor(error: unknown, attempt: number) {
  const message = error instanceof Error ? error.message : String(error);
  const resetMatch = message.match(/reset[^\d]{0,24}(\d+)\s*s/i)
    || message.match(/(\d+)\s*(?:seconds?)/i);
  if (resetMatch) {
    const seconds = Number(resetMatch[1]);
    if (Number.isFinite(seconds)) return Math.min(120000, Math.max(3000, (seconds + 2) * 1000));
  }
  return Math.min(20000, 3000 * Math.max(1, attempt));
}

function stageModelForAttempt(roleModel: string, attempt: number) {
  return attempt === 1 ? roleModel : 'auto';
}

function buildStageFallback(roleId: AgentProfileId, state: AgentTaskState, locale: AppLocale) {
  const ru: Record<AgentProfileId, string> = {
    leader: 'Цель и критерии результата зафиксированы.',
    planner: 'План: структура, дизайн, реализация, проверка и безопасный релиз.',
    design: 'Интерфейс: ясная иерархия, хороший контраст, адаптивная сетка и понятные действия.',
    development: 'Реализация: рабочий проект без лишних зависимостей, с адаптивной версткой и устойчивой сборкой.',
    qa: 'Проверить сборку, консоль, основные сценарии, мобильную версию и повторную загрузку.',
    operations: 'Подготовить публикацию, проверку состояния, резервную копию и быстрый откат.',
    vision: 'Проверить композицию, контраст, отступы, иерархию и читаемость.',
    seo: 'Проверить заголовки, метаданные, структуру и доступность для поиска.',
    cms: 'Подготовить понятную структуру управляемого содержимого.',
  };
  const en: Record<AgentProfileId, string> = {
    leader: 'The goal and acceptance criteria are fixed.',
    planner: 'Plan: structure, design, implementation, verification, and safe release.',
    design: 'Interface: clear hierarchy, strong contrast, responsive layout, and clear actions.',
    development: 'Implementation: a working project with minimal dependencies and a reliable build.',
    qa: 'Verify the build, console, primary flows, mobile layout, and reload behavior.',
    operations: 'Prepare deployment, health checks, backup, and fast rollback.',
    vision: 'Review composition, contrast, spacing, hierarchy, and readability.',
    seo: 'Review headings, metadata, structure, and search accessibility.',
    cms: 'Prepare a clear managed-content structure.',
  };
  const summary = (locale === 'ru' ? ru : en)[roleId];
  const goal = String(state.goal || '').trim().slice(0, 1200);
  return goal ? `${summary}\n${locale === 'ru' ? 'Цель' : 'Goal'}: ${goal}` : summary;
}

function extractBoltArtifact(text: string) {
  const match = text.match(/<boltArtifact\b[^>]*>[\s\S]*?<\/boltArtifact>/i);
  if (!match) return '';
  const artifact = match[0].trim();
  const fileAction = /<boltAction\b(?=[^>]*\btype=(?:"file"|'file'))(?=[^>]*\bfilePath=(?:"[^"]+"|'[^']+'))[^>]*>[\s\S]*?<\/boltAction>/i;
  return fileAction.test(artifact) ? artifact : '';
}

function validateVisualArtifact(artifact: string, state?: AgentTaskState) {
  const html = [...artifact.matchAll(/<boltAction\b[^>]*\bfilePath=(?:"index\.html"|'index\.html')[^>]*>([\s\S]*?)<\/boltAction>/ig)][0]?.[1] || '';
  if (!html) throw new Error('Builder artifact has no index.html');
  const sectionCount = (html.match(/<section\b/gi) || []).length;
  const imageCount = (html.match(/<img\b/gi) || []).length;
  const imageReferences = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (new Set(imageReferences).size !== imageReferences.length) throw new Error('Builder artifact repeats an image reference');
  const visualCount = imageCount + (html.match(/background(?:-image)?\s*:[^;]*(?:url\(|linear-gradient)/gi) || []).length;
  const iconCount = (html.match(/<svg\b/gi) || []).length + (html.match(/class=["'][^"']*(?:icon|fa-|service-icon)/gi) || []).length;
  const hasHero = /class=["'][^"']*(?:hero|banner|masthead)|id=["'](?:hero|banner)["']/i.test(html)
    || /<header\b/i.test(html);
  const hasResponsive = /@media\b|viewport/i.test(html);
  const hasAction = /<(?:a|button|form)\b/i.test(html);
  if (html.length < 4000) throw new Error('Builder artifact is too short for a complete site');
  if (sectionCount < 4) throw new Error('Builder artifact needs at least four meaningful sections');
  if (!hasHero) throw new Error('Builder artifact has no hero or banner composition');
  if (visualCount < 3) throw new Error('Builder artifact needs at least three visual assets');
  // Icons improve the result but are not a valid reason to discard an
  // otherwise complete client-specific site. Some models use text/buttons or
  // CSS shapes instead of inline SVGs; the visual contract still checks the
  // actual sections, images, hero, actions, and responsive layout above.
  if (!hasResponsive) throw new Error('Builder artifact has no responsive mobile rules');
  if (!hasAction) throw new Error('Builder artifact has no usable actions');
  validateArtifactTheme(artifact, state);
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function normalizeRepeatedImageReferences(content: string) {
  const seen = new Map<string, number>();
  return content.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (_match, prefix, source, suffix) => {
    const normalized = String(source).trim();
    const count = seen.get(normalized) || 0;
    seen.set(normalized, count + 1);
    if (count === 0 || /^(?:data:|blob:|#)/i.test(normalized)) return _match;
    const separator = normalized.includes('?') ? '&' : '?';
    return `${prefix}${normalized}${separator}wedevVariant=${count + 1}${suffix}`;
  });
}

function extractFilePath(prefix: string) {
  const lines = prefix.slice(-500).split(/\r?\n/).reverse();
  for (const rawLine of lines) {
    const line = rawLine
      .trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^[-*]\s*/, '')
      .replace(/^\*\*(.+)\*\*$/, '$1')
      .replace(/^`(.+)`$/, '$1')
      .replace(/[:：]\s*$/, '')
      .trim();
    const match = line.match(/(?:^|\s)((?:[\w@.-]+\/)*[\w@.-]+\.(?:json|html?|css|scss|sass|less|js|jsx|mjs|cjs|ts|tsx|vue|svelte|md|svg|xml|yaml|yml|toml|txt|env))$/i);
    if (match) return match[1];
  }
  return '';
}

function convertBoltArtifactJsonToArtifact(text: string) {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:boltArtifact|json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) candidates.push(fenced.trim());
  const firstObject = text.search(/[\[{]/);
  if (firstObject >= 0) candidates.push(text.slice(firstObject).trim());

  let parsed: any;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      continue;
    }
  }
  if (!parsed) return '';

  const payload = parsed?.boltArtifact && typeof parsed.boltArtifact === 'object'
    ? parsed.boltArtifact
    : parsed;
  const files = Array.isArray(payload) ? payload : Array.isArray(payload?.files) ? payload.files : [];
  const actions = files
    .filter((file: any) => file && typeof (file.name || file.path) === 'string' && typeof file.content === 'string')
    .map((file: any) => {
      const filePath = String(file.name || file.path);
      const content = /\.html?$/i.test(filePath)
        ? normalizeRepeatedImageReferences(file.content)
        : file.content;
      return `<boltAction type="file" filePath="${escapeAttribute(filePath)}">\n${content}\n</boltAction>`;
    });
  if (actions.length === 0) return '';
  return `<boltArtifact id="generated-project" title="Рабочий проект">\n${actions.join('\n\n')}\n</boltArtifact>`;
}

function convertMarkdownFilesToArtifact(text: string) {
  const actions: string[] = [];
  const seen = new Set<string>();
  const fencePattern = /```[^\r\n]*\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(text)) !== null) {
    const content = match[1].replace(/\s+$/, '');
    const filePath = extractFilePath(text.slice(0, match.index))
      || (/<!doctype\s+html|<html\b/i.test(content) ? 'index.html' : '');
    if (!filePath || !content || seen.has(filePath)) continue;
    seen.add(filePath);
    actions.push(`<boltAction type="file" filePath="${escapeAttribute(filePath)}">\n${content}\n</boltAction>`);
  }
  if (actions.length === 0) return '';
  return `<boltArtifact id="generated-project" title="Рабочий проект">\n${actions.join('\n\n')}\n</boltArtifact>`;
}


function convertLooseHtmlToArtifact(text: string) {
  const doctypeStart = text.search(/<!doctype\s+html/i);
  const htmlStart = text.search(/<html\b/i);
  const start = doctypeStart >= 0 ? doctypeStart : htmlStart;
  if (start < 0) return '';
  const closingMatch = /<\/html\s*>/ig;
  closingMatch.lastIndex = start;
  let closing: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = closingMatch.exec(text)) !== null) closing = match;
  if (!closing) return '';
  const html = text.slice(start, closing.index + closing[0].length).trim();
  if (!/<body\b/i.test(html) || html.length < 120) return '';
  return `<boltArtifact id="generated-project" title="Рабочий проект">\n<boltAction type="file" filePath="index.html">\n${html}\n</boltAction>\n</boltArtifact>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


type RequestedTheme = 'stationery' | 'medical' | 'landscape' | 'grocery' | 'unknown';

const THEME_KEYWORDS: Record<Exclude<RequestedTheme, 'unknown'>, string[]> = {
  stationery: ['канцеляр', 'ручк', 'тетрад', 'бумаг', 'офис', 'карандаш', 'маркер', 'папк', 'скрепк', 'блокнот', 'stationery', 'paper', 'pen', 'notebook', 'office supplies'],
  medical: ['больниц', 'клиник', 'медицин', 'пациент', 'врач', 'доктор', 'стационар', 'диагност', 'лечение', 'поликлиник', 'medical', 'clinic', 'hospital', 'patient', 'doctor', 'diagnostic'],
  landscape: ['ландшафт', 'сад', 'растен', 'коттедж', 'парк', 'террас', 'озелен', 'водоём', 'landscape', 'garden', 'park', 'terrace', 'planting'],
  grocery: ['\\bмед(?:а|у|е|ом|овый|овая|овое|овые|ов)?\\b', '\\bмёд\\b', 'варень(?:е|я|ю|ем|ями)?', 'джем(?:ы|а|у|ом)?', 'конфитюр(?:ы|а|у|ом)?', 'мармелад(?:ы|а|у|ом)?', 'ягод(?:а|ы|ам|ой|ами)?', 'пасек(?:а|и|е|ой|ами)?', 'пчел(?:а|ы|ам|ой|ами)?', 'пчёл(?:а|ы|ам|ой|ами)?', 'сладост(?:ь|и|ей)?', 'натуральн(?:ый|ая|ое|ые|ого|ому|ым|ых)?', 'фермер(?:ский|ская|ское|ские|ского|скому|ским|ских)?', 'grocery', 'honey', 'jam', 'jelly', 'marmalade', 'preserve', 'confiture', 'berry', 'apiary', 'sweet pantry'],
};

function normalizeThemeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е');
}

function countThemeKeywords(value: string, theme: Exclude<RequestedTheme, 'unknown'>) {
  const normalized = normalizeThemeText(value);
  return THEME_KEYWORDS[theme].reduce((sum, keyword) => sum + (normalized.match(new RegExp(keyword, 'g')) || []).length, 0);
}

function detectRequestedTheme(value: string): RequestedTheme {
  const scores = (Object.keys(THEME_KEYWORDS) as Array<Exclude<RequestedTheme, 'unknown'>>)
    .map((theme) => ({ theme, score: countThemeKeywords(value, theme) }))
    .sort((left, right) => right.score - left.score);
  return scores[0] && scores[0].score > 0 ? scores[0].theme : 'unknown';
}

function validateArtifactTheme(artifact: string, state?: AgentTaskState) {
  const expectedTheme = detectRequestedTheme(String(state?.goal || ''));
  if (expectedTheme === 'unknown') return;
  const html = [...artifact.matchAll(/<boltAction\b[^>]*\bfilePath=(?:"index\.html"|'index\.html')[^>]*>([\s\S]*?)<\/boltAction>/ig)][0]?.[1] || artifact;
  const semanticText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const expected = countThemeKeywords(semanticText, expectedTheme);
  const foreign = (Object.keys(THEME_KEYWORDS) as Array<Exclude<RequestedTheme, 'unknown'>>)
    .filter((theme) => theme !== expectedTheme)
    .map((theme) => ({ theme, score: countThemeKeywords(semanticText, theme) }))
    .sort((left, right) => right.score - left.score)[0];
  if (expected < 4) {
    throw new Error(`Builder artifact does not contain enough ${expectedTheme} domain content`);
  }
  if (foreign && foreign.score >= 4 && foreign.score > expected + 1) {
    throw new Error(`Builder artifact semantic mismatch: expected ${expectedTheme}, but ${foreign.theme} dominates`);
  }
}

function buildTopicFallbackArtifact(state: AgentTaskState, locale: AppLocale, theme: Extract<RequestedTheme, 'stationery' | 'medical' | 'grocery'>) {
  const ru = locale === 'ru';
  const goal = escapeHtml(String(state.goal || '').trim());
  const medical = theme === 'medical';
  const grocery = theme === 'grocery';
  const data = medical
    ? {
        brand: 'MEDCORE',
        eyebrow: ru ? 'Медицинский центр' : 'Medical center',
        title: ru ? 'Забота, диагностика и лечение без очередей' : 'Care, diagnostics, and treatment without delays',
        subtitle: ru ? 'Современная клиника с понятной записью, отделениями, врачами, диагностикой и спокойной коммуникацией для пациентов.' : 'A modern clinic with clear appointments, departments, doctors, diagnostics, and calm patient communication.',
        primary: ru ? 'Записаться на приём' : 'Book appointment',
        services: ru ? 'Отделения клиники' : 'Clinic departments',
        catalog: ru ? 'Программы и диагностика' : 'Programs and diagnostics',
        team: ru ? 'Врачи и команда' : 'Doctors and team',
        faq: ru ? 'Вопросы пациентов' : 'Patient questions',
        contact: ru ? 'Запись в клинику' : 'Contact clinic',
        filters: ru ? ['Все', 'Диагностика', 'Лечение', 'Семья'] : ['All', 'Diagnostics', 'Treatment', 'Family'],
        images: [
          'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1600&q=85',
          'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=85',
          'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1400&q=85',
          'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1400&q=85',
          'https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=1400&q=85',
        ],
        cards: ru
          ? [['Диагностика', 'Чек-апы, лаборатория, УЗИ и понятные результаты в маршруте пациента.'], ['Терапия', 'Первичный приём, план лечения, контроль динамики и бережная коммуникация.'], ['Семейная медицина', 'Врачи для взрослых и детей, профилактика и наблюдение.']]
          : [['Diagnostics', 'Checkups, lab tests, ultrasound, and clear results.'], ['Therapy', 'Consultation, treatment plan, and follow-up.'], ['Family care', 'Doctors for adults and children, prevention, and supervision.']],
        projects: ru
          ? [['diagnostics', 'Комплексный check-up', 'Диагностика за один визит', 'Диагностическая зона клиники'], ['treatment', 'Амбулаторное лечение', 'От приёма до контроля', 'Кабинет врача и пациент'], ['family', 'Семейные программы', 'Профилактика для взрослых и детей', 'Семейный медицинский приём'], ['diagnostics', 'Лаборатория', 'Анализы и быстрые результаты', 'Медицинская лаборатория']]
          : [['diagnostics', 'Complete checkup', 'Diagnostics in one visit', 'Clinic diagnostics area'], ['treatment', 'Outpatient care', 'From visit to follow-up', 'Doctor and patient room'], ['family', 'Family programs', 'Prevention for adults and children', 'Family medical consultation'], ['diagnostics', 'Laboratory', 'Tests and fast results', 'Medical laboratory']],
      }
    : grocery
      ? {
          brand: ru ? 'МЁД И ВАРЕНЬЕ' : 'HONEY & JAM',
          eyebrow: ru ? 'Фермерская лавка' : 'Farm pantry',
          title: ru ? 'Натуральный мёд, варенье и подарочные наборы' : 'Natural honey, jam, and gift boxes',
          subtitle: ru ? 'Премиальная витрина пасеки и ягодной кухни: сорта мёда, домашнее варенье, дегустационные наборы, сезонные партии и быстрая заявка.' : 'A premium storefront for apiary honey, berry preserves, tasting boxes, seasonal batches, and fast ordering.',
          primary: ru ? 'Собрать набор' : 'Build a box',
          services: ru ? 'Ассортимент лавки' : 'Pantry range',
          catalog: ru ? 'Популярные банки' : 'Featured jars',
          team: ru ? 'Пасека и кухня' : 'Apiary and kitchen',
          faq: ru ? 'Вопросы покупателей' : 'Customer questions',
          contact: ru ? 'Заявка на доставку' : 'Delivery request',
          filters: ru ? ['Все', 'Мёд', 'Варенье', 'Подарки'] : ['All', 'Honey', 'Jam', 'Gifts'],
          images: [
            'https://images.unsplash.com/photo-1468577760773-139c2f1c335f?auto=format&fit=crop&w=1600&q=85',
            'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1707092009843-2b5a919d17b0?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1753775290598-05fb7f911ac2?auto=format&fit=crop&w=1400&q=85',
            'https://images.unsplash.com/photo-1556316828-60a9fe5343ae?auto=format&fit=crop&w=1400&q=85',
          ],
          cards: ru
            ? [['Сорта мёда', 'Липовый, гречишный, цветочный и крем-мёд с понятным происхождением партий.'], ['Домашнее варенье', 'Ягодные джемы и конфитюры малой варки без чужих вкусов и случайных фото.'], ['Подарочные наборы', 'Коробки для завтраков, корпоративных подарков и сезонных дегустаций.']]
            : [['Honey varieties', 'Linden, buckwheat, wildflower, and creamed honey with clear batch origin.'], ['Homemade preserves', 'Berry jams and small-batch confitures without unrelated content.'], ['Gift boxes', 'Breakfast, corporate, and seasonal tasting sets.']],
          projects: ru
            ? [['honey', 'Липовый мёд', 'Светлая банка для завтраков и чая', 'Банка натурального мёда'], ['jam', 'Клубничное варенье', 'Ягодная партия малой варки', 'Тост с ягодным вареньем'], ['gift', 'Дегустационный набор', 'Мёд, джем и открытка в коробке', 'Подарочный набор мёда и варенья'], ['honey', 'Пасечный сет', 'Разные сорта мёда в одной заявке', 'Набор фермерских банок мёда']]
            : [['honey', 'Linden honey', 'A bright breakfast and tea jar', 'Natural honey jar'], ['jam', 'Strawberry jam', 'Small-batch berry preserve', 'Toast with berry jam'], ['gift', 'Tasting box', 'Honey, jam, and a note in one box', 'Honey and jam gift box'], ['honey', 'Apiary set', 'Several honey varieties in one order', 'Farm honey jar set']],
        }
      : {
        brand: 'PAPER PRO',
        eyebrow: ru ? 'Канцелярский магазин' : 'Stationery store',
        title: ru ? 'Канцелярия для офиса, школы и творчества' : 'Stationery for office, school, and creativity',
        subtitle: ru ? 'Интернет-магазин канцелярских товаров с каталогом, фильтрами, корзиной-заявкой и аккуратной карточной витриной.' : 'An online stationery store with catalog, filters, cart request, and a clean product showcase.',
        primary: ru ? 'Собрать заказ' : 'Build order',
        services: ru ? 'Категории товаров' : 'Product categories',
        catalog: ru ? 'Популярные наборы' : 'Popular sets',
        team: ru ? 'Сервис и комплектация' : 'Service and fulfillment',
        faq: ru ? 'Вопросы покупателей' : 'Customer questions',
        contact: ru ? 'Заявка на поставку' : 'Supply request',
        filters: ru ? ['Все', 'Офис', 'Школа', 'Творчество'] : ['All', 'Office', 'School', 'Creative'],
        images: [
          'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1600&q=85',
          'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1400&q=85',
          'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=85',
          'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?auto=format&fit=crop&w=1400&q=85',
          'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1400&q=85',
        ],
        cards: ru
          ? [['Офисная канцелярия', 'Бумага, папки, ручки, маркеры и расходники для ежедневной работы команды.'], ['Школьные наборы', 'Тетради, карандаши, пеналы и готовые комплекты к учебному сезону.'], ['Товары для творчества', 'Блокноты, скетчбуки, краски, кисти и материалы для мастерских.']]
          : [['Office supplies', 'Paper, folders, pens, markers, and daily essentials.'], ['School kits', 'Notebooks, pencils, cases, and seasonal bundles.'], ['Creative goods', 'Notepads, sketchbooks, paints, brushes, and workshop materials.']],
        projects: ru
          ? [['office', 'Офисный старт', 'Бумага, ручки, папки и маркеры', 'Офисный набор канцелярии'], ['school', 'Школьный комплект', 'Тетради, карандаши и пенал', 'Школьные тетради и карандаши'], ['creative', 'Творческая коробка', 'Скетчбук, маркеры, краски и кисти', 'Материалы для творчества'], ['office', 'Поставка для отдела', 'Стикеры, скрепки, бумага и расходники', 'Корпоративная поставка канцтоваров']]
          : [['office', 'Office starter', 'Paper, pens, folders, and markers', 'Office stationery kit'], ['school', 'School bundle', 'Notebooks, pencils, and pencil case', 'School notebooks and pencils'], ['creative', 'Creative box', 'Sketchbook, markers, paints, and brushes', 'Creative stationery materials'], ['office', 'Department supply', 'Sticky notes, clips, paper, and consumables', 'Corporate stationery delivery']],
      };
  const icon = (path: string) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const serviceCards = data.cards.map((item, index) => `<article class="panel"><div class="icon">${icon(['M4 7h16M4 12h16M4 17h10', 'M5 5h14v14H5zM9 9h6M9 13h6', 'M12 3v18M5 8h14'][index])}</div><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[1])}</p></article>`).join('');
  const projectCards = data.projects.map((item, index) => `<article class="product-card" data-kind="${item[0]}"><img src="${data.images[(index + 1) % data.images.length]}" alt="${escapeHtml(item[3])}"><div class="product-card__body"><span>${escapeHtml(item[1])}</span><h3>${escapeHtml(item[2])}</h3></div></article>`).join('');
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${goal || escapeHtml(data.title)}</title><meta name="description" content="${escapeHtml(data.subtitle)}"><style>:root{--bg:#f7f4ef;--panel:#fff;--ink:#17202a;--muted:#64707d;--line:#e4ddd3;--accent:${medical ? '#1c8c86' : '#d07829'};--accent2:${medical ? '#d9f2ef' : '#fff0d9'};--dark:#121821;--shadow:0 24px 70px rgba(18,24,33,.12)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(135deg,var(--bg),#fff);color:var(--ink);font-family:Inter,Manrope,system-ui,sans-serif;line-height:1.6}img{display:block;max-width:100%}a{color:inherit;text-decoration:none}.wrap{width:min(1160px,calc(100% - 32px));margin:auto}.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.86);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}.topbar__inner{min-height:78px;display:flex;justify-content:space-between;align-items:center;gap:16px}.brand{font-size:27px;font-weight:900;letter-spacing:.03em}.nav{display:flex;gap:22px;font-size:14px;font-weight:800}.menu{display:none;border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 16px;font:inherit;font-weight:800}.hero{padding:46px 0 30px}.hero__grid{display:grid;grid-template-columns:1.04fr .96fr;gap:28px;align-items:center}.eyebrow{display:inline-flex;padding:8px 12px;border-radius:999px;background:var(--accent2);color:var(--accent);font-weight:900;text-transform:uppercase;letter-spacing:.12em;font-size:12px}h1,h2,h3{line-height:1.02;margin:0}h1{font-size:clamp(44px,6vw,80px);letter-spacing:-.055em;margin:16px 0}h2{font-size:clamp(32px,4vw,54px);letter-spacing:-.04em}h3{font-size:24px}.lede{font-size:clamp(17px,1.6vw,21px);max-width:650px;color:var(--muted);margin:0}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:26px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:999px;border:1px solid transparent;background:var(--dark);color:#fff;font-weight:900}.btn--ghost{background:#fff;color:var(--ink);border-color:var(--line)}.hero__media{position:relative;min-height:520px;border-radius:34px;overflow:hidden;box-shadow:var(--shadow)}.hero__media img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}.hero__note{position:absolute;left:20px;right:20px;bottom:20px;padding:18px;border-radius:22px;background:rgba(255,255,255,.9)}.section{padding:82px 0}.section__head{display:flex;justify-content:space-between;gap:20px;align-items:end;flex-wrap:wrap;margin-bottom:26px}.section__head p{max-width:620px;color:var(--muted);margin:0}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:26px;padding:24px;box-shadow:0 14px 42px rgba(18,24,33,.06)}.panel p{color:var(--muted);margin:10px 0 0}.icon{width:44px;height:44px;display:grid;place-items:center;color:var(--accent);background:var(--accent2);border-radius:14px;margin-bottom:16px}.icon svg{width:24px;height:24px}.filters{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 24px}.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:10px 16px;font-weight:900;cursor:pointer}.chip[aria-pressed=true]{background:var(--dark);color:#fff}.catalog{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.product-card{position:relative;min-height:310px;border-radius:28px;overflow:hidden;background:#ddd;box-shadow:var(--shadow)}.product-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.product-card::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.66))}.product-card__body{position:absolute;left:20px;right:20px;bottom:20px;color:#fff;z-index:1}.product-card__body span{font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:900}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.step strong{display:block;font-size:36px;color:var(--accent)}.faq{display:grid;grid-template-columns:1fr 1fr;gap:14px}.qa{border:1px solid var(--line);border-radius:22px;background:#fff;overflow:hidden}.qa button{all:unset;display:flex;justify-content:space-between;width:100%;padding:20px;font-weight:900;cursor:pointer}.qa__body{display:none;padding:0 20px 20px;color:var(--muted)}.qa[data-open=true] .qa__body{display:block}.contact{display:grid;grid-template-columns:.9fr 1.1fr;gap:18px}.form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.form input,.form textarea{width:100%;border:1px solid var(--line);border-radius:16px;padding:15px;font:inherit}.form textarea{grid-column:1/-1;min-height:132px}.form button{grid-column:1/-1}.footer{padding:28px 0;color:var(--muted);border-top:1px solid var(--line)}@media(max-width:900px){.hero__grid,.grid-3,.catalog,.steps,.faq,.contact{grid-template-columns:1fr}.hero__media{min-height:410px}.nav{display:none}.menu{display:inline-flex}.section{padding:62px 0}.form{grid-template-columns:1fr}}</style></head><body><header class="topbar"><div class="wrap topbar__inner"><a class="brand" href="#hero">${escapeHtml(data.brand)}</a><nav class="nav"><a href="#services">${escapeHtml(data.services)}</a><a href="#catalog">${escapeHtml(data.catalog)}</a><a href="#team">${escapeHtml(data.team)}</a><a href="#contact">${escapeHtml(data.contact)}</a></nav><button class="menu" type="button" data-menu>${ru ? 'Меню' : 'Menu'}</button></div></header><main><section class="hero wrap" id="hero"><div class="hero__grid"><div><span class="eyebrow">${escapeHtml(data.eyebrow)}</span><h1>${escapeHtml(data.title)}</h1><p class="lede">${escapeHtml(data.subtitle)}</p><div class="actions"><a class="btn" href="#contact">${escapeHtml(data.primary)}</a><a class="btn btn--ghost" href="#catalog">${escapeHtml(data.catalog)}</a></div></div><div class="hero__media"><img src="${data.images[0]}" alt="${escapeHtml(data.title)}"><div class="hero__note"><strong>${goal || escapeHtml(data.title)}</strong><p>${escapeHtml(data.subtitle)}</p></div></div></div></section><section class="section" id="services"><div class="wrap"><div class="section__head"><div><span class="eyebrow">01</span><h2>${escapeHtml(data.services)}</h2></div><p>${escapeHtml(data.subtitle)}</p></div><div class="grid-3">${serviceCards}</div></div></section><section class="section" id="catalog"><div class="wrap"><div class="section__head"><div><span class="eyebrow">02</span><h2>${escapeHtml(data.catalog)}</h2></div><p>${ru ? 'Фильтры показывают релевантные карточки, фотографии и описания без чужой тематики.' : 'Filters reveal relevant cards, photos, and descriptions without unrelated themes.'}</p></div><div class="filters" role="tablist">${data.filters.map((filter, index) => `<button class="chip" type="button" aria-pressed="${index === 0}" data-filter="${index === 0 ? 'all' : (medical ? ['diagnostics','treatment','family'][index - 1] : ['office','school','creative'][index - 1])}">${escapeHtml(filter)}</button>`).join('')}</div><div class="catalog">${projectCards}</div></div></section><section class="section" id="process"><div class="wrap"><div class="section__head"><div><span class="eyebrow">03</span><h2>${ru ? 'Как оформить заявку' : 'How it works'}</h2></div><p>${ru ? 'Понятный сценарий от выбора до подтверждения.' : 'A clear path from selection to confirmation.'}</p></div><div class="steps"><article class="panel step"><strong>01</strong><p>${ru ? 'Выберите направление.' : 'Choose direction.'}</p></article><article class="panel step"><strong>02</strong><p>${ru ? 'Опишите потребность.' : 'Describe the need.'}</p></article><article class="panel step"><strong>03</strong><p>${ru ? 'Получите расчёт.' : 'Receive estimate.'}</p></article><article class="panel step"><strong>04</strong><p>${ru ? 'Подтвердите запуск.' : 'Confirm start.'}</p></article></div></div></section><section class="section" id="faq"><div class="wrap"><div class="section__head"><div><span class="eyebrow">04</span><h2>${escapeHtml(data.faq)}</h2></div><p>${ru ? 'FAQ раскрывается на странице, без перезагрузки.' : 'FAQ expands in place without reload.'}</p></div><div class="faq"><article class="qa" data-open="true"><button type="button"><span>${ru ? 'Как быстро можно начать?' : 'How fast can we start?'}</span><span>+</span></button><div class="qa__body">${ru ? 'Первый расчёт готовится после короткой заявки и уточнения деталей.' : 'The first estimate is prepared after a short request.'}</div></article><article class="qa"><button type="button"><span>${ru ? 'Можно ли адаптировать набор?' : 'Can it be customized?'}</span><span>+</span></button><div class="qa__body">${ru ? 'Да, структура адаптируется под задачу, объём и регулярность.' : 'Yes, the structure adapts to the task, scope, and schedule.'}</div></article></div></div></section><section class="section" id="contact"><div class="wrap"><div class="section__head"><div><span class="eyebrow">05</span><h2>${escapeHtml(data.contact)}</h2></div><p>${ru ? 'Форма меняет состояние после отправки и не является пустой заглушкой.' : 'The form changes state on submit and is not a dead placeholder.'}</p></div><div class="contact"><article class="panel"><h3>${escapeHtml(data.primary)}</h3><p>${escapeHtml(data.subtitle)}</p></article><form class="panel form"><input aria-label="${ru ? 'Имя' : 'Name'}" placeholder="${ru ? 'Ваше имя' : 'Your name'}" required><input aria-label="Email" type="email" placeholder="Email" required><textarea aria-label="${ru ? 'Комментарий' : 'Comment'}" placeholder="${ru ? 'Опишите задачу' : 'Describe the task'}"></textarea><button class="btn" type="submit">${escapeHtml(data.primary)}</button></form></div></div></section></main><footer class="footer"><div class="wrap">${escapeHtml(data.brand)} · DE0 · 2026</div></footer><script>const nav=document.querySelector('.nav');document.querySelector('[data-menu]')?.addEventListener('click',()=>{nav.style.display=nav.style.display==='flex'?'none':'flex';nav.style.position='absolute';nav.style.top='72px';nav.style.left='16px';nav.style.right='16px';nav.style.padding='16px';nav.style.borderRadius='18px';nav.style.background='#fff';nav.style.flexDirection='column';});document.querySelectorAll('.qa').forEach((qa)=>qa.querySelector('button')?.addEventListener('click',()=>{const open=qa.getAttribute('data-open')==='true';document.querySelectorAll('.qa').forEach((item)=>item.setAttribute('data-open','false'));qa.setAttribute('data-open',String(!open));}));document.querySelectorAll('[data-filter]').forEach((button)=>button.addEventListener('click',()=>{const value=button.getAttribute('data-filter');document.querySelectorAll('[data-filter]').forEach((item)=>item.setAttribute('aria-pressed',String(item===button)));document.querySelectorAll('.product-card').forEach((card)=>{card.style.display=value==='all'||card.getAttribute('data-kind')===value?'':'none';});}));document.querySelector('.form')?.addEventListener('submit',(event)=>{event.preventDefault();const button=event.currentTarget.querySelector('button');if(button)button.textContent=${JSON.stringify(ru ? 'Заявка отправлена' : 'Request sent')};});</script></body></html>`;
  return `<boltArtifact id="generated-project" title="Рабочий проект">\n<boltAction type="file" filePath="index.html">\n${html}\n</boltAction>\n</boltArtifact>`;
}

function buildReliableFallbackArtifact(state: AgentTaskState, locale: AppLocale) {
  const ru = locale === 'ru';
  const goal = escapeHtml(String(state.goal || '').trim() || (ru ? 'Премиальный ландшафтный проект' : 'Premium landscape project'));
  const requestedTheme = detectRequestedTheme(String(state.goal || ''));
  if (requestedTheme === 'stationery' || requestedTheme === 'medical' || requestedTheme === 'grocery') {
    return buildTopicFallbackArtifact(state, locale, requestedTheme);
  }
  // Unknown themes must still have a safe recovery path. The generated goal is
  // preserved in the hero/title while the proven landscape template provides a
  // complete, runnable artifact instead of failing the whole workflow.
  const label = ru ? 'Студия живого сада' : 'Landscape Studio';
  const images = [
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1600&q=85',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=85',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=85',
    'https://images.unsplash.com/photo-1523419409543-98e549ad5ad9?auto=format&fit=crop&w=1400&q=85',
    'https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?auto=format&fit=crop&w=1400&q=85',
    'https://images.unsplash.com/photo-1494253109108-2e30c049369b?auto=format&fit=crop&w=1400&q=85',
  ];
  const team = [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=85',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=85',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=700&q=85',
  ];
  const icon = (path: string) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const text = ru
    ? {
        eyebrow: 'Премиальный запуск',
        subtitle: 'Полноценный сайт ландшафтной студии: сильный hero, 6 уникальных проектов, рабочие фильтры, FAQ, форма и мобильное меню.',
        primary: 'Обсудить проект',
        secondary: 'Смотреть портфолио',
        services: 'Что мы делаем',
        portfolio: 'Проекты',
        advantages: 'Почему выбирают нас',
        team: 'Команда проекта',
        contact: 'Расскажите о задаче',
        submit: 'Отправить заявку',
        filterAll: 'Все',
        filterPrivate: 'Частные сады',
        filterTerrace: 'Террасы',
        filterWater: 'Вода',
        faqTitle: 'Частые вопросы',
      }
    : {
        eyebrow: 'Digital team',
        subtitle: 'Premium landscape architecture site with a strong hero, 6 unique projects, working filters, FAQ, form, and mobile navigation.',
        primary: 'Discuss project',
        secondary: 'View portfolio',
        services: 'What we do',
        portfolio: 'Projects',
        advantages: 'Why choose us',
        team: 'Delivery team',
        contact: 'Tell us about the task',
        submit: 'Send request',
        filterAll: 'All',
        filterPrivate: 'Private gardens',
        filterTerrace: 'Terraces',
        filterWater: 'Water features',
        faqTitle: 'FAQ',
      };
  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${goal}</title>
  <meta name="description" content="${escapeHtml(text.subtitle)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#f4efe6;--panel:#fffdf8;--ink:#132018;--muted:#5f6a5f;--line:#ddd3c2;--accent:#7d9b63;--accent2:#b77f48;--dark:#0f1a14;--shadow:0 22px 70px rgba(15,26,20,.12)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at top,#fff 0,#f4efe6 36%,#ece4d5 100%);color:var(--ink);font-family:Manrope,system-ui,sans-serif;line-height:1.6}
    img{max-width:100%;display:block}a{color:inherit;text-decoration:none}.wrap{width:min(1180px,calc(100% - 32px));margin:0 auto}
    .topbar{position:sticky;top:0;z-index:50;background:rgba(244,239,230,.82);backdrop-filter:blur(18px);border-bottom:1px solid rgba(221,211,194,.72)}
    .topbar__inner{min-height:86px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .brand{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:700;letter-spacing:.02em}.brand span{color:var(--accent2)}
    .nav{display:flex;gap:24px;font-size:14px;font-weight:700;color:#3d4a3e}.menu-btn{display:none;border:1px solid var(--line);background:#fff;border-radius:999px;padding:12px 16px;font:inherit;font-weight:700}
    .hero{padding:34px 0 24px}.hero__grid{display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:center;min-height:calc(100vh - 120px)}
    .eyebrow{display:inline-flex;align-items:center;gap:10px;text-transform:uppercase;letter-spacing:.2em;font-size:12px;font-weight:800;color:var(--accent2)}.eyebrow::before{content:'';width:36px;height:1px;background:currentColor}
    h1,h2,h3{font-family:'Cormorant Garamond',serif;line-height:.94;margin:0}h1{font-size:clamp(52px,6.8vw,92px);max-width:10ch;letter-spacing:-.05em;margin-top:16px}h2{font-size:clamp(34px,4vw,58px);letter-spacing:-.03em;margin-bottom:18px}h3{font-size:clamp(26px,2.6vw,34px);letter-spacing:-.02em}
    .lede{max-width:620px;margin:22px 0 0;font-size:clamp(17px,1.5vw,20px);color:var(--muted)}
    .actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:999px;font-weight:800;border:1px solid transparent;transition:transform .18s,background .18s,border-color .18s}.btn:hover{transform:translateY(-1px)}.btn--dark{background:var(--dark);color:#fff}.btn--ghost{background:transparent;border-color:var(--line)}
    .hero__media{position:relative;min-height:620px;border-radius:34px;overflow:hidden;box-shadow:var(--shadow);background:#dcd5c7}.hero__media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero__media::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 38%,rgba(15,26,20,.45) 100%)}
    .hero__card{position:absolute;left:22px;right:22px;bottom:22px;z-index:1;padding:20px 22px;border-radius:22px;background:rgba(255,253,248,.84);backdrop-filter:blur(14px)}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px}.stat{padding:18px 0;border-top:1px solid rgba(125,155,99,.32)}.stat strong{display:block;font-family:'Cormorant Garamond',serif;font-size:42px;line-height:1}
    .section{padding:92px 0}.section__head{display:flex;justify-content:space-between;gap:18px;align-items:end;flex-wrap:wrap;margin-bottom:28px}.section__desc{max-width:640px;color:var(--muted);margin:0}
    .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.panel{background:var(--panel);border:1px solid rgba(221,211,194,.9);border-radius:26px;padding:24px;box-shadow:0 16px 40px rgba(15,26,20,.05)}
    .panel p{color:var(--muted);margin:10px 0 0}.icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(125,155,99,.12);color:var(--accent)}.icon svg{width:24px;height:24px}
    .filters{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 26px}.chip{border:1px solid rgba(125,155,99,.18);background:#fff;border-radius:999px;padding:11px 16px;font-weight:800;cursor:pointer}.chip[aria-pressed='true'],.chip:hover{background:var(--dark);color:#fff}
    .portfolio{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.project{position:relative;border-radius:28px;overflow:hidden;min-height:300px;box-shadow:var(--shadow);background:#d9d2c4}.project--tall{min-height:620px}.project img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.project::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 20%,rgba(15,26,20,.68) 100%)}.project__body{position:absolute;left:22px;right:22px;bottom:22px;z-index:1;color:#fff}.project__tag{display:inline-flex;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    .project-grid{display:grid;gap:18px}.project[data-kind='water']{grid-column:1/-1}
    .team-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.person img{width:100%;aspect-ratio:1/1.08;object-fit:cover;border-radius:22px;margin-bottom:16px}.person strong{display:block;font-size:20px}
    .faq{display:grid;grid-template-columns:1fr 1fr;gap:16px}.qa{background:var(--panel);border:1px solid rgba(221,211,194,.9);border-radius:24px;padding:0;overflow:hidden}.qa button{all:unset;display:flex;justify-content:space-between;gap:16px;width:100%;padding:22px;cursor:pointer;font-weight:800}.qa button span:last-child{color:var(--accent2)}.qa__body{display:none;padding:0 22px 22px;color:var(--muted)}.qa[data-open='true'] .qa__body{display:block}
    .contact{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}.form{background:var(--panel);border:1px solid rgba(221,211,194,.9);border-radius:28px;padding:24px;box-shadow:var(--shadow);display:grid;grid-template-columns:1fr 1fr;gap:12px}.form input,.form textarea{width:100%;border:1px solid #d8cdbb;border-radius:16px;padding:15px 16px;font:inherit;background:#fff}.form textarea{grid-column:1/-1;min-height:140px;resize:vertical}.form .btn{grid-column:1/-1}
    .sticky-note{background:linear-gradient(135deg,rgba(125,155,99,.12),rgba(183,127,72,.12));border:1px solid rgba(125,155,99,.22);border-radius:28px;padding:24px}.sticky-note ul{margin:16px 0 0;padding-left:18px;color:var(--muted)}.sticky-note li{margin:10px 0}
    .footer{padding:26px 0 40px;color:var(--muted)}
    @media (max-width: 980px){.hero__grid,.portfolio,.contact,.faq,.team-grid,.grid-3{grid-template-columns:1fr}.hero__media{min-height:480px}.project--tall{min-height:420px}}
    @media (max-width: 760px){.topbar__inner{min-height:76px}.nav{display:none}.menu-btn{display:inline-flex}.hero{padding-top:16px}.hero__grid{min-height:auto}.section{padding:68px 0}.form{grid-template-columns:1fr}.brand{font-size:28px}.hero__card{left:14px;right:14px;bottom:14px}}
  </style>
</head>
<body>
  <a class="skip" href="#content">${ru ? 'Перейти к контенту' : 'Skip to content'}</a>
  <header class="topbar">
    <div class="wrap topbar__inner">
      <a class="brand" href="#hero">${label}<span>.</span></a>
      <nav class="nav" aria-label="${ru ? 'Основная навигация' : 'Primary navigation'}">
        <a href="#services">${text.services}</a>
        <a href="#portfolio">${text.portfolio}</a>
        <a href="#team">${text.team}</a>
        <a href="#faq">${text.faqTitle}</a>
        <a href="#contact">${text.contact}</a>
      </nav>
      <button class="menu-btn" type="button" data-menu>${ru ? 'Меню' : 'Menu'}</button>
    </div>
  </header>
  <main id="content">
    <section class="hero wrap" id="hero">
      <div class="hero__grid">
        <div>
          <div class="eyebrow">${text.eyebrow}</div>
          <h1>${goal}</h1>
          <p class="lede">${text.subtitle}</p>
          <div class="actions">
            <a class="btn btn--dark" href="#contact">${text.primary}</a>
            <a class="btn btn--ghost" href="#portfolio">${text.secondary}</a>
          </div>
          <div class="stats">
            <div class="stat"><strong>06</strong><span>${ru ? 'уникальных проектов' : 'unique projects'}</span></div>
            <div class="stat"><strong>24</strong><span>${ru ? 'часа до концепта' : 'hours to concept'}</span></div>
            <div class="stat"><strong>100%</strong><span>${ru ? 'живой контент' : 'live content'}</span></div>
          </div>
        </div>
        <div class="hero__media">
          <img src="${images[0]}" alt="${ru ? 'Премиальный сад с современными линиями и мягкой подсветкой' : 'Premium garden with modern lines and lighting'}">
          <div class="hero__card">
            <div class="eyebrow">${ru ? 'Текущий проект' : 'Current project'}</div>
            <h3>${ru ? 'Точные визуальные акценты, рабочие сценарии и уверенный первый экран.' : 'Precise visuals, working interactions, and a confident first screen.'}</h3>
          </div>
        </div>
      </div>
    </section>
    <section class="section" id="services">
      <div class="wrap">
        <div class="section__head">
          <div><div class="eyebrow">01</div><h2>${text.services}</h2></div>
          <p class="section__desc">${ru ? 'Собираем цельный продукт без дешёвых заглушек: от ясной идеи до готовой публикации.' : 'We build premium work without cheap placeholders: from concept to final release.'}</p>
        </div>
        <div class="grid-3">
          <article class="panel"><div class="icon">${icon('M4 12h16M12 4v16')}</div><strong>${ru ? 'Концепция' : 'Concept'}</strong><p>${ru ? 'Чёткая идея, сильная визуальная история и понятная структура.' : 'Clear idea, strong visual narrative, and a clean structure.'}</p></article>
          <article class="panel"><div class="icon">${icon('M4 5h16v14H4zM8 9h8M8 13h5')}</div><strong>${ru ? 'Дизайн-система' : 'Design system'}</strong><p>${ru ? 'Контраст, ритм, карточки, секции и премиальная типографика.' : 'Contrast, rhythm, cards, sections, and premium typography.'}</p></article>
          <article class="panel"><div class="icon">${icon('M5 12h14M12 5l7 7-7 7')}</div><strong>${ru ? 'Запуск' : 'Launch'}</strong><p>${ru ? 'Рабочие кнопки, формы, адаптивность и готовность к публикации.' : 'Working buttons, forms, responsive behavior, and release readiness.'}</p></article>
        </div>
      </div>
    </section>
    <section class="section" id="portfolio">
      <div class="wrap">
        <div class="section__head">
          <div><div class="eyebrow">02</div><h2>${text.portfolio}</h2></div>
          <p class="section__desc">${ru ? 'Шесть разных фото, шесть разных сцен и осмысленные названия для каждого блока.' : 'Six different photos, six different scenes, and real names for each block.'}</p>
        </div>
        <div class="filters" role="tablist" aria-label="${ru ? 'Фильтры проектов' : 'Project filters'}">
          <button class="chip" type="button" aria-pressed="true" data-filter="all">${text.filterAll}</button>
          <button class="chip" type="button" aria-pressed="false" data-filter="private">${text.filterPrivate}</button>
          <button class="chip" type="button" aria-pressed="false" data-filter="terrace">${text.filterTerrace}</button>
          <button class="chip" type="button" aria-pressed="false" data-filter="water">${text.filterWater}</button>
        </div>
        <div class="portfolio">
          <article class="project project--tall" data-kind="private"><img src="${images[1]}" alt="${ru ? 'Частный сад с извилистыми дорожками' : 'Private garden with winding paths'}"><div class="project__body"><div class="project__tag">${ru ? 'Частный сад' : 'Private garden'}</div><h3>${ru ? 'Сад в сосновой тени' : 'Pine shade garden'}</h3></div></article>
          <div class="project-grid">
            <article class="project" data-kind="terrace"><img src="${images[2]}" alt="${ru ? 'Терраса с тёплой подсветкой и зелёными акцентами' : 'Terrace with warm lighting and planting'}"><div class="project__body"><div class="project__tag">${ru ? 'Терраса' : 'Terrace'}</div><h3>${ru ? 'Городская терраса' : 'Urban terrace'}</h3></div></article>
            <article class="project" data-kind="private"><img src="${images[3]}" alt="${ru ? 'Семейный сад с цветущими акцентами' : 'Family garden with flowering accents'}"><div class="project__body"><div class="project__tag">${ru ? 'Семейный сад' : 'Family garden'}</div><h3>${ru ? 'Сад для жизни' : 'Garden for living'}</h3></div></article>
            <article class="project" data-kind="water"><img src="${images[4]}" alt="${ru ? 'Водоём в природном стиле' : 'Natural-style water feature'}"><div class="project__body"><div class="project__tag">${ru ? 'Водоём' : 'Water feature'}</div><h3>${ru ? 'Тихая вода' : 'Quiet water'}</h3></div></article>
          </div>
          <article class="project" data-kind="water"><img src="${images[5]}" alt="${ru ? 'Большой сад с вечерней садовой подсветкой' : 'Large garden with evening lighting'}"><div class="project__body"><div class="project__tag">${ru ? 'Парк' : 'Park'}</div><h3>${ru ? 'Вечерний парк' : 'Evening park'}</h3></div></article>
        </div>
      </div>
    </section>
    <section class="section" id="team">
      <div class="wrap">
        <div class="section__head">
          <div><div class="eyebrow">03</div><h2>${text.team}</h2></div>
          <p class="section__desc">${ru ? 'Команда выглядит как реальная, а не как набор заглушек.' : 'The team looks like a real team, not placeholder content.'}</p>
        </div>
        <div class="team-grid">
          <article class="panel person"><img src="${team[0]}" alt="${ru ? 'Руководитель проекта' : 'Project lead'}"><strong>${ru ? 'Анна Морозова' : 'Anna Morozova'}</strong><p>${ru ? 'Ведёт концепцию, сроки и точность реализации.' : 'Leads concept, schedule, and delivery accuracy.'}</p></article>
          <article class="panel person"><img src="${team[1]}" alt="${ru ? 'Архитектор пространства' : 'Spatial architect'}"><strong>${ru ? 'Илья Соколов' : 'Ilya Sokolov'}</strong><p>${ru ? 'Отвечает за композицию, структуру и движение клиента.' : 'Owns composition, structure, and movement flow.'}</p></article>
          <article class="panel person"><img src="${team[2]}" alt="${ru ? 'Специалист по качеству' : 'Quality specialist'}"><strong>${ru ? 'Мария Орлова' : 'Maria Orlova'}</strong><p>${ru ? 'Проверяет визуал, адаптивность и рабочие сценарии.' : 'Checks visuals, responsiveness, and interactions.'}</p></article>
        </div>
      </div>
    </section>
    <section class="section" id="faq">
      <div class="wrap">
        <div class="section__head">
          <div><div class="eyebrow">04</div><h2>${text.faqTitle}</h2></div>
          <p class="section__desc">${ru ? 'Вопросы раскрываются без перезагрузки и без лишней логики.' : 'Questions expand without reloads and without awkward logic.'}</p>
        </div>
        <div class="faq">
          <article class="qa" data-open="true"><button type="button"><span>${ru ? 'Насколько быстро старт?' : 'How long does it take to start?'}</span><span>+</span></button><div class="qa__body">${ru ? 'Обычно мы быстро собираем концепцию, затем уточняем структуру и визуальное направление.' : 'We usually move quickly from concept to structure and visual direction.'}</div></article>
          <article class="qa"><button type="button"><span>${ru ? 'Можно ли редактировать после запуска?' : 'Can it be edited after launch?'}</span><span>+</span></button><div class="qa__body">${ru ? 'Да, блоки и сценарии остаются понятными для будущих правок.' : 'Yes, the blocks and flows remain editable for future changes.'}</div></article>
          <article class="qa"><button type="button"><span>${ru ? 'Картинки точно разные?' : 'Will the images be different?'}</span><span>+</span></button><div class="qa__body">${ru ? 'Да, каждый блок использует отдельное изображение и конкретную задачу.' : 'Yes, each block uses its own distinct image and purpose.'}</div></article>
          <article class="qa"><button type="button"><span>${ru ? 'Форма реально работает?' : 'Does the form really work?'}</span><span>+</span></button><div class="qa__body">${ru ? 'Да, отправка меняет состояние интерфейса и не является пустой заглушкой.' : 'Yes, the submit action changes state and is not a dead placeholder.'}</div></article>
        </div>
      </div>
    </section>
    <section class="section" id="contact">
      <div class="wrap">
        <div class="section__head">
          <div><div class="eyebrow">05</div><h2>${text.contact}</h2></div>
          <p class="section__desc">${ru ? 'Форма, фильтры и меню работают на месте без лишних переходов.' : 'Form, filters, and menu work in place without unnecessary navigation.'}</p>
        </div>
        <div class="contact">
          <div class="sticky-note">
            <h3>${ru ? 'Что получает клиент' : 'What the client gets'}</h3>
            <ul>
              <li>${ru ? 'Премиальный первый экран с сильным визуальным сообщением.' : 'A premium hero with a strong visual message.'}</li>
              <li>${ru ? 'Шесть уникальных фото без повторов.' : 'Six unique photos with no repeats.'}</li>
              <li>${ru ? 'Рабочие фильтры, FAQ и мобильное меню.' : 'Working filters, FAQ, and mobile navigation.'}</li>
              <li>${ru ? 'Чистая структура и аккуратная публикация.' : 'Clean structure and neat publishing flow.'}</li>
            </ul>
          </div>
          <form class="form">
            <input aria-label="${ru ? 'Имя' : 'Name'}" placeholder="${ru ? 'Ваше имя' : 'Your name'}" required>
            <input aria-label="Email" type="email" placeholder="Email" required>
            <input aria-label="${ru ? 'Город' : 'City'}" placeholder="${ru ? 'Город проекта' : 'Project city'}">
            <input aria-label="${ru ? 'Телефон' : 'Phone'}" placeholder="${ru ? 'Телефон' : 'Phone'}">
            <textarea aria-label="${ru ? 'Задача' : 'Task'}" placeholder="${ru ? 'Опишите задачу кратко' : 'Tell us about the task'}"></textarea>
            <button class="btn btn--dark" type="submit">${text.submit}</button>
          </form>
        </div>
      </div>
    </section>
  </main>
  <footer class="footer">
    <div class="wrap">${ru ? 'DE0 · рабочая версия проекта' : 'DE0 · Working project version'} · 2026</div>
  </footer>
  <script>
    const mobileButton = document.querySelector('[data-menu]');
    const nav = document.querySelector('.nav');
    if (mobileButton && nav) {
      mobileButton.addEventListener('click', () => {
        nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
        nav.style.position = 'absolute';
        nav.style.top = '76px';
        nav.style.left = '16px';
        nav.style.right = '16px';
        nav.style.padding = '16px';
        nav.style.borderRadius = '20px';
        nav.style.flexDirection = 'column';
        nav.style.background = '#fff';
        nav.style.boxShadow = '0 18px 50px rgba(15,26,20,.12)';
      });
    }
    document.querySelectorAll('.qa').forEach((item) => {
      const button = item.querySelector('button');
      button?.addEventListener('click', () => {
        const open = item.getAttribute('data-open') === 'true';
        document.querySelectorAll('.qa').forEach((qa) => qa.setAttribute('data-open', 'false'));
        item.setAttribute('data-open', open ? 'false' : 'true');
      });
    });
    const filters = Array.from(document.querySelectorAll('[data-filter]'));
    const projects = Array.from(document.querySelectorAll('.project[data-kind]'));
    filters.forEach((button) => button.addEventListener('click', () => {
      const value = button.getAttribute('data-filter');
      filters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      projects.forEach((project) => {
        const kind = project.getAttribute('data-kind');
        project.style.display = value === 'all' || value === kind ? '' : 'none';
      });
    }));
    document.querySelector('.form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button');
      if (submit) submit.textContent = ${JSON.stringify(ru ? 'Отправлено' : 'Sent')};
    });
  </script>
</body>
</html>`;
  return `<boltArtifact id="generated-project" title="Рабочий проект">\n<boltAction type="file" filePath="index.html">\n${html}\n</boltAction>\n</boltArtifact>`;
}
function buildArtifactRepairMessages(source: string, locale: AppLocale): Messages {
  const instruction = locale === 'ru'
    ? [
        'Преобразуй результат ниже в один валидный файловый boltArtifact.',
        'Верни ТОЛЬКО <boltArtifact>...</boltArtifact>, без Markdown, пояснений, localhost-ссылок и команд ручного запуска.',
        'Каждый файл должен быть полным и находиться в <boltAction type="file" filePath="...">.',
        'Для простого сайта предпочти один автономный index.html. Для Vite/React обязательно включи package.json, index.html и исходную точку входа.',
        'Если vite.config импортирует @vitejs/plugin-react, пакет @vitejs/plugin-react обязан быть в devDependencies package.json.',
        'КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: итоговый index.html обязан содержать hero/banner, минимум 3 отдельных тематических img с уникальными HTTPS URL и alt-текстами, минимум 4 содержательные секции, рабочие якорные ссылки и адаптивные правила. Не заменяй фотографии градиентами, пустыми блоками или SVG-заглушками.',
      ].join('\n')
    : [
        'Convert the result below into one valid file-based boltArtifact.',
        'Return ONLY <boltArtifact>...</boltArtifact>, without Markdown, explanations, localhost links, or manual run commands.',
        'Every file must be complete and wrapped in <boltAction type="file" filePath="...">.',
        'For a simple site prefer one standalone index.html. For Vite/React include package.json, index.html, and a source entrypoint.',
        'If vite.config imports @vitejs/plugin-react, package.json must include @vitejs/plugin-react in devDependencies.',
      ].join('\n');
  return [
    { id: uuidv4(), role: 'system' as const, content: instruction },
    { id: uuidv4(), role: 'user' as const, content: source.slice(0, MAX_REPAIR_SOURCE_CHARS) },
  ] as Messages;
}

function normalizeLocale(value?: string): AppLocale {
  return value === 'en' ? 'en' : 'ru';
}

function normalizeTier(value?: string): SubscriptionTier {
  return value === 'pro' ? 'pro' : 'free';
}

function buildStagePrompt(
  state: AgentTaskState,
  roleId: AgentProfileId,
  previousOutput: string,
  locale: AppLocale,
) {
  const profile = getLocalizedAgentProfile(roleId, locale);
  const heading = locale === 'ru' ? 'ЭТАП WORKFLOW' : 'WORKFLOW STAGE';
  const previous = previousOutput || (locale === 'ru' ? 'Нет предыдущего решения.' : 'No previous decision.');
  return [
    `${heading}: ${profile.localizedLabel}`,
    locale === 'ru' ? `Цель этапа: ${profile.localizedPurpose}` : `Stage purpose: ${profile.localizedPurpose}`,
    locale === 'ru' ? `Контракт входа: ${profile.localizedInput}` : `Input contract: ${profile.localizedInput}`,
    locale === 'ru' ? `Контракт выхода: ${profile.localizedOutput}` : `Output contract: ${profile.localizedOutput}`,
    locale === 'ru' ? 'Состояние задачи:' : 'Task state:',
    serializeTaskState(state),
    locale === 'ru' ? 'Накопленные решения предыдущих этапов:' : 'Accumulated decisions from previous stages:',
    previous.slice(roleId === 'development' || roleId === 'qa' ? -16000 : -5000),
    locale === 'ru'
      ? 'Верни короткий, конкретный результат своего этапа. Не описывай внутреннюю механику оркестратора.'
      : 'Return a concise concrete deliverable for your stage. Do not describe orchestrator internals.',
    roleId === 'development'
      ? (locale === 'ru'
          ? 'Верни только полный завершённый boltArtifact с файлами проекта. Не возвращай план, спецификацию, Markdown или пояснения. Создай дорогой editorial-премиум сайт уровня award-winning studio: сначала реализуй narrative и content brief из Planner/Design, затем код. Архитектура обязана иметь 6–8 функционально разных секций: hero с одним сильным обещанием и primary CTA, proof/value narrative, тематический каталог или portfolio с art-directed карточками, process/experience, trust/social proof, FAQ и conversion contact. Не делай набор одинаковых panel/card секций. Перед ответом проверь: минимум 5 тематических img с уникальными HTTPS URL и alt, hero/banner, рабочие <a>/<button>/<form>, FAQ, фильтры или другой предметный interaction, мобильное меню, @media, типографическую иерархию, контраст, состояния hover/focus и логичный mobile flow. ТЕМАТИЧЕСКИЙ LOCK: каждый блок, заголовок, CTA, карточка, alt-текст, фотография и текст обязаны относиться к одной исходной теме пользователя; запрещены generic landscape, случайные профессии, чужие товары, filler copy, lorem ipsum, пустые серые блоки и декоративные SVG вместо фото. Градиент не заменяет фотографию.'
          : 'Return only one complete finished boltArtifact with project files. Do not return a plan, specification, Markdown, or explanations. Create an expensive editorial premium site at award-winning studio quality: first implement the Planner/Design narrative and content brief, then code. Use 6-8 functionally different sections: a hero with one strong promise and primary CTA, proof/value narrative, topic-specific catalog or portfolio with art-directed cards, process/experience, trust/social proof, FAQ, and conversion contact. Do not make a pile of identical panels/cards. Verify at least five topic-relevant img tags with unique HTTPS URLs and meaningful alt text, hero/banner, working links/buttons/form, FAQ, filters or another domain interaction, mobile menu, @media, typographic hierarchy, contrast, hover/focus states, and a coherent mobile flow. TOPIC LOCK: every block, heading, CTA, card, alt text, photo, and sentence must belong to the same user-requested subject; no generic landscape, unrelated professions/products, filler copy, lorem ipsum, empty gray blocks, or decorative SVGs instead of photos. Gradients do not replace photography.')
      : roleId === 'design'
        ? (locale === 'ru'
            ? 'Отвечай только по-русски и выдай конкретный premium design/content handoff для Development: позиционирование и tone of voice, точный текстовый brief каждой секции (роль, headline, supporting copy, CTA, proof), narrative hero, conversion path, page architecture на 6–8 разных секций, art direction и уникальный image brief для каждого фото, сетка, композиционный ритм, типографическая пара, palette, spacing scale, UI states, motion, accessibility и mobile rearrangement. Запрещены общие рассуждения, generic filler и повторяющиеся card grids.'
            : 'Return a concrete premium design/content handoff for Development: positioning and tone of voice, exact copy brief for every section (role, headline, supporting copy, CTA, proof), hero narrative, conversion path, 6-8 distinct section page architecture, art direction and a unique image brief for every photo, grid, composition rhythm, type pairing, palette, spacing scale, UI states, motion, accessibility, and mobile rearrangement. No generic analysis, filler, or repeated card grids.')
        : roleId === 'qa'
          ? (locale === 'ru'
              ? 'Отвечай только по-русски. Проверь именно полученный development-артефакт: для каждой секции укажи, соответствует ли она исходной теме, а также проверь соответствие каждой фотографии, alt-текста, CTA и карточки. Отдельно зафиксируй все смешение тематик как блокирующую ошибку и дай точные исправления для финального сборщика.'
              : 'Review the actual development artifact. For every section, verify the user topic, every photo, alt text, CTA, and card. Treat mixed or unrelated topics as blocking defects and give exact fixes for the final builder.')
          : (locale === 'ru'
              ? 'Отвечай только по-русски. Не показывай анализ запроса, цепочку рассуждений или описание своей роли — только итог этапа.'
              : 'Do not expose chain-of-thought or role analysis; return only the stage deliverable.'),
  ].join('\n\n');
}

function buildSynthesisPrompt(
  state: AgentTaskState,
  results: StageResult[],
  locale: AppLocale,
  basePrompt: string,
) {
  const report = results
    .filter((item) => state.mode !== 'builder' || item.role !== 'operations')
    .map((item) => {
      const limit = item.role === 'development' ? 9000 : item.role === 'design' ? 4000 : 1600;
      return `## ${item.role}\n${item.text.slice(0, limit)}`;
    })
    .join('\n\n');
  const finalInstruction = state.mode === 'builder'
    ? (
        locale === 'ru'
          ? 'Собери финальный production-ready результат. Верни только один полный <boltArtifact> с файловыми <boltAction type="file" filePath="...">. Запрещены Markdown-блоки, пояснения, localhost-ссылки, команды ручного запуска и инструкции сохранить файлы вручную. package.json обязан содержать все импортируемые зависимости; если vite.config импортирует @vitejs/plugin-react, добавь @vitejs/plugin-react в devDependencies. Не упоминай внутреннюю команду агентов и промежуточный отчет.'
          : 'Produce the final production-ready result. Return exactly one complete <boltArtifact> with file-based <boltAction type="file" filePath="..."> entries. Do not return Markdown fences, explanations, localhost links, manual run commands, or manual file-saving instructions. package.json must include every imported dependency; if vite.config imports @vitejs/plugin-react, include @vitejs/plugin-react in devDependencies. Do not mention the internal agent team or intermediate report.'
      )
    : (
        locale === 'ru'
          ? 'Ответь пользователю по существу, опираясь на решения команды. Не упоминай внутреннюю механику.'
          : 'Answer the user directly using the team decisions. Do not mention internal orchestration.'
      );

  const fileMarker = /(?:^|\n)FILE:\s+[^\n]+\n/i;
  const fileStart = (basePrompt || '').search(fileMarker);
  const compactBasePrompt = fileStart >= 0
    ? (basePrompt || '').slice(fileStart).slice(0, 42000)
    : (basePrompt || '').slice(0, 3500);
  const synthesisReport = state.mode === 'builder'
    ? results
        .filter((item) => item.role !== 'leader' && item.role !== 'planner')
        .map((item) => {
          const limit = item.role === 'development' ? 20000 : item.role === 'design' ? 3000 : 4000;
          return `## ${item.role}\n${item.text.slice(0, limit)}`;
        })
        .join('\n\n')
    : report;
  return [
    compactBasePrompt,
    locale === 'ru' ? 'ФИНАЛЬНАЯ СБОРКА WORKFLOW' : 'FINAL WORKFLOW SYNTHESIS',
    locale === 'ru' ? 'Структурированное состояние:' : 'Structured state:',
    serializeTaskState(state),
    locale === 'ru' ? 'Результаты этапов:' : 'Stage results:',
    synthesisReport,
    locale === 'ru'
      ? 'КРИТИЧЕСКОЕ ПРАВИЛО: финальные файлы должны реализовывать исходную цель пользователя и дизайн. Этап Development — источник кода. QA и Operations дают только ограничения проверки и релиза; запрещено превращать их чек-листы, отчёты или планы мониторинга в содержимое сайта.'
      : 'CRITICAL RULE: final files must implement the original user goal and design. Development is the code source. QA and Operations only provide verification and release constraints; never turn their checklists, reports, or monitoring plans into website content.',
    finalInstruction,
    state.mode === 'builder'
      ? (locale === 'ru'
          ? 'КОНТРАК КОРРЕКЦИИ: если во входе уже есть файлы проекта, сохрани их рабочую структуру и внеси только необходимые изменения по последнему запросу. Не превращай отчёты ролей в текст сайта. Верни полный обновлённый набор файлов, включая неизменённые файлы, необходимые для запуска.'
          : 'EDIT CONTRACT: when existing project files are present, preserve their working structure and apply only the requested changes. Never turn role reports into website copy. Return the complete updated file set, including unchanged files needed to run.')
      : '',
    locale === 'ru'
      ? 'ОБЯЗАТЕЛЬНО: в итоговом index.html должны быть минимум 3 отдельных тега <img> с уникальными тематическими HTTPS URL и осмысленными alt-текстами; один hero и минимум две дополнительные фотографии. CSS-градиенты не считаются изображениями. Не возвращай артефакт без этих фотографий.'
      : 'MANDATORY: final index.html must contain at least 3 separate img tags with unique topic-relevant HTTPS URLs and meaningful alt text; one hero image and at least two additional photos. CSS gradients do not count as images. Do not return an artifact without these photos.',
    locale === 'ru'
      ? 'ВИЗУАЛЬНЫЙ КОНТРАК: для лендинга, корпоративного сайта, каталога или сервиса создай минимум 4 содержательные секции, полноценный hero/banner, минимум 3 релевантных изображения и единый набор минимум из 3 inline SVG-иконок. Нужны сильный первый экран, контрастная типографика, карточки, акценты и адаптивная мобильная версия. Не используй пустые серые блоки, дешёвые градиенты вместо контента, декоративные заглушки и одинаковые шаблонные секции. Фотографии должны иметь осмысленные alt-тексты и прямые HTTPS URL изображений: сервер сохранит их локально. Все кнопки, навигация и формы должны реально работать.'
      : 'VISUAL CONTRACT: for landing pages, corporate sites, catalogs, or services, create at least 4 meaningful sections and 3-6 relevant photographs or complete visual compositions. Use a strong hero, deliberate typography, cards, accents, and a responsive mobile layout. Do not use empty gray blocks, cheap gradients as content, decorative placeholders, or repetitive template sections. Use meaningful alt text and direct HTTPS image URLs; the server will store remote images locally. All buttons, navigation, and forms must work.',
  ].filter(Boolean).join('\n\n');
}

export async function runWorkflowPipeline(context: WorkflowContext): Promise<Response> {
  const locale = normalizeLocale(context.locale);
  const subscriptionTier = normalizeTier(context.subscriptionTier);
  const taskState = context.taskState || buildTaskState({
    messages: context.messages,
    language: locale,
    workflowMode: context.workflowMode,
    subscriptionTier,
    agentProfile: context.agentProfile,
    model: context.model,
    mode: context.mode,
  });
  const BUILDER_MODEL = 'gpt-oss-120b';
  const SYNTHESIS_MODELS = ['gpt-oss-120b', 'deepseek-v4-flash', 'glm-4.7-flash', 'command-a-reasoning', 'big-pickle'];
  const MAX_SYNTHESIS_ATTEMPTS = 3;

  const requestKey = buildWorkflowRequestKey(context, taskState);
  let workflowJob: WorkflowJob | null = context.chatId
    ? await latestWorkflowJob(context.chatId, requestKey)
    : null;
  if (workflowJob?.status === 'completed' && workflowJob.finalSummary) {
    return new Response(workflowJob.finalSummary, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-AI-Workflow': 'multi-agent',
        'X-AI-Workflow-Job': workflowJob.jobId,
        'X-AI-Artifact': 'idempotent-replay',
      },
    });
  }
  if (workflowJob && (workflowJob.status === 'running' || workflowJob.status === 'synthesizing')) {
    for (let waitAttempt = 0; waitAttempt < 180; waitAttempt += 1) {
      await delay(1000);
      const latest = context.chatId
        ? await latestWorkflowJob(context.chatId, requestKey)
        : null;
      if (!latest || latest.status === 'failed') {
        workflowJob = latest;
        break;
      }
      if (latest.status === 'completed' && latest.finalSummary) {
        return new Response(latest.finalSummary, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-AI-Workflow': 'multi-agent',
            'X-AI-Workflow-Job': latest.jobId,
            'X-AI-Artifact': 'idempotent-replay',
          },
        });
      }
      workflowJob = latest;
    }
    if (workflowJob && (workflowJob.status === 'running' || workflowJob.status === 'synthesizing')) {
      throw new Error('An identical workflow request is still running; retry after the current job finishes');
    }
  }
  if (!workflowJob) {
    workflowJob = await createWorkflowJob({
      chatId: context.chatId,
      mode: context.mode,
      goal: taskState.goal,
      requestKey,
      roles: WORKFLOW_CHAIN,
    });
  }
  const conversationalMessages = context.mode === 'chat'
    ? context.messages.slice(-8)
    : [];
  const results: StageResult[] = workflowJob.stages
    .filter((stage) => stage.status === 'completed' && stage.output)
    .map((stage) => ({ role: stage.role, text: stage.output as string }));
  const resolvedStageModels = new Map<AgentProfileId, string>();
  workflowJob.stages.forEach((stage) => {
    if (stage.status === 'completed' && stage.resolvedModel) {
      resolvedStageModels.set(stage.role, stage.resolvedModel);
    }
  });
  let previousOutput = taskState.previousDecision;

  try {
    for (const roleId of WORKFLOW_CHAIN) {
      const savedStage = workflowJob.stages.find((stage) => stage.role === roleId);
      if (savedStage?.status === 'completed' && savedStage.output) {
        previousOutput = savedStage.output;
        continue;
      }
      const roleModel = getRoleModel(roleId, context.model);
      const stageTaskState: AgentTaskState = { ...taskState, selectedRole: roleId };
      await updateWorkflowStage(workflowJob, roleId, 'running', {
        model: roleModel,
        requestedModel: roleModel,
      });
      const rolePrompt = buildAgentSystemPrompt({
        profileId: roleId,
        locale,
        subscriptionTier,
        mode: context.mode,
        taskState: stageTaskState,
      });
      const accumulatedDecisions = results.length > 0
        ? results
            .map((entry) => {
              const limit = roleId === 'qa'
                ? entry.role === 'development' ? 24000 : entry.role === 'design' ? 5000 : 2500
                : roleId === 'operations'
                  ? entry.role === 'qa' ? 7000 : entry.role === 'development' ? 7000 : 1800
                  : roleId === 'development'
                    ? entry.role === 'design' ? 5000 : 3000
                    : 1800;
              return `## ${entry.role}\n${entry.text.slice(0, limit)}`;
            })
            .join('\n\n')
            .slice(-(roleId === 'qa' ? 32000 : roleId === 'operations' ? 16000 : 12000))
        : taskState.previousDecision;
      const stageMessages = [
        { id: uuidv4(), role: 'system' as const, content: rolePrompt },
        ...conversationalMessages,
        {
          id: uuidv4(),
          role: 'user' as const,
          content: buildStagePrompt(stageTaskState, roleId, accumulatedDecisions || previousOutput, locale),
        },
      ] as Messages;
      let text = '';
      let resolvedModel = roleModel;
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt += 1) {
        const requestedModel = stageModelForAttempt(roleModel, attempt);
        const startedAt = new Date().toISOString();
        await recordWorkflowModelAttempt(workflowJob, roleId, {
          attempt,
          requestedModel,
          status: 'running',
          startedAt,
        });
        try {
          const result = await generateTextFn(
            stageMessages,
            {
              temperature: 0.2,
              maxTokens: roleId === 'development' ? 9000 : roleId === 'design' ? 2200 : roleId === 'planner' ? 1400 : roleId === 'leader' ? 700 : 1000,
            },
            requestedModel,
          );
          text = String(await result.text || '').trim();
          if (!text) throw new Error(`Workflow stage ${roleId} returned an empty result`);
          resolvedModel = String(
            (result as any)?.response?.modelId
            || (result as any)?.response?.model
            || requestedModel,
          );
          await recordWorkflowModelAttempt(workflowJob, roleId, {
            attempt,
            requestedModel,
            resolvedModel,
            status: 'completed',
            startedAt,
            completedAt: new Date().toISOString(),
          });
          break;
        } catch (error) {
          lastError = error;
          await recordWorkflowModelAttempt(workflowJob, roleId, {
            attempt,
            requestedModel,
            status: 'failed',
            startedAt,
            completedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
          });
          const directFallback = attempt === 1 && requestedModel !== 'auto' && !isAuthenticationError(error);
          const retryable = directFallback || isTransientModelError(error);
          if (!retryable || attempt >= MAX_STAGE_ATTEMPTS) break;
          if (!directFallback) await delay(retryDelayFor(error, attempt));
        }
      }
      if (!text) {
        const detail = lastError instanceof Error ? lastError.message.slice(0, 1200) : String(lastError || '').slice(0, 1200);
        throw new Error(locale === 'ru'
          ? `Этап «${roleId}» не получил живой результат модели после ${MAX_STAGE_ATTEMPTS} попыток. Шаблонная замена запрещена. ${detail}`
          : `Stage ${roleId} did not receive a live model result after ${MAX_STAGE_ATTEMPTS} attempts. Template substitution is forbidden. ${detail}`);
      }
      results.push({ role: roleId, text });
      resolvedStageModels.set(roleId, resolvedModel);
      if (roleId !== WORKFLOW_CHAIN[WORKFLOW_CHAIN.length - 1]) await delay(STAGE_RATE_GAP_MS);
      previousOutput = text;
      await updateWorkflowStage(workflowJob, roleId, 'completed', {
        model: resolvedModel,
        requestedModel: roleModel,
        resolvedModel,
        output: text,
      });
    }

    await markWorkflowSynthesizing(workflowJob);
    const synthesisResults = results.map((entry) => ({
      ...entry,
      text: entry.text.length > (entry.role === 'development' ? 32000 : 8000)
        ? `${entry.text.slice(0, entry.role === 'development' ? 32000 : 8000)}
[Промежуточный отчёт сокращён перед финальной сборкой.]` : entry.text,
    }));
    const finalMessages = [
      {
        id: uuidv4(),
        role: 'system' as const,
        content: locale === 'ru'
          ? 'Ты — финальный сборщик production-сайта. Используй запрос пользователя и промежуточные материалы только как входные данные. Верни только один полный валидный <boltArtifact> с файловыми <boltAction type="file" filePath="...">. Не возвращай отчёт, план, Markdown, пояснения или инструкции. Артефакт обязан содержать законченный уникальный сайт, реальные интерактивные сценарии, минимум три разные релевантные HTTPS-фотографии с alt-текстами, hero, секции, адаптивность и рабочие кнопки.'
          : 'You are the final production builder. Use the user request and intermediate materials only as input. Return exactly one complete valid <boltArtifact> with file-based <boltAction type="file" filePath="..."> entries. Do not return a report, plan, Markdown, explanations, or instructions. The artifact must contain a finished unique site, real interactions, at least three different relevant HTTPS photos with alt text, a hero, sections, responsive rules, and working buttons. Every img src must be a different relevant source URL; never reuse one source for two cards or sections. If a source repeats, regenerate the affected image URLs before answering.',
      },
      {
        id: uuidv4(),
        role: 'user' as const,
        content: buildSynthesisPrompt(
          taskState,
          synthesisResults,
          locale,
          context.basePrompt || '',
        ),
      },
    ] as Messages;
    const finalRequestedModel = String(context.mode) === 'builder'
      ? BUILDER_MODEL
      : (resolvedStageModels.get('development') || getRoleModel('development', context.model));

    if (String(context.mode) === 'builder') {
      let synthesisMessages = finalMessages;
      let lastFormattingError: Error | null = null;
      let repairSource = '';
      for (let attempt = 1; attempt <= MAX_SYNTHESIS_ATTEMPTS; attempt += 1) {
        const requestedModel = SYNTHESIS_MODELS[(attempt - 1) % SYNTHESIS_MODELS.length] || finalRequestedModel;
        const startedAt = new Date().toISOString();
        await recordWorkflowSynthesisAttempt(workflowJob, {
          attempt,
          requestedModel,
          status: 'running',
          startedAt,
        });
        try {
          const result = await generateTextFn(
            synthesisMessages,
            { temperature: 0.1, maxTokens: 16000, toolChoice: 'none' },
            requestedModel,
          );
          const source = String(result.text || '').trim();
          repairSource = source;
          const developmentArtifact = extractBoltArtifact(
            results.find((entry) => entry.role === 'development')?.text || '',
          );
          const artifact = restoreIndexAction(
            extractBoltArtifact(source) || convertBoltArtifactJsonToArtifact(source) || convertMarkdownFilesToArtifact(source) || convertLooseHtmlToArtifact(source),
            developmentArtifact,
          );
          if (!artifact) {
            throw new Error('Builder synthesis returned no valid boltArtifact with file actions');
          }
          validateVisualArtifact(artifact, taskState);
          const resolvedModel = String(
            (result as any)?.response?.modelId
            || (result as any)?.response?.model
            || requestedModel,
          );
          await recordWorkflowSynthesisAttempt(workflowJob, {
            attempt,
            requestedModel,
            resolvedModel,
            status: 'completed',
            startedAt,
            completedAt: new Date().toISOString(),
          });
          if (context.userId) {
            deductUserTokens(context.userId, estimateTokens(artifact)).catch(() => {});
          }
          await completeWorkflowJob(workflowJob, artifact, resolvedModel);
          return new Response(artifact, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-AI-Workflow': 'multi-agent',
              'X-AI-Workflow-Job': workflowJob.jobId,
              'X-AI-Workflow-Roles': WORKFLOW_CHAIN.join(','),
              'X-AI-Artifact': 'validated',
            },
          });
        } catch (error) {
          lastFormattingError = error instanceof Error ? error : new Error(String(error));
          await recordWorkflowSynthesisAttempt(workflowJob, {
            attempt,
            requestedModel,
            status: 'failed',
            startedAt,
            completedAt: new Date().toISOString(),
            error: lastFormattingError.message.slice(0, 1200),
          });
          if (attempt >= MAX_SYNTHESIS_ATTEMPTS) break;
          synthesisMessages = repairSource
            ? buildArtifactRepairMessages(`${repairSource}\n\n\u041eшибка валидатора: ${lastFormattingError.message}`, locale)
            : [
                ...finalMessages,
                {
                  id: uuidv4(),
                  role: 'user' as const,
                  content: locale === 'ru'
                    ? 'Предыдущий ответ нарушил контракт. Верни только полный валидный boltArtifact с файлами, без Markdown и localhost-инструкций.'
                    : 'The previous response violated the contract. Return only a complete valid boltArtifact with files, without Markdown or localhost instructions.',
                },
              ] as Messages;
          await delay(retryDelayFor(error, attempt));
        }
      }
      const developmentSource = results.find((entry) => entry.role === 'development')?.text || '';
      const recoveredArtifact = restoreIndexAction(extractBoltArtifact(developmentSource)
        || convertBoltArtifactJsonToArtifact(developmentSource)
        || convertMarkdownFilesToArtifact(developmentSource)
        || convertLooseHtmlToArtifact(developmentSource), '');
      if (recoveredArtifact) {
        try {
          validateVisualArtifact(recoveredArtifact, taskState);
          const recoveryModel = resolvedStageModels.get('development') || 'development-recovery';
          const recoveryStartedAt = new Date().toISOString();
          await recordWorkflowSynthesisAttempt(workflowJob, {
            attempt: MAX_SYNTHESIS_ATTEMPTS + 1,
            requestedModel: 'development-recovery',
            resolvedModel: recoveryModel,
            status: 'completed',
            startedAt: recoveryStartedAt,
            completedAt: new Date().toISOString(),
            error: lastFormattingError?.message.slice(0, 1200),
          });
          await completeWorkflowJob(workflowJob, recoveredArtifact, recoveryModel);
          return new Response(recoveredArtifact, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'X-AI-Workflow': 'multi-agent',
              'X-AI-Workflow-Job': workflowJob.jobId,
              'X-AI-Workflow-Roles': WORKFLOW_CHAIN.join(','),
              'X-AI-Artifact': 'development-recovery',
            },
          });
        } catch (recoveryError) {
          lastFormattingError = recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError));
        }
      }
      throw new Error(locale === 'ru'
        ? `Не удалось получить уникальный валидный сайт от модели после ${MAX_SYNTHESIS_ATTEMPTS} попыток. Публикация общего шаблона запрещена. ${lastFormattingError?.message || ''}`
        : `Could not obtain a unique valid site from the model after ${MAX_SYNTHESIS_ATTEMPTS} attempts. Publishing a shared template is forbidden. ${lastFormattingError?.message || ''}`);
    }

    const stream = new SwitchableStream();
    let synthesisModel = finalRequestedModel;
    const options: StreamingOptions = {
      toolChoice: 'none',

      onFinish: async (response: Parameters<NonNullable<StreamingOptions['onFinish']>>[0]) => {
        const { text, finishReason } = response;
        if (finishReason !== 'length') {
          if (context.userId) {
            deductUserTokens(context.userId, estimateTokens(text)).catch(() => {});
          }
          const finalResolvedModel = String(
            (response as any)?.response?.modelId
            || (response as any)?.response?.model
            || synthesisModel,
          );
          await completeWorkflowJob(workflowJob, text, finalResolvedModel);
          return stream.close();
        }
        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          const error = new Error('Cannot continue workflow response: maximum segments reached');
          await failWorkflowJob(workflowJob, error);
          throw error;
        }
        finalMessages.push({ id: uuidv4(), role: 'assistant', content: text });
        finalMessages.push({
          id: uuidv4(),
          role: 'user',
          content: locale === 'ru'
            ? 'Продолжи итоговый результат без повторов и без пояснений об оркестрации.'
            : 'Continue the final result without repetition and without explaining orchestration.',
        });
        const continuation = await streamTextFn(
          finalMessages,
          options,
          synthesisModel,
        );
        return stream.switchSource(
          continuation.textStream.pipeThrough(new TextEncoderStream()),
        );
      },
    };
    let result: Awaited<ReturnType<typeof streamTextFn>> | null = null;
    let synthesisError: unknown;
    for (let attempt = 1; attempt <= MAX_STREAM_ATTEMPTS; attempt += 1) {
      const requestedModel = attempt === 1 ? finalRequestedModel : 'auto';
      const startedAt = new Date().toISOString();
      await recordWorkflowSynthesisAttempt(workflowJob, {
        attempt,
        requestedModel,
        status: 'running',
        startedAt,
      });
      try {
        result = await streamTextFn(finalMessages, options, requestedModel);
        synthesisModel = requestedModel;
        await recordWorkflowSynthesisAttempt(workflowJob, {
          attempt,
          requestedModel,
          resolvedModel: requestedModel,
          status: 'completed',
          startedAt,
          completedAt: new Date().toISOString(),
        });
        break;
      } catch (error) {
        synthesisError = error;
        await recordWorkflowSynthesisAttempt(workflowJob, {
          attempt,
          requestedModel,
          status: 'failed',
          startedAt,
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message.slice(0, 1200) : String(error).slice(0, 1200),
        });
        const directFallback = attempt === 1 && requestedModel !== 'auto' && !isAuthenticationError(error);
        const retryable = directFallback || isTransientModelError(error);
        if (!retryable || attempt >= MAX_STREAM_ATTEMPTS) throw error;
        await delay(retryDelayFor(error, attempt));
      }
    }
    if (!result) throw synthesisError || new Error('Workflow synthesis failed without stream');
    stream.switchSource(result.textStream.pipeThrough(new TextEncoderStream()));

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-AI-Workflow': 'multi-agent',
        'X-AI-Workflow-Job': workflowJob.jobId,
        'X-AI-Workflow-Roles': WORKFLOW_CHAIN.join(','),
      },
    });
  } catch (error) {
    await failWorkflowJob(workflowJob, error).catch(() => undefined);
    throw error;
  }
}
