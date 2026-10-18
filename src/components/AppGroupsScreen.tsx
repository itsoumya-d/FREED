import 'expo-sqlite/localStorage/install';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, TextInput, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestProtectionAuthorization, openUsageAccessSettings, openProtectionSettings } from 'freed-protection';
import { useAppGroups, type AppGroupsBinding } from '@/hooks/use-app-groups';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n, translateSource } from '@/i18n/runtime';
import { appGroupDraftKey, draftFromGroup, restoreAppGroupDraft, reconcileAppGroupBudgetDraft, reconcileAppGroupPreferredDraft, type AppGroupDraft } from '@/lib/app-group-drafts';
import { validateAppGroupUpdate, validateAppGroupActionDiagnostics } from '@/lib/protection-groups';
import { validateAppGroupBindingReceipt } from '../../modules/freed-protection/src/app-group-binding';
import { isAppGroupEarnedTimeUpdateRequest, type EarnedAppTimeCapMinutes, type EarnedAppTimeSeconds } from '../../modules/freed-protection/src/earned-app-time';
import { validateAppGroupSelectionDiscardReceipt } from '@/lib/app-group-selection-discard';
import type { AppGroup, AppGroupReceipt, AppGroupsSnapshot } from '@/lib/app-groups-contract';
import { AppGroupValueRow } from './AppGroupValueRow';
import { NativeTimeInput } from './NativeTimeInput';
import { NativeAppGroupLabels } from './NativeAppGroupLabels';
import { InstalledGroupAppsChooser, InstalledGroupAppsPreview } from './InstalledGroupApps';
import { MomentumPageHeader, MomentumSection } from './MomentumPageHeader';
import { View, Text, Pressable, Alert } from './Localized';
const ruleName=(group:AppGroup)=>group.rule.kind==='before-use'?'Before use':group.rule.kind==='scheduled'?'Schedule':group.rule.kind==='legacy'?'Existing protection':'Daily limit';
const nameOf=(group:AppGroup)=>group.name || translateSource(group.legacy?'Default group':'New group');
const presentation=(status:AppGroupsSnapshot,group:AppGroup)=>({configurationGeneration:status.configurationGeneration,scopeEpoch:status.scopeEpoch,storeRevision:status.revision,groupRevision:group.revision});
function readDraft(status:AppGroupsSnapshot,group:AppGroup){try{return restoreAppGroupDraft(localStorage.getItem(appGroupDraftKey(status,group)),group,status.platform==='android'?'android':'ios');}catch{return restoreAppGroupDraft(null,group,status.platform==='android'?'android':'ios');}}
const packagesChanged=(packages:string[],group:AppGroup)=>packages.length!==group.packages.length||packages.some(p=>!group.packages.includes(p));
const draftHasChanges=(draft:AppGroupDraft,group:AppGroup,selectionChanged:boolean)=>selectionChanged||(draft.preferredBreakSeconds!==undefined&&draft.preferredBreakSeconds!==(group.preferredBreakSeconds??300))||(draft.extraTimeCapMinutes!==undefined&&draft.extraTimeCapMinutes!==(group.extraTimeBudget?.configuredCapMinutes??20))||draft.enabled!==group.enabled||draft.name!==group.name||(group.rule.kind==='legacy'?draft.adoptLegacy===true:JSON.stringify(draft.rule)!==JSON.stringify(group.rule));
function groupError(reason:string|null){
 if(reason==='native-account-update-required')return 'Update FREED to manage private app protection on this device.';
 if(reason?.startsWith('native-account-'))return 'Private app protection could not be verified. Reload this account and retry.';
 if(reason?.includes('persistence')||reason?.includes('storage'))return 'Device protection storage could not be opened. Retry loading; your existing protection stays in place.';
 if(reason==='app-group-owner-unknown')return 'Sign in to choose and protect your apps.';
 if(reason==='daily-past-usage-unavailable')return 'Daily limits need iOS 17.4 or later. Choose Before use or Schedule to protect these apps on this iPhone.';
 if(reason==='monitor-capacity')return 'Your device has no monitoring slots available. Reduce active schedules, then retry.';
 if(reason?.includes('stale'))return 'This group changed. Review its current settings before saving again.';
 if(reason==='sign-in-required')return 'Link your account to create or edit private app groups.';
 if(reason==='authorization-or-app-selection-required')return 'Allow Screen Time and select individual apps before enabling this group.';
 if(reason==='monitor-registration-failed')return 'The device could not register this rule. Wait a moment, then retry activation.';
 if(['monitor-readback-failed','group-shield-readback-failed','earned-time-group-not-confirmed'].includes(reason??''))return 'The device did not confirm this rule. Reload its current settings, then retry activation.';
 if(['configuration-execution-unavailable','configuration-execution-expired'].includes(reason??''))return 'Keep FREED open and retry activation. The device operation did not finish.';
 return 'This change was not confirmed. Your draft is kept; retry activation.';
}
function clockFailureDetails(action:AppGroupsBinding['actionDiagnostics']){
 if(!action)return [];
 return ['clockBootAvailable','clockBootSource','clockBootStage','clockBootErrno','clockPrimaryStage','clockPrimaryErrno','clockWallValid','clockUptimeValid','clockCalendarValid','clockBudgetPhase'].map(key=>{
  const value=action[key as keyof typeof action];return value!==undefined&&value!==null?`${key}=${value}`:null;
 });
}
function safeFailureDetails(binding:AppGroupsBinding){
 const action=validateAppGroupActionDiagnostics(binding.actionDiagnostics);
 const receipt=validateAppGroupBindingReceipt(binding.bindingFailureReceipt??binding.bindingReceipt);
 const failure=action??(receipt?.accepted===false?receipt:null);
 if(!failure)return null;
 return [failure.stage,failure.reason,failure.errorDomain,failure.errorCode,
  'protectedDataAvailable' in failure&&typeof failure.protectedDataAvailable==='boolean'?`protectedDataAvailable=${failure.protectedDataAvailable}`:null,
  'containerAvailable' in failure&&typeof failure.containerAvailable==='boolean'?`containerAvailable=${failure.containerAvailable}`:null,
  ...(action?clockFailureDetails(action):[]),
 ].filter(value=>value!==null&&value!==undefined).join(' · ');
}
function GroupFailureDetails({text,prefix}:{text:string|null;prefix:string}){
 const {colors}=useAppTheme();const [expanded,setExpanded]=React.useState(false);
 React.useEffect(()=>{setExpanded(false);},[text]);
 if(!text)return null;
 return <><Pressable testID={prefix+'-details-toggle'} accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:15}}>{expanded?'Hide failure details':'Show failure details'}</Text></Pressable>{expanded?<Text translate={false} selectable testID={prefix+'-diagnostics'} style={{color:colors.text2,fontSize:13,lineHeight:19}}>{text}</Text>:null}</>;
}

