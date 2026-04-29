export function normalizePreviewPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('workspace_iframe.html') || lower.startsWith('/__replco/') || lower.startsWith('/_replco/')) {
    return '/';
  }
  return path;
}
