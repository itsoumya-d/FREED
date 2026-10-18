import React from 'react';
import { AppState, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const ActualAdapter = jest.requireActual('../../modules/freed-protection/src/index');
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { IOSWebsiteProtectionSetup } from '@/components/IOSWebsiteProtectionSetup';
import { getProtectionSetupReadiness } from '@/lib/protection-readiness';
import { createProtectionRefreshCoordinator } from '@/lib/website-protection-operations';
import { useEncryptedDns } from '@/hooks/use-encrypted-dns';
import { getJourneyOwner } from '@/lib/user-journey';
import { appI18n } from '@/i18n/runtime';
import * as Native from 'freed-protection';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:mockMode}),useOptionalAppPreferences:()=>null}));
jest.mock('expo-router',()=>({useFocusEffect:(effect:()=>unknown)=>require('react').useEffect(effect,[effect])}));
jest.mock('@/lib/adult-domain-feed-sync',()=>({syncNativeAdultDomainFeed:jest.fn()}));
jest.mock('freed-protection',()=>({getProtectionCapabilities:jest.fn(),getProtectionStatus:jest.fn(),getEncryptedDnsStatus:jest.fn(),configureEncryptedDns:jest.fn(),applyAdultContentFilter:jest.fn(),requestProtectionAuthorization:jest.fn(),openProtectionSettings:jest.fn(),openSafariExtensionSettings:jest.fn()}));
let mockMode:'light'|'dark'='light';
const mockStatusAbi = JSON.parse(readFileSync('modules/freed-protection/tests/fixtures/status-v2-abi.json', 'utf8'));
const mockBinding = { ...mockStatusAbi.binding, actionScope: JSON.stringify(['owner', 1, mockStatusAbi.binding.bindingHandle]) };
const mockStatusBinding = { ...mockStatusAbi.private.statusBinding, actionScope: mockBinding.actionScope };
let mockCarrier: object;
let mockAccountCurrent = () => true;
let mockAccountSession: ReturnType<typeof ActualAdapter.createNativeAccountSession>;
const mockNativeBoundary:any={
 FreedAccountBindingSession: class { constructor() { mockCarrier = this; } release() {} },
 prepareAccountBindingV2: jest.fn(), commitAccountBindingV2: jest.fn(),
 getStatus: jest.fn(), getStatusV2: jest.fn(), getDevicePublicStatus: jest.fn(), getSafariRecoveryObservation:jest.fn()
};
jest.mock('expo-modules-core',()=>({...jest.requireActual('expo-modules-core'),requireNativeModule:()=>mockNativeBoundary}));
const capability:any={platform:'ios',screenTime:true,managedSettings:true,safariContentBlocker:true,notes:[]};
const policy:any={authorized:true,adultFilterActive:true,adultWebPolicyConfigured:true,active:true,mode:'screen-time',message:''};
const enabled:any={supported:true,releaseEnabled:true,configured:true,enabled:true,healthy:null,provider:'cloudflare-families',reason:null,requiresSettings:false,configurationLabel:'FREED DNS'};
function deferred(){let resolve!:(v:any)=>void;const promise=new Promise<any>(yes=>{resolve=yes;});return {promise,resolve};}
/** Executes the actual named Root action getter, read-ticket capture, projection,
 * native refresh callback and live-revision subscription, then the real parent. */
