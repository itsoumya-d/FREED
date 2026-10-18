import { recoveryDnsAvailability } from '@/lib/recovery-dns-availability';
import { appI18n } from '@/i18n/runtime';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { AppState, Linking, Modal, Platform, ScrollView } from 'react-native';
import { addNetworkStateListener } from 'expo-network';
import { getAdultPolicyOperationError, openWebsiteTestHandoff, websiteSetupWriter } from '@/lib/website-protection-operations';
import { RecoveryDnsPilotSetup } from './RecoveryDnsPilotSetup';
import { IOSWebsiteProtectionSetup, type SafariSetupFeedback } from './IOSWebsiteProtectionSetup';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Pressable } from './Localized';
import { MomentumPageHeader } from './MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';
import { APP_GUARD_MODES, describeAppGuard } from '@/lib/app-guard';
import type { AppGuardMode } from '@/lib/recovery-state';
import { getProtectionSetupReadiness, type ProtectionIntent } from '@/lib/protection-readiness';
import { getProtectionPermissionProgress } from '@/lib/protection-permissions';
import { isProtectionSetupStatusObserved, normalizeProtectionAuthorization, type ProtectionAuthorizationReceipt } from '@/lib/protection-authorization-outcome';
import { syncNativeAdultDomainFeed } from '@/lib/adult-domain-feed-sync';
import { hasPrivateDnsSetupConflict, hasVpnSetupConflict } from '@/lib/protection-setup-presenter';
import { recoveryDnsPilot, applyAdultContentFilter, requestProtectionAuthorization, presentFamilyActivityPicker, openUsageAccessSettings, openProtectionSettings, openPrivateDnsSettings, openVpnSettings, openSafariExtensionSettings, type ProtectionCapability, type ProtectionStatus } from 'freed-protection';
import { Check, X, Plus, Minus } from 'lucide-react-native';

