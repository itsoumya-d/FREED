const immersive = new Set(['intercept', 'ad', 'challenge', 'breathing']);
const tasks = new Set(['account', 'paywall', 'protectionSetup', 'checkin', 'journal', 'slip', 'customChallenge', 'coach']);
export function getFreedFlowPresentation(destination: unknown): 'card' | 'modal' | 'fullScreenModal' {
  if (typeof destination !== 'string') return 'card';
  return immersive.has(destination) ? 'fullScreenModal' : tasks.has(destination) ? 'modal' : 'card';
}
