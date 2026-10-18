import assert from 'node:assert/strict';
import { test } from 'node:test';
import { challengeLibrary } from '../src/lib/recovery-engine';
import { createDefaultRecoveryState, hydrateRecoveryState, recordChallengeCompletion } from '../src/lib/recovery-state';
test('a durable exercise receipt cannot credit recovery twice after a restart', () => {
  const challenge = challengeLibrary[0];
  const first = recordChallengeCompletion(createDefaultRecoveryState(), challenge, '2026-10-02T12:00:00.000Z', undefined, 'helped', 'session-once-123');
  const restored = hydrateRecoveryState(JSON.parse(JSON.stringify(first)));
  const second = recordChallengeCompletion(restored, challenge, '2026-10-02T12:00:00.000Z', undefined, 'helped', 'session-once-123');
  assert.equal(first.completedChallenges, 1);
  assert.equal(second.completedChallenges, 1);
  assert.equal(second.challengeHistory.length, 1);
});
test('different exercise sessions still credit the same challenge independently', () => {
  const challenge = challengeLibrary[0];
  let state = createDefaultRecoveryState();
  for (const id of ['session-1', 'session-2']) state = recordChallengeCompletion(state, challenge, undefined, undefined, 'helped', id);
  assert.equal(state.completedChallenges, 2);
});
