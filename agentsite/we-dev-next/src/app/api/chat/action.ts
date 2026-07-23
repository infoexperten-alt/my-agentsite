import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  streamText as _streamText,
  convertToCoreMessages,
  generateObject,
  generateText,
} from 'ai';

import type { LanguageModel, Message } from 'ai';
import { getModelConfig, getModelRuntimeOptions, modelConfig } from '../model/config';
export const MAX_TOKENS = 16000;

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;
export type TextGenerationOptions = Omit<Parameters<typeof generateText>[0], 'model'>;

export function getOpenAIModel(baseURL: string, apiKey: string, model: string) {
  const resolvedModel = model && model !== '' ? model : 'auto';
  const openai = createOpenAI({ apiKey, baseURL });
  return openai(resolvedModel);
}

export type Messages = Message[];

const firstModel: any = modelConfig[0] || {};
const defaultModel = getOpenAIModel(
  firstModel.apiUrl || process.env.THIRD_API_URL || '',
  firstModel.apiKey || process.env.THIRD_API_KEY || '',
  firstModel.modelKey || 'auto',
) as LanguageModel;

function resolveModelConfig(modelKey?: string) {
  const requested = modelKey && modelKey !== '' ? modelKey : 'auto';
  if (requested !== 'auto') {
    const exact = modelConfig.find((item: any) => item.modelKey === requested);
    if (exact) return exact;
    console.warn(`[model-router] unsupported model key ${requested}; using auto route`);
    return getModelConfig('auto') || {};
  }
  return getModelConfig('auto') || {};
}

function normalizeMessages(messages: Messages) {
  return messages.map((item: any) => {
    if (item.role === 'assistant') {
      delete item.parts;
    }
    return item;
  });
}

export async function generateTextFn(
  messages: Messages,
  options?: TextGenerationOptions,
  modelKey?: string,
) {
  const found: any = resolveModelConfig(modelKey);
  const apiKey = found.apiKey || process.env.THIRD_API_KEY || '';
  const apiUrl = found.apiUrl || process.env.THIRD_API_URL || '';
  const resolvedModelKey = found.modelKey || 'auto';
  const model = getOpenAIModel(apiUrl, apiKey, resolvedModelKey) as LanguageModel;
  return generateText({
    model: model || defaultModel,
    messages: convertToCoreMessages(normalizeMessages(messages)),
    maxTokens: 1200,
    ...getModelRuntimeOptions(resolvedModelKey),
    ...(options || {}),
    abortSignal: AbortSignal.timeout(
      (options as any)?.maxTokens && Number((options as any).maxTokens) > 5000 ? 180000 : 90000,
    ),
  });
}

export async function generateObjectFn(messages: Messages) {
  const found: any = resolveModelConfig('auto');
  return generateObject({
    model: getOpenAIModel(
      found.apiUrl || '',
      found.apiKey || '',
      found.modelKey || 'auto',
    ) as LanguageModel,
    schema: z.object({
      files: z.array(z.string()),
    }),
    messages: convertToCoreMessages(messages),
    ...getModelRuntimeOptions(found.modelKey),
  });
}

export function streamTextFn(
  messages: Messages,
  options?: StreamingOptions,
  modelKey?: string,
) {
  const found: any = resolveModelConfig(modelKey);
  const apiKey = found.apiKey || process.env.THIRD_API_KEY || '';
  const apiUrl = found.apiUrl || process.env.THIRD_API_URL || '';
  const resolvedModelKey = found.modelKey || 'auto';
  const model = getOpenAIModel(apiUrl, apiKey, resolvedModelKey) as LanguageModel;
  return _streamText({
    model: model || defaultModel,
    messages: convertToCoreMessages(normalizeMessages(messages)),
    maxTokens: MAX_TOKENS,
    ...getModelRuntimeOptions(resolvedModelKey),
    ...(options || {}),
    abortSignal: AbortSignal.timeout(300000),
  });
}

export { createOpenAI } from '@ai-sdk/openai';
export { z } from 'zod';
export {
  streamText as _streamText,
  convertToCoreMessages,
  generateObject,
  generateText,
} from 'ai';
export type { LanguageModel, Message } from 'ai';
