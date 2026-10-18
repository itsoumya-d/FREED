import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLocalDateKey } from '../src/lib/recovery-state';
import { recoveryWeekStart, recoveryWeekDates, recoveryWeekPages, recoveryWeekAtOffset, shiftRecoveryWeek } from '../src/components/recovery-week-pager';
test('civil weeks retain seven local noon dates through both DST transition fixtures', () => {
  for (const [date, expected] of [
    [new Date(2026, 2, 6, 12), ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']],
    [new Date(2026, 9, 30, 12), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']]
  ] as const) {
    const days = recoveryWeekDates(date);
    assert.deepEqual(days.map(day => getLocalDateKey(day)), expected);
    assert.equal(new Set(days.map(day => getLocalDateKey(day))).size, 7);
    assert.ok(days.every(day => day.getHours() === 12));
  }
});
test('month/year rollover and arrow steps use civil Mondays', () => {
  assert.equal(getLocalDateKey(recoveryWeekStart(new Date(2027, 0, 1, 12))), '2026-12-28');
  assert.equal(getLocalDateKey(shiftRecoveryWeek(new Date(2027, 0, 1, 12), 1)), '2027-01-04');
  assert.equal(getLocalDateKey(shiftRecoveryWeek(new Date(2027, 0, 1, 12), -1)), '2026-12-21');
});
test('LTR/RTL page offsets stay bounded at today and reject invalid geometry', () => {
  const today = new Date(2026, 9, 7, 12);
  const ltr = recoveryWeekPages(today, today, false), rtl = recoveryWeekPages(today, today, true);
  assert.deepEqual(ltr.map(day => getLocalDateKey(day)), ['2026-09-28', '2026-10-05']);
  assert.deepEqual(rtl.map(day => getLocalDateKey(day)), ['2026-10-05', '2026-09-28']);
  assert.equal(getLocalDateKey(recoveryWeekAtOffset(ltr, 0, 327)!), '2026-09-28');
  assert.equal(getLocalDateKey(recoveryWeekAtOffset(rtl, 327, 327)!), '2026-09-28');
  assert.equal(getLocalDateKey(recoveryWeekAtOffset(ltr, 9999, 327)!), '2026-10-05');
  assert.equal(recoveryWeekAtOffset(ltr, Number.NaN, 327), null);
  assert.equal(recoveryWeekAtOffset(ltr, 327, 0), null);
});
test('a future visible anchor cannot produce future week pages', () => {
  const today = new Date(2026, 9, 7, 12);
  assert.deepEqual(recoveryWeekPages(new Date(2027, 0, 2, 12), today, false).map(day => getLocalDateKey(day)), ['2026-09-28', '2026-10-05']);
});
