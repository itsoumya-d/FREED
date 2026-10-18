/** Canonical lexical file containment for Expo file URIs. Refuse aliases rather than normalize traversal. */
export function canonicalJournalFilePath(uri: string): string | null {
  if (typeof uri !== 'string' || !uri.startsWith('file:///') || /[?#]|%(?:2f|5c)/i.test(uri)) return null;
  let path: string; try { path = decodeURIComponent(uri.slice('file://'.length)); } catch { return null; }
  if (/[\\\u0000-\u001f\u007f]|%[0-9a-f]{2}/i.test(path)) return null;
  const segments = path.split('/'); if (segments[0] !== '' || segments.some((segment, index) => segment === '.' || segment === '..' || (!segment && index !== 0 && index !== segments.length - 1))) return null;
  return path;
}
export function isJournalUriInside(uri: string, directory: string | null): boolean {
  if (!directory) return false; const path = canonicalJournalFilePath(uri), root = canonicalJournalFilePath(directory);
  if (!path || !root) return false; const prefix = root.endsWith('/') ? root : `${root}/`;
  return path.startsWith(prefix) && path.length > prefix.length;
}
