import React from 'react';
import { AppState, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { configureNativeMonetizationBuild, configureNativeMonetizationProvider } from '@/lib/monetization';
import { createNativeSdkMonetizationProvider } from '@/lib/native-monetization-runtime';
import { useGuidedResetAccess } from '@/hooks/useGuidedResetAccess';
import { GuidedResetOffer } from '@/components/GuidedResetOffer';
import type { GuidedTier } from '@/lib/guided-reset-access';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
let mockOwner: string | null = 'owner';
let mockId = 0;
let fixtureProvider: Awaited<ReturnType<typeof createNativeSdkMonetizationProvider>>;
let mockRefresh: jest.Mock;
jest.mock('expo-crypto', () => ({ randomUUID: () => `session-${++mockId}` }));
jest.mock('@/lib/firebase-native', () => ({ getFirebaseAccountScope: () => mockOwner }));
jest.mock('@/design-system/use-app-theme', () => ({ useAppTheme: () => ({ colors: { text: '#111', text2: '#444', accent: '#2233cc', onAccent: '#fff', surface: '#fafafa', bg: '#fff' }, typography: { bold: '700' } }) }));
jest.mock('@/components/MomentumPageHeader', () => ({ MomentumPageHeader: ({ title, description }: any) => { const { Text } = require('react-native'); return <><Text>{title}</Text><Text>{description}</Text></>; } }));
const recommendation = { id: 'breathe', title: 'Breathe slowly', category: 'breathing' as const, durationSec: 60, intensity: 'calm' as const, premium: false, icon: 'Waves', why: 'One quiet minute.', steps: ['Inhale slowly.', 'Exhale slowly.'] };
function Screen({ tier = 'free', owner = 'owner', onDone, onHelp = () => { }, active = true, contextKey = 'a', checking = false, offerEligible }: {
    offerEligible?: () => boolean;
    tier?: GuidedTier;
    owner?: string;
    onDone: () => void;
    onHelp?: () => void;
    active?: boolean;
    contextKey?: string;
    checking?: boolean;
}) {
    mockOwner = owner;
    const access = useGuidedResetAccess(owner, tier, 'android', active, contextKey, undefined, {refreshEligibility:()=>mockRefresh(),isChecking:()=>checking});
    return <><GuidedResetOffer tier={access.accessUnavailable ? "unknown" : tier} protectionOrigin challenge={recommendation} busy={access.busy} cleanupPending={access.cleanupPending} onRetryCleanup={()=>{}} notice={access.notice} repairNeeded={access.repairNeeded} resumable={Boolean(access.grant)} diagnostic={access.diagnostic} adPrivacyRequired={access.adPrivacyRequired} adPrivacyBusy={access.adPrivacyBusy} onAdPrivacyOptions={access.openAdPrivacyOptions} adPrivacyNotice={access.adPrivacyNotice} onStart={() => { if (access.grant || access.startLicensed())
        onDone(); }} onWatch={() => { void access.watch(offerEligible).then(ok => { if (ok)
        onDone(); }); }} onRepair={() => { if (access.repair())
        onDone(); }} onRetry={() => { }} onPro={() => { access.invalidate(); }} onSafety={() => { access.clear(); onHelp(); }} onHelp={() => { access.invalidate(); onHelp(); }}/>{access.grant ? <Text testID="grant">{access.grant.sessionId}</Text> : null}</>;
}
let privacyRequired = false, privacyCalls = 0, privacyFails = false, consentFails = false, currentConsent: unknown = {canRequestAds:true}, earlyError: unknown = null, splitConsent = false;
let requests = 0, loads = 0, shows = 0, failStorage = false, delayedConsent = false, showFails = false;
let resolveConsent: (value: unknown) => void;
let events: Map<string, Set<() => void>>;
let appListeners: Set<(state: any) => void>;
const saved = new Map<string, string>();
const environment = { ...process.env };
const emit = (name: string) => [...(events.get(name) ?? [])].forEach(fn => fn());
const lifecycle = (state: string) => { Object.defineProperty(AppState, 'currentState', { configurable: true, value: state }); appListeners.forEach(fn => fn(state)); };
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
beforeEach(async () => {
    jest.useFakeTimers();
    mockOwner = 'owner'; mockRefresh = jest.fn().mockResolvedValue('free');
    mockId = 0;
    requests = loads = shows = 0; privacyRequired=false; privacyCalls=0; privacyFails=false;consentFails=false;earlyError=null;splitConsent=false;currentConsent={canRequestAds:true};
    failStorage = false;
    delayedConsent = false; showFails = false;
    saved.clear();
    events = new Map();
    appListeners = new Set();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => { if (failStorage)
                throw Error('disk'); saved.set(k, v); }, removeItem: (k: string) => { if (failStorage)
                throw Error('disk'); saved.delete(k); } } });
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => { appListeners.add(fn); return { remove: () => { appListeners.delete(fn); } }; });
    lifecycle('active');
    configureNativeMonetizationBuild(false);
    Object.assign(process.env, { NODE_ENV: 'production', EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight', EXPO_PUBLIC_MONETIZATION_MODE: 'native', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true', EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: 'ca-app-pub-1234567890123456~1234567890' });
    const provider = await createNativeSdkMonetizationProvider({ platform: 'android', loader: async (name) => name === 'react-native-google-mobile-ads' ? { default: () => ({ initialize: async () => { } }), AdsConsent: { requestInfoUpdate: async () => { if(consentFails) throw {code:'consent-update-failed',message:'PRIVATE'}; return {canRequestAds:true}; }, loadAndShowConsentFormIfRequired: () => delayedConsent ? new Promise(resolve => { resolveConsent = resolve; }) : Promise.resolve({canRequestAds:true}), getConsentInfo: async () => ({...currentConsent as object,privacyOptionsRequirementStatus:privacyRequired?'REQUIRED':'NOT_REQUIRED'}), showPrivacyOptionsForm: async () => { privacyCalls++;if(privacyFails)throw Error('PRIVATE');return {canRequestAds:false}; } }, TestIds: { REWARDED: 'ca-app-pub-3940256099942544/5224354917' }, RewardedAd: { createForAdRequest: (_id: string, options: any) => { requests++; expect(options).toEqual({ requestNonPersonalizedAdsOnly: true, networkExtras: { ft_ctype: 'video_app_install' } }); return { load: () => { loads++; if(earlyError)[...(events.get('error')??[])].forEach(fn=>(fn as any)(earlyError)); }, show: async () => { shows++; if (showFails) throw Error("show failed"); }, addAdEventListener: (type: string, fn: () => void) => { if (!events.has(type))
                        events.set(type, new Set()); events.get(type)!.add(fn); return () => events.get(type)?.delete(fn); }, removeAllListeners: () => events.clear() }; } } } : null });
    fixtureProvider = provider; configureNativeMonetizationProvider(provider);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); configureNativeMonetizationProvider(null); configureNativeMonetizationBuild(null); for (const key of Object.keys(process.env))
    if (!(key in environment))
        delete process.env[key]; Object.assign(process.env, environment); });
