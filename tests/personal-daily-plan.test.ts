import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState, hydrateRecoveryState, recordDailyCheckIn, recordDailyHabitCompletion, recordDailyPledge } from '../src/lib/recovery-state';
import { getPersonalDailyPlan, updatePersonalDailyPlan } from '../src/lib/personal-daily-plan';
import { buildRecoveryDaySnapshot } from '../src/lib/recovery-day-snapshot';
const at = new Date(2026, 9, 3, 12), tomorrow = new Date(2026, 9, 4, 12);
test('today suggests two optional practices without writing a historical default', () => {
  const state = createDefaultRecoveryState();
  assert.deepEqual(getPersonalDailyPlan(state, at, at)?.practiceKeys, ['exercise','meditation']);
  assert.equal(state.personalDailyPlans.length, 0);
  assert.equal(getPersonalDailyPlan(state, new Date(2026, 9, 2), at), null);
});
test('first record pins targets and editing tomorrow never changes yesterday’s targets or denominator', () => {
  let state = recordDailyCheckIn(createDefaultRecoveryState(), { mood:'steady', urgeLevel:0, sleepQuality:null }, at.toISOString());
  const pinned = getPersonalDailyPlan(state, at, at)!;
  assert.equal(pinned.recordedAt, at.toISOString());
  assert.deepEqual(pinned.practiceKeys,['exercise','meditation']);
  state = updatePersonalDailyPlan(state, ['journal'], '2026-10-04', tomorrow);
  assert.deepEqual(getPersonalDailyPlan(state, at, tomorrow)?.practiceKeys, ['exercise','meditation']);
  assert.equal(buildRecoveryDaySnapshot(state, at, tomorrow).plannedTaskCount, 3);
  assert.equal(buildRecoveryDaySnapshot(state, tomorrow, tomorrow).plannedTaskCount, 2);
  assert.deepEqual(hydrateRecoveryState(state).personalDailyPlans, state.personalDailyPlans);
});
test('plan completion uses checkin purpose and only selected practices while preserving all six', () => {
  let state = updatePersonalDailyPlan(createDefaultRecoveryState(), ['journal'], '2026-10-03', at);
  state = recordDailyHabitCompletion(state, {key:'exercise',label:'Exercise',completed:true},at.toISOString());
  let snapshot = buildRecoveryDaySnapshot(state, at, at);
  assert.equal(snapshot.practices.length, 6); assert.equal(snapshot.completedPlannedTasks,0);
  state = recordDailyHabitCompletion(state, {key:'journal',label:'Journal',completed:true},at.toISOString());
  state = recordDailyCheckIn(state, {mood:'steady',urgeLevel:1,sleepQuality:null},at.toISOString());
  snapshot = buildRecoveryDaySnapshot(state, at, at);
  assert.equal(snapshot.plannedTaskCount,2); assert.equal(snapshot.completedPlannedTasks,2);
  assert.deepEqual(snapshot.plannedPractices.map(practice=>practice.key),['journal']);
});
test('plan edits reject past dates, unknown keys and more than two choices; zero choices remains valid', () => {
  const state = createDefaultRecoveryState();
  assert.throws(()=>updatePersonalDailyPlan(state,['journal'],'2026-10-02',at),/date-changed/);
  assert.throws(()=>updatePersonalDailyPlan(state,['journal','exercise','meditation'],'2026-10-03',at),/plan-invalid/);
  assert.throws(()=>updatePersonalDailyPlan(state,['unknown'] as never,'2026-10-03',at),/plan-invalid/);
  const empty = updatePersonalDailyPlan(state,[],'2026-10-03',at);
  assert.equal(buildRecoveryDaySnapshot(empty,at,at).plannedTaskCount,1);
});
test('a standalone pledge pins the plan once and repeated record does not rewrite its creation', () => {
  let state = recordDailyPledge(createDefaultRecoveryState(),at);
  const first = state.personalDailyPlans[0];
  state = recordDailyPledge(state,new Date(at.getTime()+1000));
  assert.deepEqual(state.personalDailyPlans[0],first);
});
