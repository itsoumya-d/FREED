import React from 'react';
import { MomentumSection, MomentumPageHeader } from './MomentumPageHeader';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { openProtectionSettings, openVpnSettings } from 'freed-protection';
import { getEncryptedDnsPresentation, normalizeEncryptedDnsStatus } from '@/lib/encrypted-dns';
import { useEncryptedDns } from '@/hooks/use-encrypted-dns';
import { useAppTheme } from '@/design-system/use-app-theme';
import { translateSource } from '@/i18n/runtime';
import { View, Text, Pressable } from './Localized';
import { IOSDnsSettingsGuide } from './IOSDnsSettingsGuide';
import { getDnsSettingsGuide } from '@/lib/dns-settings-guide';

export function EncryptedDnsSection({ setup = false, disabled = false, onBusyChange, primaryAction = true, showConfigurationCheck = true, browsingVerified = false, showSettingsGuide = true, repairConfiguration = false }: { repairConfiguration?: boolean; showSettingsGuide?: boolean; browsingVerified?: boolean; showConfigurationCheck?: boolean; primaryAction?: boolean; setup?: boolean; disabled?: boolean; onBusyChange?: (busy: boolean) => void } = {}) {
  const { colors } = useAppTheme(); const { t, i18n } = useTranslation();
  const { status, pending, error: controllerError, operationReason, operationDiagnostic, lastCheckedAt, refresh, configure, acknowledgeOperation } = useEncryptedDns();
  const mutating = pending === 'enable' || pending === 'disable';
  const [settingsBusy, setSettingsBusy] = React.useState(false);
  const busy = mutating || settingsBusy || disabled;
  React.useEffect(() => { onBusyChange?.(mutating || settingsBusy); }, [mutating, settingsBusy, onBusyChange]);
  const [consent, setConsent] = React.useState(false);
  const [details, setDetails] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const change = async (enabled: boolean) => {
    if (busy) return;
    setError(null);
    try {
      const result = await configure(enabled);
      if (alive.current && result.accepted) setConsent(false);
    } catch { if (alive.current) setError(t('dns.changeFailed')); }
  };
  const safeStatus = normalizeEncryptedDnsStatus(status);
  const presentation = getEncryptedDnsPresentation(safeStatus);
  const guide = setup || Platform.OS === 'ios' ? getDnsSettingsGuide(safeStatus, 0) : null;
  const labelKey = presentation.state === 'active' ? 'active' : presentation.state === 'unverified' ? 'unverified' : presentation.state === 'settings-required' ? 'configured' : presentation.state === 'failed' ? 'limited' : presentation.state === 'off' ? 'off' : presentation.state === 'waiting' ? 'waiting' : 'unavailable';
  const button = (id: string, label: string, onPress: () => void, disabled = false, primary = false) => <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', ...(setup ? { padding: 12, borderRadius: 16, borderCurve: 'continuous' as const, alignItems: 'center' as const, backgroundColor: primary && primaryAction ? colors.accent : colors.surface2 } : {}), opacity: disabled || busy ? .55 : pressed ? .65 : 1 })}><Text translate={!setup} style={{ color: setup ? primary && primaryAction ? colors.onAccent : colors.text : colors.mint, fontSize: 17, fontWeight: '700' }}>{label}</Text></Pressable>;
  const openSettings = async () => {
    if (busy) return;
    setSettingsBusy(true); setError(null);
    try { await openProtectionSettings(); await refresh(); }
    catch { if (alive.current) setError(t('dns.unavailable')); }
    finally { if (alive.current) setSettingsBusy(false); }
  };
  if (setup) {
    const readFailed = controllerError === 'read-failed';
    const unsupported = !safeStatus.supported || !safeStatus.releaseEnabled;
    const state = mutating ? 'settingUp' : readFailed ? 'needsAttention' : unsupported ? 'unsupported' : safeStatus.healthy === false ? 'needsAttention' : safeStatus.enabled ? 'enabled' : error || controllerError ? 'needsAttention' : safeStatus.configured ? 'settingUp' : 'off';
    const description = readFailed ? 'configurationUnknown' : safeStatus.reason === 'ios-dns-simulator-unavailable' ? 'simulatorUnsupported' : unsupported ? 'dnsUnsupported' : safeStatus.healthy === false ? 'dnsHealthFailed' : safeStatus.enabled ? 'dnsEnabled' : safeStatus.configured ? 'dnsSaved' : 'dnsDescription';
    return <View testID="dns-section" style={{ gap: 10, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text translate={false} testID="dns-status" accessibilityLiveRegion="polite" style={{ color: state === 'enabled' ? colors.accent : colors.text2, fontSize: 17, fontWeight: '700', lineHeight: 24 }}>{t(`iosWebsiteSetup.${state}`)}</Text>
      <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t(`iosWebsiteSetup.${description}`)}</Text>
      {pending ? <Text translate={false} testID="dns-pending" accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t(pending === 'refresh' ? 'iosWebsiteSetup.checkingConfiguration' : 'iosWebsiteSetup.settingUp')}</Text> : null}
      {guide && showSettingsGuide ? <View style={{ gap: 8 }}><View testID="dns-settings-path" style={{gap:4}}><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('iosWebsiteSetup.dnsPath')}</Text><Text translate={false} testID="dns-settings-configuration-label" style={{color:colors.text,fontSize:17,lineHeight:24,fontWeight:'700'}}>{guide.label}</Text></View><IOSDnsSettingsGuide configurationLabel={guide.label} disabled={busy} onOpenSettings={() => { void openSettings(); }} /></View> : null}
      {error || controllerError ? <Text translate={false} accessibilityRole="alert" style={{ color: colors.red, fontSize: 17, lineHeight: 24 }}>{error ?? (operationReason === 'ios-reset-dns-configuration-invalidated' ? translateSource('Protection changed while saving. Retry DNS setup.') : operationReason === 'ios-dns-configuration-in-progress' ? translateSource('DNS settings are busy. Wait a moment, then retry.') : t(controllerError === 'write-failed' ? 'dns.changeFailed' : 'dns.unavailable'))}</Text> : null}
      {consent ? <View testID="dns-consent" style={{ gap: 12 }}><Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '700' }}>{t('dns.consentTitle')}</Text><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('dns.consentBody')}</Text><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('dns.providerExceptions')}</Text>{button('dns-consent-accept', t('iosWebsiteSetup.saveDns'), () => { void change(true); }, false, true)}{button('dns-consent-cancel', t('common.cancel'), () => { acknowledgeOperation(); setConsent(false); })}</View> : null}
      {(!safeStatus.configured || repairConfiguration) && !consent ? button('dns-consent-open', t('iosWebsiteSetup.saveDns'), () => setConsent(true), unsupported, true) : null}
      {showConfigurationCheck ? button('dns-refresh', t('iosWebsiteSetup.checkConfiguration'), () => { setError(null); void refresh(); }, false, safeStatus.enabled) : null}
    </View>;
  }
  return <MomentumSection testID="dns-section" title={t('dns.title')} category="calm">
    <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('dns.description')}</Text>
    <Text testID="dns-status" accessibilityLiveRegion="polite" style={{ color: presentation.isVerifiedActive ? colors.mint : colors.text2, fontSize: 17, lineHeight: 24 }}>{t(`dns.${labelKey}`)}</Text>
    {pending ? <Text testID="dns-pending" accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 17 }}>{t(`dns.pending.${pending}`)}</Text> : null}
    {lastCheckedAt !== null ? <Text translate={false} style={{ color: colors.text2, fontSize: 15 }}>{t('dns.lastChecked', { time: new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(new Date(lastCheckedAt)) })}</Text> : null}
    <Pressable testID="dns-details" accessibilityRole="button" accessibilityLabel={t(details ? 'dns.hideDetails' : 'dns.showDetails')} accessibilityState={{ expanded: details }} onPress={() => setDetails(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>{t(details ? 'dns.hideDetails' : 'dns.showDetails')}</Text></Pressable>
    {details ? <View style={{ gap: 8 }}>
      <Text testID="dns-configuration-state" style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>{safeStatus.configured ? 'Configuration saved' : 'Configuration not saved'}</Text>
      <Text testID="dns-os-state" style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>{safeStatus.enabled ? 'Enabled in system settings' : 'Not enabled in system settings'}</Text>
      <Text testID="dns-network-state" style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>{safeStatus.healthy === true ? 'Native network check ready' : safeStatus.healthy === false ? 'Network check needs attention' : 'Network blocking not verified'}</Text>
    </View> : null}
    {safeStatus.reason === 'ios-dns-simulator-unavailable' ? <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>iOS Simulator cannot enforce this DNS layer. Use a real iPhone with a properly signed build.</Text> : null}
    {guide ? <IOSDnsSettingsGuide configurationLabel={guide.label} disabled={busy} onOpenSettings={() => { void openSettings(); }} /> : null}
    {presentation.state === 'release-gated' ? <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{t('dns.releaseGated')}</Text> : null}
    {error || controllerError ? <Text accessibilityRole="alert" style={{ color: colors.red, lineHeight: 22 }}>{error ?? (operationReason === 'ios-reset-dns-configuration-invalidated' ? translateSource('Protection changed while saving. Retry DNS setup.') : operationReason === 'ios-dns-configuration-in-progress' ? translateSource('DNS settings are busy. Wait a moment, then retry.') : t(controllerError === 'write-failed' ? 'dns.changeFailed' : 'dns.unavailable'))}</Text> : null}
    {consent ? <View testID="dns-consent" style={{ gap: 12 }}><MomentumPageHeader pose="secure" context="dns-consent" title={t('dns.consentTitle')} category="commitment" variant="calm" compact restrained /><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('dns.consentBody')}</Text><Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>{t('dns.providerExceptions')}</Text>{button('dns-consent-accept', t('dns.agree'), () => { void change(true); })}{button('dns-consent-cancel', t('common.cancel'), () => { acknowledgeOperation(); setConsent(false); })}</View> : null}
    {presentation.canDisable ? button('dns-pause', t('dns.pause'), () => { void change(false); }) : button('dns-consent-open', t('dns.agree'), () => setConsent(true), !presentation.canEnable)}
    {Platform.OS === 'android' && (presentation.requiresSettings || status.reason === 'android-vpn-consent-required') ? button('dns-settings', t('dns.settings'), () => { void (Platform.OS === 'android' ? openVpnSettings() : openProtectionSettings()).then(refresh).catch(() => setError(t('dns.unavailable'))); }) : null}
    {showConfigurationCheck ? button('dns-refresh', t('common.retry'), () => { setError(null); void refresh(); }) : null}
  </MomentumSection>;
}
