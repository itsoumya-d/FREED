jest.mock('@/lib/firebase-native',()=>{const state={status:'ready',reason:null,admission:null,revision:1};return{getFirebaseNativeAccountSessionSnapshot:()=>state,subscribeFirebaseNativeAccountSession:()=>()=>{},getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:true}),getFirebaseNativeAccountAdmission:()=>null,reconcileFirebaseNativeAccountSession:async()=>null};});
import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppGroupsScreen, AppGroupEditor } from '@/components/AppGroupsScreen';
import { appGroupDraftKey } from '@/lib/app-group-drafts';
import type { AppGroup, AppGroupsSnapshot } from '@/lib/app-groups-contract';
import type { AppGroupsBinding } from '@/hooks/use-app-groups';
import { appI18n, localeResources, translateSource } from '@/i18n/runtime';
import * as Native from 'freed-protection';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/components/NativeAppGroupLabels',()=>({NativeAppGroupLabels:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('expo-router',()=>({useFocusEffect:(effect:()=>unknown)=>require('react').useEffect(effect,[effect])}));
jest.mock('freed-protection',()=>({setAppGroupActionScope:jest.fn(),suspendAppGroupOperations:jest.fn(),getAppGroups:jest.fn(),createAppGroup:jest.fn(),updateAppGroup:jest.fn(),removeAppGroup:jest.fn(),presentAppGroupPicker:jest.fn(),isEarnedAppTimeAvailable:jest.fn(()=>false),updateAppGroupWithEarnedTime:jest.fn(),getInstalledGroupApps:jest.fn(),isNativeAccountActionScopeCurrent:(scope:unknown)=>typeof scope==='string'&&scope.length>0,requestProtectionAuthorization:jest.fn(),openUsageAccessSettings:jest.fn(),openProtectionSettings:jest.fn()}));
const group:AppGroup={id:'shared',revision:1,name:'My apps',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[],applicationCount:1,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:false,active:false,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null};
let status:AppGroupsSnapshot,scope:string,epoch=400;
const binding={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:1,scopeEpoch:1,errorCode:null,errorDomain:null};
beforeEach(()=>{localStorage.clear();epoch++;scope=JSON.stringify(['owner',epoch,'22222222-2222-4222-8222-222222222222']);status={version:1,supported:true,platform:'ios',revision:1,configurationGeneration:1,scopeEpoch:epoch,groups:[{...group}],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
 (Native.isEarnedAppTimeAvailable as jest.Mock).mockReturnValue(false);(Native.setAppGroupActionScope as jest.Mock).mockResolvedValue(binding);(Native.suspendAppGroupOperations as jest.Mock).mockResolvedValue(true);(Native.getAppGroups as jest.Mock).mockImplementation(async()=>status);(Native.getInstalledGroupApps as jest.Mock).mockResolvedValue({supported:true,apps:[],nextOffset:null,total:0,reason:null});});
function Harness({mode='apps',visible=true}:{mode?:'apps'|'groups';visible?:boolean}){return <View>{visible?<AppGroupsScreen mode={mode} initialGroupId="shared" getActionScope={()=>scope}/>:null}</View>;}
const tree=(mode:'apps'|'groups'='apps')=><Harness mode={mode}/>;
const setup=async(mode:'apps'|'groups'='apps')=>{const view=render(tree(mode));await act(async()=>{});expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();return view;};
function pending(){let finish!:(value:unknown)=>void;(Native.updateAppGroup as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));return(value:unknown)=>finish(value);}
const saved=(previous:AppGroupsSnapshot)=>({...previous,revision:previous.revision+1,groups:previous.groups.map(g=>({...g,revision:g.revision+1,enabled:true,ready:true,active:true}))});

test.each(['apps','groups'] as const)('accepted own revision closes the %s editor and removes only its submitted draft',async mode=>{
 const previous=status,key=appGroupDraftKey(previous,previous.groups[0]),view=await setup(mode),finish=pending();
 if(mode==='groups')fireEvent(view.getByTestId('group-enable'),'valueChange',true);
 await act(async()=>fireEvent.press(view.getByTestId('apps-activate')));
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(localStorage.getItem(key)).not.toBeNull();
 await act(async()=>{status=saved(previous);finish({accepted:true,reason:null,snapshot:status});});
 expect(view.queryByTestId('app-group-editor')).toBeNull();expect(localStorage.getItem(key)).toBeNull();expect(status.groups[0].enabled).toBe(true);
});

test('a queued newer edit during an acknowledged save stays open and cannot lose its draft',async()=>{
 const previous=status,key=appGroupDraftKey(previous,previous.groups[0]),view=await setup('groups'),finish=pending();
 fireEvent.changeText(view.getByTestId('group-name'),'Submitted');await act(async()=>fireEvent.press(view.getByTestId('group-update')));
 // Invoke a queued input callback even though native interaction is now disabled.
 act(()=>view.getByTestId('group-name').props.onChangeText('Newer draft'));
 await act(async()=>{status=saved(previous);finish({accepted:true,reason:null,snapshot:status});});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getByTestId('group-name')).toHaveProp('value','Newer draft');expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({name:'Newer draft'});
});

