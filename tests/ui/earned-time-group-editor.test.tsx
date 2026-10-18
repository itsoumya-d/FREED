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
import { Modal } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppGroupEditor } from '@/components/AppGroupsScreen';
import type { AppGroup } from '@/lib/app-groups-contract';
import type { AppGroupsBinding } from '@/hooks/use-app-groups';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('freed-protection',()=>({}));
jest.mock('expo-router',()=>({useFocusEffect:()=>undefined}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/components/NativeAppGroupLabels',()=>({NativeAppGroupLabels:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
const budget={version:2 as const,configuredCapMinutes:20 as const,effectiveCapMinutes:20 as const,spentSeconds:300,remainingSeconds:900,dayKey:'2026-10-08:UTC',nextResetAt:'2026-10-09T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:0,clockState:'verified' as const};
const group:AppGroup={id:'selected',revision:3,name:'My apps',enabled:true,rule:{kind:'daily-limit',limitMinutes:30},packages:[],applicationCount:2,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:true,active:true,thresholdReached:true,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null,extraTimeBudget:budget};
function fixture(available=true,modern=false){
 const close=jest.fn(),update=jest.fn(),updateEarned=jest.fn().mockResolvedValue({accepted:false,reason:'storage-failed'});
 const binding={status:{version:1,supported:true,platform:'ios',revision:8,configurationGeneration:2,scopeEpoch:3,groups:[group],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:1,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null},earnedTimeAvailable:available,pending:false,error:null,waitingForOwner:false,refresh:jest.fn(),create:jest.fn(),update,updateEarned,remove:jest.fn(),picker:jest.fn(),discard:jest.fn(),acknowledge:jest.fn()} as unknown as AppGroupsBinding;
 if(modern)binding.status={...binding.status,supportedBreakSeconds:[300,600,1200],groups:[{...group,preferredBreakSeconds:300}]};
 const view=render(<AppGroupEditor group={binding.status.groups[0]} binding={binding} onClose={close}/>);return{view,binding,close,update,updateEarned};
}
beforeEach(()=>localStorage.clear());
function choose(view:ReturnType<typeof render>,row:string,option:string){fireEvent.press(view.getByTestId(row));fireEvent.press(view.getByTestId(option));fireEvent.press(view.getByTestId(row+'-done'));}

test('cap choice is a retained draft and only explicit Update sends atomic v2 rule/cap request',async()=>{
 const f=fixture();expect(f.view.getByTestId('group-cap-value')).toHaveProp('accessibilityValue',{text:'20 min'});
 choose(f.view,'group-cap-value','group-extra-cap-10');expect(f.updateEarned).not.toHaveBeenCalled();expect(f.update).not.toHaveBeenCalled();
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 expect(f.updateEarned).toHaveBeenCalledWith(expect.objectContaining({version:2,extraTimeCapMinutes:10,rule:{kind:'daily-limit',limitMinutes:30},enabled:true,id:group.id,expectedRevision:3}));
 expect(f.update).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();expect(f.view.getByTestId('group-cap-value')).toHaveProp('accessibilityValue',{text:'10 min'});
});
test('native acceptance is required before closing the cap editor',async()=>{
 const f=fixture();f.updateEarned.mockResolvedValue({accepted:true,reason:null,snapshot:{...f.binding.status,revision:9,groups:[{...group,extraTimeBudget:{...budget,configuredCapMinutes:10,effectiveCapMinutes:10,remainingSeconds:300,revision:1}}]}});
 choose(f.view,'group-cap-value','group-extra-cap-10');await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.close).toHaveBeenCalledTimes(1);
});
test('a concurrent native cap/day change does not overwrite the newer budget using a stale draft',async()=>{
 const f=fixture();choose(f.view,'group-cap-value','group-extra-cap-10');
 const changed={...group,extraTimeBudget:{...budget,revision:1,configuredCapMinutes:5 as const,effectiveCapMinutes:5 as const,remainingSeconds:0}};
 f.view.rerender(<AppGroupEditor group={changed} binding={{...f.binding,status:{...f.binding.status,revision:9,groups:[changed]}}} onClose={f.close}/>);
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();expect(f.view.getByRole('alert')).toHaveTextContent(/changed/);
});
test('an old binary retains existing rule editing without pretending to offer v2 caps',async()=>{
 const f=fixture(false);expect(f.view.queryByTestId('group-cap-value')).toBeNull();await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.update).toHaveBeenCalledTimes(1);expect(f.updateEarned).not.toHaveBeenCalled();
});
test('a changed native cap can be explicitly resolved without losing other draft edits',async()=>{
 const f=fixture();fireEvent.changeText(f.view.getByTestId('group-name'),'Keep my name');choose(f.view,'group-cap-value','group-extra-cap-10');
 const changed={...group,extraTimeBudget:{...budget,revision:1,configuredCapMinutes:5 as const,effectiveCapMinutes:5 as const,remainingSeconds:0}};
 f.view.rerender(<AppGroupEditor group={changed} binding={{...f.binding,status:{...f.binding.status,revision:9,groups:[changed]}}} onClose={f.close}/>);
 fireEvent.press(f.view.getByTestId('group-cap-use-current'));await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 expect(f.updateEarned).toHaveBeenCalledWith(expect.objectContaining({name:'Keep my name',extraTimeCapMinutes:5}));
});
test('spend-only budget revision does not prevent saving a pending rule edit',async()=>{
 const f=fixture();fireEvent.changeText(f.view.getByTestId('group-name'),'My updated rule');
 const changed={...group,extraTimeBudget:{...budget,revision:1,spentSeconds:600,remainingSeconds:600}};
 f.view.rerender(<AppGroupEditor group={changed} binding={{...f.binding,status:{...f.binding.status,revision:9,groups:[changed]}}} onClose={f.close}/>);
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));
 expect(f.updateEarned).toHaveBeenCalledWith(expect.objectContaining({name:'My updated rule',extraTimeCapMinutes:20}));
});
test('native-supported preferred window is a separate draft and only explicit Update saves it',async()=>{
 const f=fixture(true,true);expect(f.view.getByTestId('group-preferred-value')).toHaveProp('accessibilityValue',{text:'5 min'});
 choose(f.view,'group-preferred-value','group-preferred-break-1200');expect(f.updateEarned).not.toHaveBeenCalled();expect(f.view.getByTestId('group-cap-value')).toHaveProp('accessibilityValue',{text:'20 min'});
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned).toHaveBeenCalledWith(expect.objectContaining({preferredBreakSeconds:1200,extraTimeCapMinutes:20,rule:{kind:'daily-limit',limitMinutes:30}}));expect(f.close).not.toHaveBeenCalled();
});
test('old binary omits preference mutation and20-minute control while retaining cap/rule editing',async()=>{
 const f=fixture();expect(f.view.queryByTestId('group-preferred-value')).toBeNull();await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned).toHaveBeenCalled();expect(f.updateEarned.mock.calls[0][0]).not.toHaveProperty('preferredBreakSeconds');expect(f.view.getByTestId('group-window-update-needed')).toBeTruthy();
});
test('saving preferred window requires matching native readback and preserves the active lease',async()=>{
 const f=fixture(true,true);const lease={interventionId:'native',expiresAt:'2026-10-11T12:20:00Z',effective:true,remainingRestrictionCount:0};
 f.updateEarned.mockResolvedValue({accepted:true,reason:null,snapshot:{...f.binding.status,groups:[{...group,preferredBreakSeconds:300,break:lease}]}});choose(f.view,'group-preferred-value','group-preferred-break-1200');await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.close).not.toHaveBeenCalled();
 f.updateEarned.mockResolvedValue({accepted:true,reason:null,snapshot:{...f.binding.status,groups:[{...group,preferredBreakSeconds:1200,break:lease}]}});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.close).toHaveBeenCalledTimes(1);expect(f.updateEarned.mock.calls[1][0]).not.toHaveProperty('break');
});
test('a newer saved preference updates a clean draft without being overwritten by an unrelated name edit',async()=>{
 const f=fixture(true,true);fireEvent.changeText(f.view.getByTestId('group-name'),'Keep this name');const updated={...group,preferredBreakSeconds:600 as const};
 f.view.rerender(<AppGroupEditor group={updated} binding={{...f.binding,status:{...f.binding.status,revision:9,groups:[updated]}}} onClose={f.close}/>);expect(f.view.getByTestId('group-preferred-value')).toHaveProp('accessibilityValue',{text:'10 min'});await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned.mock.calls[0][0]).toMatchObject({name:'Keep this name'});expect(f.updateEarned.mock.calls[0][0]).not.toHaveProperty('preferredBreakSeconds');
});
test('concurrent dirty preference requires an explicit choice and retains Before-use rule',async()=>{
 const f=fixture(true,true);fireEvent.press(f.view.getByTestId('group-rule-choice'));fireEvent.press(f.view.getByTestId('group-rule-before-use'));choose(f.view,'group-preferred-value','group-preferred-break-1200');const changed={...group,preferredBreakSeconds:600 as const};f.view.rerender(<AppGroupEditor group={changed} binding={{...f.binding,status:{...f.binding.status,revision:9,groups:[changed]}}} onClose={f.close}/>);
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned).not.toHaveBeenCalled();expect(f.view.getByTestId('group-window-conflict')).toBeTruthy();fireEvent.press(f.view.getByTestId('group-window-keep-draft'));await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned.mock.calls[0][0]).toMatchObject({preferredBreakSeconds:1200,rule:{kind:'before-use'}});
});
test('rendered daily allowance precedes session and cap controls and explains after-quota recovery',()=>{
 const f=fixture(true,true);const rendered=JSON.stringify(f.view.toJSON());expect(rendered.indexOf('group-daily-allowance')).toBeLessThan(rendered.indexOf('group-preferred-window'));expect(rendered.indexOf('group-preferred-window')).toBeLessThan(rendered.indexOf('group-extra-time'));expect(f.view.getByText(/without a challenge/)).toBeTruthy();fireEvent.press(f.view.getByTestId('group-details-toggle'));expect(f.view.getByTestId('group-window-summary')).toHaveTextContent(/30 minutes shared daily/);
});

