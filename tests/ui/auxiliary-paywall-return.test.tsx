import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { useFreedNavigation } from '@/features/use-freed-navigation';
import { createPaywallNavigationSession } from '@/lib/paywall-navigation';
import { createAccountOperationGate } from '@/lib/account-operation';
import { getJourneyOwner, guardJourneyRoute, type JourneyAuthSnapshot } from '@/lib/user-journey';
import { hasVerifiedPremium, type VerifiedPremiumEntitlement } from '@/lib/premium-entitlement';
import { createDefaultRecoveryState, setVerifiedPremiumEntitlement, setPremiumPlan } from '@/lib/recovery-state';
import { parseFeatureId, FEATURE_DEFINITIONS, FEATURE_DESTINATIONS, type FeatureId } from '@/lib/feature-catalogue';
jest.mock('expo', () => ({ ...jest.requireActual('expo'), reloadAppAsync: jest.fn(), requireOptionalNativeModule: () => null }));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function receipt(): VerifiedPremiumEntitlement { return { productId: 'freed_premium_yearly', platform: 'ios', status: 'verified', verifiedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+3600000).toISOString() }; }

function harness() {
  let auth: JourneyAuthSnapshot = { status: 'ready', signedIn: true, anonymous: false, ownerUid: 'purchase-owner', email: null };
  const listeners = new Set<()=>void>();
  const purchase = deferred<any>();
  const acknowledgements: string[] = [];
  let controls: any;
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const returnStart = source.indexOf('  const openPaywall =');
  const runStart = source.indexOf('  const runMembershipAction =', returnStart);
  const runEnd = source.indexOf('\n  const changeAutomaticBackup', runStart);
  const renderStart = source.indexOf('  const renderScreen = (screen: Screen');
  const featureStart = source.indexOf('    if (screen === "feature")',renderStart);
  const featureEnd = source.indexOf('    if (screen === "features")',featureStart);
  const script = `function App({children}) {
    const {screen,setScreen,replaceFeature,returnProfileSection}=useFreedNavigation();
    const journeyAuth=React.useSyncExternalStore(subscribe,getFirebaseAuthSnapshot,getFirebaseAuthSnapshot);
    const [recoveryState,setRecoveryState]=React.useState(createDefaultRecoveryState());
    const recoveryStateRef=React.useRef(recoveryState);recoveryStateRef.current=recoveryState;
    const paywallNavigationRef=React.useRef(createPaywallNavigationSession(screen));
    React.useLayoutEffect(()=>{paywallNavigationRef.current.update(screen);},[screen]);
    const profilePaywallOrigin=React.useRef(null);
    const membershipBusyRef=React.useRef(false);
    const accountOperationGate=React.useRef(createAccountOperationGate(getFirebaseAccountScope));
    const setPurchaseBusy=()=>{},setPurchaseNotice=()=>{};
    const postPaywallScreen=()=> 'main';
    ${source.slice(returnStart,runEnd)}
    function renderFeature(featureId) {
      const currentAuth=getFirebaseAuthSnapshot();
      const licensedFeatures=hasVerifiedPremium(recoveryState.premiumEntitlement,Date.now(),getJourneyOwner(currentAuth));
      const guarded=guardJourneyRoute('feature',{auth:currentAuth,journey:{entry:'existing',introCompletedAt:null},offerAcknowledged:true,verifiedPremium:licensedFeatures});
      if(guarded!=='feature')return <Text testID="mandatory-auth">{guarded}</Text>;
      let screen='feature',tab='today',focusedSection,initialPracticeKey;
      const openFeature=()=>{};
      ${source.slice(featureStart,featureEnd)}
      return screen === 'customChallenge'
        ? <Text testID="premium-feature">{screen}:{featureId}</Text>
        : <Text testID="feature-destination">{screen}:{tab}:{focusedSection}</Text>;
    }
    capture({openPaywall,runMembershipAction,returnFromPaywall,paywallNavigationRef,accountOperationGate,renderFeature,setRecoveryState,recoveryState});
    return children;
  } return App;`;
  const deps = { React,View,Text,useFreedNavigation,createDefaultRecoveryState,createPaywallNavigationSession,createAccountOperationGate,getJourneyOwner,guardJourneyRoute,hasVerifiedPremium,setVerifiedPremiumEntitlement,setPremiumPlan,parseFeatureId,FEATURE_DEFINITIONS,FEATURE_DESTINATIONS,router,
    PillButton:({label}:any)=><Text>{label}</Text>,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},
    getFirebaseAuthSnapshot:()=>auth,getFirebaseAccountScope:()=>auth.ownerUid,getFirebaseAccountSummary:()=>({signedIn:auth.signedIn,anonymous:auth.anonymous}),
    getRuntimeMonetizationPlatform:()=> 'ios',getMonetizationConfig:()=>({mode:'real'}),getFirebaseCallableContracts:async()=>({}),
    purchasePremiumPlan:()=>purchase.promise,restorePremiumPurchases:()=>purchase.promise,
    safeUserFacingMessage:(value:any)=>typeof value==='string'?value:'Purchase failed',acknowledgeJourneyOffer:(decision:string)=>acknowledgements.push(decision),capture:(value:any)=>{controls=value;},
  };
  const compiled=transpileModule(script,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
  const App=new Function(...Object.keys(deps),compiled)(...Object.values(deps));
  function Feature() { const {feature}=useLocalSearchParams();return controls.renderFeature(feature); }
  const view=renderRouter({_layout:()=> <App><Stack/></App>,today:()=> <Text>Today</Text>,preferences:()=> <View><Text>Preferences</Text><Pressable accessibilityRole="button" onPress={()=>router.back()}><Text>Done</Text></Pressable></View>,'flow/feature':Feature,'flow/paywall':()=> <Text>Paywall</Text>},{initialUrl:'/today'});
  return {view,purchase,acknowledgements,get:()=>controls,setAuth:(next:Partial<JourneyAuthSnapshot>)=>{auth={...auth,...next};listeners.forEach(listener=>listener());}};
}

