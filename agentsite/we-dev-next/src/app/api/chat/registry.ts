export type AppLocale = 'ru' | 'en';
export type SubscriptionTier = 'free' | 'pro';
export type AgentMode = 'chat' | 'builder';
export type WorkflowMode = 'single-agent' | 'multi-agent';
export type AgentProfileId =
  | 'leader'
  | 'planner'
  | 'design'
  | 'development'
  | 'operations'
  | 'qa'
  | 'seo'
  | 'cms'
  | 'vision';

export interface AgentProfileDefinition {
  id: AgentProfileId;
  label: Record<AppLocale, string>;
  description: Record<AppLocale, string>;
  prompt: Record<AppLocale, string>;
  purpose: Record<AppLocale, string>;
  input: Record<AppLocale, string>;
  output: Record<AppLocale, string>;
  defaultModel: string;
  recommendedModel: string;
  tier: SubscriptionTier;
  access: SubscriptionTier | 'all';
  nextRoles: AgentProfileId[];
  badge: Record<AppLocale, string>;
  defaultMode: AgentMode;
}

export interface AgentTaskState {
  goal: string;
  constraints: string[];
  files: Record<string, string>;
  language: AppLocale;
  workflowMode: WorkflowMode;
  subscriptionTier: SubscriptionTier;
  selectedRole: AgentProfileId;
  selectedModel: string;
  previousDecision: string;
  mode: AgentMode;
}

export const WORKFLOW_CHAIN: AgentProfileId[] = [
  'leader',
  'planner',
  'design',
  'development',
  'qa',
  'operations',
];

