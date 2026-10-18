import { getLocalDateKey, hydrateRecoveryState, localDateKeyToUtcMs, type DailyHabitKey, type RecoveryState } from './recovery-state';
import { practiceDefinitions } from './practice-definitions';

export type PersonalPlanPreferences = { practiceKeys: DailyHabitKey[]; updatedAt: string | null };
export type PersonalDailyPlan = {
  dateKey: string; checkInRequired: true; practiceKeys: DailyHabitKey[];
  createdAt: string; updatedAt: string; recordedAt: string | null;
};
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const validAt = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const keys = (value: unknown): DailyHabitKey[] => Array.isArray(value) ? [...new Set(value.filter((key): key is DailyHabitKey => practiceDefinitions.some(practice => practice.key === key)))].slice(0, 2) : [];
export function createDefaultPersonalPlanPreferences(): PersonalPlanPreferences { return { practiceKeys: ['exercise', 'meditation'], updatedAt: null }; }
export function sanitizePersonalPlanPreferences(value: unknown): PersonalPlanPreferences {
  if (!isRecord(value) || !Array.isArray(value.practiceKeys)) return createDefaultPersonalPlanPreferences();
  return { practiceKeys: keys(value.practiceKeys), updatedAt: validAt(value.updatedAt) ? value.updatedAt : null };
}
export function sanitizePersonalDailyPlan(value: unknown): PersonalDailyPlan | null {
  if (!isRecord(value) || typeof value.dateKey !== 'string' || !Number.isFinite(localDateKeyToUtcMs(value.dateKey)) || !Array.isArray(value.practiceKeys) || !validAt(value.createdAt) || !validAt(value.updatedAt)) return null;
  return { dateKey: value.dateKey, checkInRequired: true, practiceKeys: keys(value.practiceKeys), createdAt: value.createdAt, updatedAt: value.updatedAt, recordedAt: validAt(value.recordedAt) ? value.recordedAt : null };
}
function asDate(value: Date | string | number): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (!Number.isFinite(localDateKeyToUtcMs(value))) return new Date(Number.NaN);
    const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12);
  }
  return new Date(value);
}
/** Historical targets come from the stored date, never from today's preferences. */
export function getPersonalDailyPlan(state: RecoveryState, date: Date | string, now: Date | number = new Date()): PersonalDailyPlan | null {
  const day = asDate(date), clock = asDate(now), dateKey = getLocalDateKey(day), todayKey = getLocalDateKey(clock);
  if (!dateKey || !todayKey || dateKey > todayKey) return null;
  const existing = (state.personalDailyPlans ?? []).find(plan => plan.dateKey === dateKey);
  if (existing) return { ...existing, practiceKeys: [...existing.practiceKeys] };
  if (dateKey !== todayKey) return null;
  const preferences = state.personalPlanPreferences ?? createDefaultPersonalPlanPreferences();
  return { dateKey, checkInRequired: true, practiceKeys: [...preferences.practiceKeys], createdAt: clock.toISOString(), updatedAt: clock.toISOString(), recordedAt: null };
}
/** Pin the day's choices on its first record; later records never rewrite targets. */
export function markPersonalPlanDate(state: RecoveryState, at: Date | string = new Date()): RecoveryState {
  const date = asDate(at), dateKey = getLocalDateKey(date);
  if (!dateKey) throw new RangeError('plan-date-invalid');
  const existing = (state.personalDailyPlans ?? []).find(plan => plan.dateKey === dateKey);
  if (existing?.recordedAt) return state;
  const stamp = date.toISOString();
  const plan = existing ? { ...existing, recordedAt: stamp } : { ...getPersonalDailyPlan(state, date, date)!, recordedAt: stamp };
  return { ...state, personalDailyPlans: [plan, ...(state.personalDailyPlans ?? []).filter(item => item.dateKey !== dateKey)].slice(0, 400) };
}
/** Same-day edits update this date and future defaults, while past dates remain immutable. */
export function updatePersonalDailyPlan(state: RecoveryState, practiceKeys: readonly DailyHabitKey[], dateKey: string, at = new Date()): RecoveryState {
  if (!dateKey || dateKey !== getLocalDateKey(at)) throw new Error('plan-date-changed');
  if (!Array.isArray(practiceKeys) || practiceKeys.length > 2 || practiceKeys.some(key => !practiceDefinitions.some(practice => practice.key === key))) throw new RangeError('plan-invalid');
  const chosen = keys(practiceKeys), stamp = at.toISOString();
  const existing = (state.personalDailyPlans ?? []).find(plan => plan.dateKey === dateKey);
  const plan: PersonalDailyPlan = { dateKey, checkInRequired: true, practiceKeys: chosen, createdAt: existing?.createdAt ?? stamp, updatedAt: stamp, recordedAt: existing?.recordedAt ?? null };
  return hydrateRecoveryState({ ...state, personalPlanPreferences: { practiceKeys: chosen, updatedAt: stamp }, personalDailyPlans: [plan, ...(state.personalDailyPlans ?? []).filter(item => item.dateKey !== dateKey)] });
}
