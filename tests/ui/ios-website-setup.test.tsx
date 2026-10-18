import React from 'react';
import { AppState, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { appI18n } from '@/i18n/runtime';
import { websiteSetupWriter } from '@/lib/website-protection-operations';
import { syncNativeAdultDomainFeed } from '@/lib/adult-domain-feed-sync';
import { useEncryptedDns } from '@/hooks/use-encrypted-dns';
import * as Native from 'freed-protection';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/lib/adult-domain-feed-sync', () => ({ syncNativeAdultDomainFeed: jest.fn() }));
jest.mock('freed-protection', () => ({
  applyAdultContentFilter: jest.fn(), requestProtectionAuthorization: jest.fn(), presentFamilyActivityPicker: jest.fn(),
  openUsageAccessSettings: jest.fn(), openProtectionSettings: jest.fn(), openPrivateDnsSettings: jest.fn(),
  openVpnSettings: jest.fn(), openSafariExtensionSettings: jest.fn(), getEncryptedDnsStatus: jest.fn(), configureEncryptedDns: jest.fn(),
}));
const ios: ProtectionCapability = { platform: 'ios', screenTime: true, managedSettings: true, accessibility: false, dnsFiltering: false, localVpnFallback: false, safariContentBlocker: true, notes: [] };
const off: ProtectionStatus = { authorized: false, adultFilterActive: false, active: false, mode: 'screen-time', message: '' };
const dns = { configurationLabel: 'FREED · Cloudflare Families encrypted DNS', supported: true, releaseEnabled: true, configured: false, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
function setup(capability = ios, status = off) {
  const close = jest.fn(); const refresh = jest.fn(async (): Promise<any> => ({ capability, status, readTicket: { revision: 1, isCurrent: () => true } }));
  const props = { intent: 'websites' as const, capability, status, appCount: 0, onRefresh: refresh, onChooseApps: jest.fn(), onSyncApps: jest.fn(), onClose: close, vpnDisclosureAcknowledged: false, onAcknowledgeVpnDisclosure: jest.fn() };
  return { view: render(<ProtectionFeatureSetup {...props} />), refresh, close, props };
}
async function openProtectionDetails(view: ReturnType<typeof render>) {
  await act(async () => { fireEvent.press(view.getByTestId('website-open-advanced')); });
}
function FreshDeviceMutationFixture() {
  const { acknowledgeOperation } = useEncryptedDns();
  React.useEffect(() => { acknowledgeOperation(); }, [acknowledgeOperation]);
  return null;
}
const initialAppState = AppState.currentState;
beforeEach(async () => {
  (AppState as any).currentState = 'active';
  localStorage.removeItem('freed.dns.settings-guide.v1');
  await appI18n.changeLanguage('en');
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(dns);
  (Native.openProtectionSettings as jest.Mock).mockResolvedValue(undefined);
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
  // Each scenario begins with a fresh mutation outcome; remounts within a
  // scenario retain it through the real shared controller and native hook.
  const fixture = render(<FreshDeviceMutationFixture />); await act(async () => {}); fixture.unmount();
  (Native.getEncryptedDnsStatus as jest.Mock).mockClear();
});
afterEach(() => { (AppState as any).currentState = initialAppState; jest.restoreAllMocks(); });

const policy = { ...off, authorized: true, adultFilterActive: true, adultWebPolicyConfigured: true };
async function review(view: ReturnType<typeof render>) { fireEvent.press(view.getByTestId('website-review-setup')); }
async function dnsSetup() { const result = setup(ios, policy); await act(async () => {}); return result; }
async function safariSetup() {
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({ ...dns, configured: true, enabled: true });
  const result = setup(ios, policy); await act(async () => {});
  await act(async () => { fireEvent.press(result.view.getByTestId('website-configuration-check')); });
  return result;
}

test.each(['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'])('current task and reviewed layers render semantic resources in %s', async language => {
  await appI18n.changeLanguage(language); const { view } = setup(); await act(async () => {});
  expect(view.getByTestId('feature-setup-continue')).toHaveTextContent(appI18n.t('iosWebsiteSetup.authorize'));
  expect(view.queryByTestId('dns-section')).toBeNull(); expect(view.queryByTestId('website-safari-recovery')).toBeNull();
  await review(view); expect(view.getByTestId('website-review-screen-time')).toHaveTextContent(new RegExp(appI18n.t('guidedWebsiteSetup.screenTime')));
  for (const key of ['currentTask','review','returnCurrent','screenTime','dns','selectDns','browsing','checked','notConfirmed','readFailed','recoveryCheck']) {
    const value=appI18n.t(`guidedWebsiteSetup.${key}`); expect(value).not.toBe(`guidedWebsiteSetup.${key}`);
    if (language!=='en' && key!=='dns') expect(value).not.toBe(appI18n.getResource('en','translation',`guidedWebsiteSetup.${key}`));
  }
  for (const key of ['denied', 'cancelled', 'error', 'unsupported', 'unconfirmed', 'readFailed']) {
    const resource = appI18n.getResource(language, 'translation', `protectionAuthorization.${key}`);
    expect(typeof resource).toBe('string');
    if (language !== 'en') expect(resource).not.toBe(appI18n.getResource('en', 'translation', `protectionAuthorization.${key}`));
  }
  fireEvent.press(view.getByTestId('website-return-current'));
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ ...off, authorizationOutcome: 'error' });
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(view.getByRole('alert')).toHaveTextContent(appI18n.t('protectionAuthorization.error'));
});