const AGENT_REGISTRY: Record<AgentProfileId, AgentProfileDefinition> = {
  leader: {
    id: 'leader',
    label: { ru: 'Лидер / Оркестратор', en: 'Leader / Orchestrator' },
    description: {
      ru: 'Уточняет цель, держит контекст и распределяет работу по ролям.',
      en: 'Clarifies intent, keeps context, and routes work to the right roles.',
    },
    prompt: {
      ru: 'Сформулируй цель, аудиторию, ограничения, критерии успеха и следующий шаг. Не распыляйся.',
      en: 'Define the goal, audience, constraints, success criteria, and next step. Stay focused.',
    },
    purpose: {
      ru: 'Превратить запрос пользователя в понятную рабочую задачу.',
      en: 'Turn the user request into a clear executable task.',
    },
    input: {
      ru: 'Запрос пользователя, контекст диалога, язык, ограничения, файлы.',
      en: 'User request, conversation context, language, constraints, and files.',
    },
    output: {
      ru: 'Краткий бриф, риски, критерии успеха и следующий ответственный агент.',
      en: 'A concise brief, risks, success criteria, and the next responsible agent.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'free',
    access: 'all',
    nextRoles: ['planner'],
    badge: { ru: 'База', en: 'Core' },
    defaultMode: 'chat',
  },
  planner: {
    id: 'planner',
    label: { ru: 'PM / Планировщик', en: 'PM / Planner' },
    description: {
      ru: 'Декомпозирует задачу, определяет этапы и критерии приемки.',
      en: 'Decomposes the task into stages and acceptance criteria.',
    },
    prompt: {
      ru: 'Собери production-бриф: позиционирование, аудитория, одно главное обещание, messaging hierarchy, контентную архитектуру секций, CTA, доказательства доверия, этапы, риски и критерии готовности. Не используй generic copy.',
      en: 'Create a production brief: positioning, audience, one core promise, messaging hierarchy, section content architecture, CTAs, trust proof, stages, risks, and acceptance criteria. Avoid generic copy.',
    },
    purpose: {
      ru: 'Сделать работу предсказуемой и управляемой.',
      en: 'Make delivery predictable and manageable.',
    },
    input: {
      ru: 'Бриф лидера, текущие файлы, ограничения и критерии успеха.',
      en: 'Leader brief, current files, constraints, and success criteria.',
    },
    output: {
      ru: 'План реализации, приоритеты, зависимости и критерии приемки.',
      en: 'Implementation plan, priorities, dependencies, and acceptance criteria.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'free',
    access: 'all',
    nextRoles: ['design'],
    badge: { ru: 'База', en: 'Core' },
    defaultMode: 'chat',
  },
  design: {
    id: 'design',
    label: { ru: 'Дизайн', en: 'Design' },
    description: {
      ru: 'Проектирует структуру, композицию, UX и визуальную систему.',
      en: 'Designs structure, composition, UX, and visual language.',
    },
    prompt: {
      ru: 'Спроектируй дорогую editorial-премиум архитектуру: narrative первого экрана, ритм секций, контентную иерархию, conversion path, art direction фотографий по каждому блоку, типографическую пару, сетку, motion states, accessibility и мобильную композицию. Каждый блок должен иметь собственную роль, а не быть повтором шаблона.',
      en: 'Design a premium editorial architecture: hero narrative, section rhythm, content hierarchy, conversion path, art direction for every image, type pairing, grid, motion states, accessibility, and mobile composition. Every block must have a distinct role, never repeat a template.',
    },
    purpose: {
      ru: 'Задать понятный и качественный пользовательский опыт.',
      en: 'Create a clear and high-quality user experience.',
    },
    input: {
      ru: 'План, целевая аудитория, текущий UI, контент и ограничения.',
      en: 'Plan, audience, current UI, content, and constraints.',
    },
    output: {
      ru: 'Структура экранов, UX-решения, визуальные правила и список изменений.',
      en: 'Screen structure, UX decisions, visual rules, and a change list.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'free',
    access: 'all',
    nextRoles: ['development'],
    badge: { ru: 'База', en: 'Core' },
    defaultMode: 'builder',
  },
  development: {
    id: 'development',
    label: { ru: 'Разработка', en: 'Development' },
    description: {
      ru: 'Пишет production-ready код, интеграции и рабочие артефакты.',
      en: 'Builds production-ready code, integrations, and working artifacts.',
    },
    prompt: {
      ru: 'Реализуй полный рабочий результат. Не оставляй белых экранов, заглушек и неработающих импортов.',
      en: 'Deliver a complete working result. Avoid white screens, placeholders, and broken imports.',
    },
    purpose: {
      ru: 'Превратить план и дизайн в работающий продукт.',
      en: 'Turn the plan and design into a working product.',
    },
    input: {
      ru: 'План, дизайн-решения, текущие файлы, diff и критерии приемки.',
      en: 'Plan, design decisions, current files, diff, and acceptance criteria.',
    },
    output: {
      ru: 'Полный набор изменений в формате артефакта проекта.',
      en: 'A complete set of project artifact changes.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'free',
    access: 'all',
    nextRoles: ['qa'],
    badge: { ru: 'База', en: 'Core' },
    defaultMode: 'builder',
  },
  operations: {
    id: 'operations',
    label: { ru: 'Публикация / DevOps', en: 'Operations / DevOps' },
    description: {
      ru: 'Отвечает за окружение, домен, SSL, healthcheck, логи и rollback.',
      en: 'Owns environments, domain, SSL, health checks, logs, and rollback.',
    },
    prompt: {
      ru: 'Думай как production-инженер: безопасность, env, healthcheck, бэкапы, логи и быстрый rollback.',
      en: 'Think like a production engineer: security, env, health checks, backups, logs, and fast rollback.',
    },
    purpose: {
      ru: 'Сделать результат устойчивым после публикации.',
      en: 'Make the result reliable after deployment.',
    },
    input: {
      ru: 'Результат разработки, QA-замечания, окружение и ограничения публикации.',
      en: 'Development output, QA findings, environment, and deployment constraints.',
    },
    output: {
      ru: 'Release checklist, настройки окружения, наблюдаемость и rollback-план.',
      en: 'Release checklist, environment settings, observability, and rollback plan.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'free',
    access: 'all',
    nextRoles: [],
    badge: { ru: 'База', en: 'Core' },
    defaultMode: 'builder',
  },
  qa: {
    id: 'qa',
    label: { ru: 'QA / Проверка', en: 'QA / Review' },
    description: {
      ru: 'Ищет баги, регрессии и риски до публикации.',
      en: 'Finds bugs, regressions, and release risks before launch.',
    },
    prompt: {
      ru: 'Проверь сборку, крайние случаи, доступность, мобильную версию, тексты и поведение после перезагрузки.',
      en: 'Check builds, edge cases, accessibility, mobile behavior, copy, and reload persistence.',
    },
    purpose: {
      ru: 'Не допустить публикации сломанного результата.',
      en: 'Prevent broken output from reaching production.',
    },
    input: {
      ru: 'Артефакт разработки, критерии приемки, screenshot/preview и логи.',
      en: 'Development artifact, acceptance criteria, screenshot/preview, and logs.',
    },
    output: {
      ru: 'Список проблем по приоритетам, проверенные сценарии и решение go/no-go.',
      en: 'Prioritized issues, tested scenarios, and a go/no-go decision.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'pro',
    access: 'pro',
    nextRoles: ['operations'],
    badge: { ru: 'PRO', en: 'PRO' },
    defaultMode: 'builder',
  },
  seo: {
    id: 'seo',
    label: { ru: 'SEO / GEO', en: 'SEO / GEO' },
    description: {
      ru: 'Готовит структуру, метаданные и контент под поиск.',
      en: 'Prepares metadata, structure, and search-friendly content.',
    },
    prompt: {
      ru: 'Проверь title, description, H1-H3, schema.org, скорость и внутреннюю перелинковку без SEO-спама.',
      en: 'Check title, description, H1-H3, schema.org, speed, and internal linking without spam.',
    },
    purpose: {
      ru: 'Улучшить обнаруживаемость и качество коммерческого контента.',
      en: 'Improve discoverability and commercial content quality.',
    },
    input: {
      ru: 'Структура страниц, предложение, аудитория и контент.',
      en: 'Page structure, offer, audience, and content.',
    },
    output: {
      ru: 'SEO/GEO-рекомендации и готовые метаданные.',
      en: 'SEO/GEO recommendations and ready-to-use metadata.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'pro',
    access: 'pro',
    nextRoles: ['development'],
    badge: { ru: 'PRO', en: 'PRO' },
    defaultMode: 'builder',
  },
  cms: {
    id: 'cms',
    label: { ru: 'CMS / Контент', en: 'CMS / Content' },
    description: {
      ru: 'Выносит контент в редактируемые и устойчивые структуры.',
      en: 'Moves content into editable and maintainable structures.',
    },
    prompt: {
      ru: 'Не зашивай контент жестко, если его можно вынести в конфиг, CMS-слой или данные.',
      en: 'Do not hardcode content when it can live in configuration, a CMS layer, or data.',
    },
    purpose: {
      ru: 'Сделать продукт удобным для дальнейшего редактирования.',
      en: 'Make the product easy to update after launch.',
    },
    input: {
      ru: 'Контент, компоненты, схема данных и требования редактора.',
      en: 'Content, components, data shape, and editor requirements.',
    },
    output: {
      ru: 'Контентная модель, редактируемые блоки и правила обновления.',
      en: 'Content model, editable blocks, and update rules.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'pro',
    access: 'pro',
    nextRoles: ['development'],
    badge: { ru: 'PRO', en: 'PRO' },
    defaultMode: 'builder',
  },
  vision: {
    id: 'vision',
    label: { ru: 'Vision / UI-аудит', en: 'Vision / UI Audit' },
    description: {
      ru: 'Анализирует screenshot, композицию, контраст и визуальные дефекты.',
      en: 'Analyzes screenshots, composition, contrast, and visual defects.',
    },
    prompt: {
      ru: 'Смотри на screenshot как дизайнер и QA: композиция, контраст, ритм, отступы, иерархия и читаемость.',
      en: 'Review screenshots as both designer and QA: composition, contrast, rhythm, spacing, hierarchy, and readability.',
    },
    purpose: {
      ru: 'Находить визуальные проблемы, которые не видны по коду.',
      en: 'Find visual problems that code-only review misses.',
    },
    input: {
      ru: 'Screenshot preview, UI-артефакты и критерии качества.',
      en: 'Preview screenshot, UI artifacts, and quality criteria.',
    },
    output: {
      ru: 'Визуальный аудит и конкретные исправления.',
      en: 'Visual audit and concrete fixes.',
    },
    defaultModel: 'auto',
    recommendedModel: 'auto',
    tier: 'pro',
    access: 'pro',
    nextRoles: ['development'],
    badge: { ru: 'PRO', en: 'PRO' },
    defaultMode: 'chat',
  },
};

export const AGENT_PROFILE_GROUPS: Array<{
  title: Record<AppLocale, string>;
  ids: AgentProfileId[];
}> = [
  {
    title: { ru: 'Базовые роли', en: 'Core roles' },
    ids: ['leader', 'planner', 'design', 'development', 'qa', 'operations'],
  },
  {
    title: { ru: 'Роли-специалисты', en: 'Specialist roles' },
    ids: ['seo', 'cms'],
  },
];

export const DEFAULT_AGENT_PROFILE_BY_MODE: Record<AgentMode, AgentProfileId> = {
  chat: 'leader',
  builder: 'development',
};

export function getAgentProfile(id: string | undefined): AgentProfileDefinition {
  if (id && id in AGENT_REGISTRY) {
    return AGENT_REGISTRY[id as AgentProfileId];
  }
  return AGENT_REGISTRY.leader;
}

export function getLocalizedAgentProfile(
  id: AgentProfileId,
  locale: AppLocale = 'ru',
) {
  const profile = getAgentProfile(id);
  return {
    ...profile,
    localizedLabel: profile.label[locale] || profile.label.ru,
    localizedDescription: profile.description[locale] || profile.description.ru,
    localizedBadge: profile.badge[locale] || profile.badge.ru,
    localizedPurpose: profile.purpose[locale] || profile.purpose.ru,
    localizedInput: profile.input[locale] || profile.input.ru,
    localizedOutput: profile.output[locale] || profile.output.ru,
  };
}

export function isPremiumProfile(id: AgentProfileId) {
  return getAgentProfile(id).tier === 'pro';
}

export function canUseAgentProfile(
  id: AgentProfileId,
  subscriptionTier: SubscriptionTier = 'free',
  enforceTierGate = false,
) {
  return !enforceTierGate || subscriptionTier === 'pro' || !isPremiumProfile(id);
}

export function getDefaultAgentProfile(mode: AgentMode = 'builder'): AgentProfileId {
  return DEFAULT_AGENT_PROFILE_BY_MODE[mode] || 'development';
}

export function resolveAgentProfile(
  profileId: string | undefined,
  subscriptionTier: SubscriptionTier = 'free',
  mode: AgentMode = 'builder',
  enforceTierGate = false,
): AgentProfileId {
  const candidate = (
    profileId && profileId in AGENT_REGISTRY
      ? profileId
      : getDefaultAgentProfile(mode)
  ) as AgentProfileId;
  return canUseAgentProfile(candidate, subscriptionTier, enforceTierGate)
    ? candidate
    : getDefaultAgentProfile(mode);
}

export function getRoleModel(
  roleId: AgentProfileId,
  modelOverride = 'auto',
) {
  const supportedOverrides = new Set([
    'auto', 'kimi-k2.6', 'qwen3-coder-480b', 'deepseek-v4-pro', 'deepseek-v4-flash',
    'command-a-reasoning', 'glm-4.7', 'glm-4.7-flash', 'glm-4.6v-flash', 'mimo-v2.5',
    'gpt-oss-120b', 'mistral-small-4', 'big-pickle',
  ]);
  if (modelOverride && modelOverride !== 'auto' && supportedOverrides.has(modelOverride)) return modelOverride;
  const roleModels: Record<AgentProfileId, string> = {
    leader: 'command-a-reasoning',
    planner: 'command-a-reasoning',
    design: 'glm-4.7-flash',
    development: 'gpt-oss-120b',
    qa: 'command-a-reasoning',
    operations: 'command-a-reasoning',
    vision: 'glm-4.6v-flash',
    seo: 'command-a-reasoning',
    cms: 'command-a-reasoning',
  };
  return roleModels[roleId] || 'mistral-small-4';
}

export function buildTaskState(options: {
  messages?: Array<{ role?: string; content?: unknown }>;
  files?: Record<string, string>;
  language?: AppLocale;
  workflowMode?: WorkflowMode;
  subscriptionTier?: SubscriptionTier;
  agentProfile?: string;
  model?: string;
  previousDecision?: string;
  mode?: AgentMode;
  constraints?: string[];
}): AgentTaskState {
  const locale = options.language === 'en' ? 'en' : 'ru';
  const mode = options.mode === 'chat' ? 'chat' : 'builder';
  const workflowMode =
    options.workflowMode === 'multi-agent' ? 'multi-agent' : 'single-agent';
  const subscriptionTier =
    options.subscriptionTier === 'pro' ? 'pro' : 'free';
  const selectedRole = resolveAgentProfile(
    options.agentProfile,
    subscriptionTier,
    mode,
    false,
  );
  const messages = options.messages || [];
  const userMessages = [...messages].reverse().filter((message) => message.role === 'user');
  const latestUser = userMessages[0];
  const correctionRequest = String(latestUser?.content || '').startsWith('[QUALITY_CORRECTION]')
    ? String(latestUser?.content || '').replace(/^\[QUALITY_CORRECTION\]\s*/, '').trim()
    : '';
  const productUser = userMessages.find((message) => {
    const content = String(message.content || '');
    return !content.includes('<boltArtifact') && !content.startsWith('[QUALITY_CORRECTION]');
  });
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const goal = String((correctionRequest ? productUser : latestUser)?.content || '').trim() || (
    locale === 'ru' ? 'Определить и реализовать рабочий результат.' : 'Define and deliver a working result.'
  );

  return {
    goal: goal.slice(0, 12000),
    constraints: [
      ...(options.constraints || [
        locale === 'ru'
          ? 'Не допускать белого экрана и сломанных импортов.'
          : 'Avoid white screens and broken imports.',
        locale === 'ru'
          ? 'Сохранять совместимость с текущим проектом.'
          : 'Preserve compatibility with the current project.',
      ]),
      ...(correctionRequest ? [correctionRequest] : []),
    ],
    files: options.files || {},
    language: locale,
    workflowMode,
    subscriptionTier,
    selectedRole,
    selectedModel: options.model || 'auto',
    previousDecision: String(
      options.previousDecision || latestAssistant?.content || '',
    ).slice(0, 6000),
    mode,
  };
}

export function serializeTaskState(state: AgentTaskState) {
  return JSON.stringify(
    {
      goal: state.goal,
      constraints: state.constraints,
      language: state.language,
      workflowMode: state.workflowMode,
      subscriptionTier: state.subscriptionTier,
      selectedRole: state.selectedRole,
      selectedModel: state.selectedModel,
      previousDecision: state.previousDecision,
      mode: state.mode,
      files: Object.keys(state.files).map((path) => ({
        path,
        size: state.files[path]?.length || 0,
      })),
    },
    null,
    2,
  );
}

export function buildAgentSystemPrompt(options: {
  profileId?: string;
  locale?: AppLocale;
  subscriptionTier?: SubscriptionTier;
  mode?: AgentMode;
  taskState?: AgentTaskState;
  taskStateSummary?: string;
}) {
  const locale = options.locale === 'en' ? 'en' : 'ru';
  const mode = options.mode || 'builder';
  const subscriptionTier =
    options.subscriptionTier === 'pro' ? 'pro' : 'free';
  const profileId = resolveAgentProfile(
    options.profileId,
    subscriptionTier,
    mode,
    false,
  );
  const profile = getLocalizedAgentProfile(profileId, locale);
  const modeNote = mode === 'builder'
    ? (
        locale === 'ru'
          ? 'Режим builder: создавай или обновляй продуктовый артефакт и думай о preview.'
          : 'Builder mode: create or update the product artifact and think about preview behavior.'
      )
    : (
        locale === 'ru'
          ? 'Режим chat: отвечай по делу и предлагай следующий шаг.'
          : 'Chat mode: stay practical and suggest the next step.'
      );
  const commercialRules = locale === 'ru'
    ? [
        'ПРАВИЛА ПРОДУКТА:',
        '- По умолчанию отвечай по-русски.',
        '- Английский используй по запросу пользователя или если он пишет по-английски.',
        '- Думай о надежности, понятном результате, CTA и удобстве пользователя.',
        '- Не раскрывай внутренние тарифные проверки и технические секреты.',
      ].join('\n')
    : [
        'PRODUCT RULES:',
        '- Default to Russian unless the user asks for English or writes in English.',
        '- Optimize for reliability, clear output, CTA, and user experience.',
        '- Do not expose internal tier checks or technical secrets.',
      ].join('\n');
  const taskSummary = options.taskStateSummary || (
    options.taskState ? serializeTaskState(options.taskState) : ''
  );

  return [
    commercialRules,
    modeNote,
    `${locale === 'ru' ? 'Роль' : 'Role'}: ${profile.localizedLabel}`,
    `${locale === 'ru' ? 'Назначение' : 'Purpose'}: ${profile.localizedPurpose}`,
    `${locale === 'ru' ? 'Вход' : 'Input'}: ${profile.localizedInput}`,
    `${locale === 'ru' ? 'Выход' : 'Output'}: ${profile.localizedOutput}`,
    `${locale === 'ru' ? 'Модель по умолчанию' : 'Default model'}: ${profile.defaultModel}`,
    `${locale === 'ru' ? 'Инструкция роли' : 'Role instruction'}: ${profile.prompt[locale]}`,
    taskSummary
      ? `${locale === 'ru' ? 'СТРУКТУРИРОВАННОЕ СОСТОЯНИЕ ЗАДАЧИ' : 'STRUCTURED TASK STATE'}:\n${taskSummary}`
      : '',
  ].filter(Boolean).join('\n');
}