export function ProtectionFeatureSetup({ onOpenAdvancedProtection, intent, capability, status: providedStatus, appCount, onRefresh, onChooseApps, onSyncApps, onClose, vpnDisclosureAcknowledged, onAcknowledgeVpnDisclosure, dailyLimitMinutes = 30, onDailyLimitChange, getActionScope, nativeReadRevision, appGuardMode = 'daily-limit', onAppGuardSave, activationRequest, onActivationHandled }: {
  onOpenAdvancedProtection?:()=>void;
  /** Created only by the foreground Adult websites switch, never an incoming URL. */
  activationRequest?: { id: number; scope: string } | null;
  onActivationHandled?: (id: number) => void;
  getActionScope?: () => string | null; nativeReadRevision?: number;
  appGuardMode?: AppGuardMode; onAppGuardSave?: (mode: AppGuardMode) => Promise<ProtectionStatus>;
  dailyLimitMinutes?: number; onDailyLimitChange?: (minutes:number)=>void;
  intent: ProtectionIntent; capability: ProtectionCapability | null; status: ProtectionStatus | null; appCount: number;
  onRefresh: () => Promise<{ capability: ProtectionCapability | null; status: ProtectionStatus | null; superseded?: boolean }>;
  onChooseApps: () => void; onSyncApps: () => Promise<ProtectionStatus>; onClose: () => void;
  vpnDisclosureAcknowledged: boolean; onAcknowledgeVpnDisclosure: () => void;
}) {
  const observedStatus = isProtectionSetupStatusObserved(providedStatus) ? providedStatus : null;
  const { colors } = useAppTheme(); const [busy, setBusy] = React.useState(false); const gate = React.useRef(false);
  const appRulesNavigationPending = React.useRef(false);
  useFocusEffect(React.useCallback(() => {
    // A push retains this setup under the editor. Back releases only the
    // navigation latch; native permission operations keep their own gate.
    if (!appRulesNavigationPending.current) return;
    appRulesNavigationPending.current = false;
    gate.current = false;
    setBusy(false);
  }, []));
  const alive = React.useRef(true);
  const actionGeneration = React.useRef(0);
  const handledActivation = React.useRef<string | null>(null);
  const [foreground, setForeground] = React.useState(AppState.currentState === 'active');
  const actionScopeReader = React.useRef(getActionScope); actionScopeReader.current = getActionScope;
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; actionGeneration.current++; }; }, []);
  // Device platform selects presentation only; never cache authorization or
  // capability facts when a fresh capability read is missing.
  const platformIdentity = React.useRef<string>(capability?.platform ?? Platform.OS);
  if (capability) platformIdentity.current = capability.platform;
  const [safariFeedback, setSafariFeedback] = React.useState<SafariSetupFeedback | null>(null);
  const [nativeReceipt, setNativeReceipt] = React.useState<Partial<ProtectionStatus> | null>(null);
  const [authorizationReceipt, setAuthorizationReceipt] = React.useState<ProtectionAuthorizationReceipt | null>(null);
  // The explicit authorization result owns this setup step until another request.
  // An ordinary read cannot acknowledge a denied or cancelled request for it.
  const status = observedStatus && authorizationReceipt && !authorizationReceipt.authorized
    ? { ...observedStatus, authorized: false } : observedStatus;
  const [error, setError] = React.useState<string | null>(null); const [disclosure, setDisclosure] = React.useState(false);
  const renderedActionScope = getActionScope?.() ?? null;
  const [pilotAvailable, setPilotAvailable] = React.useState<boolean | null>(null);
  const [pilotReadRetry, setPilotReadRetry] = React.useState(0);
  React.useEffect(() => {
    let current = true;
    setPilotAvailable(null);
    if (intent !== 'websites' || !renderedActionScope) { setPilotAvailable(false); return; }
    void recoveryDnsPilot.status(renderedActionScope).then(receipt => {
      if (current && actionScopeReader.current?.() === renderedActionScope) {
        const availability=recoveryDnsAvailability(receipt);
        if(availability !== 'pending')setPilotAvailable(availability === 'pilot');
      }
    }).catch(() => { /* Unknown native state cannot start the legacy writer. */ });
    return () => { current = false; };
  }, [intent, renderedActionScope]);

  React.useEffect(() => {
    actionGeneration.current++;
    setNativeReceipt(null); setAuthorizationReceipt(null); setError(null); setSafariFeedback(null);
  }, [renderedActionScope, intent]);
  const [draftMode, setDraftMode] = React.useState<AppGuardMode>(capability?.appGuardModes ? appGuardMode : 'daily-limit');
  React.useEffect(() => { setDraftMode(capability?.appGuardModes ? appGuardMode : 'daily-limit'); }, [appGuardMode, capability?.appGuardModes]);
  const guard = describeAppGuard(capability, status, appGuardMode);
  const readiness = getProtectionSetupReadiness(capability, status, appCount, intent, appGuardMode);
  const steps = readiness.permissionPlan.filter(item => item.required), progress = getProtectionPermissionProgress(steps);
  const next = steps.find(item => item.status !== 'complete');
  const authorizationError = authorizationReceipt && authorizationReceipt.outcome !== 'granted'
    ? appI18n.t(`protectionAuthorization.${authorizationReceipt.outcome}`) : null;
  const visibleError = authorizationError ?? error;
  const groupSetup = intent === 'apps' && capability?.appGroups === true;
  const opensAppRules = (action: string | undefined) => action === 'configure-app-guard' || action === 'choose-ios-targets' || action === 'choose-android-apps';
  const groupPermissionSteps = steps.filter(item => !opensAppRules(item.action));
  const websites = intent === 'websites'; const title = websites ? 'Adult website protection' : 'App protection';
  const refresh = React.useCallback(async () => {
    const generation = actionGeneration.current, scope = actionScopeReader.current?.() ?? null;
    try { if (intent === 'websites') await websiteSetupWriter.whenIdle(); return await onRefresh(); }
    catch { if (alive.current && generation === actionGeneration.current && (actionScopeReader.current?.() ?? null) === scope && AppState.currentState === 'active') setError('Device status could not refresh. Check settings again before relying on protection.'); return null; }
  }, [onRefresh, intent]);
  React.useEffect(() => { void refresh(); const listener = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state === 'active') void refresh(); }); const network = addNetworkStateListener(() => { if (AppState.currentState === 'active') void refresh(); }); return () => { listener.remove(); network.remove(); }; }, [refresh]);
  const run = async (disclosureAgreed = false, activation?: { id: number; key: string }) => {
    if (gate.current || !alive.current || AppState.currentState !== 'active') return;
    const consumeActivation = () => {
      if (!activation) return;
      handledActivation.current = activation.key;
      onActivationHandled?.(activation.id);
    };
    // Group rules are activated only by the acknowledged editor. A global
    // status read cannot finish setup or save a group rule. Keep navigation
    // latched through the push; the retained route releases it on focus return.
    if (groupSetup && (!next || opensAppRules(next.action))) {
      appRulesNavigationPending.current = true;
      gate.current = true; setBusy(true); setError(null);
      try { onChooseApps(); }
      catch { appRulesNavigationPending.current = false; gate.current = false; setBusy(false); setError('This step could not finish. Your recovery tools remain available. Try again.'); }
      return;
    }
    if (!next && readiness.activationReady) { onClose(); return; }
    if (!next || next.status === 'unavailable') { setError('This feature is unavailable in this build. Recovery tools remain available.'); return; }
    if (next.id === 'android-dns-guard' && !vpnDisclosureAcknowledged && !disclosureAgreed && !hasPrivateDnsSetupConflict(status) && !hasVpnSetupConflict(status)) { consumeActivation(); setDisclosure(true); return; }
    const generation = ++actionGeneration.current;
    const actionScope = actionScopeReader.current?.() ?? null;
    const actionIsCurrent = () => alive.current && generation === actionGeneration.current
      && (actionScopeReader.current?.() ?? null) === actionScope && AppState.currentState === 'active';
    const publishOutcome = (receipt: Partial<ProtectionStatus> | null, message: string | null) => {
      if (!actionIsCurrent()) return;
      if (receipt) setNativeReceipt(receipt);
      if (message) setError(message);
    };
    gate.current = true; setBusy(true); setError(null);
    if (next.action === 'request-authorization') setAuthorizationReceipt(null);
    try {
      const perform = async () => {
        if (!actionIsCurrent()) return { fresh: { capability, status, superseded: true }, operationError: null, nativeReceipt: null, actionScope };
        if (activation && AppState.currentState !== 'active') return { fresh: { capability, status, superseded: true }, operationError: null, nativeReceipt: null, actionScope };
        consumeActivation();
        let operationError: string | null = null;
        let nativeReceipt: Partial<ProtectionStatus> | null = null;
        if (next.id === 'android-dns-guard' && hasPrivateDnsSetupConflict(status)) await openPrivateDnsSettings();
        else if (next.id === 'android-dns-guard' && hasVpnSetupConflict(status)) await openVpnSettings();
        else switch (next.action) {
          case 'sync-adult-domain-feed': {
            const result = await syncNativeAdultDomainFeed();
            if (result?.provider === 'embedded') {
              operationError = 'Only the offline fallback is available. Website protection is waiting for the reviewed adult-domain feed. Check your connection and retry this step.';
            }
            break;
          }
          case 'apply-adult-filter': {
            const receipt = await applyAdultContentFilter();
            nativeReceipt = receipt;
            if (capability?.platform === 'ios') operationError = getAdultPolicyOperationError(receipt);
            publishOutcome(nativeReceipt, operationError);
            break;
          }
          case 'request-authorization': {
            let authorization: ProtectionAuthorizationReceipt;
            try { authorization = normalizeProtectionAuthorization(await requestProtectionAuthorization()); }
            catch { authorization = normalizeProtectionAuthorization({ authorizationOutcome: 'error' }); }
            if (actionIsCurrent()) {
              setAuthorizationReceipt(authorization);
              if (!authorization.authorized) operationError = appI18n.t(`protectionAuthorization.${authorization.outcome}`);
              // A retry can request public authorization with unknown readback,
              // but cannot chain a policy write from missing device facts.
              else if (websites && capability?.platform === 'ios' && observedStatus !== null) {
                nativeReceipt = await applyAdultContentFilter();
                operationError = getAdultPolicyOperationError(nativeReceipt);
              }
              publishOutcome(nativeReceipt, operationError);
            }
            break;
          }
          case 'configure-app-guard': await onSyncApps(); break;
          case 'choose-ios-targets': await onSyncApps(); if (!actionIsCurrent()) break; await presentFamilyActivityPicker(); if (capability?.appGuardModes && actionIsCurrent()) await onSyncApps(); break;
          case 'choose-android-apps': if (appCount === 0 && actionIsCurrent()) onChooseApps(); else if (actionIsCurrent()) await onSyncApps(); break;
          case 'open-usage-access-settings': await openUsageAccessSettings(); break;
          case 'open-private-dns-settings': await openPrivateDnsSettings(); break;
          case 'open-settings': await openProtectionSettings(); break;
          default: setError('Open Protect for this optional setting.');
        }
        // Finish the readback for any started device action. The parent reader
        // fences publication; stale setup actions still cannot start another write.
        // A failed/malformed status read must settle without erasing the native
        // authorization result already published for this action.
        let fresh: Awaited<ReturnType<typeof onRefresh>> | null;
        try { fresh = await onRefresh(); } catch { fresh = null; }
        if (!fresh || !fresh.superseded && (!fresh.capability || !isProtectionSetupStatusObserved(fresh.status)))
          operationError ??= appI18n.t('protectionAuthorization.readFailed');
        return { fresh, operationError, nativeReceipt, actionScope };
      };
      const result = await (websites ? websiteSetupWriter.enqueue(perform) : perform());
      if (!actionIsCurrent() || result.actionScope !== actionScope) return;
      const { fresh, operationError, nativeReceipt } = result;
      // The mutation belongs to the action, independently of the read epoch.
      publishOutcome(nativeReceipt, operationError);
      if (!fresh || fresh.superseded || operationError) return;
      const after = getProtectionSetupReadiness(fresh.capability, fresh.status, appCount, intent, appGuardMode);
      if (after.permissionPlan.find(item => item.id === next.id)?.status !== 'complete') setError('This step is still incomplete. Approve the request in system settings, then return and check again.');
    } catch { if (actionIsCurrent()) setError('This step could not finish. Your recovery tools remain available. Try again.'); }
    finally { gate.current = false; if (alive.current) setBusy(false); }
  };
  React.useEffect(() => {
    if (pilotAvailable !== false || !foreground || intent !== 'websites' || !capability || !activationRequest || !onActivationHandled || gate.current || !alive.current || !next || next.status === 'unavailable') return;
    if (!Number.isSafeInteger(activationRequest.id) || activationRequest.id <= 0 || !activationRequest.scope || (actionScopeReader.current?.() ?? null) !== activationRequest.scope) return;
    const key = JSON.stringify([activationRequest.id, activationRequest.scope]);
    if (handledActivation.current === key) return;
    const generation = actionGeneration.current;
    let cancelled = false;
    // Strict Mode and a superseded commit cancel before consuming or starting.
    // Native queue admission checks foreground again before the first action.
    void Promise.resolve().then(() => {
      if (cancelled || !alive.current || generation !== actionGeneration.current || gate.current || AppState.currentState !== 'active' || (actionScopeReader.current?.() ?? null) !== activationRequest.scope || handledActivation.current === key) return;
      void run(false, { id: activationRequest.id, key });
    });
    return () => { cancelled = true; };
  }, [activationRequest, capability, foreground, intent, next, onActivationHandled, run, pilotAvailable]);
  const saveMode = async () => {
    if (gate.current || capability?.appGroups === true || capability?.appGuardModes !== true) return;
    gate.current = true; setBusy(true); setError(null);
    try {
      const configured = await (onAppGuardSave ? onAppGuardSave(draftMode) : onSyncApps());
      if (configured?.appGuardMode !== draftMode || configured.protectionConfigurationResetDisabled === true) throw new Error('Guard mode rejected');
      await refresh();
    } catch { setError('The app guard could not sync. Check permissions and targets, then retry saving this mode.'); }
    finally { gate.current = false; setBusy(false); }
  };
  const button = (label: string, press: () => void, primary = false, testID?: string, unavailable = false) => <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: busy || unavailable, busy }} disabled={busy || unavailable} onPress={press} style={({ pressed }) => ({ minHeight: 56, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? colors.accent : colors.surface2, opacity: busy || unavailable || pressed ? .6 : 1 })}><Text style={{ color: primary ? colors.onAccent : colors.text, fontSize: 17, fontWeight: '700' }}>{label}</Text></Pressable>;
  const openTest = (url: string) => {
    void openWebsiteTestHandoff({url,getScope:()=>alive.current?JSON.stringify([actionGeneration.current,actionScopeReader.current?.()??null]):null,open:Linking.openURL}).then(receipt=>{if(!receipt||!alive.current)return;setNativeReceipt(previous=>({...previous,websiteHandoff:receipt}));if(!receipt.opened)setError('The browser could not open. Open the test address in your browser and check the result.');});
  };
  const openSafariSetup = async (target: 'content-blocker' | 'focus-shield') => {
    if (gate.current || !alive.current) return;
    const generation = ++actionGeneration.current;
    const actionScope = actionScopeReader.current?.() ?? null;
    const actionIsCurrent = () => alive.current && generation === actionGeneration.current
      && (actionScopeReader.current?.() ?? null) === actionScope;
    gate.current = true; setBusy(true); setSafariFeedback(null);
    let settingsStarted = false;
    try {
      if (target === 'content-blocker') await syncNativeAdultDomainFeed();
      // A pending blocker feed must not open another owner's settings.
      if (!actionIsCurrent()) return;
      settingsStarted = true;
      const receipt = await openSafariExtensionSettings(target);
      if (actionIsCurrent()) {
        setNativeReceipt(previous => ({ ...previous, ...receipt }));
        const matchingTarget = receipt?.safariExtensionSettingsTarget === target;
        const route = receipt?.safariExtensionSettingsRoute;
        const opened = receipt?.safariExtensionSettingsOpened === true && matchingTarget;
        // A destination receipt confirms only a settings handoff. Native error /
        // message details remain in the receipt; failures use localized repair copy.
        setSafariFeedback({ target, outcome: opened && route === 'extension' ? 'direct'
          : opened && route === 'app-settings' ? 'fallback' : 'failed' });
      }
    } catch {
      if (actionIsCurrent()) setSafariFeedback({ target, outcome: 'failed' });
    } finally {
      // Finish readback only for a started settings operation. The parent reader
      // fences owner publication, including after a switch or this screen unmounts.
      if (settingsStarted) {
        const publishReadFailure = () => {
          if (actionIsCurrent()) setSafariFeedback(previous => previous ? { ...previous, refreshFailed: true } : { target, outcome: 'failed', refreshFailed: true });
        };
        try {
          const fresh = await onRefresh();
          // The parent uses allSettled: missing current data is a read failure,
          // while superseded data must not produce a new local outcome.
          if (!fresh.superseded && (!fresh.capability || !fresh.status)) publishReadFailure();
        } catch { publishReadFailure(); }
      }
      gate.current = false; if (alive.current) setBusy(false);
    }
  };
  if (websites && pilotAvailable === null) return <SafeAreaView style={{flex:1,backgroundColor:colors.bg,padding:24,justifyContent:'center',gap:16}}><Text accessibilityRole="header" style={{color:colors.text,fontSize:24,fontWeight:'700'}}>Adult website protection</Text><Text style={{color:colors.text2,fontSize:17,lineHeight:24}}>Device status could not refresh. Check settings again before relying on protection.</Text>{button('Check settings again',()=>setPilotReadRetry(value=>value+1),true,'recovery-dns-status-retry')}{button('Continue using recovery tools',onClose,false,'recovery-dns-status-close')}</SafeAreaView>;
  if (websites && pilotAvailable === true && getActionScope) return <SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><RecoveryDnsPilotSetup getActionScope={getActionScope} onClose={onClose} onChanged={() => { if (activationRequest) onActivationHandled?.(activationRequest.id); void refresh(); }} /></SafeAreaView>;
  if (websites && platformIdentity.current === 'ios') return <IOSWebsiteProtectionSetup readiness={readiness} next={next} authorized={capability?.platform === 'ios' && status?.authorized === true} busy={busy} error={visibleError} receipt={nativeReceipt}
    authorizationRetryAvailable={authorizationReceipt !== null && !authorizationReceipt.authorized && next?.action === 'request-authorization'}
    onRun={() => void run()} onRefresh={() => { setError(null); return refresh(); }} onClose={onClose} onOpenTest={openTest}
    status={status} nativeFactsAvailable={capability?.platform === 'ios' && status !== null} foreground={foreground} getActionScope={getActionScope} nativeReadRevision={nativeReadRevision}
    onAdvanced={onOpenAdvancedProtection} safariFeedback={safariFeedback} onSafariRecoverySetup={() => { void openSafariSetup('focus-shield'); }} onSafariSetup={capability?.safariContentBlocker ? () => { void openSafariSetup('content-blocker'); } : undefined} />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ScrollView testID={`setup-${intent}`} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close setup" onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center' }}><X color={colors.text} size={24} /></Pressable>
    <MomentumPageHeader pose={busy ? 'waiting' : !groupSetup && readiness.activationReady ? 'shield' : 'guide'} context={`setup-${intent}`} title={title} description={websites ? 'Block supported adult websites. App selection is optional.' : groupSetup ? 'Choose apps to pause, then review their shared rule.' : 'Choose distracting apps and when to pause them. Website filtering is optional.'} category={websites ? 'commitment' : 'movement'} compact />
    {!groupSetup ? <><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{websites ? 'DNS Guard blocks supported adult domains. It does not inspect every page or content inside apps.' : guard.scope}</Text>
    {websites ? <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>DNS filters whole domains. It cannot separate YouTube Shorts from other YouTube pages or filter mixed content inside apps.</Text> : <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>{draftMode === 'daily-limit' ? 'Selecting an app does not block it immediately. The daily timer applies after permissions and native configuration are ready. Schedules are separate optional blocking windows.' : draftMode === 'before-use' ? 'Before use pauses selected individual applications immediately after you save the mode and native authorization is ready. The default alone does not activate it.' : 'Scheduled mode uses registered local time windows. iOS covers only selected individual applications; Android windows cover supported distracting packages.'}</Text>}
    <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{websites ? readiness.websiteProtection.status : readiness.appLimits.status}</Text></> : <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>Selected apps stay off until you review the rule and activate protection.</Text>}
    {!websites && !groupSetup ? <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: '700' }}>App guard mode</Text>
      {APP_GUARD_MODES.map(item => <Pressable key={item.value} testID={`setup-mode-${item.value}`} accessibilityRole="radio" accessibilityState={{ selected: draftMode === item.value, disabled: busy || capability?.appGuardModes !== true }} disabled={busy || capability?.appGuardModes !== true} onPress={() => setDraftMode(item.value)} style={{ minHeight: 48, padding: 12, borderRadius: 12, backgroundColor: draftMode === item.value ? colors.surface2 : colors.surface }}><Text style={{ color: colors.text, fontSize: 17 }}>{item.label}</Text></Pressable>)}
      {capability?.appGuardModes === true ? button(busy ? 'Saving…' : 'Save guard mode', () => void saveMode(), true, 'setup-mode-save') : <Text style={{ color: colors.text2, lineHeight: 24 }}>Mode options are unavailable in this installed build. Existing daily limits remain available.</Text>}
      <Text testID="setup-guard-state" style={{ color: colors.text2, lineHeight: 24 }}>{`Device mode: ${guard.mode}. Configured: ${guard.configured ? 'Yes' : 'No'}. Authorized: ${guard.authorized ? 'Yes' : 'No'}. Ready: ${guard.ready ? 'Yes' : 'No'}. Device blocking: not tested.`}</Text>
      <Text style={{ color: colors.text2, lineHeight: 24 }}>{guard.explanation}</Text>
    </View> : null}
    {!websites && !groupSetup && draftMode === 'daily-limit' ? <View style={{padding:16,borderRadius:16,backgroundColor:colors.surface2,gap:12}}><Text style={{color:colors.text,fontSize:17,fontWeight:'700'}}>Daily limit</Text><View style={{flexDirection:'row',alignItems:'center',gap:12}}><Pressable testID="setup-limit-decrease" accessibilityRole="button" accessibilityLabel="Decrease Daily limit" disabled={busy||dailyLimitMinutes<=5||!onDailyLimitChange} onPress={()=>{try{onDailyLimitChange?.(Math.max(5,dailyLimitMinutes-5));}catch{setError('This step could not finish. Your recovery tools remain available. Try again.');}}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Minus color={colors.accent} size={24}/></Pressable><Text translate={false} accessibilityRole="text" style={{flex:1,color:colors.text,fontSize:24,fontWeight:'700',textAlign:'center'}}>{dailyLimitMinutes.toLocaleString(appI18n.language)}</Text><Pressable testID="setup-limit-increase" accessibilityRole="button" accessibilityLabel="Increase Daily limit" disabled={busy||dailyLimitMinutes>=240||!onDailyLimitChange} onPress={()=>{try{onDailyLimitChange?.(Math.min(240,dailyLimitMinutes+5));}catch{setError('This step could not finish. Your recovery tools remain available. Try again.');}}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Plus color={colors.accent} size={24}/></Pressable></View><Text style={{color:colors.text2,fontSize:15,lineHeight:24}}>minutes/day</Text></View> : null}
    {!groupSetup ? <Text translate={false} style={{ color: colors.text2, fontSize: 15 }}>{progress.complete} / {progress.required}</Text> : null}
    {(groupSetup ? groupPermissionSteps : steps).map(item => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ minWidth: 24 }}>{item.status === 'complete' ? <Check color={colors.accent} size={24} /> : null}</View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{item.title}</Text><Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{item.status === 'complete' ? 'Ready' : item.status === 'unavailable' ? 'Unavailable' : item.reason}</Text></View></View>)}
    {visibleError ? <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{visibleError}</Text> : null}
    {button(groupSetup && (!next || opensAppRules(next.action)) ? 'Choose apps' : !groupSetup && readiness.activationReady ? 'Done' : busy ? 'Checking settings…' : next?.status === 'unavailable' ? 'Unavailable in this build' : next?.title ?? 'Check settings again', () => void run(), true, 'feature-setup-continue', next?.status === 'unavailable')}
    {button('Check settings again', () => { void refresh(); }, false, 'feature-setup-refresh')}
    {websites ? <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: '700' }}>Check actual browsing</Text><Text style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>Open Cloudflare's safe adult-category test page: it should be blocked when that filtering layer works. Then open example.com: it should load. These links open your browser; FREED does not observe the result or mark protection verified.</Text>{button('Open adult-category test', () => openTest('https://nudity.testcategory.com'), false, 'website-test-adult')}{button('Open normal website test', () => openTest('https://example.com'), false, 'website-test-normal')}</View> : null}
    {button('Continue using recovery tools', onClose, false, 'feature-setup-leave')}
    <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>Permission status is checked on this device. Test actual blocking before relying on protection.</Text>
  </ScrollView><Modal visible={disclosure} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDisclosure(false)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><View style={{ padding: 24, gap: 24 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>DNS Guard permission</Text><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>FREED uses Android's VPN permission for DNS filtering. DNS questions are classified on your device and resolved by the configured adult-content filtering provider. FREED does not inspect HTTPS content or proxy normal traffic. A competing VPN or Private DNS setting can affect coverage.</Text>{button('Agree and continue', () => { onAcknowledgeVpnDisclosure(); setDisclosure(false); void run(true); })}{button('Cancel', () => setDisclosure(false))}</View></SafeAreaView></Modal></SafeAreaView>;
}
