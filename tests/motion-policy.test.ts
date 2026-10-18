import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MOTION_DURATIONS,
  clampMotionDuration,
  clampPressScale,
  clampProgress,
  getStaggerDelay,
  motionMayRun,
  normalizeRecoveryPathState,
} from '../src/design-system/motion-policy';

test('ordinary feedback and the complete entrance sequence stay inside their motion budget', () => {
  assert.ok(MOTION_DURATIONS.feedback <= 150);
  for (const index of [0, 1, 6, 99, Infinity, -2, NaN]) {
    const delay = getStaggerDelay(index);
    assert.ok(delay >= 0);
    assert.ok(delay + MOTION_DURATIONS.screen <= 300);
  }
  assert.equal(clampMotionDuration(5_000), 300);
  assert.equal(clampMotionDuration(-20), 0);
  assert.equal(clampMotionDuration(NaN), MOTION_DURATIONS.state);
  assert.equal(clampMotionDuration(NaN, 900), 300);
  assert.equal(clampMotionDuration(NaN, NaN), MOTION_DURATIONS.state);
});

test('press feedback cannot collapse a control or pass non-finite transforms to native', () => {
  assert.equal(clampPressScale(0), 0.95);
  assert.equal(clampPressScale(3), 1);
  assert.equal(clampPressScale(NaN), 0.97);
  assert.equal(clampPressScale(Infinity), 0.97);
  assert.equal(clampPressScale(0.98), 0.98);
});

test('hidden, unfocused, background and Reduce Motion states never run spatial motion', () => {
  const active = { visible: true, focused: true, foreground: true, reduceMotion: false };
  assert.equal(motionMayRun(active), true);
  for (const key of ['visible', 'focused', 'foreground'] as const) {
    assert.equal(motionMayRun({ ...active, [key]: false }), false);
  }
  assert.equal(motionMayRun({ ...active, reduceMotion: true }), false);
});

test('a new plan draws zero progress, completion draws one, and invalid values cannot invent progress', () => {
  assert.equal(clampProgress(0), 0);
  assert.equal(clampProgress(1), 1);
  assert.equal(clampProgress(NaN), 0);
  assert.equal(clampProgress(Infinity), 0);
  assert.equal(clampProgress(-1), 0);
  assert.equal(clampProgress(2), 1);
  assert.deepEqual(normalizeRecoveryPathState(0, 2), { progress: 0, activeStage: 2 });
  assert.deepEqual(normalizeRecoveryPathState(0.4, 1), { progress: 0.4, activeStage: 1 });
  assert.deepEqual(normalizeRecoveryPathState(NaN, NaN), { progress: 0, activeStage: 0 });
});