const watch = (screen: any) => fireEvent.press(screen.getByRole('button', { name: 'Watch one ad — start this guided challenge' }));
test.each(['free', 'paid', 'review', 'unknown'] as const)('%s offer does not load ads on mount; basic Help now is independent', async (tier) => {
    const done = jest.fn(), help = jest.fn();
    const screen = render(<Screen tier={tier} onDone={done} onHelp={help}/>);
    await flush();
    expect(requests).toBe(0);
    expect(done).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Help now' }));
    expect(help).toHaveBeenCalledTimes(1);
    expect(requests).toBe(0);
    if (tier === 'unknown')
        expect(screen.queryByRole('button', { name: 'Watch one ad — start this guided challenge' })).toBeNull();
    if (tier === 'review')
        expect(screen.getByText('Review access')).toBeTruthy();
});
test.each(['paid', 'review'] as const)('%s Start persists licensed session access with no ad', async (tier) => { const done = jest.fn(); const screen = render(<Screen tier={tier} onDone={done}/>); fireEvent.press(screen.getByRole('button', { name: 'Start challenge' })); await flush(); expect(done).toHaveBeenCalledTimes(1); expect(saved.size).toBe(1); expect(requests).toBe(0); });
test('explicit rapid watch uses one actual provider load/show and earned+closed callback', async () => { const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); expect(requests).toBe(1); expect(loads).toBe(1); expect(shows).toBe(0); act(() => emit('rewarded_loaded')); await flush(); expect(shows).toBe(1); act(() => { emit('rewarded_earned_reward'); emit('closed'); }); await flush(); expect(done).toHaveBeenCalledTimes(1); expect(screen.getByTestId('grant')).toBeTruthy(); expect(saved.size).toBe(1); });
test.each(['closed', 'error'])('%s without earned proof leaves Help now and cannot grant', async (event) => { const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); act(() => emit('rewarded_loaded')); await flush(); act(() => emit(event)); await flush(); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0); expect(screen.getByRole('button', { name: 'Help now' })).toBeTruthy(); });
test.each(['help', 'unmount', 'paid', 'unknown', 'owner', 'background', 'departure'])('pending ad cannot show after %s', async (reason) => { const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); if (reason === 'help')
    fireEvent.press(screen.getByRole('button', { name: 'Help now' })); if (reason === 'unmount')
    screen.unmount(); if (reason === 'paid' || reason === 'unknown')
    screen.rerender(<Screen tier={reason} onDone={done}/>); if (reason === 'owner')
    screen.rerender(<Screen owner="other" onDone={done}/>); if (reason === 'background')
    act(() => lifecycle('background')); if (reason === 'departure')
    screen.rerender(<Screen active={false} onDone={done}/>); act(() => emit('rewarded_loaded')); await flush(); expect(shows).toBe(0); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0); });
