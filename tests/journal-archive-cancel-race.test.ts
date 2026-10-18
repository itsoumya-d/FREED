import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importJournalArchive, type DecodedJournalArchive } from '../src/lib/journal-archive';
import { createJournalRepository, type JournalPhoto } from '../src/lib/journal-repository';
import { createJournalFileOwnership, createJournalMediaStore, type JournalPhotoIO } from '../src/lib/journal-media';
import { createDefaultRecoveryState, recordDailyCheckIn } from '../src/lib/recovery-state';

const now = '2026-10-07T12:00:00.000Z';
function fixture() {
  const values = new Map<string, string>(), files = new Map<string, number>(); let id = 0; let active = true;
  const repository = createJournalRepository({ ownerId: 'mixed-owner', storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } } });
  const recovery = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, reflection: 'Deleted legacy source remains' }, now);
  repository.migrateLegacy(recovery.dailyCheckIns); const legacy = repository.list()[0]; repository.deleteEntry(legacy.id, legacy.revision);
  const photo = (key: string): JournalPhoto => ({ id: key, fileName: `photo-${key}.jpg`, thumbnailFileName: `thumb-${key}.jpg`, width: 400, height: 300, bytes: 4, mime: 'image/jpeg' });
  const skipped = photo('skip'), kept = photo('keep');
  const decoded: DecodedJournalArchive = { version: 2, exportedAt: now, recoveryState: recovery, processedSources: [legacy.legacySourceId!], deletedLegacySources: [],
    entries: [{ ...legacy, ownerId: undefined, photos: [skipped] }, { id: 'kept-entry', revision: 1, dateKey: '2026-10-07', title: '', text: '', photos: [kept], createdAt: now, updatedAt: now, savedDraftId: 'kept-draft' }].map(({ ownerId: _owner, ...entry }) => entry),
    photos: [{ ...skipped, base64: '/9j/2Q==' }, { ...kept, base64: '/9j/2Q==' }] };
  const io: JournalPhotoIO = { pick: async () => ({ status: 'cancelled' }),
    reencode: async (_asset, edge) => { const uri = `cache/encoded-${++id}`; files.set(uri, 4); return { uri, width: edge === 320 ? 320 : 400, height: edge === 320 ? 240 : 300, metadataStripped: true }; },
    managedUri: (owner, name) => `private/${owner}/${name}`, exists: async path => files.has(path), size: async path => { const value = files.get(path); if (value === undefined) throw new Error('missing'); return value; },
    copy: async (from, to) => { files.set(to, files.get(from)!); }, remove: async path => { files.delete(path); }, removeTemporary: async path => { files.delete(path); },
    list: async owner => [...files.keys()].filter(path => path.startsWith(`private/${owner}/`)).map(path => path.slice(`private/${owner}/`.length)), readBase64: async () => '/9j/2Q==',
    writeTemporaryBase64: async () => { const path = `cache/restored-${++id}`; files.set(path, 4); return path; } };
  const ownership = createJournalFileOwnership(), importer = createJournalMediaStore({ io, ownership, newId: () => `imported_${++id}` }), cancelling = createJournalMediaStore({ io, ownership });
  return { repository, decoded, io, files, importer, cancelling, current: () => active, cancelFence: () => { active = false; } };
}
test('skipped-first/kept-second archive protects every committed photo before held cleanup yields to shared cancellation', async () => {
  const f = fixture(); let release!: () => void, started!: () => void, held = false;
  const waiting = new Promise<void>(resolve => { release = resolve; }), cleanupStarted = new Promise<void>(resolve => { started = resolve; }); const remove = f.io.remove;
  f.io.remove = async path => { if (!held && path.includes('/photo-')) { held = true; started(); await waiting; } await remove(path); };
  const importing = importJournalArchive(f.decoded, f.repository, f.importer, f.current); await cleanupStarted;
  assert.equal(f.repository.list().length, 1); assert.equal(f.files.size, 4); const references = f.repository.referencedFileNames(); assert.equal(references.length, 2);
  f.cancelFence(); await f.cancelling.cancelOwner(f.repository.ownerId);
  for (const name of references) assert.ok(f.files.has(f.importer.uri(f.repository.ownerId, name)), 'cancellation must retain the durably committed photo and thumbnail');
  release(); const result = await importing;
  assert.equal(result.importedEntries, 1); assert.equal(result.skippedDeletedEntries, 1); assert.equal(result.cleanupPending, false); assert.equal(f.files.size, 2);
  assert.equal(await f.importer.readPhoto(f.repository.ownerId, f.repository.list()[0].photos[0]), '/9j/2Q==');
});
test('shared cancellation preserves durable references even when adoption failed, and unknown reads fail closed', async () => {
  const f = fixture(); const result = await f.importer.importBase64(f.repository.ownerId, '/9j/2Q==', { width: 400, height: 300 }, () => true); if (result.status !== 'added') throw new Error('expected photo');
  const draft = f.repository.newDraft('2026-10-07'); f.repository.saveDraft({ ...draft, photos: [result.photo] }); f.repository.saveEntry(draft.id);
  assert.throws(() => f.importer.adoptPhoto(f.repository.ownerId, { ...result.photo, thumbnailFileName: 'thumb-absent.jpg' }, () => f.repository.referencedFileNames()), /invalid/);
  await f.cancelling.cancelOwner(f.repository.ownerId); assert.equal(f.files.size, 2);
  const unknown = fixture(); const staged = await unknown.importer.importBase64(unknown.repository.ownerId, '/9j/2Q==', { width: 400, height: 300 }, () => true); if (staged.status !== 'added') throw new Error('expected photo');
  assert.throws(() => unknown.importer.adoptPhoto(unknown.repository.ownerId, staged.photo, () => { throw new Error('temporarily unavailable storage'); }), /storage/);
  const cancellation = await unknown.cancelling.cancelOwner(unknown.repository.ownerId); assert.equal(cancellation.cleanupPending, true); assert.equal(unknown.files.size, 2, 'unknown authoritative state cannot authorize deleting a possibly committed file');
  await unknown.cancelling.reconcile(unknown.repository.ownerId, () => []); assert.equal(unknown.files.size, 0, 'a later authoritative empty state can remove preserved unused files');
});