test('one authorization action is current; past/future inspection never starts actions', async () => {
  const { view } = setup(); await act(async () => {});
  expect(view.getByTestId('website-next-step')).toHaveTextContent(/Allow Screen Time/);
  expect(view.queryByTestId('dns-consent-open')).toBeNull(); expect(view.queryByTestId('website-test-toggle')).toBeNull();
  await review(view); fireEvent.press(view.getByTestId('website-review-dns')); fireEvent.press(view.getByTestId('website-review-safari'));
  expect(view.getByText(appI18n.t('iosWebsiteSetup.safariRecoveryDescription'))).toBeOnTheScreen();
  expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled(); expect(Native.configureEncryptedDns).not.toHaveBeenCalled(); expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('website-return-current')); expect(view.queryByTestId('website-review-steps')).toBeNull();
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
});

test('authorization applies policy and reads back once; observed ready policy advances to DNS', async () => {
  const { view, refresh, props } = setup(); await act(async () => {});
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ ...off, authorized:true });
  (Native.applyAdultContentFilter as jest.Mock).mockResolvedValue(policy); refresh.mockResolvedValue({ capability:ios,status:policy });
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1); expect(Native.applyAdultContentFilter).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(2);
  view.rerender(<ProtectionFeatureSetup {...props} status={policy}/>);
  expect(view.getByTestId('dns-consent-open')).not.toBeDisabled(); expect(view.queryByTestId('feature-setup-continue')).toBeNull();
  await review(view); expect(view.getByTestId('website-screen-time-status')).toHaveTextContent(/^Enabled$/);
  expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
});

test('denial retains exact retry and Done without launching the DNS future step', async () => {
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ ...off, authorizationOutcome: 'denied' }); const { view, close }=setup();
  await act(async()=>{fireEvent.press(view.getByTestId('feature-setup-continue'));});
  expect(view.getByRole('alert')).toHaveTextContent('Screen Time was not allowed. Tap Allow Screen Time to try again.'); expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
  expect(view.queryByTestId('dns-consent-open')).toBeNull(); fireEvent.press(view.getByTestId('feature-setup-leave')); expect(close).toHaveBeenCalledTimes(1);
});

test.each([
  ['denied', 'Screen Time was not allowed. Tap Allow Screen Time to try again.'],
  ['cancelled', 'The Screen Time request was cancelled. Tap Allow Screen Time when you are ready.'],
  ['error', 'The Screen Time request could not finish. Keep FREED open and tap Allow Screen Time to retry.'],
  ['unsupported', 'Screen Time authorization is unavailable in this installed build. Use recovery tools or update FREED.'],
])('authorization %s survives rejected, malformed and contradictory later reads with a usable exit', async (outcome, message) => {
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ ...off, authorizationOutcome: outcome, authorizationErrorDomain: 'FamilyControls.FamilyControlsError', authorizationErrorCode: 3, message: 'private-account https://private.example', localizedDescription: 'private native details' });
  const { view, refresh, close, props } = setup(); await act(async () => {});
  refresh.mockRejectedValueOnce(new Error('private read rejection'));
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(view.getByRole('alert')).toHaveTextContent(message);
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  for (const fresh of [null, {}, { capability: ios, status: {} }, { capability: ios, status: policy }]) {
    refresh.mockResolvedValueOnce(fresh as never);
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    expect(view.getByRole('alert')).toHaveTextContent(message);
    expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
  }
  expect(view.queryByText(/private-account|private native details|private read rejection/)).toBeNull();
  view.rerender(<ProtectionFeatureSetup {...props} status={policy} />);
  expect(view.getByRole('alert')).toHaveTextContent(message);
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
  expect(view.queryByTestId('dns-consent-open')).toBeNull();
  fireEvent.press(view.getByTestId('feature-setup-leave')); expect(close).toHaveBeenCalledTimes(1);
});

test('a known authorization error survives an ordinary Settings-return read rejection', async () => {
  const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() }; });
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ ...off, authorizationOutcome: 'error' });
  const { view, refresh } = setup(); await act(async () => {});
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  refresh.mockRejectedValueOnce(new Error('private Settings read'));
  await act(async () => { listeners.forEach(listener => listener('active')); });
  expect(view.getByRole('alert')).toHaveTextContent('The Screen Time request could not finish. Keep FREED open and tap Allow Screen Time to retry.');
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
});