test('SDK Activity background preserves actual reward until foreground save without second ad', async () => { const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); act(() => emit('rewarded_loaded')); await flush(); act(() => lifecycle('background')); act(() => jest.advanceTimersByTime(45000)); act(() => { emit('rewarded_earned_reward'); emit('closed'); }); await flush(); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0); act(() => lifecycle('active')); await flush(); fireEvent.press(screen.getByRole('button', { name: 'Retry saving access' })); await flush(); expect(done).toHaveBeenCalledTimes(1); expect(requests).toBe(1); expect(saved.size).toBe(1); });
test('disk failure retains genuine reward and repair persists without re-showing', async () => { const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); act(() => emit('rewarded_loaded')); await flush(); failStorage = true; act(() => { emit('rewarded_earned_reward'); emit('closed'); }); await flush(); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0); failStorage = false; fireEvent.press(screen.getByRole('button', { name: 'Retry saving access' })); await flush(); expect(done).toHaveBeenCalledTimes(1); expect(requests).toBe(1); });
test('consent cancellation and no inventory never produce access', async () => { delayedConsent = true; const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); fireEvent.press(screen.getByRole('button', { name: 'Help now' })); await act(async () => resolveConsent({ canRequestAds: false })); expect(loads).toBe(0); expect(shows).toBe(0); expect(done).not.toHaveBeenCalled(); });
test('premature earned event or 120-second timeout cannot manufacture completion', async () => { const done = jest.fn(); const screen = render(<Screen onDone={done}/>); watch(screen); await flush(); act(() => emit('rewarded_earned_reward')); act(() => emit('rewarded_loaded')); await flush(); act(() => jest.advanceTimersByTime(120001)); await flush(); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0); act(() => { emit('rewarded_earned_reward'); emit('closed'); }); await flush(); expect(saved.size).toBe(0); });

