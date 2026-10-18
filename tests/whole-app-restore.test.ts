import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJournalRepository } from '../src/lib/journal-repository';
import { restoreWholeAppArchive, recoverInterruptedWholeAppRestore, wholeAppRestoreIntentKey } from '../src/lib/whole-app-restore';
import { createOwnerRecoveryStore, OWNER_RECOVERY_STORAGE_KEY } from '../src/lib/owner-recovery-store';
import { createDefaultRecoveryState, recordDailyCheckIn } from '../src/lib/recovery-state';
import type { DecodedJournalArchive } from '../src/lib/journal-archive';
import type { JournalMediaStore } from '../src/lib/journal-media';
const time = '2026-10-07T12:00:00.000Z';
function fixture() {
  const values = new Map<string, string>(); let failures = 0, owner = 'restore-a';
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {
    if (key === OWNER_RECOVERY_STORAGE_KEY && failures-- > 0) throw new Error('disk full'); values.set(key, value);
  }, removeItem: (key: string) => values.delete(key) };
  const recovery = createOwnerRecoveryStore({ storage, currentOwnerUid: () => owner });
  const original = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, reflection: 'original recovery' }, time);
  recovery.activate(owner).save(original);
  let id = 0; const repository = createJournalRepository({ storage, ownerId: owner, now: () => time, newId: () => `draft_${++id}` });
  const d = repository.newDraft('2026-10-07'); repository.saveDraft({ ...d, text: 'original journal' }); repository.saveEntry(d.id);
  const scratch = repository.newDraft('2026-10-06'); repository.bufferDraft({ ...scratch, text: 'unsaved original scratch' });
  const archive: DecodedJournalArchive = { version: 2, exportedAt: time, recoveryState: { ...createDefaultRecoveryState(), completedChallenges: 9 },
    entries: [{ id: 'imported', revision: 1, dateKey: '2026-10-05', title: '', text: 'imported journal', photos: [], createdAt: time, updatedAt: time, savedDraftId: 'imported_draft' }], photos: [], processedSources: [], deletedLegacySources: [] };
  return { storage, values, recovery, repository, archive, original, fail: (count: number) => { failures = count; }, owner: (next: string) => { owner = next; }, current: () => owner === 'restore-a' };
}
test('recovery publication failure rolls journal, scratch and recovery back together, then retry commits both stores', async () => {
  const f = fixture(), before = f.repository.exportLocalSnapshot(); f.fail(1);
  await assert.rejects(restoreWholeAppArchive({ ...f, media: null, isCurrentOwner: f.current }), /disk full/);
  assert.deepEqual(f.repository.exportLocalSnapshot(), before); assert.deepEqual(f.recovery.readOwner('restore-a'), f.original);
  assert.equal(f.storage.getItem(wholeAppRestoreIntentKey('restore-a')), null);
  await restoreWholeAppArchive({ ...f, media: null, isCurrentOwner: f.current });
  assert.equal(f.repository.list().length, 2); assert.equal(f.recovery.readOwner('restore-a').completedChallenges, 9);
  assert.equal(f.repository.exportLocalSnapshot().draftBuffer?.text, 'unsaved original scratch');
});
test('failed rollback persists intent and cold retry restores captured owner without touching the new owner', async () => {
  const f = fixture(), before = f.repository.exportLocalSnapshot(); f.fail(2);
  await assert.rejects(restoreWholeAppArchive({ ...f, media: null, isCurrentOwner: f.current }), /rollback is pending/);
  assert.ok(f.storage.getItem(wholeAppRestoreIntentKey('restore-a')));
  f.owner('restore-b'); f.recovery.activate('restore-b').save({ ...createDefaultRecoveryState(), completedChallenges: 77 });
  assert.equal(recoverInterruptedWholeAppRestore(f.storage, 'restore-a', f.recovery), true);
  assert.deepEqual(f.repository.exportLocalSnapshot(), before); assert.deepEqual(f.recovery.readOwner('restore-a'), f.original);
  assert.equal(f.recovery.readOwner('restore-b').completedChallenges, 77);
});
test('owner changes before a commit reject and no restore data appears under another account', async () => {
  const f = fixture(), before = f.repository.exportLocalSnapshot(); f.owner('restore-b');
  await assert.rejects(restoreWholeAppArchive({ ...f, media: null, isCurrentOwner: f.current }), /owner changed/);
  assert.deepEqual(f.repository.exportLocalSnapshot(), before); assert.equal(f.storage.getItem(wholeAppRestoreIntentKey('restore-a')), null);
});
test('deleted-source import keeps old photo files live until both stores commit; recovery failure restores their real references', async () => {
  const f = fixture(), oldPhoto = { id:'oldphoto',fileName:'photo-oldphoto.jpg',thumbnailFileName:'thumb-oldphoto.jpg',width:100,height:100,bytes:4,mime:'image/jpeg' as const };
  const legacyId='2026-10-06:old-checkin';
  f.repository.importEntries([{ id:'oldlegacy',ownerId:'restore-a',revision:1,dateKey:'2026-10-06',title:'',text:'old private photo note',photos:[oldPhoto],createdAt:time,updatedAt:time,savedDraftId:'oldlegacyscratch',legacySourceId:legacyId }], {processedSources:[legacyId],deletedLegacySources:[]});
  const before=f.repository.exportLocalSnapshot(), files=new Set([oldPhoto.fileName,oldPhoto.thumbnailFileName]); let live:()=>readonly string[]=()=>[]; const observed:string[][]=[];
  const media={bindOwnerReferences:(_owner:string,reader:()=>readonly string[])=>{live=reader;},reconcile:async(_owner:string,reader:()=>readonly string[])=>{observed.push([...reader()]);for(const file of files)if(!reader().includes(file))files.delete(file);},adoptPhoto:()=>{},removePhoto:async()=>{}} as unknown as JournalMediaStore;
  const archive={...f.archive,processedSources:[legacyId],deletedLegacySources:[legacyId]}; f.fail(1);
  await assert.rejects(restoreWholeAppArchive({...f,archive,media,isCurrentOwner:f.current}),/disk full/);
  assert.deepEqual(f.repository.exportLocalSnapshot(),before); assert.ok(files.has(oldPhoto.fileName));assert.ok(files.has(oldPhoto.thumbnailFileName));
  assert.ok(observed.every(refs=>refs.includes(oldPhoto.fileName)));assert.ok(live().includes(oldPhoto.fileName));
});
