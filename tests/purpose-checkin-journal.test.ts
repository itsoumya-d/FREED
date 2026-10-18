import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState, hydrateRecoveryState, recordDailyCheckIn, getDailyCheckInForDay, recordDailyHabitCompletion, summarizeCheckIns } from '../src/lib/recovery-state';
import { recordJournalForDate, recordCheckInForDate } from '../src/lib/recovery-day-write';
import { buildRecoveryDaySnapshot } from '../src/lib/recovery-day-snapshot';
import { saveRecoveryDraft, loadRecoveryDraft } from '../src/lib/recovery-drafts';
const at = new Date(2026, 9, 3, 12), key = '2026-10-03';

test('journal-only save creates no mood, urge or sleep answers and is not a completed check-in', () => {
  const state = recordJournalForDate(createDefaultRecoveryState(), 'An honest reflection', key, at);
  const record = getDailyCheckInForDay(state, at)!;
  assert.equal(record.mood, null); assert.equal(record.urgeLevel, null); assert.equal(record.sleepQuality, null);
  assert.equal(record.checkInCompleted, false); assert.equal(record.journalSaved, true);
  const snapshot = buildRecoveryDaySnapshot(state, at, at);
  assert.equal(snapshot.checkInCompleted, false); assert.equal(snapshot.journalSaved, true);
  assert.equal(summarizeCheckIns(state, at).total, 0);
});
test('journal writes preserve explicit answers and unchecking the journal habit preserves the note', () => {
  let state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'stressed', urgeLevel: 5, sleepQuality: 1, reflection: 'Old words' }, at.toISOString());
  state = recordJournalForDate(state, 'New words', key, at);
  state = recordDailyHabitCompletion(state, { key: 'journal', label: 'Journal', completed: false }, at.toISOString());
  const record = state.dailyCheckIns[0];
  assert.equal(record.mood, 'stressed'); assert.equal(record.urgeLevel, 5); assert.equal(record.sleepQuality, 1);
  assert.equal(record.checkInCompleted, true); assert.equal(record.journalSaved, true); assert.equal(record.reflection, 'New words');
});
test('legacy explicit values survive hydration, absent values remain null and historical purpose is inferred', () => {
  const legacy = { id: 'legacy', dateKey: key, mood: 'energized', urgeLevel: 0, sleepQuality: 5, reflection: 'Words', createdAt: at.toISOString(), updatedAt: at.toISOString() };
  const record = hydrateRecoveryState({ ...createDefaultRecoveryState(), dailyCheckIns: [legacy] }).dailyCheckIns[0];
  assert.equal(record.urgeLevel, 0); assert.equal(record.sleepQuality, 5); assert.equal(record.checkInCompleted, true); assert.equal(record.journalSaved, true);
  const journal = hydrateRecoveryState({ ...createDefaultRecoveryState(), dailyCheckIns: [{ ...legacy, mood: null, urgeLevel: null, sleepQuality: null }] }).dailyCheckIns[0];
  assert.equal(journal.mood, null); assert.equal(journal.checkInCompleted, false); assert.equal(journal.journalSaved, true);
});
test('dated writers reject stale midnight forms and check-in cannot imply answers from all-null input', () => {
  const state = createDefaultRecoveryState();
  assert.throws(() => recordJournalForDate(state, 'Words', key, new Date(2026, 9, 4)), /date-changed/);
  assert.throws(() => recordCheckInForDate(state, { mood: null, urgeLevel: null, sleepQuality: null }, key, at), /checkin-unanswered/);
});
test('nullable drafts retain omitted answers through restart without adding defaults', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key:string) => values.get(key) ?? null, setItem:(key:string,value:string) => {values.set(key,value);}, removeItem:(key:string)=>{values.delete(key);} };
  const input = { mood: null, urgeLevel: null, sleepQuality: null, reflection: 'Draft words' };
  saveRecoveryDraft(storage, 'checkin', input, key);
  assert.deepEqual(loadRecoveryDraft(storage, 'checkin', key), input);
});
test('journal draft is dated and local deletion also removes resumable breathing scratch state', () => {
  const values = new Map<string,string>();
  const storage = { getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);} };
  saveRecoveryDraft(storage,'journal',{reflection:'Unfinished words'},key);
  storage.setItem('freed.recovery.breathing-session.v1','private session');
  assert.equal(loadRecoveryDraft(storage,'journal','2026-10-04'),null);
  const { purgeRecoveryDrafts } = require('../src/lib/recovery-drafts');
  purgeRecoveryDrafts(storage);
  assert.equal(values.size,0);
});
test('journal save never upgrades an explicit journal-only purpose to a check-in', () => {
  const stored = hydrateRecoveryState({...createDefaultRecoveryState(),dailyCheckIns:[{id:'explicit-journal',dateKey:key,mood:'steady',urgeLevel:0,sleepQuality:null,reflection:'Words',checkInCompleted:false,journalSaved:true,createdAt:at.toISOString(),updatedAt:at.toISOString()}]});
  const updated = recordJournalForDate(stored,'New words',key,at);
  assert.equal(updated.dailyCheckIns[0].checkInCompleted,false);
});

test('editing an existing earlier journal preserves its day, answers and identity without creating today activity',()=>{
 const yesterday=new Date(2026,9,2,12);
 const original=recordDailyCheckIn(createDefaultRecoveryState(),{mood:'steady',urgeLevel:2,sleepQuality:3,reflection:'Earlier words'},yesterday.toISOString());
 const before=original.dailyCheckIns[0];
 const edited=recordJournalForDate(original,'  Earlier words\n私の追記  ','2026-10-02',at);
 assert.equal(edited.dailyCheckIns.length,1);assert.equal(edited.dailyCheckIns[0].id,before.id);
 assert.equal(edited.dailyCheckIns[0].dateKey,'2026-10-02');assert.equal(edited.dailyCheckIns[0].mood,'steady');assert.equal(edited.dailyCheckIns[0].urgeLevel,2);
 assert.equal(edited.dailyCheckIns[0].reflection,'  Earlier words\n私の追記  ');
 assert.equal(edited.dailyHabits.length,0);assert.equal(getDailyCheckInForDay(edited,at),null);
});
test('future or absent past journal days cannot invent backdated records',()=>{
 for(const dateKey of ['2026-10-04','2026-10-02','2026-02-30'])assert.throws(()=>recordJournalForDate(createDefaultRecoveryState(),'Words',dateKey,at));
});
test('journal save preserves private whitespace and line breaks exactly',()=>{
 const words='  私の言葉\n  My private words  ';
 const saved=recordJournalForDate(createDefaultRecoveryState(),words,key,at);
 assert.equal(saved.dailyCheckIns[0].reflection,words);
});
