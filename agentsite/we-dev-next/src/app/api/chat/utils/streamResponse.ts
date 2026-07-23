import { streamTextFn, type Messages } from '../action';

export async function streamResponse(messages: Messages, model: string, _userId: string | null): Promise<Response> {
  const result = await streamTextFn(messages, { toolChoice: 'none' }, model);
  return new Response(result.textStream.pipeThrough(new TextEncoderStream()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

