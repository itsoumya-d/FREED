import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccountAccessScreen } from '@/components/AccountAccessScreen';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSigninButton: Object.assign(() => null, { Size: { Wide: 1 }, Color: { Dark: 1, Light: 2 } }) }));
jest.mock('expo-apple-authentication', () => ({ AppleAuthenticationButton: () => null, AppleAuthenticationButtonStyle: {}, AppleAuthenticationButtonType: {} }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ArrowLeft: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: true, spatialMotion: false, reduceMotion: true, focused: true, foreground: true }) }));
let mockAccount = { signedIn: false, anonymous: false, email: null as string | null, providers: [] as string[] };
let mockUid: string | null = null;
let mockStartup = 'started';
jest.mock('@/lib/firebase-native', () => ({
  getFirebaseAccountSummary: () => mockAccount, getFirebaseAccountScope: () => mockUid,
  startFirebaseClient: async () => ({ status: mockStartup }),
  getFirebaseCallableContracts: async (options: { ensureGuest?: boolean }) => { if (options?.ensureGuest && !mockUid) { mockUid = 'created-guest'; mockAccount = { signedIn: true, anonymous: true, email: null, providers: [] }; } return mockUid ? { getCheckoutContext: async () => ({}) } : null; },
  getFirebaseNativeAuthAdapter: () => ({ signIn: async () => ({ ok: false, status: 'cancelled' }), getAccountSummary: () => mockAccount }),
}));
jest.mock('@/lib/monetization', () => ({ ...jest.requireActual('@/lib/monetization'), fetchLaunchStorePrices: async () => [{ productId: 'freed_premium_yearly', displayPrice: '$79.99', freeTrialDays: null }] }));
jest.mock('@/lib/social-login', () => ({ isAppleSignInAvailable: async () => true, isGoogleSignInConfigured: () => true, signInWithGoogle: async () => ({ ok: false, reason: 'cancelled' }), signInWithApple: async () => ({ ok: false, reason: 'cancelled' }) }));
beforeEach(async () => { mockStartup = 'started'; mockUid = null; mockAccount = { signedIn: false, anonymous: false, email: null, providers: [] }; await appI18n.changeLanguage('en'); });
const wrap = (child: React.ReactNode) => <I18nextProvider i18n={appI18n}>{child}</I18nextProvider>;
test('required entry cannot skip and cancelling returns to account choice', async () => {
  let destination = 'account';
  const view = render(wrap(<AccountAccessScreen requiredEntry onConnected={() => { destination = 'home'; }} onSkip={() => { destination = 'welcome'; }} />));
  await act(async () => {});
  expect(view.queryByRole('button', { name: 'Skip for now' })).toBeNull();
  expect(view.queryByText(/connect an account later/i)).toBeNull();
  expect(view.queryByText(/recovery works without signing in/i)).toBeNull();
  expect(view.getByRole('button', { name: 'Create account with email' })).toBeOnTheScreen();
  fireEvent.press(view.getByRole('button', { name: 'Back to Welcome' }));
  expect(destination).toBe('welcome');
});
test('provider linking for a real owner retains normal Cancel', async () => {
  mockUid = 'owner'; mockAccount = { signedIn: true, anonymous: false, email: null, providers: ['apple.com'] };
  let destination = 'account';
  const view = render(wrap(<AccountAccessScreen linkExisting onConnected={() => { destination = 'connected'; }} onSkip={() => { destination = 'profile'; }} />));
  await act(async () => {});
  fireEvent.press(view.getByRole('button', { name: 'Cancel' }));
  expect(destination).toBe('profile');
});
test('unavailable mandatory service retains email draft and exposes retry instead of free bypass', async () => {
  mockStartup = 'unsupported';
  const view = render(wrap(<AccountAccessScreen requiredEntry onConnected={() => { throw Error('must not connect'); }} onSkip={() => {}} />));
  await act(async () => {});
  fireEvent.press(view.getByRole('button', { name: 'Create account with email' }));
  fireEvent.changeText(view.getByLabelText('Email address'), 'draft@example.com');
  fireEvent.changeText(view.getByLabelText('Password'), 'longpassword');
  fireEvent.changeText(view.getByLabelText('Confirm password'), 'longpassword');
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Create account' })); });
  expect(view.getByRole('alert')).toHaveTextContent(/account access is unavailable/i);
  expect(view.getByLabelText('Email address')).toBeOnTheScreen();
  fireEvent.press(view.getByRole('button', { name: 'Back to account options' }));
  fireEvent.press(view.getByRole('button', { name: 'Create account with email' }));
  expect(view.getByLabelText('Email address').props.defaultValue).toBe('draft@example.com');
  expect(view.queryByText(/continue with progress/i)).toBeNull();
  expect(view.queryByRole('button', { name: 'Skip for now' })).toBeNull();
});