test('authorization success applies policy once and a rejected read never claims ready protection', async () => {
  const { view, refresh } = setup(); await act(async () => {});
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ ...off, authorized: true, authorizationOutcome: 'granted' });
  (Native.applyAdultContentFilter as jest.Mock).mockResolvedValue(policy);
  refresh.mockRejectedValueOnce(new Error('read failed'));
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(Native.applyAdultContentFilter).toHaveBeenCalledTimes(1);
  expect(view.getByRole('alert')).toHaveTextContent('Device status could not refresh. Check again before relying on protection.');
  expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
});

test.each(['owner', 'foreground', 'close'])('late authorization after the %s boundary cannot publish or start policy', async boundary => {
  const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() }; });
  let owner = 'owner-a', finish!: (value: object) => void;
  (Native.requestProtectionAuthorization as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { view, props, refresh } = setup();
  view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => owner} />); await act(async () => {});
  fireEvent.press(view.getByTestId('feature-setup-continue'));
  if (boundary === 'owner') { owner = 'owner-b'; view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => owner} />); }
  else if (boundary === 'foreground') { await act(async () => { (AppState as any).currentState = 'background'; listeners.forEach(listener => listener('background')); }); }
  else view.unmount();
  await act(async () => { finish({ ...off, authorized: true, authorizationOutcome: 'granted' }); });
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledTimes(2);
  if (boundary !== 'close') { expect(view.queryByRole('alert')).toBeNull(); expect(view.queryByTestId('dns-consent-open')).toBeNull(); }
});

test('authorization callback received in background stays abandoned if its final read finishes after return', async () => {
  const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() }; });
  let authorize!: (value: object) => void, read!: (value: object) => void;
  (Native.requestProtectionAuthorization as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { authorize = resolve; }));
  const { view, refresh } = setup(); await act(async () => {});
  refresh.mockImplementationOnce(() => new Promise(resolve => { read = resolve; }));
  fireEvent.press(view.getByTestId('feature-setup-continue'));
  await act(async () => { (AppState as any).currentState = 'background'; listeners.forEach(listener => listener('background')); authorize({ ...off, authorizationOutcome: 'denied' }); });
  await act(async () => { (AppState as any).currentState = 'active'; listeners.forEach(listener => listener('active')); read({ capability: ios, status: off }); });
  expect(view.queryByRole('alert')).toBeNull();
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
});

test.each([{}, { ...policy, statusReadAccepted: false }, { ...policy, statusVisibility: 'unknown' }])('unknown required native status never renders a green Screen Time layer', async unknown => {
  const { view } = setup(ios, unknown as ProtectionStatus); await act(async () => {});
  expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
  await review(view);
  expect(view.getByTestId('website-screen-time-status')).toHaveTextContent('Not confirmed');
  expect(view.queryByText(/^Enabled$/)).toBeNull();
});

