import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJournalBackupFileAdapter, type JournalBackupFileIO } from '../src/lib/journal-backup-files';
import { JOURNAL_ARCHIVE_MAX_BYTES } from '../src/lib/journal-archive';
function fixture() { const calls: string[] = []; const io: JournalBackupFileIO = { pick: async () => ({ canceled: false, uri: 'private://picked' }),
  size: async () => { calls.push('stat'); return 20; }, read: async () => { calls.push('read'); return '{"encrypted":true}'; },
  write: async () => { calls.push('write'); return 'private://export'; }, share: async () => { calls.push('share'); }, remove: async () => { calls.push('remove'); } };
  return { io, calls, adapter: createJournalBackupFileAdapter(io) }; }
test('picker cancellation never reads or writes, oversized metadata/stat reject before text allocation', async () => {
  const f = fixture(); f.io.pick = async () => ({ canceled: true }); assert.equal(await f.adapter.read(() => true), null); assert.deepEqual(f.calls, []);
  f.io.pick = async () => ({ canceled: false, uri: 'picked', size: JOURNAL_ARCHIVE_MAX_BYTES + 1 }); await assert.rejects(f.adapter.read(() => true), /64 MiB/); assert.deepEqual(f.calls, []);
  f.io.pick = async () => ({ canceled: false, uri: 'picked', size: 20 }); f.io.size = async () => { f.calls.push('stat'); return JOURNAL_ARCHIVE_MAX_BYTES + 1; };
  await assert.rejects(f.adapter.read(() => true), /64 MiB/); assert.deepEqual(f.calls, ['stat']);
});
test('real adapter orders stat/read and always removes exported files even when share or owner verification fails', async () => {
  const f = fixture(); assert.equal(await f.adapter.read(() => true), '{"encrypted":true}'); assert.deepEqual(f.calls, ['stat', 'read']); f.calls.length = 0;
  f.io.share = async () => { f.calls.push('share'); throw new Error('permission denied'); };
  await assert.rejects(f.adapter.share('ciphertext', () => true), /permission denied/); assert.deepEqual(f.calls, ['write', 'share', 'remove']); f.calls.length = 0;
  let owner = true; f.io.write = async () => { f.calls.push('write'); owner = false; return 'private://old-owner'; };
  await assert.rejects(f.adapter.share('ciphertext', () => owner), /owner changed/); assert.deepEqual(f.calls, ['write', 'remove']);
});
test('owner switch after file read rejects the private archive; unreadable size and write failure have no false success', async () => {
  const f = fixture(); let current = true; f.io.read = async () => { current = false; return 'ciphertext'; };
  await assert.rejects(f.adapter.read(() => current), /owner changed/);
  f.io.size = async () => 0; await assert.rejects(f.adapter.read(() => true), /readable/);
  f.io.write = async () => { throw new Error('disk'); }; await assert.rejects(f.adapter.share('ciphertext', () => true), /disk/);
  assert.ok(!f.calls.includes('share'));
});
