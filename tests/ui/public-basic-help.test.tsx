import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccountAccessHost } from '@/components/AccountAccessHost';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { guardJourneyRoute, type JourneyPolicy } from '@/lib/user-journey';
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSigninButton: Object.assign(() => null, { Size: { Wide: 1 }, Color: { Dark: 1, Light: 2 } }) }));
jest.mock('expo-apple-authentication', () => ({ AppleAuthenticationButton: () => null, AppleAuthenticationButtonStyle: {}, AppleAuthenticationButtonType: {} }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/BreathingCadenceArtwork', () => ({ BreathingCadenceArtwork: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ArrowLeft: () => null, ChevronRight: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
let mockActive = true;
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: mockActive, spatialMotion: false, reduceMotion: true, focused: mockActive, foreground: mockActive }) }));
const mockAuth = jest.fn();
let mockUid: string | null = null;
let mockAdapter: any = {};
jest.mock('@/lib/firebase-native', () => ({ getFirebaseAccountSummary: () => ({ signedIn: Boolean(mockUid), anonymous: false, email: null, providers: [] }), getFirebaseAccountScope: () => mockUid, startFirebaseClient: () => mockAuth(), getFirebaseNativeAuthAdapter: () => { mockAuth(); return mockAdapter; } }));
jest.mock('@/lib/social-login', () => ({ isAppleSignInAvailable: async () => true, isGoogleSignInConfigured: () => true, signInWithGoogle: () => mockAuth(), signInWithApple: () => mockAuth() }));
const wrap = (child: React.ReactNode) => <I18nextProvider i18n={appI18n}>{child}</I18nextProvider>;
beforeEach(async () => { mockActive = true; mockUid = null; mockAdapter = {}; mockAuth.mockResolvedValue({status: 'started'}); await appI18n.changeLanguage('en'); });
test('required and unavailable account presents local help without starting account access or completing entry', async () => {
  const connected = jest.fn(), skip = jest.fn();
  const view = render(wrap(<AccountAccessHost visible requiredEntry authUnavailableReason="Account service unavailable" onConnected={connected} onSkip={skip} />));
  await act(async () => {});
  fireEvent.press(view.getByRole('button', { name: 'Help / SOS' }));
  expect(view.getByText('Basic help')).toBeOnTheScreen();
  fireEvent.press(view.getByRole('button', { name: 'Close basic help' }));
  expect(view.getByText('Connect your account')).toBeOnTheScreen();
  expect(mockAuth).not.toHaveBeenCalled(); expect(connected).not.toHaveBeenCalled(); expect(skip).not.toHaveBeenCalled();
});
test('opening and dismissing help preserves the entered account email and passwords without remounting form', async () => {
  const view = render(wrap(<AccountAccessHost visible requiredEntry onConnected={jest.fn()} onSkip={jest.fn()} />));
  await act(async () => {});
  fireEvent.press(view.getByRole('button', { name: 'Create account with email' }));
  fireEvent.changeText(view.getByLabelText('Email address'), 'draft@example.com');
  fireEvent.changeText(view.getByLabelText('Password'), 'draft-password');
  fireEvent.changeText(view.getByLabelText('Confirm password'), 'draft-password');
  const emailNode = view.getByLabelText('Email address');
  fireEvent.press(view.getByRole('button', { name: 'Help / SOS' }));
  fireEvent.press(view.getByRole('button', { name: 'Close basic help' }));
  expect(view.getByLabelText('Email address')).toBe(emailNode);
  expect(view.getByLabelText('Password')).toBeOnTheScreen();
  expect(mockAuth).not.toHaveBeenCalled();
  const submitted = jest.fn().mockResolvedValue({ok: false, reason: 'Expected fixture failure'});
  mockAdapter = {getAccountSummary: () => ({anonymous: false}), createEmailAccount: submitted};
  await act(async () => fireEvent.press(view.getByRole('button', {name: 'Create account'})));
  expect(submitted).toHaveBeenCalledWith({email: 'draft@example.com', password: 'draft-password'}, {linkExisting: false});
});
test.each(['hydrating', 'unavailable', 'no-owner', 'new-account', 'unacknowledged-offer'])('public help never changes protected route authority: %s', state => {
  const policy: JourneyPolicy = { auth: {status: state === 'hydrating' ? 'hydrating' : state === 'unavailable' ? 'unavailable' : 'ready',signedIn: state === 'new-account' || state === 'unacknowledged-offer', anonymous: false, ownerUid: state === 'new-account' || state === 'unacknowledged-offer' ? 'owner' : null, email: null}, journey: {entry: state === 'new-account' ? 'new' : 'existing', introCompletedAt: state === 'new-account' ? null : '2026-10-05T00:00:00Z'}, offerAcknowledged: false, verifiedPremium: false };
  for (const route of ['main', 'breathing', 'intercept', 'coach', 'journal', 'features', 'ad', 'challenge', 'profile']) expect(guardJourneyRoute(route, policy)).not.toBe(route);
});

