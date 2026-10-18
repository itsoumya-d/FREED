/** Private entry progress and offer decisions never grant membership or device protection. */
export type JourneyMetadata = { entry: 'new' | 'existing' | null; introCompletedAt: string | null };
export type JourneyAuthSnapshot = Readonly<{
  status: 'hydrating' | 'ready' | 'unavailable'; signedIn: boolean; anonymous: boolean;
  ownerUid: string | null; email: string | null; reason?: string;
}>;
export type JourneyMembershipSnapshot = Readonly<{ ownerUid: string | null; status: 'checking' | 'unavailable' | 'free' | 'verified-premium' }>;
export const INITIAL_JOURNEY_AUTH: JourneyAuthSnapshot = { status: 'hydrating', signedIn: false, anonymous: false, ownerUid: null, email: null };
export function sanitizeJourneyMetadata(value: unknown): JourneyMetadata {
  const item = value && typeof value === 'object' ? value as Partial<JourneyMetadata> : {};
  return { entry: item.entry === 'new' || item.entry === 'existing' ? item.entry : null,
    introCompletedAt: typeof item.introCompletedAt === 'string' && Number.isFinite(Date.parse(item.introCompletedAt)) ? item.introCompletedAt : null };
}
export function getJourneyOwner(auth: JourneyAuthSnapshot): string | null {
  return auth.status === 'ready' && auth.signedIn && !auth.anonymous && typeof auth.ownerUid === 'string' && auth.ownerUid.trim().length > 0 && auth.ownerUid.length <= 128 ? auth.ownerUid : null;
}
/** Ephemeral UI ownership only; it never grants authentication or membership. */
export type AccountFlowControl = { isCurrent: () => boolean; complete: () => boolean };
export function createAccountFlowFence() {
  let generation = 0;
  let held = false;
  return {
    isActive: () => held,
    begin(): AccountFlowControl {
      if (!held) { held = true; generation += 1; }
      const token = generation;
      const isCurrent = () => held && generation === token;
      return { isCurrent, complete: () => { if (!isCurrent()) return false; held = false; return true; } };
    }
  };
}

export type JourneyPolicy = { auth: JourneyAuthSnapshot; journey: JourneyMetadata; offerAcknowledged: boolean; verifiedPremium: boolean };
export function getJourneyDestination(policy: JourneyPolicy): 'splash' | 'welcome' | 'account' | 'paywall' | 'main' {
  if (policy.auth.status === 'hydrating') return 'splash';
  if (policy.auth.status === 'unavailable') return 'account';
  if (!getJourneyOwner(policy.auth)) return policy.journey.entry === 'existing' || policy.journey.introCompletedAt ? 'account' : 'welcome';
  // A restored real account can enter through the existing-account journey.
  if (policy.journey.entry === 'new' && !policy.journey.introCompletedAt) return 'welcome';
  return policy.verifiedPremium || policy.offerAcknowledged ? 'main' : 'paywall';
}
export function guardJourneyRoute<T extends string>(requested: T, policy: JourneyPolicy, activeAccountFlow = false): T | ReturnType<typeof getJourneyDestination> {
  if (activeAccountFlow) return "account";
  const destination = getJourneyDestination(policy);
  if (destination === 'splash') return 'splash';
  if (destination === 'account' && policy.auth.status === 'unavailable') return requested === 'welcome' || requested === 'quiz' || requested === 'planCalculation' ? requested : 'account';
  const introRoute = requested === 'welcome' || requested === 'quiz' || requested === 'planCalculation';
  if (introRoute) return requested;
  if (destination === 'welcome') return 'welcome';
  if (destination === 'account') return requested === 'account' ? requested : 'account';
  if (destination === 'paywall') return requested === 'account' ? requested : 'paywall';
  return requested;
}

/** Owns hydration timeout and generations so late callbacks cannot restore a former account. */
export function createAuthSnapshotObserver(start: (listener: (snapshot: JourneyAuthSnapshot) => void) => () => void, timeoutMs = 8_000, beforePublish?: (next: JourneyAuthSnapshot) => void) {
  let snapshot = INITIAL_JOURNEY_AUTH;
  let epoch = 0;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: JourneyAuthSnapshot) => { beforePublish?.(next); snapshot = next; listeners.forEach(listener => listener()); };
  const stop = () => { epoch++; unsubscribe?.(); unsubscribe = null; if (timer) clearTimeout(timer); timer = null; };
  const begin = () => {
    stop();
    const current = epoch;
    publish(INITIAL_JOURNEY_AUTH);
    timer = setTimeout(() => {
      if (epoch !== current) return;
      stop();
      publish({ ...INITIAL_JOURNEY_AUTH, status: 'unavailable', reason: 'Account restoration timed out. Check your connection and retry.' });
    }, timeoutMs);
    try {
      const release = start(next => {
        if (epoch !== current) return;
        if (timer) clearTimeout(timer); timer = null;
        publish(next);
      });
      if (epoch === current) unsubscribe = release; else release();
    } catch {
      stop();
      publish({ ...INITIAL_JOURNEY_AUTH, status: 'unavailable', reason: 'Account access is unavailable in this build. Retry or use an iOS or Android custom build.' });
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); if (listeners.size === 1) begin(); return () => { listeners.delete(listener); if (!listeners.size) { stop(); beforePublish?.(INITIAL_JOURNEY_AUTH); snapshot = INITIAL_JOURNEY_AUTH; } }; },
    retry() { if (listeners.size) begin(); }
  };
}