// Execute the production controller's assigned entry branches with native screen
// boundaries replaced by buttons. The callbacks and guard remain real.
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { Pressable, Text, View } from 'react-native';
import { createDefaultRecoveryState, completeOnboarding, markAccountStepCompleted, updateDisciplineSettings } from '@/lib/recovery-state';
import { createAccountFlowFence, createOfferDecisionStore, guardJourneyRoute, getJourneyDestination, getJourneyOwner } from '@/lib/user-journey';
function controllerHarness({ owner = null as string | null, entry = 'new' as 'new' | 'existing', intro = false, failedSave = false } = {}) {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const start = source.indexOf('  const renderScreen = (screen: Screen');
  const end = source.indexOf('    if (screen === "protectionSetup")', start);
  const hostStart = source.indexOf('  const renderAccountHost =');
  const compiled = transpileModule(`${source.slice(hostStart, start)} ${source.slice(start, end)} return <Text>protected route</Text>; }; return (requested, tab) => <>{renderScreen(requested, tab)}{renderAccountHost()}</>;`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  let state = { ...createDefaultRecoveryState(), journey: { entry, introCompletedAt: intro ? '2026-10-05T00:00:00.000Z' : null } };
  let route = 'welcome'; let index = 0; let notice: string | null = null;
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { if (failedSave) throw Error('disk'); } });
  const accountFlowFence = { current: createAccountFlowFence() };
  const auth = { status: 'ready' as const, signedIn: Boolean(owner), anonymous: false, ownerUid: owner, email: null };
  const button = (name: string, action: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={action}><Text>{name}</Text></Pressable>;
  const update = (fn: any) => { state = typeof fn === 'function' ? fn(state) : fn; };
  const getPolicy = () => ({ auth, journey: state.journey, offerAcknowledged: owner ? store.has(owner) : false, verifiedPremium: false });
  const deps = () => ({ React, Text, View, showAccountCleanupRecovery: false, rollbackPending: false, privateViewLocked: false, hydrated: true, recoveryState: state, answers: state.answers, disciplineSettings: state.disciplineSettings,
    screen: route, auxiliaryRoute: null, deferredAuxiliaryRoute: null, accountHostGeneration: { current: 0 }, accountFlowFence, beginAccountFlow: () => accountFlowFence.current.begin(), enterAccountFlow: () => accountFlowFence.current.begin(), journeyAuth: auth, journeyOwner: owner, getJourneyPolicy: getPolicy, guardJourneyRoute, getJourneyDestination, getJourneyOwner,
    setScreen: (next: string) => { route = next; }, setTab: () => {}, setQuizIndex: (value: any) => { index = typeof value === 'function' ? value(index) : value; }, quizIndex: index, quiz: [1,2,3,4,5],
    persistRecoveryState: (fn: any) => { if (failedSave) throw Error('disk'); update(fn); }, setRecoveryState: update,
    ensureOnboardingComplete: (current: any) => completeOnboarding(current, current.answers), markAccountStepCompleted,
    completeOnboardingWithSelectedApps: (current: any, answers: string[], packages: string[]) => updateDisciplineSettings(completeOnboarding(current, answers), { blockedAppPackages: packages }),
    getFirebaseAccountSummary: () => ({ signedIn: Boolean(owner), anonymous: false }), getFirebaseAccountScope: () => owner,
    retryFirebaseAuthSnapshot: () => {}, signOutRecoveryAccount: async () => {},
    accountReturnToProfile: false, setAccountReturnToProfile: () => {}, appSelectionReturnToProtectionSetup: false, setAppSelectionReturnToProtectionSetup: () => {},
    purchaseBusy: false, purchaseNotice: notice, setPurchaseNotice: (value: string) => { notice = value; },
    setProtectionSyncMessage: () => {}, setAccountNotice: () => {}, setJourneyRecoverySaveNotice: (value: string) => { notice = value; }, setJourneyOfferSaveNotice: (value: { message: string }) => { notice = value.message; }, accountNotice: notice,
    acknowledgeJourneyOffer: (decision: 'free' | 'verified-membership') => { if (owner) { const saved = store.acknowledge(owner, decision).saved; if (!saved) notice = 'Decision could not be saved'; } },
    postPaywallScreen: () => 'main', returnFromPaywall: () => { route = 'main'; }, runMembershipAction: async () => {},
    WelcomeScreen: ({ onStart, onSkip }: any) => <View>{button('Get started', onStart)}{button('I have an account', onSkip)}</View>,
    QuizScreen: ({ onAnswer, onBack, index: question }: any) => <View><Text>Question {question + 1}</Text>{button('Continue question', () => onAnswer(`answer-${question}`))}{button('Back question', onBack)}</View>,
    PlanCalculationScreen: ({ onContinue }: any) => button('Continue summary', onContinue),
    FunctionalPaywallScreen: ({ onClose }: any) => button('Continue with Free', onClose),
    AccountAccessHost: (props: any) => props.visible ? <Text>{props.requiredEntry ? 'Required account' : 'Optional account'}</Text> : null,
    SplashScreen: () => <Text>Restoring account</Text>,
  });
  function Screen() { const dependencies = deps(); const run = new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies)); return run(route, 'today'); }
  const view = render(<Screen />);
  return { view, refresh: () => view.rerender(<Screen />), route: () => route, state: () => state, notice: () => notice, setRoute: (value: string) => { route = value; }, store, auth };
}
test('actual new-user controller requires five answers and summary before account', () => {
  const flow = controllerHarness();
  fireEvent.press(flow.view.getByRole('button', { name: 'Get started' })); flow.refresh();
  expect(flow.route()).toBe('quiz');
  for (let i = 0; i < 5; i++) { fireEvent.press(flow.view.getByRole('button', { name: 'Continue question' })); flow.refresh(); }
  expect(flow.state().answers).toEqual(['answer-0','answer-1','answer-2','answer-3','answer-4']);
  expect(flow.route()).toBe('planCalculation');
  fireEvent.press(flow.view.getByRole('button', { name: 'Continue summary' })); flow.refresh();
  expect(flow.route()).toBe('account');
  expect(flow.view.getByText('Required account')).toBeOnTheScreen();
});
test('actual existing-account action skips questions and protected deep link stays gated', () => {
  const flow = controllerHarness();
  fireEvent.press(flow.view.getByRole('button', { name: 'I have an account' })); flow.refresh();
  expect(flow.route()).toBe('account');
  expect(flow.state().answers).toEqual([]);
  flow.setRoute('main'); flow.refresh();
  expect(flow.view.getByText('Required account')).toBeOnTheScreen();
  expect(flow.view.queryByText('protected route')).toBeNull();
});
test('actual offer Free callback records only real-owner decision and failed disk save allows free session', () => {
  const flow = controllerHarness({ owner: 'owner-a', intro: true, failedSave: true });
  flow.setRoute('paywall'); flow.refresh();
  fireEvent.press(flow.view.getByRole('button', { name: 'Continue with Free' })); flow.refresh();
  expect(flow.route()).toBe('main');
  expect(flow.store.has('owner-a')).toBe(true);
  expect(flow.state().premium).toBe(false);
});