const failedAuthorizationOutcomes = [
  ['denied', 'Screen Time was not allowed. Tap Allow Screen Time to try again.'],
  ['cancelled', 'The Screen Time request was cancelled. Tap Allow Screen Time when you are ready.'],
  ['error', 'The Screen Time request could not finish. Keep FREED open and tap Allow Screen Time to retry.'],
  ['unsupported', 'Screen Time authorization is unavailable in this installed build. Use recovery tools or update FREED.'],
] as const;
const failedPublishedStatuses = [
  ['null', null], ['malformed', {}], ['rejected', { ...policy, statusReadAccepted: false, statusReadError: 'native-status-read-failed' }],
] as const;
test.each(failedAuthorizationOutcomes.flatMap(([outcome, message]) => failedPublishedStatuses.map(([kind, publishedStatus]) => ({ outcome, message, kind, publishedStatus }))))(
  'retained $outcome keeps the exact current request reachable after a published $kind status', async ({ outcome, message, publishedStatus }) => {
    (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValueOnce({ ...off, authorizationOutcome: outcome });
    const { view, props, refresh, close } = setup(); await act(async () => {});
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    refresh.mockResolvedValue({ capability: ios, status: publishedStatus } as never);
    view.rerender(<ProtectionFeatureSetup {...props} status={publishedStatus as ProtectionStatus | null} />);
    expect(view.getByRole('alert')).toHaveTextContent(message);
    expect(view.getByTestId('feature-setup-continue')).toHaveTextContent('Allow Screen Time');
    expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
    expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
    await review(view); expect(view.getByTestId('website-screen-time-status')).toHaveTextContent('Not confirmed');
    fireEvent.press(view.getByTestId('website-return-current'));
    const replacement = outcome === 'denied' ? 'cancelled' : 'denied';
    (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValueOnce({ ...off, authorizationOutcome: replacement });
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(2);
    expect(Native.requestProtectionAuthorization).toHaveBeenNthCalledWith(2);
    expect(view.getByRole('alert')).toHaveTextContent(replacement === 'cancelled'
      ? 'The Screen Time request was cancelled. Tap Allow Screen Time when you are ready.'
      : 'Screen Time was not allowed. Tap Allow Screen Time to try again.');
    expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
    expect(view.queryByTestId('dns-consent-open')).toBeNull();
    expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
    fireEvent.press(view.getByTestId('feature-setup-leave')); expect(close).toHaveBeenCalledTimes(1);
  },
);

test('a granted retry from unknown published status replaces denial without applying policy from missing facts', async () => {
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValueOnce({ ...off, authorizationOutcome: 'denied' });
  const { view, props, refresh } = setup(); await act(async () => {});
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  view.rerender(<ProtectionFeatureSetup {...props} status={null} />);
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValueOnce({ ...off, authorized: true, authorizationOutcome: 'granted' });
  refresh.mockResolvedValueOnce({ capability: ios, status: null });
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(2);
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  expect(view.getByRole('alert')).toHaveTextContent('Device status could not refresh. Check again before relying on protection.');
  expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');
  expect(view.queryByTestId('feature-setup-continue')).toBeNull();
  expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();
  await review(view); expect(view.getByTestId('website-screen-time-status')).toHaveTextContent('Not confirmed');
});

test.each(['owner', 'foreground', 'close'])('authorization retry from unknown readback retains the %s fence', async boundary => {
  const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() }; });
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValueOnce({ ...off, authorizationOutcome: 'denied' });
  let owner = 'owner-a', finish!: (value: object) => void;
  const { view, props, refresh } = setup();
  view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => owner} />); await act(async () => {});
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  refresh.mockResolvedValue({ capability: ios, status: null });
  view.rerender(<ProtectionFeatureSetup {...props} status={null} getActionScope={() => owner} />);
  (Native.requestProtectionAuthorization as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.press(view.getByTestId('feature-setup-continue'));
  if (boundary === 'owner') { owner = 'owner-b'; view.rerender(<ProtectionFeatureSetup {...props} status={null} getActionScope={() => owner} />); }
  else if (boundary === 'foreground') { await act(async () => { (AppState as any).currentState = 'background'; listeners.forEach(listener => listener('background')); }); }
  else view.unmount();
  await act(async () => { finish({ ...off, authorized: true, authorizationOutcome: 'granted' }); });
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(2);
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  if (boundary !== 'close') { expect(view.queryByRole('alert')).toBeNull(); expect(view.queryByTestId('dns-consent-open')).toBeNull(); }
});

test('DNS consent can be cancelled; save must read back the exact native profile before showing Settings', async()=>{
  const {view}=await dnsSetup(); expect(view.queryByTestId('dns-settings-guide')).toBeNull();
  fireEvent.press(view.getByTestId('dns-consent-open')); expect(view.getByText(appI18n.t('dns.consentBody'))).toBeOnTheScreen();
  fireEvent.press(view.getByTestId('dns-consent-cancel')); expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
  const saved={...dns,configured:true,requiresSettings:true};
  (Native.configureEncryptedDns as jest.Mock).mockImplementation(async()=>{(Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(saved);return saved;});
  fireEvent.press(view.getByTestId('dns-consent-open')); await act(async()=>{fireEvent.press(view.getByTestId('dns-consent-accept'));});
  expect(Native.configureEncryptedDns).toHaveBeenCalledWith({enabled:true,provider:'cloudflare-families'});expect(view.queryByTestId('dns-consent')).toBeNull();
  expect(view.getByTestId('dns-status')).toHaveTextContent(/^Setting up$/);expect(view.getByTestId('dns-settings-configuration-label')).toHaveTextContent(new RegExp(saved.configurationLabel));
  expect(view.getByText(/This opens FREED’s app settings/)).toBeOnTheScreen();expect(view.queryByTestId('dns-refresh')).toBeNull();expect(view.queryByTestId('dns-browsing-test-status')).toBeNull();
  await act(async()=>{fireEvent.press(view.getByTestId('dns-settings'));});expect(Native.openProtectionSettings).toHaveBeenCalledTimes(1);
});

test('successful configure payload cannot override the final OS readback',async()=>{
 const {view}=await dnsSetup();(Native.configureEncryptedDns as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true,healthy:true});
 fireEvent.press(view.getByTestId('dns-consent-open'));await act(async()=>{fireEvent.press(view.getByTestId('dns-consent-accept'));});
 expect(Native.configureEncryptedDns).toHaveBeenCalledTimes(1);expect(view.getByTestId('dns-status')).toHaveTextContent(/^Off$/);expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByText(/test passed/i)).toBeNull();
});

