export interface ModelCatalogItem {
  modelName: string;
  modelKey: string;
  useImage: boolean;
  description: string;
  provider: string;
  functionCall: boolean;
  agent: string;
  priority: number;
  tier: 'free' | 'pro';
}

export const MODEL_CATALOG: ModelCatalogItem[] = [
  {
    modelName: 'Auto (freellmapi)',
    modelKey: 'auto',
    useImage: false,
    description: 'Роутер выбирает лучшую доступную модель и делает fallback.',
    provider: 'openai',
    functionCall: true,
    agent: 'all',
    priority: 1,
    tier: 'free',
  },
  {
    modelName: 'Kimi K2.6',
    modelKey: 'kimi-k2.6',
    useImage: false,
    description: 'Сильная универсальная модель для анализа и диалога.',
    provider: 'openai',
    functionCall: true,
    agent: 'all',
    priority: 2,
    tier: 'free',
  },
  {
    modelName: 'GPT-OSS 120B',
    modelKey: 'gpt-oss-120b',
    useImage: false,
    description: 'Основная модель для production-разработки.',
    provider: 'openai',
    functionCall: true,
    agent: 'development',
    priority: 3,
    tier: 'free',
  },
  {
    modelName: 'DeepSeek V4 Flash',
    modelKey: 'deepseek-v4-flash',
    useImage: false,
    description: 'Проверка, анализ ошибок и сложные reasoning-задачи.',
    provider: 'openai',
    functionCall: true,
    agent: 'qa',
    priority: 4,
    tier: 'pro',
  },
  {
    modelName: 'Command A Reasoning',
    modelKey: 'command-a-reasoning',
    useImage: false,
    description: 'Резервная модель для длинной сборки и восстановления артефакта.',
    provider: 'openai',
    functionCall: true,
    agent: 'development',
    priority: 4,
    tier: 'pro',
  },
  {
    modelName: 'GLM-4.7',
    modelKey: 'glm-4.7',
    useImage: false,
    description: 'Дизайн, структура и контентные решения.',
    provider: 'openai',
    functionCall: true,
    agent: 'design',
    priority: 5,
    tier: 'free',
  },
  {
    modelName: 'GLM-4.7 Flash',
    modelKey: 'glm-4.7-flash',
    useImage: true,
    description: 'Быстрые мультимодальные задачи.',
    provider: 'openai',
    functionCall: true,
    agent: 'vision',
    priority: 6,
    tier: 'pro',
  },
  {
    modelName: 'MiMo V2.5 (vision)',
    modelKey: 'mimo-v2.5',
    useImage: true,
    description: 'Vision-аудит preview и screenshot.',
    provider: 'openai',
    functionCall: true,
    agent: 'vision',
    priority: 7,
    tier: 'pro',
  },
  {
    modelName: 'Mistral Small 4',
    modelKey: 'mistral-small-4',
    useImage: false,
    description: 'Планирование, декомпозиция и длинный контекст.',
    provider: 'openai',
    functionCall: true,
    agent: 'planner',
    priority: 8,
    tier: 'free',
  },
  {
    modelName: 'Big Pickle',
    modelKey: 'big-pickle',
    useImage: false,
    description: 'Резервная универсальная модель.',
    provider: 'openai',
    functionCall: true,
    agent: 'all',
    priority: 9,
    tier: 'free',
  },
];

export function getCatalogModel(modelKey: string | undefined) {
  return MODEL_CATALOG.find((model) => model.modelKey === modelKey) || MODEL_CATALOG[0];
}
