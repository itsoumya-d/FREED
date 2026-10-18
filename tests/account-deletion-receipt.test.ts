import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeAccountDeletion, loadAccountDeletionReceipt } from '../src/lib/account-deletion-receipt';
const fixture = () => { const values = new Map<string, string>(); return { values, storage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } } }; };
test('lost response stays unknown, never deletes local history, and retries retain the original idempotency event', async () => {
  const f = fixture(); let cleanup = 0; const events: string[] = [];
  await assert.rejects(executeAccountDeletion({ storage: f.storage, ownerUid: 'deletion-a', eventId: 'event_original', request: async event => { events.push(event); throw new Error('lost response'); }, cleanup: async () => { cleanup++; } }), /lost response/);
  assert.equal(cleanup, 0); assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-a')?.cloud, 'unknown');
  await executeAccountDeletion({ storage: f.storage, ownerUid: 'deletion-a', eventId: 'event_new', request: async event => { events.push(event); return { ok: true, status: 'processing' }; }, cleanup: async () => { cleanup++; } });
  assert.deepEqual(events, ['event_original', 'event_original']); assert.equal(cleanup, 0);
  assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-a')?.cloud, 'processing');
});
test('confirmed cloud acknowledgement survives local cleanup failure, cold retry never calls backend again or another owner', async () => {
  const f = fixture(); const cleanups: string[] = []; let requests = 0;
  await assert.rejects(executeAccountDeletion({ storage: f.storage, ownerUid: 'deletion-a', eventId: 'event_a', request: async () => { requests++; return { ok: true, status: 'completed' }; }, cleanup: async owner => { cleanups.push(owner); throw new Error('local disk'); } }), /local disk/);
  assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-a')?.cloud, 'completed'); assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-a')?.local, 'failed');
  await executeAccountDeletion({ storage: f.storage, ownerUid: 'deletion-a', eventId: 'event_b', request: async () => { throw new Error('must not resend'); }, cleanup: async owner => { cleanups.push(owner); } });
  assert.equal(requests, 1); assert.deepEqual(cleanups, ['deletion-a', 'deletion-a']);
  assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-a')?.local, 'completed'); assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-b'), null);
});
test('invalid acknowledgement cannot be promoted to completed or trigger local purge', async () => {
  const f = fixture(); let purged = false;
  await assert.rejects(executeAccountDeletion({ storage: f.storage, ownerUid: 'deletion-a', eventId: 'event_a', request: async () => ({ ok: false, status: 'completed' } as never), cleanup: async () => { purged = true; } }), /not acknowledged/);
  assert.equal(purged, false); assert.equal(loadAccountDeletionReceipt(f.storage, 'deletion-a')?.cloud, 'unknown');
});