test.each(['throw','rejected'])('DNS %s save retains consent, error and retry',async failure=>{
 const {view}=await dnsSetup();
 if(failure==='throw')(Native.configureEncryptedDns as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
 else (Native.configureEncryptedDns as jest.Mock).mockResolvedValue({...dns,operationAccepted:false,operationReason:'ios-dns-preferences-save-failed'});
 fireEvent.press(view.getByTestId('dns-consent-open'));await act(async()=>{fireEvent.press(view.getByTestId('dns-consent-accept'));});
 expect(view.getByTestId('dns-consent')).toBeOnTheScreen();expect(view.getByRole('alert')).toHaveTextContent(/could not be saved/);expect(view.getByTestId('dns-consent-accept')).not.toBeDisabled();expect(view.queryByTestId('dns-settings-guide')).toBeNull();
});

test.each(['ios-dns-simulator-unavailable','encrypted-dns-release-gated'])('unsupported DNS %s has one repair task and usable recovery exit',async reason=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,supported:false,releaseEnabled:false,reason});const {view,close}=await dnsSetup();
 expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();expect(view.queryByTestId('dns-consent-open')).toBeNull();expect(view.queryByTestId('dns-settings-guide')).toBeNull();
 fireEvent.press(view.getByTestId('feature-setup-leave'));expect(close).toHaveBeenCalledTimes(1);
});

test.each([null,true,false])('enabled DNS health %s retains its independent layer result and never verifies browsing',async healthy=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true,healthy});const {view}=await dnsSetup();
 expect(view.queryByTestId('dns-settings-guide')).toBeNull();await review(view);expect(view.getByTestId('website-reviewed-dns-status')).toHaveTextContent(healthy===false?'Needs attention':'Enabled');
 expect(view.getByTestId('website-review-browsing')).toHaveTextContent(/Browsing test needed/);expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();
});

test('a failed native read removes current configuration and can retry without stale readiness',async()=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true});const {view}=await dnsSetup();
 (Native.getEncryptedDnsStatus as jest.Mock).mockRejectedValueOnce(new Error('read failed'));await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 expect(view.getByRole('alert')).toHaveTextContent(/not confirmed/);expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByTestId('website-safari-recovery')).toBeNull();
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true});await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 expect(view.getByTestId('website-safari-recovery')).toBeOnTheScreen();
});

test('pending parent action hides competing DNS writes and leaves recovery exit reachable',async()=>{
 let finish!:(value:ProtectionStatus)=>void;(Native.requestProtectionAuthorization as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const {view,close}=setup();await act(async()=>{});fireEvent.press(view.getByTestId('feature-setup-continue'));
 try{expect(view.getByTestId('feature-setup-continue')).toBeDisabled();expect(view.queryByTestId('dns-consent-open')).toBeNull();fireEvent.press(view.getByTestId('feature-setup-leave'));expect(close).toHaveBeenCalledTimes(1);}finally{await act(async()=>{finish(off);});}
});

test('Settings return queued during rejected DNS save retains consent, retry and diagnostic in the sole details destination',async()=>{
 const listeners:Array<(state:string)=>void>=[];jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{listeners.push(listener);return {remove:jest.fn()};});
 let finish!:(value:object)=>void;(Native.configureEncryptedDns as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const {view}=await dnsSetup();
 fireEvent.press(view.getByTestId('dns-consent-open'));await act(async()=>{fireEvent.press(view.getByTestId('dns-consent-accept'));});
 try{expect(view.getByTestId('dns-consent-accept')).toBeDisabled();expect(view.queryByTestId('feature-setup-continue')).toBeNull();await act(async()=>{listeners.forEach(listener=>listener('active'));});}
 finally{await act(async()=>{finish({...dns,operationAccepted:false,operationReason:'ios-dns-preferences-save-failed',operationErrorDomain:'NEConfigurationErrorDomain',operationErrorCode:10});});}
 expect(view.getByTestId('dns-consent')).toBeOnTheScreen();expect(view.getByRole('alert')).toHaveTextContent(/could not be saved/);await openProtectionDetails(view);expect(view.getByTestId('dns-operation-diagnostics')).toHaveTextContent(/NEConfigurationErrorDomain/);expect(view.getByTestId('dns-consent-accept')).not.toBeDisabled();
});

test('saved profile arrows preserve real label and disappear only on observed Settings enablement',async()=>{
 const listeners:Array<(state:string)=>void>=[];jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{listeners.push(listener);return {remove:jest.fn()};});
 const saved={...dns,configured:true,requiresSettings:true,configurationLabel:'FREED · DNS cifrado de Cloudflare Families'};(Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(saved);const {view}=await dnsSetup();
 fireEvent.press(view.getByTestId('dns-guide-next'));fireEvent.press(view.getByTestId('dns-guide-next'));expect(view.getByTestId('dns-guide-step-3')).toHaveTextContent(new RegExp(saved.configurationLabel));
 fireEvent.press(view.getByTestId('dns-guide-back'));expect(view.getByTestId('dns-guide-step-2')).toBeOnTheScreen();await act(async()=>{fireEvent.press(view.getByTestId('dns-settings'));});
 expect(view.getByTestId('dns-settings-guide')).toBeOnTheScreen();(Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...saved,enabled:true,requiresSettings:false});await act(async()=>{listeners.forEach(listener=>listener('active'));});
 expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();expect(view.queryByText(/test passed/i)).toBeNull();
});

