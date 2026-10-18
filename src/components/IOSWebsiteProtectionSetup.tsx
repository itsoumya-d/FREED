import React from 'react';
import { translateSource } from '@/i18n/runtime';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X, Check, ChevronDown, ChevronUp, RefreshCw, Settings2 } from 'lucide-react-native';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { ProtectionSetupReadiness } from '@/lib/protection-readiness';
import type { ProtectionStatus } from 'freed-protection';
import { getSafariConfigurationPresentation, type ProtectionReadTicket } from '@/lib/website-protection-operations';
import { localizedDate } from '@/i18n/runtime';
import type { ProtectionPermissionStep } from '@/lib/protection-permissions';
import { Text, View, Pressable } from './Localized';
import { MomentumCompanion } from './MomentumCompanion';
import { EncryptedDnsSection } from './EncryptedDnsSection';
import { useEncryptedDns } from '@/hooks/use-encrypted-dns';
import { normalizeEncryptedDnsStatus } from '@/lib/encrypted-dns';
import { getAdultProtectionPresentation, isAdultConfigurationReadbackCurrent, type AdultProtectionObservations } from '@/lib/adult-protection-presentation';

export type SafariSetupFeedback = { target: 'content-blocker' | 'focus-shield'; outcome: 'direct' | 'fallback' | 'failed'; refreshFailed?: boolean };

