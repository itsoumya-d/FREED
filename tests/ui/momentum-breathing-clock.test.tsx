import { createBreathingClock } from '@/components/momentum-breathing-clock';
import { getBreathingPhase } from '@/lib/breathing-cadence';

test('pause freezes the real phase and resume continues its remaining time', () => {
  const clock = createBreathingClock();
  clock.resume(1000);
  expect(getBreathingPhase([4, 7, 8], clock.elapsed(6500))).toMatchObject({ phaseIndex: 1, secondsRemaining: 6 });
  clock.pause(6500);
  expect(clock.elapsed(30000)).toBe(5500);
  clock.resume(30000);
  expect(getBreathingPhase([4, 7, 8], clock.elapsed(30500))).toMatchObject({ phaseIndex: 1, secondsRemaining: 5 });
});
test('changing the cadence resets elapsed time before the next session', () => {
  const clock = createBreathingClock(); clock.resume(1000); clock.pause(13000); clock.reset();
  expect(clock.elapsed(20000)).toBe(0);
  clock.resume(20000);
  expect(getBreathingPhase([4, 4, 4, 4], clock.elapsed(21000))).toMatchObject({ phaseIndex: 0, secondsRemaining: 3 });
});
