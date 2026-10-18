import { createBreathingClock } from '../components/momentum-breathing-clock';
export const BREATHING_SESSION_KEY = 'freed.recovery.breathing-session.v1';
type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
export type BreathingSessionMode = 'gentle' | '478' | 'box' | 'sigh';
/** Persist only observed active time. Relaunch always restores paused. */
export function createBreathingSession(storage: Storage, wallNow = Date.now()) {
  const fresh = (mode: BreathingSessionMode = 'gentle', at = wallNow) => ({ id: `breath-${at.toString(36)}-${Math.random().toString(36).slice(2,10)}`, startedAt: at, mode, observedMs: 0, pending: null as { at: number; dateKey: string; seconds: number } | null });
  let data = fresh(); let restored = false; let running = false; let error = false;
  try {
    const raw = storage.getItem(BREATHING_SESSION_KEY); const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.id === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(parsed.id) && ['gentle','478','box','sigh'].includes(parsed.mode) && Number.isFinite(parsed.startedAt) && parsed.startedAt <= wallNow && Number.isFinite(parsed.observedMs) && parsed.observedMs >= 0 && parsed.observedMs <= wallNow - parsed.startedAt) { data = { ...parsed, pending: parsed.pending && Number.isFinite(parsed.pending.at) && parsed.pending.at >= parsed.startedAt && parsed.pending.at <= wallNow && /^\d{4}-\d{2}-\d{2}$/.test(parsed.pending.dateKey) && Number.isInteger(parsed.pending.seconds) && parsed.pending.seconds > 0 && parsed.pending.seconds <= parsed.observedMs / 1000 && parsed.pending.seconds <= (parsed.pending.at - parsed.startedAt) / 1000 ? parsed.pending : null }; restored = parsed.observedMs > 0; }
  } catch { error = true; }
  const clock = createBreathingClock();
  const persist = () => { try { storage.setItem(BREATHING_SESSION_KEY, JSON.stringify(data)); error = false; } catch { error = true; } };
  return {
    get pending() { return data.pending; },
    get id() { return data.id; }, get startedAt() { return data.startedAt; }, get mode() { return data.mode as BreathingSessionMode; }, get restored() { return restored; }, get error() { return error; },
    elapsed(now: number) { return data.observedMs + clock.elapsed(now); },
    resume(now: number) { clock.resume(now); running = true; persist(); },
    pause(now: number) { clock.pause(now); data.observedMs += clock.elapsed(now); clock.reset(); running = false; persist(); },
    checkpoint(now: number) { data.observedMs += clock.elapsed(now); clock.reset(); if (running) clock.resume(now); persist(); },
    reset(mode: BreathingSessionMode = 'gentle', at = Date.now()) { clock.reset(); running = false; restored = false; data = fresh(mode,at); persist(); },
    finish(monotonicNow: number, at: number, dateKey: string) {
      clock.pause(monotonicNow); data.observedMs += clock.elapsed(monotonicNow); clock.reset(); running = false;
      if (!data.pending) { const seconds = Math.floor(data.observedMs / 1000); if (seconds > 0) data.pending = { at, dateKey, seconds }; }
      persist(); return data.pending;
    },
    clear() { storage.removeItem(BREATHING_SESSION_KEY); },
  };
}
