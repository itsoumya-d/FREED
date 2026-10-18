import type { ProtectionStatus } from 'freed-protection';

export type ProtectionAuthorizationReceipt = {
  authorized: boolean;
  outcome: 'granted' | 'denied' | 'cancelled' | 'error' | 'unsupported' | 'unconfirmed';
  authorizationErrorDomain?: string;
  authorizationErrorCode?: number;
};

/** Keep only the public outcome and bounded diagnostic pair, never native text. */
export function normalizeProtectionAuthorization(value: unknown): ProtectionAuthorizationReceipt {
  const receipt = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const explicit = receipt.authorizationOutcome;
  const outcome = explicit === 'denied' || explicit === 'cancelled' || explicit === 'error' || explicit === 'unsupported' ? explicit
    : receipt.authorized === true && (explicit === undefined || explicit === 'granted') ? 'granted' : 'unconfirmed';
  const result: ProtectionAuthorizationReceipt = { authorized: outcome === 'granted', outcome };
  const domain = receipt.authorizationErrorDomain, code = receipt.authorizationErrorCode;
  if (typeof code === 'number' && Number.isSafeInteger(code)
    && (domain === 'FamilyControls.FamilyControlsError' && code >= 0 && code <= 8
      || domain === 'NSCocoaErrorDomain' && code === 3072
      || domain === 'NSOSStatusErrorDomain' && code === -128)) {
    result.authorizationErrorDomain = domain;
    result.authorizationErrorCode = code;
  }
  return result;
}

/** Failed or malformed reads cannot retain a prior permission or green layer. */
export function isProtectionSetupStatusObserved(value: unknown): value is ProtectionStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  return typeof status.authorized === 'boolean' && typeof status.active === 'boolean'
    && typeof status.mode === 'string' && status.mode.length > 0 && typeof status.message === 'string'
    && (status.adultFilterActive === undefined || typeof status.adultFilterActive === 'boolean')
    && (status.statusReadAccepted === undefined || status.statusReadAccepted === true)
    && status.statusReadError === undefined
    && (status.statusVisibility === undefined || status.statusVisibility === 'account' || status.statusVisibility === 'device');
}
