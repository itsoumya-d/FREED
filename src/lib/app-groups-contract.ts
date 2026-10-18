/** Device-local group contract. iOS token data and labels never enter JavaScript/cloud. */
export type AppGroupRule =
  | { kind: 'before-use' }
  | { kind: 'daily-limit'; limitMinutes: number }
  | { kind: 'scheduled'; startMinute: number; endMinute: number; days: number[] }
  /** Native-only compatibility projection; clients cannot create this rule. */
  | { kind: 'legacy' };
export type WritableAppGroupRule = Exclude<AppGroupRule, { kind: 'legacy' }>;
export type InstalledGroupApp = { packageName: string; name: string; iconUri: string | null; eligible: boolean };
export type AppGroup = {
  preferredBreakSeconds?: import('../../modules/freed-protection/src/earned-app-time').EarnedAppTimeSeconds;
  extraTimeBudget?: import('../../modules/freed-protection/src/earned-app-time').EarnedAppTimeBudget;
  id: string; revision: number; name: string; enabled: boolean; rule: AppGroupRule;
  /** Android canonical package IDs; always empty on iOS. */
  packages: string[];
  draftApplicationCount?: number | null;
  applicationCount: number; categoryCount: number; webDomainCount: number;
  legacy: boolean; configured: boolean; ready: boolean; active: boolean;
  thresholdReached: boolean; unavailablePackages: string[];
  usageMinutes: number | null; nextBoundaryAt: string | null;
  break: { interventionId: string; expiresAt: string; effective: boolean; remainingRestrictionCount: number } | null;
};
export type AppGroupsSnapshot = {
  supportedBreakSeconds?: import('../../modules/freed-protection/src/earned-app-time').EarnedAppTimeSeconds[];
  configuredGroupCount?: number;
  version: 1; supported: boolean; platform: 'ios' | 'android' | 'unsupported'; revision: number;
  configurationGeneration: number; scopeEpoch: number; groups: AppGroup[];
  permissions: { authorized: boolean; usageAccess: boolean; runtimeConnected: boolean };
  monitorBudget: { used: number; limit: number }; maxGroups: 6;
  legacyCompatibility: { retained: boolean; applicationCount: number; categoryCount: number; webDomainCount: number };
  reason: string | null;
};
export type AppGroupActionDiagnostics = {
  version: 1; operation: 'create' | 'update' | 'update-earned' | 'remove' | 'picker'; operationId: string;
  stage: 'unavailable' | 'owner-binding' | 'app-group-container' | 'lock-open' | 'lock-acquire' | 'execution-assertion' | 'nested-transaction' | 'state-read' | 'state-commit' | 'request-validation' | 'clock-validation' | 'monitor-registration' | 'monitor-readback' | 'policy-readback' | 'bridge-validation' | 'bridge-readback' | 'native-operation' | 'complete';
  reason: string | null; configurationGeneration: number | null; storeRevision: number | null; groupRevision: number | null;
  errorCode: number | null; errorDomain: string | null;
  /** App-only public availability facts at action receipt time; omitted by older binaries. */
  protectedDataAvailable?: boolean | null; containerAvailable?: boolean | null;
  clockBootAvailable?: boolean; clockWallValid?: boolean; clockUptimeValid?: boolean; clockCalendarValid?: boolean;
  clockBootSource?: 'kernel-uuid' | 'kernel-boottime' | 'unavailable' | 'injected';
  clockBootStage?: 'uuid-size' | 'uuid-read' | 'uuid-value' | 'boottime-read' | 'boottime-size' | 'boottime-value' | 'complete' | 'unsupported' | 'injected';
  clockPrimaryStage?: 'uuid-size' | 'uuid-read' | 'uuid-value' | 'complete' | 'injected';
  clockBootErrno?: number | null; clockPrimaryErrno?: number | null;
  clockBudgetPhase?: 'bootstrap' | 'rollover';
};
export type AppGroupReceipt = { accepted: boolean; reason: string | null; cancelled?: boolean; snapshot: AppGroupsSnapshot; diagnostics?: AppGroupActionDiagnostics };
export type AppGroupSelectionDiscardReceipt = AppGroupReceipt & {
  operation: 'discard-pending-selection'; targetId: string | null; pendingSelectionDiscarded: boolean;
  diagnostics?: { stage: string; reason?: string | null; configurationGeneration?: number | null; errorCode?: number | null; errorDomain?: string | null };
};
export type AppGroupCreateRequest = { version: 1; expectedStoreRevision: number; name: string };
export type AppGroupUpdateRequest = {
  version: 1; expectedStoreRevision: number; id: string; expectedRevision: number;
  name: string; enabled: boolean; rule: WritableAppGroupRule; packages: string[];
};
export type AppGroupTargetRequest = { version: 1; expectedStoreRevision: number; id: string; expectedRevision: number };
export type InstalledGroupAppsPage = { supported: boolean; apps: InstalledGroupApp[]; total: number; nextOffset: number | null; reason: string | null };
