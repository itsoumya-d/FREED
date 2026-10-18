import { getDailyHabitCompletionsForDay, getLocalDateKey, recordDailyHabitCompletion, type RecoveryState, type DailyHabitKey } from '@/lib/recovery-state';
/** Resolve completion and its recorded date together at the actual state write. */
export function recordPracticeToggle(state: RecoveryState, input: { key: DailyHabitKey; label: string; dateKey: string }, nowMs = Date.now()) {
  const at = new Date(nowMs);
  if (input.dateKey !== getLocalDateKey(at)) return state;
  const completed = getDailyHabitCompletionsForDay(state, at).some(item => item.key === input.key && item.completed);
  return recordDailyHabitCompletion(state, { key: input.key, label: input.label, completed: !completed }, at.toISOString());
}
