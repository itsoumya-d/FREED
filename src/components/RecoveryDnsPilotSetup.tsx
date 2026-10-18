import React from 'react';
import { AppState, Linking, ScrollView, Switch } from 'react-native';
import { ShieldCheck, ChevronRight } from 'lucide-react-native';
import { deviceAdultProtection, isNativeAccountActionScopeCurrent, recoveryDnsPilot } from 'freed-protection';
import type { DeviceAdultOperation } from '../../modules/freed-protection/src/device-adult';
import type { RecoveryDnsPilotReceipt } from '../../modules/freed-protection/src/recovery-dns-pilot';
import { createRecoveryDnsNativeEnrollment } from '@/lib/recovery-dns-native-enrollment';
import { recoveryDnsCopy } from '@/i18n/recovery-dns-copy';
import { useAppTheme } from '@/design-system/use-app-theme';
import { SpringPressable } from '@/design-system/motion';
import { Text, TextInput, View, Pressable } from './Localized';

type Step = 'loading' | 'unavailable' | 'enroll' | 'replace' | 'settings' | 'activate' | 'done';
export type RecoveryDnsPilotSetupProps = { getActionScope: () => string | null; onClose: () => void; onChanged: () => void };
/** Staging, profile storage, system routing, and mode activation remain separate native acknowledgements. */
export function RecoveryDnsPilotSetup({ getActionScope, onClose, onChanged }: RecoveryDnsPilotSetupProps) {
  const { colors } = useAppTheme(), copy = recoveryDnsCopy();
  const scopeGetter = React.useRef(getActionScope); scopeGetter.current = getActionScope;
  const runtime = React.useMemo(() => createRecoveryDnsNativeEnrollment(() => scopeGetter.current()), []);
  const alive = React.useRef(true), working = React.useRef(false), operationRef = React.useRef<DeviceAdultOperation | null>(null);
  const [step, setStep] = React.useState<Step>('loading'), [candidate, setCandidate] = React.useState<RecoveryDnsPilotReceipt | null>(null);
  const [dnsConsent, setDnsConsent] = React.useState(false), [alerts, setAlerts] = React.useState(false), [retention, setRetention] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [failed, setFailed] = React.useState(false), [operation, setOperation] = React.useState<DeviceAdultOperation | null>(null), [pin, setPin] = React.useState('');
  const ownerRef = React.useRef(runtime.currentOwner());
  const valid = () => { const owner = runtime.currentOwner(), captured = ownerRef.current; return alive.current && owner !== null && captured !== null && owner.ownerId === captured.ownerId && owner.actionScope === captured.actionScope; };
  const fence = () => { if (!valid()) throw Error('owner-changed'); };
  const setPending = (value: DeviceAdultOperation | null) => { operationRef.current = value; setOperation(value); setPin(''); };
  const refresh = async () => {
    const owner = runtime.currentOwner(); if (!owner || !valid()) { if (alive.current) setStep('unavailable'); return; }
    const availability = await recoveryDnsPilot.status(owner.actionScope); fence();
    if (!availability.supported) { setStep('unavailable'); return; }
    const native = await runtime.status(); fence(); setCandidate(native);
    if (!native) setStep('enroll'); else if (native.profileSaved) setStep('settings'); else setStep('replace');
  };
  React.useEffect(() => {
    alive.current = true;
    void refresh().catch(() => { if (alive.current) { setStep('unavailable'); setFailed(true); } });
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { setPin(''); setStep(value => value === 'activate' ? 'settings' : value); return; }
      if (!working.current && !operationRef.current) void refresh().catch(() => { if (alive.current) setFailed(true); });
    });
    return () => { alive.current = false; listener.remove(); };
  }, []);
  async function run(work: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setFailed(false);
    try { fence(); await work(); fence(); }
    catch {
      const pending = operationRef.current;
      if (valid() && pending?.action === 'recoveryModeActivate') {
        // The exact native operation binds a short-lived route receipt. Never reuse it after failure.
        const cancelled = await deviceAdultProtection.cancel(pending.operationID);
        if (valid() && cancelled.kind === 'operation' && cancelled.phase === 'cancelled') { setPending(null); setStep('settings'); }
      }
      if (alive.current) { setFailed(true); if (!valid()) { setCandidate(null); setPending(null); setStep('unavailable'); } }
    }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function finishOperation(value: DeviceAdultOperation, action: 'dnsReplace' | 'recoveryModeActivate') {
    if (value.action !== action) throw Error('operation-mismatch');
    let executed = value;
    if (value.phase !== 'completed') {
      if (value.authorization !== 'authorized') throw Error('authorization-required');
      const result = await deviceAdultProtection.execute(value.operationID); fence();
      if (result.kind !== 'operation') throw Error('execution-unconfirmed'); executed = result;
    }
    const read = await deviceAdultProtection.read(executed.operationID); fence();
    if (read.kind !== 'operation' || read.action !== action || read.phase !== 'completed' || read.accepted !== true || read.observation !== 'settled') throw Error('readback-unconfirmed');
    setPending(null);
    const native = await runtime.status(); fence();
    if (!native || action === 'dnsReplace' && !native.profileSaved || action === 'recoveryModeActivate' && !native.modeActive) throw Error('native-status-unconfirmed');
    setCandidate(native); setStep(action === 'dnsReplace' ? 'settings' : 'done'); onChanged();
  }
  async function prepare(action: 'dnsReplace' | 'recoveryModeActivate') {
    const scope = ownerRef.current?.actionScope, reference = candidate?.reference;
    if (!scope || !reference || !isNativeAccountActionScopeCurrent(scope)) throw Error('candidate-unavailable');
    if (!await runtime.canActivate()) { fence(); throw Error('website-alert-consent-required'); } fence();
    if (action === 'recoveryModeActivate') {
      const status = await runtime.status(); fence();
      if (!status?.modeActivationSupported) throw Error('mode-unavailable');
      const check = await recoveryDnsPilot.check(reference, scope); fence();
      if (!check.accepted || !check.routeVerified || !check.denyVerified) { setStep('settings'); throw Error('fresh-proof-required'); }
    }
    const result = await (action === 'dnsReplace' ? recoveryDnsPilot.prepareReplacement(reference, scope) : recoveryDnsPilot.prepareMode(reference, scope)); fence();
    if (result.kind !== 'operation' || result.action !== action) throw Error('prepare-unavailable');
    if (result.authorization === 'awaitingSecret') {
      if (result.lockRevision === '0') throw Error('unexpected-authorization');
      setPending(result); return;
    }
    setPending(result);
    await finishOperation(result, action);
  }
  const actionLabel = operation ? copy.authorize : step === 'enroll' ? copy.enroll : step === 'replace' ? copy.replace : step === 'activate' ? copy.activate : copy.check;
  const action = () => run(async () => {
    if (operation) {
      const observed = await deviceAdultProtection.read(operation.operationID); fence();
      if (observed.kind !== 'operation') throw Error('operation-unavailable');
      if (observed.authorization === 'authorized' || observed.phase === 'completed') {
        await finishOperation(observed, operation.action as 'dnsReplace' | 'recoveryModeActivate'); return;
      }
      if (observed.authorization !== 'awaitingSecret' || observed.lockRevision === '0' || !/^[0-9]{6}$/.test(pin)) throw Error('pin-required');
      const secret = pin; setPin(''); const result = await deviceAdultProtection.authorize(operation.operationID, secret); fence();
      if (result.kind !== 'operation') throw Error('authorization-unconfirmed');
      await finishOperation(result, operation.action as 'dnsReplace' | 'recoveryModeActivate'); return;
    }
    if (step === 'enroll') {
      const result = await runtime.enroll({ dnsConsent, websiteAlertConsent: alerts, retentionAcknowledged: retention }); fence();
      if (result.status !== 'staged') throw Error('enrollment-unavailable');
      setCandidate(result.native); setStep('replace'); onChanged(); return;
    }
    if (step === 'replace') { await prepare('dnsReplace'); return; }
    if (step === 'activate') { await prepare('recoveryModeActivate'); return; }
    const scope = ownerRef.current?.actionScope, reference = candidate?.reference;
    if (!scope || !reference) throw Error('candidate-unavailable');
    if (!await runtime.canActivate()) { fence(); throw Error('website-alert-consent-required'); } fence();
    const status = await runtime.status(); fence();
    if (!status?.modeActivationSupported) throw Error('mode-unavailable');
    const check = await recoveryDnsPilot.check(reference, scope); fence();
    if (!check.accepted || !check.routeVerified || !check.denyVerified) throw Error('fresh-proof-required');
    setStep('activate'); onChanged();
  });
  const close = () => { setPin(''); const pending = operationRef.current; if (pending && valid()) void deviceAdultProtection.cancel(pending.operationID); alive.current = false; onClose(); };
  const consentRow = (label: string, value: boolean, change: (value: boolean) => void, testID: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}><Text translate={false} style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 16, lineHeight: 24 }}>{label}</Text><Switch testID={testID} accessibilityLabel={label} value={value} disabled={busy} onValueChange={change} /></View>;
  return <ScrollView testID="recovery-dns-pilot-setup" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><ShieldCheck accessible={false} color={colors.accent} size={24} /><Text translate={false} accessibilityRole="header" style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: '700' }}>{copy.title}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={close} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>Close</Text></Pressable></View>
    <Text translate={false} style={{ color: colors.text2, fontSize: 16, lineHeight: 24 }}>{step === 'unavailable' ? copy.unavailable : step === 'done' ? copy.configured : step === 'settings' ? copy.route : step === 'activate' ? copy.proof : copy.pending}</Text>
    {step === 'enroll' ? <View>{consentRow(copy.dns, dnsConsent, setDnsConsent, 'recovery-dns-consent')}{consentRow(copy.alerts, alerts, setAlerts, 'recovery-dns-alert-consent')}{consentRow(copy.retention, retention, setRetention, 'recovery-dns-retention-consent')}{!alerts ? <Text translate={false} style={{ color: colors.text2, fontSize: 14, lineHeight: 22, paddingVertical: 12 }}>{copy.alertsRequired}</Text> : null}</View> : null}
    {operation ? <TextInput testID="recovery-dns-friend-pin" accessibilityLabel={copy.pin} placeholder={copy.pin} secureTextEntry keyboardType="number-pad" maxLength={6} value={pin} onChangeText={setPin} editable={!busy} style={{ minHeight: 48, backgroundColor: colors.surface2, borderRadius: 12, color: colors.text, padding: 12 }} /> : null}
    {failed ? <Text testID="recovery-dns-step-error" translate={false} accessibilityRole="alert" style={{ color: colors.warning, fontSize: 16, lineHeight: 24 }}>{copy.failed}</Text> : null}
    {step === 'settings' && !operation ? <SpringPressable testID="recovery-dns-open-settings" disabled={busy} onPress={() => void run(async () => { await Linking.openSettings(); fence(); })} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text translate={false} style={{ flex: 1, minWidth: 0, color: colors.accent, fontSize: 17 }}>{copy.settings}</Text><ChevronRight color={colors.accent} size={20} /></SpringPressable> : null}
    {!['loading', 'unavailable', 'done'].includes(step) ? <SpringPressable testID="recovery-dns-next" accessibilityLabel={actionLabel} accessibilityState={{ busy, disabled: busy || step === 'enroll' && (!dnsConsent || !alerts || !retention) }} disabled={busy || step === 'enroll' && (!dnsConsent || !alerts || !retention)} onPress={() => void action()} style={{ minHeight: 52, padding: 14, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || step === 'enroll' && (!dnsConsent || !alerts || !retention) ? .5 : 1 }}><Text translate={false} style={{ color: colors.onAccent, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>{actionLabel}</Text></SpringPressable> : null}
  </ScrollView>;
}
