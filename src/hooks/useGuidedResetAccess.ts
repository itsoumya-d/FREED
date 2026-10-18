import 'expo-sqlite/localStorage/install';
import React from 'react';
import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { createGuidedResetAccessController, type GuidedTier } from '../lib/guided-reset-access';
import { createRewardedResetSession, completeRewardedResetSession, awaitRewardedProvider, subscribeRewardedProvider, getAdPrivacyOptionsRequired, showAdPrivacyOptions, type MonetizationPlatform } from '../lib/monetization';
import { appI18n } from '../i18n/runtime';
import { getFirebaseAccountScope } from '../lib/firebase-native';

export function useGuidedResetAccess(ownerUid: string | null, tier: GuidedTier, platform: MonetizationPlatform, active = true, contextKey = "", recheckTier?: () => GuidedTier, authority?: { refreshEligibility: (isCurrent: () => boolean) => Promise<GuidedTier>; isChecking?: () => boolean }) {
  const live = React.useRef({ ownerUid, tier, active, contextKey, recheckTier, authority });
  live.current = { ownerUid, tier, active, contextKey, recheckTier, authority };
  const [, publish] = React.useReducer(n => n + 1, 0);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [accessUnavailable, setAccessUnavailable] = React.useState(false);
  const [repairNeeded, setRepairNeeded] = React.useState(false);
  const controller = React.useMemo(() => ownerUid ? createGuidedResetAccessController({
    ownerUid,
    storage: localStorage,
    currentOwner: () => getFirebaseAccountScope() === live.current.ownerUid ? live.current.ownerUid : null,
    currentTier: () => live.current.recheckTier?.() ?? live.current.tier,
    requestContext: () => live.current.contextKey,
    isChecking: () => live.current.authority?.isChecking?.() ?? false,
    ...(authority ? { refreshEligibility: (isCurrent: () => boolean) => live.current.authority!.refreshEligibility(isCurrent) } : {}),
    isForeground: () => live.current.active && AppState.currentState === 'active',
    now: Date.now,
    createId: randomUUID,
    prepareProvider: awaitRewardedProvider,
    createReward: () => createRewardedResetSession({ platform, premium: false }),
    completeReward: (session, isEligible, lifecycle) => completeRewardedResetSession(session, { platform, isEligible, lifecycle })
  }) : null, [ownerUid, platform]);
  const [adPrivacyRequired, setAdPrivacyRequired] = React.useState(false);
  const [adPrivacyBusy, setAdPrivacyBusy] = React.useState(false);
  const [adPrivacyNotice, setAdPrivacyNotice] = React.useState<string | null>(null);
  const privacyPending = React.useRef(false);
  React.useEffect(() => {
    let mounted = true;
    const refresh = () => { void getAdPrivacyOptionsRequired().then(required => { if (mounted && required !== null) setAdPrivacyRequired(required); }).catch(() => {}); };
    const unsubscribe = subscribeRewardedProvider(refresh);
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { mounted = false; unsubscribe(); listener.remove(); };
  }, [ownerUid, active, busy]);
  const openAdPrivacyOptions = async () => {
    // Privacy choices are device-wide UMP state and stay reachable outside a guided route.
    if (privacyPending.current || busy || AppState.currentState !== 'active') return false;
    const owner = live.current.ownerUid;
    const scope = getFirebaseAccountScope();
    const current = () => AppState.currentState === 'active' && live.current.ownerUid === owner && getFirebaseAccountScope() === scope;
    privacyPending.current = true; setAdPrivacyBusy(true); setAdPrivacyNotice(null);
    controller?.invalidate();
    let opened = false;
    try { opened = await showAdPrivacyOptions(current); }
    catch { opened = false; }
    finally { privacyPending.current = false; setAdPrivacyBusy(false); }
    if (live.current.ownerUid !== owner || getFirebaseAccountScope() !== scope) return false;
    if (!opened) setAdPrivacyNotice(appI18n.t('momentum.profileSettings.adPrivacyUnavailable'));
    const required = await getAdPrivacyOptionsRequired().catch(() => null);
    if (required !== null && live.current.ownerUid === owner) setAdPrivacyRequired(required);
    return opened;
  };
  const currentController = React.useRef(controller);
  currentController.current = controller;

  React.useEffect(() => {
    setNotice(null); setBusy(false); setRepairNeeded(false); setAccessUnavailable(false);
    try { controller?.hydrate(); }
    catch { setNotice('Access could not be loaded. Retry after checking device storage.'); }
    publish();
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { if (!controller?.background(state)) setRepairNeeded(false); setBusy(controller?.isBusy() ?? false); }
      else controller?.foreground();
    });
    return () => { listener.remove(); controller?.dispose(); };
  }, [controller]);
  React.useEffect(() => {
    if (!active) { controller?.invalidate(); setRepairNeeded(false); setBusy(false); }
  }, [active, controller]);
  React.useEffect(() => { controller?.invalidate(); setRepairNeeded(false); }, [contextKey, controller]);
  React.useEffect(() => { if (!controller?.eligibilityChanged()) setRepairNeeded(false); }, [tier, controller]);

  const run = React.useCallback((operation: () => boolean) => {
    try {
      const ok = operation();
      publish();
      setNotice(ok ? null : 'Access is unavailable. Check your account and try again.');
      return ok;
    } catch {
      setNotice('Access could not be saved. Free up space and retry.');
      return false;
    }
  }, []);
  const watch = async (offerEligible?: () => boolean) => {
    if (!controller || privacyPending.current) return false;
    setBusy(true); setAccessUnavailable(false);
    const result = await controller.watch(offerEligible);
    if (live.current.ownerUid !== ownerUid || currentController.current !== controller) return false;
    setBusy(controller.isBusy()); publish();
    if (result === 'denied' && controller.isBusy()) return false;
    setAccessUnavailable(result === 'eligibility-unavailable');
    const earnedNeedsSaving = result === 'save-failed' || result === 'pending-foreground' || result === 'pending-eligibility';
    setRepairNeeded(earnedNeedsSaving);
    setNotice(result === 'eligibility-unavailable' ? 'Access could not be verified. Retry the access check or use Help now.' : (result === 'granted' || result === 'access-changed') ? null : earnedNeedsSaving
      ? 'Your ad was completed. Retry saving access; no second ad is needed.'
      : 'The ad could not grant access. You can retry, use Help now, or return to safety.');
    return result === 'granted';
  };
  return {
    adPrivacyRequired, adPrivacyBusy, adPrivacyNotice, openAdPrivacyOptions,
    grant: controller?.read() ?? null, diagnostic: controller?.diagnostic() ?? null, busy, notice, repairNeeded, accessUnavailable, watch,
    cleanupPending: controller?.read()?.state === "discarding",
    beginDiscard: (id?: string) => run(() => controller?.beginDiscard(id) ?? false),
    reload: () => run(() => { setAccessUnavailable(false); controller?.hydrate(); return Boolean(controller); }),
    startLicensed: () => run(() => controller?.startLicensed() ?? false),
    repair: () => run(() => {
      const result = controller?.repair();
      if (result === 'granted' || result === 'denied') setRepairNeeded(false);
      return result === 'granted';
    }),
    canEnter: () => controller?.canEnter() ?? false,
    nextSessionId: () => controller?.read()?.sessionId ?? '',
    consume: (id: string) => controller?.consume(id) ?? false,
    allows: (id: string) => controller?.allows(id) ?? false,
    end: (id: string) => run(() => { controller?.end(id); return true; }),
    clear: () => run(() => { controller?.clear(); return true; }),
    invalidate: () => { controller?.invalidate(); setRepairNeeded(false); publish(); }
  };
}