function fixture(options:{generic?:boolean;actual?:boolean}={}){
 const source=readFileSync(process.env.FREED_TASK96B_ROOT_SOURCE ?? 'src/features/freed-app.tsx','utf8');
 const slice=(start:string,end:string)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 const getter=slice('  const getProtectionActionScope =','  const knownProtectionScope =');
 const actionTicket=slice('  const captureProtectionActionTicket =','  const appGroups =');
 const refresh=slice('  const projectGenericProtectionStatus =','\n  React.useEffect(() => {\n    void refreshProtectionStatus();');
 const lifecycle=slice('  React.useEffect(() => {\n    protectionHostAlive.current = true;', '  const projectGenericProtectionStatus =');
 const subscription=source.match(/  const protectionReadRevision = React\.useSyncExternalStore\([^;]+;/)?.[0]??'const protectionReadRevision = 0;';
 let api:any;const nativeResults:any[]=[];
 const auth:any={status:'ready',signedIn:true,anonymous:false,ownerUid:'owner',email:null};
 const state:any={owner:'owner',auth,live:true,privateReady:!options.generic};
 if(options.actual)mockAccountCurrent=()=>state.privateReady && state.live && state.owner==='owner' && state.auth.ownerUid==='owner';
 const admission=()=>options.actual ? mockAccountCurrent()&&ActualAdapter.isNativeAccountActionScopeCurrent(mockBinding.actionScope)?{...mockBinding,ownerUid:'owner'}:null : state.privateReady?{ownerUid:state.owner,actionScope:'scope-'+state.owner}:null;
 const deps:any={React,ProtectionFeatureSetup,useEncryptedDns,createProtectionRefreshCoordinator,Platform:{OS:'ios'},getJourneyOwner,getFirebaseAuthSnapshot:()=>auth,getFirebaseAccountScope:()=>state.owner,getFirebaseNativeAccountAdmission:admission,state,retireFirebaseNativeAccountSession:()=>{if(options.actual)mockAccountSession?.retire();},suspendAppGroupOperations:jest.fn(),getProtectionCapabilities:Native.getProtectionCapabilities,getProtectionStatus:Native.getProtectionStatus,initialCapability:capability,initialPolicy:policy,nativeResults,capture:(value:any)=>{api=value;}};
 const script=`return function ActualReadHost(){
 const protectionReadback=React.useRef(createProtectionRefreshCoordinator({capability:initialCapability,status:initialPolicy}));
 ${subscription}
 const [protectionCapability,setProtectionCapability]=React.useState(initialCapability),[protectionStatus,setProtectionStatusRaw]=React.useState(initialPolicy);
 const setProtectionRefreshCompleted=()=>{};
 const nativePrivateReadState=React.useRef({hydrated:true,storageReady:true,ownerLease:{ownerUid:state.owner,isCurrent:()=>state.privateReady}});nativePrivateReadState.current={hydrated:true,storageReady:true,ownerLease:{ownerUid:state.owner,isCurrent:()=>state.privateReady}};
 const accountFlowFence=React.useRef({isActive:()=>false});
 const appGroupsMemorySuspended=React.useRef(false),appGroupsSuspensionEpoch=React.useRef(0),accountHostGeneration=React.useRef(4),privateLockedRef=React.useRef(false),protectionHostAlive=React.useRef(true);protectionHostAlive.current=state.live;
 ${lifecycle}${getter}${actionTicket}${refresh}
 const dns=useEncryptedDns();
 const observedRefresh=React.useCallback(async()=>{const result=await refreshProtectionStatus();nativeResults.push(result);return result;},[refreshProtectionStatus]);
 capture({refreshProtectionStatus,dns,coordinator:protectionReadback.current,getProtectionActionScope,captureProtectionActionTicket,nativeResults,protectionReadRevision});
 return <ProtectionFeatureSetup intent="websites" capability={protectionCapability} status={protectionStatus} appCount={0} nativeReadRevision={protectionReadRevision} getActionScope={getProtectionActionScope} onRefresh={observedRefresh} onChooseApps={()=>{}} onSyncApps={async()=>initialPolicy} onClose={()=>{}} vpnDisclosureAcknowledged={false} onAcknowledgeVpnDisclosure={()=>{}}/>;
 };`;
 if(process.env.FREED_TASK96B_PACKET){const dir=process.env.FREED_TASK96B_EXECUTION?process.env.FREED_TASK96B_EXECUTION+'/root':process.env.FREED_TASK96B_PACKET+'/root-execution';mkdirSync(dir,{recursive:true});writeFileSync(dir+'/extracted.tsx',script);writeFileSync(dir+'/executed.cjs',transpileModule(script,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText);writeFileSync(dir+'/root-input.tsx',source);}
 const Host=new Function(...Object.keys(deps),transpileModule(script,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText)(...Object.values(deps));
 if(options.actual)(Native.getProtectionStatus as jest.Mock).mockImplementation(()=>ActualAdapter.getProtectionStatus());
 return {Host,get:()=>api,state};
}
beforeEach(async()=>{
 (AppState as any).currentState='active';mockMode='light';jest.clearAllMocks();await appI18n.changeLanguage('en');(Platform as any).OS='ios';
 (Native.getProtectionCapabilities as jest.Mock).mockResolvedValue(capability);(Native.getProtectionStatus as jest.Mock).mockResolvedValue(policy);(Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(enabled);
 mockNativeBoundary.getStatus.mockImplementation(()=>{throw Error('Legacy iOS status must never be read');});
 mockNativeBoundary.prepareAccountBindingV2.mockResolvedValue(mockStatusAbi.preparation);mockNativeBoundary.commitAccountBindingV2.mockResolvedValue(mockBinding);
 mockNativeBoundary.getStatusV2.mockImplementation(async(carrier:object,scope:string)=>{expect(carrier).toBe(mockCarrier);expect(scope).toBe(mockBinding.actionScope);return {...mockStatusAbi.private,...policy,statusBinding:mockStatusBinding};});
 mockNativeBoundary.getDevicePublicStatus.mockResolvedValue(mockStatusAbi.public);mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(null);
 mockAccountCurrent=()=>true;mockAccountSession=ActualAdapter.createNativeAccountSession(()=>mockAccountCurrent());expect(mockAccountSession).not.toBeNull();
 const prepared=await mockAccountSession!.prepare('owner','11111111-1111-4111-8111-111111111111',1);await mockAccountSession!.commit(prepared.ticket);expect(ActualAdapter.isNativeAccountActionScopeCurrent(mockBinding.actionScope)).toBe(true);
});

test('M1 first unresolved actual DNS read is Not confirmed in Review, then known unsupported stays distinct',async()=>{
 const read=deferred();(Native.getEncryptedDnsStatus as jest.Mock).mockReturnValueOnce(read.promise);const f=fixture(),view=render(<f.Host/>);await act(async()=>{});fireEvent.press(view.getByTestId('website-review-setup'));
 try{expect(view.getByTestId('website-reviewed-dns-status')).toHaveTextContent(/^Not confirmed$/);expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByTestId('dns-consent-open')).toBeNull();}
 finally{await act(async()=>{read.resolve({...enabled,supported:false,releaseEnabled:false,configured:false,enabled:false,reason:'ios-dns-simulator-unavailable'});});}
 expect(view.getByTestId('website-reviewed-dns-status')).toHaveTextContent(/^Unsupported$/);view.unmount();
});

test('I1 actual native A resolves, DNS A stays/coalesces, native B begins: DNS A completion cannot advance the old pair',async()=>{
 const f=fixture(),view=render(<f.Host/>);await act(async()=>{});const scope=f.get().getProtectionActionScope(),authority=f.get().captureProtectionActionTicket(scope);
 const dnsA=deferred(),nativeB=deferred();(Native.getEncryptedDnsStatus as jest.Mock).mockReturnValueOnce(dnsA.promise);
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 const nativeA=f.get().nativeResults.at(-1);expect(nativeA.status).toEqual(policy);const dnsReads=(Native.getEncryptedDnsStatus as jest.Mock).mock.calls.length;
 (Native.getProtectionStatus as jest.Mock).mockReturnValueOnce(nativeB.promise);let readB!:Promise<any>,coalesced!:Promise<any>;
 await act(async()=>{readB=f.get().refreshProtectionStatus();coalesced=f.get().dns.refresh();});
 expect((Native.getEncryptedDnsStatus as jest.Mock).mock.calls.length).toBe(dnsReads);expect(f.get().getProtectionActionScope()).toBe(scope);expect(authority.isCurrent()).toBe(true);
 try{await act(async()=>{dnsA.resolve(enabled);await coalesced;});expect(view.queryByTestId('website-safari-recovery')).toBeNull();expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();fireEvent.press(view.getByTestId('website-review-setup'));expect(view.getByTestId('website-review-configuration')).toHaveTextContent(/Not confirmed/);}
 finally{await act(async()=>{nativeB.resolve(policy);await readB;});}
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});expect(view.getByTestId('website-safari-recovery')).toBeOnTheScreen();view.unmount();
});

test('I1 live native-only read revision invalidates displayed pair before unchanged readiness settles; its own read stays valid',async()=>{
 const f=fixture(),view=render(<f.Host/>);await act(async()=>{});await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});expect(view.getByTestId('website-safari-recovery')).toBeOnTheScreen();
 const statusBefore=f.get().coordinator.getSnapshot().status,dnsBefore=f.get().dns.status,next=deferred();(Native.getProtectionStatus as jest.Mock).mockReturnValueOnce(next.promise);let pending!:Promise<any>;
 await act(async()=>{pending=f.get().refreshProtectionStatus();});
 try{expect(f.get().coordinator.getSnapshot().status).toBe(statusBefore);expect(f.get().dns.status).toBe(dnsBefore);expect(view.queryByTestId('website-safari-recovery')).toBeNull();expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();}
 finally{await act(async()=>{next.resolve(policy);await pending;});}
 expect(view.queryByTestId('website-safari-recovery')).toBeNull();await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});expect(view.getByTestId('website-safari-recovery')).toBeOnTheScreen();view.unmount();
});