/** Presentation only. The shared DNS controller and parent runner own device actions. */
export function IOSWebsiteProtectionSetup({ readiness, next, authorized, authorizationRetryAvailable = false, busy, error, receipt, observations, status, onRun, onRefresh, onClose, onOpenTest, onSafariSetup, onSafariRecoverySetup, safariFeedback, onAdvanced, nativeFactsAvailable = true, foreground = true, getActionScope, nativeReadRevision }: {
  observations?: AdultProtectionObservations | null; status?: ProtectionStatus | null;
  onSafariRecoverySetup?: () => void; safariFeedback?: SafariSetupFeedback | null;
  onAdvanced?: () => void; nativeFactsAvailable?: boolean; foreground?: boolean; getActionScope?: () => string | null; nativeReadRevision?: number;
  readiness: ProtectionSetupReadiness; next?: ProtectionPermissionStep; authorized: boolean;
  /** A retained request failure may expose retry while current status is unknown. */
  authorizationRetryAvailable?: boolean;
  busy: boolean; error: string | null; receipt?: Partial<ProtectionStatus> | null; onRun: () => void; onRefresh: () => Promise<unknown>; onClose: () => void;
  onOpenTest: (url: string) => void; onSafariSetup?: () => void;
}) {
  const { colors } = useAppTheme(); const { t } = useTranslation();
  const dns = useEncryptedDns();
  const [dnsBusy, setDnsBusy] = React.useState(false);
  const [review, setReview] = React.useState(false);
  const [inspected, setInspected] = React.useState<string | null>(null);
  const [, setObservationClock] = React.useState(0);
  const [safariDetails, setSafariDetails] = React.useState(false);
  const [details, setDetails] = React.useState(false);
  const [testExpanded, setTestExpanded] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  // Both halves remain live: a newer native-only read revokes the native ticket
  // even when DNS coalesces and owner/readiness stay unchanged.
  const [checkedStatus, setCheckedStatus] = React.useState<{ resolver: unknown; readTicket: ProtectionReadTicket } | null>(null);
  const [readError, setReadError] = React.useState(false);
  const checkGate = React.useRef(false), alive = React.useRef(true), readGeneration = React.useRef(0);
  const scopeReader = React.useRef(getActionScope); scopeReader.current = getActionScope;
  const scope = getActionScope?.() ?? null;
  const foregroundRef = React.useRef(foreground); foregroundRef.current = foreground;
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; readGeneration.current++; }; }, []);
  React.useEffect(() => { readGeneration.current++; setCheckedStatus(null); setReadError(false); setInspected(null); setTestExpanded(false); setSafariDetails(false); }, [scope, foreground, authorized, readiness.websiteProtection.ready, nativeFactsAvailable]);
  const nativeSupported = readiness.websiteProtection.supported;
  const safeDns = normalizeEncryptedDnsStatus(dns.status);
  const pending = busy || checking || Boolean(dns.pending);
  const dnsUnresolved = dns.pending === 'refresh' && dns.lastCheckedAt === null && dns.error !== 'read-failed';
  const pairedCurrent = checkedStatus !== null && checkedStatus.resolver === dns.status && checkedStatus.readTicket.isCurrent()
    && (nativeReadRevision === undefined || checkedStatus.readTicket.revision === nativeReadRevision);
  const facts = { platform: 'ios' as const, nativeSupported, authorized, policyConfigured: readiness.websiteProtection.ready,
    dnsStatus: dns.status, observations, error: error ?? dns.error, pending };
  const current = getAdultProtectionPresentation({ ...facts, configurationCheckedAt: dns.lastCheckedAt });
  const observedCurrent = current.verified && (nativeReadRevision === undefined || pairedCurrent);
  const checked = nativeFactsAvailable && !readError && (observedCurrent || pairedCurrent) && !facts.error && !pending;
  const presentation = checked ? current : getAdultProtectionPresentation({ ...facts, configurationCheckedAt: null });
  // The separate Safari observation never changes the filtering presentation.
  // A current paired read is required before displaying configuration evidence.
  const safari = getSafariConfigurationPresentation(status?.safariRecoveryObservation, { current: nativeFactsAvailable && pairedCurrent && foreground && !pending && !readError && !facts.error });
  const stage = authorizationRetryAvailable && nativeSupported && !authorized ? 'authorize'
    : !nativeFactsAvailable ? 'readback'
    : nativeSupported && !authorized ? 'authorize'
      : nativeSupported && !readiness.websiteProtection.ready ? 'policy'
        : dns.error === 'read-failed' || dnsUnresolved ? 'readback'
          : safeDns.supported && safeDns.releaseEnabled && (!safeDns.configured || dns.error === 'write-failed') ? 'save-dns'
            : safeDns.supported && safeDns.releaseEnabled && !safeDns.enabled ? safeDns.configurationLabel ? 'enable-dns' : 'readback'
              : !safeDns.supported || !safeDns.releaseEnabled ? 'unsupported'
                : readError || facts.error || safeDns.healthy === false || !(pairedCurrent || observedCurrent) ? 'readback'
                  : onSafariRecoverySetup ? 'safari' : 'browse';
  const disabled = busy || dnsBusy || checking || !foreground;
  const text = (value: string, id?: string, alert = false) => <Text translate={false} testID={id} accessibilityRole={alert ? 'alert' : 'text'} style={{ color: alert ? colors.red : colors.text2, fontSize: 17, lineHeight: 24 }}>{value}</Text>;
  const button = (id: string, label: string, onPress: () => void, primary = false, unavailable = false, icon?: React.ReactNode) => <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || unavailable, busy: pending }} disabled={disabled || unavailable} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, padding: 12, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? colors.accent : colors.surface2, opacity: disabled || unavailable || pressed ? .6 : 1 })}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{icon}<Text translate={false} style={{ flexShrink: 1, color: primary ? colors.onAccent : colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{label}</Text></View></Pressable>;
  const checkConfiguration = async () => {
    if (disabled || checkGate.current) return;
    const generation = ++readGeneration.current, actionScope = scopeReader.current?.() ?? null;
    const currentRead = () => alive.current && foregroundRef.current && generation === readGeneration.current && (scopeReader.current?.() ?? null) === actionScope;
    checkGate.current = true; setChecking(true); setCheckedStatus(null); setReadError(false);
    try {
      const [native, resolver] = await Promise.all([onRefresh(), dns.refresh()]);
      if (!currentRead()) return;
      const readTicket = native && typeof native === 'object' ? (native as { readTicket?: ProtectionReadTicket }).readTicket : null;
      const ticketValid = readTicket != null && Number.isSafeInteger(readTicket.revision) && typeof readTicket.isCurrent === 'function';
      const ticketCurrent = ticketValid && readTicket.isCurrent();
      const confirmed = ticketCurrent && isAdultConfigurationReadbackCurrent(native, resolver, nativeSupported);
      setCheckedStatus(confirmed ? { resolver, readTicket } : null);
      // A superseding reader is a fresh pending task, not this check's failure.
      setReadError(!confirmed && !(ticketValid && !ticketCurrent));
    } catch { if (currentRead()) { setCheckedStatus(null); setReadError(true); } }
    finally { checkGate.current = false; if (alive.current) setChecking(false); }
  };
  const wasForeground = React.useRef(foreground);
  const checkRef = React.useRef(checkConfiguration); checkRef.current = checkConfiguration;
  React.useEffect(() => {
    const returned = foreground && !wasForeground.current; wasForeground.current = foreground;
    if (!returned) return;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled && alive.current && foregroundRef.current) void checkRef.current(); });
    return () => { cancelled = true; };
  }, [foreground]);
  const dateLabel = (value: string) => localizedDate(value, { dateStyle: 'medium', timeStyle: 'short' });
  const safariFacts = safari.receipt?.facts;
  const safariDetailRows = [
    ['package', safari.packageVariant ? t(`safariConfiguration.package.${safari.packageVariant}`) : t('safariConfiguration.fact.unknown')],
    ['enabled', t(`safariConfiguration.fact.${safari.enabled === true ? 'enabled' : safari.enabled === false ? 'disabled' : 'unknown'}`)],
    ['enabledReason', t(`safariConfiguration.fact.${safari.enabledReason ?? 'unavailable'}`)],
    ['receipt', t(`safariConfiguration.fact.${safari.freshness}`)],
    ['reason', safari.reason ? t(`safariConfiguration.reason.${safari.reason}`) : t('safariConfiguration.fact.unavailable')],
    ...(safariFacts ? [
      ['grants', t(`safariConfiguration.fact.${safariFacts.grants}`)],
      ['staticRules', t(`safariConfiguration.fact.${safariFacts.staticRules}`)],
      ['dynamicRules', t(`safariConfiguration.fact.${safariFacts.dynamicRules}`)],
      ['sessionRules', t(`safariConfiguration.fact.${safariFacts.sessionRules}`)],
      ['diagnostic', t(`safariConfiguration.fact.${safariFacts.diagnostic}`)],
    ] : []),
  ];
  React.useEffect(() => {
    if (!foreground || !safari.receipt) return;
    const remaining = Date.parse(safari.receipt.expiresAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setObservationClock(value => value + 1), remaining + 1);
    return () => clearTimeout(timer);
  }, [foreground, safari.receipt?.expiresAt]);
  const stageLabel = stage === 'authorize' ? t('iosWebsiteSetup.authorize') : stage === 'policy' ? t('iosWebsiteSetup.applyPolicy')
    : stage === 'save-dns' ? t('iosWebsiteSetup.saveDns') : stage === 'enable-dns' ? t('guidedWebsiteSetup.selectDns')
      : stage === 'safari' ? t('iosWebsiteSetup.safariRecoveryTitle') : stage === 'browse' ? t('guidedWebsiteSetup.browsing') : t('iosWebsiteSetup.checkConfiguration');
  const layerState = busy ? 'settingUp' : !nativeSupported ? 'unsupported' : error ? 'needsAttention' : readiness.websiteProtection.ready ? 'enabled' : authorized ? 'needsAttention' : 'off';
  const safariReceipt = safariFeedback ? <View testID="website-safari-settings-feedback" accessibilityLiveRegion="polite" style={{ gap: 4 }}>
    {text(t(`iosWebsiteSetup.${safariFeedback.target === 'focus-shield' ? 'safariRecovery' : 'safariBlocker'}${safariFeedback.outcome === 'direct' ? 'Direct' : safariFeedback.outcome === 'fallback' ? 'Fallback' : 'Failed'}`), undefined, safariFeedback.outcome === 'failed')}
    {safariFeedback.refreshFailed ? text(t('iosWebsiteSetup.safariSettingsRefreshFailed'), undefined, true) : null}
  </View> : null;
  const browsing = <View testID="website-test-step" style={{ gap: 10 }}>
    <Pressable testID="website-test-toggle" accessibilityRole="button" accessibilityLabel={t('guidedWebsiteSetup.browsing')} accessibilityState={{ expanded: testExpanded }} onPress={() => setTestExpanded(value => !value)} style={{ minHeight: 48, justifyContent: 'center' }}><Text translate={false} style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>{t('guidedWebsiteSetup.browsing')}</Text></Pressable>
    {text(presentation.verified ? translateSource('Verified on this network.') : t('iosWebsiteSetup.testNeeded'), 'website-browsing-test-status')}
    {testExpanded ? <View style={{ gap: 10 }}>{text(t('iosWebsiteSetup.testInstructions'))}
      {button('website-test-adult', t('iosWebsiteSetup.adultTest'), () => onOpenTest('https://nudity.testcategory.com'))}
      {button('website-test-normal', t('iosWebsiteSetup.allowedTest'), () => onOpenTest('https://example.com'))}
      {text(t('iosWebsiteSetup.testUnobserved'))}
      {onSafariRecoverySetup ? text(t('guidedWebsiteSetup.recoveryCheck')) : null}
    </View> : null}
  </View>;
  const safariInReview = Boolean(onSafariRecoverySetup && review && inspected === 'safari' && stage !== 'safari');
  // One renderer keeps repair controls and truthful evidence identical in both placements.
  const safariRecovery = <View testID="website-safari-recovery" style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{safari.configuration === 'checked' ? <Check color={colors.text2} size={20} /> : null}{text(t(safari.configuration === 'checked' ? 'safariConfiguration.configurationChecked' : 'guidedWebsiteSetup.notConfirmed'), 'website-safari-configuration-status')}</View>
        {text(t(`safariConfiguration.message.${safari.message}`), 'website-safari-guidance')}
        {safari.checkedAt ? text(t('safariConfiguration.lastCheck', { time: dateLabel(safari.checkedAt) }), 'website-safari-last-check') : null}
        {text(t('safariConfiguration.notProof'))}
        {safariReceipt}
        {button('website-safari-recovery-setup', t('safariConfiguration.openSettings'), () => onSafariRecoverySetup?.(), stage === 'safari' && safari.action === 'settings', false, <Settings2 color={stage === 'safari' && safari.action === 'settings' ? colors.onAccent : colors.text} size={20} />)}
        {safari.action === 'refresh' ? button('website-safari-refresh', t('safariConfiguration.refresh'), () => { void checkConfiguration(); }, stage === 'safari', false, <RefreshCw color={stage === 'safari' ? colors.onAccent : colors.text} size={20} />) : null}
        <Pressable testID="website-safari-details" accessibilityRole="button" accessibilityLabel={t('safariConfiguration.details')} accessibilityState={{ expanded: safariDetails }} onPress={() => setSafariDetails(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text translate={false} style={{ flex: 1, color: colors.accent, fontSize: 17, fontWeight: '700' }}>{t('safariConfiguration.details')}</Text>{safariDetails ? <ChevronUp color={colors.accent} size={20} /> : <ChevronDown color={colors.accent} size={20} />}</Pressable>
        {safariDetails ? <View testID="website-safari-observation-details" style={{ gap: 10 }}>
          {safariDetailRows.map(([key, value]) => <View key={key}>{text(t(`safariConfiguration.detail.${key}`, { value }), `website-safari-detail-${key}`)}</View>)}
          {safari.receipt ? text(t('safariConfiguration.receiptTime', { time: dateLabel(safari.receipt.receivedAt) })) : null}
          {safari.enabledCheckedAt ? text(t('safariConfiguration.enabledTime', { time: dateLabel(safari.enabledCheckedAt) })) : null}
          {safari.enabledReason === 'unsupported-os' ? text(t('safariConfiguration.olderOS')) : null}
          {text(t('safariConfiguration.scope'))}{text(t('safariConfiguration.staticScope'))}
          {safari.action === 'none' ? button('website-safari-refresh', t('safariConfiguration.refresh'), () => { void checkConfiguration(); }) : null}
        </View> : null}
        {browsing}
      </View>;
  const steps = [
    { id: 'screen-time', title: t('guidedWebsiteSetup.screenTime'), description: t(!nativeSupported ? 'iosWebsiteSetup.screenTimeUnsupported' : readiness.websiteProtection.ready ? 'iosWebsiteSetup.policyEnabled' : authorized ? 'iosWebsiteSetup.policyNeeded' : 'iosWebsiteSetup.authorizationNeeded'), result: t(nativeFactsAvailable ? `iosWebsiteSetup.${layerState}` : 'guidedWebsiteSetup.notConfirmed') },
    { id: 'dns', title: t('guidedWebsiteSetup.dns'), description: t(safeDns.enabled ? 'iosWebsiteSetup.dnsEnabled' : safeDns.configured ? 'iosWebsiteSetup.dnsSaved' : 'iosWebsiteSetup.dnsDescription'), result: t(dns.error === 'read-failed' || dnsUnresolved ? 'guidedWebsiteSetup.notConfirmed' : !safeDns.supported || !safeDns.releaseEnabled ? 'iosWebsiteSetup.unsupported' : safeDns.healthy === false ? 'iosWebsiteSetup.needsAttention' : safeDns.enabled ? 'iosWebsiteSetup.enabled' : safeDns.configured ? 'iosWebsiteSetup.settingUp' : 'iosWebsiteSetup.off') },
    { id: 'configuration', title: t('iosWebsiteSetup.checkConfiguration'), description: t('iosWebsiteSetup.configurationUnknown'), result: t(checked ? 'guidedWebsiteSetup.checked' : 'guidedWebsiteSetup.notConfirmed') },
    { id: 'safari', title: t('iosWebsiteSetup.safariRecoveryTitle'), description: t('iosWebsiteSetup.safariRecoveryDescription'), result: t(safari.configuration === 'checked' ? 'safariConfiguration.configurationChecked' : 'guidedWebsiteSetup.notConfirmed') },
    { id: 'browsing', title: t('guidedWebsiteSetup.browsing'), description: t('iosWebsiteSetup.testUnobserved'), result: presentation.verified ? translateSource('Verified on this network.') : t('iosWebsiteSetup.testNeeded') },
  ];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ScrollView testID="setup-websites" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '800' }}>Adult websites</Text><MomentumCompanion pose={busy ? 'waiting' : 'guide'} context="setup-websites" width={48} height={48} scene={false} idle={false} /><Pressable accessibilityRole="button" accessibilityLabel={t('iosWebsiteSetup.close')} onPress={onClose} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><X color={colors.text} size={24} /></Pressable></View>
    <Text testID="website-overall-status" accessibilityLiveRegion="polite" style={{ color: !nativeFactsAvailable ? colors.warning : presentation.tone === 'on' ? colors.success : presentation.tone === 'attention' ? colors.warning : presentation.tone === 'off' ? colors.red : colors.text2, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>{!nativeFactsAvailable ? t('iosWebsiteSetup.needsAttention') : translateSource(presentation.status)}</Text>
    <View testID="website-next-step" style={{ gap: 12, padding: 16, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface2 }}>
      <Text translate={false} style={{ color: colors.text2, fontSize: 15 }}>{t('guidedWebsiteSetup.currentTask')}</Text><Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '700' }}>{stageLabel}</Text>
      {error ? text(error, undefined, true) : null}
      {stage === 'authorize' || stage === 'policy' ? <View testID="website-screen-time-step" style={{ gap: 10 }}>{text(t(authorized ? 'iosWebsiteSetup.policyNeeded' : 'iosWebsiteSetup.authorizationNeeded'))}{button('feature-setup-continue', t(busy ? 'iosWebsiteSetup.settingUp' : stage === 'authorize' ? 'iosWebsiteSetup.authorize' : 'iosWebsiteSetup.applyPolicy'), onRun, true, next?.status === 'unavailable')}</View> : null}
      {stage === 'save-dns' || stage === 'enable-dns' ? <EncryptedDnsSection setup disabled={busy || checking || !foreground} onBusyChange={setDnsBusy} showConfigurationCheck={false} showSettingsGuide={stage === 'enable-dns'} repairConfiguration={dns.error === 'write-failed'} /> : null}
      {stage === 'readback' || stage === 'unsupported' ? <View testID="website-configuration-step" style={{ gap: 10 }}>{text(t(stage === 'unsupported' ? 'iosWebsiteSetup.dnsUnsupported' : 'iosWebsiteSetup.configurationUnknown'))}{button('website-configuration-check', t(checking ? 'iosWebsiteSetup.checkingConfiguration' : 'iosWebsiteSetup.checkConfiguration'), () => { void checkConfiguration(); }, true)}{readError ? text(t('guidedWebsiteSetup.readFailed'), undefined, true) : null}</View> : null}
      {stage === 'safari' ? safariRecovery : null}
      {stage === 'browse' ? browsing : null}
      {safariFeedback && stage !== 'safari' && !safariInReview ? safariReceipt : null}
    </View>
    <Pressable testID="website-review-setup" accessibilityRole="button" accessibilityLabel={t('guidedWebsiteSetup.review')} accessibilityState={{ expanded: review }} onPress={() => { setReview(value => !value); setInspected(null); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text translate={false} style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>{t('guidedWebsiteSetup.review')}</Text></Pressable>
    {review ? <View testID="website-review-steps" style={{ gap: 8 }}>{steps.map(step => <View key={step.id} style={{ gap: 4 }}><Pressable testID={`website-review-${step.id}`} accessibilityRole="button" accessibilityLabel={`${step.title}, ${step.result}`} accessibilityState={{ expanded: inspected === step.id }} onPress={() => setInspected(value => value === step.id ? null : step.id)} style={{ minHeight: 48, paddingVertical: 8 }}><Text translate={false} style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{step.title}</Text>{text(step.result, step.id === 'screen-time' ? 'website-screen-time-status' : step.id === 'dns' ? 'website-reviewed-dns-status' : undefined)}</Pressable>{inspected === step.id ? <View style={{ gap: 12 }}>{text(step.description)}{step.id === 'safari' && safariInReview ? safariRecovery : null}</View> : null}</View>)}{button('website-return-current', t('guidedWebsiteSetup.returnCurrent'), () => { setReview(false); setInspected(null); })}</View> : null}
    {onAdvanced ? button('website-open-advanced', translateSource('Protection details'), onAdvanced) : <Pressable testID="website-open-advanced" accessibilityRole="button" accessibilityLabel={translateSource('Protection details')} accessibilityState={{ expanded: details }} onPress={() => setDetails(value => !value)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>Protection details</Text></Pressable>}
    {!onAdvanced && details ? <View style={{ gap: 12 }}>{text(t('iosWebsiteSetup.coverage'))}{receipt?.adultWebPolicyDiagnostics ? <Text translate={false} testID="website-operation-diagnostics" selectable style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{JSON.stringify({ reason: receipt.adultWebPolicyReason, ...receipt.adultWebPolicyDiagnostics })}</Text> : null}{dns.operationDiagnostic ? <Text translate={false} testID="dns-operation-diagnostics" selectable style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{JSON.stringify({ reason: dns.operationReason, ...dns.operationDiagnostic })}</Text> : null}{onSafariSetup ? button('website-safari-setup', t('iosWebsiteSetup.safariOptional'), onSafariSetup) : null}</View> : null}
    <Pressable testID="feature-setup-leave" accessibilityRole="button" accessibilityLabel={t('iosWebsiteSetup.done')} onPress={onClose} style={{ minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' }}><Text translate={false} style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('iosWebsiteSetup.done')}</Text></Pressable>{text(t('iosWebsiteSetup.finishLater'))}
  </ScrollView></SafeAreaView>;
}
