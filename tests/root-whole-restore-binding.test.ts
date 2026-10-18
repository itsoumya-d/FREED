import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { createOwnerRecoveryStore, OWNER_RECOVERY_STORAGE_KEY } from '../src/lib/owner-recovery-store';
import { createJournalRepository } from '../src/lib/journal-repository';
import { createDefaultRecoveryState, recordAppSessionStart } from '../src/lib/recovery-state';
import { getJourneyOwner } from '../src/lib/user-journey';
import { createAccountOperationGate } from '../src/lib/account-operation';
import { restoreWholeAppArchive } from '../src/lib/whole-app-restore';
import type { DecodedJournalArchive } from '../src/lib/journal-archive';
function fixture(fail:boolean) {
 const source=readFileSync(process.env.TASK4_CONTROLLER_SOURCE??'src/features/freed-app.tsx','utf8'),start=source.indexOf('  const confirmRecoveryRestore ='),end=source.indexOf('  const deleteLocalRecoveryData =',start);
 const code=transpileModule(source.slice(start,end)+';return confirmRecoveryRestore;',{compilerOptions:{module:ModuleKind.CommonJS}}).outputText;
 const values=new Map<string,string>();let failOnce=false;const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(failOnce&&k===OWNER_RECOVERY_STORAGE_KEY){failOnce=false;throw new Error('disk');}values.set(k,v);},removeItem:(k:string)=>values.delete(k)};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});const owner='root-restore-owner',original={...createDefaultRecoveryState(),completedChallenges:7},ownerStore=createOwnerRecoveryStore({storage,currentOwnerUid:()=>owner});ownerStore.activate(owner).save(original);
 const repository=createJournalRepository({storage,ownerId:owner});const scratch=repository.newDraft('2026-10-07');repository.saveDraft({...scratch,text:'Original scratch'});
 const archive:DecodedJournalArchive={version:2,exportedAt:'2026-10-07T12:00:00.000Z',recoveryState:{...createDefaultRecoveryState(),completedChallenges:9},entries:[{id:'imported_note',revision:1,dateKey:'2026-10-06',title:'',text:'Root actual imported note',photos:[],createdAt:'2026-10-07T12:00:00.000Z',updatedAt:'2026-10-07T12:00:00.000Z',savedDraftId:'imported_draft'}],photos:[],processedSources:[],deletedLegacySources:[]};
 let notice:string|null=null,error:string|null=null;const deps={pendingRecoveryRestore:archive.recoveryState,pendingJournalRestore:{current:{owner,archive}},journalResources:{current:{owner,repository,media:null}},ownerStore,restoringBackupRef:{current:false},privateLockedRef:{current:false},accountOperationGate:{current:createAccountOperationGate(()=>owner)},getJourneyOwner,getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:true,anonymous:false,ownerUid:owner,email:null}),getFirebaseAccountScope:()=>owner,setRestoreNotice:(v:string)=>{error=v;},setRestoringBackup:()=>{},cancelAutomaticBackupSync:()=>{},restoreWholeAppArchive,recordAppSessionStart,resumeOwner:()=>{},journalChanged:()=>{},setPendingRecoveryRestore:()=>{},setAccountNotice:(v:string)=>{notice=v;},persistRecoveryState:(fn:Function)=>ownerStore.activate(owner).save(fn(ownerStore.readOwner(owner))),safeUserFacingMessage:(_e:unknown,fallback:string)=>fallback};
 failOnce=fail;const run=new Function(...Object.keys(deps),code)(...Object.values(deps));return {run,repository,ownerStore,original,notice:()=>notice,error:()=>error};
}
test('actual root restore commits both repository and recovery instead of announcing recovery-only success',async()=>{const f=fixture(false);await f.run();assert.equal(f.repository.list()[0]?.text,'Root actual imported note');assert.equal(f.repository.drafts()[0].text,'Original scratch');assert.equal(f.ownerStore.readOwner('root-restore-owner').completedChallenges,9);assert.ok(f.notice()?.includes('journal restored'));});
test('actual root publication failure retains both histories and reports retry without a half-restore success',async()=>{const f=fixture(true),before=f.repository.exportLocalSnapshot();await f.run();assert.deepEqual(f.repository.exportLocalSnapshot(),before);assert.equal(f.ownerStore.readOwner('root-restore-owner').completedChallenges,7);assert.equal(f.notice(),null);assert.ok(f.error()?.includes('did not complete'));});
