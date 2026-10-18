export type AppGroupInterventionScope = { groupId: string; groupRevision: number; configurationGeneration: number; scopeEpoch: number } &
  ({ kind: 'android-app-group'; packageName: string } | { kind: 'ios-app-group'; tokenType: 'application' });
export function canonicalInstalledAppPackage(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 255 && value === value.trim() && /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(value) ? value : null;
}
/** Native UUID+revision authority remains in memory. A URL/package/name alone is never a group claim. */
export function sanitizeAppGroupInterventionScope(value: unknown): AppGroupInterventionScope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const s = value as AppGroupInterventionScope;
  if (typeof s.groupId !== 'string' || !(s.groupId === 'legacy-default' || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s.groupId)) ||
    !Number.isSafeInteger(s.groupRevision) || s.groupRevision < 1 || !Number.isSafeInteger(s.configurationGeneration) || s.configurationGeneration < 0 || !Number.isSafeInteger(s.scopeEpoch) || s.scopeEpoch < 0) return null;
  const base = { groupId:s.groupId, groupRevision:s.groupRevision, configurationGeneration:s.configurationGeneration, scopeEpoch:s.scopeEpoch };
  if (s.kind === 'android-app-group' && canonicalInstalledAppPackage(s.packageName)) return { ...base, kind:s.kind, packageName:s.packageName };
  if (s.kind === 'ios-app-group' && s.tokenType === 'application') return { ...base, kind:s.kind, tokenType:'application' };
  return null;
}
export function confirmedAppGroupGrant(scope: AppGroupInterventionScope, interventionId: string, expiresAt: string, evidence: {
  nativeUnlockGrantAccepted?: boolean; nativeUnlockGrantInterventionId?: string | null; appGroupBreakGroupId?: string; appGroupBreakRevision?: number;
  appGroupBreakEffective?: boolean; appGroupRemainingRestrictionCount?: number; activeUnlockInterventionId?: string | null; activeUnlockExpiresAt?: string | null; activeUnlockSourcePackage?: string | null;
}): 'effective' | 'restricted' | null {
  if (!sanitizeAppGroupInterventionScope(scope) || evidence.nativeUnlockGrantAccepted !== true || evidence.nativeUnlockGrantInterventionId !== interventionId ||
    evidence.appGroupBreakGroupId !== scope.groupId || evidence.appGroupBreakRevision !== scope.groupRevision || !Number.isSafeInteger(evidence.appGroupRemainingRestrictionCount) || evidence.appGroupRemainingRestrictionCount! < 0) return null;
  if (evidence.appGroupBreakEffective === false && evidence.appGroupRemainingRestrictionCount! > 0) return 'restricted';
  const expiry = Date.parse(expiresAt);
  if (evidence.appGroupBreakEffective !== true || evidence.appGroupRemainingRestrictionCount !== 0 || evidence.activeUnlockInterventionId !== interventionId ||
    !Number.isFinite(expiry) || Date.parse(evidence.activeUnlockExpiresAt ?? '') !== expiry ||
    (scope.kind === 'android-app-group' && evidence.activeUnlockSourcePackage !== scope.packageName)) return null;
  return 'effective';
}
