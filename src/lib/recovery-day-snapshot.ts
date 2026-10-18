import {
  calculateStreakDaysFrom, countProtectedAttemptsForDay, countRecoveryRiskMomentsForDay,
  getCurrentRecoveryStreakDays, isCheckInCompleted, hasSavedJournal, getDailyCheckInForDay, getDailyHabitCompletionsForDay,
  getLocalDateKey, getRecoveryChallengeCounts, hasPledgedOnDate,
  type DailyCheckIn, type RelapseRecord, type ChallengeCompletion, type RecoveryState,
} from './recovery-state';
import { getPersonalDailyPlan, type PersonalDailyPlan } from './personal-daily-plan';
import type { ToolCompletionReceipt } from './tool-completion';
import { practiceDefinitions, type PracticeDefinition } from './practice-definitions';

export type RecoveryDateSelection = { mode: 'today' } | { mode: 'history'; date: Date };
const clockDate = (now: Date | number) => {
  const date = new Date(typeof now === 'number' ? now : now.getTime());
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid recovery clock');
  return date;
};
/** Keep the intent to view today distinct from a pinned historical date. */
export function recoveryDateSelection(date: Date, now: Date | number = new Date()): RecoveryDateSelection {
  return !Number.isFinite(date.getTime()) || getLocalDateKey(date) >= getLocalDateKey(clockDate(now))
    ? { mode: 'today' } : { mode: 'history', date: new Date(date) };
}
export function resolveRecoveryDateSelection(selection: RecoveryDateSelection, now: Date | number = new Date()): Date {
  const today = clockDate(now);
  return selection.mode === 'today' || !Number.isFinite(selection.date.getTime()) || getLocalDateKey(selection.date) > getLocalDateKey(today)
    ? today : new Date(selection.date);
}
export type RecoveryDayPractice = PracticeDefinition & { done: boolean; recorded: boolean; dateKey: string };
export type RecoveryDaySnapshot = {
  dateKey: string; isToday: boolean; readOnly: boolean; future: boolean;
  practices: RecoveryDayPractice[]; completedPractices: number; pledged: boolean;
  checkIn: DailyCheckIn | null; checkInCompleted: boolean; journalSaved: boolean; resets: number; slips: RelapseRecord[];
  plan: PersonalDailyPlan | null; plannedPractices: RecoveryDayPractice[]; plannedTaskCount: number | null; completedPlannedTasks: number | null;
  resetRecords: ChallengeCompletion[]; toolReceipts: ToolCompletionReceipt[];
  protectedAttempts: number; riskMoments: number; hasRecordedActivity: boolean;
  streak: { days: number | null; startedAt: string | null; asOf: string; available: boolean };
};
/** Past-day values come only from dated records; lifetime totals are never assigned to a day. */
export function buildRecoveryDaySnapshot(state: RecoveryState, date: Date, now: Date | number = new Date()): RecoveryDaySnapshot {
  const today = clockDate(now);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid recovery date');
  const dateKey = getLocalDateKey(date), todayKey = getLocalDateKey(today);
  const isToday = dateKey === todayKey, future = dateKey > todayKey;
  const asOf = isToday ? today : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const completions = future ? [] : getDailyHabitCompletionsForDay(state, date);
  const practices = practiceDefinitions.map(practice => {
    const record = completions.find(item => item.key === practice.key);
    return { ...practice, done: record?.completed ?? false, recorded: Boolean(record), dateKey };
  });
  const checkIn = future ? null : getDailyCheckInForDay(state, date) ?? null;
  const pledged = !future && hasPledgedOnDate(state, dateKey);
  const resets = future ? 0 : getRecoveryChallengeCounts(state, dateKey, dateKey).completed;
  const plan = getPersonalDailyPlan(state, date, today);
  const plannedPractices = plan ? plan.practiceKeys.flatMap(key => practices.filter(practice => practice.key === key)) : [];
  const plannedTaskCount = plan ? 1 + plannedPractices.length : null;
  const completedPlannedTasks = plan ? Number(isCheckInCompleted(checkIn)) + plannedPractices.filter(practice => practice.done).length : null;
  const resetRecords = future ? [] : state.challengeHistory.filter(record => (record.source === 'tool' && record.dateKey ? record.dateKey : getLocalDateKey(record.completedAt)) === dateKey);
  const toolReceipts = future ? [] : (state.toolCompletions ?? []).filter(receipt => receipt.dateKey === dateKey);
  const slips = future ? [] : state.relapseRecords.filter(record => getLocalDateKey(record.occurredAt) === dateKey);
  const protectedAttempts = future ? 0 : countProtectedAttemptsForDay(state, date);
  const riskMoments = future ? 0 : countRecoveryRiskMomentsForDay(state, date);
  // Only retained starts establish a historical interval. previousStreakDays may
  // be stale at a slip, so it cannot establish a precise missing start date.
  const starts = [state.recoveryStartedAt, ...state.relapseRecords.map(record => record.occurredAt)]
    .filter((start): start is string => Boolean(start) && Number.isFinite(Date.parse(start!)) && Date.parse(start!) <= asOf.getTime())
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const startedAt = future ? null : starts[0] ?? null;
  const days = future ? null : isToday ? getCurrentRecoveryStreakDays(state, today) : startedAt ? calculateStreakDaysFrom(startedAt, asOf) : null;
  return {
    dateKey, isToday, readOnly: !isToday, future, practices,
    completedPractices: practices.filter(practice => practice.done).length,
    pledged, checkIn, checkInCompleted: isCheckInCompleted(checkIn), journalSaved: hasSavedJournal(checkIn), resets, slips, protectedAttempts, riskMoments,
    plan, plannedPractices, plannedTaskCount, completedPlannedTasks, resetRecords, toolReceipts,
    hasRecordedActivity: completions.length > 0 || pledged || Boolean(checkIn) || resets > 0 || slips.length > 0 || riskMoments > 0,
    streak: { days, startedAt, asOf: asOf.toISOString(), available: days !== null },
  };
}
