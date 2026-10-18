import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJournalMediaStore, createJournalFileOwnership, type JournalPhotoIO } from '../src/lib/journal-media';
import { createJournalRepository } from '../src/lib/journal-repository';

function fixture() {
  let serial = 0; let active = true; let failCopy = false; const files = new Map<string, number>(); const removed: string[] = []; const encodes: { edge: number; quality: number }[] = [];
  const io: JournalPhotoIO = {
    pick: async () => ({ status: 'selected', asset: { uri: 'picked-cache', width: 4000, height: 3000 }, limited: true }),
    reencode: async (asset, edge, quality) => { encodes.push({ edge, quality }); const uri = `encoded-${++serial}`; files.set(uri, edge === 320 ? 4000 : quality > .7 ? 3 * 1024 * 1024 : 1200000); return { uri, width: edge, height: Math.round(edge * .75), metadataStripped: true }; },
    size: async uri => { const size = files.get(uri); if (!size) throw new Error('missing'); return size; },
    managedUri: (owner, name) => `private/${owner}/${name}`,
    exists: async uri => files.has(uri),
    copy: async (from, to) => { if (failCopy) throw new Error('disk full'); files.set(to, files.get(from)!); },
    remove: async uri => { removed.push(uri); files.delete(uri); },
    removeTemporary: async uri => { removed.push(uri); files.delete(uri); },
    list: async owner => [...files.keys()].filter(path => path.startsWith(`private/${owner}/`)).map(path => path.split('/').at(-1)!),
    readBase64: async uri => Buffer.alloc(files.get(uri)!, 1).toString('base64'),
    writeTemporaryBase64: async data => { const uri = `restored-${++serial}`; files.set(uri, Buffer.from(data, 'base64').length); return uri; }
  };
  const media = createJournalMediaStore({ io, newId: () => `p_${++serial}` });
  return { io, media, files, removed, encodes, current: () => active, deactivate: () => { active = false; }, failCopy: () => { failCopy = true; } };
}
test('import reencodes, enforces real byte/edge limits, creates private photo and thumbnail, and cleans temps', async () => {
  const f = fixture(); const outcome = await f.media.pickAndImport('alice', 'library', 0, f.current);
  assert.equal(outcome.status, 'added'); if (outcome.status !== 'added') throw new Error('expected photo');
  assert.equal(outcome.limited, true); assert.equal(outcome.photo.bytes, 1200000); assert.equal(outcome.photo.width, 1600);
  assert.deepEqual(f.encodes.map(e => e.edge), [1600, 1600, 320]);
  assert.equal(f.files.size, 2); assert.ok(f.removed.includes('picked-cache'));
  assert.ok([...f.files.keys()].every(key => key.startsWith('private/alice/')));
});
test('capacity, permission denial, cancellation and inaccessible cloud originals retain no private files', async () => {
  const f = fixture(); assert.equal((await f.media.pickAndImport('alice', 'library', 6, f.current)).status, 'limit');
  f.io.pick = async () => ({ status: 'denied' }); assert.equal((await f.media.pickAndImport('alice', 'library', 0, f.current)).status, 'denied');
  f.io.pick = async () => ({ status: 'cancelled' }); assert.equal((await f.media.pickAndImport('alice', 'library', 0, f.current)).status, 'cancelled');
  f.io.pick = async () => { throw new Error('offline original'); }; assert.equal((await f.media.pickAndImport('alice', 'library', 0, f.current)).status, 'unavailable'); assert.equal(f.files.size, 0);
});
test('copy failure and owner switch roll back every partial photo and thumbnail', async () => {
  const f = fixture(); f.failCopy(); assert.equal((await f.media.pickAndImport('alice', 'camera', 0, f.current)).status, 'storage'); assert.equal(f.files.size, 0);
  const g = fixture(); const originalCopy = g.io.copy; g.io.copy = async (from, to) => { await originalCopy(from, to); g.deactivate(); };
  assert.equal((await g.media.pickAndImport('alice', 'library', 0, g.current)).status, 'stale'); assert.equal(g.files.size, 0);
});
test('an encoder without metadata stripping is refused and reconciliation preserves referenced files only', async () => {
  const f = fixture(); const reencode = f.io.reencode; f.io.reencode = async (...args) => ({ ...await reencode(...args), metadataStripped: false });
  assert.equal((await f.media.pickAndImport('alice', 'library', 0, f.current)).status, 'optimization'); assert.equal(f.files.size, 0);
  f.files.set('private/alice/photo-orphan.jpg', 2); f.files.set('private/alice/thumb-orphan.jpg', 2); f.files.set('private/bob/photo-kept.jpg', 2);
  await f.media.reconcile('alice', []); assert.deepEqual([...f.files.keys()], ['private/bob/photo-kept.jpg']);
  await assert.rejects(f.media.removePhoto('alice', { fileName: '../bob/photo-kept.jpg', thumbnailFileName: 'thumb-x.jpg' } as never), /invalid/);
});
test('uncommitted attachments are removed after draft-save failure and deletion can retry failed cleanup', async () => {
  const f = fixture(); const outcome = await f.media.pickAndImport('alice', 'library', 0, f.current); if (outcome.status !== 'added') throw new Error('expected photo');
  await f.media.removePhoto('alice', outcome.photo); assert.equal(f.files.size, 0);
  f.files.set('private/alice/photo-orphan.jpg', 2); f.io.remove = async () => { throw new Error('disk unavailable'); };
  await assert.rejects(f.media.reconcile('alice', []), /cleanup/); assert.equal(f.files.size, 1);
});
test('a generated-name collision never overwrites or cleans up an existing private attachment', async () => {
  const f = fixture(); f.files.set('private/alice/photo-collision.jpg', 77); f.files.set('private/alice/thumb-collision.jpg', 33);
  const media = createJournalMediaStore({ io: f.io, newId: () => 'collision' });
  assert.equal((await media.pickAndImport('alice', 'library', 0, f.current)).status, 'storage');
  assert.equal(f.files.get('private/alice/photo-collision.jpg'), 77); assert.equal(f.files.get('private/alice/thumb-collision.jpg'), 33);
});
test('native permission and camera-capability errors do not masquerade as offline photo originals', async () => {
  const f = fixture(); f.io.pick = async () => { throw Object.assign(new Error('permission boundary'), { code: 'ERR_MISSING_PHOTO_LIBRARY_PERMISSION' }); };
  assert.equal((await f.media.pickAndImport('alice', 'library', 0, f.current)).status, 'denied');
  f.io.pick = async () => { throw Object.assign(new Error('hardware boundary'), { code: 'ERR_NO_CAMERA' }); };
  assert.equal((await f.media.pickAndImport('alice', 'camera', 0, f.current)).status, 'unsupported');
});
test('exact delayed-list race cannot delete a completed import before its durable adoption or rejection', async () => {
  const f = fixture(); let release!: () => void, listed!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { listed = resolve; });
  const list = f.io.list; f.io.list = async owner => { listed(); await waiting; return list(owner); };
  const cleanup = f.media.reconcile('alice', []); await started;
  const outcome = await f.media.pickAndImport('alice', 'library', 0, f.current); assert.equal(outcome.status, 'added'); assert.equal(f.files.size, 2);
  release(); await cleanup; assert.equal(f.files.size, 2, 'staged private files must remain held until their consumer decides');
  if (outcome.status === 'added') await f.media.removePhoto('alice', outcome.photo); assert.equal(f.files.size, 0);
});
test('delayed cleanup revalidates adopted references, then deletion and failed rejection cleanup can retry', async () => {
  const f = fixture(); let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; }); const list = f.io.list;
  f.io.list = async owner => { await waiting; return list(owner); }; const cleanup = f.media.reconcile('alice', []);
  const outcome = await f.media.pickAndImport('alice', 'library', 0, f.current); if (outcome.status !== 'added') throw new Error('expected photo');
  const values = new Map<string, string>(), repository = createJournalRepository({ ownerId: 'alice', storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); } }, newId: () => 'race-draft' });
  const draft = repository.newDraft('2026-10-07'); repository.bufferDraft({ ...draft, photos: [outcome.photo] });
  f.media.adoptPhoto('alice', outcome.photo, () => repository.referencedFileNames()); release(); await cleanup; assert.equal(f.files.size, 2);
  repository.recoverDraftBuffer(); const entry = repository.saveEntry(draft.id); repository.deleteEntry(entry.id, entry.revision); await f.media.reconcile('alice', () => repository.referencedFileNames()); assert.equal(f.files.size, 0);
  const other = await f.media.pickAndImport('alice', 'library', 0, f.current); if (other.status !== 'added') throw new Error('expected second photo');
  const remove = f.io.remove; f.io.remove = async () => { throw new Error('disk failure'); }; await assert.rejects(f.media.removePhoto('alice', other.photo), /cleanup/);
  f.io.remove = remove; await f.media.reconcile('alice', []); assert.equal(f.files.size, 0);
});
test('owner cancellation drains an in-flight private write and removes staged files without deleting another owner', async () => {
  const f = fixture(); f.files.set('private/bob/photo-kept.jpg', 77); let release!: () => void, written!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; }), copied = new Promise<void>(resolve => { written = resolve; }); const copy = f.io.copy;
  f.io.copy = async (from, to) => { await copy(from, to); written(); await wait; };
  const importing = f.media.pickAndImport('alice', 'library', 0, () => true); await copied; const cancelling = f.media.cancelOwner('alice'); release();
  assert.equal((await importing).status, 'stale'); await cancelling; assert.deepEqual([...f.files], [['private/bob/photo-kept.jpg', 77]]);
});
test('separate native-style media instances share staged ownership and refresh references after each deletion await', async () => {
  const f = fixture(), ownership = createJournalFileOwnership(); const importer = createJournalMediaStore({ io: f.io, ownership, newId: () => 'shared' }), cleaner = createJournalMediaStore({ io: f.io, ownership });
  const result = await importer.pickAndImport('alice', 'library', 0, f.current); if (result.status !== 'added') throw new Error('expected photo');
  await cleaner.reconcile('alice', []); assert.equal(f.files.size, 2);
  let keep = [result.photo.fileName, result.photo.thumbnailFileName]; importer.adoptPhoto('alice', result.photo, () => keep);
  await cleaner.reconcile('alice', []); assert.equal(f.files.size, 2);
  keep = []; await cleaner.reconcile('alice', () => keep); assert.equal(f.files.size, 0);
  f.files.set('private/alice/photo-old.jpg', 1); f.files.set('private/alice/photo-live.jpg', 2); f.files.set('private/alice/thumb-live.jpg', 3);
  let release!: () => void, started!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; }), removedFirst = new Promise<void>(resolve => { started = resolve; }); const remove = f.io.remove;
  f.io.remove = async uri => { if (uri.endsWith('photo-old.jpg')) { started(); await waiting; } await remove(uri); };
  const cleanup = cleaner.reconcile('alice', () => keep); await removedFirst; keep = ['photo-live.jpg', 'thumb-live.jpg']; release(); await cleanup;
  assert.deepEqual([...f.files], [['private/alice/photo-live.jpg', 2], ['private/alice/thumb-live.jpg', 3]]);
});
