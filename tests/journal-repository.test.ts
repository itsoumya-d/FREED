import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJournalRepository, JournalError } from '../src/lib/journal-repository';
import { createDefaultRecoveryState, recordDailyCheckIn } from '../src/lib/recovery-state';

const now = '2026-10-07T12:00:00.000Z';
function fixture() {
  const values = new Map<string, string>(); let fail = false; let serial = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (fail) throw new Error('disk full'); values.set(key, value); }, removeItem: (key: string) => { if (fail) throw new Error('disk full'); values.delete(key); } };
  const options = { storage, now: () => now, newId: () => `id_${++serial}` };
  return { values, options, fail: (value: boolean) => { fail = value; }, repo: createJournalRepository({ ...options, ownerId: 'alice' }) };
}
test('several dated entries are independent of check-in answers and owner', () => {
  const f = fixture();
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, reflection: 'Legacy exact\n私の言葉' }, now);
  const before = JSON.stringify(state);
  f.repo.migrateLegacy(state.dailyCheckIns);
  for (const text of ['First note', 'Second note']) {
    const draft = f.repo.newDraft('2026-10-07'); f.repo.saveDraft({ ...draft, text }); f.repo.saveEntry(draft.id);
  }
  assert.equal(f.repo.list().length, 3);
  assert.equal(new Set(f.repo.list().map(entry => entry.id)).size, 3);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(createJournalRepository({ ...f.options, ownerId: 'bob' }).list(), []);
  assert.equal(f.repo.list({ query: '私の' }).length, 1);
  assert.equal(f.repo.list({ dateKey: '2026-10-06' }).length, 0);
});
test('migration is deterministic, once-only, and cannot resurrect a deleted legacy note', () => {
  const f = fixture(); const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: null, urgeLevel: null, reflection: 'Exact legacy' }, now);
  f.repo.migrateLegacy(state.dailyCheckIns); const entry = f.repo.list()[0];
  f.repo.migrateLegacy(state.dailyCheckIns); assert.equal(f.repo.list()[0].id, entry.id);
  f.repo.deleteEntry(entry.id, entry.revision); f.repo.migrateLegacy(state.dailyCheckIns);
  assert.equal(f.repo.list().length, 0);
  assert.equal(state.dailyCheckIns[0].reflection, 'Exact legacy');
  assert.equal(state.dailyCheckIns[0].checkInCompleted, false);
});
test('drafts survive return/restart/midnight, and successful Save is idempotent', () => {
  const f = fixture(); let draft = f.repo.newDraft('2026-10-06'); draft = { ...draft, text: 'Unfinished text\n😀' }; f.repo.saveDraft(draft);
  const restarted = createJournalRepository({ ...f.options, ownerId: 'alice' });
  assert.equal(restarted.drafts()[0].text, draft.text); assert.equal(restarted.drafts()[0].dateKey, '2026-10-06');
  const entry = restarted.saveEntry(draft.id); assert.deepEqual(restarted.saveEntry(draft.id), entry);
  assert.equal(restarted.drafts().length, 0); assert.equal(restarted.list().length, 1);
  assert.equal(entry.revision, 1);
});
test('save failure keeps durable draft and revision checks reject stale editors', () => {
  const f = fixture(); const draft = f.repo.newDraft('2026-10-07'); f.repo.saveDraft({ ...draft, text: 'Retained' });
  f.fail(true); assert.throws(() => f.repo.saveEntry(draft.id), /storage/); assert.equal(f.repo.list().length, 0);
  f.fail(false); const entry = f.repo.saveEntry(draft.id); const first = f.repo.editDraft(entry.id); const second = f.repo.editDraft(entry.id);
  f.repo.saveDraft({ ...first, text: 'First revision' }); f.repo.saveEntry(first.id);
  f.repo.saveDraft({ ...second, text: 'Stale revision' }); assert.throws(() => f.repo.saveEntry(second.id), /conflict/);
  assert.equal(f.repo.list()[0].text, 'First revision'); assert.equal(f.repo.drafts()[0].text, 'Stale revision');
});
test('photo-only entries save; empty entries, excessive photos, invalid dates and corrupt storage reject', () => {
  const f = fixture(); const empty = f.repo.newDraft('2026-10-07');
  assert.throws(() => f.repo.saveEntry(empty.id), /empty/);
  const photo = { id: 'p1', fileName: 'photo-p1.jpg', thumbnailFileName: 'thumb-p1.jpg', width: 800, height: 600, bytes: 12, mime: 'image/jpeg' as const };
  f.repo.saveDraft({ ...empty, photos: [photo] }); assert.equal(f.repo.saveEntry(empty.id).photos.length, 1);
  assert.throws(() => f.repo.newDraft('2026-02-31'), /date/);
  const another = f.repo.newDraft('2026-10-07'); assert.throws(() => f.repo.saveDraft({ ...another, photos: Array(7).fill(photo) }), JournalError);
  const key = [...f.values.keys()][0]; f.values.set(key, '{broken');
  assert.throws(() => createJournalRepository({ ...f.options, ownerId: 'alice' }), /corrupt/);
});
test('draft cleanup, entry deletion and owner purge report file candidates only after durable changes', () => {
  const f = fixture(); const photo = { id: 'p1', fileName: 'photo-p1.jpg', thumbnailFileName: 'thumb-p1.jpg', width: 800, height: 600, bytes: 12, mime: 'image/jpeg' as const };
  const d = f.repo.newDraft('2026-10-07'); f.repo.saveDraft({ ...d, photos: [photo] }); const e = f.repo.saveEntry(d.id);
  assert.deepEqual(f.repo.referencedFileNames(), ['photo-p1.jpg', 'thumb-p1.jpg']);
  f.fail(true); assert.throws(() => f.repo.deleteEntry(e.id, e.revision), /storage/); assert.equal(f.repo.list().length, 1);
  f.fail(false); f.repo.deleteEntry(e.id, e.revision); assert.deepEqual(f.repo.referencedFileNames(), []);
  f.repo.purgeOwner(); assert.equal(f.values.size, 0);
});
test('small synchronous scratch survives a crash before debounced envelope write, without resurrecting a saved/discarded draft', () => {
  const f = fixture(); const draft = f.repo.newDraft('2026-10-07'); f.repo.bufferDraft({ ...draft, text: 'Last keystroke' });
  assert.equal(f.repo.drafts()[0].text, ''); const restarted = createJournalRepository({ ...f.options, ownerId: 'alice' });
  restarted.recoverDraftBuffer(); assert.equal(restarted.drafts()[0].text, 'Last keystroke');
  restarted.bufferDraft({ ...restarted.drafts()[0], text: 'Final content' }); restarted.saveDraft({ ...restarted.drafts()[0], text: 'Final content' }); restarted.saveEntry(draft.id);
  restarted.recoverDraftBuffer(); assert.equal(restarted.drafts().length, 0); assert.equal(restarted.list().length, 1);
  const d = restarted.newDraft('2026-10-07'); restarted.bufferDraft({ ...d, text: 'Discard this' }); restarted.discardDraft(d.id); restarted.recoverDraftBuffer(); assert.equal(restarted.drafts().length, 0);
});
test('owner deletion invalidates existing repositories before late drafts can recreate private data', () => {
  const f = fixture(); const draft = f.repo.newDraft('2026-10-07'); f.repo.bufferDraft({ ...draft, text: 'Delete my private data' });
  const stale = createJournalRepository({ ...f.options, ownerId: 'alice' }); f.repo.purgeOwner();
  assert.equal(f.values.size, 0); assert.throws(() => stale.bufferDraft(draft), /owner/); assert.throws(() => f.repo.saveDraft(draft), /owner/); assert.equal(f.values.size, 0);
  assert.deepEqual(createJournalRepository({ ...f.options, ownerId: 'alice' }).list(), []);
});
test('explicitly owner-fenced legacy scratch migrates once as an unfinished draft, preserving its source', () => {
  const f = fixture(); const legacy = { dateKey: '2026-10-06', text: 'Unfinished legacy\n私の記録', sourceId: 'freed.recovery.draft.journal.v1' }; const source = JSON.stringify(legacy);
  f.repo.migrateLegacy([], legacy); f.repo.migrateLegacy([], legacy); assert.equal(f.repo.list().length, 0); assert.equal(f.repo.drafts().length, 1); assert.equal(f.repo.drafts()[0].text, legacy.text); assert.equal(f.repo.drafts()[0].dateKey, legacy.dateKey); assert.equal(JSON.stringify(legacy), source);
});
test('imported matching legacy entries migrate idempotently even when a prior importer omitted source markers', () => {
  const f = fixture(); const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, reflection: 'Preserved source answers' }, now); const before = JSON.stringify(state);
  f.repo.migrateLegacy(state.dailyCheckIns); const imported = f.repo.list()[0];
  const target = createJournalRepository({ ...f.options, ownerId: 'bob' }); target.importEntries([{ ...imported, ownerId: 'bob', revision: 2, text: 'Edited journal copy' }]);
  assert.doesNotThrow(() => target.migrateLegacy(state.dailyCheckIns)); assert.equal(target.list().length, 1); assert.equal(target.list()[0].text, 'Edited journal copy'); assert.equal(target.list()[0].revision, 2); assert.equal(JSON.stringify(state), before);
});
