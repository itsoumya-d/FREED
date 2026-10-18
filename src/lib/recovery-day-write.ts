import { getLocalDateKey, getDailyCheckInForDay, hydrateRecoveryState, isCheckInCompleted, recordDailyCheckIn, type DailyCheckInInput, type RecoveryState } from './recovery-state';

/** Revalidate the form's date at the durable write, including a foreground after midnight. */
export function recordCheckInForDate(state: RecoveryState, input: DailyCheckInInput, dateKey: string, at = new Date()): RecoveryState {
  if (!dateKey || dateKey !== getLocalDateKey(at)) throw new Error('checkin-date-changed');
  if (input.mood === null || input.mood === undefined || !['low', 'steady', 'energized', 'stressed'].includes(input.mood) || typeof input.urgeLevel !== 'number' || !Number.isFinite(input.urgeLevel)) throw new Error('checkin-unanswered');
  return recordDailyCheckIn(state, input, at.toISOString());
}

/** Save words without manufacturing the check-in's optional signals. */
export function recordJournalForDate(state: RecoveryState, reflection: string, dateKey: string, at = new Date(), options: {editExisting?:boolean} = {}): RecoveryState {
  const today = getLocalDateKey(at);
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey > today) throw new Error('journal-date-changed');
  if (!reflection.trim()) throw new Error('journal-empty');
  if (dateKey !== today) {
    const original = state.dailyCheckIns.find(record => record.dateKey === dateKey);
    if (!options.editExisting || !original) throw new Error('journal-date-changed');
    return hydrateRecoveryState({...state,dailyCheckIns:state.dailyCheckIns.map(record => record.id === original.id ?
      {...record,reflection:reflection.slice(0,4000),journalSaved:true,updatedAt:at.toISOString()} : record)});
  }
  const existing = getDailyCheckInForDay(state, at);
  const updated = recordDailyCheckIn(state, { mood: existing?.mood ?? null, urgeLevel: existing?.urgeLevel ?? null,
    sleepQuality: existing?.sleepQuality ?? null, reflection }, at.toISOString());
  return hydrateRecoveryState({ ...updated, dailyCheckIns: updated.dailyCheckIns.map(record => record.dateKey === dateKey ? { ...record, checkInCompleted: isCheckInCompleted(existing) } : record) });
}
