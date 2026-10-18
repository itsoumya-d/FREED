import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Text, View, Modal, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FunctionalPaywallScreen } from '@/components/FunctionalPaywallScreen';
import { useInitialRoute } from '@/hooks/use-initial-route';
import { useAppTheme } from '@/design-system/use-app-theme';
import { renderRouter } from 'expo-router/testing-library';
import { Stack, router, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { getFreedFlowPresentation } from '@/lib/flow-presentation';
import { Pressable as LocalizedPressable, Text as LocalizedText } from '@/components/Localized';
import PrivacyRoute from '../../app/privacy';
import { useFreedNavigation } from '@/features/use-freed-navigation';
import { parseFreedRoute } from '@/lib/native-navigation';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { I18nextProvider } from 'react-i18next';
import { appI18n, translateSource } from '@/i18n/runtime';
import { AccountAccessScreen } from '@/components/AccountAccessScreen';
import { AccountAccessHost } from '@/components/AccountAccessHost';
import { BasicHelpPresentation } from '@/components/BasicHelp';
import * as Journey from '@/lib/user-journey';
import { createDefaultRecoveryState, markAccountStepCompleted } from '@/lib/recovery-state';
import { hasVerifiedPremium } from '@/lib/premium-entitlement';
import { retireFirebaseNativeAccountSession, reconcileFirebaseNativeAccountSession } from '@/lib/firebase-native';
jest.mock('expo-symbols', () => ({ SymbolView: () => null, getImageSourceAsync: async () => null }));
jest.mock('expo', () => ({ ...jest.requireActual('expo'), reloadAppAsync: jest.fn().mockResolvedValue(undefined), requireOptionalNativeModule: () => null }));
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSigninButton: Object.assign((props: any) => require('react').createElement(require('react-native').Pressable, props), { Size: { Wide: 1 }, Color: { Dark: 1, Light: 2 } }) }));
jest.mock('expo-apple-authentication', () => ({ AppleAuthenticationButton: () => null, AppleAuthenticationButtonStyle: {}, AppleAuthenticationButtonType: {} }));
jest.mock('@/components/SocialSignInButtons', () => ({ SocialSignInButtons: ({ googleAvailable, appleAvailable, disabled, onGoogle, onApple }: any) => { const React=require('react'); const Pressable=require('react-native').Pressable; const Text=require('react-native').Text; const button=(label:string,onPress:()=>void)=>React.createElement(Pressable,{accessibilityRole:'button',accessibilityLabel:label,onPress},React.createElement(Text,null,label)); return React.createElement(React.Fragment,null,googleAvailable&&!disabled?button('Sign in with Google',onGoogle):null,appleAvailable&&!disabled?button('Continue with Apple',onApple):null); } }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ArrowLeft: () => null, ChevronRight: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: true, spatialMotion: false, reduceMotion: true, focused: true, foreground: true }) }));
let mockUid: string | null = null;
let mockSummary: any;
let mockAuth: Journey.JourneyAuthSnapshot;
const mockListeners = new Set<() => void>();
let mockAdapter: any;
let mockGoogle: any;
let mockRestore = () => {};
jest.mock('@/lib/firebase-native', () => ({ getFirebaseAccountScope: () => mockUid, getFirebaseAccountSummary: () => mockSummary, getFirebaseNativeAuthAdapter: () => mockAdapter, getFirebaseCallableContracts: async () => ({getCheckoutContext: mockCheckout}), startFirebaseClient: async () => ({ status: 'started' }), retireFirebaseNativeAccountSession: jest.fn(), reconcileFirebaseNativeAccountSession: jest.fn(async () => null) }));
const mockCheckout = jest.fn().mockResolvedValue({});
const mockStorePrices = jest.fn().mockResolvedValue([]);
jest.mock('@/lib/monetization', () => ({ ...jest.requireActual('@/lib/monetization'), fetchLaunchStorePrices: (...args: any[]) => mockStorePrices(...args) }));
jest.mock('@/lib/social-login', () => ({ isAppleSignInAvailable: async () => true, isGoogleSignInConfigured: () => true, signInWithGoogle: async () => mockGoogle, signInWithApple: async () => mockGoogle }));
function publish(owner: string | null, status: Journey.JourneyAuthSnapshot['status']='ready') {
  mockUid=owner;
  mockSummary={signedIn:Boolean(owner),anonymous:false,email:owner?'new@example.com':null,emailVerified:false,providers:owner?['password']:[]};
  mockAuth={status,signedIn:Boolean(owner),anonymous:false,ownerUid:owner,email:mockSummary.email,reason:status==='unavailable'?'Restore unavailable. Retry account access.':undefined};
  mockListeners.forEach(listener=>listener());
}
function deferred<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>(done=>{resolve=done;}); return {promise,resolve}; }
function flowHarness({owner=null as string|null, ack=false, checked=null as string|null, screen='account'}={}) {
  publish(owner);
  const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');
  const policyStart=source.indexOf('  const getJourneyPolicy ='), policyEnd=source.indexOf('  React.useEffect(',policyStart);
  const routeStart=source.lastIndexOf('  React.useEffect(',source.indexOf('    const guarded = guardJourneyRoute(screen, policy',policyStart));
  const routeEnd=source.indexOf('\n  const paywallNavigationRef',routeStart);
  const renderStart=source.indexOf('  const renderScreen = (screen: Screen'), renderGuardEnd=source.indexOf('    const backFromFeature',renderStart);
  const accountStart=source.indexOf('    if (screen === "account")',renderStart), accountEnd=source.indexOf('    if (screen === "protectionSetup")',accountStart);
  const splashStart=source.indexOf('    if (screen === "splash")',renderStart), splashEnd=source.indexOf('    if (screen === "welcome")',splashStart);
  const hostStart=source.indexOf('  const renderAccountHost ='),hostEnd=source.indexOf('\n  const renderScreen =',hostStart);
  const fenceStart=source.indexOf('  const accountFlowFence ='), fenceEnd=source.indexOf('  const [accountNotice',fenceStart);
  const fenceCode=fenceStart>=0?source.slice(fenceStart,fenceEnd):'';
  const script=`function Probe({checked,request}) {
    const journeyAuth=React.useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
    const [screen,setRoute]=React.useState(initialScreen); const auxiliaryRoute=null,deferredAuxiliaryRoute=null; const deferAuxiliaryPresentation=()=>{},resumeAuxiliaryPresentation=()=>{}; const setScreen=(next)=>{transitions.push(next);setRoute(next);};
    const [recoveryState,setRecoveryState]=React.useState(initialRecovery); const recoveryStateRef=React.useRef(recoveryState); recoveryStateRef.current=recoveryState;
    const [accountReturnToProfile,setAccountReturnToProfile]=React.useState(false); ${fenceCode}
    const journeyOwner=getJourneyOwner(journeyAuth); const membershipOwnerChecked=checked;
    const journeyOfferStore=React.useRef({has:()=>offerAcknowledged}); const journeyOfferRevision=0;
    const paywallNavigationRef=React.useRef({getOrigin:()=> 'account'});
    React.useEffect(()=>{if(request)setScreen(request);},[request]);
    ${source.slice(policyStart,policyEnd)}
    ${source.slice(routeStart,routeEnd)}
    ${source.slice(hostStart,hostEnd)}
    ${source.slice(renderStart,renderGuardEnd)}
    ${source.slice(splashStart,splashEnd)}
    ${source.slice(accountStart,accountEnd)}
    return <Text testID="route">{screen}</Text>; };
    return <>{renderScreen(screen,'today')}{renderAccountHost()}</>;
  } return Probe;`;
  const compiled=transpileModule(script,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
  const transitions:string[]=[];
  const initialRecovery={...createDefaultRecoveryState(),answers:['a','b','c','d','e'],journey:{entry:'existing',introCompletedAt:null}};
  const dependencies={React,Text,...Journey,AccountAccessScreen,AccountAccessHost,showAccountCleanupRecovery:false,rollbackPending:false,privateViewLocked:false,renderAccountDeletion:()=>null,hydrated:true,initialScreen:screen,initialRecovery,offerAcknowledged:ack,transitions,
    getSnapshot:()=>mockAuth,subscribe:(listener:()=>void)=>{mockListeners.add(listener);return()=>mockListeners.delete(listener);},
    getFirebaseAccountScope:()=>mockUid,getFirebaseAccountSummary:()=>mockSummary,retireFirebaseNativeAccountSession,reconcileFirebaseNativeAccountSession,hasVerifiedPremium,markAccountStepCompleted,
    currentProfileSection:undefined,profileAccountOrigin:{current:null},isProfileAccountOriginCurrent:()=>false,returnFromProfileAccount:()=>false,setTab:()=>{},setProtectionSyncMessage:()=>{},retryFirebaseAuthSnapshot:()=>mockRestore(),signOutRecoveryAccount:async()=>{},
    SplashScreen:({hold,onDone}:any)=>{React.useEffect(()=>{if(!hold)onDone();},[hold]);return <Text testID="checking">Checking startup</Text>;},
  };
  const Probe=new Function(...Object.keys(dependencies),compiled)(...Object.values(dependencies));
  let currentChecked=checked; let request:string|undefined;
  const element=()=> <I18nextProvider i18n={appI18n}><Probe checked={currentChecked} request={request}/></I18nextProvider>;
  const view=render(element());
  return {view,transitions,settle:(uid:string)=>{currentChecked=uid;view.rerender(element());},navigate:(route:string)=>{request=route;view.rerender(element());}};
}
beforeEach(async()=>{
  mockListeners.clear(); publish(null); mockGoogle={ok:false,reason:'cancelled'}; mockRestore=()=>{};
  mockAdapter={getAccountSummary:()=>mockSummary,createEmailAccount:async()=>{publish('owner');return {ok:true,uid:'owner',email:'new@example.com'};},sendEmailVerification:async()=>({ok:true}),reloadAccount:async()=>{mockSummary.emailVerified=true;return{ok:true};},signInWithAppleProvider:async()=>{publish('apple-owner');mockSummary.email=null;mockAuth={...mockAuth,email:null};return{ok:true,uid:'apple-owner'};}};
  await appI18n.changeLanguage('en');
});
async function submitSignup(flow:ReturnType<typeof flowHarness>) {
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  fireEvent.changeText(flow.view.getByLabelText('Email address'),'new@example.com');
  fireEvent.changeText(flow.view.getByLabelText('Password'),'password123');
  fireEvent.changeText(flow.view.getByLabelText('Confirm password'),'password123');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
}
test('Auth owner before verification delivery and membership checking cannot unmount an active signup',async()=>{
  const sent=deferred<{ok:true}>();mockAdapter.sendEmailVerification=()=>sent.promise;
  const flow=flowHarness(); await act(async()=>{}); await submitSignup(flow);
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  expect(retireFirebaseNativeAccountSession).toHaveBeenCalledWith('native-account-flow');
  expect(reconcileFirebaseNativeAccountSession).not.toHaveBeenCalled();
  expect(flow.view.queryByTestId('checking')).toBeNull();
  flow.settle('owner'); await act(async()=>{});
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  await act(async()=>{sent.resolve({ok:true});});
  expect(flow.view.getByRole('button',{name:'Continue and verify later'})).toBeOnTheScreen();
  expect(flow.transitions).not.toContain('paywall');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue and verify later'}));});
  expect(flow.view.getByTestId('route')).toHaveTextContent('paywall');
  expect(flow.transitions.filter(value=>value==='paywall')).toHaveLength(1);
  expect(reconcileFirebaseNativeAccountSession).toHaveBeenCalledTimes(1);
});
test('actual verified/reloaded finish explicitly advances without making verification an auth condition',async()=>{
  const flow=flowHarness({checked:'owner'});await act(async()=>{});await submitSignup(flow);
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:"I've verified my email"}));});
  expect(flow.view.getByTestId('route')).toHaveTextContent('paywall');
});
test('active verify survives a protected deep link and passive auth Retry until explicit continuation',async()=>{
  const flow=flowHarness({checked:'owner'});await act(async()=>{});await submitSignup(flow);
  flow.navigate('main');await act(async()=>{});
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  await act(async()=>{publish('owner','unavailable');});mockRestore=()=>publish('owner');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Retry account access'}));});
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  expect(flow.transitions).not.toContain('paywall');
});
test('a stale signup response after identity switch cannot release the current account flow',async()=>{
  const created=deferred<any>();mockAdapter.createEmailAccount=()=>{publish('owner-a');return created.promise;};
  const flow=flowHarness({checked:'owner-b'});await act(async()=>{});await submitSignup(flow);
  await act(async()=>{publish('owner-b');created.resolve({ok:true,uid:'owner-a',email:'new@example.com'});});
  expect(flow.view.getByRole('alert')).toHaveTextContent(/account changed/i);
  expect(flow.view.getByLabelText('Email address')).toBeOnTheScreen();
  expect(flow.transitions).not.toContain('paywall');
});
test('failed signup remains actionable and provider cancellation requires explicit Back to Welcome',async()=>{
  mockAdapter.createEmailAccount=async()=>({ok:false,reason:'Try a different password'});
  const flow=flowHarness({checked:'owner'});await act(async()=>{});await submitSignup(flow);
  expect(flow.view.getByRole('alert')).toHaveTextContent('Try a different password');
  fireEvent.press(flow.view.getByRole('button',{name:'Back to account options'}));
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Sign in with Google'}));});
  await act(async()=>{publish('owner');});
  expect(flow.view.getByText(/Sign-in cancelled/)).toBeOnTheScreen();
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Back to Welcome'}));});
  expect(flow.view.getByTestId('route')).toHaveTextContent('welcome');
});
test('null-email Apple provider finishes normally while its observer callback is still deferred',async()=>{
  mockAdapter.signInWithAppleProvider=async()=>{mockUid='apple-owner';mockSummary={signedIn:true,anonymous:false,email:null,providers:['apple.com']};return{ok:true,uid:'apple-owner'};};
  const flow=flowHarness({checked:'apple-owner'});await act(async()=>{});
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue with Apple'}));});
  await act(async()=>{publish('apple-owner');mockSummary.email=null;mockAuth={...mockAuth,email:null};});
  expect(flow.view.getByTestId('route')).toHaveTextContent('paywall');
});
test.each([true,false])('cold restored real account retains startup routing (acknowledged=%s)',async(ack)=>{
  const flow=flowHarness({owner:'owner',checked:'owner',ack,screen:'splash'});await act(async()=>{});
  expect(flow.view.getByTestId('route')).toHaveTextContent(ack?'main':'paywall');
});
test('passive restoration Retry without sign-in interaction still auto advances',async()=>{
  const flow=flowHarness({checked:'owner',ack:true});await act(async()=>{publish(null,'unavailable');});
  mockRestore=()=>publish('owner');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Retry account access'}));});
  expect(flow.view.getByTestId('route')).toHaveTextContent('main');
});

