/** Versioned native grant request. No caller-controlled duration or expiry. */
export type ResetAppGroupRewardRequest = {
  version: 1; policyVersion: 1; category: 'breathe' | 'move' | 'find';
  completionSessionId: string; templateId: string; templateVersion: number;
  nativeInterventionId: string; groupId: string; groupRevision: number;
  configurationGeneration: number; scopeEpoch: number;
} & ({ kind: 'ios-app-group'; tokenType: 'application' } | { kind: 'android-app-group'; packageName: string });
export type ResetAppGroupRewardReceipt = {
  version: 1; policyVersion: 1; supported: boolean; accepted: boolean; reason: string | null;
  completionSessionId: string | null; nativeInterventionId: string | null;
  category: 'breathe' | 'move' | 'find' | null; seconds: 120 | 300 | null;
  groupId: string | null; groupRevision: number | null; configurationGeneration: number | null; scopeEpoch: number | null;
  expiresAt: string | null; effective: boolean; remainingRestrictionCount: number | null; replayed: boolean;
};
const safeId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(v);
const groupId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function isResetAppGroupRewardRequest(value: unknown): value is ResetAppGroupRewardRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const fields = ['version','policyVersion','category','completionSessionId','templateId','templateVersion','nativeInterventionId','groupId','groupRevision','configurationGeneration','scopeEpoch','kind',v.kind === 'ios-app-group' ? 'tokenType' : 'packageName'];
  return Object.keys(v).length === fields.length && Object.keys(v).every(k => fields.includes(k)) && v.version === 1 && v.policyVersion === 1 &&
    ['breathe','move','find'].includes(v.category as string) && safeId(v.completionSessionId) && safeId(v.templateId) && integer(v.templateVersion,1) &&
    uuid(v.nativeInterventionId) && groupId(v.groupId) && integer(v.groupRevision,1) && integer(v.configurationGeneration) && integer(v.scopeEpoch) &&
    (v.kind === 'ios-app-group' && v.tokenType === 'application' || v.kind === 'android-app-group' && typeof v.packageName === 'string' && /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(v.packageName) && v.packageName.length <= 255);
}
export function unavailableResetAppGroupReward(reason: string, supported = false): ResetAppGroupRewardReceipt {
  return {version:1,policyVersion:1,supported,accepted:false,reason,completionSessionId:null,nativeInterventionId:null,category:null,seconds:null,groupId:null,groupRevision:null,configurationGeneration:null,scopeEpoch:null,expiresAt:null,effective:false,remainingRestrictionCount:null,replayed:false};
}
export function validateResetAppGroupRewardReceipt(value: unknown, request: ResetAppGroupRewardRequest): ResetAppGroupRewardReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v=value as Record<string,unknown>;
  if (v.version!==1 || v.policyVersion!==1 || typeof v.supported!=='boolean' || typeof v.accepted!=='boolean' || typeof v.effective!=='boolean' || typeof v.replayed!=='boolean') return null;
  if (!v.accepted) return typeof v.reason==='string' && v.reason.length>0 ? unavailableResetAppGroupReward(v.reason,v.supported):null;
  const seconds=request.category==='breathe'?120:300;
  if (!v.supported || v.reason!==null || v.completionSessionId!==request.completionSessionId || v.nativeInterventionId!==request.nativeInterventionId ||
    v.category!==request.category || v.seconds!==seconds || v.groupId!==request.groupId || v.groupRevision!==request.groupRevision ||
    v.configurationGeneration!==request.configurationGeneration || v.scopeEpoch!==request.scopeEpoch || typeof v.expiresAt!=='string' || !Number.isFinite(Date.parse(v.expiresAt)) ||
    !integer(v.remainingRestrictionCount) || v.effective!==(v.remainingRestrictionCount===0)) return null;
  return v as ResetAppGroupRewardReceipt;
}
