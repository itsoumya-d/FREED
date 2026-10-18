jest.mock('@/lib/firebase-native',()=>{const state={status:'ready',reason:null,admission:null,revision:1};return{getFirebaseNativeAccountSessionSnapshot:()=>state,subscribeFirebaseNativeAccountSession:()=>()=>{},getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:true}),getFirebaseNativeAccountAdmission:()=>null,reconcileFirebaseNativeAccountSession:async()=>null};});
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AppGroupsScreen } from '@/components/AppGroupsScreen';
import * as Native from 'freed-protection';
import { appI18n } from '@/i18n/runtime';
import type { AppGroup, AppGroupsSnapshot } from '@/lib/app-groups-contract';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('expo-router',()=>({useFocusEffect:(effect:()=>unknown)=>require('react').useEffect(effect,[effect])}));
jest.mock('freed-protection',()=>({setAppGroupActionScope:jest.fn(),suspendAppGroupOperations:jest.fn(),getAppGroups:jest.fn(),createAppGroup:jest.fn(),updateAppGroup:jest.fn(),removeAppGroup:jest.fn(),presentAppGroupPicker:jest.fn(),getInstalledGroupApps:jest.fn(),isNativeAccountActionScopeCurrent:(scope:unknown)=>typeof scope==='string'&&scope.length>0,requestProtectionAuthorization:jest.fn(),openUsageAccessSettings:jest.fn(),openProtectionSettings:jest.fn()}));
const group:AppGroup={id:'native-one',revision:1,name:'Work',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[],applicationCount:0,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:false,active:false,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null};
let status:AppGroupsSnapshot,gen=0;
beforeEach(async()=>{gen++;localStorage.clear();await appI18n.changeLanguage('en');status={version:1,supported:true,platform:'ios',revision:1,configurationGeneration:0,scopeEpoch:gen,groups:[{...group}],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};(Native.setAppGroupActionScope as jest.Mock).mockResolvedValue({version:1,operationId:"11111111-1111-4111-8111-111111111111",supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:"complete",reason:null,generation:0,scopeEpoch:gen,errorCode:null,errorDomain:null});(Native.suspendAppGroupOperations as jest.Mock).mockResolvedValue(true);(Native.getAppGroups as jest.Mock).mockImplementation(async()=>status);(Native.getInstalledGroupApps as jest.Mock).mockResolvedValue({supported:true,apps:[],nextOffset:null,total:0,reason:null});});
const setup=async()=>{const view=render(<AppGroupsScreen mode="groups" getActionScope={()=>JSON.stringify(['owner',gen,'22222222-2222-4222-8222-222222222222'])}/>);await act(async()=>{});return view;};
test('Back/Cancel retains draft without applying the native group; Update waits for real acknowledgement',async()=>{
 const view=await setup();fireEvent.press(view.getByText('Work'));fireEvent.changeText(view.getByTestId('group-name'),'Quiet time');fireEvent.press(view.getByTestId('group-rule-choice'));fireEvent.press(view.getByTestId('group-rule-before-use'));fireEvent.press(view.getByTestId('group-cancel'));
 expect(Native.updateAppGroup).not.toHaveBeenCalled();fireEvent.press(view.getByText('Work'));expect(view.getByTestId('group-name')).toHaveProp('value','Quiet time');
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'monitor-capacity',snapshot:status});await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getAllByRole('alert')[0]).toHaveTextContent(/monitoring slots/);
});
test('creating a native disabled draft opens its editor and requires explicit update',async()=>{
 (Native.createAppGroup as jest.Mock).mockImplementation(async()=>{status={...status,revision:2,groups:[...status.groups,{...group,id:'native-two',name:'New group'}]};return{accepted:true,reason:null,snapshot:status};});
 const view=await setup();await act(async()=>{fireEvent.press(view.getByTestId('group-add'));});expect(Native.createAppGroup).toHaveBeenCalledWith({version:1,expectedStoreRevision:1,name:'New group'},JSON.stringify(['owner',gen,'22222222-2222-4222-8222-222222222222']));
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getByTestId('group-enable')).toHaveProp('accessibilityState',expect.objectContaining({checked:false}));expect(Native.updateAppGroup).not.toHaveBeenCalled();
});
test('arbitrary Android installed selections use actual native rows and stay a draft until update',async()=>{
 status={...status,platform:'android',monitorBudget:{...status.monitorBudget,limit:6},groups:[{...group}]};(Native.getInstalledGroupApps as jest.Mock).mockResolvedValue({supported:true,apps:[{packageName:'com.actual.app',name:'Actual installed app',iconUri:null,eligible:true},{packageName:'com.system.home',name:'Home',iconUri:null,eligible:false}],total:2,nextOffset:null,reason:null});
 const view=await setup();fireEvent.press(view.getByText('Work'));fireEvent.press(view.getByTestId('group-choose-apps'));await act(async()=>{await new Promise(r=>setTimeout(r,200));});
 expect(view.getByText('Actual installed app')).toBeOnTheScreen();expect(view.getByRole('checkbox',{name:'Home'})).toBeDisabled();fireEvent.press(view.getByText('Actual installed app'));fireEvent.press(view.getByTestId('group-apps-done'));expect(Native.updateAppGroup).not.toHaveBeenCalled();
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:true,reason:null,snapshot:{...status,revision:2,groups:[{...group,revision:2,packages:['com.actual.app'],applicationCount:1}]}});await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(Native.updateAppGroup).toHaveBeenCalledWith(expect.objectContaining({packages:['com.actual.app']}),JSON.stringify(['owner',gen,'22222222-2222-4222-8222-222222222222']));expect(view.queryByTestId('app-group-editor')).toBeNull();
});
test('legacy timing requires an explicit rule choice before adoption',async()=>{
 status={...status,groups:[{...group,id:'legacy-default',legacy:true,enabled:true,rule:{kind:'legacy'},applicationCount:1}]};
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:true,reason:null,snapshot:status});
 const view=await setup();fireEvent.press(view.getByText('Work'));await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(Native.updateAppGroup).not.toHaveBeenCalled();expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();
 fireEvent.press(view.getByTestId('group-rule-choice'));fireEvent.press(view.getByTestId('group-rule-before-use'));await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});expect(Native.updateAppGroup).toHaveBeenCalledTimes(1);
});

