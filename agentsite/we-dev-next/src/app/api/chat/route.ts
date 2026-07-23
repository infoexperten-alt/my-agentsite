import { Messages } from './action';
import { handleChatMode } from './handlers/chatHandler';
import { handleBuilderMode } from './handlers/builderHandler';

enum ChatMode {
  Chat = 'chat',
  Builder = 'builder',
}

interface ChatRequest {
  messages: Messages;
  model?: string;
  mode?: ChatMode;
  agentProfile?: string;
  subscriptionTier?: string;
  language?: string;
  workflowMode?: 'single-agent' | 'multi-agent';
  chatId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const model = body.model || 'auto';
    const mode = body.mode === ChatMode.Chat ? ChatMode.Chat : ChatMode.Builder;
    const workflowMode = body.workflowMode === 'multi-agent'
      ? 'multi-agent'
      : 'single-agent';
    const userId = request.headers.get('userId');

    return mode === ChatMode.Chat
      ? await handleChatMode(
          messages,
          model,
          userId,
          body.agentProfile,
          body.subscriptionTier,
          body.language,
          workflowMode,
          body.chatId,
        )
      : await handleBuilderMode(
          messages,
          model,
          userId,
          body.agentProfile,
          body.subscriptionTier,
          body.language,
          workflowMode,
          body.chatId,
        );
  } catch (error) {
    console.error(error);
    const err: any = error;
    const msg: string = err?.message ?? String(error);
    const status: number = typeof err?.statusCode === 'number' ? err.statusCode : 0;
    const isRateLimit =
      status === 429 ||
      /rate[\s_-]?limit|too many requests|quota|exceeded|routing_error|cooldown|429/i.test(msg);
    const isAuth =
      status === 401 ||
      status === 403 ||
      /api key|unauthor|invalid token|authentication/i.test(msg);

    if (isRateLimit) {
      return Response.json(
        { error: 'Model temporarily rate-limited. Wait a minute or switch model.' },
        { status: 429 },
      );
    }
    if (isAuth) {
      return Response.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }
    return Response.json(
      { error: 'Generation failed: ' + msg.slice(0, 300) },
      { status: 500 },
    );
  }
}
