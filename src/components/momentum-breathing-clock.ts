/** Monotonic elapsed session time; paused time never advances the cadence. */
export function createBreathingClock() {
  let accumulated = 0;
  let startedAt: number | null = null;
  const elapsed = (now: number) => accumulated + (startedAt === null ? 0 : Math.max(0, now - startedAt));
  return {
    resume(now: number) { if (startedAt === null) startedAt = now; },
    pause(now: number) { accumulated = elapsed(now); startedAt = null; },
    reset() { accumulated = 0; startedAt = null; },
    elapsed
  };
}