test('owner change rejects the old acknowledgement without closing the new owner editor or deleting its draft',async()=>{
 const previous=status,oldKey=appGroupDraftKey(previous,previous.groups[0]),view=await setup(),finish=pending();await act(async()=>fireEvent.press(view.getByTestId('apps-activate')));
 await act(async()=>{scope=JSON.stringify(['new-owner',++epoch]);status={...previous,configurationGeneration:2,scopeEpoch:epoch};view.rerender(tree());});
 const newKey=appGroupDraftKey(status,status.groups[0]);
 await act(async()=>finish({accepted:true,reason:null,snapshot:saved(previous)}));
 await act(async()=>{fireEvent.press(view.getByTestId('apps-edit-shared'));});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(localStorage.getItem(oldKey)).not.toBeNull();expect(localStorage.getItem(newKey)).not.toBeNull();
});

test('navigation away and reopening the same group fences an old accepted callback',async()=>{
 const previous=status,key=appGroupDraftKey(previous,previous.groups[0]),view=await setup('groups'),finish=pending();
 fireEvent.changeText(view.getByTestId('group-name'),'Old submitted');await act(async()=>fireEvent.press(view.getByTestId('group-update')));
 await act(async()=>view.rerender(<Harness mode="groups" visible={false}/>));await act(async()=>view.rerender(tree('groups')));
 act(()=>view.getByTestId('group-name').props.onChangeText('Reopened draft'));
 await act(async()=>{status=saved(previous);finish({accepted:true,reason:null,snapshot:status});});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({name:'Reopened draft'});
});


test('a rejected save with a refreshed group revision retains submitted edits and the previous working rule',async()=>{
 const previous=status,key=appGroupDraftKey(previous,previous.groups[0]),view=await setup('groups'),finish=pending();
 fireEvent.changeText(view.getByTestId('group-name'),'Retained submission');await act(async()=>fireEvent.press(view.getByTestId('group-update')));
 await act(async()=>{status={...previous,revision:2,groups:[{...previous.groups[0],revision:2}]};finish({accepted:false,reason:'monitor-capacity',snapshot:status});});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getByTestId('group-name')).toHaveProp('value','Retained submission');expect(view.getAllByRole('alert')[0]).toHaveTextContent(/monitoring slots/);
 expect(localStorage.getItem(key)).not.toBeNull();expect(status.groups[0].enabled).toBe(false);expect(status.groups[0].rule).toEqual(previous.groups[0].rule);
});

test('a replacement persisted draft is not deleted by an old accepted acknowledgement',async()=>{
 const previous=status,key=appGroupDraftKey(previous,previous.groups[0]),view=await setup(),finish=pending();await act(async()=>fireEvent.press(view.getByTestId('apps-activate')));
 const replacement={name:'Other pending edit',enabled:false,rule:{kind:'before-use'},packages:[]};localStorage.setItem(key,JSON.stringify(replacement));
 await act(async()=>{status=saved(previous);finish({accepted:true,reason:null,snapshot:status});});
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(JSON.parse(localStorage.getItem(key)!)).toEqual(replacement);
});


test('an acknowledged iOS activation closes without presenting the picker a second time',async()=>{
 const view=render(<AppGroupsScreen getActionScope={()=>scope}/>);await act(async()=>{});
 (Native.presentAppGroupPicker as jest.Mock).mockImplementation(async()=>{status={...status,revision:2,groups:[{...status.groups[0],draftApplicationCount:1}]};return{accepted:true,reason:null,snapshot:status};});
 await act(async()=>fireEvent.press(view.getByTestId('apps-add')));expect(Native.presentAppGroupPicker).toHaveBeenCalledTimes(1);
 const previous=status,finish=pending();await act(async()=>fireEvent.press(view.getByTestId('apps-activate')));
 await act(async()=>{status={...saved(previous),groups:saved(previous).groups.map(g=>({...g,draftApplicationCount:null}))};finish({accepted:true,reason:null,snapshot:status});});
 expect(view.queryByTestId('app-group-editor')).toBeNull();expect(Native.presentAppGroupPicker).toHaveBeenCalledTimes(1);
});

