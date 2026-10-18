import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBreathingPhase } from '../src/lib/breathing-cadence';
test('4-7-8 boundaries and cycle return follow active elapsed time', () => {
  assert.deepEqual(getBreathingPhase([4, 7, 8], 0), { phaseIndex: 0, secondsRemaining: 4 });
  assert.deepEqual(getBreathingPhase([4, 7, 8], 3999), { phaseIndex: 0, secondsRemaining: 1 });
  assert.deepEqual(getBreathingPhase([4, 7, 8], 4000), { phaseIndex: 1, secondsRemaining: 7 });
  assert.deepEqual(getBreathingPhase([4, 7, 8], 11000), { phaseIndex: 2, secondsRemaining: 8 });
  assert.deepEqual(getBreathingPhase([4, 7, 8], 19000), { phaseIndex: 0, secondsRemaining: 4 });
});
test('delayed callbacks catch up without extending a phase', () => {
  assert.deepEqual(getBreathingPhase([4, 4, 4, 4], 9700), { phaseIndex: 2, secondsRemaining: 3 });
  assert.deepEqual(getBreathingPhase([2, 1, 6], 9_000_000), { phaseIndex: 0, secondsRemaining: 2 });
});
test('invalid durations are rejected and invalid elapsed time cannot advance a phase', () => {
  for (const durations of [[], [0, 4], [4, NaN]]) assert.throws(() => getBreathingPhase(durations, 1000));
  assert.deepEqual(getBreathingPhase([4, 7, 8], -4000), getBreathingPhase([4, 7, 8], 0));
  assert.deepEqual(getBreathingPhase([4, 7, 8], NaN), getBreathingPhase([4, 7, 8], 0));
});
