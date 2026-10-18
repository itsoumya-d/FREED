import {task86CleanupDependencies} from '../helpers/task86-native-account-fixture';
import {EARNED_TIME_REFERENCE_PREFIX} from '@/lib/earned-time-reference';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Text, View, Pressable, ActivityIndicator } from 'react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { usePersistentRecoveryState } from '@/lib/recovery-storage';
import { createOwnerRecoveryStore } from '@/lib/owner-recovery-store';
import { createJournalRepository } from '@/lib/journal-repository';
import { createDefaultRecoveryState, recordDailyCheckIn } from '@/lib/recovery-state';
import { createAccountOperationGate } from '@/lib/account-operation';
import { trustedPrivateOwner } from '@/lib/trusted-private-owner';
import { getJourneyOwner } from '@/lib/user-journey';
import { purgeJournalOwner } from '@/lib/journal-lifecycle';
import { beginOwnerRestoreDeletion, completeOwnerRestoreDeletion } from '@/lib/whole-app-restore';
import { executeAccountDeletion, loadAccountDeletionReceipt, saveAccountDeletionReceipt } from '@/lib/account-deletion-receipt';
import { RECOVERY_DRAFT_STORAGE_KEYS, RECOVERY_TOOL_SESSION_STORAGE_KEYS } from '@/lib/recovery-drafts';
import { AccountDeletionDestination } from '@/components/AccountDeletionDestination';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'}),useOptionalAppPreferences:()=>null}));