test('policy rejection and diagnostic survive same-owner superseded read; changed owner clears them',async()=>{
 let owner='owner-a';const authorized={...off,authorized:true};(Native.applyAdultContentFilter as jest.Mock).mockResolvedValue({...authorized,adultWebPolicyOperationAccepted:false,adultWebPolicyReason:'ios-adult-policy-persistence-failed',adultWebPolicyDiagnostics:{stage:'preferences-persistence'}});
 const {view,props,refresh}=setup(ios,authorized);view.rerender(<ProtectionFeatureSetup {...props} getActionScope={()=>owner}/>);await act(async()=>{});
 refresh.mockResolvedValueOnce({capability:ios,status:authorized,superseded:true} as never);await act(async()=>{fireEvent.press(view.getByTestId('feature-setup-continue'));});
 expect(view.getByRole('alert')).toHaveTextContent(/could not be saved/);await openProtectionDetails(view);expect(view.getByTestId('website-operation-diagnostics')).toHaveTextContent(/preferences-persistence/);expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
 owner='owner-b';view.rerender(<ProtectionFeatureSetup {...props} getActionScope={()=>owner}/>);expect(view.queryByRole('alert')).toBeNull();expect(view.queryByTestId('website-operation-diagnostics')).toBeNull();
});

test('late policy receipt after owner change cannot publish current rejection',async()=>{
 let owner='owner-a',finish!:(value:object)=>void;(Native.applyAdultContentFilter as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const authorized={...off,authorized:true};const {view,props}=setup(ios,authorized);view.rerender(<ProtectionFeatureSetup {...props} getActionScope={()=>owner}/>);await act(async()=>{});
 fireEvent.press(view.getByTestId('feature-setup-continue'));owner='owner-b';await act(async()=>{finish({...authorized,adultWebPolicyOperationAccepted:false,adultWebPolicyReason:'ios-adult-policy-persistence-failed'});});expect(view.queryByRole('alert')).toBeNull();expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
});

test('native lock rejection remains exact retry and an unmounted request still finishes final read',async()=>{
 const authorized={...off,authorized:true};(Native.applyAdultContentFilter as jest.Mock).mockResolvedValue({nativeConfigurationOperationAccepted:false,nativeConfigurationError:'ios-native-configuration-lock-unavailable'});
 const {view}=setup(ios,authorized);await act(async()=>{fireEvent.press(view.getByTestId('feature-setup-continue'));});expect(view.getByRole('alert')).toHaveTextContent(/busy.*retry/i);expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();view.unmount();
 let finish!:(value:ProtectionStatus)=>void;(Native.requestProtectionAuthorization as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const second=setup();await act(async()=>{});fireEvent.press(second.view.getByTestId('feature-setup-continue'));second.view.unmount();await act(async()=>{finish(off);});expect(second.refresh).toHaveBeenCalledTimes(2);expect(second.close).not.toHaveBeenCalled();
});

test('Safari follows paired configuration read, browser links and settings never record recovery or browsing passes',async()=>{
 const {view}=await safariSetup();expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');expect(view.getByTestId('website-safari-recovery')).toHaveTextContent(/Blocking, browsing and Open Challenge remain unverified/);expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
 fireEvent.press(view.getByTestId('website-test-toggle'));await act(async()=>{fireEvent.press(view.getByTestId('website-test-adult'));fireEvent.press(view.getByTestId('website-test-normal'));});
 expect(Linking.openURL).toHaveBeenNthCalledWith(1,'https://nudity.testcategory.com');expect(Linking.openURL).toHaveBeenNthCalledWith(2,'https://example.com');expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');expect(view.getByText(appI18n.t('guidedWebsiteSetup.recoveryCheck'))).toBeOnTheScreen();expect(view.queryByText(/Recovery On|test passed/i)).toBeNull();
});

test('Advanced stays a single destination while current task remains primary',async()=>{
 const {view,props}=setup();const advanced=jest.fn();view.rerender(<ProtectionFeatureSetup {...props} onOpenAdvancedProtection={advanced}/>);await act(async()=>{});expect(view.queryByTestId('dns-section')).toBeNull();expect(view.getByTestId('website-screen-time-step')).toBeOnTheScreen();fireEvent.press(view.getByTestId('website-open-advanced'));expect(advanced).toHaveBeenCalledTimes(1);expect(view.queryByTestId('website-coverage-details')).toBeNull();
});

test('explicit switch activation starts the current permission step once; ordinary setup mount remains passive', async () => {
  const scope = 'owner-scope-current'; const consumed = jest.fn();
  const authorized = { ...off, authorized: true }, enabled = { ...authorized, adultFilterActive: true };
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue(authorized);
  (Native.applyAdultContentFilter as jest.Mock).mockResolvedValue(enabled);
  const { view, props, refresh } = setup(); await act(async () => {});
  expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
  refresh.mockResolvedValue({ capability: ios, status: enabled });
  await act(async () => { view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} activationRequest={{ id: 1, scope }} onActivationHandled={consumed} />); });
  expect(consumed).toHaveBeenCalledWith(1);
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
  expect(Native.applyAdultContentFilter).toHaveBeenCalledTimes(1);
  await act(async () => { view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} activationRequest={{ id: 1, scope }} onActivationHandled={consumed} />); });
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
  expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
});