async function pendingFeaturePurchase(feature: FeatureId = 'custom-reset') {
  const flow=harness();await act(async()=>{});
  await act(async()=>{flow.get().openPaywall(feature);});
  let operation!:Promise<void>;
  await act(async()=>{operation=flow.get().runMembershipAction('yearly');});
  await act(async()=>{router.push('/preferences');});
  return {flow,operation};
}

test('actual same-owner verified feature purchase queues its exact return params until Done',async()=>{
  const {flow,operation}=await pendingFeaturePurchase();
  await act(async()=>{flow.purchase.resolve({premium:true,verifiedEntitlement:receipt(),provider:'store',planId:'yearly',message:'Verified'});await operation;});
  expect(flow.view.getPathname()).toBe('/preferences');
  expect(flow.acknowledgements).toEqual(['verified-membership']);
  fireEvent.press(flow.view.getByRole('button',{name:'Done'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/feature');
  expect(flow.view.getByTestId('premium-feature')).toHaveTextContent(/^customChallenge:custom-reset$/);
});

test.each(['owner','token','operation'])('queued feature return rejects stale %s ownership before Done',async stale=>{
  const {flow,operation}=await pendingFeaturePurchase();
  await act(async()=>{flow.purchase.resolve({premium:true,verifiedEntitlement:receipt(),provider:'store',planId:'yearly',message:'Verified'});await operation;});
  expect(flow.view.getPathname()).toBe('/preferences');
  await act(async()=>{if(stale==='owner')flow.setAuth({ownerUid:'replacement-owner'});else if(stale==='token')flow.get().paywallNavigationRef.current.open('history');else flow.get().accountOperationGate.current.invalidate();});
  fireEvent.press(flow.view.getByRole('button',{name:'Done'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/paywall');
  expect(flow.view.queryByTestId('premium-feature')).toBeNull();
});

test.each(['expired','revoked'])('current-owner queued custom-reset return preserves the real %s entitlement gate',async state=>{
  const {flow,operation}=await pendingFeaturePurchase();
  await act(async()=>{flow.purchase.resolve({premium:true,verifiedEntitlement:receipt(),provider:'store',planId:'yearly',message:'Verified'});await operation;});
  expect(flow.view.getPathname()).toBe('/preferences');
  await act(async()=>{flow.get().setRecoveryState((current:any)=>({...current,premiumEntitlement:{...current.premiumEntitlement,...(state==='expired'?{expiresAt:new Date(Date.now()-1000).toISOString()}:{status:'revoked'})}}));});
  fireEvent.press(flow.view.getByRole('button',{name:'Done'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/feature');
  expect(flow.view.queryByTestId('premium-feature')).toBeNull();
  expect(flow.view.queryByTestId('feature-destination')).toBeNull();
  expect(flow.view.getByText('Verify membership to open this report.')).toBeOnTheScreen();
});

test.each(['expired','revoked'])('current-owner queued recovery history stays free with a %s entitlement',async state=>{
  const {flow,operation}=await pendingFeaturePurchase('history');
  await act(async()=>{flow.purchase.resolve({premium:true,verifiedEntitlement:receipt(),provider:'store',planId:'yearly',message:'Verified'});await operation;});
  expect(flow.view.getPathname()).toBe('/preferences');
  await act(async()=>{flow.get().setRecoveryState((current:any)=>({...current,premiumEntitlement:{...current.premiumEntitlement,...(state==='expired'?{expiresAt:new Date(Date.now()-1000).toISOString()}:{status:'revoked'})}}));});
  fireEvent.press(flow.view.getByRole('button',{name:'Done'}));await act(async()=>{});
  expect(flow.view.getPathname()).toBe('/flow/feature');
  expect(flow.view.getByTestId('feature-destination')).toHaveTextContent(/^main:progress:history$/);
  expect(flow.view.queryByTestId('premium-feature')).toBeNull();
  expect(flow.view.queryByText('Verify membership to open this report.')).toBeNull();
});
