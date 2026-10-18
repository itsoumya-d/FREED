import { createRewardedDiagnosticReceipt } from './rewarded-ad-diagnostics';
import type { JourneyMembershipSnapshot } from './user-journey';
import type { RewardedResetResult, RewardedResetSession, RewardedPresentationLifecycle } from './monetization';
import { hasReviewAccess, type ReviewAccessSnapshot } from './review-access';

export type GuidedTier = 'paid' | 'review' | 'free' | 'unknown';
export const GUIDED_PREFLIGHT_TIMEOUT_MS = 8000;
export const GUIDED_AD_FRESHNESS_MS = 30000;
export const GUIDED_ACCESS_STORAGE_PREFIX = 'freed.guided.access.v1.';
export type GuidedAccess = {
  version: 1;
  ownerUid: string;
  sessionId: string;
  kind: 'paid' | 'review' | 'reward' | 'cleanup';
  state: 'available' | 'consumed' | 'discarding';
  createdAt: number;
};
export function resolveGuidedTier(owner: string | null, membership: JourneyMembershipSnapshot, review: ReviewAccessSnapshot | null, now = Date.now()): GuidedTier {
  if (!owner) return 'unknown';
  if (hasReviewAccess(review, owner, now)) return 'review';
  if (membership.ownerUid !== owner) return 'unknown';
  return membership.status === 'verified-premium' ? 'paid' : membership.status === 'free' ? 'free' : 'unknown';
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Options = {
  ownerUid: string;
  storage: Storage;
  currentOwner: () => string | null;
  currentTier: () => GuidedTier;
  requestContext?: () => string;
  isChecking?: () => boolean;
  refreshEligibility?: (isCurrent: () => boolean) => Promise<GuidedTier>;
  isForeground: () => boolean;
  now: () => number;
  createId: () => string;
  prepareProvider?: () => Promise<void>;
  createReward: () => RewardedResetSession;
  completeReward: (session: RewardedResetSession, isEligible: () => boolean, lifecycle: RewardedPresentationLifecycle) => Promise<RewardedResetResult>;
};
/** Only this controller accepts SDK evidence. Persist-before-publish plus a retained earned
 * result makes disk-full repair independent of another ad. No recovery/profile fields enter SDK IO. */
export function createGuidedResetAccessController(o: Options) {
  const key = GUIDED_ACCESS_STORAGE_PREFIX + encodeURIComponent(o.ownerUid);
  let grant: GuidedAccess | null = null;
  let earned: { access: GuidedAccess; request: number; context: string | undefined; awaitingSdkForeground: boolean; presented: boolean } | null = null;
  let diagnostic = createRewardedDiagnosticReceipt(o.now);
  let consentForm = false;
  let consentReturned: (() => void) | null = null;
  let busy = false, presenting = false, generation = 0, hydrated = false, disposed = false;
  const owned = () => !disposed && o.currentOwner() === o.ownerUid;
  const read = () => owned() && grant ? { ...grant } : null;
  const persist = (value: GuidedAccess) => {
    o.storage.setItem(key, JSON.stringify(value));
    grant = value;
  };
  const make = (kind: GuidedAccess['kind']): GuidedAccess => ({ version: 1, ownerUid: o.ownerUid, sessionId: o.createId(), kind, state: 'available', createdAt: o.now() });
  const repair = () => {
    if (!owned() || !earned || earned.request !== generation || earned.context !== o.requestContext?.() || o.currentTier() === 'paid' || o.currentTier() === 'review' || (o.currentTier() === 'unknown' && !earned.presented)) {
      earned = null;
      return 'denied' as const;
    }
    if (!o.isForeground()) return 'pending-foreground' as const;
    // A failed foreground refresh is uncertainty, not a new licensing proof.
    // Keep the original witnessed request for retry, but do not persist a grant
    // until current Free authority returns, including while a refresh is checking.
    if (o.currentTier() !== 'free') return 'pending-eligibility' as const;
    try {
      persist(earned.access);
      diagnostic.record({ stage: 'save' });
      earned = null;
      return 'granted' as const;
    } catch { diagnostic.record({ stage: 'save', failure: 'storage' }); return 'save-failed' as const; }
  };
  return {
    read, repair,
    diagnostic: () => diagnostic.read(),
    isBusy: () => busy,
    hydrate() {
      disposed = false;
      const raw = o.storage.getItem(key);
      grant = null;
      if (raw && raw.length <= 2000) {
        try {
          const v = JSON.parse(raw);
          if (v && Object.keys(v).sort().join(',') === 'createdAt,kind,ownerUid,sessionId,state,version' &&
            v.version === 1 && v.ownerUid === o.ownerUid && typeof v.sessionId === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(v.sessionId) &&
            ['paid', 'review', 'reward', 'cleanup'].includes(v.kind) && ['available', 'consumed', 'discarding'].includes(v.state) && (v.kind !== 'cleanup' || v.state === 'discarding') &&
            Number.isFinite(v.createdAt) && (v.state === 'discarding' || (v.createdAt <= o.now() && o.now() - v.createdAt <= 7 * 86400000))) grant = v;
        } catch { /* Invalid local state never enables access. */ }
      }
      hydrated = true;
      return read();
    },
    startLicensed() {
      if (!owned() || !hydrated || grant || earned || !o.isForeground()) return false;
      const tier = o.currentTier();
      if (tier !== 'paid' && tier !== 'review') return false;
      persist(make(tier));
      return true;
    },
    async watch(offerEligible?: () => boolean) {
      if (!owned() || !hydrated || busy || grant || earned || !o.isForeground() || o.currentTier() !== 'free') return 'denied' as const;
      busy = true;
      diagnostic = createRewardedDiagnosticReceipt(o.now);
      const receipt = diagnostic;
      const request = ++generation;
      let wasPresented = false;
      const context = o.requestContext?.();
      const ownsRequest = () => owned() && request === generation && o.requestContext?.() === context;
      const current = () => ownsRequest() &&
        (o.currentTier() === 'free' || (wasPresented && o.currentTier() === 'unknown'));
      let freshUntil = o.refreshEligibility ? 0 : Infinity;
      const offerCurrent = () => { try { return offerEligible?.() !== false; } catch { return false; } };
      const eligible = () => current() && (o.isForeground() || presenting) && (presenting || o.now() < freshUntil) && (wasPresented || offerCurrent());
      let preflightFailure: 'access-changed' | 'denied' | 'eligibility-unavailable' | undefined;
      const refresh = async (stage: 'membership' | 'fresh-access') => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        // The callback handed to the remote authority expires on timeout as well as cancellation.
        let pending = true;
        receipt.record({ stage, foreground: o.isForeground(), ownerCurrent: owned(), contextCurrent: ownsRequest() });
        try {
          const refreshed = o.refreshEligibility ? await Promise.race([
            o.refreshEligibility(() => pending && ownsRequest()),
            new Promise<GuidedTier>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), GUIDED_PREFLIGHT_TIMEOUT_MS); })
          ]) : o.currentTier();
          if (!ownsRequest() || !o.isForeground()) preflightFailure = 'denied';
          else if (refreshed === 'paid' || refreshed === 'review') preflightFailure = 'access-changed';
          else if (refreshed !== 'free') preflightFailure = 'eligibility-unavailable';
          else if (!current() || !offerCurrent()) preflightFailure = 'denied';
          if (preflightFailure) {
            receipt.record({ stage, failure: preflightFailure === 'access-changed' ? 'access-changed' : preflightFailure === 'denied' ? 'cancelled' : 'unknown-access' });
            return false;
          }
          freshUntil = o.now() + GUIDED_AD_FRESHNESS_MS;
          receipt.record({ stage, eligible: true });
          return true;
        } catch (error) {
          preflightFailure = 'eligibility-unavailable';
          receipt.record({ stage, failure: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'unavailable' });
          if (request === generation) { generation++; consentForm = false; consentReturned?.(); busy = false; }
          return false;
        } finally { pending = false; if (timer !== undefined) clearTimeout(timer); }
      };
      try {
        if (o.refreshEligibility && !await refresh('membership')) return preflightFailure!;
        if (!eligible()) return 'denied' as const;
        if (o.prepareProvider) {
          let timeout: ReturnType<typeof setTimeout> | undefined;
          receipt.record({ stage: 'provider' });
          try { await Promise.race([o.prepareProvider(), new Promise<void>((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')), GUIDED_PREFLIGHT_TIMEOUT_MS); })]); }
          catch { receipt.record({ stage: 'provider', failure: 'timeout' }); return 'unavailable' as const; }
          finally { if (timeout) clearTimeout(timeout); }
          if (!eligible()) return 'denied' as const;
        }
        const session = o.createReward();
        if (session.provider !== 'native' || session.status !== 'ready') { if (session.diagnostic?.events.length) session.diagnostic.events.forEach(event => receipt.record(event)); else receipt.record({ stage: 'provider', failure: 'unavailable' }); return 'unavailable' as const; }
        const result = await o.completeReward(session, eligible, {
          beforeLoad: () => refresh('fresh-access'),
          isPreparationCurrent: () => current() && (o.isForeground() || consentForm),
          onConsentForm: visible => { if (ownsRequest()) consentForm = visible; },
          afterConsentForm: async () => {
            if (ownsRequest() && consentForm && !o.isForeground()) {
              await new Promise<void>(resolve => {
                const timer = setTimeout(() => { consentReturned = null; resolve(); }, GUIDED_PREFLIGHT_TIMEOUT_MS);
                consentReturned = () => { clearTimeout(timer); consentReturned = null; resolve(); };
              });
            }
            return ownsRequest() && o.isForeground() && o.currentTier() === 'free';
          },
          onDiagnostic: event => receipt.record(event),
          onPresenting: () => {
            if (current() && o.isForeground()) { presenting = true; wasPresented = true; }
          },
          onDismissed: () => { if (request === generation) presenting = false; }
        });
        if (preflightFailure) return preflightFailure;
        if (!current() || (!o.isForeground() && !wasPresented)) return 'denied' as const;
        if (result.provider !== 'native' || result.status !== 'completed' || result.rewardGranted !== true) return 'unavailable' as const;
        earned = { access: make('reward'), request, context, awaitingSdkForeground: wasPresented && !o.isForeground(), presented: wasPresented };
        return repair();
      } catch { receipt.record({ stage: 'provider', failure: 'unavailable' }); return 'unavailable' as const; }
      finally {
        if (request === generation) { busy = false; presenting = false; consentForm = false; }
      }
    },
    consume(id: string) {
      if (!owned() || !hydrated || !o.isForeground() || !grant || grant.sessionId !== id || grant.state === "discarding") return false;
      if (grant.kind !== 'reward' && o.currentTier() !== grant.kind) return false;
      if (grant.state === 'available') persist({ ...grant, state: 'consumed' });
      return true;
    },
    canEnter() { return Boolean(read() && grant?.state !== "discarding" && (grant?.kind === "reward" || o.currentTier() === grant?.kind)); },
    allows(id: string) {
      return Boolean(read()?.sessionId === id && grant?.state === 'consumed' && (grant.kind === 'reward' || o.currentTier() === grant.kind));
    },
    beginDiscard(id?: string) {
      if (!owned()) return false;
      if (grant && id && grant.sessionId !== id) return false;
      generation++; consentForm = false; consentReturned?.(); busy = false; presenting = false; earned = null;
      if (grant) persist({ ...grant, state: 'discarding' });
      else if (id) persist({ version: 1, ownerUid: o.ownerUid, sessionId: id, kind: 'cleanup', state: 'discarding', createdAt: o.now() });
      return true;
    },
    end(id: string) {
      if (!owned() || grant?.sessionId !== id) return;
      o.storage.removeItem(key);
      grant = null; earned = null; generation++; consentForm = false; consentReturned?.(); busy = false;
    },
    clear() {
      if (!owned()) return;
      o.storage.removeItem(key);
      grant = null; earned = null; generation++; consentForm = false; consentReturned?.(); busy = false;
    },
    background(state: string = 'background') {
      // iOS UMP may make the app inactive while its native form is visible.
      // Actual background, navigation and owner changes still invalidate this request.
      if (state === 'inactive' && consentForm) return false;
      // Android's SDK Activity can background the host app. The exception is
      // confined to this presented request and still requires its real reward.
      if (!presenting && !earned?.awaitingSdkForeground) { generation++; consentForm = false; consentReturned?.(); busy = false; earned = null; }
      return Boolean(earned);
    },
    eligibilityChanged() {
      if (o.currentTier() === 'paid' || o.currentTier() === 'review' || (o.currentTier() === 'unknown' && !presenting && !earned?.presented)) { generation++; consentForm = false; consentReturned?.(); busy = false; presenting = false; earned = null; return false; }
      return Boolean(earned);
    },
    foreground() { consentReturned?.(); if (earned) earned.awaitingSdkForeground = false; },
    invalidate() { generation++; consentForm = false; consentReturned?.(); busy = false; presenting = false; earned = null; },
    dispose() { disposed = true; generation++; consentForm = false; consentReturned?.(); busy = false; presenting = false; earned = null; grant = null; }
  };
}

/** Cold links use this same gate; a URL and an interception never constitute access. */
export function shouldOfferGuidedReset(input: {
  screen: string;
  source?: string;
  basicHelp?: boolean;
  hasSessionAccess: boolean;
  completedReceipt: boolean;
}): boolean {
  if (input.screen === 'ad') return true;
  if (input.screen === 'challenge') return !input.hasSessionAccess && !input.completedReceipt;
  return input.screen === 'intercept' && Boolean(input.source) && !['panic-button', 'manual-check'].includes(input.source!) && !input.basicHelp;
}
