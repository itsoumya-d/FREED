import assert from 'node:assert/strict';
import { createDefaultRecoveryState } from '../src/lib/recovery-state';
import { recordCheckInForDate } from '../src/lib/recovery-day-write';

const state = createDefaultRecoveryState();
const input = { mood: 'steady' as const, urgeLevel: 2, sleepQuality: 3, reflection: 'Private draft' };
const at = new Date(2026, 9, 4, 0, 1);
assert.throws(() => recordCheckInForDate(state, input, '2026-10-03', at), /date-changed/);
assert.equal(state.dailyCheckIns.length, 0);
const saved = recordCheckInForDate(state, input, '2026-10-04', at);
assert.equal(saved.dailyCheckIns[0].dateKey, '2026-10-04');
assert.equal(saved.dailyCheckIns[0].reflection, input.reflection);
const updated = recordCheckInForDate(saved, { ...input, urgeLevel: 4 }, '2026-10-04', at);
assert.equal(updated.dailyCheckIns.length, 1);
assert.equal(updated.dailyCheckIns[0].urgeLevel, 4);
console.log('Stale-day save rejection and same-day check-in update passed.');