import { FunctionalPaywallScreen } from '@/components/FunctionalPaywallScreen';
test('mounted paywall never recreates an anonymous session after sign-out', async () => {
  mockUid = 'owner'; mockAccount = { signedIn: true, anonymous: false, email: null, providers: ['apple.com'] };
  const view = render(wrap(<FunctionalPaywallScreen onSubscribe={() => {}} onClose={() => {}} onRestore={() => {}} />));
  await act(async () => {});
  mockUid = null; mockAccount = { signedIn: false, anonymous: false, email: null, providers: [] };
  view.rerender(wrap(<FunctionalPaywallScreen onSubscribe={() => {}} onClose={() => {}} onRestore={() => {}} />));
  await act(async () => {});
  expect(mockUid).toBeNull();
  expect(view.getByTestId('paywall-subscribe')).toBeDisabled();
});

test('actual Welcome renders the required account choice with no guest-entry promise', () => {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const start = source.indexOf('function WelcomeScreen('), end = source.indexOf('\nfunction QuizScreen(', start);
  const compiled = transpileModule(`${source.slice(start, end)}; return WelcomeScreen;`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  const dependencies = { React, useTranslation: () => ({ t: appI18n.t.bind(appI18n) }), useAppTheme: () => ({ colors: { bg: '#fff', text: '#12161c', text2: '#515965' } }),
    useWindowDimensions: () => ({ height: 667, width: 375, fontScale: 1 }), AppBackground: View, SafeAreaView: View, ScrollView: require('react-native').ScrollView, View, Text, Pressable,
    BrandLogo: () => null, OnboardingPreferences: () => null, MomentumCompanion: () => null,
    PillButton: ({ label, onPress }: any) => <Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,
  };
  const Welcome = new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
  const view = render(<Welcome onStart={() => {}} onSkip={() => {}} />);
  expect(view.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
  expect(view.getByRole('button', { name: 'I have an account' })).toBeOnTheScreen();
  expect(view.queryByText(/no account needed/i)).toBeNull();
});
import { createAccountOperationGate } from '@/lib/account-operation';
import { createPaywallNavigationSession } from '@/lib/paywall-navigation';
import { hasVerifiedPremium } from '@/lib/premium-entitlement';
test('actual cancelled purchase leaves the required offer and all answers intact', async () => {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const start = source.indexOf('  const runMembershipAction = async'), end = source.indexOf('\n  const changeAutomaticBackup', start);
  const compiled = transpileModule(`${source.slice(start, end)}; return runMembershipAction;`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  mockUid = 'owner'; mockAccount = { signedIn: true, anonymous: false, email: null, providers: ['apple.com'] };
  const auth = { status: 'ready' as const, signedIn: true, anonymous: false, ownerUid: 'owner', email: null };
  const navigation = createPaywallNavigationSession('account'); navigation.update('paywall');
  let route = 'paywall', acknowledgements = 0;
  const state = { ...createDefaultRecoveryState(), answers: ['a','b','c','d','e'] };
  const dependencies = { membershipBusyRef: { current: false }, journeyAuth: auth, getJourneyOwner, getFirebaseAccountScope: () => mockUid,
    getFirebaseAccountSummary: () => mockAccount, accountOperationGate: { current: createAccountOperationGate(() => mockUid) }, paywallNavigationRef: { current: navigation },
    setScreen: (value: string) => { route = value; }, setPurchaseBusy: () => {}, setPurchaseNotice: () => {}, getRuntimeMonetizationPlatform: () => 'android', getMonetizationConfig: () => ({ mode: 'mock' }),
    purchasePremiumPlan: async () => ({ premium: false, status: 'cancelled', message: 'Purchase cancelled' }), restorePremiumPurchases: async () => ({ premium: false }),
    safeUserFacingMessage: (value: string) => value, setRecoveryState: () => { throw Error('Cancelled purchase must not mutate recovery state'); },
    hasVerifiedPremium, acknowledgeJourneyOffer: () => { acknowledgements++; }, postPaywallScreen: () => 'main',
  };
  const run = new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
  await run('yearly');
  expect(route).toBe('paywall'); expect(acknowledgements).toBe(0);
  expect(state.answers).toEqual(['a','b','c','d','e']); expect(state.hasCompletedOnboarding).toBe(false);
});

import { setVerifiedPremiumEntitlement } from '@/lib/recovery-state';
import { PREMIUM_OFFLINE_TTL_MS } from '@/lib/premium-entitlement';
function membershipEffectHarness(response: unknown) {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const start = source.indexOf('  React.useEffect(() => {\n    if (!hydrated || Platform.OS === "web" || !journeyOwner) return;');
  const end = source.indexOf('\n  React.useEffect(', start + 1);
  const snapshotStart = source.indexOf('  const membershipSnapshot: JourneyMembershipSnapshot');
  const snapshotEnd = source.indexOf(';\n', snapshotStart) + 1;
  const script = `function Probe() {
    const [recoveryState, setRecoveryState] = React.useState(createDefaultRecoveryState());
    const recoveryStateRef = React.useRef(recoveryState); recoveryStateRef.current = recoveryState;
    const [journeyMembership, setJourneyMembership] = React.useState({ownerUid:null,status:'unavailable'});
    const [unlockClockMs, setUnlockClockMs] = React.useState(Date.now());
    ${source.slice(start,end)}
    ${source.slice(snapshotStart,snapshotEnd)}
    return <View><Text testID="membership-status">{membershipSnapshot.status}</Text><Text testID="membership-refresh-status">{journeyMembership.status}</Text></View>;
  } return Probe;`;
  const compiled = transpileModule(script, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  const readers = jest.fn().mockResolvedValue(response);
  const listeners = new Set<(state: string) => void>();
  const dependencies = { React, Text, View, createDefaultRecoveryState, hydrated: true, accessRetry: 0, Platform: { OS: 'android' }, journeyOwner: 'owner',
    AppState: { currentState: 'active', addEventListener: (_name: string, listener: (state: string) => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } },
    getFirebaseAccountScope: () => mockUid, getFirebaseAccountSummary: () => mockAccount,
    getFirebaseNativeAuthAdapter: () => ({ getCurrentIdToken: async () => 'unused-token' }),
    getFirebaseCallableContracts: async () => ({ getPremiumEntitlement: readers }),
    hasVerifiedPremium, sanitizePremiumEntitlement: require('@/lib/premium-entitlement').sanitizePremiumEntitlement,
    setVerifiedPremiumEntitlement, restorePremiumPurchases: async () => ({ verifiedEntitlement: null }), getRuntimeMonetizationPlatform: () => 'android',
  };
  const Probe = new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
  const view = render(<Probe />);
  return { view, failNext: () => readers.mockRejectedValueOnce(new Error('offline')), foreground: () => listeners.forEach(listener => listener('active')) };
}
describe('actual membership effect and exported snapshot regressions', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-05T00:00:00.000Z')); mockUid = 'owner'; mockAccount = { signedIn: true, anonymous: false, email: null, providers: ['apple.com'] }; });
  afterEach(() => { jest.useRealTimers(); });
  test.each([['expiry', 1_001, 1_000], ['offline TTL', PREMIUM_OFFLINE_TTL_MS + 1, 48 * 60 * 60_000]])('paid proof beyond %s followed by failed refresh cannot export paid', async (_label, elapsed, expires) => {
    const now = Date.now();
    const flow = membershipEffectHarness({ entitlement: { productId: 'freed_premium_yearly', platform: 'ios', expiresAt: new Date(now + Number(expires)).toISOString(), verifiedAt: new Date(now).toISOString(), status: 'verified' } });
    await act(async () => {});
    expect(flow.view.getByTestId('membership-status')).toHaveTextContent('verified-premium');
    flow.failNext(); jest.setSystemTime(now + Number(elapsed));
    await act(async () => { flow.foreground(); });
    expect(flow.view.getByTestId('membership-status')).toHaveTextContent('unavailable');
    expect(flow.view.getByTestId('membership-refresh-status')).toHaveTextContent('unavailable');
  });
  test('prompt authoritative Free remains Free past the eight-second startup deadline', async () => {
    const flow = membershipEffectHarness({ entitlement: null });
    await act(async () => {});
    expect(flow.view.getByTestId('membership-status')).toHaveTextContent('free');
    await act(async () => { jest.advanceTimersByTime(8_001); });
    expect(flow.view.getByTestId('membership-status')).toHaveTextContent('free');
  });
});

function retryNoticeHarness(store: ReturnType<typeof createOfferDecisionStore>, options: { kind?: "recovery" | "offer" | "both"; auth?: any; notice?: string; recovery?: any; onRecoverySaved?: (value: any) => void } = {}) {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const start = source.indexOf(options.kind === 'recovery' || options.kind === 'both' ? '      {journeyRecoverySaveNotice ? <View' : '      {journeyOfferSaveNotice ? <View');
  const end = source.indexOf(options.kind === 'recovery' ? '\n      {journeyOfferSaveNotice' : '\n      {children}', start + 1);
  const script = `function Probe() { const [journeyOfferSaveNotice, setJourneyOfferSaveNotice] = React.useState({ownerUid:'owner',message:initialNotice}); const [journeyRecoverySaveNotice, setJourneyRecoverySaveNotice] = React.useState(initialNotice); return <>${source.slice(start,end)}</>; } return Probe;`;
  const compiled = transpileModule(script, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  const dependencies = { React, View, Text, initialNotice: options.notice ?? 'Choice could not be saved', colors: { surface: '#fff' }, persistRecoveryState: (update: any) => { const result = update(options.recovery ?? createDefaultRecoveryState()); options.onRecoverySaved?.(result); return result; },
    getJourneyOwner, journeyAuth: options.auth ?? { status: 'ready', signedIn: true, anonymous: false, ownerUid: 'owner', email: null }, getFirebaseAccountScope: () => mockUid,
    journeyOfferStore: { current: store }, PillButton: ({ label, onPress }: any) => <Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,
  };
  const Probe = new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
  return render(<Probe />);
}
test('actual Retry saving retains warning when offer storage and remote sync both fail', async () => {
  mockUid = 'owner';
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { throw Error('quota'); } }, { read: async () => null, write: async () => { throw Error('offline'); } });
  store.acknowledge('owner', 'free');
  const view = retryNoticeHarness(store);
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Retry saving' })); });
  expect(view.getByRole('alert')).toHaveTextContent('Choice could not be saved');
});
test('actual Retry saving cannot clear another owner warning after a delayed sync', async () => {
  mockUid = 'owner'; let resolve!: () => void;
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => {} }, { read: async () => null, write: () => new Promise<void>(done => { resolve = done; }) });
  store.acknowledge('owner', 'free');
  const view = retryNoticeHarness(store);
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Retry saving' })); });
  mockUid = 'different-owner';
  await act(async () => { resolve(); });
  expect(view.getByRole('alert')).toHaveTextContent('Choice could not be saved');
});
test('actual Retry saving retains warning when failed offer storage meets remote timeout', async () => {
  mockUid = 'owner';
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { throw Error('quota'); } }, { read: async () => null, write: () => new Promise(() => {}) }, 5);
  store.acknowledge('owner', 'free');
  const view = retryNoticeHarness(store);
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Retry saving' })); await new Promise(resolve => setTimeout(resolve, 15)); });
  expect(view.getByRole('alert')).toHaveTextContent('Choice could not be saved');
});
test('actual Retry saving clears warning after confirmed local save despite remote failure', async () => {
  mockUid = 'owner'; let localWorks = false;
  const store = createOfferDecisionStore({ getItem: () => null, setItem: () => { if (!localWorks) throw Error('quota'); } }, { read: async () => null, write: async () => { throw Error('offline'); } });
  store.acknowledge('owner', 'free'); localWorks = true;
  const view = retryNoticeHarness(store);
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Retry saving' })); });
  expect(view.queryByRole('alert')).toBeNull();
});

