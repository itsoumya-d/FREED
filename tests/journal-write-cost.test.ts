import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJournalRepository } from '../src/lib/journal-repository';

test('typing scratch writes do not read or rewrite a large journal history envelope', () => {
  const ownerId = 'cost-fixture', now = '2026-10-07T12:00:00.000Z'; const values = new Map<string, string>(); let reads = 0; const writes: { key: string; bytes: number }[] = [];
  const repo = createJournalRepository({ ownerId, storage: { getItem: key => { reads++; return values.get(key) ?? null; }, setItem: (key, value) => { values.set(key, value); writes.push({ key, bytes: Buffer.byteLength(value) }); }, removeItem: key => { values.delete(key); } }, newId: () => 'active' });
  const draft = repo.newDraft('2026-10-07');
  const entries = Array.from({ length: 2000 }, (_, i) => ({ id: `e_${i}`, ownerId, revision: 1, dateKey: '2026-10-07', title: '', text: 'x'.repeat(4000), photos: [], createdAt: now, updatedAt: now, savedDraftId: `d_${i}` }));
  repo.importEntries(entries); const beforeReads = reads, beforeWrites = writes.length; const samples: number[] = [];
  for (let i = 0; i < 100; i++) { const start = performance.now(); repo.bufferDraft({ ...draft, text: 'y'.repeat(3900 + i) }); samples.push(performance.now() - start); }
  assert.equal(reads, beforeReads); assert.ok(writes.slice(beforeWrites).every(write => write.key.endsWith('.draft-buffer') && write.bytes < 6000));
  samples.sort((a, b) => a - b); console.log(JSON.stringify({ boundary: 'Node in-memory storage, not native SQLite or frame evidence', entries: entries.length, historyBytes: Buffer.byteLength(values.get(repo.storageKey)!), scratchMaxBytes: Math.max(...writes.slice(beforeWrites).map(write => write.bytes)), scratchWrites: 100, historyReadsDuringTyping: reads - beforeReads, medianMs: samples[50], p95Ms: samples[95] }));
});
