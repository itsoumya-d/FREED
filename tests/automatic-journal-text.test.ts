import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJournalRepository } from '../src/lib/journal-repository';
import { buildJournalTextBackup, validateJournalTextBackup } from '../src/lib/journal-text-backup';
import { createEncryptedRecoveryBackup, restoreEncryptedRecoveryBackupContent } from '../src/lib/recovery-backup';
import { restoreJournalOrRecoveryBackup, importJournalArchive } from '../src/lib/journal-archive';
import { createDefaultRecoveryState, recordDailyCheckIn } from '../src/lib/recovery-state';
import { createAutomaticBackupController, createAutomaticBackupSecureKeyStore } from '../src/lib/automatic-backup';
const time = '2026-10-07T12:00:00.000Z', passphrase = 'owner encrypted backup';
function store() { const values = new Map<string,string>(); return { getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>{values.set(k,v);}, removeItem:(k:string)=>{values.delete(k);} }; }
test('real encrypted automatic text backup retains processed/deleted markers, exact text and omission disclosure without image paths/bytes or authority', async () => {
  const storage = store(), repo = createJournalRepository({ storage, ownerId:'text-owner' });
  const recovery = recordDailyCheckIn(createDefaultRecoveryState(), { mood:'steady', urgeLevel:1, reflection:'Legacy private text' }, time);
  repo.migrateLegacy(recovery.dailyCheckIns); const migrated = repo.list()[0]; repo.deleteEntry(migrated.id, migrated.revision);
  const d=repo.newDraft('2026-10-07'); repo.saveDraft({...d,text:'Exact\n私の言葉',photos:[{id:'photo1',fileName:'photo-photo1.jpg',thumbnailFileName:'thumb-photo1.jpg',width:100,height:100,bytes:100,mime:'image/jpeg'}]}); repo.saveEntry(d.id);
  const snap=repo.exportArchiveState(), projected=buildJournalTextBackup(repo.ownerId,snap.entries,snap);
  const raw=JSON.stringify(projected); assert.ok(!raw.includes('photo-photo1')); assert.ok(!raw.includes('thumb-')); assert.ok(!raw.includes('ownerId')); assert.ok(!raw.includes('nativeInterventionId'));
  assert.equal(projected.entries[0].omittedPhotoCount,1); assert.deepEqual(projected.deletedLegacySources,snap.deletedLegacySources);
  const encrypted=await createEncryptedRecoveryBackup({...recovery,premium:true,automaticBackupEnabled:true},passphrase,time,projected);
  assert.ok(!encrypted.includes('私の言葉')); const content=await restoreEncryptedRecoveryBackupContent(encrypted,passphrase);
  assert.equal(content.state.premium,false); assert.equal(content.state.automaticBackupEnabled,false); assert.deepEqual(content.journal,projected);
  const archive=await restoreJournalOrRecoveryBackup(encrypted,passphrase), target=createJournalRepository({storage,ownerId:'text-target'});
  await importJournalArchive(archive,target,null,()=>true); target.migrateLegacy(recovery.dailyCheckIns);
  assert.equal(target.list().length,1); assert.equal(target.list()[0].text,'Exact\n私の言葉'); assert.deepEqual(target.list()[0].photos,[]); assert.equal(archive.omittedPhotoCount,1);
  assert.deepEqual(target.exportArchiveState().deletedLegacySources,snap.deletedLegacySources);
  assert.throws(()=>validateJournalTextBackup({...projected,photos:[{base64:'raw'}]})); assert.throws(()=>validateJournalTextBackup({...projected,entries:[{...projected.entries[0],privatePath:'/other-owner/photo.jpg'}]}));
});
test('controller fingerprints and encrypts the text projection, so a new journal entry is not skipped as unchanged recovery', async () => {
  const input:any[]=[];const controller=createAutomaticBackupController({secretStore:{read:async()=>passphrase,write:async()=>{},remove:async()=>{}},getAccountScope:()=> 'a',fingerprint:async value=>value,encrypt:async value=>{input.push(value);return 'encrypted';},upload:async()=>({ok:true,provider:'custom',status:'ok',action:'upload',syncedAt:time}),now:()=>Date.parse(time)});
  await controller.enable(passphrase);const recovery=createDefaultRecoveryState();await controller.sync(recovery,true,{version:1,photoPolicy:'excluded',entries:[],processedSources:[],deletedLegacySources:[]});
  const repo=createJournalRepository({storage:store(),ownerId:'a'}),d=repo.newDraft('2026-10-07');repo.saveDraft({...d,text:'new private note'});repo.saveEntry(d.id);const snap=repo.exportArchiveState();
  await controller.sync(recovery,true,buildJournalTextBackup('a',snap.entries,snap));assert.equal(input.length,2);assert.equal(input[1].journal.entries[0].text,'new private note');
});
test('native secure key adapter uses distinct owner namespaces; deletion removes only captured owner key', async () => {
  const values=new Map<string,string>(),removed:string[]=[];const sdk={WHEN_UNLOCKED_THIS_DEVICE_ONLY:7,isAvailableAsync:async()=>true,getItemAsync:async(k:string)=>values.get(k)??null,setItemAsync:async(k:string,v:string)=>{values.set(k,v);},deleteItemAsync:async(k:string)=>{removed.push(k);values.delete(k);}};
  const a=createAutomaticBackupSecureKeyStore(sdk,'a'),b=createAutomaticBackupSecureKeyStore(sdk,'b');await a.write('a private passphrase');await b.write('b private passphrase');assert.equal(await a.read(),'a private passphrase');assert.equal(await b.read(),'b private passphrase');await a.remove();assert.equal(await a.read(),null);assert.equal(await b.read(),'b private passphrase');assert.equal(removed.length,1);
});