test('actual unauthenticated summary save warning clears after successful recovery retry with all answers', () => {
  const flow = controllerHarness({ failedSave: true });
  fireEvent.press(flow.view.getByRole('button', { name: 'Get started' })); flow.refresh();
  for (let i=0; i<5; i++) { fireEvent.press(flow.view.getByRole('button', { name: 'Continue question' })); flow.refresh(); }
  fireEvent.press(flow.view.getByRole('button', { name: 'Continue summary' })); flow.refresh();
  expect(flow.notice()).toMatch(/answers are kept/);
  let saved: any = null;
  mockUid = null;
  const retry = retryNoticeHarness(createOfferDecisionStore({ getItem: () => null, setItem: () => {} }), {
    kind: 'recovery', auth: { status: 'ready', signedIn: false, anonymous: false, ownerUid: null, email: null }, notice: flow.notice()!, recovery: flow.state(), onRecoverySaved: value => { saved = value; },
  });
  fireEvent.press(retry.getByRole('button', { name: 'Retry saving answers' }));
  expect(saved.answers).toEqual(['answer-0','answer-1','answer-2','answer-3','answer-4']);
  expect(retry.queryByRole('alert')).toBeNull();
});

function rootFeedEffectsHarness(sync: () => Promise<any>) {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const syncStart = source.indexOf('    syncNativeAdultDomainFeed()', source.indexOf('export function FreedAppProvider'));
  const start = source.lastIndexOf('  React.useEffect(', syncStart);
  const foregroundStart = source.indexOf('  React.useEffect(', syncStart);
  const end = source.indexOf('  React.useEffect(', foregroundStart + 1);
  const compiled = transpileModule(`function Probe({auth}) { const journeyOwner = getJourneyOwner(auth); const adultFeedLastSyncRef = React.useRef(null); const [status,setProtectionStatus]=React.useState('cached-local'); const setProtectionSyncMessage=()=>{}; ${source.slice(start,end)} return <Text testID="feed-status">{status}</Text>; } return Probe;`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  const listeners = new Set<(state: string) => void>();
  const dependencies = { React, Text, hydrated: true, getJourneyOwner, journeyAuth: null, getFirebaseAccountScope: () => mockUid,
    syncNativeAdultDomainFeed: sync, refreshProtectionStatus: jest.fn(async () => {}), ADULT_FEED_REFRESH_INTERVAL_MS: 12*60*60_000,
    AppState: { addEventListener: (_name: string, listener: (state: string) => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } },
  };
  const Probe = new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
  const initialAuth = { status: 'hydrating', signedIn: false, anonymous: false, ownerUid: null, email: null };
  const view = render(<Probe auth={initialAuth} />);
  return { view, authenticate: (ownerUid: string | null, anonymous=false, status='ready') => { mockUid=ownerUid; view.rerender(<Probe auth={{status,signedIn:Boolean(ownerUid),anonymous,ownerUid,email:null}}/>); }, foreground: () => listeners.forEach(listener => listener('active')) };
}
test('actual Root feed effects preserve local cache before real hydration and sync after account login', async () => {
  const calls: Array<string|null> = [];
  const flow = rootFeedEffectsHarness(async () => { calls.push(mockUid); return { status:'reviewed-remote', provider:'remote',warning:null }; });
  await act(async () => {});
  expect(calls).toEqual([]); expect(flow.view.getByTestId('feed-status')).toHaveTextContent('cached-local');
  await act(async () => { flow.foreground(); }); expect(calls).toEqual([]);
  flow.authenticate('guest', true); await act(async () => { flow.foreground(); }); expect(calls).toEqual([]);
  flow.authenticate('owner', false, 'hydrating'); await act(async () => {}); expect(calls).toEqual([]);
  flow.authenticate('owner'); await act(async () => {}); expect(calls).toEqual(['owner']);
  expect(flow.view.getByTestId('feed-status')).toHaveTextContent('reviewed-remote');
});
test('actual Root initial feed response from a signed-out owner is discarded', async () => {
  const resolves: Array<(value:any)=>void> = [];
  const flow = rootFeedEffectsHarness(() => new Promise(done => { resolves.push(done); }));
  flow.authenticate('owner-a'); await act(async () => {});
  flow.authenticate(null); await act(async () => { resolves.forEach(done => done({status:'stale-remote',provider:'remote',warning:null})); });
  expect(flow.view.getByTestId('feed-status')).toHaveTextContent('cached-local');
});

test('actual Root foreground feed response is fenced after switching to another authenticated owner', async () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2026-10-05T00:00:00.000Z'));
    let calls=0; const resolves: Array<(value:any)=>void>=[];
    const flow=rootFeedEffectsHarness(() => calls++ === 0 ? Promise.resolve({status:'reviewed-owner-a',provider:'remote',warning:null}) : new Promise(done=>resolves.push(done)));
    flow.authenticate('owner-a'); await act(async()=>{});
    expect(flow.view.getByTestId('feed-status')).toHaveTextContent('reviewed-owner-a');
    jest.setSystemTime(Date.now()+13*60*60_000);
    await act(async()=>{flow.foreground();}); expect(resolves).toHaveLength(1);
    flow.authenticate('owner-b'); await act(async()=>{}); expect(resolves).toHaveLength(2);
    await act(async()=>{resolves[0]({status:'stale-owner-a',provider:'remote',warning:null});});
    expect(flow.view.getByTestId('feed-status')).toHaveTextContent('reviewed-owner-a');
    await act(async()=>{resolves[1]({status:'reviewed-owner-b',provider:'remote',warning:null});});
    expect(flow.view.getByTestId('feed-status')).toHaveTextContent('reviewed-owner-b');
  } finally { jest.useRealTimers(); }
});

test('actual independent warning callbacks clear recovered answers while preserving a failed owner-offer save', async () => {
  mockUid='owner';
  const store=createOfferDecisionStore({getItem:()=>null,setItem:()=>{throw Error('quota');}}, {read:async()=>null,write:async()=>{throw Error('offline');}});
  store.acknowledge('owner','free');
  const view=retryNoticeHarness(store,{kind:'both'});
  expect(view.getAllByRole('alert')).toHaveLength(2);
  fireEvent.press(view.getByRole('button',{name:'Retry saving answers'}));
  expect(view.getAllByRole('alert')).toHaveLength(1);
  expect(view.queryByRole('button',{name:'Retry saving answers'})).toBeNull();
  await act(async()=>{fireEvent.press(view.getByRole('button',{name:'Retry saving'}));});
  expect(view.getAllByRole('alert')).toHaveLength(1);
});
