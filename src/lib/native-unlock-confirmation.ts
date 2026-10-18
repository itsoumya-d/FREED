import type { EarnedUnlock } from './recovery-state';
import { appPackageForEarnedUnlockSource, isIosScreenTimeShieldSource, sanitizeNativeInterventionId } from './native-intervention';
import { normalizeDoomscrollAppPackage } from './doomscroll-apps';

export type NativeUnlockEvidence = {
  nativeUnlockGrantAccepted?: boolean;
  nativeUnlockGrantInterventionId?: string | null;
  activeUnlockInterventionId?: string | null;
  activeUnlockExpiresAt?: string | null;
  activeUnlockSourcePackage?: string | null;
  activeFocusShieldUnlockInterventionId?: string | null;
  activeFocusShieldUnlockExpiresAt?: string | null;
};

export function requiresNativeUnlockConfirmation(unlock: EarnedUnlock, platform: string): boolean {
  return (platform === 'android' && Boolean(appPackageForEarnedUnlockSource(unlock.sourceAttemptHost))) ||
    (platform === 'ios' && isIosScreenTimeShieldSource(unlock.sourceAttemptHost)) ||
    (platform === 'android' && Boolean(unlock.nativeInterventionId) && !unlock.sourceAttemptHost);
}

/** Getter evidence establishes current presentation; saved records cannot grant access. */
export function nativeWindowMatchesUnlock(unlock: EarnedUnlock, evidence: NativeUnlockEvidence | null, platform: string, nowMs = Date.now()): boolean {
  const id = sanitizeNativeInterventionId(unlock.nativeInterventionId);
  const expires = Date.parse(unlock.expiresAt);
  if (!evidence || !id || !Number.isFinite(expires) || expires <= nowMs || unlock.historicalOnly) return false;
  if (platform === 'android' && !unlock.sourceAttemptHost) {
    return sanitizeNativeInterventionId(evidence.activeFocusShieldUnlockInterventionId) === id &&
      Date.parse(evidence.activeFocusShieldUnlockExpiresAt ?? '') === expires;
  }
  if (sanitizeNativeInterventionId(evidence.activeUnlockInterventionId) !== id || Date.parse(evidence.activeUnlockExpiresAt ?? '') !== expires) return false;
  if (platform === 'ios') return isIosScreenTimeShieldSource(unlock.sourceAttemptHost);
  if (platform === 'android') {
    const requested = appPackageForEarnedUnlockSource(unlock.sourceAttemptHost);
    return Boolean(requested && normalizeDoomscrollAppPackage(evidence.activeUnlockSourcePackage ?? '') === requested);
  }
  return false;
}

/** A response acknowledges this exact grant, independently from health or other windows. */
export function nativeGrantConfirmsUnlock(unlock: EarnedUnlock, evidence: NativeUnlockEvidence | null, platform: string, nowMs = Date.now()): boolean {
  const id = sanitizeNativeInterventionId(unlock.nativeInterventionId);
  return Boolean(id && evidence?.nativeUnlockGrantAccepted === true &&
    sanitizeNativeInterventionId(evidence.nativeUnlockGrantInterventionId) === id &&
    nativeWindowMatchesUnlock(unlock, evidence, platform, nowMs));
}

export function getPresentedEarnedUnlock(unlocks: readonly EarnedUnlock[], evidence: NativeUnlockEvidence | null, platform: string, nowMs = Date.now()): EarnedUnlock | null {
  return unlocks.filter(unlock => !unlock.historicalOnly && Date.parse(unlock.startedAt) <= nowMs && Date.parse(unlock.expiresAt) > nowMs &&
    (!requiresNativeUnlockConfirmation(unlock, platform) || nativeWindowMatchesUnlock(unlock, evidence, platform, nowMs)))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;
}

/** DeviceActivity uses whole seconds. Canonicalize before persisting/calling native. */
export function canonicalAppBreakStartedAt(value: string, platform: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('Invalid app break timestamp.');
  return new Date(platform === 'ios' ? Math.floor(ms / 1000) * 1000 : ms).toISOString();
}