test('an activation entry from a previous scope cannot request a permission or install policy', async () => {
  const { view, props } = setup(); await act(async () => {}); const consumed = jest.fn();
  await act(async () => { view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => 'new-owner'} activationRequest={{ id: 2, scope: 'old-owner' }} onActivationHandled={consumed} />); });
  expect(consumed).not.toHaveBeenCalled();
  expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
});

test('activation waits for usable native capability and does not close a configured setup as recovery success', async () => {
  const { view, props } = setup(); await act(async () => {}); const consumed = jest.fn(); const scope = 'owner-current';
  await act(async () => { view.rerender(<ProtectionFeatureSetup {...props} capability={null} getActionScope={() => scope} activationRequest={{ id: 3, scope }} onActivationHandled={consumed} />); });
  expect(consumed).not.toHaveBeenCalled(); expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
  const authorized = { ...off, authorized: true }, enabled = { ...authorized, adultFilterActive: true };
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue(authorized); (Native.applyAdultContentFilter as jest.Mock).mockResolvedValue(enabled);
  await act(async () => { view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} activationRequest={{ id: 3, scope }} onActivationHandled={consumed} />); });
  expect(consumed).toHaveBeenCalledWith(3); expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
});


test('deferred activation remains pending in background and resumes only after foreground return', async () => {
  const originalState = AppState.currentState; const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() }; });
  let release!: () => void; const queue = websiteSetupWriter.enqueue(() => new Promise<void>(resolve => { release = resolve; }));
  try {
    const { view, props } = setup(); await act(async () => {}); const consumed = jest.fn(); const scope = 'current-scope';
    await act(async () => { view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} activationRequest={{ id: 4, scope }} onActivationHandled={consumed} />); });
    await act(async () => { (AppState as any).currentState = 'background'; listeners.forEach(listener => listener('background')); release(); await queue; });
    expect(consumed).not.toHaveBeenCalled(); expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
    const authorized = { ...off, authorized: true }, enabled = { ...authorized, adultFilterActive: true };
    (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue(authorized); (Native.applyAdultContentFilter as jest.Mock).mockResolvedValue(enabled);
    await act(async () => { (AppState as any).currentState = 'active'; listeners.forEach(listener => listener('active')); });
    expect(consumed).toHaveBeenCalledTimes(1); expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
    expect(Native.applyAdultContentFilter).toHaveBeenCalledTimes(1);
  } finally { (AppState as any).currentState = originalState; release?.(); }
});

test('Strict Mode replay starts and completes one activation instead of consuming a cancelled request', async () => {
  const consumed = jest.fn(); const scope = 'strict-current';
  let authorize!: (value: ProtectionStatus) => void;
  (Native.requestProtectionAuthorization as jest.Mock).mockImplementation(() => new Promise(resolve => { authorize = resolve; }));
  const authorized = { ...off, authorized: true }, enabled = { ...authorized, adultFilterActive: true };
  (Native.applyAdultContentFilter as jest.Mock).mockResolvedValue(enabled);
  const props = { intent: 'websites' as const, capability: ios, status: off, appCount: 0, onRefresh: jest.fn(async () => ({ capability: ios, status: enabled })), onChooseApps: jest.fn(), onSyncApps: jest.fn(), onClose: jest.fn(), vpnDisclosureAcknowledged: false, onAcknowledgeVpnDisclosure: jest.fn(), getActionScope: () => scope, activationRequest: { id: 5, scope }, onActivationHandled: consumed };
  const view = render(<React.StrictMode><ProtectionFeatureSetup {...props} /></React.StrictMode>, { concurrentRoot: true });
  await act(async () => {}); expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
  await act(async () => { authorize(authorized); });
  expect(consumed).toHaveBeenCalledTimes(1); expect(Native.applyAdultContentFilter).toHaveBeenCalledTimes(1);
  view.unmount();
});


test.each(['null','superseded','missing-status'])('paired parent %s read never advances setup from stale DNS enablement',async outcome=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true});const {view,refresh}=await dnsSetup();
 refresh.mockResolvedValueOnce((outcome==='null'?null:outcome==='superseded'?{capability:ios,status:policy,superseded:true}:{capability:ios,status:null}) as never);
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();expect(view.queryByTestId('website-safari-recovery')).toBeNull();expect(view.getByRole('alert')).toHaveTextContent(/not confirmed/);
});