function freshSafari(){ const now=new Date().toISOString();return {version:1,freshness:'fresh',reason:'none',enabled:{value:true,reason:'observed',checkedAt:now},receipt:{version:1,revision:1,packageVariant:'adult-recovery-internal-v1',bundleArtifactDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),generation:2,nativeEpoch:3,presentationEpoch:4,receivedAt:now,expiresAt:new Date(Date.parse(now)+300000).toISOString(),context:'profile-and-private-unqualified',facts:{bundleArtifactDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),staticRules:'expected-enabled',dynamicRules:'zero',sessionRules:'zero',grants:'complete',requiredScopeCount:20,coveredScopeCount:20,diagnostic:'none'}} }; }
// Removing the actual adapter join or generic single-field projection defeats this visible result.
test.each([false,true])('actual adapter → Root %s generic projection → parent → screen shows a checked historical configuration only',async generic=>{
 const observation=freshSafari();mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(observation);const f=fixture({generic,actual:true}),view=render(<f.Host/>);await act(async()=>{});
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
 expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Configuration checked');expect(view.getByTestId('website-safari-last-check')).toHaveTextContent(/Last configuration check/);
 expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');
 // Repair navigation is always available; its handoff confers no configuration evidence.
 expect(view.getByTestId('website-safari-recovery-setup').props.accessibilityLabel).toBe('Open Safari settings');
 expect(mockNativeBoundary[generic?'getDevicePublicStatus':'getStatusV2']).toHaveBeenCalled();expect(mockNativeBoundary[generic?'getStatusV2':'getDevicePublicStatus']).not.toHaveBeenCalled();
 expect(f.get().coordinator.getSnapshot().status.statusReadError).toBeUndefined();view.unmount();
});
test('late actual adapter read for owner A cannot supply owner B with Safari configuration evidence',async()=>{
 const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});const held=deferred();mockNativeBoundary.getSafariRecoveryObservation.mockReturnValueOnce(held.promise);
 await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});f.state.owner='owner-b';f.state.auth.ownerUid='owner-b';view.rerender(<f.Host/>);
 await act(async()=>{held.resolve(freshSafari());});expect(view.queryByTestId('website-safari-last-check')).toBeNull();expect(view.getByTestId('website-configuration-check')).toBeOnTheScreen();view.unmount();
});

