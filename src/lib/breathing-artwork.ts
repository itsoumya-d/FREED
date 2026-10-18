/** Frame ranges from the licensed animation's first 4–7–8 cycle. */
const frames: Record<string, readonly [number, number]> = {
  Inhale: [0, 200], Hold: [200, 550], Exhale: [550, 950], 'Hold Empty': [950, 950],
  'Deep Inhale': [0, 100], 'Top-Off Inhale': [100, 200], 'Long Exhale': [550, 950],
};
export function getBreathingArtworkProgress(phase: string, elapsedRatio: number) {
  const range = frames[phase];
  if (!range) return 0;
  const ratio = Number.isFinite(elapsedRatio) ? Math.max(0, Math.min(1, elapsedRatio)) : 0;
  return (range[0] + (range[1] - range[0]) * ratio) / 950;
}

export function getBreathingArtworkTiming(durations: readonly number[], phaseIndex: number, activeElapsedMs: number) {
  const cycleMs = durations.reduce((sum, value) => sum + value * 1000, 0);
  if (!Number.isFinite(cycleMs) || cycleMs <= 0 || !durations[phaseIndex]) return { elapsedRatio: 0, remainingMs: 0 };
  const elapsed = Math.max(0, Number.isFinite(activeElapsedMs) ? activeElapsedMs : 0) % cycleMs;
  const startMs = durations.slice(0, phaseIndex).reduce((sum, value) => sum + value * 1000, 0);
  const elapsedRatio = Math.max(0, Math.min(1, (elapsed - startMs) / (durations[phaseIndex] * 1000)));
  return { elapsedRatio, remainingMs: durations[phaseIndex] * 1000 * (1 - elapsedRatio) };
}
