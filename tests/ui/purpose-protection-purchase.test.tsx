import React from 'react';
import { AppState, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { FunctionalPaywallScreen } from '@/components/FunctionalPaywallScreen';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import * as NativeProtection from 'freed-protection';
import { fetchLaunchStorePrices } from '@/lib/monetization';
import { syncNativeAdultDomainFeed } from '@/lib/adult-domain-feed-sync';
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/components/EncryptedDnsSection', () => ({ EncryptedDnsSection: () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null, ArrowLeft: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: true, spatialMotion: false, reduceMotion: true, focused: true, foreground: true }) }));
jest.mock('@/lib/adult-domain-feed-sync', () => ({ syncNativeAdultDomainFeed: jest.fn(async () => undefined) }));
let mockNativeStatus: ProtectionStatus;
jest.mock('freed-protection', () => ({
    getEncryptedDnsStatus: jest.fn(async () => ({ supported: false, releaseEnabled: false, configured: false, enabled: false, healthy: null, provider: 'cloudflare-families', reason: 'ios-dns-simulator-unavailable', requiresSettings: false, configurationLabel: null })),
    applyAdultContentFilter: jest.fn(async () => (mockNativeStatus = { ...mockNativeStatus, active: true, adultFilterActive: true, adultWebPolicyOperationAccepted: true, adultWebPolicyConfigured: true, adultWebPolicyReason: null })), requestProtectionAuthorization: jest.fn(async () => ({ ...mockNativeStatus, authorizationOutcome: mockNativeStatus.authorized ? 'granted' : 'denied' })),
    presentFamilyActivityPicker: jest.fn(async () => mockNativeStatus), openUsageAccessSettings: jest.fn(async () => mockNativeStatus),
    openProtectionSettings: jest.fn(async () => mockNativeStatus), openPrivateDnsSettings: jest.fn(async () => mockNativeStatus),
    openVpnSettings: jest.fn(async () => mockNativeStatus), openSafariExtensionSettings: jest.fn(async () => mockNativeStatus),
}));
jest.mock('@/lib/monetization', () => ({ ...jest.requireActual('@/lib/monetization'), fetchLaunchStorePrices: jest.fn() }));
let mockOwner = 'owner-a';
const mockCheckoutContext = jest.fn();
jest.mock('@/lib/firebase-native', () => ({
    getFirebaseAccountScope: () => mockOwner,
    getFirebaseAccountSummary: () => ({ signedIn: true, anonymous: false }),
    getFirebaseCallableContracts: jest.fn(async () => ({ getCheckoutContext: () => mockCheckoutContext() })),
}));
const wrap = (child: React.ReactNode) => <I18nextProvider i18n={appI18n}>{child}</I18nextProvider>;
const android: ProtectionCapability = { platform: 'android', screenTime: false, managedSettings: false, accessibility: true, usageStats: true, dnsFiltering: true, localVpnFallback: true, notes: [] };
const ios: ProtectionCapability = { platform: 'ios', screenTime: true, managedSettings: true, accessibility: false, dnsFiltering: true, localVpnFallback: false, safariContentBlocker: true, notes: [] };
const denied: ProtectionStatus = { authorized: false, active: false, adultFilterActive: false, mode: 'screen-time', message: 'Permission denied', appLimitScheduled: false, selectedScreenTimeTokenCount: 0 };
const originalPlatform = Platform.OS;
const previousProducts = { monthly: process.env.EXPO_PUBLIC_IAP_PRODUCT_MONTHLY, yearly: process.env.EXPO_PUBLIC_IAP_PRODUCT_YEARLY };
beforeEach(async () => {
    (AppState as any).currentState = 'active';
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockOwner = 'owner-a';
    mockCheckoutContext.mockReset().mockResolvedValue({ appAccountToken: '11111111-1111-4111-8111-111111111111', obfuscatedAccountId: 'account-a' });
    (fetchLaunchStorePrices as jest.Mock).mockReset().mockResolvedValue([
        { productId: 'freed_premium_yearly', displayPrice: '79,99 €', freeTrialDays: null },
        { productId: 'freed_premium_monthly', displayPrice: '9,99 €', freeTrialDays: null },
    ]);
    process.env.EXPO_PUBLIC_IAP_PRODUCT_MONTHLY = 'freed_premium_monthly';
    process.env.EXPO_PUBLIC_IAP_PRODUCT_YEARLY = 'freed_premium_yearly';
    mockNativeStatus = denied;
    await appI18n.changeLanguage('en');
});
afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    for (const [key, value] of [['EXPO_PUBLIC_IAP_PRODUCT_MONTHLY', previousProducts.monthly], ['EXPO_PUBLIC_IAP_PRODUCT_YEARLY', previousProducts.yearly]] as const) {
        if (value === undefined)
            delete process.env[key];
        else
            process.env[key] = value;
    }
});
function setup(intent: 'websites' | 'apps', capability: ProtectionCapability, status: ProtectionStatus, appCount = 0) {
    mockNativeStatus = status;
    const close = jest.fn(), chooseApps = jest.fn(), syncApps = jest.fn(async () => mockNativeStatus);
    function Harness() {
        const [current, setCurrent] = React.useState(status);
        const refresh = React.useCallback(async () => { setCurrent(mockNativeStatus); return { capability, status: mockNativeStatus }; }, []);
        return <ProtectionFeatureSetup intent={intent} capability={capability} status={current} appCount={appCount} onRefresh={refresh} onChooseApps={chooseApps} onSyncApps={syncApps} onClose={close} vpnDisclosureAcknowledged onAcknowledgeVpnDisclosure={jest.fn()}/>;
    }
    return { view: render(wrap(<Harness />)), close, chooseApps, syncApps };
}
function deferred() {
    let resolve!: (value: unknown) => void;
    const promise = new Promise<unknown>(done => { resolve = done; });
    return { promise, resolve };
}
test('website setup can authorize Apple policy without picking app targets', async () => {
    const { view, chooseApps, syncApps, close } = setup('websites', ios, denied);
    mockNativeStatus = { ...denied, authorized: true };
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    fireEvent.press(view.getByTestId('website-review-setup'));
    expect(view.getByTestId('website-screen-time-status')).toHaveTextContent(/^Enabled$/);
    expect(view.queryByTestId('feature-setup-continue')).toBeNull();
    expect(view.getByRole('button', { name: 'Done' })).toBeOnTheScreen();
    expect(NativeProtection.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
    expect(NativeProtection.applyAdultContentFilter).toHaveBeenCalledTimes(1);
    expect(NativeProtection.presentFamilyActivityPicker).not.toHaveBeenCalled();
    expect(chooseApps).not.toHaveBeenCalled();
    expect(syncApps).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Done' }));
    expect(close).toHaveBeenCalledTimes(1);
});
test('denied permission remains incomplete while recovery exit stays available', async () => {
    const { view, close } = setup('websites', ios, denied);
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    expect(view.getByRole('alert')).toHaveTextContent(appI18n.t('protectionAuthorization.denied'));
    fireEvent.press(view.getByTestId('website-review-setup'));
    expect(view.getByTestId('website-screen-time-status')).toHaveTextContent(/^Needs attention$/);
    expect(view.queryByText('Enabled')).toBeNull();
    expect(view.getByTestId('feature-setup-leave')).not.toBeDisabled();
    fireEvent.press(view.getByTestId('feature-setup-leave'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(NativeProtection.applyAdultContentFilter).not.toHaveBeenCalled();
});
test('Android app setup routes to package selection with no website or feed requirements', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const readyPermissions: ProtectionStatus = { ...denied, mode: 'accessibility', appInterventionAuthorized: true, usageStatsAuthorized: true, blockedApplications: 0 };
    const { view, chooseApps, syncApps } = setup('apps', android, readyPermissions, 0);
    expect(view.queryByText('Reviewed adult-domain feed')).toBeNull();
    expect(view.queryByText('Adult-domain DNS Guard')).toBeNull();
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    expect(chooseApps).toHaveBeenCalledTimes(1);
    expect(syncApps).not.toHaveBeenCalled();
    expect(NativeProtection.applyAdultContentFilter).not.toHaveBeenCalled();
    expect(syncNativeAdultDomainFeed).not.toHaveBeenCalled();
});
test('selected Android packages sync through app-only setup even with DNS unset', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const status: ProtectionStatus = { ...denied, mode: 'accessibility', appInterventionAuthorized: true, usageStatsAuthorized: true, blockedApplications: 0 };
    const { view, chooseApps, syncApps } = setup('apps', android, status, 3);
    mockNativeStatus = { ...status, blockedApplications: 3 };
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
    expect(syncApps).toHaveBeenCalledTimes(1);
    expect(chooseApps).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Done' })).toBeOnTheScreen();
    expect(view.getByText('3 / 3')).toBeOnTheScreen();
    expect(NativeProtection.applyAdultContentFilter).not.toHaveBeenCalled();
    expect(syncNativeAdultDomainFeed).not.toHaveBeenCalled();
});
test('store-localized prices alone cannot start checkout before current-owner server readiness', async () => {
    const server = deferred();
    mockCheckoutContext.mockReturnValue(server.promise);
    const subscribe = jest.fn();
    const view = render(wrap(<FunctionalPaywallScreen onSubscribe={subscribe} onClose={jest.fn()} onRestore={jest.fn()}/>));
    await waitFor(() => expect(view.getByText('79,99 €')).toBeOnTheScreen());
    expect(view.getByTestId('paywall-subscribe')).toBeDisabled();
    fireEvent.press(view.getByTestId('paywall-subscribe'));
    expect(subscribe).not.toHaveBeenCalled();
    await act(async () => { server.resolve({ appAccountToken: '11111111-1111-4111-8111-111111111111', obfuscatedAccountId: 'account-a' }); });
    await waitFor(() => expect(view.getByTestId('paywall-subscribe')).not.toBeDisabled());
    fireEvent.press(view.getByTestId('paywall-subscribe'));
    expect(subscribe).toHaveBeenCalledWith('yearly');
});
test('empty store inventory and a network failure display distinct actionable messages', async () => {
    (fetchLaunchStorePrices as jest.Mock).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('network'));
    const subscribe = jest.fn();
    const view = render(wrap(<FunctionalPaywallScreen onSubscribe={subscribe} onClose={jest.fn()} onRestore={jest.fn()}/>));
    await waitFor(() => expect(view.getByRole('alert')).toHaveTextContent(/No store prices were returned\./));
    expect(view.getByTestId('paywall-subscribe')).toBeDisabled();
    await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Retry store prices' })); });
    await waitFor(() => expect(view.getByRole('alert')).toHaveTextContent('Store prices could not load. Check your connection and retry.'));
    expect(view.queryByText('79,99 €')).toBeNull();
    expect(view.getByTestId('paywall-subscribe')).toBeDisabled();
    expect(subscribe).not.toHaveBeenCalled();
});
test('a stale owner readiness response cannot enable checkout for the newly signed-in owner', async () => {
    const first = deferred(), second = deferred();
    mockCheckoutContext.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const subscribe = jest.fn();
    const props = { onSubscribe: subscribe, onClose: jest.fn(), onRestore: jest.fn() };
    const view = render(wrap(<FunctionalPaywallScreen {...props}/>));
    await waitFor(() => expect(view.getByText('79,99 €')).toBeOnTheScreen());
    mockOwner = 'owner-b';
    view.rerender(wrap(<FunctionalPaywallScreen {...props}/>));
    await act(async () => { first.resolve({ appAccountToken: '11111111-1111-4111-8111-111111111111', obfuscatedAccountId: 'account-a' }); });
    expect(view.getByTestId('paywall-subscribe')).toBeDisabled();
    fireEvent.press(view.getByTestId('paywall-subscribe'));
    expect(subscribe).not.toHaveBeenCalled();
    await act(async () => { second.resolve({ appAccountToken: '22222222-2222-4222-8222-222222222222', obfuscatedAccountId: 'account-b' }); });
    await waitFor(() => expect(view.getByTestId('paywall-subscribe')).not.toBeDisabled());
    fireEvent.press(view.getByTestId('paywall-subscribe'));
    expect(subscribe).toHaveBeenCalledWith('yearly');
});
test('busy FunctionalPaywall keeps Free exit reachable and rejects repeated checkout', async () => {
    const subscribe = jest.fn(), close = jest.fn();
    const view = render(wrap(<FunctionalPaywallScreen busy onSubscribe={subscribe} onClose={close} onRestore={jest.fn()}/>));
    await waitFor(() => expect(view.getByText('79,99 €')).toBeOnTheScreen());
    expect(view.getByTestId('paywall-subscribe')).toBeDisabled();
    expect(view.getByTestId('paywall-subscribe')).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
    fireEvent.press(view.getByTestId('paywall-subscribe'));
    expect(subscribe).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Continue with Free' })).not.toBeDisabled();
    fireEvent.press(view.getByRole('button', { name: 'Continue with Free' }));
    expect(close).toHaveBeenCalledTimes(1);
});