test('Back to account options keeps a connected verification flow until explicit Continue',async()=>{
  const flow=flowHarness({checked:'owner'}); await act(async()=>{}); await submitSignup(flow);
  fireEvent.press(flow.view.getByRole('button',{name:'Back to account options'})); await act(async()=>{});
  expect(flow.view.getByText('Your account is connected')).toBeOnTheScreen();
  expect(flow.transitions).not.toContain('paywall');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue'}));});
  expect(flow.view.getByTestId('route')).toHaveTextContent('paywall');
});
test('an owner switch during Verify rejects explicit finish and preserves unfinished account access',async()=>{
  const flow=flowHarness({checked:'owner-b'}); await act(async()=>{}); await submitSignup(flow);
  await act(async()=>{publish('owner-b');});
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue and verify later'}));});
  expect(flow.view.getByRole('alert')).toHaveTextContent(/account changed/i);
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  expect(flow.transitions).not.toContain('paywall');
});


// The production failure this catches is putting the account widget under a
// route leaf: Expo replace/push creates a new leaf and destroys its async/drafts.
function remountFlowHarness({checked=null as string|null, initialUrl="/flow/account", owner=null as string|null, status="ready" as Journey.JourneyAuthSnapshot["status"], entry="existing" as "existing"|"new", nativeLegalRoutes=false}={}) {
  publish(owner,status);
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const policyStart = source.indexOf('  const getJourneyPolicy ='), policyEnd = source.indexOf('  React.useEffect(', policyStart);
  const routeStart = source.lastIndexOf('  React.useEffect(', source.indexOf('    const guarded = guardJourneyRoute(screen, policy', policyStart));
  const routeEnd = source.indexOf('\n  const paywallNavigationRef', routeStart);
  const renderStart = source.indexOf('  const renderScreen = (screen: Screen'), renderGuardEnd = source.indexOf('    const backFromFeature', renderStart);
  const accountStart = source.indexOf('    if (screen === "account")', renderStart), accountEnd = source.indexOf('    if (screen === "protectionSetup")', accountStart);
  const fenceStart = source.indexOf('  const accountFlowFence ='), fenceEnd = source.indexOf('  const [accountNotice', fenceStart);
  const hostStart = source.indexOf('  const renderAccountHost ='), hostEnd = source.indexOf('\n  const renderScreen =', hostStart);
  const providerStart = source.indexOf('    <FreedAppContext.Provider value={{ renderScreen,');
  const providerEnd = source.indexOf('\n      <Modal visible={confirmingDeletion}', providerStart);
  const publicStart = source.indexOf('  const [publicBasicHelp,');
  const publicState = source.slice(publicStart,source.indexOf('\n',publicStart));
  const memberStart = source.indexOf('  const [journeyMembership,');
  const memberEnd = source.indexOf('  const [journeyRecoverySaveNotice',memberStart);
  const offerStart = source.indexOf('  const journeyOfferStore =');
  const offerEnd = source.indexOf('  const [journeyMembership,',offerStart);
  const splashStart = source.indexOf('    if (screen === "splash")',renderStart);
  const quizStart = source.indexOf('    if (screen === "quiz")',splashStart);
  const paywallStart = source.indexOf('    if (screen === "paywall")',renderStart);
  const offerActionStart = source.indexOf('  const acknowledgeJourneyOffer =');
  const offerActionEnd = source.indexOf('\n  React.useEffect(',offerActionStart);
  // Execute production state, guarded entry branches and provider placement alongside the navigator.
  const providerBody = source.slice(providerStart, providerEnd);
  let controls:any;
  const script = `function App({children}) {
    const journeyAuth=React.useSyncExternalStore(subscribe,getSnapshot,getSnapshot);
    ${publicState}
    const {screen,setScreen,setTab,auxiliaryRoute,deferredAuxiliaryRoute,deferAuxiliaryPresentation,resumeAuxiliaryPresentation}=useFreedNavigation();
    const [recoveryState,setRecoveryState]=React.useState(initialRecovery); const recoveryStateRef=React.useRef(recoveryState); recoveryStateRef.current=recoveryState;
    const [accountReturnToProfile,setAccountReturnToProfile]=React.useState(false);
    ${source.slice(fenceStart,fenceEnd)}
    ${source.slice(memberStart,memberEnd)}
    React.useEffect(()=>{if(checkedOwner)setJourneyMembership({ownerUid:checkedOwner,status:"free"});},[]);
    ${source.slice(offerStart,offerEnd)}
    captureControls({enterAccountFlow,beginAccountFlow,setScreen,accountFlowFence,setJourneyMembership,publicBasicHelp,journeyOfferStore});
    const journeyOwner=getJourneyOwner(journeyAuth);
    const paywallNavigationRef=React.useRef({getOrigin:()=> 'account'});
    ${source.slice(policyStart,policyEnd)}
    ${source.slice(routeStart,routeEnd)}
    ${source.slice(offerActionStart,offerActionEnd)}
    ${hostStart < 0 ? '' : source.slice(hostStart,hostEnd)}
    ${source.slice(renderStart,renderGuardEnd)}
    ${source.slice(splashStart,quizStart)}
    ${source.slice(paywallStart,accountEnd)}
    return <Text testID="route">{screen}</Text>; };
    return (${providerBody}</FreedAppContext.Provider>);
  } return App;`;
  const initialRecovery={...createDefaultRecoveryState(),answers:['a','b','c','d','e'],journey:{entry,introCompletedAt:null}};
  const FreedAppContext=React.createContext<any>(null);
  const entryDependencies={React, Text, View, ScrollView, Pressable, SafeAreaView, ActivityIndicator, useWindowDimensions, useAppTheme, useInitialRoute, useTranslation:()=>({t:appI18n.t.bind(appI18n)}), AppBackground:View, MomentumCompanion:()=>null, BrandLogo:()=>null, OnboardingPreferences:()=>null, FreedLogo:()=>null,
    PillButton:({label,onPress}:any)=><Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>};
  const authored=(name:string)=>{const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);const compiled=transpileModule(`${source.slice(start,end)};return ${name};`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;return new Function(...Object.keys(entryDependencies),compiled)(...Object.values(entryDependencies));};
  const dependencies={React,Text,View,...Journey,AccountAccessScreen,BasicHelpPresentation,FunctionalPaywallScreen,SplashScreen:authored('SplashScreen'),WelcomeScreen:authored('WelcomeScreen'),FreedAppContext,useFreedNavigation,showAccountCleanupRecovery:false,rollbackPending:false,privateViewLocked:false,renderAccountDeletion:()=>null,hydrated:true,initialRecovery,checkedOwner:checked,
    ...(hostStart < 0 ? {} : {AccountAccessHost}),
    captureControls:(value:any)=>{controls=value;},
    getSnapshot:()=>mockAuth,subscribe:(listener:()=>void)=>{mockListeners.add(listener);return()=>mockListeners.delete(listener);},
    getFirebaseAccountScope:()=>mockUid,getFirebaseAccountSummary:()=>mockSummary,retireFirebaseNativeAccountSession,reconcileFirebaseNativeAccountSession,hasVerifiedPremium,markAccountStepCompleted,
    currentProfileSection:undefined,profileAccountOrigin:{current:null},isProfileAccountOriginCurrent:()=>false,returnFromProfileAccount:()=>false,setProtectionSyncMessage:()=>{},retryFirebaseAuthSnapshot:()=>mockRestore(),signOutRecoveryAccount:async()=>{},
    startPanicIntervention:()=>{},abandonActiveProtectionFlow:()=>{},membershipSnapshot:{ownerUid:null,status:'checking'},reviewAccess:{snapshot:null},
    journeyRecoverySaveNotice:null,journeyOfferSaveNotice:null,setJourneyOfferSaveNotice:()=>{},
    setQuizIndex:()=>{},purchaseBusy:false,purchaseNotice:null,runMembershipAction:jest.fn(),returnFromPaywall:jest.fn(),
  };
  const compiled=transpileModule(script,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
  const App=new Function(...Object.keys(dependencies),compiled)(...Object.values(dependencies));
  const leafEvents:string[]=[];
  const routeSourceStart=source.indexOf('export function FreedRoute('),routeSourceEnd=source.indexOf('\nexport function FreedAppProvider',routeSourceStart);
  const routeCode=transpileModule(source.slice(routeSourceStart,routeSourceEnd).replace('export function','function')+' return FreedRoute;', {compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
  const FreedRoute=new Function('React','View','useFreedAppController',routeCode)(React,View,()=>React.useContext(FreedAppContext));
  function FlowLeaf() {
    const {destination}=useLocalSearchParams<{destination:string}>();
    React.useEffect(()=>{leafEvents.push(`mount:${destination}`);return()=>{leafEvents.push(`unmount:${destination}`);};},[]);
    return <FreedRoute screen={parseFreedRoute(`/flow/${destination}`).screen}/>;
  }
  function TodayLeaf() {
    React.useEffect(()=>{leafEvents.push('mount:today');return()=>{leafEvents.push('unmount:today');};},[]);
    return <FreedRoute screen="main"/>;
  }
  // Run the actual root's ThemedStack body with the real Expo navigator; importing
  // RootLayout here would replace the bounded provider harness with all services.
  const layoutSource=readFileSync(`${process.cwd()}/app/_layout.tsx`,'utf8');
  const layoutBody=layoutSource.slice(layoutSource.indexOf('function ThemedStack('),layoutSource.indexOf('\nexport default function RootLayout'));
  const layoutDependencies={React,Stack,ThemeProvider,DarkTheme,DefaultTheme,useAppTheme,useRouter,getFreedFlowPresentation,translateSource,Pressable:LocalizedPressable,Text:LocalizedText,useTranslation:()=>({t:appI18n.t.bind(appI18n)})};
  const ThemedStack=new Function(...Object.keys(layoutDependencies),transpileModule(`${layoutBody};return ThemedStack;`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText)(...Object.values(layoutDependencies));
  const view=renderRouter({
    _layout:()=> <I18nextProvider i18n={appI18n}><App>{nativeLegalRoutes?<ThemedStack/>:<Stack screenOptions={{headerShown:false}}/>}</App></I18nextProvider>,
    index:()=> <FreedRoute screen="splash"/>,
    'flow/[destination]':FlowLeaf,
    today:TodayLeaf,
    'onboarding/[destination]':()=> <FreedRoute screen="welcome"/>,
    ...Object.fromEntries(['preferences','privacy','support','account-deletion'].map(name=>[name,()=> <View testID={`auxiliary-${name}`}><Text>{name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss auxiliary" onPress={()=>router.canGoBack()?router.back():router.replace('/')}><Text>Dismiss auxiliary</Text></Pressable></View>])),
    ...(nativeLegalRoutes?{'(tabs)/_layout':()=> <Stack/>, '(tabs)/tab-placeholder':()=> <Text>Tabs</Text>,privacy:PrivacyRoute}:{}),
  },{initialUrl});
  return {view,leafEvents,getControls:()=>controls};
}

test('real Privacy native Done releases the queued Welcome return after latest-request account cancellation',async()=>{
  const flow=remountFlowHarness({nativeLegalRoutes:true});await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Sign in with email'}));
  const emailNode=flow.view.getByLabelText('Email address');
  fireEvent.changeText(emailNode,'legal-exit@example.invalid');
  await act(async()=>{router.push('/preferences');});
  await act(async()=>{router.push('/privacy');});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.getByLabelText('Email address')).toBe(emailNode);
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/privacy');
  expect(flow.view.getByText('Email privacy support')).toBeOnTheScreen();
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Done'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/onboarding/welcome');
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.view.queryByTestId('auxiliary-preferences')).toBeNull();
});

test('cold real Privacy Done returns through the mandatory account guard',async()=>{
  const flow=remountFlowHarness({nativeLegalRoutes:true,initialUrl:'/privacy',status:'hydrating'});await act(async()=>{});
  await act(async()=>{publish(null,'unavailable');});
  expect(flow.view.getPathname()).toBe('/privacy');
  expect(router.canGoBack()).toBe(false);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Done'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
});

test('actual unconnected Welcome → preferences stays on preferences without a new account host and returns to Welcome', async()=>{
  const flow=remountFlowHarness({initialUrl:'/onboarding/welcome'}); await act(async()=>{});
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  await act(async()=>{router.push('/preferences');});
  expect(flow.view.getPathname()).toBe('/preferences');
  expect(flow.view.getByTestId('auxiliary-preferences')).toBeOnTheScreen();
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'})); await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/onboarding/welcome');
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
});

test.each(['preferences','privacy','support','account-deletion'])('cold public %s survives unconnected auth hydration/unavailability and dismiss resumes the mandatory account guard', async name=>{
  const flow=remountFlowHarness({initialUrl:`/${name}`,status:'hydrating'});await act(async()=>{});
  expect(flow.view.getPathname()).toBe(`/${name}`);
  await act(async()=>{publish(null,'unavailable');});
  expect(flow.view.getPathname()).toBe(`/${name}`);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
});

test('deferred private navigation cannot steal preferences and remains guarded after dismissal',async()=>{
  const flow=remountFlowHarness({initialUrl:'/onboarding/welcome'});await act(async()=>{});
  await act(async()=>{router.push('/preferences');});
  await act(async()=>{flow.getControls().setScreen('journal');});
  expect(flow.view.getPathname()).toBe('/preferences');
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
});

test.each(['preferences','privacy'])('external requests keep the active signup until explicit completion and then resume latest %s',async last=>{
  const created=deferred<any>(),sent=deferred<any>();const inputs:any[]=[];
  mockAdapter.createEmailAccount=(input:any)=>{inputs.push(input);return created.promise;};mockAdapter.sendEmailVerification=()=>sent.promise;
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  const widget=flow.view.UNSAFE_getByType(AccountAccessScreen),emailNode=flow.view.getByLabelText('Email address');
  fireEvent.changeText(emailNode,'aux-draft@example.com');fireEvent.changeText(flow.view.getByLabelText('Password'),'aux-private-password');fireEvent.changeText(flow.view.getByLabelText('Confirm password'),'aux-private-password');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));router.push('/preferences');});
  expect(flow.view.getPathname()).toBe('/flow/account');
  await act(async()=>{router.push(`/${last}`);});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  expect(flow.view.getByLabelText('Email address')).toBe(emailNode);
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  expect(flow.view.UNSAFE_getAllByType(Modal).filter(modal=>modal.props.visible)).toHaveLength(1);
  await act(async()=>{publish('aux-owner');created.resolve({ok:true,uid:'aux-owner',email:'aux-draft@example.com'});flow.getControls().setJourneyMembership({ownerUid:'aux-owner',status:'free'});sent.resolve({ok:true});});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  expect(inputs).toEqual([{email:'aux-draft@example.com',password:'aux-private-password'}]);
  fireEvent.press(flow.view.getByRole('button',{name:'Continue and verify later'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe(`/${last}`);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(false);
  expect(flow.getControls().journeyOfferStore.current.has('aux-owner')).toBe(false);
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/paywall');
  expect(flow.view.UNSAFE_getAllByType(FunctionalPaywallScreen)).toHaveLength(1);
});

test('late signup owner mismatch through external preferences retains the same draft and never advances or acknowledges an offer',async()=>{
  const created=deferred<any>();const inputs:any[]=[];
  mockAdapter.createEmailAccount=(input:any)=>{inputs.push(input);return created.promise;};
  const flow=remountFlowHarness();await act(async()=>{});fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  const widget=flow.view.UNSAFE_getByType(AccountAccessScreen),emailNode=flow.view.getByLabelText('Email address');
  fireEvent.changeText(emailNode,'late-aux@example.com');fireEvent.changeText(flow.view.getByLabelText('Password'),'late-aux-private-password');fireEvent.changeText(flow.view.getByLabelText('Confirm password'),'late-aux-private-password');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));router.push('/preferences');});
  await act(async()=>{publish('different-aux-owner');flow.getControls().setJourneyMembership({ownerUid:'different-aux-owner',status:'free'});created.resolve({ok:true,uid:'late-aux-owner',email:'late-aux@example.com'});});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);expect(flow.view.getByLabelText('Email address')).toBe(emailNode);
  expect(flow.view.getByRole('alert')).toHaveTextContent(/account changed/i);
  mockAdapter.createEmailAccount=async(input:any)=>{inputs.push(input);return{ok:false,reason:'Expected fixture rejection'};};
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
  expect(inputs).toEqual([{email:'late-aux@example.com',password:'late-aux-private-password'},{email:'late-aux@example.com',password:'late-aux-private-password'}]);
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  expect(flow.getControls().journeyOfferStore.current.has('different-aux-owner')).toBe(false);expect(flow.getControls().journeyOfferStore.current.has('late-aux-owner')).toBe(false);
  expect(flow.view.UNSAFE_queryByType(FunctionalPaywallScreen)).toBeNull();
});

