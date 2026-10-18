/** One bounded, memory-only receipt. Never store SDK payloads, messages or identifiers. */
export type RewardedStage = 'configuration' | 'module-import' | 'module-shape' | 'factory' | 'provider' | 'membership' | 'offer' | 'consent-update' | 'consent-form' | 'consent-current' | 'sdk-init' | 'fresh-access' | 'load' | 'loaded' | 'show' | 'opened' | 'earned' | 'closed' | 'save' | 'privacy-options';
export type RewardedFailure = 'unavailable' | 'cancelled' | 'access-changed' | 'unknown-access' | 'timeout' | 'native-error' | 'not-permitted' | 'skipped' | 'storage';
export type RewardedDiagnostic = {
  stage: RewardedStage;
  elapsedMs: number;
  failure?: RewardedFailure;
  nativeCode?: string;
  foreground?: boolean;
  ownerCurrent?: boolean;
  contextCurrent?: boolean;
  eligible?: boolean;
  canRequestAds?: boolean;
  status?: 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED';
  privacyOptionsRequirementStatus?: 'UNKNOWN' | 'REQUIRED' | 'NOT_REQUIRED';
  adaptersReady?: boolean;
};
export type RewardedDiagnosticInput = Omit<RewardedDiagnostic, 'elapsedMs'>;
export type RewardedDiagnosticReceipt = { version: 1; events: RewardedDiagnostic[] };
const nativeCodes = new Set(['invalid-request', 'no-fill', 'network-error', 'server-error', 'timeout', 'internal-error', 'nil-vc', 'not-ready', 'consent-update-failed', 'consent-form-error']);
export function rewardedNativeCode(error: unknown): string {
  const value = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  const code = typeof value === 'string' ? value.replace(/^googleMobileAds\//, '') : '';
  return nativeCodes.has(code) ? code : 'unknown';
}
export function consentDiagnostic(info: unknown): Pick<RewardedDiagnostic, 'canRequestAds' | 'status' | 'privacyOptionsRequirementStatus'> {
  const value = info && typeof info === 'object' ? info as Record<string, unknown> : {};
  return {
    canRequestAds: value.canRequestAds === true,
    ...(['UNKNOWN', 'REQUIRED', 'NOT_REQUIRED', 'OBTAINED'].includes(String(value.status)) ? { status: value.status as RewardedDiagnostic['status'] } : {}),
    ...(['UNKNOWN', 'REQUIRED', 'NOT_REQUIRED'].includes(String(value.privacyOptionsRequirementStatus)) ? { privacyOptionsRequirementStatus: value.privacyOptionsRequirementStatus as RewardedDiagnostic['privacyOptionsRequirementStatus'] } : {})
  };
}
export function createRewardedDiagnosticReceipt(now = Date.now) {
  const started = now();
  const events: RewardedDiagnostic[] = [];
  return {
    record(event: RewardedDiagnosticInput) {
      const safe: RewardedDiagnostic = { stage: event.stage, elapsedMs: Math.max(0, Math.min(3600000, Math.round(now() - started))) };
      if (event.failure) safe.failure = event.failure;
      if (event.nativeCode) safe.nativeCode = rewardedNativeCode({ code: event.nativeCode });
      for (const key of ['foreground', 'ownerCurrent', 'contextCurrent', 'eligible', 'canRequestAds', 'adaptersReady'] as const) {
        if (typeof event[key] === 'boolean') safe[key] = event[key];
      }
      if (event.status) safe.status = consentDiagnostic(event).status;
      if (event.privacyOptionsRequirementStatus) safe.privacyOptionsRequirementStatus = consentDiagnostic(event).privacyOptionsRequirementStatus;
      events.push(safe);
      if (events.length > 32) events.shift();
    },
    read: (): RewardedDiagnosticReceipt => ({ version: 1, events: events.map(event => ({ ...event })) })
  };
}

let providerDiagnostic: RewardedDiagnosticInput | null = null;
export function setRewardedProviderDiagnostic(event: RewardedDiagnosticInput | null) { providerDiagnostic = event; }
export function getRewardedProviderDiagnostic(): RewardedDiagnosticReceipt | undefined {
  if (!providerDiagnostic) return undefined;
  const receipt = createRewardedDiagnosticReceipt(); receipt.record(providerDiagnostic); return receipt.read();
}