export const JOURNEY_OFFER_VERSION = 1;
export type OfferDecision = Readonly<{ version: 1; decision: 'free' | 'verified-membership'; decidedAt: string }>;
export type JourneyMetadataAdapter = {
  /** Authenticated, owner-scoped metadata only. Never pass recovery state to this service. */
  read: (ownerUid: string, version: 1) => Promise<unknown>;
  write: (ownerUid: string, decision: OfferDecision) => Promise<unknown>;
};
let remoteMetadataAdapter: JourneyMetadataAdapter | null = null;
export function configureJourneyMetadataAdapter(adapter: JourneyMetadataAdapter | null) { remoteMetadataAdapter = adapter; }
function sanitizeOffer(value: unknown): OfferDecision | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<OfferDecision>;
  return item.version === 1 && (item.decision === 'free' || item.decision === 'verified-membership') && typeof item.decidedAt === 'string' && Number.isFinite(Date.parse(item.decidedAt)) ? { version: 1, decision: item.decision, decidedAt: item.decidedAt } : null;
}
export function createOfferDecisionStore(storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }, adapter?: JourneyMetadataAdapter | null, timeoutMs = 3_000) {
  const memory = new Map<string, OfferDecision>();
  const validOwner = (uid: string) => typeof uid === 'string' && uid.trim().length > 0 && uid.length <= 128;
  const key = (uid: string) => `freed.journey.offer.v1.${encodeURIComponent(uid)}`;
  const read = (uid: string) => {
    if (!validOwner(uid)) return null;
    if (memory.has(uid)) return memory.get(uid)!;
    try { const value = sanitizeOffer(JSON.parse(storage.getItem(key(uid)) ?? 'null')); if (value) memory.set(uid, value); return value; } catch { return null; }
  };
  const save = (uid: string, value: OfferDecision) => { memory.set(uid, value); try { storage.setItem(key(uid), JSON.stringify(value)); return true; } catch { return false; } };
  return {
    has: (uid: string) => read(uid) !== null,
    acknowledge(uid: string, decision: OfferDecision['decision']) {
      if (!validOwner(uid) || (decision !== 'free' && decision !== 'verified-membership')) return { saved: false };
      return { saved: save(uid, { version: 1, decision, decidedAt: new Date().toISOString() }) };
    },
    async sync(uid: string): Promise<{ status: 'synced' | 'retryable' | 'unavailable'; saved?: boolean }> {
      const remote = adapter === undefined ? remoteMetadataAdapter : adapter;
      if (!validOwner(uid)) return { status: 'unavailable' };
      const pendingLocal = read(uid);
      const localSaved = pendingLocal ? save(uid, pendingLocal) : undefined;
      if (!remote) return { status: 'unavailable', saved: localSaved };
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let expired = false;
      try {
        return await Promise.race([
          (async () => {
            const local = read(uid);
            if (local) { await remote.write(uid, local); if (expired) return { status: 'retryable' as const, saved: localSaved }; return { status: 'synced' as const, saved: save(uid, local) }; }
            const value = sanitizeOffer(await remote.read(uid, 1));
            if (expired) return { status: 'retryable' as const, saved: localSaved };
            return { status: 'synced' as const, ...(value && !read(uid) ? { saved: save(uid, value) } : {}) };
          })(),
          new Promise<{ status: 'retryable'; saved?: boolean }>(resolve => { timeout = setTimeout(() => { expired = true; resolve({ status: 'retryable', saved: localSaved }); }, timeoutMs); })
        ]);
      } catch { return { status: 'retryable', saved: localSaved }; } finally { if (timeout) clearTimeout(timeout); }
    }
  };
}

/** Current-owner fences apply before and after every awaited remote step. */
export function createFirebaseJourneyMetadataAdapter(options: {
  currentOwner: () => string | null;
  getContracts: () => Promise<null | { getJourneyOfferState: () => Promise<{ offerVersion: 1; acknowledged: boolean }>; acknowledgeJourneyOffer: (input: { offerVersion: 1; decision: 'free' | 'purchased'; eventId: string }) => Promise<{ offerVersion: 1; acknowledged: boolean }> }>;
  createEventId: () => string;
}): JourneyMetadataAdapter {
  const assertOwner = (owner: string) => { if (options.currentOwner() !== owner) throw new Error('The account changed. Retry metadata sync.'); };
  return {
    async read(owner, version) {
      assertOwner(owner); const contracts = await options.getContracts(); assertOwner(owner);
      if (!contracts || version !== 1) throw new Error('Journey metadata service unavailable.');
      const response = await contracts.getJourneyOfferState(); assertOwner(owner);
      return response.acknowledged ? { version: 1, decision: 'free', decidedAt: new Date().toISOString() } : null;
    },
    async write(owner, decision) {
      assertOwner(owner); const contracts = await options.getContracts(); assertOwner(owner);
      if (!contracts) throw new Error('Journey metadata service unavailable.');
      const response = await contracts.acknowledgeJourneyOffer({ offerVersion: 1, decision: decision.decision === 'free' ? 'free' : 'purchased', eventId: options.createEventId() });
      assertOwner(owner);
      if (!response.acknowledged) throw new Error('Journey metadata could not be saved.');
      return response;
    }
  };
}
