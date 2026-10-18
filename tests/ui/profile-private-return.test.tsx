import React from 'react';
import { Text, View } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Stack, Tabs, router, useLocalSearchParams } from 'expo-router';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { useFreedNavigation } from '@/features/use-freed-navigation';
import { createAccountFlowFence, getJourneyOwner, guardJourneyRoute, type JourneyAuthSnapshot } from '@/lib/user-journey';
import { createAccountOperationGate } from '@/lib/account-operation';
import { createPaywallNavigationSession } from '@/lib/paywall-navigation';
import { parseFeatureId } from '@/lib/feature-catalogue';
import { markAccountStepCompleted, createDefaultRecoveryState } from '@/lib/recovery-state';
jest.mock('expo', () => ({ ...jest.requireActual('expo'), reloadAppAsync: jest.fn(), requireOptionalNativeModule: () => null }));

function harness(initialUrl='/profile/account') {
  let auth: JourneyAuthSnapshot = {status:'ready',signedIn:true,anonymous:false,ownerUid:'original',email:'private@example.com'};
  let controls:any;
  const source=readFileSync('src/features/freed-app.tsx','utf8');
  const originStart=source.indexOf('  const profileAccountOrigin ='),originEnd=source.indexOf('  const [pendingRecoveryRestore',originStart);
  const paywallStart=source.indexOf('  const profilePaywallOrigin ='),paywallEnd=source.indexOf('  const postPaywallScreen =',paywallStart);
  const routeEnd=source.indexOf('  const paywallNavigationRef =');const routeStart=source.lastIndexOf('  React.useEffect(',routeEnd);
  const openStart=source.indexOf('  const openPaywall ='),openEnd=source.indexOf('  const runMembershipAction =',openStart);
  const hostStart=source.indexOf('  const renderAccountHost =');
  const connectedStart=source.indexOf('      onConnected={(email) => {',hostStart),connectedEnd=source.indexOf('\n      onSkip=',connectedStart);
  const connected=source.slice(connectedStart,connectedEnd).trim().slice('onConnected={'.length,-1);
  const skipStart=source.indexOf('      onSkip={() => {',connectedEnd),skipEnd=source.indexOf('\n    />',skipStart);
  const skip=source.slice(skipStart,skipEnd).trim().slice('onSkip={'.length,-1);
  const profileStart=source.indexOf('            <ProfileScreen');
  const connectStart=source.indexOf('              onConnectAccount={',profileStart),connectEnd=source.indexOf('\n',connectStart);
  const connect=source.slice(connectStart,connectEnd).trim().slice('onConnectAccount={'.length,-1);
  const code=`function App({children}) {
    const navigation=useFreedNavigation();const {screen,setScreen,setTab,replaceFeature,returnProfileSection,profileSection:currentProfileSection,auxiliaryRoute,deferredAuxiliaryRoute,deferAuxiliaryPresentation,resumeAuxiliaryPresentation}=navigation;const profileSection=currentProfileSection;
    const journeyAuth=getFirebaseAuthSnapshot();
    const [recoveryState,setRecoveryState]=React.useState(createDefaultRecoveryState());
    const [accountNotice,setAccountNotice]=React.useState(null);const [accountReturnToProfile,setAccountReturnToProfile]=React.useState(false);
    const accountFlowFence=React.useRef(createAccountFlowFence());const accountHostGeneration=React.useRef(0);
    const accountOperationGate=React.useRef(createAccountOperationGate(getFirebaseAccountScope));
    const enterAccountFlow=()=>{if(!accountFlowFence.current.isActive())accountHostGeneration.current++;return accountFlowFence.current.begin();};
    const setProtectionSyncMessage=()=>{};const getJourneyPolicy=()=>({auth:getFirebaseAuthSnapshot(),journey:{entry:'existing',introCompletedAt:null},offerAcknowledged:true,verifiedPremium:false});const getJourneyDestination=()=> 'main';const hydrated=true,membershipOwnerChecked='original',journeyOfferRevision=0,accountFlowRevision=0;
    ${source.slice(originStart,originEnd)}
    const paywallNavigationRef=React.useRef(createPaywallNavigationSession(screen));React.useLayoutEffect(()=>{paywallNavigationRef.current.update(screen);},[screen]);
    ${source.slice(routeStart,routeEnd)}
    ${source.slice(paywallStart,paywallEnd)}
    const postPaywallScreen=()=> 'main';
    ${source.slice(openStart,openEnd)}
    const connect=${connect};const onConnected=${connected};const onSkip=${skip};
    capture({navigation,connect,onConnected,onSkip,accountNotice,accountFlowFence,accountHostGeneration,profileAccountOrigin,profilePaywallOrigin,accountOperationGate,openProfilePaywall,openPaywall,returnFromPaywall,paywallNavigationRef});
    return children;
  } return App;`;
  const deps={React,useFreedNavigation,createAccountFlowFence,createAccountOperationGate,createPaywallNavigationSession,parseFeatureId,getJourneyOwner,guardJourneyRoute,markAccountStepCompleted,createDefaultRecoveryState,getFirebaseAccountScope:()=>auth.ownerUid,getFirebaseAuthSnapshot:()=>auth,capture:(next:any)=>{controls=next;}};
  const App=new Function(...Object.keys(deps),transpileModule(code,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText)(...Object.values(deps));
  function Detail(){const {section}=useLocalSearchParams();return <Text testID="profile-detail">{section}</Text>;}
  const view=renderRouter({_layout:()=> <App><Stack/></App>,'(tabs)/_layout':()=> <Tabs/>, '(tabs)/profile/_layout':{default:()=> <Stack/>,unstable_settings:{initialRouteName:'index'}},'(tabs)/profile/index':()=> <Text>Profile root</Text>,'(tabs)/profile/[section]':Detail,'flow/account':()=> <Text>Account modal</Text>,'flow/paywall':()=> <Text>Paywall</Text>,'flow/feature':()=> <Text>Feature</Text>,preferences:()=> <Text>Preferences sheet</Text>},{initialUrl});
  return {view,get:()=>controls,owner:(next:string|null)=>{auth={...auth,ownerUid:next,signedIn:Boolean(next)};}};
}
async function startAccount(flow:ReturnType<typeof harness>){await act(async()=>{});await act(async()=>{flow.get().connect();});expect(flow.view.getPathname()).toBe('/flow/account');}
async function completeAccount(flow:ReturnType<typeof harness>,cancel=false){await act(async()=>{expect(flow.get().accountFlowFence.current.begin().complete()).toBe(true);if(cancel)flow.get().onSkip();else flow.get().onConnected('private@example.com');});}

test.each([false,true])('production Account %s callback returns to its exact private origin after actual fence completion',async cancel=>{
 const flow=harness();await startAccount(flow);await completeAccount(flow,cancel);expect(flow.view.getPathname()).toBe('/profile/account');expect(flow.get().accountNotice).toBe(cancel?null:'Your account is connected');
});
test('account callback before completion cannot reopen a private page or report success',async()=>{
 const flow=harness();await startAccount(flow);await act(async()=>flow.get().onConnected('private@example.com'));expect(flow.view.getPathname()).toBe('/flow/account');expect(flow.get().accountNotice).toBeNull();
});
test.each(['owner','operation','cancelled-operation','new-presentation'])('production private Account return rejects stale %s without another owner page',async stale=>{
 const flow=harness();await startAccount(flow);
 await act(async()=>{if(stale==='owner')flow.owner('replacement');else if(stale==='operation')flow.get().accountOperationGate.current.invalidate();else if(stale==='cancelled-operation')flow.get().profileAccountOrigin.current.operation.cancel();else flow.get().accountHostGeneration.current++;});
 await completeAccount(flow);expect(flow.view.getPathname()).toBe('/flow/account');expect(flow.get().accountNotice).toBeNull();
});
test('queued production Account success stays under preferences until dismissal and checks owner at delivery',async()=>{
 const flow=harness();await startAccount(flow);await act(async()=>router.push('/preferences'));await completeAccount(flow);expect(flow.view.getPathname()).toBe('/preferences');flow.owner('replacement');await act(async()=>router.back());expect(flow.view.getPathname()).toBe('/profile');expect(flow.view.queryByTestId('profile-detail')).toBeNull();
});
test('queued production Account Cancel returns to exact page after the public sheet closes',async()=>{
 const flow=harness('/profile/settings');await startAccount(flow);await act(async()=>router.push('/preferences'));await completeAccount(flow,true);expect(flow.view.getPathname()).toBe('/preferences');await act(async()=>router.back());expect(flow.view.getPathname()).toBe('/profile/settings');
});
test('original root Profile Account success still uses its terminal root fallback and notice',async()=>{
 const flow=harness('/profile');await startAccount(flow);await completeAccount(flow);expect(flow.view.getPathname()).toBe('/profile');expect(flow.get().accountNotice).toBe('Your account is connected');
});
test.each([false,true])('production ordinary Profile paywall %s return preserves exact originating page',async queued=>{
 const flow=harness('/profile/membership');await act(async()=>{});await act(async()=>flow.get().openProfilePaywall('membership'));expect(flow.view.getPathname()).toBe('/flow/paywall');if(queued)await act(async()=>router.push('/preferences'));await act(async()=>flow.get().returnFromPaywall());if(queued){expect(flow.view.getPathname()).toBe('/preferences');await act(async()=>router.back());}expect(flow.view.getPathname()).toBe('/profile/membership');
});
test.each(['owner','operation','token'])('queued production private paywall return rejects stale %s',async stale=>{
 const flow=harness('/profile/membership');await act(async()=>{});await act(async()=>flow.get().openProfilePaywall('membership'));await act(async()=>router.push('/preferences'));await act(async()=>flow.get().returnFromPaywall());if(stale==='owner')flow.owner('replacement');else if(stale==='operation')flow.get().accountOperationGate.current.invalidate();else flow.get().paywallNavigationRef.current.open();await act(async()=>router.back());expect(flow.view.getPathname()).toBe('/flow/paywall');
});
test('feature purchase origin keeps priority over a private Profile origin',async()=>{
 const flow=harness('/profile/membership');await act(async()=>{});await act(async()=>{flow.get().openProfilePaywall('membership');});await act(async()=>flow.get().openPaywall('monthly-report'));await act(async()=>flow.get().returnFromPaywall());expect(flow.view.getPathname()).toBe('/flow/feature');
});
test('cold coordinator uses exact authorized fallback and refuses invalid and stale inputs',async()=>{
 const flow=harness('/flow/account');await act(async()=>{});await act(async()=>flow.get().navigation.returnProfileSection('backup',()=>true));expect(flow.view.getPathname()).toBe('/profile/backup');await act(async()=>{flow.get().navigation.returnProfileSection('../account' as any,()=>true);flow.get().navigation.returnProfileSection('settings',()=>false);});expect(flow.view.getPathname()).toBe('/profile/backup');
});

test('cold private return builds a real Profile Back anchor',async()=>{const flow=harness('/flow/account');await act(async()=>{});await act(async()=>flow.get().navigation.returnProfileSection('settings',()=>true));expect(flow.view.getPathname()).toBe('/profile/settings');await act(async()=>router.back());expect(flow.view.getPathname()).toBe('/profile');});

test('production automatic Account advance cannot override private success or explicit Cancel queued under a public sheet',async()=>{for(const cancel of [false,true]){const flow=harness();await startAccount(flow);await act(async()=>router.push('/preferences'));await completeAccount(flow,cancel);expect(flow.view.getPathname()).toBe('/preferences');await act(async()=>router.back());expect(flow.view.getPathname()).toBe('/profile/account');expect(flow.get().profileAccountOrigin.current).toBeNull();flow.view.unmount();}});