test.each(['owner', 'paid', 'departure', 'unmount'])('presentation cannot grant after %s invalidates its authority', async reason => {
 const done=jest.fn(); const screen=render(<Screen onDone={done}/>); watch(screen); await flush(); act(()=>emit('rewarded_loaded')); await flush();
 if(reason==='owner') screen.rerender(<Screen owner="other" onDone={done}/>);
 if(reason==='paid') screen.rerender(<Screen tier="paid" onDone={done}/>);
 if(reason==='departure') screen.rerender(<Screen active={false} onDone={done}/>);
 if(reason==='unmount') screen.unmount();
 act(()=>{emit('rewarded_earned_reward');emit('closed')}); await flush(); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0);
});
test('thrown SDK show ends presentation and cannot make subsequent background reward eligible', async()=>{
 showFails=true;const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();act(()=>emit('rewarded_loaded'));await flush();act(()=>lifecycle('background'));act(()=>{emit('rewarded_earned_reward');emit('closed')});await flush();expect(done).not.toHaveBeenCalled();expect(saved.size).toBe(0);
});
test('timeout after real earned callback still cannot synthesize SDK dismissal',async()=>{
 const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();act(()=>emit('rewarded_loaded'));await flush();act(()=>emit('rewarded_earned_reward'));act(()=>jest.advanceTimersByTime(120001));await flush();expect(done).not.toHaveBeenCalled();expect(saved.size).toBe(0);
});

