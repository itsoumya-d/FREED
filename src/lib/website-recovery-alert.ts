/** A website alert is an invitation to enter recovery, never proof of access or app authority. */
export type WebsiteRecoveryAlert = Readonly<{
  version: '1';
  kind: 'website-recovery';
  id: string;
  /** Nonsecret enrollment routing identifier, never an owner ID or credential. */
  audience: string;
  expiresAt: string;
}>;

const MAX_ALERT_LIFETIME_MS = 60_000;
const MAX_REPLAY_IDS = 256;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = ['version', 'kind', 'id', 'audience', 'expiresAt'];
const AUDIENCE = /^[0-9a-f]{32}$/;

export function isWebsiteRecoveryAudience(value: unknown): value is string {
  return typeof value === 'string' && AUDIENCE.test(value);
}

/** Accept only the versioned generic wire payload. Do not forward notification text or URLs. */
export function parseWebsiteRecoveryAlert(data: unknown, now = Date.now()): WebsiteRecoveryAlert | null {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const prototype = Object.getPrototypeOf(data);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(data);
    if (keys.length !== FIELDS.length || keys.some(key => typeof key !== 'string' || !FIELDS.includes(key))) return null;
    const value = data as Record<string, unknown>;
    if (value.version !== '1' || value.kind !== 'website-recovery' || typeof value.id !== 'string' || !UUID.test(value.id)) return null;
    if (!isWebsiteRecoveryAudience(value.audience)) return null;
    if (typeof value.expiresAt !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value.expiresAt)) return null;
    const expiry = Number(value.expiresAt);
    if (!Number.isSafeInteger(now) || !Number.isSafeInteger(expiry) || expiry <= now || expiry - now > MAX_ALERT_LIFETIME_MS) return null;
    return Object.freeze({ version: '1', kind: 'website-recovery', id: value.id.toLowerCase(), audience: value.audience, expiresAt: value.expiresAt });
  } catch { return null; }
}

export function rememberNotificationMessageId(seen: Set<string>, id: string): void {
  seen.add(id);
  while (seen.size > MAX_REPLAY_IDS) seen.delete(seen.values().next().value!);
}

export type WebsiteRecoveryAlertInbox = ReturnType<typeof createWebsiteRecoveryAlertInbox>;

/** In-memory bounded replay protection, shareable across account-scoped SDK listeners. */
export function createWebsiteRecoveryAlertInbox(options: {
  now?: () => number;
  seenMessageIds?: Set<string>;
  seenEventIds?: Set<string>;
} = {}) {
  const seenMessageIds = options.seenMessageIds ?? new Set<string>();
  const seenEventIds = options.seenEventIds ?? new Set<string>();
  const now = options.now ?? Date.now;
  // Also bound caller-provided storage before any notification arrives.
  while (seenMessageIds.size > MAX_REPLAY_IDS) seenMessageIds.delete(seenMessageIds.values().next().value!);
  while (seenEventIds.size > MAX_REPLAY_IDS) seenEventIds.delete(seenEventIds.values().next().value!);
  return {
    takeOpened(message: unknown, expectedAudience: string | null): WebsiteRecoveryAlert | null {
      try {
        if (!isWebsiteRecoveryAudience(expectedAudience)) return null;
        if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
        const value = message as Record<string, unknown>;
        if (typeof value.messageId !== 'string' || value.messageId.length < 1 || value.messageId.length > 200) return null;
        const alert = parseWebsiteRecoveryAlert(value.data, now());
        if (!alert || alert.audience !== expectedAudience || seenMessageIds.has(value.messageId) || seenEventIds.has(alert.id)) return null;
        rememberNotificationMessageId(seenMessageIds, value.messageId);
        rememberNotificationMessageId(seenEventIds, alert.id);
        return alert;
      } catch { return null; }
    }
  };
}
