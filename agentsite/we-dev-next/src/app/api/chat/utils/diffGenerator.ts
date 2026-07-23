export function getHistoryDiff(previousMessages: unknown[], previousPaths: string[], currentFiles: Record<string, string>): string {
  const currentPaths = Object.keys(currentFiles);
  const added = currentPaths.filter((path) => !previousPaths.includes(path));
  const removed = previousPaths.filter((path) => !currentPaths.includes(path));
  return JSON.stringify({ messageCount: previousMessages.length, added, removed }, null, 2);
}
