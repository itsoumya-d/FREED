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
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppGroupsScreen } from '@/components/AppGroupsScreen';
import * as Native from 'freed-protection';
import type { AppGroup, AppGroupsSnapshot } from '@/lib/app-groups-contract';
import { appGroupDraftKey } from '@/lib/app-group-drafts';
import { appI18n } from '@/i18n/runtime';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('expo-router',()=>({useFocusEffect:(f:()=>unknown)=>require('react').useEffect(f,[f])}));
jest.mock('freed-protection',()=>({setAppGroupActionScope:jest.fn(),suspendAppGroupOperations:jest.fn(),getAppGroups:jest.fn(),createAppGroup:jest.fn(),updateAppGroup:jest.fn(),removeAppGroup:jest.fn(),presentAppGroupPicker:jest.fn(),getInstalledGroupApps:jest.fn(),isNativeAccountActionScopeCurrent:jest.fn(),requestProtectionAuthorization:jest.fn(),openUsageAccessSettings:jest.fn(),openProtectionSettings:jest.fn()}));
const binding={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:1,scopeEpoch:1,errorCode:null,errorDomain:null};
const group:AppGroup={id:'shared-one',revision:1,name:'Work',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:['com.actual.app'],applicationCount:1,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:false,active:false,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null};
let status:AppGroupsSnapshot,epoch=200;
beforeEach(async()=>{epoch++;localStorage.clear();await appI18n.changeLanguage('en');status={version:1,supported:true,platform:'android',revision:1,configurationGeneration:1,scopeEpoch:epoch,groups:[{...group}],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
 (Native.isNativeAccountActionScopeCurrent as jest.Mock).mockImplementation((scope:unknown)=>scope===JSON.stringify(['owner',epoch]));
 (Native.setAppGroupActionScope as jest.Mock).mockResolvedValue(binding);(Native.suspendAppGroupOperations as jest.Mock).mockResolvedValue(true);(Native.getAppGroups as jest.Mock).mockImplementation(async()=>status);(Native.getInstalledGroupApps as jest.Mock).mockResolvedValue({supported:true,apps:[{packageName:'com.actual.app',name:'Actual app',iconUri:null,eligible:true}],total:1,nextOffset:null,reason:null});});
const setup=async(props:any={})=>{const view=render(<AppGroupsScreen getActionScope={()=>JSON.stringify(['owner',epoch])} {...props}/>);await act(async()=>{await new Promise(r=>setTimeout(r,200));});return view;};
const enabledGroup=()=>{status={...status,groups:[{...group,enabled:true,ready:true,active:true}]};};
const installedApps=()=>{(Native.getInstalledGroupApps as jest.Mock).mockResolvedValue({supported:true,apps:[{packageName:'com.actual.app',name:'Actual app',iconUri:null,eligible:true},{packageName:'com.new.app',name:'New app',iconUri:null,eligible:true}],total:2,nextOffset:null,reason:null});};
const chooseNewApp=async(view:ReturnType<typeof render>,open='apps-add')=>{
 await act(async()=>{fireEvent.press(view.getByTestId(open));await new Promise(r=>setTimeout(r,200));});
 await act(async()=>{await new Promise(r=>setTimeout(r,200));});
 fireEvent.press(view.getByRole('checkbox',{name:'New app'}));await act(async()=>{fireEvent.press(view.getByTestId('group-apps-done'));});
};
test('Apps first shows selected app and shared rule, with groups behind organizer',async()=>{
 const manage=jest.fn(),view=await setup({onManageGroups:manage});
 expect(view.getByRole('header',{name:'Apps'})).toBeOnTheScreen();expect(view.getByText('Actual app')).toBeOnTheScreen();
 expect(view.getByTestId('apps-add')).toBeOnTheScreen();expect(view.queryByTestId('group-add')).toBeNull();
 fireEvent.press(view.getByTestId('apps-manage-groups'));expect(manage).toHaveBeenCalledTimes(1);
 expect(Native.createAppGroup).not.toHaveBeenCalled();expect(Native.updateAppGroup).not.toHaveBeenCalled();
});
test('explicit Add apps reuses the current shared rule and opens chooser without activating',async()=>{
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-add'));await new Promise(r=>setTimeout(r,200));});
 expect(view.getByRole('header',{name:'Choose installed apps'})).toBeOnTheScreen();expect(view.getAllByText('Actual app').length).toBeGreaterThan(0);
 expect(Native.createAppGroup).not.toHaveBeenCalled();expect(Native.updateAppGroup).not.toHaveBeenCalled();
});
test('native storage rejection ends waiting and provides repair, never an empty fabricated selection',async()=>{
 (Native.setAppGroupActionScope as jest.Mock).mockResolvedValue({...binding,accepted:false,bindingCurrent:false,ownerVerified:false,stage:'state-commit',reason:'group-persistence-failed'});
 const view=await setup();expect(view.queryByText('Waiting for your account…')).toBeNull();
 expect(view.getByRole('alert')).toHaveTextContent(/storage/i);expect(Native.getAppGroups).not.toHaveBeenCalled();
 expect(view.getByTestId('apps-repair')).toBeOnTheScreen();
});
test('stale or absent trusted navigation intent never opens native selection',async()=>{
 const consume=jest.fn(()=>false);const view=await setup({createOnOpen:true,onCreateRequestConsumed:consume});
 expect(consume).toHaveBeenCalledTimes(1);expect(view.queryByRole('header',{name:'Choose installed apps'})).toBeNull();
 expect(Native.createAppGroup).not.toHaveBeenCalled();expect(Native.presentAppGroupPicker).not.toHaveBeenCalled();expect(Native.updateAppGroup).not.toHaveBeenCalled();
});
test('Activate is explicit and failure retains the selected apps and draft',async()=>{
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});
 expect(Native.updateAppGroup).not.toHaveBeenCalled();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'monitor-capacity',snapshot:status});
 await act(async()=>{fireEvent.press(view.getByTestId('apps-activate'));});
 expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:['com.actual.app']}),JSON.stringify(['owner',epoch]));
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getAllByRole('alert')[0]).toHaveTextContent(/monitoring slots/);
});
test('new Android selection in an enabled shared group requires Activate and waits for its native acknowledgement',async()=>{
 enabledGroup();installedApps();const previous=status.groups[0],view=await setup();await chooseNewApp(view);
 expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();expect(view.getByTestId('apps-activate')).not.toBeDisabled();
 fireEvent.press(view.getByTestId('group-details-toggle'));expect(view.getByTestId('group-selection-guidance')).toHaveTextContent(/activate protection/);
 expect(view.queryByRole('button',{name:'Update protection'})).toBeNull();
 expect(Native.updateAppGroup).not.toHaveBeenCalled();expect(status.groups[0]).toEqual(previous);
 let acknowledge!:(value:any)=>void;
 (Native.updateAppGroup as jest.Mock).mockImplementation(()=>new Promise(resolve=>{acknowledge=resolve;}));
 await act(async()=>{fireEvent.press(view.getByTestId('apps-activate'));});
 expect(Native.updateAppGroup).toHaveBeenCalledTimes(1);expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:['com.actual.app','com.new.app']}),JSON.stringify(['owner',epoch]));
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(status.groups[0]).toEqual(previous);
 expect(JSON.parse(localStorage.getItem(appGroupDraftKey(status,previous))!)).toEqual(expect.objectContaining({enabled:true,packages:['com.actual.app','com.new.app']}));
 await act(async()=>{status={...status,revision:2,groups:[{...previous,revision:2,packages:['com.actual.app','com.new.app'],applicationCount:2}]};acknowledge({accepted:true,reason:null,snapshot:status});});
 expect(view.queryByTestId('app-group-editor')).toBeNull();expect(localStorage.getItem(appGroupDraftKey({...status,revision:1},previous))).toBeNull();
});
test('cancelled organizer selections restore behind the activation guard and failed activation retains prior protection',async()=>{
 enabledGroup();installedApps();const previous=status.groups[0],key=appGroupDraftKey(status,previous),view=await setup({mode:'groups'});
 await act(async()=>{fireEvent.press(view.getByText('Work'));});await chooseNewApp(view,'group-choose-apps');await act(async()=>{fireEvent.press(view.getByTestId('group-cancel'));});
 expect(Native.updateAppGroup).not.toHaveBeenCalled();expect(status.groups[0]).toEqual(previous);
 await act(async()=>{fireEvent.press(view.getByText('Work'));});expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();expect(view.getByTestId('apps-activate')).not.toBeDisabled();
 expect(view.getByText('New app')).toBeOnTheScreen();expect(view.queryByTestId('group-update')).toBeNull();expect(Native.updateAppGroup).not.toHaveBeenCalled();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'monitor-capacity',snapshot:status});
 await act(async()=>{fireEvent.press(view.getByTestId('apps-activate'));});
 expect(Native.updateAppGroup).toHaveBeenCalledTimes(1);expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:['com.actual.app','com.new.app']}),JSON.stringify(['owner',epoch]));
 expect(status.groups[0]).toEqual(previous);expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getAllByRole('alert')[0]).toHaveTextContent(/monitoring slots/);
 expect(JSON.parse(localStorage.getItem(key)!)).toEqual(expect.objectContaining({enabled:true,packages:['com.actual.app','com.new.app']}));
 expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();
});
test('an iOS pending native selection requires Activate even when its app count is unchanged',async()=>{
 status={...status,platform:'ios',groups:[{...group,enabled:true,ready:true,active:true,packages:[],draftApplicationCount:null}]};
 const previous=status.groups[0];(Native.presentAppGroupPicker as jest.Mock).mockImplementation(async()=>{status={...status,revision:2,groups:[{...previous,draftApplicationCount:1}]};return{accepted:true,reason:null,snapshot:status};});
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-add'));});
 expect(Native.presentAppGroupPicker).toHaveBeenCalledTimes(1);expect(view.getByText('1 selected apps')).toBeOnTheScreen();
 expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();expect(Native.updateAppGroup).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.press(view.getByTestId('group-cancel'));});expect(status.groups[0]).toEqual({...previous,draftApplicationCount:1});
 await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'monitor-capacity',snapshot:status});
 await act(async()=>{fireEvent.press(view.getByTestId('apps-activate'));});
 expect(Native.updateAppGroup).toHaveBeenCalledTimes(1);expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:[]}),JSON.stringify(['owner',epoch]));
 expect(status.groups[0]).toEqual({...previous,draftApplicationCount:1});expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getAllByRole('alert')[0]).toHaveTextContent(/monitoring slots/);
 expect(JSON.parse(localStorage.getItem(appGroupDraftKey(status,previous))!)).toEqual(expect.objectContaining({enabled:true,packages:[]}));
});
test.each(['android','ios'] as const)('enabled %s groups can update rule-only changes without another activation',async platform=>{
 enabledGroup();status={...status,platform,groups:[{...status.groups[0],packages:platform==='ios'?[]:['com.actual.app'],draftApplicationCount:null}]};const previous=status.groups[0],view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});fireEvent.press(view.getByTestId('group-rule-choice'));fireEvent.press(view.getByTestId('group-rule-before-use'));
 expect(view.getByTestId('group-update')).not.toBeDisabled();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:true,reason:null,snapshot:{...status,revision:2,groups:[{...previous,revision:2,rule:{kind:'before-use'}}]}});
 await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:platform==='ios'?[]:['com.actual.app'],rule:{kind:'before-use'}}),JSON.stringify(['owner',epoch]));expect(view.queryByTestId('app-group-editor')).toBeNull();
});
test('a restored enabled organizer draft has only an explicit Activate action for a disabled group',async()=>{
 const previous=status.groups[0];localStorage.setItem(appGroupDraftKey(status,previous),JSON.stringify({name:'Work',enabled:true,rule:{kind:'daily-limit',limitMinutes:30},packages:['com.actual.app','com.new.app']}));
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();
 expect(view.queryByTestId('group-update')).toBeNull();expect(Native.updateAppGroup).not.toHaveBeenCalled();expect(status.groups[0]).toEqual(previous);expect(view.getByTestId('apps-activate')).not.toBeDisabled();
});
test.each(['android','ios'] as const)('a canceled enabling %s draft with unchanged selection requires explicit Activate when restored in Apps',async platform=>{
 status={...status,platform,groups:[{...group,packages:platform==='ios'?[]:['com.actual.app'],draftApplicationCount:null}]};const previous=status.groups[0],key=appGroupDraftKey(status,previous),view=await setup({mode:'groups'});
 await act(async()=>{fireEvent.press(view.getByText('Work'));});fireEvent(view.getByTestId('group-enable'),'valueChange',true);await act(async()=>{fireEvent.press(view.getByTestId('group-cancel'));});
 expect(Native.updateAppGroup).not.toHaveBeenCalled();expect(status.groups[0]).toEqual(previous);
 await act(async()=>{view.rerender(<AppGroupsScreen getActionScope={()=>JSON.stringify(['owner',epoch])}/>);});
 await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});expect(view.queryByTestId('group-enable')).toBeNull();
 expect(view.queryByTestId('group-save')).toBeNull();expect(view.queryByTestId('group-update')).toBeNull();expect(view.getByTestId('apps-activate')).not.toBeDisabled();
 expect(view.queryByRole('button',{name:'Update protection'})).toBeNull();
 expect(Native.updateAppGroup).not.toHaveBeenCalled();expect(status.groups[0]).toEqual(previous);expect(Native.presentAppGroupPicker).not.toHaveBeenCalled();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'monitor-capacity',snapshot:status});
 await act(async()=>{fireEvent.press(view.getByTestId('apps-activate'));});
 expect(Native.updateAppGroup).toHaveBeenCalledTimes(1);expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:platform==='ios'?[]:['com.actual.app']}),JSON.stringify(['owner',epoch]));
 expect(status.groups[0]).toEqual(previous);expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(JSON.parse(localStorage.getItem(key)!)).toEqual(expect.objectContaining({enabled:true,packages:platform==='ios'?[]:['com.actual.app']}));
});
test('disabled organizer groups can update a new Android selection while remaining off',async()=>{
 installedApps();const view=await setup({mode:'groups'});await act(async()=>{fireEvent.press(view.getByText('Work'));});await chooseNewApp(view,'group-choose-apps');expect(view.getByTestId('group-update')).not.toBeDisabled();expect(view.queryByTestId('apps-activate')).toBeNull();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:true,reason:null,snapshot:{...status,revision:2,groups:[{...group,revision:2,packages:['com.actual.app','com.new.app'],applicationCount:2}]}});
 await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:false,packages:['com.actual.app','com.new.app']}),JSON.stringify(['owner',epoch]));expect(view.queryByTestId('app-group-editor')).toBeNull();
});
test('restored package order alone keeps Update available for an enabled group',async()=>{
 enabledGroup();status={...status,groups:[{...status.groups[0],packages:['com.actual.app','com.new.app'],applicationCount:2}]};const previous=status.groups[0];
 localStorage.setItem(appGroupDraftKey(status,previous),JSON.stringify({name:'Work',enabled:true,rule:{kind:'before-use'},packages:['com.new.app','com.actual.app']}));
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});expect(view.getByTestId('group-update')).not.toBeDisabled();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:true,reason:null,snapshot:status});await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({enabled:true,packages:['com.new.app','com.actual.app']}),JSON.stringify(['owner',epoch]));
});

