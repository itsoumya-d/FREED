import {task86CleanupDependencies} from './helpers/task86-native-account-fixture';
import {EARNED_TIME_REFERENCE_PREFIX} from '../src/lib/earned-time-reference';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { createOwnerRecoveryStore } from '../src/lib/owner-recovery-store';
import { createDefaultRecoveryState } from '../src/lib/recovery-state';
import { createJournalRepository } from '../src/lib/journal-repository';
import { purgeJournalOwner } from '../src/lib/journal-lifecycle';
import { createAccountOperationGate } from '../src/lib/account-operation';
import { trustedPrivateOwner } from '../src/lib/trusted-private-owner';
import { afterConfirmedCleanup } from '../src/lib/confirmed-cleanup';
import { RECOVERY_DRAFT_STORAGE_KEYS, RECOVERY_TOOL_SESSION_STORAGE_KEYS } from '../src/lib/recovery-drafts';
import { beginOwnerRestoreDeletion, completeOwnerRestoreDeletion } from '../src/lib/whole-app-restore';
test('actual explicit local-data root cleanup removes current-owner journal/drafts only and reopens a fresh writer',async()=>{
 const source=readFileSync('src/features/freed-app.tsx','utf8'),start=source.indexOf('  const deleteLocalRecoveryData ='),end=source.indexOf('  const cleanupDeletedOwner =',start),code=transpileModule(source.slice(start,end)+';return deleteLocalRecoveryData;',{compilerOptions:{module:ModuleKind.CommonJS}}).outputText;
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>values.delete(k)};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});let uid='local-a';
 const ownerStore=createOwnerRecoveryStore({storage,currentOwnerUid:()=>uid});ownerStore.activate('local-a').save({...createDefaultRecoveryState(),completedChallenges:11});uid='local-b';ownerStore.activate('local-b').save({...createDefaultRecoveryState(),completedChallenges:22});uid='local-a';ownerStore.activate(uid);
 const a=createJournalRepository({storage,ownerId:'local-a'}),b=createJournalRepository({storage,ownerId:'local-b'});for(const repo of [a,b]){const draft=repo.newDraft('2026-10-07');repo.saveDraft({...draft,text:`private ${repo.ownerId}`});repo.saveEntry(draft.id);storage.setItem(`freed.private.owner.${repo.ownerId}.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`,`scratch ${repo.ownerId}`);}
 for(const owner of ['local-a','local-b'])storage.setItem(EARNED_TIME_REFERENCE_PREFIX+owner,`reference ${owner}`);
 const noop=()=>{},deps={React:{useCallback:(v:any)=>v},trustedPrivateOwner,getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:true,anonymous:false,ownerUid:uid,email:null}),getFirebaseAccountScope:()=>uid,accountOperationGate:{current:createAccountOperationGate(()=>uid)},afterConfirmedCleanup,appConfigQueue:{current:null},setAppConfigSyncBusy:noop,Platform:{OS:'web'},resetProtectionConfiguration:async()=>({}),setProtectionStatus:noop,cancelAutomaticBackupSync:noop,disableAutomaticBackup:async()=>{},ownerStore,purgeJournalOwner,createJournalRepository,journalMedia:null,RECOVERY_DRAFT_STORAGE_KEYS,RECOVERY_TOOL_SESSION_STORAGE_KEYS,EARNED_TIME_REFERENCE_PREFIX,clearCompanionPresentationHistory:noop,discardChallengeSession:()=>true,challengeSession:{abandon:noop,getSnapshot:noop},setRemoteRetentionPlan:noop,setPendingFirebaseEmailLink:noop,setPendingRecoveryRestore:noop,pendingJournalRestore:{current:null},pendingInterventionTracker:{current:null},createPendingInterventionTracker:()=>({}),consumedDeepLinkIntervention:{current:null},setActiveAttempt:noop,setSelectedChallenge:noop,setProtectionSyncMessage:noop,lastCueState:{current:null},setCompanionCue:noop,resumeOwner:noop,journalChanged:noop,persistRecoveryState:noop,setProtectionIntentState:noop,setTab:noop,setScreen:noop};
 const nativeId='77777777-7777-4777-8777-777777777777',admission={ownerUid:'local-a',actionScope:'native-opaque-A',bindingHandle:'88888888-8888-4888-8888-888888888888'};
 Object.assign(deps,{...task86CleanupDependencies(),beginOwnerRestoreDeletion,completeOwnerRestoreDeletion,getFirebaseNativeAccountAdmission:()=>admission,prepareNativeAccountCleanup:async()=>({version:2,operationId:nativeId,phase:'prepared',completed:false,privateErased:false,runtimeComplete:false,executionAdmitted:false,retainedProtection:true}),executeNativeAccountCleanup:async()=>({version:2,operationId:nativeId,phase:'runtimePending',completed:false,privateErased:true,runtimeComplete:false,executionAdmitted:true,retainedProtection:true})});
 // 15 October: native pending cannot block JS erasure; adult/full reset is never called.
 deps.Platform.OS='android';let resets=0;deps.resetProtectionConfiguration=async()=>{resets++;return{protectionConfigurationResetAccepted:false};};
 await new Function(...Object.keys(deps),code)(...Object.values(deps))();assert.equal(resets,0);
 assert.equal(JSON.parse(storage.getItem('freed.account.native-cleanup.v2.local.'+nativeId)!).state,'pending');
 assert.equal(createJournalRepository({storage,ownerId:'local-a'}).list().length,0);assert.equal(b.list()[0].text,'private local-b');assert.equal(ownerStore.readOwner('local-b').completedChallenges,22);assert.equal(storage.getItem(`freed.private.owner.local-b.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`),'scratch local-b');assert.equal(storage.getItem(`freed.private.owner.local-a.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`),null);assert.equal(a.isActive(),false);
 assert.equal(storage.getItem(EARNED_TIME_REFERENCE_PREFIX+'local-a'),null);assert.equal(storage.getItem(EARNED_TIME_REFERENCE_PREFIX+'local-b'),'reference local-b');
 const fresh=createJournalRepository({storage,ownerId:'local-a'});assert.doesNotThrow(()=>fresh.newDraft('2026-10-07'));
});
