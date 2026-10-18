/** Contains no runtime imports; the controller and native bridge share this validator. */
export type AppGroupBindingStage = 'scope-validation' | 'lock-acquire' | 'state-read' | 'legacy-migration' | 'state-commit' | 'owner-binding' | 'complete' | 'bridge-validation' | 'unavailable';
export type AppGroupBindingReceipt = {
  version: 1;
  operationId: string;
  supported: boolean;
  accepted: boolean;
  bindingCurrent: boolean;
  ownerVerified: boolean;
  stage: AppGroupBindingStage;
  reason: string | null;
  generation: number | null;
  scopeEpoch: number | null;
  errorCode: number | null;
  errorDomain: string | null;
};
const stages: ReadonlySet<string> = new Set(['scope-validation','lock-acquire','state-read','legacy-migration','state-commit','owner-binding','complete','bridge-validation','unavailable']);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const nullableInteger = (value: unknown) => value === null || integer(value);
const safeCode = (value: unknown) => value === null || typeof value === 'string' && /^[a-z][a-z0-9-]{0,95}$/.test(value);
export function validateAppGroupBindingReceipt(value: unknown): AppGroupBindingReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (r.version !== 1 || typeof r.operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.operationId)
    || typeof r.supported !== 'boolean' || typeof r.accepted !== 'boolean' || typeof r.bindingCurrent !== 'boolean' || typeof r.ownerVerified !== 'boolean'
    || typeof r.stage !== 'string' || !stages.has(r.stage) || !safeCode(r.reason)
    || !nullableInteger(r.generation) || !nullableInteger(r.scopeEpoch) || !nullableInteger(r.errorCode)
    || !(r.errorDomain === null || r.errorDomain === 'NSPOSIXErrorDomain' || r.errorDomain === 'FreedProtection')) return null;
  if (r.accepted && !(r.supported && r.bindingCurrent && r.ownerVerified && r.stage === 'complete' && r.reason === null && integer(r.generation) && integer(r.scopeEpoch) && r.errorCode === null && r.errorDomain === null)) return null;
  if (!r.accepted && r.reason === null) return null;
  return { version: 1, operationId: r.operationId, supported: r.supported, accepted: r.accepted, bindingCurrent: r.bindingCurrent, ownerVerified: r.ownerVerified,
    stage: r.stage as AppGroupBindingStage, reason: r.reason as string | null, generation: r.generation as number | null, scopeEpoch: r.scopeEpoch as number | null,
    errorCode: r.errorCode as number | null, errorDomain: r.errorDomain as string | null };
}
export function isAppGroupBindingConfirmed(value: unknown): value is AppGroupBindingReceipt {
  return validateAppGroupBindingReceipt(value)?.accepted === true;
}