test('Apple Done pending selection appears on Apps immediately and survives Cancel without activation',async()=>{
 status={...status,platform:'ios',groups:[{...group,packages:[],applicationCount:0,draftApplicationCount:null}]};
 const previous=status.groups[0];(Native.presentAppGroupPicker as jest.Mock).mockImplementation(async()=>{status={...status,revision:2,groups:[{...previous,draftApplicationCount:3}]};return{accepted:true,reason:null,snapshot:status};});
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-add'));});
 expect(view.getByText('3 selected apps')).toBeOnTheScreen();expect(view.getByTestId('group-pending-state')).toHaveTextContent('Not active');
 expect(Native.updateAppGroup).not.toHaveBeenCalled();await act(async()=>{fireEvent.press(view.getByTestId('group-cancel'));});
 expect(view.getByTestId('apps-edit-shared-one')).toBeOnTheScreen();expect(view.getByTestId('apps-pending-shared-one')).toHaveTextContent('Not active');
 expect(status.groups[0]).toEqual({...previous,draftApplicationCount:3});expect(Native.updateAppGroup).not.toHaveBeenCalled();
 await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});expect(view.getByText('3 selected apps')).toBeOnTheScreen();
});
test('Apps editor keeps one Cancel in navigation and its single Activate action outside scrolling',async()=>{
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});
 expect(view.getAllByTestId('group-cancel')).toHaveLength(1);expect(view.queryByTestId('group-save')).toBeNull();
 const activate=view.getByRole('button',{name:'Activate protection'});expect(view.getAllByTestId('apps-activate')).toHaveLength(1);
 const scroll=view.getByTestId('app-group-editor');expect(scroll.findAll(node=>node===activate)).toHaveLength(0);
 expect(view.getByTestId('group-editor-footer').findAll(node=>node===activate)).toHaveLength(1);
});
test('an unchanged enabled editor shows current protection until a real draft change',async()=>{
 enabledGroup();const previous=status.groups[0],view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared-one'));});
 expect(view.getByTestId('group-pending-state')).toHaveTextContent('Enabled');
 fireEvent.press(view.getByTestId('group-rule-choice'));fireEvent.press(view.getByTestId('group-rule-before-use'));expect(view.getByTestId('group-pending-state')).toHaveTextContent('Changes not applied');
 expect(Native.updateAppGroup).not.toHaveBeenCalled();await act(async()=>{fireEvent.press(view.getByTestId('group-cancel'));});
 expect(view.getByTestId('apps-pending-shared-one')).toHaveTextContent('Changes not applied');expect(view.getByText('Before use')).toBeOnTheScreen();expect(status.groups[0]).toEqual(previous);
});