async function readConfiguration(view:ReturnType<typeof render>) {await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});}
function stateListener(){const listeners:Array<(state:string)=>void>=[];jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{listeners.push(listener);return {remove:jest.fn()};});return async(state:string)=>{await act(async()=>{(AppState as any).currentState=state;listeners.forEach(listener=>listener(state));});};}
afterEach(()=>{expect(mockNativeBoundary.getStatus).not.toHaveBeenCalled();mockAccountSession?.retire();jest.restoreAllMocks();jest.useRealTimers();});
test.each(['light','dark'] as const)('checked Safari configuration retains natural-height labeled controls in %s',async mode=>{
 mockMode=mode;mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(freshSafari());const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);
 fireEvent.press(view.getByTestId('website-safari-details'));expect(view.getByTestId('website-safari-detail-package')).toHaveTextContent(/internal, unverified/);expect(view.getByTestId('website-safari-detail-enabled')).toHaveTextContent(/Enabled$/);expect(view.getByTestId('website-safari-detail-staticRules')).toHaveTextContent(/Expected IDs enabled$/);
 const button=view.getByTestId('website-safari-refresh');expect(button.props.accessibilityLabel).toBe('Refresh');expect(button).toHaveStyle({minHeight:48});expect(view.getByTestId('website-safari-details').props.accessibilityState.expanded).toBe(true);view.unmount();
});
test.each(['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'])('actual Safari check renders localized semantic copy and dates in %s',async language=>{
 await appI18n.changeLanguage(language);mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(freshSafari());const f=fixture({actual:true,generic:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);
 expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent(appI18n.t('safariConfiguration.configurationChecked'));fireEvent.press(view.getByTestId('website-safari-details'));
 expect(view.getByTestId('website-safari-detail-grants')).toHaveTextContent(appI18n.t('safariConfiguration.detail.grants',{value:appI18n.t('safariConfiguration.fact.complete')}));expect(view.getByTestId('website-safari-refresh').props.accessibilityLabel).toBe(appI18n.t('safariConfiguration.refresh'));view.unmount();
});
test.each(['absent','malformed','rejected','partial','missing','dynamic','static','unknown','reset','expired','disabled','unknown-enabled','short-form','probe'])('actual read renders %s without inflating recovery or protection',async scenario=>{
 const observation:any=freshSafari();
 if(scenario==='absent')Object.assign(observation,{receipt:null,freshness:'absent'});
 if(scenario==='malformed')observation.secret='reject';
 if(scenario==='partial'||scenario==='missing'){observation.receipt.facts.grants=scenario;observation.receipt.facts.coveredScopeCount=scenario==='partial'?1:0;}
 if(scenario==='dynamic')observation.receipt.facts.dynamicRules='nonzero';
 if(scenario==='static')observation.receipt.facts.staticRules='unexpected';
 if(scenario==='unknown'){observation.receipt.facts.grants='unknown';observation.receipt.facts.coveredScopeCount=null;}
 if(scenario==='reset'||scenario==='expired')Object.assign(observation,{freshness:'historical',reason:scenario});
 if(scenario==='disabled'){Object.assign(observation,{freshness:'historical',reason:'native-disabled'});observation.enabled.value=false;}
 if(scenario==='unknown-enabled')observation.enabled={value:null,checkedAt:null,reason:'unsupported-os'};
 if(scenario==='short-form'){observation.receipt.packageVariant='short-form-v1';observation.receipt.facts.staticRules='not-configured';}
 if(scenario==='probe')observation.receipt.packageVariant='safe-recovery-probe-v1';
 if(scenario==='rejected')mockNativeBoundary.getSafariRecoveryObservation.mockRejectedValue(Error('native rejection'));else mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(observation);
 const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);
 const checked=['unknown-enabled','short-form','probe'].includes(scenario);expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent(checked?'Configuration checked':'Not confirmed');expect(f.get().coordinator.getSnapshot().status.adultWebPolicyConfigured).toBe(true);expect(view.getByTestId('website-overall-status')).toHaveTextContent('Needs attention');expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');
 expect(view.getByTestId('website-safari-recovery-setup').props.accessibilityLabel).toBe('Open Safari settings');
 if(['short-form','probe'].includes(scenario)){expect(view.getByTestId('website-safari-guidance')).toHaveTextContent(/no adult-recovery package/);expect(view.queryByTestId('website-safari-refresh')).toBeNull();}
 if(scenario==='absent')expect(view.getByTestId('website-safari-guidance')).toHaveTextContent(/Safari → Extensions.*Check Safari/);
 if(scenario==='unknown-enabled'){fireEvent.press(view.getByTestId('website-safari-details'));expect(view.getByTestId('website-safari-detail-enabled')).toHaveTextContent(/Unknown$/);expect(view.getByText(/This iOS version cannot report/)).toBeOnTheScreen();}
 view.unmount();
});
test('a newer actual Root read immediately removes old Safari acknowledgement even before unchanged native facts settle',async()=>{
 mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(freshSafari());const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);expect(view.getByTestId('website-safari-last-check')).toBeOnTheScreen();
 const newer=deferred();mockNativeBoundary.getSafariRecoveryObservation.mockReturnValueOnce(newer.promise);let reading!:Promise<any>;await act(async()=>{reading=f.get().refreshProtectionStatus();});expect(view.queryByTestId('website-safari-last-check')).toBeNull();await act(async()=>{newer.resolve(freshSafari());await reading;});expect(view.queryByTestId('website-safari-last-check')).toBeNull();await readConfiguration(view);expect(view.getByTestId('website-safari-last-check')).toBeOnTheScreen();view.unmount();
});
test.each(['native-first','dns-first'])('actual Safari observation and DNS %s callbacks require the complete current pair',async order=>{
 const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});const native=deferred(),dns=deferred();mockNativeBoundary.getSafariRecoveryObservation.mockReturnValueOnce(native.promise);(Native.getEncryptedDnsStatus as jest.Mock).mockReturnValueOnce(dns.promise);
 await readConfiguration(view);await act(async()=>{if(order==='native-first')native.resolve(freshSafari());else dns.resolve(enabled);});expect(view.queryByTestId('website-safari-last-check')).toBeNull();await act(async()=>{if(order==='native-first')dns.resolve(enabled);else native.resolve(freshSafari());});expect(view.getByTestId('website-safari-last-check')).toBeOnTheScreen();view.unmount();
});
test('a legitimate own-extension check while backgrounded survives the foreground paired refresh',async()=>{
 const change=stateListener(),f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');
 await change('background');mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(freshSafari());await change('active');expect(view.getByTestId('website-safari-last-check')).toBeOnTheScreen();expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();expect(mockNativeBoundary.getStatusV2).toHaveBeenCalled();view.unmount();
});
test('Settings success with no native receipt remains unconfirmed and never acts as Check Safari',async()=>{
 const absent={version:1,receipt:null,freshness:'absent',reason:'none',enabled:{value:false,checkedAt:new Date().toISOString(),reason:'observed'}};mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(absent);(Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue({...policy,safariExtensionSettingsOpened:true,safariExtensionSettingsTarget:'focus-shield',safariExtensionSettingsRoute:'extension'});
 const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);expect(view.getByTestId('website-safari-recovery-setup').props.accessibilityLabel).toBe('Open Safari settings');await act(async()=>{fireEvent.press(view.getByTestId('website-safari-recovery-setup'));});
 expect(view.queryByTestId('website-safari-last-check')).toBeNull();fireEvent.press(view.getByTestId('website-review-setup'));expect(view.getByTestId('website-review-safari')).toHaveTextContent(/Not confirmed/);expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/Enable FREED Focus Shield/);view.unmount();
});
test('displayed native receipt expires while the screen remains open',async()=>{
 jest.useFakeTimers();mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(freshSafari());const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);expect(view.getByTestId('website-safari-last-check')).toBeOnTheScreen();await act(async()=>{jest.advanceTimersByTime(300001);});expect(view.queryByTestId('website-safari-last-check')).toBeNull();expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');expect(view.getByTestId('website-safari-guidance')).toHaveTextContent(/expired/);view.unmount();
});
test.each(['ownerless','host-retired'])('actual generic %s reader preserves device-only observation without private authority',async scenario=>{
 mockNativeBoundary.getStatusV2.mockResolvedValue({...mockStatusAbi.private,...policy,statusBinding:mockStatusBinding,selectedApplicationCount:99,nativeUnlockGrantAccepted:true,nativeUnlockGrantInterventionId:'private-id'});mockNativeBoundary.getSafariRecoveryObservation.mockResolvedValue(freshSafari());const f=fixture({actual:true,generic:true});if(scenario==='ownerless'){f.state.owner=null;Object.assign(f.state.auth,{signedIn:false,ownerUid:null,status:'signed-out'});}const view=render(<f.Host/>);await act(async()=>{});
 if(scenario==='host-retired'){const pending=deferred();mockNativeBoundary.getSafariRecoveryObservation.mockReturnValueOnce(pending.promise);let result!:Promise<any>;await act(async()=>{result=f.get().refreshProtectionStatus();});f.state.live=false;view.rerender(<f.Host/>);await act(async()=>{pending.resolve(freshSafari());});expect((await result).superseded).toBe(true);}
 else {await readConfiguration(view);expect(view.getByTestId('website-safari-last-check')).toBeOnTheScreen();const status=f.get().coordinator.getSnapshot().status;expect(status.selectedApplicationCount).toBeUndefined();expect(status.nativeUnlockGrantAccepted).toBeUndefined();expect(f.get().getProtectionActionScope()).toBeNull();expect(mockNativeBoundary.getDevicePublicStatus).toHaveBeenCalled();expect(mockNativeBoundary.getStatusV2).not.toHaveBeenCalled();}view.unmount();
});

