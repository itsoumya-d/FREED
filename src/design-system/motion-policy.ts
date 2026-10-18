/** Timing budgets are shared by native controls, state feedback and route artwork. */
export const MOTION_DURATIONS = {
  feedback: 120,
  state: 200,
  detail: 260,
  screen: 220,
  exit: 100,
} as const;

export function clampMotionDuration(duration: number, fallback: number = MOTION_DURATIONS.state): number {
  const safeDuration = Number.isFinite(duration) ? duration : Number.isFinite(fallback) ? fallback : MOTION_DURATIONS.state;
  return Math.max(0, Math.min(300, safeDuration));
}

export function clampPressScale(scale: number): number {
  return Number.isFinite(scale) ? Math.max(0.95, Math.min(1, scale)) : 0.97;
}

export function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
}

/** The whole sequence, including delay, remains at most 300 ms. */
export function getStaggerDelay(index: number): number {
  return Number.isFinite(index) ? Math.min(4, Math.max(0, Math.trunc(index))) * 20 : 0;
}

export function motionMayRun({ visible, focused, foreground, reduceMotion }: {
  visible: boolean;
  focused: boolean;
  foreground: boolean;
  reduceMotion: boolean;
}): boolean {
  return visible && focused && foreground && !reduceMotion;
}

/** Current stage and measured workflow progress deliberately remain independent. */
export function normalizeRecoveryPathState(progress: number, activeStage: number): {
  progress: number;
  activeStage: 0 | 1 | 2;
} {
  return {
    progress: clampProgress(progress),
    activeStage: (Number.isFinite(activeStage) ? Math.max(0, Math.min(2, Math.trunc(activeStage))) : 0) as 0 | 1 | 2,
  };
}
