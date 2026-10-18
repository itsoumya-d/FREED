import { canonicalName } from './dns.js';

// Loaded only from a reviewed operator-controlled local artifact, never request data.
export class DomainFeed {
  #current;
  constructor({ now = Date.now, maxAgeMs = 24 * 60 * 60 * 1000, maxDomains = 100_000 } = {}) {
    if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 7 * 86400_000 || !Number.isSafeInteger(maxDomains) || maxDomains < 1 || maxDomains > 100_000) throw new Error('invalid feed bounds');
    Object.assign(this, { now, maxAgeMs, maxDomains });
  }
  replace(feed) {
    try {
      const now = this.now();
      if (feed?.reviewed !== true || !Number.isSafeInteger(feed.version) || feed.version < 1 || (this.#current && feed.version <= this.#current.version) || !Number.isSafeInteger(feed.generatedAt) || !Number.isSafeInteger(feed.expiresAt) || feed.generatedAt > now || feed.expiresAt <= now || feed.expiresAt <= feed.generatedAt || feed.expiresAt - feed.generatedAt > this.maxAgeMs || !Array.isArray(feed.domains) || feed.domains.length < 1 || feed.domains.length > this.maxDomains) return false;
      const domains = new Set(feed.domains.map(domain => {
        if (typeof domain !== 'string' || domain !== canonicalName(domain) || !domain.includes('.') || domain.includes('_')) throw new Error('invalid feed domain');
        return domain;
      }));
      this.#current = { version: feed.version, generatedAt: feed.generatedAt, expiresAt: feed.expiresAt, domains };
      return true;
    } catch { return false; }
  }
  classify(name) {
    const now = this.now();
    const current = this.#current;
    if (!current || now < current.generatedAt || now >= current.expiresAt || now - current.generatedAt > this.maxAgeMs) return 'unavailable';
    let suffix = canonicalName(name);
    while (suffix !== '.') {
      if (current.domains.has(suffix)) return 'deny';
      const dot = suffix.indexOf('.');
      if (dot === -1) break;
      suffix = suffix.slice(dot + 1);
    }
    return 'allow';
  }
}