test('explicit cancellation releases a deferred preferences request and Done returns to Welcome without an account deadlock',async()=>{
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  const widget=flow.view.UNSAFE_getByType(AccountAccessScreen);
  fireEvent.changeText(flow.view.getByLabelText('Email address'),'cancel-aux@example.com');
  await act(async()=>{router.push('/preferences');});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/preferences');
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(false);
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/onboarding/welcome');
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
});

test.each([['preferences','preferences'],['preferences','privacy'],['support','account-deletion']])('active account backs out repeated %s → %s requests and resumes only the last after cancellation',async(first,last)=>{
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  const widget=flow.view.UNSAFE_getByType(AccountAccessScreen);
  fireEvent.changeText(flow.view.getByLabelText('Email address'),'repeat-aux@example.com');
  await act(async()=>{router.push(`/${first}`);});expect(flow.view.getPathname()).toBe('/flow/account');
  await act(async()=>{router.push(`/${last}`);});expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());await act(async()=>{});
  expect(flow.view.getPathname()).toBe(`/${last}`);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/onboarding/welcome');
  expect(flow.view.queryByTestId(`auxiliary-${first}`)).toBeNull();
});

test('batched auxiliary requests are removed to the account origin and older stacked routes cannot overwrite the newest request',async()=>{
  const flow=remountFlowHarness();await act(async()=>{});fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  await act(async()=>{router.push('/preferences');router.push('/privacy');});
  expect(flow.view.getPathname()).toBe('/flow/account');
  act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());act(()=>flow.view.UNSAFE_getByType(Modal).props.onRequestClose());await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/privacy');
  fireEvent.press(flow.view.getByRole('button',{name:'Dismiss auxiliary'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/onboarding/welcome');
});

test.each(['/flow/journal','/flow/not-a-screen','/today'])('unconnected private or unknown %s still enters one mandatory account host',async initialUrl=>{
  const flow=remountFlowHarness({initialUrl});await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
});

test('Expo route replace retains the one active signup through pending UID and verification promises',async()=>{
  const created=deferred<any>(),sent=deferred<any>();
  let createCalls=0,verificationCalls=0;
  mockAdapter.createEmailAccount=()=>{createCalls+=1;return created.promise;};
  mockAdapter.sendEmailVerification=()=>{verificationCalls+=1;return sent.promise;};
  const flow=remountFlowHarness(); await act(async()=>{}); await submitSignup(flow as any);
  await act(async()=>{router.replace('/today');});
  expect(flow.leafEvents).toContain('unmount:account');
  expect(flow.leafEvents).toContain('mount:today');
  expect(flow.view.getByText('Create your account')).toBeOnTheScreen();
  expect(flow.view.getAllByLabelText('Email address')).toHaveLength(1);
  expect(flow.view.getByRole('button',{name:'Create account'})).toBeDisabled();
  await act(async()=>{publish('owner');created.resolve({ok:true,uid:'owner',email:'new@example.com'});});
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  await act(async()=>{router.replace('/flow/journal');});
  expect(flow.leafEvents).toContain('unmount:journal');
  expect(flow.leafEvents).toContain('mount:journal');
  expect(flow.view.getAllByText('Verify your email')).toHaveLength(1);
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
  await act(async()=>{flow.view.UNSAFE_getByType(Modal).props.onRequestClose();router.back();});
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  await act(async()=>{sent.resolve({ok:true});});
  expect(flow.view.getByText('Verification email sent. Check your inbox and spam folder.')).toBeOnTheScreen();
  expect(createCalls).toBe(1);expect(verificationCalls).toBe(1);
  await act(async()=>{publish('owner','unavailable');});mockRestore=()=>publish('owner');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Retry account access'}));});
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue and verify later'}));});
  // Membership still checks, so explicit completion permits the normal startup
  // policy rather than silently retaining the finished account host.
  expect(flow.view.queryByText('Verify your email')).toBeNull();
  flow.view.unmount();
});


test('modal Back preserves mode semantics and an old native close cannot cancel a reopened account host',async()=>{
  let visible=true,completed=0;
  const fence=Journey.createAccountFlowFence();
  const props={requiredEntry:true,onFlowInteraction:()=>fence.begin(),onConnected:()=>{},onSkip:()=>{completed+=1;visible=false;}};
  const element=()=> <I18nextProvider i18n={appI18n}><AccountAccessHost visible={visible} {...props}/></I18nextProvider>;
  const view=render(element());await act(async()=>{});
  fireEvent.press(view.getByRole('button',{name:'Create account with email'}));
  fireEvent.changeText(view.getByLabelText('Email address'),'private-draft@example.com');
  fireEvent.changeText(view.getByLabelText('Password'),'private-password');
  const oldClose=view.UNSAFE_getByType(Modal).props.onRequestClose;
  act(()=>oldClose());
  expect(view.getByRole('button',{name:'Create account with email'})).toBeOnTheScreen();
  expect(completed).toBe(0);expect(fence.isActive()).toBe(true);
  act(()=>view.UNSAFE_getByType(Modal).props.onRequestClose());view.rerender(element());
  expect(completed).toBe(1);expect(fence.isActive()).toBe(false);
  visible=true;view.rerender(element());await act(async()=>{});
  fireEvent.press(view.getByRole('button',{name:'Create account with email'}));
  expect(view.getByLabelText('Email address').props.defaultValue).toBe('');
  act(()=>oldClose());
  expect(view.getByText('Create your account')).toBeOnTheScreen();
  expect(completed).toBe(1);expect(fence.isActive()).toBe(true);
});


afterEach(()=>{jest.useRealTimers();});

test('actual route remount retains private form drafts and an actionable account failure',async()=>{
  const inputSeen:any[]=[];
  mockAdapter.createEmailAccount=async(input:any)=>{inputSeen.push(input);return{ok:false,reason:'Password rejected. Try again.'};};
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  fireEvent.changeText(flow.view.getByLabelText('Email address'),'draft@example.com');
  fireEvent.changeText(flow.view.getByLabelText('Password'),'retained-password');
  fireEvent.changeText(flow.view.getByLabelText('Confirm password'),'retained-password');
  await act(async()=>{router.replace('/today');});
  expect(flow.leafEvents).toContain('unmount:account');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
  expect(inputSeen).toEqual([{email:'draft@example.com',password:'retained-password'}]);
  await act(async()=>{router.replace('/flow/journal');});
  expect(flow.view.getByRole('alert')).toHaveTextContent('Password rejected. Try again.');
  expect(flow.view.getByText('Create your account')).toBeOnTheScreen();
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
  expect(inputSeen).toEqual([{email:'draft@example.com',password:'retained-password'},{email:'draft@example.com',password:'retained-password'}]);
  flow.view.unmount();
});

test('app-owned host dismisses after actual null-email Apple completion',async()=>{
  mockAdapter.signInWithAppleProvider=async()=>{
    publish('apple-owner');mockSummary.email=null;mockAuth={...mockAuth,email:null};
    return{ok:true,uid:'apple-owner'};
  };
  const flow=remountFlowHarness({checked:'apple-owner'});await act(async()=>{});
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue with Apple'}));});
  expect(flow.view.getPathname()).toBe('/flow/paywall');
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.view.UNSAFE_queryByType(Modal)).toBeNull();
  flow.view.unmount();
});


test('batched explicit cancel and re-entry create a fresh host immune to the old native close',async()=>{
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  fireEvent.changeText(flow.view.getByLabelText('Email address'),'old-private-draft@example.com');
  const oldWidget=flow.view.UNSAFE_getByType(AccountAccessScreen);
  const oldClose=flow.view.UNSAFE_getByType(Modal).props.onRequestClose;
  act(()=>oldClose()); // form -> choices without completing the interaction
  const oldControl=flow.getControls().beginAccountFlow();
  await act(async()=>{
    oldClose(); // explicit cancellation
    flow.getControls().enterAccountFlow(); // same React batch
    flow.getControls().setScreen('account');
  });
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).not.toBe(oldWidget);
  expect(oldControl.complete()).toBe(false);
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  expect(flow.view.getByLabelText('Email address').props.defaultValue).toBe('');
  act(()=>oldClose());
  expect(flow.view.getByText('Create your account')).toBeOnTheScreen();
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  flow.view.unmount();
});

