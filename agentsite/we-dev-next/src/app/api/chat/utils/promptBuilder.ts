import type { Messages } from '../action';

export function buildSystemPrompt(paths: string[], type: string, files: Record<string, string>, historyDiff: string, options: Record<string, unknown>): string {
  const fileText = Object.entries(files).map(([path, content]) => `FILE: ${path}\n${content}`).join('\n\n');
  return [
    `You are a product builder working with ${type} files.`,
    `Files: ${paths.join(', ') || 'none'}`,
    `Context: ${JSON.stringify(options)}`,
    `History diff: ${historyDiff}`,
    fileText,
  ].filter(Boolean).join('\n\n');
}