test('an observation arriving after actual Root host cleanup cannot publish status or a Safari check',async()=>{
 const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});const held=deferred();mockNativeBoundary.getSafariRecoveryObservation.mockReturnValueOnce(held.promise);let result!:Promise<any>;await act(async()=>{result=f.get().refreshProtectionStatus();});const coordinator=f.get().coordinator,before=coordinator.getSnapshot();view.unmount();await act(async()=>{held.resolve(freshSafari());});expect((await result).superseded).toBe(true);expect(coordinator.getSnapshot()).toBe(before);
});
test('the actual optional method missing in an older binary leaves configuration unavailable and baseline policy intact',async()=>{
 const method=mockNativeBoundary.getSafariRecoveryObservation;mockNativeBoundary.getSafariRecoveryObservation=undefined;
 try{const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});await readConfiguration(view);expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');expect(view.getByTestId('website-safari-guidance')).toHaveTextContent(/older build may need an update/);expect(f.get().coordinator.getSnapshot().status.adultWebPolicyConfigured).toBe(true);expect(view.queryByTestId('website-safari-last-check')).toBeNull();view.unmount();}finally{mockNativeBoundary.getSafariRecoveryObservation=method;}
});
test('actual optional-read timeout and its late receipt cannot display a configuration acknowledgement',async()=>{
 jest.useFakeTimers();const f=fixture({actual:true}),view=render(<f.Host/>);await act(async()=>{});const held=deferred();mockNativeBoundary.getSafariRecoveryObservation.mockReturnValueOnce(held.promise);await readConfiguration(view);expect(view.queryByTestId('website-safari-last-check')).toBeNull();await act(async()=>{jest.advanceTimersByTime(8001);});expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');await act(async()=>{held.resolve(freshSafari());});expect(view.queryByTestId('website-safari-last-check')).toBeNull();expect(f.get().coordinator.getSnapshot().status.adultWebPolicyConfigured).toBe(true);view.unmount();
});
test('unknown Safari recovery observation does not erase independently observed adult filtering',async()=>{
 function BaselineHost(){const dns=useEncryptedDns();return <IOSWebsiteProtectionSetup readiness={getProtectionSetupReadiness(capability,policy,0)} status={policy} authorized busy={false} error={null} observations={dns.lastCheckedAt?{readbackAt:dns.lastCheckedAt,enablement:'observed-current',routing:'observed-current',adultBrowsing:'observed-blocked',ordinaryBrowsing:'observed-allowed'}:null} onRun={()=>{}} onRefresh={async()=>({capability,status:policy,readTicket:{revision:1,isCurrent:()=>true}})} onClose={()=>{}} onOpenTest={()=>{}} onSafariRecoverySetup={()=>{}}/>;}
 const view=render(<BaselineHost/>);await act(async()=>{});expect(view.getByTestId('website-overall-status')).toHaveTextContent('On');expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Verified on this network.');expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');view.unmount();
});