test.each(['unavailable','ready'] as const)('auth hydration → %s during actual root Help defers account presentation until dismiss',async status=>{
  const flow=remountFlowHarness({initialUrl:'/',status:'hydrating'});await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Help / SOS'}));
  expect(flow.getControls().publicBasicHelp).toBe(true);
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);
  await act(async()=>{publish(null,status);});
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.view.UNSAFE_getAllByType(Modal).filter(modal=>modal.props.visible)).toHaveLength(1);
  fireEvent.press(flow.view.getByRole('button',{name:'Close basic help'}));await act(async()=>{});
  expect(flow.getControls().publicBasicHelp).toBe(false);
  expect(flow.view.queryByTestId('public-basic-help')).toBeNull();
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
  expect(flow.view.getPathname()).toBe('/flow/account');
  expect(flow.view.UNSAFE_getAllByType(Modal).filter(modal=>modal.props.visible)).toHaveLength(1);
  flow.view.unmount();
});
test('actual root startup Help spans membership hydration then the current unacknowledged offer without acknowledging it',async()=>{
  const flow=remountFlowHarness({initialUrl:'/',status:'hydrating'});await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Help / SOS'}));
  await act(async()=>{publish('restored-owner');});
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  await act(async()=>{flow.getControls().setJourneyMembership({ownerUid:'restored-owner',status:'free'});});
  expect(flow.view.getPathname()).toBe('/flow/paywall');
  expect(flow.getControls().journeyOfferStore.current.has('restored-owner')).toBe(false);
  fireEvent.press(flow.view.getByRole('button',{name:'Close basic help'}));await act(async()=>{});
  expect(flow.view.UNSAFE_getAllByType(FunctionalPaywallScreen)).toHaveLength(1);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.view.UNSAFE_queryAllByType(Modal).filter(modal=>modal.props.visible)).toHaveLength(0);
  expect(flow.getControls().journeyOfferStore.current.has('restored-owner')).toBe(false);
  flow.view.unmount();
});
test('actual Welcome and FunctionalPaywall forwarding open the authored root Help state; auth loss dismisses into one current account',async()=>{
  const welcome=remountFlowHarness({initialUrl:'/onboarding/welcome',entry:'new'});await act(async()=>{});
  fireEvent.press(welcome.view.getByRole('button',{name:'Help / SOS'}));
  expect(welcome.getControls().publicBasicHelp).toBe(true);
  fireEvent.press(welcome.view.getByRole('button',{name:'Close basic help'}));
  expect(welcome.view.getByRole('button',{name:'Get started'})).toBeOnTheScreen();welcome.view.unmount();
  const flow=remountFlowHarness({initialUrl:'/flow/paywall',owner:'offer-owner',checked:'offer-owner'});await act(async()=>{});
  expect(flow.view.UNSAFE_getAllByType(FunctionalPaywallScreen)).toHaveLength(1);
  const priorCalls={store:mockStorePrices.mock.calls.length,checkout:mockCheckout.mock.calls.length};
  fireEvent.press(flow.view.getByRole('button',{name:'Help / SOS'}));await act(async()=>{});
  expect(flow.getControls().publicBasicHelp).toBe(true);
  expect(mockStorePrices.mock.calls.length).toBe(priorCalls.store);expect(mockCheckout.mock.calls.length).toBe(priorCalls.checkout);
  await act(async()=>{publish(null,'unavailable');});
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);
  expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Close basic help'}));await act(async()=>{});
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
  expect(flow.view.UNSAFE_queryByType(FunctionalPaywallScreen)).toBeNull();
  expect(flow.getControls().journeyOfferStore.current.has('offer-owner')).toBe(false);
  flow.view.unmount();
});
test('pending real account submission resolves through nested Help and keeps its verification fence until explicit continuation',async()=>{
  const created=deferred<any>(),sent=deferred<any>();const inputs:any[]=[];
  mockAdapter.createEmailAccount=(input:any)=>{inputs.push(input);return created.promise;};mockAdapter.sendEmailVerification=()=>sent.promise;
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  const widget=flow.view.UNSAFE_getByType(AccountAccessScreen);
  const emailNode=flow.view.getByLabelText('Email address');
  fireEvent.changeText(emailNode,'retained@example.com');fireEvent.changeText(flow.view.getByLabelText('Password'),'retained-password');fireEvent.changeText(flow.view.getByLabelText('Confirm password'),'retained-password');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
  fireEvent.press(flow.view.getByRole('button',{name:'Help / SOS'}));
  expect(flow.getControls().publicBasicHelp).toBe(false);expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  expect(flow.view.getByLabelText('Email address',{includeHiddenElements:true})).toBe(emailNode);
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);
  await act(async()=>{publish('signup-owner');created.resolve({ok:true,uid:'signup-owner',email:'retained@example.com'});});
  await act(async()=>{flow.getControls().setJourneyMembership({ownerUid:'signup-owner',status:'free'});sent.resolve({ok:true});});
  expect(inputs).toEqual([{email:'retained@example.com',password:'retained-password'}]);
  expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  expect(flow.view.UNSAFE_queryByType(FunctionalPaywallScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Close basic help'}));
  expect(flow.view.getByText('Verify your email')).toBeOnTheScreen();expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Continue and verify later'}));});
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(false);
  expect(flow.view.getPathname()).toBe('/flow/paywall');expect(flow.view.UNSAFE_queryByType(AccountAccessScreen)).toBeNull();
  expect(flow.view.UNSAFE_getAllByType(FunctionalPaywallScreen)).toHaveLength(1);expect(flow.getControls().journeyOfferStore.current.has('signup-owner')).toBe(false);
  flow.view.unmount();
});

test('late pending signup owner result through nested Help remains fenced and retains draft credentials for retry',async()=>{
  const created=deferred<any>();const inputs:any[]=[];
  mockAdapter.createEmailAccount=(input:any)=>{inputs.push(input);return created.promise;};
  const flow=remountFlowHarness();await act(async()=>{});
  fireEvent.press(flow.view.getByRole('button',{name:'Create account with email'}));
  const widget=flow.view.UNSAFE_getByType(AccountAccessScreen),emailNode=flow.view.getByLabelText('Email address');
  fireEvent.changeText(emailNode,'draft-owner@example.com');fireEvent.changeText(flow.view.getByLabelText('Password'),'private-draft-password');fireEvent.changeText(flow.view.getByLabelText('Confirm password'),'private-draft-password');
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
  fireEvent.press(flow.view.getByRole('button',{name:'Help / SOS'}));
  await act(async()=>{publish('different-owner');flow.getControls().setJourneyMembership({ownerUid:'different-owner',status:'free'});created.resolve({ok:true,uid:'late-old-owner',email:'draft-owner@example.com'});});
  expect(flow.view.getAllByTestId('public-basic-help')).toHaveLength(1);expect(flow.view.UNSAFE_getByType(AccountAccessScreen)).toBe(widget);
  expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);expect(flow.view.UNSAFE_queryByType(FunctionalPaywallScreen)).toBeNull();
  fireEvent.press(flow.view.getByRole('button',{name:'Close basic help'}));
  expect(flow.view.getByLabelText('Email address')).toBe(emailNode);expect(flow.view.getByRole('alert')).toHaveTextContent(/account changed/i);
  mockAdapter.createEmailAccount=async(input:any)=>{inputs.push(input);return{ok:false,reason:'Expected fixture rejection'};};
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Create account'}));});
  expect(inputs).toEqual([{email:'draft-owner@example.com',password:'private-draft-password'},{email:'draft-owner@example.com',password:'private-draft-password'}]);
  expect(flow.view.UNSAFE_getAllByType(AccountAccessScreen)).toHaveLength(1);expect(flow.getControls().accountFlowFence.current.isActive()).toBe(true);
  expect(flow.getControls().journeyOfferStore.current.has('different-owner')).toBe(false);expect(flow.getControls().journeyOfferStore.current.has('late-old-owner')).toBe(false);
  flow.view.unmount();
});