const owner='flow-cleanup-a',other='flow-cleanup-b',time='2026-10-07T12:00:00.000Z';
function fixture(failure:'key'|'photo'|'storage'='key',sourcePath=process.env.TASK4_FIX2_CONTROLLER_SOURCE??'src/features/freed-app.tsx') {
 const source=readFileSync(sourcePath,'utf8'),values=new Map<string,string>(),listeners=new Set<()=>void>();let sdk:string|null=owner,fail=true;
 let snapshot:any={status:'ready',signedIn:true,anonymous:false,ownerUid:owner,email:'original@example.test'};
 const publish=(uid:string|null)=>{sdk=uid;snapshot={status:'ready',signedIn:!!uid,anonymous:false,ownerUid:uid,email:uid?'current@example.test':null};listeners.forEach(fn=>fn());};
 const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{if(fail&&failure==='storage'&&k===`freed.private.owner.${owner}.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`)throw new Error('private draft storage failed');values.delete(k);}};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 const ledger=createOwnerRecoveryStore({storage,currentOwnerUid:()=>sdk});ledger.activate(owner).save(recordDailyCheckIn({...createDefaultRecoveryState(),completedChallenges:11},{mood:'steady',urgeLevel:1,reflection:'remaining private history must stay hidden'},time));sdk=other;ledger.activate(other).save({...createDefaultRecoveryState(),completedChallenges:22});sdk=owner;ledger.activate(owner);
 const journal=createJournalRepository({storage,ownerId:owner}),draft=journal.newDraft('2026-10-07');journal.saveDraft({...draft,text:'remaining private journal'});journal.saveEntry(draft.id);storage.setItem(`freed.private.owner.${owner}.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`,'remaining scratch');
 const media={bindOwnerReferences:()=>{},cancelOwner:async()=>({cleanupPending:false}),reconcile:async()=>{if(fail&&failure==='photo')throw new Error('private photo cleanup failed');}} as any;
 const request=jest.fn(async()=>({ok:true,status:'completed'})),reauth=jest.fn(async()=>{}),signout=jest.fn(async()=>publish(null));let controls:any;
 const block=(start:string,end:string)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 const binding=block('  const journeyAuth =','  const privateDraftStorage =');
 const state=block('  const [accountNotice,','  const membershipBusyRef =');
 const callbacks=block('  const cleanupDeletedOwner =','  React.useEffect(() => {\n    if (!hydrated) return undefined;\n\n    consumePendingIntervention();');
 const retryStart=source.indexOf('  const retryConfirmedAccountCleanup =');
 const retryCode=retryStart<0?'':source.slice(retryStart,source.indexOf('  const renderAccountDeletion =',retryStart));
 // Avoid duplicating a future retry callback already inside the extracted callback block.
 const callbackCode=callbacks.includes('const retryConfirmedAccountCleanup')?callbacks:callbacks.replace('  const renderAccountDeletion =',retryCode+'  const renderAccountDeletion =');
 const guard=block('    if (rollbackPending) return','    const guarded =');
 const renderStart=source.indexOf('  const renderScreen =');const guardStart=source.indexOf('    if (rollbackPending) return',renderStart);
 const metadataGuard=source.slice(renderStart,guardStart).replace(/^\s*const renderScreen[^\n]+\n/,'');
 const modal=block('      <Modal visible={confirmingDeletion}','      <Modal visible={adoptingLegacy}');
 const script=`return function Probe(){
   const [screen,setScreen]=React.useState('main'); ${binding}
   const journalResources=React.useRef({owner:journeyOwner,repository:null,media});const journalMedia=media,journalChanged=()=>{};
   ${state}
   const accountOperationGate=React.useRef(createAccountOperationGate(getFirebaseAccountScope));
   const pendingJournalRestore=React.useRef(null);const setPendingRecoveryRestore=()=>{};const enterAccountFlow=()=>{};
   ${callbackCode}
   const renderScreen=()=>{${metadataGuard}${guard}return <Text testID="private-count">{recoveryState.completedChallenges}:{recoveryState.dailyCheckIns[0]?.reflection??''}</Text>;};
   capture({privateViewLocked,ownerCleanupPending,rollbackPending,recoveryState,accountCleanupReceipt:typeof accountCleanupReceipt==='undefined'?null:accountCleanupReceipt,retryConfirmedAccountCleanup:typeof retryConfirmedAccountCleanup==='undefined'?null:retryConfirmedAccountCleanup});
   return <View>{renderScreen()}<Pressable testID="profile-delete" onPress={()=>{requestConfirmedAccountDeletion().catch(()=>{});}}><Text>Start profile deletion</Text></Pressable>${modal}</View>;
 };`;
 function ReauthBoundary({onConfirmed,onCancel,onBusyChange}:any){const [error,setError]=React.useState('');return <View testID="reauth-modal"><Pressable testID="confirm-reauth" onPress={()=>{onBusyChange(true);reauth();Promise.resolve(onConfirmed(owner)).catch(()=>setError('cleanup failed')).finally(()=>onBusyChange(false));}}><Text>Confirm identity</Text></Pressable><Pressable testID="cancel-reauth" onPress={onCancel}><Text>Cancel deletion modal</Text></Pressable><Text>{error}</Text></View>;}
 const deps:any={React,Text,View,Pressable,ActivityIndicator,SafeAreaView:View,Modal:({visible,children}:any)=>visible?<View>{children}</View>:null,AccountReauthenticationScreen:ReauthBoundary,AccountDeletionDestination,
  subscribeFirebaseAuthSnapshot:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},getFirebaseAuthSnapshot:()=>snapshot,getFirebaseAccountScope:()=>sdk,trustedPrivateOwner,getJourneyOwner,usePersistentRecoveryState,
  createAccountOperationGate,executeAccountDeletion,loadAccountDeletionReceipt,beginOwnerRestoreDeletion,completeOwnerRestoreDeletion,purgeJournalOwner,createJournalRepository,RECOVERY_DRAFT_STORAGE_KEYS,RECOVERY_TOOL_SESSION_STORAGE_KEYS,EARNED_TIME_REFERENCE_PREFIX,
  media,colors:{bg:'#fff',text:'#111',accent:'#00f'},PillButton:({label,onPress}:any)=><Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,
  cancelAutomaticBackupSync:()=>{},disableAutomaticBackup:async()=>{if(fail&&failure==='key')throw new Error('secure key removal failed');},signOutFirebaseAccount:signout,revokeAppleAuthorizationForDeletion:async()=>{},getFirebaseCallableContracts:async()=>({requestAccountDeletion:request}),createFirebaseClientEventId:()=> 'deletion_actual_flow',
  getFirebaseAccountSummary:()=>({signedIn:!!sdk,anonymous:false,email:sdk?'current@example.test':null,providers:[]}),router:{push:jest.fn()},Platform:{OS:'ios'},Linking:{openURL:jest.fn()},safeUserFacingMessage:(_e:any,f:string)=>f,
  capture:(v:any)=>{controls=v;}};
 const nativeId='a2222222-2222-4222-8222-222222222222',admission={ownerUid:owner,actionScope:'opaque-A',bindingHandle:'a1111111-1111-4111-8111-111111111111'};
 const nativeSnapshot={status:'ready',reason:null,admission,revision:1};
 Object.assign(deps,{...task86CleanupDependencies(),getFirebaseNativeAccountSessionSnapshot:()=>nativeSnapshot,subscribeFirebaseNativeAccountSession:()=>()=>{},getFirebaseNativeAccountAdmission:()=>sdk===owner?admission:null,saveAccountDeletionReceipt,
 prepareNativeAccountCleanup:async()=>({version:2,operationId:nativeId,phase:'prepared',completed:false,privateErased:false,runtimeComplete:false,executionAdmitted:false,retainedProtection:true}),executeNativeAccountCleanup:async()=>({version:2,operationId:nativeId,phase:'completed',completed:true,privateErased:true,runtimeComplete:true,executionAdmitted:true,retainedProtection:true})});
 // The implementation will supply this metadata resolver; before source never references it.
 try { deps.readConfirmedAccountCleanupReceipt=require('@/lib/account-cleanup-metadata').readConfirmedAccountCleanupReceipt; } catch { /* RED source has no resolver. */ }
 const Probe=new Function(...Object.keys(deps),transpileModule(script,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText)(...Object.values(deps));
 return {Probe,values,ledger,request,reauth,signout,publish,allow:()=>{fail=false;},get:()=>controls};
}
async function failProfile(f:ReturnType<typeof fixture>,view:ReturnType<typeof render>){fireEvent.press(view.getByTestId('profile-delete'));await act(async()=>fireEvent.press(view.getByTestId('confirm-reauth')));await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});expect(view.getByText('cleanup failed')).toBeOnTheScreen();fireEvent.press(view.getByTestId('cancel-reauth'));}
test.each(['key','photo','storage'] as const)('actual profile %s cleanup failure → real lock/hook → modal cancel → receipt retry works without private history or reauthentication',async failure=>{
 const f=fixture(failure),view=render(<f.Probe/>);expect(view.getByTestId('private-count')).toHaveTextContent(/^11:/);await failProfile(f,view);
 expect(f.get().privateViewLocked).toBe(true);expect(view.queryByTestId('private-count')).toBeNull();expect(view.queryByText(/remaining private history/)).toBeNull();
 expect(view.getByRole('button',{name:'Retry local cleanup'})).toBeOnTheScreen();
 expect(f.get().recoveryState.completedChallenges).toBe(0);expect(f.get().ownerCleanupPending).toBe('account');expect(f.get().rollbackPending).toBe(true);
 f.allow();await act(async()=>fireEvent.press(view.getByRole('button',{name:'Retry local cleanup'})));
 expect(view.getByText('Cloud deletion is confirmed. This account’s private local history was removed.')).toBeOnTheScreen();expect(f.request).toHaveBeenCalledTimes(1);expect(f.reauth).toHaveBeenCalledTimes(1);expect(f.ledger.readOwner(other).completedChallenges).toBe(22);expect(f.ledger.readOwner(owner).completedChallenges).toBe(0);
});
test('actual Auth-null cold restart finds the durable completed receipt and retries without a private owner',async()=>{
 const f=fixture('key'),view=render(<f.Probe/>);await failProfile(f,view);view.unmount();f.publish(null);const cold=render(<f.Probe/>);
 expect(f.get().recoveryState.completedChallenges).toBe(0);expect(cold.queryByText(/remaining private history/)).toBeNull();expect(cold.getByRole('button',{name:'Retry local cleanup'})).toBeOnTheScreen();f.allow();await act(async()=>fireEvent.press(cold.getByRole('button',{name:'Retry local cleanup'})));expect(cold.getByText('Cloud deletion is confirmed. This account’s private local history was removed.')).toBeOnTheScreen();expect(f.request).toHaveBeenCalledTimes(1);
});
test('switching to another owner never exposes the previous owner receipt or blocks its private account view',async()=>{
 const f=fixture('key'),view=render(<f.Probe/>);await failProfile(f,view);const staleRetry=f.get().retryConfirmedAccountCleanup,receipt=f.get().accountCleanupReceipt;await act(async()=>f.publish(other));expect(view.queryByText('Cloud deletion is confirmed. Local cleanup still needs to finish.')).toBeNull();expect(view.queryByRole('button',{name:'Retry local cleanup'})).toBeNull();expect(view.getByTestId('private-count')).toHaveTextContent(/^22:/);expect(f.ledger.readOwner(owner).completedChallenges).toBe(11);
 f.allow();await act(async()=>{await staleRetry(receipt);});expect(f.ledger.readOwner(other).completedChallenges).toBe(22);expect(f.ledger.readOwner(owner).completedChallenges).toBe(0);
});
test('same-SDK-owner cold start shows only durable cleanup metadata and completes without provider reauthentication',async()=>{
 const f=fixture('key'),view=render(<f.Probe/>);await failProfile(f,view);view.unmount();const cold=render(<f.Probe/>);expect(cold.queryByTestId('private-count')).toBeNull();expect(f.get().recoveryState.completedChallenges).toBe(0);expect(cold.getByRole('button',{name:'Retry local cleanup'})).toBeOnTheScreen();f.allow();await act(async()=>fireEvent.press(cold.getByRole('button',{name:'Retry local cleanup'})));expect(cold.getByText('Cloud deletion is confirmed. This account’s private local history was removed.')).toBeOnTheScreen();expect(f.request).toHaveBeenCalledTimes(1);expect(f.reauth).toHaveBeenCalledTimes(1);
});
test('server-confirmed Auth-null failure exposes retry immediately after modal cancellation and confirms completion',async()=>{
 const f=fixture('key');f.request.mockImplementationOnce(async()=>{f.publish(null);return {ok:true,status:'completed'};});const view=render(<f.Probe/>);await failProfile(f,view);expect(f.get().recoveryState.completedChallenges).toBe(0);expect(view.queryByText(/remaining private history/)).toBeNull();expect(view.getByRole('button',{name:'Retry local cleanup'})).toBeOnTheScreen();f.allow();await act(async()=>fireEvent.press(view.getByRole('button',{name:'Retry local cleanup'})));expect(view.getByText('Cloud deletion is confirmed. This account’s private local history was removed.')).toBeOnTheScreen();expect(f.request).toHaveBeenCalledTimes(1);
});
test('actual processing acknowledgement closes reauthentication and retains private history without a cleanup/completed claim',async()=>{
 const f=fixture('key');f.request.mockResolvedValueOnce({ok:true,status:'processing'});const view=render(<f.Probe/>);fireEvent.press(view.getByTestId('profile-delete'));await act(async()=>fireEvent.press(view.getByTestId('confirm-reauth')));await act(async()=>{await Promise.resolve();await Promise.resolve();});
 expect(view.queryByTestId('reauth-modal')).toBeNull();expect(view.getByTestId('private-count')).toHaveTextContent(/^11:/);expect(view.queryByRole('button',{name:'Retry local cleanup'})).toBeNull();expect(view.queryByText('Cloud deletion is confirmed. This account’s private local history was removed.')).toBeNull();expect(f.signout).not.toHaveBeenCalled();expect(f.ledger.readOwner(owner).completedChallenges).toBe(11);
});
