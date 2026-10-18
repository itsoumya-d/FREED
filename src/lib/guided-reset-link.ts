/** A manual recovery hint only: carries no website, block proof, or authority. */
export const GUIDED_RESET_APP_LINK = 'https://freed-7d5ee.firebaseapp.com/intervention';
export const GUIDED_RESET_SCHEME_LINK = 'freed://guided-reset';

export function isGuidedResetLink(url: unknown): boolean {
  // Exact comparison deliberately rejects query/fragment payloads, userinfo,
  // alternate ports, encoded paths and lookalike hosts.
  return url === GUIDED_RESET_SCHEME_LINK || url === GUIDED_RESET_APP_LINK;
}

export function createGuidedResetLinkInbox(now = Date.now) {
  let requestedAt: number | null = null;
  let initialSeen = false;
  return {
    offer(url: unknown, origin: 'initial' | 'event') {
      if (!isGuidedResetLink(url) || (origin === 'initial' && initialSeen)) return false;
      if (origin === 'initial') initialSeen = true;
      requestedAt = now();
      return true;
    },
    take(ready: boolean) {
      if (requestedAt === null) return false;
      const age = now() - requestedAt;
      if (!Number.isFinite(age) || age < 0 || age > 60_000) { requestedAt = null; return false; }
      if (!ready) return false;
      requestedAt = null;
      return true;
    },
    clear() { requestedAt = null; }
  };
}