function accountLinkHarness(owner='owner-a',initialRecovery=createDefaultRecoveryState()) {
  publish(owner);
  const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');
  const hostStart=source.indexOf('  const renderAccountHost =');
  const connectedStart=source.indexOf('      onConnected={(email) => {',hostStart);
  const connectedEnd=source.indexOf('\n      onSkip={() => {',connectedStart);
  const connectedProp=source.slice(connectedStart,connectedEnd).trim();
  const connectedExpression=connectedProp.slice('onConnected={'.length,connectedProp.lastIndexOf('}')).trim();
  const cardStart=source.indexOf('    <Card category="reflection" title={"Sign-in"}>');
  const cardEnd=source.indexOf('\n    </Card>',cardStart)+'\n    </Card>'.length;
  const cardScript=`function ProfileAccountCard({accountNotice,onConnectAccount,onSignOut,signingOut=false}) { const account=getFirebaseAccountSummary(); const {colors}=useAppTheme(); return (${source.slice(cardStart,cardEnd)}); } return ProfileAccountCard;`;
  const ProfileAccountCard=new Function('React','Card','Text','View','PillButton','useAppTheme','getFirebaseAccountSummary',transpileModule(cardScript,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText)(
    React,({title,children}:any)=><View><Text>{title}</Text>{children}</View>,Text,View,
    ({label,onPress}:any)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>,
    ()=>({colors:{text:'#111',text2:'#555'}}),()=>mockSummary
  );
  const navigation:string[]=[];
  const onConnected=jest.fn();
  let currentRecovery=initialRecovery;
  function Probe() {
    React.useSyncExternalStore((listener:()=>void)=>{mockListeners.add(listener);return()=>mockListeners.delete(listener);},()=>mockAuth,()=>mockAuth);
    const [route,setRoute]=React.useState('main');
    const [accountReturnToProfile,setAccountReturnToProfile]=React.useState(false);
    const [accountNotice,setAccountNotice]=React.useState<string|null>(null);
    const [recoveryState,setRecoveryState]=React.useState(initialRecovery);
    currentRecovery=recoveryState;
    const [syncMessage,setSyncMessage]=React.useState<string|null>(null);
    onConnected.mockImplementation(new Function('profileAccountOrigin','isProfileAccountOriginCurrent','returnFromProfileAccount','markAccountStepCompleted','setRecoveryState','setProtectionSyncMessage','setAccountNotice','accountReturnToProfile','setAccountReturnToProfile','setTab','setScreen','getJourneyDestination','getJourneyPolicy',`return (${connectedExpression});`)(
      {current:null},()=>false,()=>false,markAccountStepCompleted,setRecoveryState,setSyncMessage,setAccountNotice,accountReturnToProfile,setAccountReturnToProfile,
      (tab:string)=>navigation.push(tab),(screen:string)=>setRoute(screen),()=> 'account',()=>({})
    ));
    const openLink=()=>{setAccountNotice(null);setAccountReturnToProfile(true);setRoute('account');};
    const onSkip=()=>{if(accountReturnToProfile&&Journey.getJourneyOwner(mockAuth)){setAccountReturnToProfile(false);setRoute('main');}else setRoute('welcome');};
    return <View>
      <Text testID="route">{route}</Text>
      <ProfileAccountCard accountNotice={accountNotice} onConnectAccount={openLink} onSignOut={()=>{}} />
      <AccountAccessHost visible={route==='account'} linkExisting={accountReturnToProfile&&mockSummary.signedIn&&!mockSummary.anonymous} requiredEntry={!accountReturnToProfile||!Journey.getJourneyOwner(mockAuth)} onConnected={onConnected} onSkip={onSkip} />
    </View>;
  }
  const view=render(<I18nextProvider i18n={appI18n}><Probe/></I18nextProvider>);
  return {view,navigation,onConnected,getRecoveryState:()=>currentRecovery,getRoute:()=>view.getByTestId('route').props.children};
}

function setGoogleLinkFixture() {
  mockGoogle={ok:true,email:null,token:{provider:'google',idToken:'fixture-id-token',accessToken:'fixture-access-token'}};
}

async function openProfileLink(flow:ReturnType<typeof accountLinkHarness>) {
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Link another sign-in'}));});
  expect(flow.view.getByText('Connect another sign-in')).toBeOnTheScreen();
}

test('successful Profile provider link returns to the same owner and confirms in the Sign-in card',async()=>{
  setGoogleLinkFixture();
  mockAdapter.linkProviderCredential=async()=>{publish('owner-a');mockSummary.providers=['password','google.com'];return{ok:true,uid:'owner-a'};};
  const flow=accountLinkHarness();await act(async()=>{});
  await openProfileLink(flow);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Sign in with Google'}));});
  expect(flow.getRoute()).toBe('main');
  expect(mockUid).toBe('owner-a');
  expect(flow.view.getByText('Email · Google')).toBeOnTheScreen();
  const confirmation=flow.view.getByText('Your account is connected');
  expect(confirmation).toBeOnTheScreen();
  expect(confirmation.props.accessibilityLiveRegion).toBe('polite');
  expect(flow.view.UNSAFE_queryByType(Modal)).toBeNull();
});

test('explicit Profile Account Cancel returns to the card without a success notice',async()=>{
  const flow=accountLinkHarness();await act(async()=>{});
  await openProfileLink(flow);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Cancel'}));});
  expect(flow.getRoute()).toBe('main');
  expect(flow.view.getByRole('button',{name:'Link another sign-in'})).toBeOnTheScreen();
  expect(flow.view.queryByText('Your account is connected')).toBeNull();
});

test('cancelled Profile Google provider result keeps account access and owner until explicit Account Cancel',async()=>{
  mockGoogle={ok:false,reason:'cancelled'};
  const linkProviderCredential=jest.fn();
  mockAdapter.linkProviderCredential=linkProviderCredential;
  const initialRecovery={...createDefaultRecoveryState(),premiumEntitlement:{
    productId:'freed_premium_lifetime' as const,platform:'ios' as const,expiresAt:null,
    verifiedAt:'2026-10-05T00:00:00.000Z',status:'verified' as const,ownerUid:'owner-a',
  }};
  const flow=accountLinkHarness('owner-a',initialRecovery);await act(async()=>{});
  const providersBefore=[...mockSummary.providers];
  const checkoutCallsBefore=mockCheckout.mock.calls.length;
  expect(mockSummary).toMatchObject({signedIn:true,anonymous:false});
  expect(mockUid).toBe('owner-a');
  expect(flow.getRecoveryState().premiumEntitlement?.ownerUid).toBe('owner-a');
  await openProfileLink(flow);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Sign in with Google'}));});
  expect(flow.getRoute()).toBe('account');
  expect(flow.view.UNSAFE_getByType(Modal).props.visible).toBe(true);
  expect(flow.view.getByText('Connect another sign-in')).toBeOnTheScreen();
  const notice=flow.view.getByText('Sign-in cancelled. You can choose another method or continue for now.');
  expect(notice).toBeOnTheScreen();
  expect(notice.props.accessibilityLiveRegion).toBe('polite');
  expect(mockUid).toBe('owner-a');
  expect(mockAuth.ownerUid).toBe('owner-a');
  expect(mockSummary.providers).toEqual(providersBefore);
  expect(flow.getRecoveryState().premiumEntitlement).toEqual(initialRecovery.premiumEntitlement);
  expect(mockCheckout.mock.calls.length).toBe(checkoutCallsBefore);
  expect(linkProviderCredential).not.toHaveBeenCalled();
  expect(flow.onConnected).not.toHaveBeenCalled();
  expect(flow.navigation).toEqual([]);
  expect(flow.view.queryByText('Your account is connected')).toBeNull();
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Cancel'}));});
  expect(flow.getRoute()).toBe('main');
  expect(flow.view.UNSAFE_queryByType(Modal)).toBeNull();
  expect(flow.view.getByRole('button',{name:'Link another sign-in'})).toBeOnTheScreen();
  expect(mockUid).toBe('owner-a');
  expect(mockSummary.providers).toEqual(providersBefore);
  expect(flow.getRecoveryState().premiumEntitlement).toEqual(initialRecovery.premiumEntitlement);
  expect(flow.onConnected).not.toHaveBeenCalled();
  expect(flow.view.queryByText('Your account is connected')).toBeNull();
});

test.each([
  ['credential collision','account-conflict','This sign-in belongs to another account. Choose how to continue before switching accounts.'],
  ['already-linked provider','provider-already-linked','This sign-in method is already linked to the current account.'],
  ['network failure','unavailable','Check your connection and try again.'],
])('Profile provider %s remains actionable in account access and never reports success',async(_label,code,reason)=>{
  setGoogleLinkFixture();
  mockAdapter.linkProviderCredential=async()=>({ok:false,status:'error',code,reason});
  const flow=accountLinkHarness();await act(async()=>{});
  await openProfileLink(flow);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Sign in with Google'}));});
  expect(flow.view.getByRole('alert')).toHaveTextContent(reason);
  expect(flow.view.getByText('Connect another sign-in')).toBeOnTheScreen();
  expect(flow.view.queryByText('Your account is connected')).toBeNull();
  expect(mockUid).toBe('owner-a');
});

test('late Profile provider success from a stale owner stays in account access without success notice',async()=>{
  const linked=deferred<any>();setGoogleLinkFixture();mockAdapter.linkProviderCredential=()=>linked.promise;
  const flow=accountLinkHarness();await act(async()=>{});
  await openProfileLink(flow);
  await act(async()=>{fireEvent.press(flow.view.getByRole('button',{name:'Sign in with Google'}));});
  await act(async()=>{publish('owner-b');linked.resolve({ok:true,uid:'owner-a'});});
  expect(flow.view.getByRole('alert')).toHaveTextContent(/account changed/i);
  expect(flow.view.getByText('Connect another sign-in')).toBeOnTheScreen();
  expect(flow.view.queryByText('Your account is connected')).toBeNull();
  expect(mockUid).toBe('owner-b');
});
