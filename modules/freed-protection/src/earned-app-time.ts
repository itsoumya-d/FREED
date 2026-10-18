import type { AppGroupUpdateRequest } from '../../../src/lib/app-groups-contract';
import { validateAppGroupUpdate } from '../../../src/lib/protection-groups';

/** Version 2 is a separate protocol. These objects never contain an iOS token or owner digest. */
export type EarnedAppTimeSeconds = 300 | 600 | 1200;
export const EARNED_APP_TIME_SECONDS = Object.freeze([300, 600, 1200] as const);
export type EarnedAppTimeCapMinutes = 0 | 5 | 10 | 20 | 30 | 60;
export type EarnedAppTimeCategory = 'breathe' | 'move' | 'find';
export type EarnedAppTimeEvidenceMethod = 'timer' | 'steps' | 'photo';
export type EarnedAppTimeRequirements = {
  requiredActiveSeconds: 60 | 120; requiredSteps: 30 | 60; requiredDistinctPhotoTargets: 1 | 2;
};
export type EarnedAppTimeOfferRequest = {
  version: 2; policyVersion: 2; nativeInterventionId: string; groupId: string; groupRevision: number;
  configurationGeneration: number; scopeEpoch: number; requestedSeconds: EarnedAppTimeSeconds;
} & ({ kind: 'ios-app-group'; tokenType: 'application' } | { kind: 'android-app-group'; packageName: string });
export type EarnedAppTimeOffer = EarnedAppTimeRequirements & {
  offerId: string; nativeInterventionId: string; groupId: string; groupRevision: number;
  configurationGeneration: number; scopeEpoch: number; kind: 'ios-app-group' | 'android-app-group';
  requestedSeconds: EarnedAppTimeSeconds; budgetDay: string; budgetRevision: number; validUntil: string;
  /** Native verified capabilities for this offer; client counts cannot enable a method. */
  availableMethods: EarnedAppTimeEvidenceMethod[];
  supportedPhotoTargetIds?: string[];
};
export type EarnedAppTimeBudget = {
  version: 2; configuredCapMinutes: EarnedAppTimeCapMinutes; effectiveCapMinutes: EarnedAppTimeCapMinutes;
  spentSeconds: number; remainingSeconds: number; dayKey: string; nextResetAt: string;
  pendingCapMinutes: EarnedAppTimeCapMinutes | null; pendingEffectiveAt: string | null;
  revision: number; clockState: 'verified' | 'unverified';
};
export type EarnedAppTimeOfferReceipt = {
  version: 2; policyVersion: 2; supported: boolean; accepted: boolean; reason: string | null;
  offer: EarnedAppTimeOffer | null; budget: EarnedAppTimeBudget | null;
};
export type EarnedAppTimeGrantRequest = {
  version: 2; policyVersion: 2; offerId: string; completionSessionId: string;
  category: EarnedAppTimeCategory; templateId: string; templateVersion: number;
  evidence: { method: EarnedAppTimeEvidenceMethod; activeDurationSec: number; observedSteps: number; photoProofIds: string[]; stepProofId?:string };
};
export type EarnedAppTimeGrantReceipt = {
  version: 2; policyVersion: 2; supported: boolean; accepted: boolean; reason: string | null;
  offerId: string | null; completionSessionId: string | null; groupId: string | null; nativeInterventionId: string | null;
  seconds: EarnedAppTimeSeconds | null; expiresAt: string | null; effective: boolean;
  remainingRestrictionCount: number | null; replayed: boolean; budget: EarnedAppTimeBudget | null;
};
export type AppGroupEarnedTimeUpdateRequest = Omit<AppGroupUpdateRequest, 'version'> & {
  version: 2; extraTimeCapMinutes: EarnedAppTimeCapMinutes;
  /** Saved presentation default; it never grants a lease or resets spent time. */
  preferredBreakSeconds?: EarnedAppTimeSeconds;
};

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).length === fields.length && Object.keys(v).every(key => fields.includes(key));
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(v);
const groupId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const dayKey = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9:_+./-]{1,128}$/.test(v);
export const isEarnedAppTimeSeconds = (v: unknown): v is EarnedAppTimeSeconds => v === 300 || v === 600 || v === 1200;
const seconds = isEarnedAppTimeSeconds;
export const isEarnedAppTimeCapMinutes = (v: unknown): v is EarnedAppTimeCapMinutes => [0, 5, 10, 20, 30, 60].includes(v as number);
export function isEarnedAppTimeIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() + 1 === month && calendar.getUTCDate() === day && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60;
}
export function getEarnedChallengeRequirements(value: unknown): EarnedAppTimeRequirements | null {
  if (value === 300) return { requiredActiveSeconds: 60, requiredSteps: 30, requiredDistinctPhotoTargets: 1 };
  if (value === 600 || value === 1200) return { requiredActiveSeconds: 120, requiredSteps: 60, requiredDistinctPhotoTargets: 2 };
  return null;
}
export function isEarnedAppTimeTemplateBinding(templateId: unknown, templateVersion: unknown, category: unknown, method: unknown, requestedSeconds: unknown): boolean {
  if (templateVersion !== 2 || !seconds(requestedSeconds) || typeof templateId !== 'string') return false;
  if(category==='find'&&method==='photo'){
    const suffix=`:earned-v2:${requestedSeconds}`;
    if(!templateId.startsWith('momentum-find-')||!templateId.endsWith(suffix))return false;
    const targets=templateId.slice('momentum-find-'.length,-suffix.length).split('-');
    const catalog=['flower','plant','chair','cup','shoe','branch','clock','fruit'];
    return targets.length===(requestedSeconds===300?1:2)&&targets.every(t=>catalog.includes(t))&&new Set(targets).size===targets.length&&(requestedSeconds===300||targets.join('-')===[...targets].sort().join('-')&&!targets.every(t=>['flower','plant','branch','fruit'].includes(t)));
  }
  const bases = category === 'breathe' && method === 'timer' ? ['momentum-breathe-soft', 'momentum-breathe-exhale'] :
    category === 'move' && method === 'timer' ? ['momentum-move-seated', 'momentum-move-stretch'] :
    category === 'move' && method === 'steps' ? ['momentum-move-steps'] :
    category === 'find' && method === 'photo' ? ['flower', 'plant', 'chair', 'cup', 'shoe', 'branch', 'clock', 'fruit'].map(target => `momentum-find-${target}`) : [];
  return bases.some(base => templateId === `${base}:earned-v2:${requestedSeconds}`);
}
export function isEarnedAppTimeOfferRequest(value: unknown): value is EarnedAppTimeOfferRequest {
  if (!record(value)) return false;
  return keys(value, ['version', 'policyVersion', 'nativeInterventionId', 'groupId', 'groupRevision', 'configurationGeneration', 'scopeEpoch', 'kind', 'requestedSeconds', value.kind === 'ios-app-group' ? 'tokenType' : 'packageName']) &&
    value.version === 2 && value.policyVersion === 2 && uuid(value.nativeInterventionId) && groupId(value.groupId) && integer(value.groupRevision, 1) && integer(value.configurationGeneration) && integer(value.scopeEpoch) && seconds(value.requestedSeconds) &&
    (value.kind === 'ios-app-group' && value.tokenType === 'application' || value.kind === 'android-app-group' && typeof value.packageName === 'string' && value.packageName.length <= 255 && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value.packageName));
}
export function isEarnedAppTimeGrantRequest(value: unknown): value is EarnedAppTimeGrantRequest {
  if (!record(value) || !keys(value, ['version', 'policyVersion', 'offerId', 'completionSessionId', 'category', 'templateId', 'templateVersion', 'evidence']) || value.version !== 2 || value.policyVersion !== 2 || !uuid(value.offerId) || !safeId(value.completionSessionId) || !safeId(value.templateId) || !integer(value.templateVersion, 1) || !record(value.evidence)) return false;
  const e = value.evidence;
  return keys(e, ['method', 'activeDurationSec', 'observedSteps', 'photoProofIds',...(e.method==='steps'?['stepProofId']:[])]) && (e.method!=='steps'||uuid(e.stepProofId)) && integer(e.activeDurationSec) && integer(e.observedSteps) && Array.isArray(e.photoProofIds) && e.photoProofIds.length<=2 && e.photoProofIds.every(uuid) && new Set(e.photoProofIds).size === e.photoProofIds.length &&
    (e.method==='photo'?e.observedSteps===0&&e.photoProofIds.length>0:e.photoProofIds.length===0) && (e.method==='timer'?e.observedSteps===0:e.activeDurationSec===0) &&
    (value.category === 'breathe' && e.method === 'timer' || value.category === 'move' && (e.method === 'timer' || e.method === 'steps') || value.category === 'find' && e.method === 'photo');
}
export function isAppGroupEarnedTimeUpdateRequest(value: unknown, platform: 'ios' | 'android'): value is AppGroupEarnedTimeUpdateRequest {
  if (!record(value) || !keys(value, ['version', 'expectedStoreRevision', 'id', 'expectedRevision', 'name', 'enabled', 'rule', 'packages', 'extraTimeCapMinutes', ...(Object.hasOwn(value, 'preferredBreakSeconds') ? ['preferredBreakSeconds'] : [])]) || value.version !== 2 || !isEarnedAppTimeCapMinutes(value.extraTimeCapMinutes) || Object.hasOwn(value, 'preferredBreakSeconds') && !seconds(value.preferredBreakSeconds)) return false;
  const { extraTimeCapMinutes: _, preferredBreakSeconds: __, ...v1Fields } = value;
  return !!validateAppGroupUpdate({ ...v1Fields, version: 1 }, platform);
}
export function validateEarnedAppTimeBudget(value: unknown): EarnedAppTimeBudget | null {
  if (!record(value) || !keys(value, ['version', 'configuredCapMinutes', 'effectiveCapMinutes', 'spentSeconds', 'remainingSeconds', 'dayKey', 'nextResetAt', 'pendingCapMinutes', 'pendingEffectiveAt', 'revision', 'clockState']) || value.version !== 2 || !isEarnedAppTimeCapMinutes(value.configuredCapMinutes) || !isEarnedAppTimeCapMinutes(value.effectiveCapMinutes) || !integer(value.spentSeconds) || !integer(value.remainingSeconds) || value.remainingSeconds !== Math.max(0, value.effectiveCapMinutes * 60 - value.spentSeconds) || !dayKey(value.dayKey) || !isEarnedAppTimeIsoDate(value.nextResetAt) || !integer(value.revision) || !['verified', 'unverified'].includes(value.clockState as string)) return null;
  if (value.pendingCapMinutes === null) {
    if (value.pendingEffectiveAt !== null || value.configuredCapMinutes !== value.effectiveCapMinutes) return null;
  } else if (!isEarnedAppTimeCapMinutes(value.pendingCapMinutes) || value.pendingCapMinutes <= value.effectiveCapMinutes || value.configuredCapMinutes !== value.pendingCapMinutes || !isEarnedAppTimeIsoDate(value.pendingEffectiveAt) || Date.parse(value.pendingEffectiveAt) !== Date.parse(value.nextResetAt)) return null;
  return value as EarnedAppTimeBudget;
}
export function isEarnedAppTimeOffer(value: unknown): value is EarnedAppTimeOffer {
  if (!record(value) || !keys(value, ['offerId', 'nativeInterventionId', 'groupId', 'groupRevision', 'configurationGeneration', 'scopeEpoch', 'kind', 'requestedSeconds', 'budgetDay', 'budgetRevision', 'validUntil', 'requiredActiveSeconds', 'requiredSteps', 'requiredDistinctPhotoTargets', 'availableMethods',...(Object.hasOwn(value,'supportedPhotoTargetIds')?['supportedPhotoTargetIds']:[])]) || !Array.isArray(value.availableMethods) || value.availableMethods.length === 0 || value.availableMethods.length > 3 || !value.availableMethods.every(method => ['timer', 'steps', 'photo'].includes(method)) || new Set(value.availableMethods).size !== value.availableMethods.length) return false;
  const photoTargets=value.supportedPhotoTargetIds;
  if(photoTargets!==undefined&&(!Array.isArray(photoTargets)||photoTargets.length>8||!photoTargets.every(t=>['flower','plant','chair','cup','shoe','branch','clock','fruit'].includes(t))||new Set(photoTargets).size!==photoTargets.length))return false;
  if(value.availableMethods.includes('photo')&&(!Array.isArray(photoTargets)||photoTargets.length<(value.requestedSeconds===300?1:2)||value.requestedSeconds!==300&&!photoTargets.some(t=>['chair','cup','shoe','clock'].includes(t))))return false;
  const required = getEarnedChallengeRequirements(value.requestedSeconds);
  return !!required && uuid(value.offerId) && uuid(value.nativeInterventionId) && groupId(value.groupId) && integer(value.groupRevision, 1) && integer(value.configurationGeneration) && integer(value.scopeEpoch) && (value.kind === 'ios-app-group' || value.kind === 'android-app-group') && dayKey(value.budgetDay) && integer(value.budgetRevision) && isEarnedAppTimeIsoDate(value.validUntil) && value.requiredActiveSeconds === required.requiredActiveSeconds && value.requiredSteps === required.requiredSteps && value.requiredDistinctPhotoTargets === required.requiredDistinctPhotoTargets;
}
export function unavailableEarnedAppTimeOffer(reason: string, supported = false, budget: EarnedAppTimeBudget | null = null): EarnedAppTimeOfferReceipt {
  return { version: 2, policyVersion: 2, supported, accepted: false, reason, offer: null, budget };
}
export function unavailableEarnedAppTimeGrant(reason: string, supported = false, budget: EarnedAppTimeBudget | null = null): EarnedAppTimeGrantReceipt {
  return { version: 2, policyVersion: 2, supported, accepted: false, reason, offerId: null, completionSessionId: null, groupId: null, nativeInterventionId: null, seconds: null, expiresAt: null, effective: false, remainingRestrictionCount: null, replayed: false, budget };
}
const envelope = (v: Record<string, unknown>) => v.version === 2 && v.policyVersion === 2 && typeof v.supported === 'boolean' && typeof v.accepted === 'boolean';
const reason = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256;
export function validateEarnedAppTimeOfferReceipt(value: unknown, request: EarnedAppTimeOfferRequest): EarnedAppTimeOfferReceipt | null {
  if (!isEarnedAppTimeOfferRequest(request) || !record(value) || !keys(value, ['version', 'policyVersion', 'supported', 'accepted', 'reason', 'offer', 'budget']) || !envelope(value) || value.budget !== null && !validateEarnedAppTimeBudget(value.budget)) return null;
  if (!value.accepted) return reason(value.reason) && value.offer === null ? value as EarnedAppTimeOfferReceipt : null;
  if (!value.supported || value.reason !== null || !isEarnedAppTimeOffer(value.offer) || !validateEarnedAppTimeBudget(value.budget)) return null;
  const offer = value.offer, budget = value.budget as EarnedAppTimeBudget;
  if (offer.nativeInterventionId !== request.nativeInterventionId || offer.groupId !== request.groupId || offer.groupRevision !== request.groupRevision || offer.configurationGeneration !== request.configurationGeneration || offer.scopeEpoch !== request.scopeEpoch || offer.kind !== request.kind || offer.requestedSeconds !== request.requestedSeconds || offer.budgetDay !== budget.dayKey || offer.budgetRevision !== budget.revision || budget.remainingSeconds < offer.requestedSeconds || budget.clockState !== 'verified') return null;
  return value as EarnedAppTimeOfferReceipt;
}
/** Successful receipts require the ORIGINAL live native offer. An ID alone cannot bind scope/duration. */
export function validateEarnedAppTimeGrantReceipt(value: unknown, request: EarnedAppTimeGrantRequest, offer: EarnedAppTimeOffer): EarnedAppTimeGrantReceipt | null {
  if (!isEarnedAppTimeGrantRequest(request) || !record(value) || !keys(value, ['version', 'policyVersion', 'supported', 'accepted', 'reason', 'offerId', 'completionSessionId', 'groupId', 'nativeInterventionId', 'seconds', 'expiresAt', 'effective', 'remainingRestrictionCount', 'replayed', 'budget']) || !envelope(value) || typeof value.effective !== 'boolean' || typeof value.replayed !== 'boolean' || value.budget !== null && !validateEarnedAppTimeBudget(value.budget)) return null;
  if (!value.accepted) return reason(value.reason) && value.offerId === null && value.completionSessionId === null && value.groupId === null && value.nativeInterventionId === null && value.seconds === null && value.expiresAt === null && value.effective === false && value.remainingRestrictionCount === null && value.replayed === false ? value as EarnedAppTimeGrantReceipt : null;
  if (!isEarnedAppTimeOffer(offer) || request.offerId !== offer.offerId || !isEarnedAppTimeTemplateBinding(request.templateId, request.templateVersion, request.category, request.evidence.method, offer.requestedSeconds) || !value.supported || value.reason !== null || value.offerId !== offer.offerId || value.completionSessionId !== request.completionSessionId || value.groupId !== offer.groupId || value.nativeInterventionId !== offer.nativeInterventionId || value.seconds !== offer.requestedSeconds || !isEarnedAppTimeIsoDate(value.expiresAt) || !integer(value.remainingRestrictionCount) || value.effective !== (value.remainingRestrictionCount === 0) || !validateEarnedAppTimeBudget(value.budget)) return null;
  const budget = value.budget as EarnedAppTimeBudget;
  if (budget.dayKey !== offer.budgetDay || budget.revision <= offer.budgetRevision || budget.spentSeconds < offer.requestedSeconds || budget.clockState !== 'verified') return null;
  if (Date.parse(value.expiresAt as string) > Date.parse(offer.validUntil) + offer.requestedSeconds * 1000) return null;
  if (!offer.availableMethods.includes(request.evidence.method) || request.evidence.method === 'timer' && request.evidence.activeDurationSec < offer.requiredActiveSeconds || request.evidence.method === 'steps' && (!uuid(request.evidence.stepProofId)||request.evidence.observedSteps < offer.requiredSteps)) return null;
  if(request.evidence.method==='photo'){
    const suffix=`:earned-v2:${offer.requestedSeconds}`,targets=request.templateId.slice('momentum-find-'.length,-suffix.length).split('-');
    if(request.evidence.photoProofIds.length!==offer.requiredDistinctPhotoTargets||!targets.every(t=>offer.supportedPhotoTargetIds?.includes(t)))return null;
  }
  return value as EarnedAppTimeGrantReceipt;
}
