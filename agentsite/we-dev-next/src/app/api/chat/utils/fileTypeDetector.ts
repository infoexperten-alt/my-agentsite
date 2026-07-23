export function determineFileType(paths: string[]): string {
  const extensions = paths.map((path) => path.split('.').pop()?.toLowerCase()).filter(Boolean);
  if (extensions.some((extension) => ['tsx', 'jsx'].includes(extension!))) return 'react';
  if (extensions.some((extension) => ['ts', 'js'].includes(extension!))) return 'javascript';
  if (extensions.some((extension) => ['css', 'scss', 'html'].includes(extension!))) return 'web';
  return extensions[0] || 'text';
}