test.each(['context','paid','review','departure','help'])('earned disk-failure repair remains invalid after %s away-and-back', async reason => {
 const done=jest.fn(); const screen=render(<Screen onDone={done}/>); watch(screen); await flush(); act(()=>emit('rewarded_loaded')); await flush(); failStorage=true;
 act(()=>{emit('rewarded_earned_reward');emit('closed')}); await flush(); const retry=screen.UNSAFE_getByType(GuidedResetOffer).props.onRepair; failStorage=false;
 if(reason==='context') screen.rerender(<Screen contextKey="b" onDone={done}/>);
 if(reason==='paid'||reason==='review') screen.rerender(<Screen tier={reason} onDone={done}/>);
 if(reason==='departure') screen.rerender(<Screen active={false} onDone={done}/>);
 if(reason==='help') fireEvent.press(screen.getByRole('button',{name:'Help now'}));
 screen.rerender(<Screen onDone={done}/>); act(()=>retry()); await flush(); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0);
});
test('earned SDK foreground repair cannot survive changing interception while backgrounded',async()=>{
 const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();act(()=>emit('rewarded_loaded'));await flush();act(()=>lifecycle('background'));act(()=>{emit('rewarded_earned_reward');emit('closed')});await flush();
 const retry=screen.UNSAFE_getByType(GuidedResetOffer).props.onRepair;screen.rerender(<Screen contextKey="b" onDone={done}/>);screen.rerender(<Screen onDone={done}/>);act(()=>lifecycle('active'));act(()=>retry());await flush();expect(done).not.toHaveBeenCalled();expect(saved.size).toBe(0);
});
test('restored pending cleanup offers only cleanup retry and basic help, never a new ad',async()=>{
 saved.set('freed.guided.access.v1.owner',JSON.stringify({version:1,ownerUid:'owner',sessionId:'pending',kind:'paid',state:'discarding',createdAt:Date.now()}));
 const screen=render(<Screen onDone={jest.fn()}/>);await flush();expect(screen.getByRole('button',{name:'Retry discarding saved reset'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Watch one ad — start this guided challenge'})).toBeNull();expect(requests).toBe(0);
});

test.each(['paid','review','unknown','failure'])('fresh explicit-Watch %s classification blocks all SDK creation',async classification=>{
 if(classification==='failure')mockRefresh.mockRejectedValue(Error('offline'));else mockRefresh.mockResolvedValue(classification);
 const done=jest.fn();const screen=render(<Screen onDone={done}/>);expect(mockRefresh).not.toHaveBeenCalled();watch(screen);await flush();expect(mockRefresh).toHaveBeenCalledTimes(1);expect(requests).toBe(0);expect(loads).toBe(0);expect(shows).toBe(0);expect(done).not.toHaveBeenCalled();
 if(classification==='unknown'||classification==='failure')expect(screen.getByRole('button',{name:'Retry access check'})).toBeTruthy();expect(screen.getByRole('button',{name:'Help now'})).toBeTruthy();
});
test('fresh eligibility read is bounded to eight seconds and late success cannot request an ad',async()=>{
 let resolve!:(tier:string)=>void;mockRefresh.mockImplementation(()=>new Promise(r=>{resolve=r}));const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();expect(requests).toBe(0);act(()=>jest.advanceTimersByTime(8001));await flush();expect(screen.getByRole('button',{name:'Retry access check'})).toBeTruthy();await act(async()=>resolve('free'));expect(requests).toBe(0);expect(done).not.toHaveBeenCalled();
});
test('consent longer than thirty seconds requires a new free check before load and genuine reward',async()=>{
 delayedConsent=true;const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();expect(requests).toBe(1);act(()=>jest.advanceTimersByTime(31000));await act(async()=>resolveConsent({canRequestAds:true}));await flush();expect(mockRefresh).toHaveBeenCalledTimes(2);expect(loads).toBe(1);act(()=>emit('rewarded_loaded'));await flush();expect(shows).toBe(1);expect(saved.size).toBe(0);act(()=>{emit('rewarded_earned_reward');emit('closed');});await flush();expect(done).toHaveBeenCalledTimes(1);
});
test.each(['paid','review','unknown','failure'])('post-consent %s refresh prevents SDK load',async classification=>{
 delayedConsent=true;const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();if(classification==='failure')mockRefresh.mockRejectedValue(Error('offline'));else mockRefresh.mockResolvedValue(classification);await act(async()=>resolveConsent({canRequestAds:true}));await flush();expect(mockRefresh).toHaveBeenCalledTimes(2);expect(loads).toBe(0);expect(shows).toBe(0);expect(saved.size).toBe(0);
});
test('post-consent eight-second timeout rejects late membership success',async()=>{
 delayedConsent=true;const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();let resolve!:(value:string)=>void;mockRefresh.mockImplementation(()=>new Promise(r=>{resolve=r}));await act(async()=>resolveConsent({canRequestAds:true}));await flush();act(()=>jest.advanceTimersByTime(8001));await flush();expect(screen.getByRole('button',{name:'Retry access check'})).toBeTruthy();await act(async()=>resolve('free'));expect(loads).toBe(0);expect(shows).toBe(0);
});

test('transient checking while SDK is presented does not erase its witnessed reward or require another preflight',async()=>{
 const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();act(()=>emit('rewarded_loaded'));await flush();screen.rerender(<Screen tier="unknown" checking onDone={done}/>);failStorage=true;act(()=>{emit('rewarded_earned_reward');emit('closed')});await flush();expect(screen.getByRole('button',{name:'Retry saving access'})).toBeTruthy();failStorage=false;screen.rerender(<Screen onDone={done}/>);fireEvent.press(screen.getByRole('button',{name:'Retry saving access'}));await flush();expect(done).toHaveBeenCalledTimes(1);expect(mockRefresh).toHaveBeenCalledTimes(2);expect(requests).toBe(1);
});
test('long SDK Activity return retains witnessed proof through refresh failure, then repairs only when Free returns', async () => {
 const done = jest.fn(); const screen = render(<Screen onDone={done}/>);
 watch(screen); await flush(); act(() => emit('rewarded_loaded')); await flush();
 act(() => lifecycle('background')); act(() => jest.advanceTimersByTime(45000));
 act(() => { emit('rewarded_earned_reward'); emit('closed'); }); await flush();
 act(() => lifecycle('active')); screen.rerender(<Screen tier="unknown" checking onDone={done}/>);
 fireEvent.press(screen.getByRole('button', {name:'Retry saving access'})); await flush();
 expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0);
 screen.rerender(<Screen tier="unknown" onDone={done}/>);
 fireEvent.press(screen.getByRole('button', {name:'Retry saving access'})); await flush();
 expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0);
 screen.rerender(<Screen onDone={done}/>);
 fireEvent.press(screen.getByRole('button', {name:'Retry saving access'})); await flush();
 expect(done).toHaveBeenCalledTimes(1); expect(requests).toBe(1); expect(mockRefresh).toHaveBeenCalledTimes(2);
});
test.each(['owner', 'context', 'departure'] as const)('delayed remote preflight and rapid taps create zero SDK requests after %s change', async reason => {
 let resolve!: (value: string) => void;
 mockRefresh.mockImplementation(() => new Promise(r => { resolve = r; }));
 const done = jest.fn(); const screen = render(<Screen onDone={done}/>);
 const onWatch = screen.UNSAFE_getByType(GuidedResetOffer).props.onWatch;
 act(() => { onWatch(); onWatch(); onWatch(); }); await flush();
 expect(mockRefresh).toHaveBeenCalledTimes(1); expect(requests).toBe(0);
 if (reason === 'owner') screen.rerender(<Screen owner="other" onDone={done}/>);
 if (reason === 'context') screen.rerender(<Screen contextKey="b" onDone={done}/>);
 if (reason === 'departure') screen.rerender(<Screen active={false} onDone={done}/>);
 await act(async () => resolve('free'));
 expect(requests).toBe(0); expect(loads).toBe(0); expect(shows).toBe(0); expect(done).not.toHaveBeenCalled(); expect(saved.size).toBe(0);
});

test('selected offer expiring during membership refresh prevents every SDK request',async()=>{
 let finishRefresh:(tier:GuidedTier)=>void=()=>{};mockRefresh.mockImplementation(()=>new Promise(resolve=>{finishRefresh=resolve;}));const deadline=Date.now()+8000;
 const screen=render(<Screen onDone={jest.fn()} offerEligible={()=>Date.now()<deadline}/>);watch(screen);await flush();act(()=>jest.advanceTimersByTime(7000));await act(async()=>{jest.setSystemTime(deadline+1);finishRefresh('free');});await flush();expect(requests).toBe(0);expect(shows).toBe(0);
});
test('actual final SDK presentation check rejects offer expiry during loading',async()=>{
 let eligible=true;const done=jest.fn();const screen=render(<Screen onDone={done} offerEligible={()=>eligible}/>);watch(screen);await flush();expect(requests).toBe(1);eligible=false;act(()=>emit('rewarded_loaded'));await flush();expect(shows).toBe(0);expect(done).not.toHaveBeenCalled();
});
test('a genuine SDK reward remains guided access when its offer expires after presentation',async()=>{
 let eligible=true;const done=jest.fn();const screen=render(<Screen onDone={done} offerEligible={()=>eligible}/>);watch(screen);await flush();act(()=>emit('rewarded_loaded'));await flush();expect(shows).toBe(1);eligible=false;act(()=>{emit('rewarded_earned_reward');emit('closed');});await flush();expect(done).toHaveBeenCalledTimes(1);expect(requests).toBe(1);
});

test('SDK-required privacy options work outside guided activity for paid users, without ad creation',async()=>{
 privacyRequired=true;const screen=render(<Screen tier="paid" active={false} onDone={jest.fn()}/>);await flush();
 fireEvent.press(screen.getByRole('button',{name:'Ad privacy options'}));await flush();expect(privacyCalls).toBe(1);expect(requests).toBe(0);expect(saved.size).toBe(0);
 privacyFails=true;fireEvent.press(screen.getByRole('button',{name:'Ad privacy options'}));await flush();expect(screen.getByRole('alert')).toHaveTextContent('Ad privacy options could not open. Try again.');expect(requests).toBe(0);
});
test('an early native load error is recorded without private SDK text and Retry remains available',async()=>{
 earlyError={code:'googleMobileAds/no-fill',message:'PRIVATE secret identifier',stack:'PRIVATE'};const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();expect(shows).toBe(0);expect(screen.getByText(/load.*no-fill/)).toBeTruthy();expect(screen.queryByText(/PRIVATE/)).toBeNull();expect(screen.getByRole('button',{name:'Watch one ad — start this guided challenge'})).toBeEnabled();
});
test('native consent form inactive return survives only until fresh foreground validation',async()=>{
 delayedConsent=true;const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();act(()=>lifecycle('inactive'));await flush();expect(screen.getByRole('button',{name:'Preparing your ad…'})).toBeDisabled();act(()=>jest.advanceTimersByTime(31000));act(()=>lifecycle('active'));await act(async()=>resolveConsent({canRequestAds:true}));await flush();expect(loads).toBe(1);expect(mockRefresh).toHaveBeenCalledTimes(2);act(()=>emit('rewarded_loaded'));await flush();act(()=>{emit('rewarded_earned_reward');emit('closed');});await flush();expect(done).toHaveBeenCalledTimes(1);
});
test('actual background during consent cancels even after returning to foreground',async()=>{
 delayedConsent=true;const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();act(()=>lifecycle('background'));act(()=>lifecycle('active'));await act(async()=>resolveConsent({canRequestAds:true}));await flush();expect(loads).toBe(0);expect(shows).toBe(0);expect(saved.size).toBe(0);
});

test.each(['owner','context','departure','background'])('pending fresh access rejects %s change and late success',async reason=>{
 delayedConsent=true;const done=jest.fn();const screen=render(<Screen onDone={done}/>);watch(screen);await flush();let resolve!:(tier:string)=>void;mockRefresh.mockImplementation(()=>new Promise(r=>{resolve=r}));await act(async()=>resolveConsent({canRequestAds:true}));await flush();
 if(reason==='owner')screen.rerender(<Screen owner="other" onDone={done}/>);
 if(reason==='context')screen.rerender(<Screen contextKey="b" onDone={done}/>);
 if(reason==='departure')screen.rerender(<Screen active={false} onDone={done}/>);
 if(reason==='background')act(()=>lifecycle('background'));
 await act(async()=>resolve('free'));expect(loads).toBe(0);expect(shows).toBe(0);expect(done).not.toHaveBeenCalled();
});
test('fresh post-consent membership expiring before show remains denied',async()=>{
 const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();act(()=>jest.setSystemTime(Date.now()+31000));act(()=>emit('rewarded_loaded'));await flush();expect(shows).toBe(0);expect(saved.size).toBe(0);
});
test('load deadline has an actionable stage and ignores late loaded and reward callbacks',async()=>{
 const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();act(()=>jest.advanceTimersByTime(10001));await flush();expect(screen.getByTestId('rewarded-ad-diagnostic')).toHaveTextContent(/load\/timeout/);act(()=>{emit('rewarded_loaded');emit('rewarded_earned_reward');emit('closed');});await flush();expect(shows).toBe(0);expect(saved.size).toBe(0);
});
test('privacy choices cannot open from actual background and never trigger reward work',async()=>{
 privacyRequired=true;const screen=render(<Screen tier="paid" active={false} onDone={jest.fn()}/>);await flush();act(()=>lifecycle('background'));fireEvent.press(screen.getByRole('button',{name:'Ad privacy options'}));await flush();expect(privacyCalls).toBe(0);expect(requests).toBe(0);
});
test('native current consent false after update failure cannot initialize or load',async()=>{
 consentFails=true;currentConsent={canRequestAds:false};const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();expect(loads).toBe(0);expect(shows).toBe(0);expect(screen.getByTestId('rewarded-ad-diagnostic')).toHaveTextContent(/consent-current\/not-permitted/);
});

test('consent completion arriving before active AppState waits for foreground before fresh access',async()=>{
 delayedConsent=true;const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();act(()=>lifecycle('inactive'));await act(async()=>resolveConsent({canRequestAds:true}));await flush();expect(loads).toBe(0);expect(mockRefresh).toHaveBeenCalledTimes(1);act(()=>lifecycle('active'));await flush();expect(loads).toBe(1);expect(mockRefresh).toHaveBeenCalledTimes(2);
});

test('consent return timeout stays cancelled after a late foreground event',async()=>{
 delayedConsent=true;const screen=render(<Screen onDone={jest.fn()}/>);watch(screen);await flush();act(()=>lifecycle('inactive'));await act(async()=>resolveConsent({canRequestAds:true}));act(()=>jest.advanceTimersByTime(8001));await flush();act(()=>lifecycle('active'));await flush();expect(loads).toBe(0);expect(shows).toBe(0);expect(saved.size).toBe(0);
});

test('required privacy entry appears when native provider finishes importing after a paid screen mounts',async()=>{
 privacyRequired=true;configureNativeMonetizationProvider(null);const screen=render(<Screen tier="paid" active={false} onDone={jest.fn()}/>);await flush();expect(screen.queryByRole('button',{name:'Ad privacy options'})).toBeNull();act(()=>configureNativeMonetizationProvider(fixtureProvider));await flush();expect(screen.getByRole('button',{name:'Ad privacy options'})).toBeTruthy();expect(requests).toBe(0);
});
