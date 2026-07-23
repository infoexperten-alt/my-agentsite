import type { Messages } from '../action';

export async function handleTokenLimit(_messages: Messages, files: Record<string, string>, paths: string[]) {
  const maxChars = 48000;
  let remaining = maxChars;
  const result: Record<string, string> = {};
  for (const path of paths) {
    const content = files[path] || '';
    result[path] = content.slice(0, Math.max(0, remaining));
    remaining -= result[path].length;
    if (remaining <= 0) break;
  }
  return result;
}
