import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState, getLocalDateKey, recordDailyHabitCompletion, recordDailyCheckIn, recordDailyPledge, recordBlockingAttempt, recordChallengeCompletion, recordRelapse } from '../src/lib/recovery-state';
import { buildRecoveryDaySnapshot, recoveryDateSelection, resolveRecoveryDateSelection } from '../src/lib/recovery-day-snapshot';
import { practiceDefinitions } from '../src/lib/practice-definitions';
import { createBlockingAttempt, createPanicInterventionAttempt } from '../src/lib/blocking-engine';
import { challengeLibrary } from '../src/lib/recovery-engine';
const date = (day: number, hour = 12) => new Date(2026, 9, day, hour);

test('one snapshot keeps selected-day practices, pledge, check-in, resets, slips and protected counts together', () => {
  const yesterday = date(2), today = date(3);
  let state = { ...createDefaultRecoveryState(), recoveryStartedAt: date(1).toISOString() };
  state = recordDailyHabitCompletion(state, { key: 'journal', label: 'Journal', completed: true }, yesterday.toISOString());
  state = recordDailyHabitCompletion(state, { key: 'exercise', label: 'Exercise', completed: true }, today.toISOString());
  state = recordDailyPledge(state, yesterday);
  state = recordDailyCheckIn(state, { mood: 'steady', urgeLevel: 2, sleepQuality: 4 }, yesterday.toISOString());
  state = recordBlockingAttempt(state, { ...createBlockingAttempt('https://pornhub.com/', 'browser'), detectedAt: yesterday.toISOString() });
  state = recordBlockingAttempt(state, { ...createPanicInterventionAttempt(), detectedAt: yesterday.toISOString() });
  state = recordChallengeCompletion(state, challengeLibrary[0], yesterday.toISOString(), undefined, 'helped');
  const snapshot = buildRecoveryDaySnapshot(state, yesterday, today);
  assert.equal(snapshot.readOnly, true);
  assert.equal(snapshot.practices.length, 6);
  assert.equal(snapshot.practices.find(value => value.key === 'journal')?.done, true);
  assert.equal(snapshot.practices.find(value => value.key === 'exercise')?.done, false);
  assert.equal(snapshot.completedPractices, 1);
  assert.equal(snapshot.pledged, true);
  assert.equal(snapshot.checkIn?.mood, 'steady');
  assert.equal(snapshot.resets, 1);
  assert.equal(snapshot.slips.length, 0);
  assert.equal(snapshot.protectedAttempts, 1);
  assert.equal(snapshot.riskMoments, 2);
  assert.equal(snapshot.streak.days, 1);
  assert.equal(buildRecoveryDaySnapshot(state, today, today).pledged, false);
});
test('retained slips reconstruct historical streaks without using the current persisted streak', () => {
  let state = { ...createDefaultRecoveryState(), streakDays: 31, recoveryStartedAt: date(1).toISOString() };
  state = recordRelapse(state, {}, date(2).toISOString());
  state = recordRelapse({ ...state, streakDays: 7 }, {}, date(5).toISOString());
  assert.equal(buildRecoveryDaySnapshot(state, date(4), date(8)).streak.days, 2);
  assert.equal(buildRecoveryDaySnapshot(state, date(5), date(8)).streak.days, 0);
  assert.equal(buildRecoveryDaySnapshot(state, date(1), date(8)).streak.days, null);
  assert.equal(buildRecoveryDaySnapshot(state, date(1), date(8)).streak.available, false);
  const legacy = { ...createDefaultRecoveryState(), streakDays: 31 };
  assert.equal(buildRecoveryDaySnapshot(legacy, date(2), date(8)).streak.days, null);
  assert.equal(buildRecoveryDaySnapshot(legacy, date(8), date(8)).streak.days, 31);
});
test('archived dated counts survive while undated lifetime reset totals never become day history', () => {
  const state = createDefaultRecoveryState();
  const minute = String(Math.floor(date(2).getTime() / 60_000));
  state.activityArchive.attemptMinutes[minute] = { browser: 5, 'manual-check': 2, 'panic-button': 1 };
  state.activityArchive.completionMinutes[minute] = { breathing: { helped: 3 } };
  state.completedChallenges = 99;
  const historical = buildRecoveryDaySnapshot(state, date(2), date(3));
  assert.equal(historical.protectedAttempts, 5);
  assert.equal(historical.riskMoments, 6);
  assert.equal(historical.resets, 3);
  assert.equal(buildRecoveryDaySnapshot(state, date(1), date(3)).resets, 0);
});
test('today selection follows midnight and explicit history stays pinned; future selection clamps to today', () => {
  const yesterday = date(2), today = date(3);
  assert.equal(getLocalDateKey(resolveRecoveryDateSelection(recoveryDateSelection(yesterday, yesterday), today)), getLocalDateKey(today));
  assert.equal(getLocalDateKey(resolveRecoveryDateSelection(recoveryDateSelection(date(1), yesterday), today)), getLocalDateKey(date(1)));
  assert.equal(recoveryDateSelection(date(8), today).mode, 'today');
});
test('six existing practice keys remain self reports with guided destinations kept separate', () => {
  assert.equal(practiceDefinitions.length, 6);
  assert.equal(practiceDefinitions.find(value => value.key === 'journal')?.action, 'journal');
  assert.equal(practiceDefinitions.find(value => value.key === 'exercise')?.action, 'movement');
  assert.equal(practiceDefinitions.find(value => value.key === 'meditation')?.action, 'breathing');
  assert.equal(practiceDefinitions.find(value => value.key === 'adult-content-boundary')?.action, undefined);
});

test('future snapshots never expose dated records or imply a recorded historical streak', () => {
  const today = date(3), future = date(8);
  let state = recordDailyHabitCompletion(createDefaultRecoveryState(), { key: 'journal', label: 'Journal', completed: true }, future.toISOString());
  state = recordDailyPledge(state, future);
  const snapshot = buildRecoveryDaySnapshot(state, future, today);
  assert.equal(snapshot.future, true);
  assert.equal(snapshot.completedPractices, 0);
  assert.equal(snapshot.pledged, false);
  assert.equal(snapshot.hasRecordedActivity, false);
  assert.equal(snapshot.streak.days, null);
});
test('invalid calendar selections resolve to today; invalid snapshot inputs are explicitly rejected', () => {
  const today = date(3);
  assert.equal(recoveryDateSelection(new Date('invalid'), today).mode, 'today');
  assert.equal(getLocalDateKey(resolveRecoveryDateSelection({ mode: 'history', date: new Date('invalid') }, today)), getLocalDateKey(today));
  assert.throws(() => buildRecoveryDaySnapshot(createDefaultRecoveryState(), new Date('invalid'), today), /Invalid recovery date/);
});