test('unsupported daily past usage offers Before use or Schedule without permission repair or losing the draft',async()=>{
 const view=await setup();fireEvent.press(view.getByText('Work'));fireEvent.changeText(view.getByTestId('group-name'),'Retained draft');
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'daily-past-usage-unavailable',snapshot:status});
 await act(async()=>{fireEvent.press(view.getByTestId('group-update'));});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getByTestId('group-name')).toHaveProp('value','Retained draft');
 const alerts=view.getAllByRole('alert');expect(alerts[0]).toHaveTextContent(/iOS 17.4/);expect(alerts[0]).toHaveTextContent(/Before use/);expect(alerts[0]).toHaveTextContent(/Schedule/);expect(alerts[0]).not.toHaveTextContent(/Check permissions/);
 fireEvent.press(view.getByTestId('group-rule-choice'));expect(view.getByTestId('group-rule-before-use')).not.toBeDisabled();expect(view.getByTestId('group-rule-scheduled')).not.toBeDisabled();expect(Native.openProtectionSettings).not.toHaveBeenCalled();
});
test('failed native binding exposes safe details beside the visible Apps failure even without an editor',async()=>{
 (Native.setAppGroupActionScope as jest.Mock).mockResolvedValue({version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:false,bindingCurrent:false,ownerVerified:true,stage:'state-read',reason:'state-storage-unavailable',generation:0,scopeEpoch:gen,errorCode:13,errorDomain:'NSPOSIXErrorDomain',privateOwner:'do-not-show'});
 const view=render(<AppGroupsScreen getActionScope={()=>JSON.stringify(['owner',gen,'22222222-2222-4222-8222-222222222222'])}/>);await act(async()=>{});
 expect(view.getByRole('alert')).toHaveTextContent(/storage could not be opened/);expect(view.queryByTestId('app-group-editor')).toBeNull();
 expect(view.queryByTestId('apps-failure-diagnostics')).toBeNull();fireEvent.press(view.getByTestId('apps-failure-details-toggle'));
 expect(view.getByTestId('apps-failure-diagnostics')).toHaveTextContent('state-read · state-storage-unavailable · NSPOSIXErrorDomain · 13');expect(JSON.stringify(view.toJSON())).not.toContain('do-not-show');
});
test('a retained save error keeps usable selected apps and their review action instead of offering a misleading loading retry',async()=>{
 status={...status,groups:[{...group,applicationCount:2}]};
 const view=render(<AppGroupsScreen getActionScope={()=>JSON.stringify(['owner',gen,'22222222-2222-4222-8222-222222222222'])}/>);await act(async()=>{});fireEvent.press(view.getByTestId('apps-edit-native-one'));
 (Native.updateAppGroup as jest.Mock).mockResolvedValue({accepted:false,reason:'monitor-capacity',snapshot:status});await act(async()=>fireEvent.press(view.getByTestId('apps-activate')));fireEvent.press(view.getByTestId('group-cancel'));
 expect(view.getByRole('alert')).toHaveTextContent(/monitoring slots/);expect(view.getByTestId('apps-edit-native-one')).toBeOnTheScreen();expect(view.queryByTestId('apps-repair')).toBeNull();
});
