import {task86CleanupDependencies} from './helpers/task86-native-account-fixture';
import {EARNED_TIME_REFERENCE_PREFIX} from '../src/lib/earned-time-reference';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import * as Restore from '../src/lib/whole-app-restore';
import { createOwnerRecoveryStore, OWNER_RECOVERY_STORAGE_KEY } from '../src/lib/owner-recovery-store';
import { createJournalRepository, type JournalPhoto } from '../src/lib/journal-repository';
import { createDefaultRecoveryState } from '../src/lib/recovery-state';
import { createAccountOperationGate } from '../src/lib/account-operation';
import { trustedPrivateOwner } from '../src/lib/trusted-private-owner';
import { afterConfirmedCleanup } from '../src/lib/confirmed-cleanup';
import { purgeJournalOwner } from '../src/lib/journal-lifecycle';
import { executeAccountDeletion, loadAccountDeletionReceipt, saveAccountDeletionReceipt } from '../src/lib/account-deletion-receipt';
import { RECOVERY_DRAFT_STORAGE_KEYS, RECOVERY_TOOL_SESSION_STORAGE_KEYS } from '../src/lib/recovery-drafts';
import type { DecodedJournalArchive } from '../src/lib/journal-archive';
import type { JournalMediaStore } from '../src/lib/journal-media';
const a='restore-delete-a',b='restore-delete-b',time='2026-10-07T12:00:00.000Z';
const barrierKey=(owner:string)=>`freed.restore.deletion.v1.${encodeURIComponent(owner)}`;
function fixture() {
  const values=new Map<string,string>(); let sdk:string|null=a,recoveryFailures=0,removeFail=false,barrierFail=false,completeFail=false;
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{
    if(k===OWNER_RECOVERY_STORAGE_KEY&&recoveryFailures>0){recoveryFailures--;throw new Error('disk full');}
    if(k===barrierKey(a)&&(barrierFail||(completeFail&&JSON.parse(v).pending===false)))throw new Error('barrier publication failed');
    values.set(k,v);
  },removeItem:(k:string)=>{if(removeFail&&k===Restore.wholeAppRestoreIntentKey(a))throw new Error('intent removal failed');values.delete(k);}};
  const recovery=createOwnerRecoveryStore({storage,currentOwnerUid:()=>sdk});
  for(const owner of [a,b]){sdk=owner;recovery.activate(owner).save({...createDefaultRecoveryState(),completedChallenges:owner===a?11:22});}sdk=a;recovery.activate(a);
  const files=new Map<string,Set<string>>(),readers=new Map<string,()=>readonly string[]>(),calls:string[]=[];
  const media={bindOwnerReferences:(owner:string,reader:()=>readonly string[])=>{readers.set(owner,reader);},cancelOwner:async(owner:string)=>{calls.push(`cancel:${owner}`);return {cleanupPending:false};},reconcile:async(owner:string,reader:()=>readonly string[])=>{calls.push(`reconcile:${owner}`);for(const file of files.get(owner)??[])if(!reader().includes(file))files.get(owner)!.delete(file);},adoptPhoto:()=>{},removePhoto:async()=>{},importBase64:async()=>({status:'added',photo:{id:'newphoto',fileName:'photo-newphoto.jpg',thumbnailFileName:'thumb-newphoto.jpg',width:100,height:100,bytes:4,mime:'image/jpeg'},limited:false})} as unknown as JournalMediaStore;
  const repositories=new Map<string,ReturnType<typeof createJournalRepository>>();
  for(const owner of [a,b]){const repo=createJournalRepository({storage,ownerId:owner,now:()=>time,newId:()=>`draft_${owner}`});repositories.set(owner,repo);const d=repo.newDraft('2026-10-07');const photo:JournalPhoto={id:`p_${owner}`,fileName:`photo-p_${owner}.jpg`,thumbnailFileName:`thumb-p_${owner}.jpg`,width:100,height:100,bytes:4,mime:'image/jpeg'};repo.saveDraft({...d,text:owner===a?'private data expected erased':'other owner private data',photos:[photo]});repo.saveEntry(d.id);files.set(owner,new Set([photo.fileName,photo.thumbnailFileName]));media.bindOwnerReferences(owner,()=>repo.referencedFileNames());storage.setItem(`freed.private.owner.${owner}.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`,`private scratch ${owner}`);}
  const archive:DecodedJournalArchive={version:2,exportedAt:time,recoveryState:{...createDefaultRecoveryState(),completedChallenges:99},entries:[],photos:[],processedSources:[],deletedLegacySources:[]};
  saveAccountDeletionReceipt(storage,{version:1,ownerUid:a,eventId:'delete_original',requestedAt:time,cloud:'completed',local:'pending'});
  const noop=()=>{};const deps:any={React:{useCallback:(v:any)=>v},trustedPrivateOwner,getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:Boolean(sdk),anonymous:false,ownerUid:sdk,email:null}),getFirebaseAccountScope:()=>sdk,accountOperationGate:{current:createAccountOperationGate(()=>sdk)},afterConfirmedCleanup,appConfigQueue:{current:null},setAppConfigSyncBusy:noop,Platform:{OS:'android'},resetProtectionConfiguration:async()=>({protectionConfigurationResetAccepted:true}),setProtectionStatus:noop,cancelAutomaticBackupSync:noop,disableAutomaticBackup:async()=>{},ownerStore:recovery,purgeJournalOwner,createJournalRepository,journalMedia:media,RECOVERY_DRAFT_STORAGE_KEYS,RECOVERY_TOOL_SESSION_STORAGE_KEYS,EARNED_TIME_REFERENCE_PREFIX,clearCompanionPresentationHistory:noop,discardChallengeSession:()=>true,challengeSession:{abandon:noop,getSnapshot:noop},setRemoteRetentionPlan:noop,setPendingFirebaseEmailLink:noop,setPendingRecoveryRestore:noop,pendingJournalRestore:{current:null},pendingInterventionTracker:{current:null},createPendingInterventionTracker:()=>({}),consumedDeepLinkIntervention:{current:null},setActiveAttempt:noop,setSelectedChallenge:noop,setProtectionSyncMessage:noop,lastCueState:{current:null},setCompanionCue:noop,resumeOwner:noop,journalChanged:noop,persistRecoveryState:noop,setProtectionIntentState:noop,setTab:noop,setScreen:noop,privateCleanupOwner:{current:null},setAccountCleanupReceiptCache:noop,privateLockedRef:{current:false},setPrivateViewLocked:noop,suspendOwner:noop,signOutFirebaseAccount:async()=>{sdk=null;},loadAccountDeletionReceipt,
    beginOwnerRestoreDeletion:(Restore as any).beginOwnerRestoreDeletion,completeOwnerRestoreDeletion:(Restore as any).completeOwnerRestoreDeletion};
  Object.assign(deps,task86CleanupDependencies());
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
  const actual=(kind:'local'|'account')=>{const source=readFileSync('src/features/freed-app.tsx','utf8'),name=kind==='local'?'deleteLocalRecoveryData':'cleanupDeletedOwner',start=source.indexOf(`  const ${name} =`),end=source.indexOf(kind==='local'?'  const cleanupDeletedOwner =':'  const deleteFirebaseAccountAndData =',start);return new Function(...Object.keys(deps),transpileModule(source.slice(start,end)+`;return ${name};`,{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)(...Object.values(deps));};
  const pending=async(owner=a)=>{recoveryFailures=2;await assert.rejects(Restore.restoreWholeAppArchive({archive,storage,recovery,repository:repositories.get(owner)!,media:null,isCurrentOwner:()=>true}),/rollback is pending/);recoveryFailures=0;assert.ok(storage.getItem(Restore.wholeAppRestoreIntentKey(owner)));};
  return {values,storage,recovery,media,files,readers,calls,archive,repositories,deps,actual,pending,sdk:(v:string|null)=>{sdk=v;},failRemove:(v:boolean)=>{removeFail=v;},failBarrier:(v:boolean)=>{barrierFail=v;},failComplete:(v:boolean)=>{completeFail=v;}};
}
test('review I1 actual account cleanup erases a failed-rollback intent and cold hydration cannot recreate the deleted owner',async()=>{
  const f=fixture();await f.pending();const bIntent=JSON.stringify({version:1,ownerId:b,recovery:f.recovery.readOwner(b),journal:f.repositories.get(b)!.exportLocalSnapshot()});f.storage.setItem(Restore.wholeAppRestoreIntentKey(b),bIntent);f.sdk(null);
  await f.actual('account')(a);
  assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)),null);assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);
  assert.equal(createJournalRepository({storage:f.storage,ownerId:a}).list().length,0);assert.equal(f.recovery.readOwner(a).completedChallenges,0);assert.equal(f.files.get(a)!.size,0);
  assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(b)),bIntent);assert.equal(f.repositories.get(b)!.list()[0].text,'other owner private data');assert.equal(f.recovery.readOwner(b).completedChallenges,22);assert.equal(f.files.get(b)!.size,2);assert.equal(f.storage.getItem(`freed.private.owner.${b}.${RECOVERY_DRAFT_STORAGE_KEYS.journal}`),`private scratch ${b}`);
});
test('actual local deletion preserves adult protection and invalidates restore replay even when native cleanup is unavailable',async()=>{
  const f=fixture();await f.pending();let reset=0;f.deps.resetProtectionConfiguration=async()=>{reset++;throw Error('full reset forbidden');};
  await f.actual('local')();assert.equal(reset,0);assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)),null);assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);assert.equal(f.recovery.readOwner(a).completedChallenges,0);assert.equal(f.files.get(a)!.size,0);assert.equal(f.files.get(b)!.size,2);
});
test('intent removal failure leaves a durable replay barrier and failed receipt; confirmed retry removes the private snapshot without resending',async()=>{
  const f=fixture();await f.pending();f.sdk(null);f.failRemove(true);let requests=0;
  await assert.rejects(executeAccountDeletion({storage:f.storage,ownerUid:a,eventId:'new_ignored',request:async()=>{requests++;throw new Error('must not resend');},cleanup:f.actual('account')}),/removal failed/);
  assert.equal(loadAccountDeletionReceipt(f.storage,a)?.local,'failed');assert.throws(()=>Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),/cleanup.*pending/i);assert.equal(f.recovery.readOwner(a).completedChallenges,11);
  await assert.rejects(Restore.restoreWholeAppArchive({archive:f.archive,storage:f.storage,recovery:f.recovery,repository:f.repositories.get(a)!,media:null,isCurrentOwner:()=>true}),/cleanup.*pending/i);
  f.failRemove(false);await executeAccountDeletion({storage:f.storage,ownerUid:a,eventId:'new_ignored',request:async()=>{requests++;throw new Error('must not resend');},cleanup:f.actual('account')});assert.equal(requests,0);assert.equal(loadAccountDeletionReceipt(f.storage,a)?.local,'completed');assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);
});
test('failure to publish invalidation cannot erase history, and failure to finish it remains retryable with no cold replay',async()=>{
  const f=fixture();await f.pending();f.sdk(null);const before=f.storage.getItem(Restore.wholeAppRestoreIntentKey(a));f.failBarrier(true);
  await assert.rejects(f.actual('account')(a),/publication failed/);assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)),before);assert.equal(f.recovery.readOwner(a).completedChallenges,11);assert.equal(f.files.get(a)!.size,2);
  f.failBarrier(false);f.failComplete(true);await assert.rejects(f.actual('account')(a),/publication failed/);assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)),null);assert.throws(()=>Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),/cleanup.*pending/i);
  f.failComplete(false);await f.actual('account')(a);assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);assert.equal(f.recovery.readOwner(b).completedChallenges,22);
});
test('late in-flight restore rollback and retained reference readers cannot republish after local deletion, even with the same SDK owner',async()=>{
  const f=fixture();let release!:()=>void,entered!:()=>void,held:()=>readonly string[]=()=>[];const enteredPromise=new Promise<void>(r=>{entered=r;}),pause=new Promise<void>(r=>{release=r;});let first=true;const reconcile=f.media.reconcile;
  f.media.reconcile=async(owner,reader)=>{if(owner===a&&first){first=false;held=reader as ()=>readonly string[];entered();await pause;}return reconcile(owner,reader);};
  const restore=Restore.restoreWholeAppArchive({archive:f.archive,storage:f.storage,recovery:f.recovery,repository:f.repositories.get(a)!,media:f.media,isCurrentOwner:()=>true});const rejected=assert.rejects(restore);
  await enteredPromise;assert.ok(held().length>0);await f.actual('local')();assert.deepEqual(held(),[]);release();await rejected;
  assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);assert.equal(createJournalRepository({storage:f.storage,ownerId:a}).list().length,0);assert.equal(f.recovery.readOwner(a).completedChallenges,0);assert.equal(f.files.get(a)!.size,0);assert.equal(f.files.get(b)!.size,2);
});
test('unconfirmed processing account deletion cannot invalidate or purge a private restore intent',async()=>{
  const f=fixture();await f.pending();saveAccountDeletionReceipt(f.storage,{version:1,ownerUid:a,eventId:'unconfirmed',requestedAt:time,cloud:'processing',local:'pending'});const before=f.storage.getItem(Restore.wholeAppRestoreIntentKey(a));
  const receipt=await executeAccountDeletion({storage:f.storage,ownerUid:a,eventId:'ignored',request:async()=>({ok:true,status:'processing'}),cleanup:f.actual('account')});
  assert.equal(receipt.cloud,'processing');assert.equal(receipt.local,'pending');assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)),before);assert.equal(f.files.get(a)!.size,2);
  await assert.rejects(f.actual('account')(a),/must be confirmed/);assert.equal(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)),before);assert.equal(f.storage.getItem(barrierKey(a)),null);
});
test('completed deletion epoch discards an old cold-replayed intent while allowing a genuinely new restore and another owner rollback',async()=>{
  const f=fixture();await f.pending();const old=f.storage.getItem(Restore.wholeAppRestoreIntentKey(a))!;
  const bIntent=JSON.stringify({version:1,ownerId:b,recovery:f.recovery.readOwner(b),journal:f.repositories.get(b)!.exportLocalSnapshot()});f.storage.setItem(Restore.wholeAppRestoreIntentKey(b),bIntent);
  await f.actual('local')();f.storage.setItem(Restore.wholeAppRestoreIntentKey(a),old);
  assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);assert.equal(f.recovery.readOwner(a).completedChallenges,0);assert.equal(createJournalRepository({storage:f.storage,ownerId:a}).list().length,0);
  assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,b,f.recovery),true);assert.equal(f.recovery.readOwner(b).completedChallenges,22);assert.equal(f.repositories.get(b)!.list()[0].text,'other owner private data');assert.equal(f.files.get(b)!.size,2);
  const fresh=createJournalRepository({storage:f.storage,ownerId:a});await Restore.restoreWholeAppArchive({archive:f.archive,storage:f.storage,recovery:f.recovery,repository:fresh,media:null,isCurrentOwner:()=>true});assert.equal(f.recovery.readOwner(a).completedChallenges,99);
});
test('photo cleanup failure cannot complete the receipt or re-enable retained-reference authority; retry removes only that owner files',async()=>{
  const f=fixture();await f.pending();f.sdk(null);const original=f.media.reconcile;let failed=true;
  f.media.reconcile=async(owner,reader)=>{if(owner===a&&failed)throw new Error('private photo deletion failed');return original(owner,reader);};
  await assert.rejects(executeAccountDeletion({storage:f.storage,ownerUid:a,eventId:'ignored',request:async()=>{throw new Error('must not resend');},cleanup:f.actual('account')}),/photo deletion failed/);
  assert.equal(loadAccountDeletionReceipt(f.storage,a)?.local,'failed');assert.deepEqual(f.readers.get(a)!(),[]);assert.throws(()=>Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),/cleanup.*pending/i);assert.equal(f.files.get(a)!.size,2);assert.equal(f.files.get(b)!.size,2);
  failed=false;await executeAccountDeletion({storage:f.storage,ownerUid:a,eventId:'ignored',request:async()=>{throw new Error('must not resend');},cleanup:f.actual('account')});assert.equal(f.files.get(a)!.size,0);assert.equal(f.files.get(b)!.size,2);assert.equal(loadAccountDeletionReceipt(f.storage,a)?.local,'completed');
});
test('late restore cannot commit or roll back through an invalidated intent even when its removal failed and SDK owner remains unchanged',async()=>{
  const f=fixture();let release!:()=>void,entered!:()=>void;const enteredPromise=new Promise<void>(r=>{entered=r;}),pause=new Promise<void>(r=>{release=r;});const original=f.media.reconcile;let first=true;
  f.media.reconcile=async(owner,reader)=>{if(owner===a&&first){first=false;entered();await pause;}return original(owner,reader);};
  const restored=Restore.restoreWholeAppArchive({archive:f.archive,storage:f.storage,recovery:f.recovery,repository:f.repositories.get(a)!,media:f.media,isCurrentOwner:()=>true});const rejected=assert.rejects(restored);
  await enteredPromise;f.failRemove(true);await assert.rejects(f.actual('local')(),/intent removal failed/);assert.ok(f.storage.getItem(Restore.wholeAppRestoreIntentKey(a)));
  release();await rejected;assert.equal(f.recovery.readOwner(a).completedChallenges,11);assert.throws(()=>Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),/cleanup.*pending/i);assert.equal(f.recovery.readOwner(b).completedChallenges,22);assert.equal(f.files.get(b)!.size,2);
  f.failRemove(false);await f.actual('local')();assert.equal(f.recovery.readOwner(a).completedChallenges,0);assert.equal(Restore.recoverInterruptedWholeAppRestore(f.storage,a,f.recovery),false);
});