type AppsScreenProps={getActionScope:()=>string|null;onRefreshProtection?:()=>Promise<unknown>;initialGroupId?:string;createOnOpen?:boolean;onCreateRequestConsumed?:()=>boolean;mode?:'apps'|'groups';onManageGroups?:()=>void};
export function AppGroupsScreen(props:AppsScreenProps) {
 return props.mode==='groups'?<GroupOrganizer {...props} createOnOpen={false}/>:<SelectedAppsScreen {...props}/>;
}
function SelectedAppsScreen({getActionScope,onRefreshProtection,initialGroupId,createOnOpen=false,onCreateRequestConsumed,onManageGroups}:AppsScreenProps) {
 const binding=useAppGroups(getActionScope),{colors}=useAppTheme();const status=binding.status;
 const [editing,setEditing]=React.useState<string|null>(null),[startPicker,setStartPicker]=React.useState(false),[busy,setBusy]=React.useState(false),[localError,setLocalError]=React.useState<string|null>(null);
 const handled=React.useRef(false);const group=status.groups.find(g=>g.id===editing);const scope=getActionScope();
 React.useEffect(()=>{setEditing(null);setStartPicker(false);setLocalError(null);},[scope]);
 const action=(label:string,fn:()=>void,id:string,disabled=false)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={translateSource(label)} accessibilityState={{disabled:disabled||busy||binding.pending}} disabled={disabled||busy||binding.pending} onPress={fn} style={{minHeight:48,padding:12,borderRadius:14,backgroundColor:id==='apps-add'?colors.accent:colors.surface2,justifyContent:'center'}}><Text style={{color:id==='apps-add'?colors.onAccent:colors.accent,fontSize:17,fontWeight:'700'}}>{label}</Text></Pressable>;
 const add=async()=>{
  if(busy||binding.pending||!status.supported||!getActionScope())return;const captured=getActionScope();setBusy(true);setLocalError(null);
  try{
   if(status.platform==='ios'&&!status.permissions.authorized){await requestProtectionAuthorization();const refreshed=await binding.refresh();if(captured!==getActionScope())return;if(!refreshed?.permissions.authorized){setLocalError('Allow Screen Time to choose apps.');return;}}
   let chosen=status.groups.find(g=>!g.legacy);
   if(!chosen){const previous=new Set(status.groups.map(g=>g.id));const receipt=await binding.create(translateSource('My apps'));if(captured!==getActionScope())return;chosen=receipt?.accepted?receipt.snapshot.groups.find(g=>!previous.has(g.id)):undefined;}
   if(chosen&&captured===getActionScope()){setStartPicker(true);setEditing(chosen.id);}
  }finally{setBusy(false);}
 };
 React.useEffect(()=>{if(handled.current||!status.supported)return;if(initialGroupId&&status.groups.some(g=>g.id===initialGroupId)){handled.current=true;setEditing(initialGroupId);}else if(createOnOpen){handled.current=true;if(onCreateRequestConsumed?.()===true)void add();}},[status.revision,status.supported,initialGroupId,createOnOpen]);
 const permission=async()=>{if(busy)return;setBusy(true);try{if(status.platform==='ios')await requestProtectionAuthorization();else if(!status.permissions.usageAccess)await openUsageAccessSettings();else await openProtectionSettings();await binding.refresh();await onRefreshProtection?.();}finally{setBusy(false);}};
 const selected=status.groups.map(group=>{const draft=readDraft(status,group);const pendingSelection=status.platform==='ios'?group.draftApplicationCount!=null:packagesChanged(draft.packages,group);const pending=draftHasChanges(draft,group,pendingSelection);const rule=group.rule.kind==='legacy'&&draft.adoptLegacy!==true?group.rule:draft.rule;return{group,draft,pending,pendingSelection,rule};}).filter(({group,draft})=>group.applicationCount>0||group.draftApplicationCount!=null||draft.packages.length>0);
 const failure=localError??(binding.error?groupError(binding.error):null);
 const canReviewSelected=status.supported&&selected.length>0&&binding.error!=='app-groups-read-failed';
 return <><ScrollView testID="apps-screen" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:24,gap:20}}>
  <Text accessibilityRole="header" style={{color:colors.text,fontSize:28,lineHeight:36,fontWeight:'800'}}>Apps</Text>
  <Text style={{color:colors.text2,fontSize:17,lineHeight:24}}>Choose apps to pause, then review their shared rule.</Text>
  {failure?<View style={{gap:8}}><Text accessibilityRole="alert" style={{color:colors.red,fontSize:17,lineHeight:24}}>{failure}</Text><GroupFailureDetails text={safeFailureDetails(binding)} prefix="apps-failure"/>{!canReviewSelected?action('Retry loading apps',()=>{void binding.refresh();},'apps-repair'):null}</View>:binding.waitingForOwner?<Text style={{color:colors.text2}}>Waiting for your account…</Text>:!status.supported?<Text accessibilityRole="alert" style={{color:colors.text2}}>App selection is unavailable in this installed build.</Text>:null}
  {!failure&&status.supported&&!status.permissions.authorized?<View style={{gap:8}}><Text style={{color:colors.text2}}>Allow the required permission to activate app protection.</Text>{action(status.platform==='ios'?'Allow Screen Time':!status.permissions.usageAccess?'Open usage access':'Open accessibility settings',()=>{void permission();},'apps-permission')}</View>:null}
  {selected.map(({group:g,draft,pending,pendingSelection,rule})=><View key={g.id} style={{gap:12,padding:16,borderRadius:20,borderCurve:'continuous',backgroundColor:colors.surface}}>
   {status.platform==='ios'?<NativeAppGroupLabels groupId={g.id} {...presentation(status,g)} draft={pendingSelection} layout="rows"/>:<InstalledGroupAppsPreview actionScope={binding.actionScope} packages={draft.packages}/>}
   <Text style={{color:colors.text,fontSize:17,fontWeight:'700'}}>{ruleName({...g,rule})}</Text>
   {rule.kind==='daily-limit'?<Text translate={false} style={{color:colors.text2,fontSize:17,lineHeight:24}}>{rule.limitMinutes.toLocaleString(appI18n.language)} {translateSource('minutes shared across these apps')}</Text>:null}
   <Text testID={pending?'apps-pending-'+g.id:undefined} style={{color:!pending&&g.enabled&&g.ready?colors.accent:colors.text2,fontSize:15,lineHeight:22}}>{pending?(g.enabled?'Changes not applied':'Not active'):!g.enabled?'Not active':g.ready?'Enabled':'Needs attention'}</Text>
   {!g.enabled?<Text style={{color:colors.text2,fontSize:15,lineHeight:22}}>Selected apps stay off until you review the rule and activate protection.</Text>:null}
   {action('Edit shared rule',()=>{setStartPicker(false);setEditing(g.id);},'apps-edit-'+g.id)}
  </View>)}
  {!selected.length&&!failure&&status.supported?<Text style={{color:colors.text2,fontSize:17,lineHeight:24}}>No apps selected. Add apps to get started.</Text>:null}
  {action('Add apps',()=>{void add();},'apps-add',!status.supported)}
  {onManageGroups?<Pressable testID="apps-manage-groups" accessibilityRole="button" accessibilityLabel={translateSource('Manage groups')} onPress={onManageGroups} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:17}}>Manage groups</Text></Pressable>:null}
 </ScrollView>{group?<Modal visible presentationStyle="pageSheet" animationType="slide" onRequestClose={()=>{if(!binding.pending)setEditing(null);}}><AppGroupEditorHost key={JSON.stringify([scope,status.configurationGeneration,status.scopeEpoch,group.id])} getActionScope={getActionScope} group={group} binding={binding} simple startPicker={startPicker} onClose={()=>{setEditing(null);setStartPicker(false);}}/></Modal>:null}</>;
}
function GroupOrganizer({getActionScope,onRefreshProtection,initialGroupId,createOnOpen=false}:{getActionScope:()=>string|null;onRefreshProtection?:()=>Promise<unknown>;initialGroupId?:string;createOnOpen?:boolean}) {
 const binding=useAppGroups(getActionScope),{colors}=useAppTheme();const [editing,setEditing]=React.useState<string|null>(null),[permissionBusy,setPermissionBusy]=React.useState(false);
 const status=binding.status;const opened=React.useRef(false);const group=status.groups.find(g=>g.id===editing);const scope=getActionScope();
 React.useEffect(()=>{setEditing(null);},[scope]);
 const button=(label:string,action:()=>void,id:string,disabled=false)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={translateSource(label)} accessibilityState={{disabled:disabled||binding.pending}} disabled={disabled||binding.pending} onPress={action} style={{minHeight:48,padding:12,borderRadius:14,backgroundColor:colors.surface2,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:17,fontWeight:'700'}}>{label}</Text></Pressable>;
 const add=async()=>{const previous=new Set(status.groups.map(g=>g.id));const receipt=await binding.create(translateSource('New group'));if(receipt?.accepted){const added=receipt.snapshot.groups.find(g=>!previous.has(g.id));if(added)setEditing(added.id);}};
 React.useEffect(()=>{if(opened.current||!status.supported||status.reason==='sign-in-required')return;if(initialGroupId&&status.groups.some(g=>g.id===initialGroupId)){opened.current=true;setEditing(initialGroupId);}else if(createOnOpen&&status.groups.length<6){opened.current=true;void add();}},[status.revision,status.supported,initialGroupId,createOnOpen]);
 const permission=async()=>{if(permissionBusy)return;setPermissionBusy(true);try{if(status.platform==='ios')await requestProtectionAuthorization();else if(!status.permissions.usageAccess)await openUsageAccessSettings();else await openProtectionSettings();await binding.refresh();await onRefreshProtection?.();}finally{setPermissionBusy(false);}};
 return <><ScrollView testID="app-groups-screen" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:24,gap:20}}>
  <MomentumPageHeader pose="guide" context="app-groups" title="App groups" description="Choose apps and one rule for each group. A recovery break applies only to the app and group that requested it." category="movement" compact restrained/>
  {binding.waitingForOwner?<Text style={{color:colors.text2}}>Waiting for your account…</Text>:!status.supported?<Text accessibilityRole="alert" style={{color:colors.text2}}>App groups are unavailable in this installed build.</Text>:null}
  {status.supported && (!status.permissions.authorized||!status.permissions.usageAccess||!status.permissions.runtimeConnected)?<View style={{gap:8}}><Text style={{color:colors.text2}}>Allow the required device permission, then return to check it.</Text>{status.platform==='android'?<View testID="group-permission-guide" style={{padding:12,borderRadius:16,borderWidth:1,borderColor:colors.border,gap:8}}><Text style={{color:colors.text,fontSize:17}}>{!status.permissions.usageAccess?'Usage access':'Accessibility'}</Text><Text translate={false} accessibilityElementsHidden style={{color:colors.accent,fontSize:21}}>↓</Text><Text translate={false} style={{color:colors.text,fontSize:17,fontWeight:'700'}}>FREED</Text><Text translate={false} accessibilityElementsHidden style={{color:colors.accent,fontSize:21}}>↓</Text><Text style={{color:colors.text,fontSize:17}}>{!status.permissions.usageAccess?'Allow usage access':'Enable FREED'}</Text></View>:null}{button(status.platform==='ios'?'Allow Screen Time':!status.permissions.usageAccess?'Open usage access':'Open accessibility settings',()=>{void permission();},'group-permission',permissionBusy)}</View>:null}
  {binding.error?<><Text accessibilityRole="alert" style={{color:colors.red,fontSize:17,lineHeight:24}}>{groupError(binding.error)}</Text><GroupFailureDetails text={safeFailureDetails(binding)} prefix="groups-failure"/></>:null}
  {status.groups.map(g=><MomentumSection key={g.id} testID={`group-${g.id}`} category="movement"><Pressable accessibilityRole="button" onPress={()=>setEditing(g.id)} style={{minHeight:44,gap:8}}><View style={{width:'100%',minWidth:0,flexDirection:'column',gap:4,alignItems:'stretch'}}><Text translate={false} style={{minWidth:0,color:colors.text,fontSize:21,lineHeight:28,fontWeight:'700'}}>{nameOf(g)}</Text><Text style={{minWidth:0,color:g.ready?colors.accent:colors.text2,fontSize:15,lineHeight:22}}>{!g.enabled?'Off':g.ready?'Ready':'Needs attention'}</Text></View><Text style={{color:colors.text2}}>{ruleName(g)}</Text>{status.platform==='ios'?<NativeAppGroupLabels groupId={g.id} {...presentation(status,g)} draft={g.draftApplicationCount!=null}/>:<InstalledGroupAppsPreview actionScope={binding.actionScope} packages={g.packages}/>}</Pressable></MomentumSection>)}
  {button('Add group',()=>{void add();},'group-add',!status.supported||status.groups.length>=6||status.reason==='sign-in-required')}
  <Text style={{color:colors.text2,fontSize:15,lineHeight:22}}>New groups start off with a 30-minute combined daily limit. Activate a group when its apps and rule are ready.</Text>
  {status.legacyCompatibility.retained?<Text style={{color:colors.text2,fontSize:15,lineHeight:22}}>Existing category, website, and independent schedule protections are retained. Editing a group changes its individual apps only.</Text>:null}
  {button('Check device configuration',()=>{void binding.refresh();},'groups-refresh')}
 </ScrollView>{group?<Modal visible presentationStyle="pageSheet" animationType="slide" onRequestClose={()=>{if(!binding.pending)setEditing(null);}}><AppGroupEditorHost key={JSON.stringify([scope,status.configurationGeneration,status.scopeEpoch,group.id])} getActionScope={getActionScope} group={group} binding={binding} onClose={()=>setEditing(null)}/></Modal>:null}</>;
}
type EditorSaveContext={draft:AppGroupDraft;draftKey:string;draftValue:string;expectedRevision:number;preferredBreakSeconds?:EarnedAppTimeSeconds};
type EditorSaveCompletion=(receipt:AppGroupReceipt|null)=>boolean;
/** Keep the open session alive across its own native revision acknowledgement.
 * The revision-keyed child still reloads external updates; only this live session
 * may finish the submitted save, and it cannot clear a replaced/newer draft. */
