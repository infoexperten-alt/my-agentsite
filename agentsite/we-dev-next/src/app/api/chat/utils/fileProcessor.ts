import type { Messages } from '../action';

export function processFiles(messages: Messages): { files: Record<string, string>; allContent: string } {
  const files: Record<string, string> = {};
  for (const message of messages as Array<any>) {
    const parts = Array.isArray(message.parts) ? message.parts : [];
    for (const part of parts) {
      if (part?.type === 'file' && typeof part.path === 'string') files[part.path] = String(part.content ?? '');
    }
    const content = typeof message.content === 'string' ? message.content : '';
    const matches = content.matchAll(/(?:^|\n)```(?:\w+)?\s*\n([\s\S]*?)```/g);
    for (const match of matches) {
      const path = content.slice(0, match.index ?? 0).match(/([\w./-]+)\s*$/)?.[1];
      if (path) files[path] = match[1];
    }
  }
  return { files, allContent: Object.entries(files).map(([path, content]) => `${path}\n${content}`).join('\n') };
}
