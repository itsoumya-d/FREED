import { getLocalDateKey } from '@/lib/recovery-state';

/** Civil-date arithmetic keeps Monday and seven distinct dates across DST. */
export function recoveryWeekStart(date: Date): Date {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid calendar date');
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7, 12);
}
export function shiftRecoveryWeek(date: Date, weeks: number): Date {
  const monday = recoveryWeekStart(date);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + Math.trunc(weeks) * 7, 12);
}
export function recoveryWeekDates(date: Date): Date[] {
  const monday = recoveryWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index, 12));
}
/** A bounded moving window can browse all older weeks without rendering the entire history. */
export function recoveryWeekPages(visible: Date, today: Date, rtl: boolean): Date[] {
  const current = recoveryWeekStart(visible), latest = recoveryWeekStart(today);
  const bounded = getLocalDateKey(current) > getLocalDateKey(latest) ? latest : current;
  const next = shiftRecoveryWeek(bounded, 1);
  const pages = [shiftRecoveryWeek(bounded, -1), bounded];
  if (getLocalDateKey(next) <= getLocalDateKey(latest)) pages.push(next);
  return rtl ? pages.reverse() : pages;
}
export function recoveryWeekAtOffset(pages: readonly Date[], offset: number, width: number): Date | null {
  if (!pages.length || !Number.isFinite(offset) || !Number.isFinite(width) || width <= 0) return null;
  const index = Math.max(0, Math.min(pages.length - 1, Math.round(offset / width)));
  return pages[index];
}
