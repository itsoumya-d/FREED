import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEncryptedJournalArchive, restoreJournalOrRecoveryBackup, importJournalArchive, buildJournalTextBackup, JOURNAL_ARCHIVE_MAX_BYTES } from '../src/lib/journal-archive';
import { createJournalRepository, type JournalEntry } from '../src/lib/journal-repository';
import { createDefaultRecoveryState } from '../src/lib/recovery-state';
import { recordDailyCheckIn } from '../src/lib/recovery-state';
import { createEncryptedRecoveryBackup } from '../src/lib/recovery-backup';
import type { JournalMediaStore } from '../src/lib/journal-media';

const now = '2026-10-07T12:00:00.000Z', passphrase = 'correct horse journal archive';
const bytes = 1600000;
const photo = { id: 'p1', fileName: 'photo-p1.jpg', thumbnailFileName: 'thumb-p1.jpg', width: 1600, height: 1200, bytes, mime: 'image/jpeg' as const };
const entry: JournalEntry = { id: 'entry1', ownerId: 'alice', revision: 2, dateKey: '2026-10-07', title: '私の記録', text: 'Exact\n😀', photos: [photo], createdAt: now, updatedAt: now, savedDraftId: 'draft1' };
const jpeg = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(bytes - 6, 1), Buffer.from([255, 217])]).toString('base64');
const sourceMedia = { readPhoto: async () => jpeg } as unknown as JournalMediaStore;
async function archive() { return createEncryptedJournalArchive({ processedSources: [], deletedLegacySources: [], recoveryState: createDefaultRecoveryState(), entries: [entry], ownerId: 'alice', media: sourceMedia, passphrase, exportedAt: now }); }
test('manual v2 archive includes every photo beyond old 2MiB payload; automatic projection explicitly contains text only', async () => {
  const serialized = await archive(); const envelope = JSON.parse(serialized);
  assert.equal(envelope.version, 2); assert.ok(envelope.chunks.length > 1); assert.ok(Buffer.byteLength(serialized) > 2 * 1024 * 1024);
  assert.ok(!serialized.includes('Exact')); assert.ok(!serialized.includes('alice')); assert.ok(!serialized.includes('photo-p1.jpg'));
  const restored = await restoreJournalOrRecoveryBackup(serialized, passphrase);
  assert.equal(restored.version, 2); assert.equal(restored.entries[0].text, entry.text); assert.equal(restored.photos[0].base64, jpeg);
  const text = buildJournalTextBackup('alice', [entry]); assert.equal(text.photoPolicy, 'excluded');
  assert.equal(text.entries[0].text, entry.text); assert.ok(!JSON.stringify(text).includes('photo-p1')); assert.ok(!JSON.stringify(text).includes(jpeg.slice(0, 100)));
});
test('old encrypted recovery v1 restore stays supported and does not invent journal photos', async () => {
  const old = await createEncryptedRecoveryBackup(createDefaultRecoveryState(), passphrase, now);
  const restored = await restoreJournalOrRecoveryBackup(old, passphrase); assert.equal(restored.version, 1); assert.deepEqual(restored.entries, []); assert.deepEqual(restored.photos, []);
});
test('wrong passphrase, tampering, reordered/duplicate chunks and oversize input reject before any restore writes', async () => {
  const serialized = await archive(); await assert.rejects(restoreJournalOrRecoveryBackup(serialized, 'wrong passphrase'), /decrypt/);
  const reordered = JSON.parse(serialized); [reordered.chunks[0], reordered.chunks[1]] = [reordered.chunks[1], reordered.chunks[0]];
  await assert.rejects(restoreJournalOrRecoveryBackup(JSON.stringify(reordered), passphrase), /invalid/);
  const duplicate = JSON.parse(serialized); duplicate.chunks[1] = { ...duplicate.chunks[0], index: 1 }; await assert.rejects(restoreJournalOrRecoveryBackup(JSON.stringify(duplicate), passphrase), /invalid/);
  const corrupt = JSON.parse(serialized); corrupt.chunks[0].payload = `${corrupt.chunks[0].payload[0] === 'A' ? 'B' : 'A'}${corrupt.chunks[0].payload.slice(1)}`;
  await assert.rejects(restoreJournalOrRecoveryBackup(JSON.stringify(corrupt), passphrase), /decrypt/);
  await assert.rejects(restoreJournalOrRecoveryBackup(' '.repeat(JOURNAL_ARCHIVE_MAX_BYTES + 1), passphrase), /limit/);
});
test('missing photo bytes and cross-owner snapshots fail export instead of silently omitting media', async () => {
  await assert.rejects(createEncryptedJournalArchive({ processedSources: [], deletedLegacySources: [], recoveryState: createDefaultRecoveryState(), entries: [entry], ownerId: 'bob', media: sourceMedia, passphrase }), /owner/);
  await assert.rejects(createEncryptedJournalArchive({ processedSources: [], deletedLegacySources: [], recoveryState: createDefaultRecoveryState(), entries: [entry], ownerId: 'alice', media: { readPhoto: async () => { throw new Error('missing photo'); } } as unknown as JournalMediaStore, passphrase }), /missing photo/);
});
test('omitted and cross-archive replayed chunks, traversal and impossible archive size reject', async () => {
  const a = JSON.parse(await archive()), b = JSON.parse(await archive()); a.chunks[1] = b.chunks[1];
  await assert.rejects(restoreJournalOrRecoveryBackup(JSON.stringify(a), passphrase), /decrypt/);
  const omitted = JSON.parse(await archive()); omitted.chunks.pop(); await assert.rejects(restoreJournalOrRecoveryBackup(JSON.stringify(omitted), passphrase), /invalid/);
  let reads = 0; const many = Array.from({ length: 4 }, (_, i) => ({ ...entry, id: `entry_${i}`, photos: Array.from({ length: 6 }, (_, j) => ({ ...photo, id: `p_${i}_${j}`, fileName: `photo-p_${i}_${j}.jpg`, thumbnailFileName: `thumb-p_${i}_${j}.jpg`, bytes: 2 * 1024 * 1024 })) }));
  await assert.rejects(createEncryptedJournalArchive({ processedSources: [], deletedLegacySources: [], recoveryState: createDefaultRecoveryState(), ownerId: 'alice', entries: many, media: { readPhoto: async () => { reads++; return ''; } } as unknown as JournalMediaStore, passphrase }), /limit/); assert.equal(reads, 0);
  const invalid = await restoreJournalOrRecoveryBackup(await archive(), passphrase); invalid.photos[0].fileName = '../bob/photo.jpg';
  const repository = createJournalRepository({ ownerId: 'bob', storage: { getItem: () => null, setItem: () => { throw new Error('must not write'); }, removeItem: () => {} } });
  await assert.rejects(importJournalArchive(invalid, repository, null, () => true), /invalid/);
});
test('partial restore and storage failure roll back staged photos; owner switch cannot commit', async () => {
  const restored = await restoreJournalOrRecoveryBackup(await archive(), passphrase);
  const values = new Map<string, string>(); let fail = false; let active = true; const removed: string[] = [];
  const repo = createJournalRepository({ ownerId: 'bob', storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => { if (fail) throw new Error('disk full'); values.set(k, v); }, removeItem: k => values.delete(k) } });
  const media = { bindOwnerReferences: () => {}, importBase64: async () => ({ status: 'added', limited: false, photo: { ...photo, id: 'restoredp', fileName: 'photo-restoredp.jpg', thumbnailFileName: 'thumb-restoredp.jpg' } }), removePhoto: async (_owner: string, p: typeof photo) => { removed.push(p.id); }, adoptPhoto: () => {}, reconcile: async () => {} } as unknown as JournalMediaStore;
  fail = true; await assert.rejects(importJournalArchive(restored, repo, media, () => active), /storage/); assert.deepEqual(removed, ['restoredp']); assert.equal(repo.list().length, 0);
  fail = false; media.importBase64 = async () => { active = false; return { status: 'added', limited: false, photo: { ...photo, id: 'restoredp', fileName: 'photo-restoredp.jpg', thumbnailFileName: 'thumb-restoredp.jpg' } }; };
  await assert.rejects(importJournalArchive(restored, repo, media, () => active), /owner/); assert.equal(repo.list().length, 0);
  active = true; media.importBase64 = async () => ({ status: 'added', limited: false, photo: { ...photo, id: 'restoredp', fileName: 'photo-restoredp.jpg', thumbnailFileName: 'thumb-restoredp.jpg' } });
  const result = await importJournalArchive(restored, repo, media, () => active); assert.equal(result.cleanupPending, false); assert.equal(repo.list()[0].ownerId, 'bob'); assert.equal(repo.list()[0].photos[0].id, 'restoredp');
});
test('authenticated archive transfers processed and deleted legacy sources without duplicate migration or resurrection', async () => {
  const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const recovery = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, sleepQuality: 3, reflection: 'Legacy exact\n私の言葉' }, now); const before = JSON.stringify(recovery);
  const source = createJournalRepository({ ownerId: 'archive-source', storage }); source.migrateLegacy(recovery.dailyCheckIns); const legacy = source.list()[0], processedSources = [legacy.legacySourceId!];
  const active = await restoreJournalOrRecoveryBackup(await createEncryptedJournalArchive({ ...source.exportArchiveState(), recoveryState: recovery, ownerId: source.ownerId, media: null, passphrase, exportedAt: now }), passphrase);
  const target = createJournalRepository({ ownerId: 'archive-target', storage }); await importJournalArchive(active, target, null, () => true);
  assert.doesNotThrow(() => target.migrateLegacy(recovery.dailyCheckIns)); assert.equal(target.list().length, 1);
  source.deleteEntry(legacy.id, legacy.revision);
  const deleted = await restoreJournalOrRecoveryBackup(await createEncryptedJournalArchive({ ...source.exportArchiveState(), recoveryState: recovery, ownerId: source.ownerId, media: null, passphrase, exportedAt: now }), passphrase);
  const fresh = createJournalRepository({ ownerId: 'archive-fresh', storage }); await importJournalArchive(deleted, fresh, null, () => true); fresh.migrateLegacy(recovery.dailyCheckIns);
  assert.equal(fresh.list().length, 0); assert.deepEqual(deleted.processedSources, processedSources); assert.deepEqual(deleted.deletedLegacySources, processedSources);
  await importJournalArchive(deleted, target, null, () => true); target.migrateLegacy(recovery.dailyCheckIns); assert.equal(target.list().length, 0);
  assert.equal(JSON.stringify(recovery), before); assert.equal(deleted.recoveryState.dailyCheckIns[0].reflection, recovery.dailyCheckIns[0].reflection);
});
