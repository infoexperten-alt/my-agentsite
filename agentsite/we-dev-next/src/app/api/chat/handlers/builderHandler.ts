import { v4 as uuidv4 } from 'uuid';
import { MAX_TOKENS, Messages } from '../action';
import { streamResponse } from '../utils/streamResponse';
import { estimateTokens } from '@/utils/tokens';
import { buildSystemPrompt } from '../utils/promptBuilder';
import { determineFileType } from '../utils/fileTypeDetector';
import { getHistoryDiff } from '../utils/diffGenerator';
import { handleTokenLimit } from '../utils/tokenHandler';
import { processFiles } from '../utils/fileProcessor';
import {
  buildTaskState,
  serializeTaskState,
} from '../registry';
import { runWorkflowPipeline } from '../workflow';

export async function handleBuilderMode(
  messages: Messages,
  model: string,
  userId: string | null,
  agentProfile: string = 'development',
  subscriptionTier: string = 'free',
  locale: string = 'ru',
  workflowMode: 'single-agent' | 'multi-agent' = 'single-agent',
  chatId?: string,
): Promise<Response> {
  const historyMessages = JSON.parse(JSON.stringify(messages));
  const { files, allContent } = processFiles(messages);
  const filesPath = Object.keys(files);
  let nowFiles = files;

  if (estimateTokens(allContent) > MAX_TOKENS) {
    nowFiles = await handleTokenLimit(messages, files, filesPath);
  }

  const historyDiffString = getHistoryDiff(historyMessages, filesPath, nowFiles);
  const type = determineFileType(filesPath);
  const normalizedLocale = locale === 'en' ? 'en' : 'ru';
  const normalizedTier = subscriptionTier === 'pro' ? 'pro' : 'free';
  const taskState = buildTaskState({
    messages,
    files: nowFiles,
    language: normalizedLocale,
    workflowMode,
    subscriptionTier: normalizedTier,
    agentProfile,
    model,
    mode: 'builder',
  });
  const taskStateSummary = serializeTaskState(taskState);
  const systemPrompt = buildSystemPrompt(
    filesPath,
    type,
    nowFiles,
    historyDiffString,
    {
      agentProfile,
      subscriptionTier: normalizedTier,
      locale: normalizedLocale,
      workflowMode,
      taskStateSummary,
    },
  );

  if (workflowMode === 'multi-agent') {
    return runWorkflowPipeline({
        messages,
        model,
        userId,
        chatId,
        agentProfile,
        subscriptionTier: normalizedTier,
        locale: normalizedLocale,
        mode: 'builder',
        workflowMode,
        basePrompt: systemPrompt,
        taskState,
    });
  }


  messages.splice(messages.length - 1, 0, {
    id: uuidv4(),
    role: 'user',
    content: systemPrompt,
  });

  return streamResponse(messages, model, userId);
}