test('duration sheet Cancel keeps the existing allowance, Done changes only the retained draft',async()=>{
 const f=fixture(true,true);fireEvent.press(f.view.getByTestId('group-daily-value'));fireEvent.press(f.view.getByTestId('group-daily-45'));fireEvent.press(f.view.getByTestId('group-daily-value-cancel'));
 expect(f.view.getByTestId('group-daily-value')).toHaveProp('accessibilityValue',{text:'30 min'});expect(f.updateEarned).not.toHaveBeenCalled();
 choose(f.view,'group-daily-value','group-daily-45');expect(f.view.getByTestId('group-daily-value')).toHaveProp('accessibilityValue',{text:'45 min'});
 fireEvent.press(f.view.getByTestId('group-rule-choice'));fireEvent.press(f.view.getByTestId('group-rule-daily-limit'));
 expect(f.view.getByTestId('group-daily-value')).toHaveProp('accessibilityValue',{text:'45 min'});
 await act(async()=>fireEvent.press(f.view.getByTestId('group-update')));expect(f.updateEarned).toHaveBeenCalledWith(expect.objectContaining({rule:{kind:'daily-limit',limitMinutes:45}}));expect(f.close).not.toHaveBeenCalled();
 expect(f.view.getByRole('alert')).toHaveTextContent(/storage/);
});
test('pending receipt disables all value rows and cancel while retaining the single pinned action',()=>{
 const f=fixture(true,true);f.view.rerender(<AppGroupEditor group={f.binding.status.groups[0]} binding={{...f.binding,pending:true}} onClose={f.close}/>);
 for(const id of ['group-daily-value','group-preferred-value','group-cap-value','group-rule-choice','group-update','group-cancel'])expect(f.view.getByTestId(id)).toBeDisabled();
 fireEvent.press(f.view.getByTestId('group-cancel'));expect(f.close).not.toHaveBeenCalled();
});
test('privacy-safe native save diagnostics are readable in details and never close a rejected draft',()=>{
 const f=fixture(true,true);f.view.rerender(<AppGroupEditor group={f.binding.status.groups[0]} binding={{...f.binding,error:'monitor-registration-failed',actionDiagnostics:{version:1,operation:'update-earned',operationId:'native-receipt',stage:'monitor-registration',reason:'monitor-registration-failed',configurationGeneration:2,storeRevision:8,groupRevision:3,errorCode:7,errorDomain:'DeviceActivity'}}} onClose={f.close}/>);
 expect(f.view.getByRole('alert')).toBeTruthy();expect(f.view.queryByTestId('group-action-diagnostics')).toBeNull();fireEvent.press(f.view.getByTestId('group-details-toggle'));expect(f.view.getByTestId('group-action-diagnostics')).toHaveTextContent('update-earned · monitor-registration · monitor-registration-failed · DeviceActivity · 7');expect(f.close).not.toHaveBeenCalled();
});
test('an existing non-step duration survives opening and cancelling its duration selector',()=>{
 const f=fixture(true,true);const saved={...group,rule:{kind:'daily-limit' as const,limitMinutes:37}};f.view.unmount();localStorage.clear();const view=render(<AppGroupEditor group={saved} binding={{...f.binding,status:{...f.binding.status,groups:[saved]}}} onClose={f.close}/>);
 fireEvent.press(view.getByTestId('group-daily-value'));expect(view.getByTestId('group-daily-37')).toBeChecked();fireEvent.press(view.getByTestId('group-daily-value-cancel'));expect(view.getByTestId('group-daily-value')).toHaveProp('accessibilityValue',{text:'37 min'});
});

test('back from a duration sheet cancels only the sheet selection and retains the editor',()=>{
 const f=fixture(true,true);fireEvent.press(f.view.getByTestId('group-daily-value'));fireEvent.press(f.view.getByTestId('group-daily-60'));act(()=>f.view.UNSAFE_getByType(Modal).props.onRequestClose());expect(f.view.getByTestId('group-daily-value')).toHaveProp('accessibilityValue',{text:'30 min'});expect(f.close).not.toHaveBeenCalled();expect(f.updateEarned).not.toHaveBeenCalled();
});