function AppGroupEditorHost({getActionScope,...props}:{getActionScope:()=>string|null;group:AppGroup;binding:AppGroupsBinding;onClose:()=>void;simple?:boolean;startPicker?:boolean}){
 const alive=React.useRef(true),editRevision=React.useRef(0);
 const current=React.useRef({scope:getActionScope(),...props});current.current={scope:getActionScope(),...props};
 const lastDraft=React.useRef<AppGroupDraft|null>(null),retainedAfterSave=React.useRef<AppGroupDraft|null>(null);
 const pending=React.useRef<{editRevision:number;context:EditorSaveContext}|null>(null);
 const [completionError,setCompletionError]=React.useState<string|null>(null);
 const initialRevision=React.useRef(props.group.revision);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const beginSave=(context:EditorSaveContext):EditorSaveCompletion=>{
  const captured=current.current,attempt={editRevision:editRevision.current,context};lastDraft.current=context.draft;pending.current=attempt;retainedAfterSave.current=null;setCompletionError(null);
  return receipt=>{
   const live=current.current;
   const changed=editRevision.current!==attempt.editRevision;
   if(pending.current!==attempt)return false;
   pending.current=null;
   if(!alive.current||getActionScope()!==captured.scope||live.scope!==captured.scope||live.group.id!==captured.group.id)return false;
   if(changed){retainedAfterSave.current=lastDraft.current;return false;}
   if(!receipt?.accepted){retainedAfterSave.current=lastDraft.current;setCompletionError(groupError(receipt?.reason??null));return false;}
   const confirmed=receipt.snapshot.groups.find(value=>value.id===captured.group.id);
   if(!confirmed||receipt.snapshot.configurationGeneration!==captured.binding.status.configurationGeneration||receipt.snapshot.scopeEpoch!==captured.binding.status.scopeEpoch||live.binding.status.configurationGeneration!==receipt.snapshot.configurationGeneration||live.binding.status.scopeEpoch!==receipt.snapshot.scopeEpoch||live.binding.status.revision>receipt.snapshot.revision||confirmed.revision<context.expectedRevision||![context.expectedRevision,confirmed.revision].includes(live.group.revision))return false;
   if(context.preferredBreakSeconds!==undefined&&confirmed.preferredBreakSeconds!==context.preferredBreakSeconds){retainedAfterSave.current=lastDraft.current;setCompletionError(appI18n.t('earnedSetup.preferenceNotSaved',{defaultValue:'Your challenge window was not confirmed by this device. Your draft is kept; retry saving.'}));return false;}
   try{const stored=localStorage.getItem(context.draftKey);if(stored!==null&&stored!==context.draftValue)return false;localStorage.removeItem(context.draftKey);}catch{setCompletionError(groupError(null));return false;}
   live.onClose();return true;
  };
 };
 const preferenceUnconfirmed=pending.current?.context.preferredBreakSeconds!==undefined&&pending.current.context.preferredBreakSeconds!==props.group.preferredBreakSeconds;
 const retainedDraft=retainedAfterSave.current??(pending.current&&(editRevision.current!==pending.current.editRevision||props.binding.error!==null||preferenceUnconfirmed)?lastDraft.current??undefined:undefined);
 return <AppGroupEditor key={props.group.revision} {...props} startPicker={props.startPicker&&props.group.revision===initialRevision.current} initialDraft={retainedDraft} saveCompletionError={completionError} onDraftChange={draft=>{lastDraft.current=draft;editRevision.current++;setCompletionError(null);}} beginSave={beginSave}/>;
}
export function AppGroupEditor({group,binding,onClose,simple=false,startPicker=false,initialDraft,onDraftChange,beginSave,saveCompletionError}:{group:AppGroup;binding:AppGroupsBinding;onClose:()=>void;simple?:boolean;startPicker?:boolean;initialDraft?:AppGroupDraft;saveCompletionError?:string|null;onDraftChange?:(draft:AppGroupDraft)=>void;beginSave?:(context:EditorSaveContext)=>EditorSaveCompletion}) {
 const {width,fontScale}=useWindowDimensions();const stackedHeading=width<360||fontScale>1.3;
 const {colors}=useAppTheme(),platform=binding.status.platform==='android'?'android':'ios';const key=appGroupDraftKey(binding.status,group);
 const [draft,setDraftState]=React.useState<AppGroupDraft>(()=>{if(initialDraft)return initialDraft;try{return restoreAppGroupDraft(localStorage.getItem(key),group,platform);}catch{return restoreAppGroupDraft(null,group,platform);}}),[chooser,setChooser]=React.useState(false),[error,setError]=React.useState<string|null>(null);
 const preferredResolution=reconcileAppGroupPreferredDraft(draft,group);
 const capResolution=reconcileAppGroupBudgetDraft(preferredResolution.draft,group);
 const supportedBreakSeconds=binding.status.supportedBreakSeconds??([300,600] as const);
 const preferenceSupported=binding.earnedTimeAvailable&&supportedBreakSeconds.includes(1200);
 const preferredBreakSeconds=capResolution.draft.preferredBreakSeconds??group.preferredBreakSeconds??300;
 React.useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(capResolution.draft));}catch{}},[key,draft,group.extraTimeBudget?.revision,group.preferredBreakSeconds]);
 const [discarding,setDiscarding]=React.useState(false);
 const [ruleChoices,setRuleChoices]=React.useState(false),[details,setDetails]=React.useState(false),[unconfirmedSave,setUnconfirmedSave]=React.useState(false);

 const minutesLabel=(minutes:number)=>appI18n.t('earnedTime.capMinutes',{defaultValue:'{{minutes}} min',minutes});
 const operationPending=binding.pending||discarding;
 const discardInFlight=React.useRef(false),alive=React.useRef(true);
 const liveIdentity=React.useRef(key);liveIdentity.current=key;
 const liveDraft=React.useRef(draft);liveDraft.current=draft;
 const setDraft:React.Dispatch<React.SetStateAction<AppGroupDraft>>=next=>{const value=typeof next==='function'?next(liveDraft.current):next;liveDraft.current=value;onDraftChange?.(value);setDraftState(value);};
 const saveInFlight=React.useRef(false);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const cleanupDraft=React.useRef<AppGroup|null>(null);
 const clearDiscardedDraft=(committed:AppGroup)=>{
  try{localStorage.removeItem(key);setDraft(draftFromGroup(committed));cleanupDraft.current=null;setError(null);}
  catch{cleanupDraft.current=committed;setError('The device discarded these changes, but the local draft could not be cleared. Retry clearing the draft.');}
 };
 const requestDiscard=()=>{
  if(operationPending||discardInFlight.current)return;
  const request={version:1 as const,expectedStoreRevision:binding.status.revision,id:group.id,expectedRevision:group.revision};
  const identity=key,capturedDraft=draft;
  Alert.alert('Discard pending changes?', 'Your active app protection will stay unchanged.', [
   {text:'Cancel',style:'cancel'},
   {text:'Discard changes',style:'destructive',onPress:()=>{void(async()=>{
    if(!alive.current||liveIdentity.current!==identity||discardInFlight.current)return;
    discardInFlight.current=true;setDiscarding(true);setError(null);
    try{
     const receipt=validateAppGroupSelectionDiscardReceipt(await binding.discard(request),request);
     if(!alive.current||liveIdentity.current!==identity)return;
     const committed=receipt?.snapshot.groups.find(g=>g.id===request.id);
     if(receipt?.accepted&&receipt.operation==='discard-pending-selection'&&receipt.targetId===request.id&&receipt.pendingSelectionDiscarded===true&&committed&&committed.revision===request.expectedRevision&&receipt.snapshot.configurationGeneration===binding.status.configurationGeneration&&receipt.snapshot.scopeEpoch===binding.status.scopeEpoch){
      if(liveDraft.current!==capturedDraft){setError('The device discarded the pending selection. Your newer edits are still here. Review them before saving.');return;}
      clearDiscardedDraft(committed);
     }
     else setError('Pending changes could not be discarded. Review the current selection and try again.');
    }catch{if(alive.current&&liveIdentity.current===identity)setError('Pending changes could not be discarded. Review the current selection and try again.');}
    finally{discardInFlight.current=false;if(alive.current&&liveIdentity.current===identity)setDiscarding(false);}
   })();}}
  ]);
 };
 const selectionChanged=platform==='ios'?group.draftApplicationCount!=null:packagesChanged(draft.packages,group);
 const hasChanges=draftHasChanges(capResolution.draft,group,selectionChanged)||capResolution.conflict||preferredResolution.conflict;
 const activationRequired=draft.enabled&&(!group.enabled||selectionChanged);
 const requiresActivation=activationRequired||simple&&(!group.enabled||selectionChanged);
 const primaryLabel=requiresActivation?'Activate protection':simple?'Update protection':'Update group';
 const primaryId=requiresActivation?'apps-activate':'group-update';
 const activationGuidance='Selected apps stay off until you review the rule and activate protection.';
 const target=()=>({version:1 as const,expectedStoreRevision:binding.status.revision,id:group.id,expectedRevision:group.revision});
 const action=(label:string,fn:()=>void,id:string,disabled=false)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={translateSource(label)} accessibilityState={{disabled:disabled||operationPending}} disabled={disabled||operationPending} onPress={fn} style={{minHeight:48,minWidth:0,flexShrink:1,padding:12,borderRadius:14,justifyContent:'center',backgroundColor:colors.surface2}}><Text style={{color:colors.accent,fontSize:17,fontWeight:'700'}}>{label}</Text></Pressable>;
 const save=async(activate=false)=>{if(operationPending||saveInFlight.current)return;const identity=key;const capturedDraft=draft;setError(null);setUnconfirmedSave(false);if(!activate&&activationRequired){setError(activationGuidance);return;}if(group.rule.kind==='legacy'&&draft.adoptLegacy!==true){setError('Choose a group rule to replace the existing individual-app rule.');return;}const request=validateAppGroupUpdate({...target(),...capResolution.draft,enabled:activate?true:draft.enabled},platform);if(!request){setError('Check the group rule and selected apps before saving.');return;}
  if(binding.earnedTimeAvailable && capResolution.conflict){setError(appI18n.t('earnedTime.capChanged',{defaultValue:'The extra-time cap changed. Choose which cap to keep.'}));return;}
  if(preferenceSupported&&preferredResolution.conflict){setError(appI18n.t('earnedSetup.preferenceChanged',{defaultValue:'The saved challenge window changed. Choose which preference to keep.'}));return;}
  const preferredChanged=preferenceSupported&&preferredBreakSeconds!==(group.preferredBreakSeconds??300);
  const earnedRequest={...request,version:2 as const,extraTimeCapMinutes:capResolution.draft.extraTimeCapMinutes??group.extraTimeBudget?.configuredCapMinutes??20,...(preferredChanged?{preferredBreakSeconds}:{})};
  if(binding.earnedTimeAvailable&&!isAppGroupEarnedTimeUpdateRequest(earnedRequest,platform)){setError('Check the group rule and selected apps before saving.');return;}
  const complete=beginSave?.({draft:capResolution.draft,draftKey:key,draftValue:JSON.stringify(capResolution.draft),expectedRevision:group.revision,...(preferredChanged?{preferredBreakSeconds}:{})});
  saveInFlight.current=true;
  try{
   const receipt=binding.earnedTimeAvailable?await binding.updateEarned(earnedRequest):await binding.update(request);
   // The host owns only accepted-save completion across the child remount.
   // Every other callback retains the mounted editor and identity checks.
   if(complete?.(receipt))return;
   if(!alive.current||liveIdentity.current!==identity)return;
   if(receipt?.accepted){
    if(liveDraft.current!==capturedDraft){setError('The device saved these settings. Your newer edits are still here. Review them before saving.');return;}
    if(preferredChanged&&receipt.snapshot.groups.find(value=>value.id===group.id)?.preferredBreakSeconds!==preferredBreakSeconds){setError(appI18n.t('earnedSetup.preferenceNotSaved',{defaultValue:'Your challenge window was not confirmed by this device. Your draft is kept; retry saving.'}));return;}
    if(complete){setError('This change was not confirmed. Your draft is kept; retry activation.');return;}
    try{localStorage.removeItem(key);}catch{};onClose();
   }else {setUnconfirmedSave(true);setError(receipt?.reason?groupError(receipt.reason):null);}
  }finally{saveInFlight.current=false;}
 };
 const remove=async()=>{const receipt=await binding.remove(target());if(receipt?.accepted){try{localStorage.removeItem(key);}catch{};onClose();}};
 const time=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
 const parse=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
 const pickerOpened=React.useRef(false);
 React.useEffect(()=>{if(!startPicker||pickerOpened.current||operationPending)return;pickerOpened.current=true;if(platform==='ios')void binding.picker(target());else setChooser(true);},[startPicker,operationPending]);
 const failure=error??saveCompletionError??(binding.error?groupError(binding.error):unconfirmedSave?groupError(null):null);
 const failureDiagnosticText=failure?safeFailureDetails(binding):null;
 const selectedCount=platform==='ios'?group.draftApplicationCount ?? group.applicationCount:draft.packages.length;
 return <SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><View testID="group-editor-navigation" style={{paddingHorizontal:20,paddingVertical:4,flexDirection:stackedHeading?'column':'row',alignItems:stackedHeading?'stretch':'center',gap:stackedHeading?4:16}}><Pressable testID="group-cancel" accessibilityRole="button" accessibilityLabel={translateSource('Cancel')} accessibilityState={{disabled:operationPending}} disabled={operationPending} onPress={onClose} style={{minHeight:44,minWidth:44,maxWidth:'100%',flexShrink:0,paddingHorizontal:4,alignSelf:stackedHeading?'flex-start':undefined,alignItems:'center',justifyContent:'center'}}><Text style={{minWidth:0,maxWidth:'100%',color:colors.accent,fontSize:17,lineHeight:24}}>Cancel</Text></Pressable><Text accessibilityRole="header" style={{flex:stackedHeading?undefined:1,width:stackedHeading?'100%':undefined,minWidth:0,maxWidth:'100%',color:colors.text,fontSize:17,lineHeight:24,fontWeight:'700',textAlign:'center'}}>{simple?'App protection':'Edit group'}</Text></View><ScrollView testID="app-group-editor" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:16}}>
  {!simple?<TextInput testID="group-name" accessibilityLabel={translateSource('Group name')} placeholder={translateSource('Group name')} placeholderTextColor={colors.text2} value={draft.name} editable={!operationPending} maxLength={80} onChangeText={name=>setDraft(d=>({...d,name}))} style={{minHeight:48,padding:12,borderRadius:12,backgroundColor:colors.surface2,color:colors.text,fontSize:17}}/>:null}
  {!simple?<View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{flex:1,color:colors.text,fontSize:17}}>Enable group</Text><Switch testID="group-enable" accessible accessibilityRole="switch" accessibilityState={{checked:draft.enabled,disabled:operationPending}} accessibilityLabel={translateSource('Enable group')} disabled={operationPending} value={draft.enabled} onValueChange={enabled=>setDraft(d=>({...d,enabled}))}/></View>:null}
  <View style={{padding:12,gap:8,borderRadius:16,borderCurve:'continuous',backgroundColor:colors.surface}}>
  {platform==='ios'?<NativeAppGroupLabels groupId={group.id} {...presentation(binding.status,group)} draft layout="preview"/>:<InstalledGroupAppsPreview actionScope={binding.actionScope} packages={draft.packages}/>}
  <View style={{width:'100%',minWidth:0,gap:4}}><Text translate={false} style={{minWidth:0,color:colors.text2,fontSize:17,lineHeight:24}}>{`${selectedCount.toLocaleString(appI18n.language)} ${translateSource('selected apps')}`}</Text>
  <Text testID="group-pending-state" style={{color:colors.text2,fontSize:15,lineHeight:22}}>{!group.enabled?'Not active':hasChanges?'Changes not applied':group.ready?'Enabled':'Needs attention'}</Text></View>
  {action(platform==='ios'?'Choose individual apps':'Choose installed apps',()=>{if(platform==='ios')void binding.picker(target());else setChooser(true);},'group-choose-apps')}
  </View>
  <Pressable testID="group-rule-choice" accessibilityRole="button" accessibilityLabel={translateSource('Shared rule')} accessibilityState={{expanded:ruleChoices,disabled:operationPending}} disabled={operationPending} onPress={()=>setRuleChoices(value=>!value)} style={{minHeight:48,paddingVertical:12,flexDirection:'column',alignItems:'stretch',gap:4}}><Text style={{width:'100%',minWidth:0,color:colors.text,fontSize:17,lineHeight:24}}>Shared rule</Text><Text style={{width:'100%',minWidth:0,color:colors.accent,fontSize:17,lineHeight:24}}>{ruleName({...group,rule:group.rule.kind==='legacy'&&draft.adoptLegacy!==true?group.rule:draft.rule})}</Text></Pressable>
  {group.rule.kind==='legacy'?<Text style={{color:colors.text2,fontSize:15,lineHeight:22}}>Existing protection stays active until you choose and update a group rule.</Text>:null}
  {ruleChoices?(['daily-limit','before-use','scheduled'] as const).map(kind=><Pressable key={kind} testID={`group-rule-${kind}`} accessibilityRole="radio" accessibilityState={{selected:draft.rule.kind===kind&&(group.rule.kind!=='legacy'||draft.adoptLegacy===true),disabled:operationPending}} disabled={operationPending} onPress={()=>{setDraft(d=>({...d,adoptLegacy:group.rule.kind==='legacy'?true:d.adoptLegacy,rule:d.rule.kind===kind?d.rule:kind==='daily-limit'?{kind,limitMinutes:30}:kind==='scheduled'?{kind,startMinute:1320,endMinute:420,days:[0,1,2,3,4,5,6]}:{kind}}));setRuleChoices(false);}} style={{minHeight:48,padding:12,borderRadius:12,backgroundColor:draft.rule.kind===kind?colors.surface2:colors.surface}}><Text style={{color:colors.text,fontSize:17}}>{kind==='before-use'?'Before use':kind==='scheduled'?'Schedule':'Daily limit'}</Text></Pressable>):null}
  <View style={{backgroundColor:colors.surface,borderRadius:16,borderCurve:'continuous',overflow:'hidden'}}>
  {draft.rule.kind==='daily-limit'&&(group.rule.kind!=='legacy'||draft.adoptLegacy===true)?<View testID="group-daily-allowance"><AppGroupValueRow testID="group-daily-value" label={appI18n.t('earnedSetup.dailyAllowance',{defaultValue:'Daily allowance'})} value={draft.rule.limitMinutes} disabled={operationPending} options={Array.from(new Set([...Array.from({length:48},(_,index)=>(index+1)*5),draft.rule.limitMinutes])).sort((a,b)=>a-b).map(minutes=>({value:minutes,label:minutesLabel(minutes),testID:'group-daily-'+minutes}))} onChange={limitMinutes=>setDraft(d=>({...d,rule:{kind:'daily-limit',limitMinutes}}))} description={appI18n.t('earnedSetup.afterAllowance',{defaultValue:'Use this daily allowance without a challenge. A challenge is offered after the shared allowance runs out.'})}/></View>:null}
  {draft.rule.kind==='scheduled'?<View style={{gap:12}}><NativeTimeInput disabled={Boolean(operationPending)} label="Start time" value={time(draft.rule.startMinute)} onChange={value=>setDraft(d=>d.rule.kind==='scheduled'?{...d,rule:{...d.rule,startMinute:parse(value)}}:d)}/><NativeTimeInput disabled={Boolean(operationPending)} label="End time" value={time(draft.rule.endMinute)} onChange={value=>setDraft(d=>d.rule.kind==='scheduled'?{...d,rule:{...d.rule,endMinute:parse(value)}}:d)}/><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{Array.from({length:7},(_,day)=>{const date=new Date(2026,9,4+day),label=new Intl.DateTimeFormat(appI18n.language,{weekday:'short'}).format(date),selected=draft.rule.kind==='scheduled'&&draft.rule.days.includes(day);return <Pressable key={day} accessibilityRole="checkbox" accessibilityLabel={new Intl.DateTimeFormat(appI18n.language,{weekday:'long'}).format(date)} accessibilityState={{checked:selected,disabled:Boolean(operationPending)}} disabled={Boolean(operationPending)} onPress={()=>setDraft(d=>d.rule.kind==='scheduled'?{...d,rule:{...d.rule,days:selected?d.rule.days.filter(n=>n!==day):[...d.rule.days,day]}}:d)} style={{minHeight:44,minWidth:44,padding:8,borderRadius:12,backgroundColor:selected?colors.accent:colors.surface2}}><Text translate={false} style={{color:selected?colors.onAccent:colors.text,fontSize:17}}>{label}</Text></Pressable>;})}</View><Text style={{color:colors.text2}}>An overnight window belongs to the day it starts. iOS requires at least 15 minutes.</Text></View>:null}
  {binding.earnedTimeAvailable?<View testID="group-preferred-window" style={{gap:12}}>
   {preferenceSupported?<AppGroupValueRow testID="group-preferred-value" label={appI18n.t('appEditor.earnedWindow',{defaultValue:'Earned window'})} value={preferredBreakSeconds} options={supportedBreakSeconds.map(seconds=>({value:seconds,label:minutesLabel(seconds/60),testID:'group-preferred-break-'+seconds}))} disabled={operationPending} onChange={seconds=>{setError(null);setDraft(value=>({...value,preferredBreakSeconds:seconds as EarnedAppTimeSeconds,preferredBreakBaseSeconds:group.preferredBreakSeconds??300}));}} description={appI18n.t('earnedSetup.windowDescription',{defaultValue:'Choose the app time you can request after a completed challenge. This saved preference does not start a break.'})}/>:<Text translate={false} testID="group-window-update-needed" style={{padding:16,color:colors.text2,fontSize:15,lineHeight:22}}>{appI18n.t('earnedSetup.updatePreference',{defaultValue:'Saved default: {{minutes}} minutes. Update FREED to save a preferred window; you can still choose 5 or 10 minutes at the interruption.',minutes:(group.preferredBreakSeconds??300)/60})}</Text>}
   {preferredResolution.conflict?<View testID="group-window-conflict" style={{gap:8}}><Text translate={false} style={{color:colors.text2,lineHeight:24}}>{appI18n.t('earnedSetup.preferenceChanged',{defaultValue:'The saved challenge window changed. Choose which preference to keep.'})}</Text>{action(appI18n.t('earnedSetup.useCurrentPreference',{defaultValue:'Use saved window'}),()=>setDraft(value=>({...value,preferredBreakSeconds:group.preferredBreakSeconds??300,preferredBreakBaseSeconds:group.preferredBreakSeconds??300})),'group-window-use-current')}{action(appI18n.t('earnedSetup.keepPreference',{defaultValue:'Keep my window choice'}),()=>setDraft(value=>({...value,preferredBreakBaseSeconds:group.preferredBreakSeconds??300})),'group-window-keep-draft')}</View>:null}
   {(capResolution.draft.extraTimeCapMinutes??group.extraTimeBudget?.configuredCapMinutes??20)*60<preferredBreakSeconds?<Text translate={false} style={{color:colors.text2,lineHeight:22}}>{(capResolution.draft.extraTimeCapMinutes??group.extraTimeBudget?.configuredCapMinutes??20)===0?appI18n.t('uiRefinement.capOff'):appI18n.t('earnedSetup.capBelowPreference',{defaultValue:'The daily extra-time cap is smaller than this preferred window. You can choose a shorter eligible window at the interruption.'})}</Text>:null}
  </View>:null}
  {binding.earnedTimeAvailable?<View testID="group-extra-time" style={{gap:12}}>
   {capResolution.conflict?<View testID="group-cap-conflict" style={{gap:8}}><Text translate={false} style={{color:colors.text2,fontSize:17,lineHeight:24}}>{appI18n.t('earnedTime.capChanged',{defaultValue:'The extra-time cap changed. Choose which cap to keep.'})}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{action(appI18n.t('earnedTime.capUseCurrent',{defaultValue:'Use current cap'}),()=>{setError(null);setDraft(d=>({...d,extraTimeCapMinutes:group.extraTimeBudget?.configuredCapMinutes??20,extraTimeCapBaseMinutes:group.extraTimeBudget?.configuredCapMinutes??20,extraTimeBudgetRevision:group.extraTimeBudget?.revision??0}));},'group-cap-use-current')}{action(appI18n.t('earnedTime.capKeepDraft',{defaultValue:'Keep my choice'}),()=>{setError(null);setDraft(d=>({...d,extraTimeCapBaseMinutes:group.extraTimeBudget?.configuredCapMinutes??20,extraTimeBudgetRevision:group.extraTimeBudget?.revision??0}));},'group-cap-keep-draft')}</View></View>:null}
   <AppGroupValueRow testID="group-cap-value" label={appI18n.t('earnedTime.capTitle',{defaultValue:'Extra time each day'})} value={capResolution.draft.extraTimeCapMinutes??group.extraTimeBudget?.configuredCapMinutes??20} options={([0,5,10,20,30,60] as const).map(minutes=>({value:minutes,label:minutes===0?appI18n.t('earnedTime.capOff',{defaultValue:'Off'}):minutesLabel(minutes),testID:'group-extra-cap-'+minutes}))} disabled={operationPending} onChange={minutes=>{setError(null);setDraft(d=>({...d,extraTimeCapMinutes:minutes as EarnedAppTimeCapMinutes,extraTimeCapBaseMinutes:group.extraTimeBudget?.configuredCapMinutes??20,extraTimeBudgetRevision:group.extraTimeBudget?.revision??0}));}} description={appI18n.t('earnedTime.capChangeNotice',{defaultValue:'Increases start tomorrow. A lower cap applies now without changing a break already running.'})}/>

   {details?<><Text translate={false} style={{color:colors.text2,fontSize:15,lineHeight:22}}>{appI18n.t('earnedTime.capChangeNotice',{defaultValue:'Increases start tomorrow. A lower cap applies now without changing a break already running.'})}</Text>
   {group.extraTimeBudget?<Text translate={false} style={{color:colors.text2,fontSize:15,lineHeight:22}}>{group.extraTimeBudget.clockState==='unverified'?appI18n.t('earnedTime.capClock',{defaultValue:'Check your device’s date and time before requesting more app time.'}):appI18n.t('earnedTime.capRemaining',{defaultValue:'{{minutes}} min extra time left today.',minutes:Math.floor(group.extraTimeBudget.remainingSeconds/60)})}</Text>:null}
   {group.extraTimeBudget?.pendingCapMinutes!=null?<Text translate={false} style={{color:colors.text2,fontSize:15,lineHeight:22}}>{appI18n.t('earnedTime.capPending',{defaultValue:'{{minutes}} min starts tomorrow.',minutes:group.extraTimeBudget.pendingCapMinutes})}</Text>:null}
   </>:null}
  </View>:null}
  </View>
  {draft.rule.kind==='daily-limit'?<Text translate={false} testID="group-daily-explanation" style={{color:colors.text2,fontSize:15,lineHeight:22}}>{(capResolution.draft.extraTimeCapMinutes??group.extraTimeBudget?.configuredCapMinutes??20)===0?appI18n.t('uiRefinement.dailyOff',{dailyMinutes:draft.rule.limitMinutes}):appI18n.t('appEditor.dailyFlow',{defaultValue:'Use {{dailyMinutes}} minutes without a challenge. After the allowance runs out, an activity can earn a {{breakMinutes}}-minute app break within your daily extra-time cap.',dailyMinutes:draft.rule.limitMinutes,breakMinutes:preferredBreakSeconds/60})}</Text>:null}
  <Pressable testID="group-details-toggle" accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(value=>!value)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:15}}>How protection works</Text></Pressable>
  {details?<>
  <Text testID="group-selection-guidance" style={{color:colors.text2,fontSize:15,lineHeight:22}}>{requiresActivation?activationGuidance:'Changes stay a draft until you update protection.'}</Text>
  {cleanupDraft.current?action('Retry clearing the draft',()=>clearDiscardedDraft(cleanupDraft.current!),'group-draft-cleanup-retry'):hasChanges?action('Discard pending changes',requestDiscard,'group-discard-draft'):null}
  {binding.earnedTimeAvailable&&(group.rule.kind!=='legacy'||draft.adoptLegacy===true)?<View testID="group-window-summary" style={{gap:8}}><Text translate={false} accessibilityRole="header" style={{color:colors.text,fontSize:21,fontWeight:'700'}}>{appI18n.t('earnedSetup.flowTitle',{defaultValue:'How this rule works'})}</Text><Text translate={false} style={{color:colors.text2,fontSize:17,lineHeight:24}}>{(capResolution.draft.extraTimeCapMinutes??group.extraTimeBudget?.configuredCapMinutes??20)===0?appI18n.t('uiRefinement.capOff'):appI18n.t(draft.rule.kind==='daily-limit'?'earnedSetup.dailyFlow':draft.rule.kind==='before-use'?'earnedSetup.beforeUseFlow':'earnedSetup.scheduledFlow',{defaultValue:draft.rule.kind==='daily-limit'?'{{dailyMinutes}} minutes shared daily → pause in FREED → complete a challenge → request a {{breakMinutes}}-minute window for the originating app → protection returns.':draft.rule.kind==='before-use'?'Before opening an app → pause in FREED → complete a challenge → request a {{breakMinutes}}-minute window for the originating app → protection returns.':'During the protected schedule → pause in FREED → complete a challenge → request a {{breakMinutes}}-minute window for the originating app → protection returns.',dailyMinutes:draft.rule.kind==='daily-limit'?draft.rule.limitMinutes:0,breakMinutes:preferredBreakSeconds/60})}</Text><Text translate={false} style={{color:colors.text2,fontSize:15,lineHeight:22}}>{appI18n.t('earnedSetup.explicitStart',{defaultValue:'When extra time is available, only Start my break opens the originating app. Its continuous window ends even while FREED is closed.'})}</Text></View>:null}
  <Text style={{color:colors.text2,fontSize:15,lineHeight:22}}>Overlapping groups and independent protections remain active during a scoped recovery break. Adult website protection stays on.</Text>
  {binding.actionDiagnostics?<Text translate={false} selectable testID="group-action-diagnostics" style={{color:colors.text2,fontSize:13,lineHeight:19}}>{[binding.actionDiagnostics.operation,binding.actionDiagnostics.stage,binding.actionDiagnostics.reason,binding.actionDiagnostics.errorDomain,binding.actionDiagnostics.errorCode,typeof binding.actionDiagnostics.protectedDataAvailable==='boolean'?`protectedDataAvailable=${binding.actionDiagnostics.protectedDataAvailable}`:null,typeof binding.actionDiagnostics.containerAvailable==='boolean'?`containerAvailable=${binding.actionDiagnostics.containerAvailable}`:null,...clockFailureDetails(validateAppGroupActionDiagnostics(binding.actionDiagnostics))].filter(value=>value!==null&&value!==undefined).join(' · ')}</Text>:null}
  </>:null}
  {!simple? action('Remove group',()=>{void remove();},'group-remove'):null}
 </ScrollView><View testID="group-editor-footer" style={{paddingHorizontal:20,paddingTop:12,paddingBottom:8,gap:8,borderTopWidth:1,borderColor:colors.border}}>{failure?<Text accessibilityRole="alert" style={{color:colors.red,fontSize:15,lineHeight:21}}>{failure}</Text>:null}<GroupFailureDetails text={failureDiagnosticText} prefix="group-failure"/><Pressable testID={primaryId} accessibilityRole="button" accessibilityLabel={translateSource(primaryLabel)} accessibilityState={{disabled:operationPending||requiresActivation&&selectedCount===0}} disabled={operationPending||requiresActivation&&selectedCount===0} onPress={()=>{void save(requiresActivation);}} style={{minHeight:52,paddingHorizontal:20,paddingVertical:14,borderRadius:14,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.onAccent,fontSize:17,fontWeight:'700',textAlign:'center'}}>{primaryLabel}</Text></Pressable></View>{chooser?<InstalledGroupAppsChooser actionScope={binding.actionScope} selected={draft.packages} onClose={()=>setChooser(false)} onDone={packages=>{setDraft(d=>({...d,packages}));setChooser(false);}}/>:null}</KeyboardAvoidingView></SafeAreaView>;
}
