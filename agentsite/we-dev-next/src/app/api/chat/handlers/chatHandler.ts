import { v4 as uuidv4 } from 'uuid';
import { Messages, StreamingOptions, streamTextFn } from '../action';
import { CONTINUE_PROMPT } from '../prompt';
import { deductUserTokens, estimateTokens } from '@/utils/tokens';
import SwitchableStream from '../switchable-stream';
import {
  buildAgentSystemPrompt,
  buildTaskState,
  serializeTaskState,
} from '../registry';
import { runWorkflowPipeline } from '../workflow';

const MAX_RESPONSE_SEGMENTS = 2;

export async function handleChatMode(
  messages: Messages,
  model: string,
  userId: string | null,
  agentProfile: string = 'leader',
  subscriptionTier: string = 'free',
  locale: string = 'ru',
  workflowMode: 'single-agent' | 'multi-agent' = 'single-agent',
  chatId?: string,
): Promise<Response> {
  const normalizedLocale = locale === 'en' ? 'en' : 'ru';
  const normalizedTier = subscriptionTier === 'pro' ? 'pro' : 'free';
  const taskState = buildTaskState({
    messages,
    language: normalizedLocale,
    workflowMode,
    subscriptionTier: normalizedTier,
    agentProfile,
    model,
    mode: 'chat',
  });
  const basePrompt = buildAgentSystemPrompt({
    profileId: agentProfile,
    subscriptionTier: normalizedTier,
    locale: normalizedLocale,
    mode: 'chat',
    taskStateSummary: serializeTaskState(taskState),
  });

  if (workflowMode === 'multi-agent') {
    return runWorkflowPipeline({
        messages,
        model,
        userId,
        chatId,
        agentProfile,
        subscriptionTier: normalizedTier,
        locale: normalizedLocale,
        mode: 'chat',
        workflowMode,
        basePrompt,
        taskState,
    });
  }


  const stream = new SwitchableStream();
  const promptMessages = [
    {
      id: uuidv4(),
      role: 'system' as const,
      content: basePrompt,
    },
    ...messages,
  ];
  const options: StreamingOptions = {
    toolChoice: 'none',
    onFinish: async (response) => {
      const { text: content, finishReason } = response;
      if (finishReason !== 'length') {
        if (userId) {
          deductUserTokens(userId, estimateTokens(content)).catch(() => {});
        }
        return stream.close();
      }
      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw new Error('Cannot continue message: Maximum segments reached');
      }
      promptMessages.push({ id: uuidv4(), role: 'assistant', content });
      promptMessages.push({ id: uuidv4(), role: 'user', content: CONTINUE_PROMPT });
      const result = await streamTextFn(promptMessages, options, model);
      return stream.switchSource(result.textStream.pipeThrough(new TextEncoderStream()));
    },
  };
  const result = await streamTextFn(promptMessages, options, model);
  stream.switchSource(result.textStream.pipeThrough(new TextEncoderStream()));

  return new Response(stream.readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