test('v2 preferred-window save requires its exact native readback across the revision change',async()=>{
 (Native.isEarnedAppTimeAvailable as jest.Mock).mockReturnValue(true);status={...status,supportedBreakSeconds:[300,600,1200],groups:[{...status.groups[0],preferredBreakSeconds:300}]};
 const previous=status,key=appGroupDraftKey(previous,previous.groups[0]),view=await setup('groups');
 fireEvent.press(view.getByTestId('group-preferred-value'));fireEvent.press(view.getByTestId('group-preferred-break-1200'));fireEvent.press(view.getByTestId('group-preferred-value-done'));
 (Native.updateAppGroupWithEarnedTime as jest.Mock).mockImplementation(async()=>{status={...saved(previous),groups:[{...saved(previous).groups[0],enabled:false,preferredBreakSeconds:300}]};return{accepted:true,reason:null,snapshot:status};});
 await act(async()=>fireEvent.press(view.getByTestId('group-update')));
 expect(view.getByTestId('app-group-editor')).toBeOnTheScreen();expect(view.getByTestId('group-preferred-value')).toHaveProp('accessibilityValue',{text:'20 min'});expect(view.getAllByRole('alert')[0]).toHaveTextContent(/challenge window was not confirmed/);expect(localStorage.getItem(key)).not.toBeNull();
 const current=status,currentKey=appGroupDraftKey(current,current.groups[0]);
 (Native.updateAppGroupWithEarnedTime as jest.Mock).mockImplementation(async()=>{status={...saved(current),groups:[{...saved(current).groups[0],enabled:false,preferredBreakSeconds:1200}]};return{accepted:true,reason:null,snapshot:status};});
 await act(async()=>fireEvent.press(view.getByTestId('group-update')));expect(view.queryByTestId('app-group-editor')).toBeNull();expect(localStorage.getItem(currentKey)).toBeNull();expect(Native.updateAppGroup).not.toHaveBeenCalled();
});


const newerSavedEditsSource='The device saved these settings. Your newer edits are still here. Review them before saving.';
const newerSavedEditsTranslations={
 en:newerSavedEditsSource,
 hi:'डिवाइस ने ये सेटिंग्स सहेज दी हैं। आपके बाद के बदलाव अभी भी मौजूद हैं। सहेजने से पहले उनकी समीक्षा करें।',
 es:'El dispositivo guardó estos ajustes. Tus cambios más recientes siguen aquí. Revísalos antes de guardar.',
 pt:'O dispositivo salvou estas configurações. Suas alterações mais recentes continuam aqui. Revise-as antes de salvar.',
 fr:'L’appareil a enregistré ces réglages. Vos modifications plus récentes sont toujours présentes. Vérifiez-les avant d’enregistrer.',
 de:'Das Gerät hat diese Einstellungen gespeichert. Deine neueren Änderungen sind noch vorhanden. Prüfe sie vor dem Speichern.',
 ar:'حفظ الجهاز هذه الإعدادات. تعديلاتك الأحدث ما زالت هنا. راجعها قبل الحفظ.',
 ja:'デバイスにこの設定が保存されました。新しい編集内容はまだ残っています。保存する前に確認してください。',
 ko:'기기에서 이 설정을 저장했습니다. 이후의 편집 내용은 아직 남아 있습니다. 저장하기 전에 확인하세요.',
 'zh-Hans':'设备已保存这些设置。较新的编辑仍然保留。请在保存前检查。',
};
afterEach(async()=>{await appI18n.changeLanguage('en');});
test.each(Object.entries(newerSavedEditsTranslations))('accepted save reports saved settings and retained newer edits in %s',async(language,expected)=>{
 await act(async()=>{await appI18n.changeLanguage(language);});
 const current=status,currentGroup=current.groups[0],key=appGroupDraftKey(current,currentGroup),close=jest.fn();let finish!:(receipt:any)=>void;
 const update=jest.fn(()=>new Promise<any>(resolve=>{finish=resolve;}));
 const editorBinding={status:current,pending:false,error:null,waitingForOwner:false,earnedTimeAvailable:false,update,updateEarned:jest.fn(),remove:jest.fn(),picker:jest.fn(),discard:jest.fn(),create:jest.fn(),refresh:jest.fn(),acknowledge:jest.fn()} as unknown as AppGroupsBinding;
 const view=render(<AppGroupEditor group={currentGroup} binding={editorBinding} onClose={close}/>);
 fireEvent.changeText(view.getByTestId('group-name'),'Submitted');await act(async()=>fireEvent.press(view.getByTestId('group-update')));
 act(()=>view.getByTestId('group-name').props.onChangeText('Newer draft'));
 await act(async()=>finish({accepted:true,reason:null,snapshot:{...current,revision:2,groups:[{...currentGroup,revision:2,name:'Submitted'}]}}));
 expect(view.getByRole('alert')).toHaveTextContent(expected);
 expect(view.getByTestId('group-name')).toHaveProp('value','Newer draft');expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({name:'Newer draft'});expect(close).not.toHaveBeenCalled();expect(update).toHaveBeenCalledTimes(1);
 const resource=localeResources[language as keyof typeof localeResources].source as Record<string,string>;
 expect(resource[newerSavedEditsSource]).toBe(expected);expect(translateSource(newerSavedEditsSource,language as never)).toBe(expected);
 expect(resource[newerSavedEditsSource]).not.toBe(resource['The device discarded the pending selection. Your newer edits are still here. Review them before saving.']);
});