import { BasicHelp, BasicHelpPresentation } from '@/components/BasicHelp';
import { AppState, Modal, View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { localeResources } from '@/i18n/runtime';
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
test('actual public cadence excludes background and lost focus, returns paused, and makes no network/storage/haptic calls', () => {
  jest.useFakeTimers(); let now = 1000;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  const previousState = AppState.currentState; (AppState as any).currentState = 'active';
  let lifecycle: (state: any) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { lifecycle = callback; return {remove: jest.fn()}; });
  const network = jest.spyOn(global, 'fetch');
  const storage = jest.spyOn(localStorage, 'setItem');
  const close = jest.fn();
  const view = render(wrap(<BasicHelp onClose={close} />));
  fireEvent.press(view.getByRole('button', { name: 'Begin breathing' }));
  now = 5500; act(() => { jest.advanceTimersByTime(250); });
  expect(view.getByText('Breathe out')).toBeOnTheScreen();
  expect(view.getByTestId('public-help-count')).toHaveTextContent('6 seconds');
  act(() => lifecycle('background'));
  now = 20000; act(() => { jest.advanceTimersByTime(15000); lifecycle('active'); });
  expect(view.getByText('Paused')).toBeOnTheScreen();
  expect(view.getByTestId('public-help-count')).toHaveTextContent('6 seconds');
  fireEvent.press(view.getByRole('button', { name: 'Begin breathing' }));
  now = 20500; act(() => { jest.advanceTimersByTime(500); });
  expect(view.getByTestId('public-help-count')).toHaveTextContent('5 seconds');
  fireEvent.press(view.getByRole('button', { name: 'Pause breathing' }));
  now = 30000; act(() => { jest.advanceTimersByTime(10000); });
  expect(view.getByTestId('public-help-count')).toHaveTextContent('5 seconds');
  fireEvent.press(view.getByRole('button', { name: 'Begin breathing' }));
  mockActive = false; view.rerender(wrap(<BasicHelp onClose={close} />));
  now = 40000; mockActive = true; view.rerender(wrap(<BasicHelp onClose={close} />));
  expect(view.getByText('Paused')).toBeOnTheScreen();
  expect(view.getByTestId('public-help-count')).toHaveTextContent('5 seconds');
  fireEvent.press(view.getByRole('button', { name: 'Close basic help' }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(network).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled(); expect(mockAuth).not.toHaveBeenCalled();
  expect(Haptics.selectionAsync).not.toHaveBeenCalled(); expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  expect(view.queryByRole('button', { name: /finish|save|reward|unlock|subscribe/i })).toBeNull();
  view.unmount(); (AppState as any).currentState = previousState;
});
test('native request-close and accessibility escape only dismiss, and reopening starts with no restored private history', () => {
  const close = jest.fn();
  const view = render(wrap(<BasicHelpPresentation visible onClose={close} />));
  act(() => view.UNSAFE_getByType(Modal).props.onRequestClose());
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent(view.getByTestId('public-basic-help'), 'accessibilityEscape');
  expect(close).toHaveBeenCalledTimes(2);
  view.rerender(wrap(<BasicHelpPresentation visible={false} onClose={close} />));
  view.rerender(wrap(<BasicHelpPresentation visible onClose={close} />));
  expect(view.getByText('Paused')).toBeOnTheScreen();
  expect(view.getByTestId('public-help-count')).toHaveTextContent('4 seconds');
});
test('account help does not release the active account fence or accept a late owner as entry completion', async () => {
  const connected = jest.fn(), skip = jest.fn();
  const { createAccountFlowFence } = require('@/lib/user-journey');
  const fence = createAccountFlowFence();
  const props = {visible: true, requiredEntry: true, onConnected: connected, onSkip: skip, onFlowInteraction: () => fence.begin()};
  const view = render(wrap(<AccountAccessHost {...props} />)); await act(async () => {});
  fireEvent.press(view.getByRole('button', {name: 'Create account with email'}));
  fireEvent.changeText(view.getByLabelText('Email address'), 'draft@example.com');
  fireEvent.press(view.getByRole('button', {name: 'Help / SOS'}));
  mockUid = 'different-owner'; view.rerender(wrap(<AccountAccessHost {...props} authUnavailableReason="Restore unavailable" />));
  expect(view.getByText('Basic help')).toBeOnTheScreen(); expect(fence.isActive()).toBe(true);
  const modals = view.UNSAFE_getAllByType(Modal);
  act(() => modals[modals.length - 1].props.onRequestClose());
  expect(fence.isActive()).toBe(true); expect(connected).not.toHaveBeenCalled(); expect(skip).not.toHaveBeenCalled();
  expect(view.getByLabelText('Email address')).toBeOnTheScreen();
});
test.each(Object.keys(localeResources))('public semantic copy and numeric plurality render in %s', async language => {
  await appI18n.changeLanguage(language);
  const registry = JSON.parse(readFileSync('src/i18n/public-help-catalog.json', 'utf8'));
  for (const key of Object.keys(registry)) {
    const translation = appI18n.t(`publicHelp.${key}`);
    expect(translation).not.toBe(`publicHelp.${key}`); expect(translation.trim()).not.toBe('');
    if (language !== 'en') expect(translation).not.toBe(registry[key]);
  }
  const view = render(wrap(<BasicHelp onClose={jest.fn()} />));
  expect(view.getByRole('button', {name: appI18n.t('publicHelp.close')})).toBeOnTheScreen();
  expect(view.getByTestId('public-basic-help').props.style.direction).toBe(language === 'ar' ? 'rtl' : 'ltr');
  expect(appI18n.t('momentum.breathingSeconds', {count: 1})).not.toContain('{{');
  expect(appI18n.t('momentum.breathingSeconds', {count: 4})).not.toContain('{{');
});
// Execute the production public screen components rather than duplicate their entry labels.
function authoredEntry(name: 'SplashScreen' | 'WelcomeScreen') {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\nfunction ', start + 1);
  const compiled = transpileModule(`${source.slice(start,end)}; return ${name};`, {compilerOptions: {jsx: JsxEmit.React, module: ModuleKind.CommonJS}}).outputText;
  const dependencies = {React, View, Text, Pressable, ScrollView, useTranslation: () => ({t: appI18n.t.bind(appI18n)}), useAppTheme: () => ({colors: {}, typography: {}}), useWindowDimensions: () => ({width: 320, height: 568, fontScale: 2}), AppBackground: View, SafeAreaView: View, MomentumCompanion: () => null, BrandLogo: () => null, OnboardingPreferences: () => null, FreedLogo: () => null, ActivityIndicator: () => null, useInitialRoute: () => {}, PillButton: ({label,onPress}: any) => <Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>};
  return new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
}
test.each(['hydrating', 'no-owner', 'new-account'])('actual public entry exposes help in %s while protected routes stay guarded', state => {
  const Entry = authoredEntry(state === 'hydrating' ? 'SplashScreen' : 'WelcomeScreen');
  const onHelp = jest.fn(), onDone = jest.fn(), onStart = jest.fn(), onSkip = jest.fn();
  const view = render(<Entry hold onDone={onDone} onStart={onStart} onSkip={onSkip} onHelp={onHelp} />);
  fireEvent.press(view.getByRole('button', {name:'Help / SOS'}));
  expect(onHelp).toHaveBeenCalledTimes(1); expect(onDone).not.toHaveBeenCalled(); expect(onStart).not.toHaveBeenCalled(); expect(onSkip).not.toHaveBeenCalled();
});

import { PremiumOffer } from '@/components/PremiumOffer';
test.each(['loading', 'error'] as const)('unacknowledged %s offer exposes Help without checkout, restore or offer acknowledgement', status => {
  const subscribe = jest.fn(), restore = jest.fn(), acknowledge = jest.fn();
  function Offer() {
    const [help, setHelp] = React.useState(false);
    return <><PremiumOffer plans={[]} selectedPlan="yearly" onSelectPlan={jest.fn()} onSubscribe={subscribe} onClose={acknowledge} onRestore={restore} onManage={jest.fn()} canManage={false} onRetryPrices={jest.fn()} priceStatus={status} busy terms="Store confirms terms" onHelp={() => setHelp(true)} /><BasicHelpPresentation visible={help} onClose={() => setHelp(false)} /></>;
  }
  const view = render(wrap(<Offer />));
  fireEvent.press(view.getByRole('button', {name: 'Help / SOS'}));
  expect(view.getByText('Basic help')).toBeOnTheScreen();
  fireEvent.press(view.getByRole('button', {name: 'Close basic help'}));
  expect(view.getByRole('button', {name: 'Help / SOS'})).toBeOnTheScreen();
  expect(subscribe).not.toHaveBeenCalled(); expect(restore).not.toHaveBeenCalled(); expect(acknowledge).not.toHaveBeenCalled(); expect(mockAuth).not.toHaveBeenCalled();
});

test('a delayed Welcome Help tap cannot replace an account presentation that has already claimed its draft', () => {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const start = source.indexOf('  const renderScreen = (screen: Screen');
  const guardEnd = source.indexOf('    const backFromFeature', start);
  const welcome = source.indexOf('    if (screen === "welcome")', start);
  const quiz = source.indexOf('    if (screen === "quiz")', welcome);
  const compiled = transpileModule(`${source.slice(start,guardEnd)} ${source.slice(welcome,quiz)} return null; }; return renderScreen;`, {compilerOptions: {jsx: JsxEmit.React, module: ModuleKind.CommonJS}}).outputText;
  const {createAccountFlowFence} = require('@/lib/user-journey');
  const accountFlowFence = {current: createAccountFlowFence()};
  const publicHelp = jest.fn();
  const dependencies = {showAccountCleanupRecovery:false,rollbackPending:false,privateViewLocked:false,React,guardJourneyRoute,accountFlowFence,setPublicBasicHelp:publicHelp,WelcomeScreen:authoredEntry('WelcomeScreen'),getJourneyPolicy:() => ({auth:{status:'ready',signedIn:false,anonymous:false,ownerUid:null,email:null},journey:{entry:null,introCompletedAt:null},offerAcknowledged:false,verifiedPremium:false}),setQuizIndex:jest.fn(),setRecoveryState:jest.fn(),setScreen:jest.fn(),setAccountReturnToProfile:jest.fn(),enterAccountFlow:() => accountFlowFence.current.begin()};
  const route = new Function(...Object.keys(dependencies),compiled)(...Object.values(dependencies));
  const view = render(route('welcome','today'));
  accountFlowFence.current.begin();
  fireEvent.press(view.getByRole('button',{name:'Help / SOS'}));
  expect(publicHelp).not.toHaveBeenCalled(); expect(accountFlowFence.current.isActive()).toBe(true);
});
test('an outer account native Back delivered during help closes help without clearing the form', async () => {
  const skip = jest.fn(), connected = jest.fn();
  const view = render(wrap(<AccountAccessHost visible requiredEntry onSkip={skip} onConnected={connected} />)); await act(async () => {});
  fireEvent.press(view.getByRole('button', {name:'Create account with email'}));
  const email = view.getByLabelText('Email address');
  fireEvent.changeText(email,'draft@example.com');
  fireEvent.press(view.getByRole('button', {name:'Help / SOS'}));
  act(() => view.UNSAFE_getAllByType(Modal)[0].props.onRequestClose());
  expect(view.getByLabelText('Email address')).toBe(email);
  expect(skip).not.toHaveBeenCalled(); expect(connected).not.toHaveBeenCalled();
});
