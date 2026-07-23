export function estimateTokens(value: unknown): number {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return Math.ceil(text.length / 4);
}

export async function deductUserTokens(_userId: string, _tokens: number): Promise<void> {
  return;
}
