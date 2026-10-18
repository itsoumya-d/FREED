// Only the external Firebase session boundary is stubbed; group controllers and editor bindings remain real.
jest.mock('@/lib/firebase-native', () => {
  const snapshot = { status: 'ready', reason: null, admission: null, revision: 1 };
  return { getFirebaseNativeAccountSessionSnapshot: () => snapshot,
    subscribeFirebaseNativeAccountSession: () => () => {},
    getFirebaseAuthSnapshot: () => ({ status: 'ready', signedIn: true }),
    getFirebaseNativeAccountAdmission: () => null,
    reconcileFirebaseNativeAccountSession: async () => null };
});
import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { AppGroupEditor } from '@/components/AppGroupsScreen';
import { createAppGroupsController } from '@/lib/app-groups-controller';
import type { AppGroupsBinding } from '@/hooks/use-app-groups';
import type { AppGroup, AppGroupsSnapshot } from '@/lib/app-groups-contract';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('freed-protection',()=>({}));
jest.mock('expo-router',()=>({useFocusEffect:()=>undefined}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/components/NativeAppGroupLabels',()=>({NativeAppGroupLabels:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
const group:AppGroup={id:'focus',revision:2,name:'Focus',enabled:true,rule:{kind:'daily-limit',limitMinutes:30},packages:[],applicationCount:2,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:true,active:true,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null};
const status:AppGroupsSnapshot={version:1,supported:true,platform:'ios',revision:7,configurationGeneration:1,scopeEpoch:2,groups:[group],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:1,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const bindingReceipt={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:1,scopeEpoch:2,errorCode:null,errorDomain:null};
const diagnostics={version:1,operation:'update',operationId:'11111111-1111-4111-8111-111111111111',stage:'monitor-registration',reason:'monitor-registration-failed',configurationGeneration:1,storeRevision:7,groupRevision:2,errorCode:5,errorDomain:'DeviceActivity.DeviceActivityCenter.MonitoringError'};
function setup(options?:{bind?:()=>Promise<unknown>;mutate?:()=>Promise<any>}){
 let scope:string|null='["owner",1]';
 const mutate=jest.fn(options?.mutate??(async()=>({accepted:false,reason:'monitor-registration-failed',snapshot:status,diagnostics})));
 const controller=createAppGroupsController({getScope:()=>scope,bind:options?.bind??(async()=>bindingReceipt),suspend:async()=>true,read:async()=>status,mutate});
 const close=jest.fn();
 function Screen(){
  const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  // Retain the rule being edited; failed binding must not erase the working rule.
  const binding={...state,status:state.status.supported?state.status:status,earnedTimeAvailable:false,refresh:controller.refresh,update:(q:unknown)=>controller.mutate('update',q),updateEarned:(q:unknown)=>controller.mutate('update-earned',q),remove:(q:unknown)=>controller.mutate('remove',q),picker:(q:unknown)=>controller.mutate('picker',q),discard:(q:unknown)=>controller.mutate('discard',q),create:()=>controller.mutate('create',{}),acknowledge:controller.acknowledge} as AppGroupsBinding;
  return <AppGroupEditor group={group} binding={binding} onClose={close}/>;
 }
 return {view:render(<Screen/>),controller,mutate,close,setScope:(next:string|null)=>{scope=next;}};
}
beforeEach(()=>localStorage.clear());
test('async rejected binding shows the current storage failure and safe binding details beside the pinned action',async()=>{
 const f=setup({bind:async()=>({...bindingReceipt,accepted:false,bindingCurrent:false,stage:'state-read',reason:'state-storage-unavailable',errorDomain:'NSPOSIXErrorDomain',errorCode:13,privateOwner:'do-not-show'})});
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 const footer=within(f.view.getByTestId('group-editor-footer'));
 expect(footer.getByRole('alert')).toHaveTextContent(/storage could not be opened/);
 expect(footer.queryByTestId('group-failure-diagnostics')).toBeNull();
 fireEvent.press(footer.getByTestId('group-failure-details-toggle'));
 expect(footer.getByTestId('group-failure-diagnostics')).toHaveTextContent('state-read · state-storage-unavailable · NSPOSIXErrorDomain · 13');
 expect(JSON.stringify(f.view.toJSON())).not.toContain('do-not-show');expect(f.mutate).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();
});
test('a native registration rejection retains the active rule and failure across ordinary refresh',async()=>{
 const f=setup();await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 const footer=within(f.view.getByTestId('group-editor-footer'));
 expect(footer.getByRole('alert')).toHaveTextContent(/register this rule/);expect(footer.getByRole('alert')).not.toHaveTextContent(/Check permissions/);
 fireEvent.press(footer.getByTestId('group-failure-details-toggle'));
 expect(footer.getByTestId('group-failure-diagnostics')).toHaveTextContent(/monitor-registration/);
 await act(async()=>{await f.controller.refresh();});
 expect(footer.getByRole('alert')).toHaveTextContent(/register this rule/);expect(f.controller.getSnapshot().status.groups[0]).toEqual(group);expect(f.close).not.toHaveBeenCalled();
});
test('unknown native failures ask for retry without guessing a permission problem',async()=>{
 const f=setup({mutate:async()=>({accepted:false,reason:'unclassified-native-failure',snapshot:status})});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 const footer=within(f.view.getByTestId('group-editor-footer'));expect(footer.getByRole('alert')).toHaveTextContent(/not confirmed/);expect(footer.getByRole('alert')).not.toHaveTextContent(/permissions/);expect(f.close).not.toHaveBeenCalled();
});
test('null result after an owner switch does not expose the obsolete native receipt or close the editor',async()=>{
 let finish!:(value:any)=>void;const pending=new Promise<any>(resolve=>{finish=resolve;});const f=setup({mutate:()=>pending});
 await act(async()=>{fireEvent.press(f.view.getByTestId('group-update'));await Promise.resolve();});
 await act(async()=>{f.setScope('["another-owner",2]');const read=f.controller.refresh();finish({accepted:false,reason:'monitor-registration-failed',snapshot:status,diagnostics});await read;});
 expect(f.controller.getSnapshot().actionDiagnostics).toBeNull();expect(f.view.queryByTestId('group-failure-diagnostics')).toBeNull();expect(f.close).not.toHaveBeenCalled();
});
test.each([
 ['authorization-or-app-selection-required',/Allow Screen Time and select individual apps/],
 ['monitor-capacity',/monitoring slots/],
 ['monitor-readback-failed',/did not confirm this rule/],
 ['group-shield-readback-failed',/did not confirm this rule/],
 ['group-revision-stale',/Review its current settings/],
 ['configuration-execution-expired',/Keep FREED open/],
])('rejection %s identifies its actual repair without closing or changing the saved rule',async(reason,message)=>{
 const f=setup({mutate:async()=>({accepted:false,reason,snapshot:status})});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 expect(within(f.view.getByTestId('group-editor-footer')).getByRole('alert')).toHaveTextContent(message);expect(f.close).not.toHaveBeenCalled();expect(f.controller.getSnapshot().status.groups[0]).toEqual(group);
});
test('a thrown adapter operation becomes a neutral retry state without inventing native error details',async()=>{
 const f=setup({mutate:async()=>{throw new Error('private-token');}});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 const footer=within(f.view.getByTestId('group-editor-footer'));expect(footer.getByRole('alert')).toHaveTextContent(/not confirmed/);expect(footer.queryByTestId('group-failure-details-toggle')).toBeNull();expect(JSON.stringify(f.view.toJSON())).not.toContain('private-token');expect(f.close).not.toHaveBeenCalled();
});
test.each([null,{...bindingReceipt,stage:'private-token'}])('invalid binding %p cannot fabricate a native storage diagnosis',async(value)=>{
 const f=setup({bind:async()=>value});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 const footer=within(f.view.getByTestId('group-editor-footer'));expect(footer.getByRole('alert')).toHaveTextContent(/not confirmed/);expect(footer.getByRole('alert')).not.toHaveTextContent(/storage/);expect(footer.queryByTestId('group-failure-details-toggle')).toBeNull();expect(f.mutate).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();
});

 test('clock bootstrap failure exposes only validated adapter facts beside retained activation',async()=>{
 const clockDiagnostics={...diagnostics,stage:'clock-validation',reason:'earned-time-clock-unverified',clockBootAvailable:false,clockBootSource:'unavailable',clockBootStage:'boottime-read',clockBootErrno:13,clockPrimaryStage:'uuid-size',clockPrimaryErrno:1,clockBudgetPhase:'bootstrap',clockWallValid:true,clockUptimeValid:true,clockCalendarValid:true,bootIdentity:'private-boot',ownerDigest:'private-owner',wall:1900022400};
 const f=setup({mutate:async()=>({accepted:false,reason:clockDiagnostics.reason,snapshot:status,diagnostics:clockDiagnostics})});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 const footer=within(f.view.getByTestId('group-editor-footer'));fireEvent.press(footer.getByTestId('group-failure-details-toggle'));
 const detail=footer.getByTestId('group-failure-diagnostics');expect(detail).toHaveTextContent(/clockBootAvailable=false/);expect(detail).toHaveTextContent(/clockBootSource=unavailable/);expect(detail).toHaveTextContent(/clockBootErrno=13/);expect(detail).toHaveTextContent(/clockBudgetPhase=bootstrap/);
 expect(JSON.stringify(f.view.toJSON())).not.toContain('private-boot');expect(JSON.stringify(f.view.toJSON())).not.toContain('private-owner');expect(JSON.stringify(f.view.toJSON())).not.toContain('1900022400');expect(f.close).not.toHaveBeenCalled();expect(f.controller.getSnapshot().status.groups[0]).toEqual(group);
 });