test.each([['owner','success'],['generation','success'],['background','success'],['owner','rejection'],['generation','rejection'],['background','rejection']])('late paired check cannot advance after %s boundary with %s and duplicate taps join no extra read',async (boundary,outcome)=>{
 const listeners:Array<(state:string)=>void>=[];jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{listeners.push(listener);return {remove:jest.fn()};});
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true});const {view,refresh,props}=await dnsSetup();let scope='owner-a:generation-1';view.rerender(<ProtectionFeatureSetup {...props} getActionScope={()=>scope}/>);
 let finish!:(value:object)=>void,reject!:(error:Error)=>void;refresh.mockImplementationOnce(()=>new Promise((resolve,no)=>{finish=resolve;reject=no;}) as never);
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));fireEvent.press(view.getByTestId('website-configuration-check'));});expect(refresh).toHaveBeenCalledTimes(2);expect(view.getByTestId('website-configuration-check')).toBeDisabled();
 if(boundary==='background'){await act(async()=>{(AppState as any).currentState='background';listeners.forEach(listener=>listener('background'));});}
 else{scope=boundary==='owner'?'owner-b:generation-1':'owner-a:generation-2';view.rerender(<ProtectionFeatureSetup {...props} getActionScope={()=>scope}/>);}
 await act(async()=>{if(outcome==='rejection')reject(new Error('late old read failed'));else finish({capability:ios,status:policy});});expect(view.queryByTestId('website-safari-recovery')).toBeNull();expect(view.queryByRole('alert')).toBeNull();expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();
 if(boundary==='background'){await act(async()=>{(AppState as any).currentState='active';listeners.forEach(listener=>listener('active'));});expect(view.getByTestId('website-safari-refresh')).not.toBeDisabled();expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');expect(view.queryByTestId('website-safari-last-check')).toBeNull();}
});

test('fresh Settings read invalidates a prior paired check even when DNS fields match',async()=>{
 const listeners:Array<(state:string)=>void>=[];jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{listeners.push(listener);return {remove:jest.fn()};});const {view}=await safariSetup();
 await act(async()=>{listeners.forEach(listener=>listener('active'));});expect(view.queryByTestId('website-safari-recovery')).toBeNull();expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();
});

test('missing current capability or status shows read repair, with no retained enabled fact',async()=>{
 const {view,props}=await safariSetup();view.rerender(<ProtectionFeatureSetup {...props} capability={null} status={null}/>);expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();expect(view.queryByTestId('feature-setup-continue')).toBeNull();expect(view.queryByTestId('website-safari-recovery')).toBeNull();expect(view.queryByText(/^Enabled$/)).toBeNull();
});


test('saved disabled profile with no confirmed native label gives read repair instead of an empty Settings task',async()=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configurationLabel:undefined,configured:true,enabled:false});const {view}=await dnsSetup();expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByTestId('dns-settings')).toBeNull();
});

test('rejected DNS repair with existing enabled profile keeps exact error, consent retry and no guide or weakening action',async()=>{
 const existing={...dns,configured:true,enabled:true};(Native.configureEncryptedDns as jest.Mock).mockImplementation(async()=>{(Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(existing);return {...existing,operationAccepted:false,operationReason:'ios-dns-preferences-save-failed'};});const {view}=await dnsSetup();fireEvent.press(view.getByTestId('dns-consent-open'));await act(async()=>{fireEvent.press(view.getByTestId('dns-consent-accept'));});expect(view.getByTestId('dns-consent')).toBeOnTheScreen();expect(view.getByRole('alert')).toHaveTextContent(/could not be saved/);expect(view.getByTestId('dns-consent-accept')).not.toBeDisabled();expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByTestId('dns-pause')).toBeNull();
});


test('current-owner parent refresh rejection retains its real failure and paired-read repair',async()=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true});const {view,refresh}=await dnsSetup();refresh.mockRejectedValueOnce(new Error('current read failed'));await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});expect(view.getAllByRole('alert').some(alert=>String(alert.props.children).includes('Device status could not refresh'))).toBe(true);expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();expect(view.queryByTestId('website-safari-recovery')).toBeNull();
});


test('M2 contradictory configured/enabled/healthy DNS payload remains Unsupported when releaseEnabled alone is false',async()=>{
 (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,supported:true,releaseEnabled:false,configured:true,enabled:true,healthy:true});const {view}=await dnsSetup();await review(view);expect(view.getByTestId('website-reviewed-dns-status')).toHaveTextContent(/^Unsupported$/);expect(view.getByTestId('website-review-browsing')).toHaveTextContent(/Browsing test needed/);expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByTestId('dns-consent-open')).toBeNull();expect(view.queryByText(/Verified on this network|test passed/i)).toBeNull();expect(view.getByTestId('website-overall-status')).not.toHaveTextContent(/^On$/);
});
