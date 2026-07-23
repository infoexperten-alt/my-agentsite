import { MODEL_CATALOG, type ModelCatalogItem } from './registry';

export interface ModelConfig extends ModelCatalogItem {
  apiKey?: string;
  apiUrl?: string;
}

const FREELLMAPI_URL = process.env.THIRD_API_URL || 'http://64.188.115.45:3001/v1';
const FREELLMAPI_KEY = process.env.THIRD_API_KEY || '';

function envSuffix(modelKey: string) {
  return modelKey.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}

function getEndpoint(modelKey: string) {
  const suffix = envSuffix(modelKey);
  return {
    apiUrl: process.env[`MODEL_${suffix}_API_URL`] || FREELLMAPI_URL,
    apiKey: process.env[`MODEL_${suffix}_API_KEY`] || FREELLMAPI_KEY,
  };
}

export const modelConfig: ModelConfig[] = MODEL_CATALOG.map((item) => ({
  ...item,
  ...getEndpoint(item.modelKey),
}));

export function getModelConfig(modelKey: string | undefined) {
  return modelConfig.find((item) => item.modelKey === modelKey)
    || modelConfig.find((item) => item.modelKey === 'auto')
    || modelConfig[0];
}

export function getModelRuntimeOptions(modelKey: string | undefined) {
  const config = getModelConfig(modelKey);
  const provider = config?.provider || '';
  return provider.includes('claude')
    ? { maxTokens: provider.includes('claude-3-7-sonnet') ? 128000 : 8192 }
    : {};
}
