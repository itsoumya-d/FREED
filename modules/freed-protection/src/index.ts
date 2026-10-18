import { createRecoveryDnsPilotAdapter, type RecoveryDnsPilotInput } from './recovery-dns-pilot';
export type { RecoveryDnsPilotInput, RecoveryDnsPilotReceipt } from './recovery-dns-pilot';
import {validateSafariRecoveryObservation, unavailableSafariRecoveryObservation, type SafariRecoveryObservation} from './safari-recovery-observation';
import { validateProtectionStatus, unavailableProtectionStatus, nativeStatusReadError, type ProtectionAuthorizationOutcome, type ProtectionStatusReadError } from './protection-status-contract';
export type { ProtectionAuthorizationOutcome, ProtectionStatusReadError } from './protection-status-contract';
export type {SafariRecoveryObservation, SafariObservationReceipt, SafariObservationFacts} from './safari-recovery-observation';
import { createDeviceAdultAdapter, type DeviceAdultNative } from './device-adult';
export type { DeviceAdultStatus, DeviceAdultOperation, DeviceAdultRotation, DeviceAdultEnrollment, DeviceAdultError, DeviceAdultAction, DeviceAdultPrepare } from './device-adult';
import {nativeAccountUUID,validateNativeAccountPreparation, validateNativeAccountBinding, validateNativeCleanupReceipt, type NativeAccountBinding, type NativeAccountSessionDriver, type NativeCleanupReceipt} from './native-account-contract';
export type {NativeAccountAdmission,NativeAccountBinding,NativeAccountSessionDriver,NativeCleanupReceipt} from './native-account-contract';
import { isResetAppGroupRewardRequest, validateResetAppGroupRewardReceipt, unavailableResetAppGroupReward, type ResetAppGroupRewardRequest, type ResetAppGroupRewardReceipt } from './reset-app-group-reward';
import { isEarnedChallengeEvidenceBeginRequest, isEarnedChallengeEvidenceReadRequest, isEarnedChallengeEvidencePhaseRequest, isEarnedChallengePhotoCaptureRequest, isEarnedChallengeEvidenceSession, earnedEvidenceBeginFromSession, validateEarnedChallengeEvidenceReceipt, unavailableEarnedChallengeEvidence, earnedPhotoTemplateTargets, type EarnedChallengeEvidenceBeginRequest, type EarnedChallengeEvidenceReadRequest, type EarnedChallengeEvidencePhaseRequest, type EarnedChallengePhotoRequest, type EarnedChallengePhotoCaptureRequest, type EarnedChallengeEvidenceSession, type EarnedChallengeEvidenceReceipt } from './earned-challenge-evidence';
export { validateEarnedChallengeEvidenceReceipt, isEarnedChallengeEvidenceSession } from './earned-challenge-evidence';
export type { EarnedChallengeEvidenceBeginRequest, EarnedChallengeEvidenceReadRequest, EarnedChallengeEvidencePhaseRequest, EarnedChallengePhotoRequest, EarnedChallengePhotoCaptureRequest, EarnedChallengeEvidenceSession, EarnedChallengeEvidenceReceipt } from './earned-challenge-evidence';
import { isEarnedAppTimeOffer, isEarnedAppTimeTemplateBinding, isEarnedAppTimeOfferRequest, isEarnedAppTimeGrantRequest, isAppGroupEarnedTimeUpdateRequest, validateEarnedAppTimeOfferReceipt, validateEarnedAppTimeGrantReceipt, validateEarnedAppTimeBudget, unavailableEarnedAppTimeOffer, unavailableEarnedAppTimeGrant, type EarnedAppTimeOfferRequest, type EarnedAppTimeOffer, type EarnedAppTimeOfferReceipt, type EarnedAppTimeGrantRequest, type EarnedAppTimeGrantReceipt, type AppGroupEarnedTimeUpdateRequest } from './earned-app-time';
export type { EarnedAppTimeOfferRequest, EarnedAppTimeOffer, EarnedAppTimeOfferReceipt, EarnedAppTimeGrantRequest, EarnedAppTimeGrantReceipt, EarnedAppTimeBudget, AppGroupEarnedTimeUpdateRequest } from './earned-app-time';
export type { ResetAppGroupRewardRequest, ResetAppGroupRewardReceipt } from './reset-app-group-reward';
import { validateAppGroupBindingReceipt, type AppGroupBindingReceipt } from './app-group-binding';
export { validateAppGroupBindingReceipt, isAppGroupBindingConfirmed } from './app-group-binding';
export type { AppGroupBindingReceipt, AppGroupBindingStage } from './app-group-binding';
import type { AppGroupInterventionScope } from '../../../src/lib/app-group-intervention';
import { validateAppGroupsSnapshot, validateAppGroupReceipt, validateAppGroupActionDiagnostics, isAppGroupMutationConfirmed } from '../../../src/lib/protection-groups';
import { validateAppGroupSelectionDiscardReceipt } from '../../../src/lib/app-group-selection-discard';
import { normalizeWebsiteHandoffReceipt } from '../../../src/lib/website-protection-operations';
import type { AppGroupSelectionDiscardReceipt } from '../../../src/lib/app-groups-contract';
export type { AppGroupSelectionDiscardReceipt } from '../../../src/lib/app-groups-contract';
import type { AppGroupsSnapshot, AppGroupReceipt, AppGroupCreateRequest, AppGroupUpdateRequest, AppGroupTargetRequest, InstalledGroupAppsPage } from '../../../src/lib/app-groups-contract';
export type { AppGroupsSnapshot, AppGroup, AppGroupReceipt, AppGroupCreateRequest, AppGroupUpdateRequest, AppGroupTargetRequest, InstalledGroupApp, InstalledGroupAppsPage } from '../../../src/lib/app-groups-contract';
import { readPhotoCapabilities, readPhotoClassification, unavailablePhoto, type PhotoCapabilities, type PhotoClassification } from "../../../src/lib/challenge-photo-contract";
import { requireNativeModule, type EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";
import { sanitizeAppScheduleConfiguration, type AppScheduleConfiguration } from "../../../src/lib/app-schedules";
import { normalizeEncryptedDnsStatus, unavailableEncryptedDnsStatus } from "../../../src/lib/encrypted-dns";
import type { EncryptedDnsConfiguration, EncryptedDnsStatus } from "../../../src/lib/encrypted-dns";
import { sanitizeFocusShieldInterventionScope, sanitizeFocusShieldRule } from "../../../src/lib/focus-shield";
import type {
  FocusShieldCalibrationRequest,
  FocusShieldCalibrationResult,
  FocusShieldInterventionScope,
  FocusShieldRule
} from "../../../src/lib/focus-shield";

export type {
  FocusShieldCalibrationRequest,
  FocusShieldCalibrationState,
  FocusShieldCalibrationResult
} from "../../../src/lib/focus-shield";

export type { EncryptedDnsConfiguration, EncryptedDnsProvider, EncryptedDnsStatus } from "../../../src/lib/encrypted-dns";
export type { AppSchedule, AppScheduleConfiguration } from "../../../src/lib/app-schedules";

export type AppGuardMode = 'before-use' | 'daily-limit' | 'scheduled';

export type ProtectionCapability = {
  platform: "ios" | "android" | "web" | "unknown";
  screenTime: boolean;
  managedSettings: boolean;
  accessibility: boolean;
  /** Build capability only; runtime rollout and permission are separate facts. */
  focusShieldSurfaceInspection?: boolean;
  dnsFiltering: boolean;
  usageStats?: boolean;
  /** Binary capability; configured schedules and connected service are separate. */
  appSchedules?: boolean;
  /** Binary API support; permission, targets and installed enforcement are separate. */
  appGuardModes?: boolean;
  appGroups?: boolean;
  installedApps?: boolean;
  appGroupTokenLabels?: boolean;
  safariContentBlocker?: boolean;
  safariExtensionSettings?: boolean;
  localVpnFallback: boolean;
  notes: string[];
};

export type ProtectionStatus = {
  statusReadAccepted?: boolean;
  statusReadError?: ProtectionStatusReadError;
  statusVisibility?: 'account' | 'device';
  authorizationOutcome?: ProtectionAuthorizationOutcome;
  authorizationErrorDomain?: string;
  authorizationErrorCode?: number;
  /** Validated device-only historical configuration; never protection or grant authority. */
  safariRecoveryObservation?: SafariRecoveryObservation;
  settingsHandoff?: import('../../../src/lib/website-protection-operations').WebsiteHandoffReceipt;
  websiteHandoff?: import('../../../src/lib/website-protection-operations').WebsiteHandoffReceipt;
  authorized: boolean;
  active: boolean;
  adultFilterActive?: boolean;
  appGroupBreakGroupId?: string;
  appGroupBreakRevision?: number;
  appGroupBreakEffective?: boolean;
  appGroupRemainingRestrictionCount?: number;
  /** Saved intent, separate from observed ManagedSettings and real browsing. */
  adultFilterRequested?: boolean;
  /** Observed automatic ManagedSettings web policy, not browsing proof. */
  adultWebPolicyConfigured?: boolean;
  hostedModeRetained?: boolean;
  adultProtectionMode?: 'hosted-recovery-dns' | 'apple-auto';
  /** Explicit acknowledgement on the apply operation only. */
  adultWebPolicyOperationAccepted?: boolean;
  adultWebPolicyReason?: string | null;
  adultWebPolicyDiagnostics?: { stage: string; appGroupContainerAvailable: boolean; configurationGeneration: number | null; protectedDataAvailable?: boolean | null; posixErrorCode?: number | null };
  nativeConfigurationDiagnostics?: { stage: string; reason?: string | null; configurationGeneration?: number | null; errorCode?: number | null; errorDomain?: string | null };
  nativeConfigurationOperationAccepted?: boolean;
  nativeConfigurationError?: string;
  appInterventionAuthorized?: boolean;
  usageStatsAuthorized?: boolean;
  usageStatsObservedPackages?: number;
  usageStatsObservedPackageNames?: string[];
  usageStatsTodayMinutes?: number;
  usageStatsTodayMinutesByPackage?: Record<string, number>;
  scheduled?: boolean;
  appSchedulesSupported?: boolean;
  appSchedulesConfigured?: boolean;
  appSchedulesServiceConnected?: boolean;
  activeAppScheduleIds?: string[];
  activeAppSchedulePackageCount?: number;
  nextAppScheduleBoundaryAt?: string;
  appSchedulesConfigurationAccepted?: boolean;
  appGuardMode?: AppGuardMode;
  appGuardModeConfigurationAccepted?: boolean;
  appGuardModeConfigurationError?: string;
  appGuardReady?: boolean;
  strictAppGuardEnabled?: boolean;
  strictAppGuardActive?: boolean;
  /** Explicit reset-call result; ordinary status never confirms destructive cleanup. */
  protectionConfigurationResetAccepted?: boolean;
  protectionConfigurationResetError?: string;
  protectionConfigurationResetDisabled?: boolean;
  /** Explicit user activation commits intent; native permission/runtime remain separate. */
  protectionConfigurationActivationAccepted?: boolean;
  appLimitScheduled?: boolean;
  selectedApplications?: number;
  selectedCategories?: number;
  selectedWebDomains?: number;
  selectedScreenTimeTokenCount?: number;
  selectedShieldsPausedForEarnedUnlock?: boolean;
  adultFilterStaysActiveDuringEarnedUnlock?: boolean;
  blockedApplications?: number;
  dailyLimitMinutes?: number;
  appLimitActivityName?: string;
  appLimitEventName?: string;
  earnedUnlockActivityName?: string;
  appLimitReachedToday?: boolean;
  appLimitReachedDate?: string;
  shortFormInterruptionSeconds?: number;
  focusShieldSurfaceReleaseEnabled?: boolean;
  focusShieldSurfaceEnabled?: boolean;
  focusShieldSurfaceReason?: "release-gated" | "rollout-disabled" | "permission-required" | "ready";
  focusShieldRuleCount?: number;
  focusShieldEnabledRuleCount?: number;
  focusShieldRuleStoreHealth?: "empty" | "ready" | "degraded";
  activeFocusShieldUnlockExpiresAt?: string;
  activeFocusShieldUnlockRuleId?: string;
  activeFocusShieldUnlockPackageName?: string;
  activeFocusShieldUnlockInterventionId?: string;
  activeUnlockExpiresAt?: string;
  activeUnlockSourcePackage?: string;
  activeUnlockInterventionId?: string;
  /** Grant-call acknowledgment; getter health alone never issues access. */
  nativeUnlockGrantAccepted?: boolean;
  nativeUnlockGrantInterventionId?: string;
  vpnConsentRequired?: boolean;
  vpnConsentLaunchRoute?: string;
  privateDnsMode?: "off" | "opportunistic" | "hostname" | "unknown";
  privateDnsSpecifier?: string;
  privateDnsActive?: boolean;
  dnsGuardCoverageReady?: boolean;
  dnsGuardCoverageIssueCode?: string;
  androidSettingsRoutes?: string[];
  androidSettingsRouteOpened?: string;
  androidSettingsRouteComponent?: string;
  androidSettingsRouteLabel?: string;
  androidSettingsRouteInstruction?: string;
  androidSettingsFallbackUsed?: boolean;
  androidSettingsRouteError?: string;
  androidSettingsRouteOpenedAt?: string;
  androidNotificationPermissionRequired?: boolean;
  androidNotificationPermissionGranted?: boolean;
  androidUsageAccessConfigActivity?: string;
  androidUsageAccessReason?: string;
  dnsGuardResolverCount?: number;
  dnsGuardLastResolver?: string;
  dnsGuardLastForwardFailure?: string;
  dnsGuardStartedAtElapsedMs?: number;
  dnsGuardUptimeMs?: number;
  dnsGuardLastStopReason?: string;
  dnsGuardLastSessionDurationMs?: number;
  dnsGuardStartCount?: number;
  dnsGuardStopCount?: number;
  dnsGuardPacketsRead?: number;
  dnsGuardSessionQueries?: number;
  dnsGuardAllowedQueries?: number;
  dnsGuardBlockedQueries?: number;
  dnsGuardServfailResponses?: number;
  dnsGuardMalformedPackets?: number;
  dnsGuardIpv6MalformedPackets?: number;
  dnsGuardIpv6UnsupportedPackets?: number;
  /** Installed current-network resolver host routes; service readiness is separate. */
  dnsGuardIpv4ResolverRouteCount?: number;
  dnsGuardIpv6ResolverRouteCount?: number;
  dnsGuardRuntimeReady?: boolean;
  dnsGuardRuntimeIssue?: string;
  dnsGuardUserEnabled?: boolean;
  dnsGuardAutoRestartEligible?: boolean;
  dnsGuardLastAutoRestartAction?: string;
  dnsGuardLastAutoRestartAt?: string;
  dnsGuardLastAutoRestartResult?: "started" | "skipped" | "failed" | string;
  dnsGuardLastAutoRestartSkipReason?: string;
  dnsGuardCaptivePaused?: boolean;
  dnsGuardNetworkResolverCount?: number;
  dnsGuardAvgForwardMs?: number;
  dnsGuardDroppedQueries?: number;
  dnsGuardTcpFastFails?: number;
  dnsGuardNetworkFallbackHits?: number;
  otherVpnActive?: boolean;
  alwaysOnVpnPackage?: string;
  fullScreenIntentsEnabled?: boolean;
  adultDomainFeedVersion?: string;
  adultDomainFeedChecksum?: string;
  adultDomainFeedDomainCount?: number;
  userAllowedDomainCount?: number;
  safariContentBlockerVersion?: string;
  safariContentBlockerChecksum?: string;
  safariContentBlockerRuleCount?: number;
  safariContentBlockerEnabled?: boolean;
  safariContentBlockerStateCheckedAt?: string;
  safariContentBlockerStateError?: string;
  safariContentBlockerLastReloadError?: string;
  safariExtensionSettingsAvailable?: boolean;
  safariExtensionSettingsOpened?: boolean;
  safariExtensionSettingsRoute?: "extension" | "app-settings" | "none";
  safariExtensionSettingsTarget?: SafariExtensionSettingsTarget;
  safariExtensionSettingsError?: string;
  mode: "screen-time" | "accessibility" | "dns" | "vpn-fallback" | "prototype";
  message: string;
};

export type IOSScreenTimeInterventionScope = {kind:'ios-screen-time';tokenType:'application'|'category'|'domain'};
export type PendingIntervention = {
  interventionId: string;
  url: string;
  host: string;
  sourcePackage: string;
  reason: string;
  matchedRule: string;
  detectedAt: string;
  sessionDurationSec?: number;
  scope?: FocusShieldInterventionScope | AppGroupInterventionScope | IOSScreenTimeInterventionScope;
};

export type FocusShieldRuleOperationResult = {
  available: boolean;
  rule: FocusShieldRule | null;
  message: string;
};

export type ChallengePhotoClassification = PhotoClassification;
export type ChallengePhotoCapabilities = PhotoCapabilities;

export type ProtectionActivationDiagnostics = {
  platform: "ios" | "android" | "web" | "unknown";
  checkedNativeLayer: boolean;
  nativeChecksPassed: boolean;
  adultBlocked: boolean;
  normalAllowed: boolean;
  message: string;
  issues: string[];
  issueCodes?: string[];
  adultMatchedRule?: string;
  normalMatchedRule?: string;
  dnsGuardActive?: boolean;
  dnsGuardRuntimeReady?: boolean;
  dnsGuardRuntimeIssue?: string;
  vpnConsentRequired?: boolean;
  androidNotificationPermissionRequired?: boolean;
  androidNotificationPermissionGranted?: boolean;
  appInterventionAuthorized?: boolean;
  usageStatsAuthorized?: boolean;
  usageStatsObservedPackages?: number;
  usageStatsObservedPackageNames?: string[];
  usageStatsTodayMinutes?: number;
  usageStatsTodayMinutesByPackage?: Record<string, number>;
  blockedApplications?: number;
  androidSettingsRoutes?: string[];
  androidSettingsRouteOpened?: string;
  androidSettingsRouteComponent?: string;
  androidSettingsRouteLabel?: string;
  androidSettingsRouteInstruction?: string;
  androidSettingsFallbackUsed?: boolean;
  androidSettingsRouteError?: string;
  androidSettingsRouteOpenedAt?: string;
  privateDnsMode?: "off" | "opportunistic" | "hostname" | "unknown";
  privateDnsSpecifier?: string;
  privateDnsActive?: boolean;
  dnsGuardCoverageReady?: boolean;
  dnsGuardCoverageIssueCode?: string;
  dnsGuardResolverCount?: number;
  dnsGuardLastResolver?: string;
  dnsGuardLastForwardFailure?: string;
  dnsGuardUptimeMs?: number;
  dnsGuardSessionQueries?: number;
  dnsGuardAllowedQueries?: number;
  dnsGuardBlockedQueries?: number;
  dnsGuardServfailResponses?: number;
  dnsGuardMalformedPackets?: number;
  dnsGuardIpv6MalformedPackets?: number;
  dnsGuardIpv6UnsupportedPackets?: number;
  /** Installed current-network resolver host routes; service readiness is separate. */
  dnsGuardIpv4ResolverRouteCount?: number;
  dnsGuardIpv6ResolverRouteCount?: number;
  dnsGuardUserEnabled?: boolean;
  dnsGuardAutoRestartEligible?: boolean;
  dnsGuardLastAutoRestartAction?: string;
  dnsGuardLastAutoRestartAt?: string;
  dnsGuardLastAutoRestartResult?: "started" | "skipped" | "failed" | string;
  dnsGuardLastAutoRestartSkipReason?: string;
  dnsGuardCaptivePaused?: boolean;
  otherVpnActive?: boolean;
  adultDomainFeedVersion?: string;
  adultDomainFeedChecksum?: string;
  adultDomainFeedDomainCount?: number;
  safariContentBlockerVersion?: string;
  safariContentBlockerRuleCount?: number;
  safariContentBlockerEnabled?: boolean;
  safariContentBlockerStateError?: string;
};

type NativeFreedProtection = DeviceAdultNative & {
  cancelAccountSessionResources?:(binding:string,evidenceSessionId:string,captureOperationId:string)=>Promise<unknown>;
  FreedAccountBindingSession?:new()=>{release:()=>void};
  prepareAccountBindingV2?:(session:object,scope:string,transition:string,sequence:number)=>unknown;
  commitAccountBindingV2?:(session:object,ticket:string)=>unknown;
  prepareAccountProtectionCleanup?:(scope:string,handle:string)=>unknown;
  executeAccountProtectionCleanup?:(operationId:string)=>unknown;
  getAccountProtectionCleanup?:(operationId:string)=>unknown;
  getSafariRecoveryObservation?(): Promise<unknown>;
  stageRecoveryDnsPilot?(input:RecoveryDnsPilotInput):Promise<unknown>;
  getRecoveryDnsPilotStatus?(scope:string):Promise<unknown>;
  checkRecoveryDnsPilot?(reference:string,scope:string):Promise<unknown>;
  prepareRecoveryDnsReplacement?(reference:string,scope:string):Promise<unknown>;
  prepareRecoveryDnsModeActivation?(reference:string,scope:string):Promise<unknown>;
  getWebsiteRecoveryProbe?(): Promise<unknown>;
  getShieldRuntimeDiagnostics?(): Promise<unknown>;
  mutateWebsiteRecoveryProbe?(operation:string,revision:number,generation:number,epoch:number): Promise<unknown>;
  presentWebsiteRecoveryProbePicker?(revision:number): Promise<unknown>;
  probeRawWebsiteTokenAvailability?(): Promise<unknown>;
  beginEarnedChallengeEvidence?(request:EarnedChallengeEvidenceBeginRequest,scope:string):Promise<unknown>;
  setEarnedChallengeEvidencePhase?(request:EarnedChallengeEvidencePhaseRequest,scope:string):Promise<unknown>;
  getEarnedChallengeEvidence?(request:EarnedChallengeEvidenceReadRequest,scope:string):Promise<unknown>;
  verifyEarnedChallengePhoto?(request:EarnedChallengePhotoRequest,scope:string):Promise<unknown>;
  captureEarnedChallengePhoto?(request:EarnedChallengePhotoCaptureRequest,scope:string):Promise<unknown>;
  finishEarnedChallengeEvidence?(request:EarnedChallengeEvidenceReadRequest,scope:string):Promise<unknown>;
  prepareEarnedAppTimeOffer?(request: EarnedAppTimeOfferRequest, scope: string): Promise<unknown>;
  grantEarnedAppTimeBreak?(request: EarnedAppTimeGrantRequest, scope: string): Promise<unknown>;
  getEarnedAppTimeGrant?(request: EarnedAppTimeGrantRequest, scope: string): Promise<unknown>;
  updateAppGroupWithEarnedTime?(request: AppGroupEarnedTimeUpdateRequest, scope: string): Promise<unknown>;
  grantResetAppGroupBreak?(request: ResetAppGroupRewardRequest, scope: string): Promise<unknown>;
  getAppGroups?(scope: string): Promise<AppGroupsSnapshot>;
  suspendAppGroupOperations?(scope:string): Promise<boolean> | boolean;
  setAppGroupActionScope?(scope: string): Promise<unknown> | unknown;
  createAppGroup?(request: AppGroupCreateRequest, scope: string): Promise<AppGroupReceipt>;
  updateAppGroup?(request: AppGroupUpdateRequest, scope: string): Promise<AppGroupReceipt>;
  removeAppGroup?(request: AppGroupTargetRequest, scope: string): Promise<AppGroupReceipt>;
  discardPendingAppGroupSelection?(request: AppGroupTargetRequest, scope: string): Promise<unknown>;
  presentAppGroupPicker?(request: AppGroupTargetRequest, scope: string, header: string, footer: string): Promise<AppGroupReceipt>;
  getInstalledGroupApps?(query: string, offset: number, limit: number, scope:string): Promise<InstalledGroupAppsPage>;
  configureAppGuardMode?(mode: AppGuardMode): Promise<ProtectionStatus>;
  configureAppSchedules?(configuration: AppScheduleConfiguration): Promise<ProtectionStatus>;
  resetProtectionConfiguration?(): Promise<ProtectionStatus>;
  activateProtectionConfiguration?(): Promise<ProtectionStatus>;
  getEncryptedDnsStatus?(): Promise<EncryptedDnsStatus>;
  configureEncryptedDns?(configuration: EncryptedDnsConfiguration): Promise<EncryptedDnsStatus>;
  setPresentationPreferences?(configuration: { language: string; themeMode: "system" | "light" | "dark"; languagePreference?: string }): boolean;
  getCapabilities(): Promise<ProtectionCapability>;
  getStatus(): Promise<ProtectionStatus>;
  getStatusV2?(session: object, actionScope: string): Promise<unknown>;
  getDevicePublicStatus?(): Promise<unknown>;
  requestAuthorization(): Promise<ProtectionStatus>;
  openUsageAccessSettings?(): Promise<ProtectionStatus>;
  openAndroidNotificationSettings?(): Promise<ProtectionStatus>;
  openPrivateDnsSettings?(): Promise<ProtectionStatus>;
  openVpnSettings?(): Promise<ProtectionStatus>;
  applyAdultContentFilter(): Promise<ProtectionStatus>;
  stopAdultContentFilter?(): Promise<ProtectionStatus>;
  configureBlockedAppPackages?(
    packages: string[],
    dailyLimitMinutes?: number,
    shortFormInterruptionSeconds?: number
  ): Promise<ProtectionStatus>;
  configureAdultDomainFeed?(domains: string[], version: string, checksum: string, generatedAt: string): Promise<ProtectionStatus>;
  configureUserAllowedDomains?(domains: string[]): Promise<ProtectionStatus>;
  configureSafariContentBlockerRules?(rulesJson: string, version: string, checksum: string, generatedAt: string): Promise<ProtectionStatus>;
  applyEarnedUnlockWindow?(
    expiresAt: string,
    sourceAttemptHost?: string,
    nativeInterventionId?: string
  ): Promise<ProtectionStatus>;
  startFocusShieldCalibration?(request: FocusShieldCalibrationRequest): Promise<FocusShieldCalibrationResult>;
  configureFocusShieldRollout?(enabled: boolean): Promise<ProtectionStatus>;
  cancelFocusShieldCalibration?(): Promise<FocusShieldCalibrationResult>;
  getFocusShieldCalibration?(): Promise<FocusShieldCalibrationResult>;
  configureFocusShieldRule?(rule: FocusShieldRule): Promise<FocusShieldRuleOperationResult>;
  listFocusShieldRules?(): Promise<FocusShieldRule[]>;
  removeFocusShieldRule?(ruleId: string): Promise<boolean>;
  applyFocusShieldEarnedUnlock?(expiresAt: string, scope: FocusShieldInterventionScope, nativeInterventionId?: string): Promise<ProtectionStatus>;
  clearEarnedUnlockWindow?(): Promise<ProtectionStatus>;
  startRiskWindowMonitoring?(startHour: number, endHour: number, startMinute?: number, endMinute?: number): Promise<ProtectionStatus>;
  stopRiskWindowMonitoring?(): Promise<ProtectionStatus>;
  presentFamilyActivityPicker?(): Promise<ProtectionStatus>;
  openSafariExtensionSettings?(target: SafariExtensionSettingsTarget): Promise<ProtectionStatus>;
  openProtectionSettings(): Promise<ProtectionStatus>;
  runActivationDiagnostics?(
    adultHost: string,
    normalHost: string,
    requireReviewedAdultFeed?: boolean
  ): Promise<ProtectionActivationDiagnostics>;
  getPendingInterventionV2?(scope:string):Promise<PendingIntervention|null>;
  clearPendingInterventionV2?(interventionId:string,scope:string):Promise<boolean>;
  getPendingIntervention?(scope:string): Promise<PendingIntervention | null>;
  clearPendingIntervention?(interventionId: string,scope:string): Promise<boolean>;
  classifyChallengePhoto?(uri: string, expectedLabels: string[], operationId: string): Promise<ChallengePhotoClassification>;
  getChallengePhotoCapabilities?(): Promise<PhotoCapabilities>;
  cancelChallengePhoto?(operationId: string): Promise<boolean>;
};

let nativeModule: NativeFreedProtection | null | undefined;

/** Keep native protection presenters in the same language and appearance as the host. */
export function setProtectionPresentationPreferences(configuration: { language: string; themeMode: "system" | "light" | "dark"; languagePreference?: string }): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return true;
  if (!['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'].includes(configuration.language) ||
      !['system', 'light', 'dark'].includes(configuration.themeMode) ||
      (configuration.languagePreference !== undefined && !['system','en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'].includes(configuration.languagePreference))) return false;
  try { return getNativeModule()?.setPresentationPreferences?.(configuration) === true; }
  catch { return false; }
}

function getNativeModule() {
  if (nativeModule !== undefined) return nativeModule;

  try {
    nativeModule = requireNativeModule<NativeFreedProtection>("FreedProtection");
  } catch {
    nativeModule = null;
  }

  return nativeModule;
}

const fallbackCapability: ProtectionCapability = {
  platform: "web",
  screenTime: false,
  managedSettings: false,
  accessibility: false,
  dnsFiltering: false,
  localVpnFallback: false,
  notes: ["Native protection services are unavailable in this preview. Local classifier checks cannot activate device blocking."]
};

const fallbackStatus: ProtectionStatus = {
  authorized: false,
  active: false,
  mode: "prototype",
  message: "Native protection is unavailable in Expo Go/web preview, so device blocking is not active."
};

const fallbackActivationDiagnostics: ProtectionActivationDiagnostics = {
  platform: "web",
  checkedNativeLayer: false,
  nativeChecksPassed: false,
  adultBlocked: false,
  normalAllowed: false,
  issues: ["native protection module unavailable"],
  message: "Native activation diagnostics are unavailable in Expo Go/web preview."
};

const fallbackFocusShieldCalibration: FocusShieldCalibrationResult = {
  state: "unavailable",
  message: "Focus Shield calibration is unavailable in Expo Go/web preview."
};

const fallbackFocusShieldRuleOperation: FocusShieldRuleOperationResult = {
  available: false,
  rule: null,
  message: "Focus Shield rule management is unavailable in Expo Go/web preview."
};

export class NativeProtectionTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Native protection call "${operation}" timed out after ${timeoutMs}ms.`);
    this.name = "NativeProtectionTimeoutError";
  }
}

async function withNativeTimeout<T>(
  operation: string,
  run: (module: NativeFreedProtection) => Promise<T>,
  fallback: () => T,
  timeoutMs = 12_000
): Promise<T> {
  const module = getNativeModule();
  if (!module) return fallback();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(module),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new NativeProtectionTimeoutError(operation, timeoutMs)), timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function getProtectionCapabilities() {
  return withNativeTimeout(
    "getCapabilities",
    (module) => module.getCapabilities(),
    () => fallbackCapability
  );
}

export async function getEncryptedDnsStatus(): Promise<EncryptedDnsStatus> {
  try {
    const status = await withNativeTimeout(
      "getEncryptedDnsStatus",
      (module) => module.getEncryptedDnsStatus?.() ?? Promise.resolve(unavailableEncryptedDnsStatus()),
      () => unavailableEncryptedDnsStatus(),
      8_000
    );
    return normalizeEncryptedDnsStatus(status);
  } catch {
    return unavailableEncryptedDnsStatus('native-status-check-failed');
  }
}

export async function configureEncryptedDns(configuration: EncryptedDnsConfiguration): Promise<EncryptedDnsStatus> {
  if (configuration.provider !== 'cloudflare-families' || typeof configuration.enabled !== 'boolean') {
    throw new Error('Invalid encrypted DNS configuration.');
  }
  // Saving an iOS DNS profile can show an OS consent sheet. Let the person finish
  // that prompt; a timeout must not claim that a pending save failed.
  if (Platform.OS === 'ios') {
    const status = await getNativeModule()?.configureEncryptedDns?.(configuration);
    return normalizeEncryptedDnsStatus(status ?? unavailableEncryptedDnsStatus());
  }
  const status = await withNativeTimeout(
    "configureEncryptedDns",
    (module) => module.configureEncryptedDns?.(configuration) ?? Promise.resolve(unavailableEncryptedDnsStatus()),
    () => unavailableEncryptedDnsStatus(),
    12_000
  );
  return normalizeEncryptedDnsStatus(status);
}

export async function getSafariRecoveryObservation(): Promise<SafariRecoveryObservation> {
  try {
    const result = await withNativeTimeout('getSafariRecoveryObservation',
      module => module.getSafariRecoveryObservation?.() ?? Promise.resolve(null), () => null, 8_000);
    return validateSafariRecoveryObservation(result) ?? unavailableSafariRecoveryObservation();
  } catch { return unavailableSafariRecoveryObservation(); }
}

export async function getProtectionStatus(): Promise<ProtectionStatus> {
  const binding = acknowledgedNativeBinding, carrier = activeAccountCarrier;
  const privateRead = Platform.OS === 'ios' && binding !== null && carrier !== null && nativeAccountCurrent();
  const stillCurrent = () => !privateRead || acknowledgedNativeBinding === binding && activeAccountCarrier === carrier && nativeAccountCurrent();
  const read = async (): Promise<ProtectionStatus> => {
    try {
      const raw = await withNativeTimeout('getProtectionStatus', module => {
        if (Platform.OS !== 'ios') return module.getStatus();
        if (privateRead) return module.getStatusV2?.(carrier!, binding!.actionScope) ?? Promise.resolve(unavailableProtectionStatus('native-status-v2-unavailable'));
        return module.getDevicePublicStatus?.() ?? Promise.resolve(unavailableProtectionStatus('native-device-status-unavailable'));
      }, () => unavailableProtectionStatus('native-status-unavailable'), 8_000);
      if (!stillCurrent()) return unavailableProtectionStatus('native-status-binding-stale');
      const failure = nativeStatusReadError(raw);
      return failure ? unavailableProtectionStatus(failure) : validateProtectionStatus(raw, Platform.OS === 'ios' ? privateRead ? 'account' : 'device' : 'android', binding ?? undefined)
        ?? unavailableProtectionStatus('native-status-malformed');
    } catch (error) {
      return unavailableProtectionStatus(!stillCurrent() ? 'native-status-binding-stale' : error instanceof NativeProtectionTimeoutError ? 'native-status-timeout' : 'native-status-read-failed');
    }
  };
  if (Platform.OS !== 'ios') return sanitizeFocusShieldStatusFields(await read());
  const [status, observation] = await Promise.all([read(), getSafariRecoveryObservation()]);
  if (!stillCurrent()) return unavailableProtectionStatus('native-status-binding-stale');
  return { ...sanitizeFocusShieldStatusFields(status), safariRecoveryObservation: observation };
}

export async function requestProtectionAuthorization() {
  // Apple owns this sheet until the person approves or cancels it. A deadline
  // for native work must not expire while they are reading the system prompt.
  if (Platform.OS === "ios") {
    return (await getNativeModule()?.requestAuthorization()) ?? fallbackStatus;
  }
  return withNativeTimeout(
    "requestAuthorization",
    (module) => module.requestAuthorization(),
    () => fallbackStatus,
    15_000
  );
}

export async function openUsageAccessSettings() {
  return withNativeTimeout(
    "openUsageAccessSettings",
    (module) => module.openUsageAccessSettings?.() ?? module.getStatus(),
    () => fallbackStatus,
    10_000
  );
}

export async function openAndroidNotificationSettings() {
  return withNativeTimeout(
    "openAndroidNotificationSettings",
    (module) => module.openAndroidNotificationSettings?.() ?? module.getStatus(),
    () => fallbackStatus,
    10_000
  );
}

export async function openPrivateDnsSettings() {
  return withNativeTimeout(
    "openPrivateDnsSettings",
    (module) => module.openPrivateDnsSettings?.() ?? module.getStatus(),
    () => fallbackStatus,
    10_000
  );
}

export async function openVpnSettings() {
  return withNativeTimeout(
    "openVpnSettings",
    (module) => module.openVpnSettings?.() ?? module.getStatus(),
    () => fallbackStatus,
    10_000
  );
}

export async function applyAdultContentFilter() {
  return withNativeTimeout(
    "applyAdultContentFilter",
    (module) => module.applyAdultContentFilter(),
    () => fallbackStatus,
    20_000
  );
}

export async function stopAdultContentFilter() {
  return withNativeTimeout(
    "stopAdultContentFilter",
    (module) => module.stopAdultContentFilter?.() ?? module.getStatus(),
    () => fallbackStatus,
    12_000
  );
}

export async function configureBlockedAppPackages(
  packages: string[],
  dailyLimitMinutes?: number,
  shortFormInterruptionSeconds?: number
):Promise<ProtectionStatus> {
  throw new Error('App settings require acknowledged app groups in this build. Existing protection stays installed.');
}

/** A saved preference or an old binary cannot acknowledge installing a guard. */
export async function configureAppGuardMode(mode: AppGuardMode): Promise<ProtectionStatus> {
  throw new Error('This app setting requires an updated native adapter. Use the acknowledged app rule.');
}

/** Packages belong to Android; iOS explicitly binds timing to its opaque selection. */
export async function configureAppSchedules(configuration: AppScheduleConfiguration): Promise<ProtectionStatus> {
  throw new Error('This app setting requires an updated native adapter. Use the acknowledged app rule.');
}

/** Missing or old native binaries cannot acknowledge erasure of their configuration. */
export async function resetProtectionConfiguration(): Promise<ProtectionStatus> {
  const unsupported = (status: ProtectionStatus): ProtectionStatus => ({ ...status,
    protectionConfigurationResetAccepted: false, protectionConfigurationResetError: 'reset-not-supported' });
  return withNativeTimeout('resetProtectionConfiguration', async module => {
    if (!module.resetProtectionConfiguration) return unsupported(await module.getStatus());
    return module.resetProtectionConfiguration();
  }, () => unsupported(fallbackStatus), 20_000);
}

/** Caller must invoke only from a fresh user action, never a synchronization effect. */
export async function activateProtectionConfiguration(): Promise<ProtectionStatus> {
  const unsupported = (status: ProtectionStatus): ProtectionStatus => ({ ...status,
    protectionConfigurationActivationAccepted: false });
  return withNativeTimeout('activateProtectionConfiguration', async module => {
    if (!module.activateProtectionConfiguration) return unsupported(await module.getStatus());
    return module.activateProtectionConfiguration();
  }, () => unsupported(fallbackStatus));
}

export async function configureAdultDomainFeed(
  domains: string[],
  version: string,
  checksum: string,
  generatedAt: string
) {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.configureAdultDomainFeed?.(domains, version, checksum, generatedAt)) ?? module.getStatus();
}

export async function configureUserAllowedDomains(domains: string[]) {
  const module = getNativeModule();
  if (!module?.configureUserAllowedDomains) return fallbackStatus;
  return withNativeTimeout(
    "configureUserAllowedDomains",
    (native) => native.configureUserAllowedDomains!(domains),
    () => fallbackStatus,
    12_000
  );
}

export async function configureSafariContentBlockerRules(
  rulesJson: string,
  version: string,
  checksum: string,
  generatedAt: string
) {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.configureSafariContentBlockerRules?.(rulesJson, version, checksum, generatedAt)) ?? module.getStatus();
}

/** Binary method availability only; native authority/readback still decides eligibility. */
export function isResetAppGroupRewardMethodAvailable(): boolean {
  return typeof getNativeModule()?.grantResetAppGroupBreak === 'function';
}

/** Explicit Use app action only. Older binaries cannot fall back to generic unlocks. */
export async function grantResetAppGroupBreak(request: ResetAppGroupRewardRequest, scope: string): Promise<ResetAppGroupRewardReceipt> {
  if (!isResetAppGroupRewardRequest(request) || !admittedScope(scope)) return unavailableResetAppGroupReward('reset-reward-request-invalid');
  try {
    const module = getNativeModule();
    if (!module?.grantResetAppGroupBreak) return unavailableResetAppGroupReward('reset-reward-unavailable');
    const result = await scopedNativeCall(scope,()=>module.grantResetAppGroupBreak!(request, scope));
    return validateResetAppGroupRewardReceipt(result, request) ?? unavailableResetAppGroupReward('reset-reward-receipt-invalid', true);
  } catch { return unavailableResetAppGroupReward('reset-reward-native-failed', true); }
}

export async function applyEarnedUnlockWindow(
  expiresAt: string,
  sourceAttemptHost?: string,
  nativeInterventionId?: string
) {
  return {...fallbackStatus,nativeUnlockGrantAccepted:false,nativeConfigurationError:'native-account-scoped-legacy-unavailable'};
}

export async function configureFocusShieldRollout(enabled: boolean): Promise<ProtectionStatus> {
  if (typeof enabled !== "boolean") throw new Error("Invalid Focus Shield rollout configuration.");
  const module = getNativeModule();
  if (!module?.configureFocusShieldRollout) return fallbackStatus;
  return withNativeTimeout("configureFocusShieldRollout", native => native.configureFocusShieldRollout!(enabled), () => fallbackStatus);
}

export async function startFocusShieldCalibration(request: FocusShieldCalibrationRequest): Promise<FocusShieldCalibrationResult> {
  const module = getNativeModule();
  if (!module?.startFocusShieldCalibration) return fallbackFocusShieldCalibration;
  return sanitizeFocusShieldCalibrationResult(await module.startFocusShieldCalibration(request));
}

export async function cancelFocusShieldCalibration(): Promise<FocusShieldCalibrationResult> {
  const module = getNativeModule();
  if (!module?.cancelFocusShieldCalibration) return fallbackFocusShieldCalibration;
  return sanitizeFocusShieldCalibrationResult(await module.cancelFocusShieldCalibration());
}

export async function getFocusShieldCalibration(): Promise<FocusShieldCalibrationResult> {
  const module = getNativeModule();
  if (!module?.getFocusShieldCalibration) return fallbackFocusShieldCalibration;
  return sanitizeFocusShieldCalibrationResult(await module.getFocusShieldCalibration());
}

export async function configureFocusShieldRule(rule: FocusShieldRule): Promise<FocusShieldRuleOperationResult> {
  const sanitizedRule = sanitizeFocusShieldRule(rule);
  if (!sanitizedRule) {
    return {
      available: false,
      rule: null,
      message: "Focus Shield rule is invalid and was not sent to native protection."
    };
  }

  const module = getNativeModule();
  if (!module?.configureFocusShieldRule) return fallbackFocusShieldRuleOperation;
  return sanitizeFocusShieldRuleOperationResult(await module.configureFocusShieldRule(sanitizedRule));
}

export async function listFocusShieldRules(): Promise<FocusShieldRule[]> {
  const module = getNativeModule();
  if (!module?.listFocusShieldRules) return [];
  return (await module.listFocusShieldRules())
    .map((rule) => sanitizeFocusShieldRule(rule))
    .filter((rule): rule is FocusShieldRule => rule !== null);
}

export async function removeFocusShieldRule(ruleId: string): Promise<boolean> {
  const module = getNativeModule();
  if (!module?.removeFocusShieldRule) return false;
  return module.removeFocusShieldRule(ruleId);
}

export async function applyFocusShieldEarnedUnlock(expiresAt: string, scope: FocusShieldInterventionScope, nativeInterventionId?: string): Promise<ProtectionStatus> {
  return {...fallbackStatus,nativeUnlockGrantAccepted:false,nativeConfigurationError:'native-account-scoped-legacy-unavailable'};
}

export function sanitizeFocusShieldStatusFields(value: ProtectionStatus): ProtectionStatus {
  const source = value as ProtectionStatus & Record<string, unknown>;
  const sanitized: ProtectionStatus = { ...value };
  delete sanitized.activeUnlockInterventionId;
  delete sanitized.activeFocusShieldUnlockInterventionId;
  delete sanitized.nativeUnlockGrantAccepted;
  delete sanitized.nativeUnlockGrantInterventionId;
  const packageGrantId = sanitizePendingInterventionId(source.activeUnlockInterventionId);
  const surfaceGrantId = sanitizePendingInterventionId(source.activeFocusShieldUnlockInterventionId);
  const acknowledgmentId = sanitizePendingInterventionId(source.nativeUnlockGrantInterventionId);
  if (packageGrantId) sanitized.activeUnlockInterventionId = packageGrantId;
  if (surfaceGrantId) sanitized.activeFocusShieldUnlockInterventionId = surfaceGrantId;
  if (acknowledgmentId && typeof source.nativeUnlockGrantAccepted === "boolean") {
    sanitized.nativeUnlockGrantAccepted = source.nativeUnlockGrantAccepted;
    sanitized.nativeUnlockGrantInterventionId = acknowledgmentId;
  }
  delete sanitized.focusShieldRuleCount;
  delete sanitized.focusShieldEnabledRuleCount;
  delete sanitized.focusShieldRuleStoreHealth;
  delete sanitized.activeFocusShieldUnlockExpiresAt;
  delete sanitized.activeFocusShieldUnlockRuleId;
  delete sanitized.activeFocusShieldUnlockPackageName;

  const ruleCount = sanitizeFocusShieldCount(source.focusShieldRuleCount);
  const enabledRuleCount = sanitizeFocusShieldCount(source.focusShieldEnabledRuleCount);
  if (ruleCount !== undefined) sanitized.focusShieldRuleCount = ruleCount;
  if (enabledRuleCount !== undefined && (ruleCount === undefined || enabledRuleCount <= ruleCount)) {
    sanitized.focusShieldEnabledRuleCount = enabledRuleCount;
  }
  if (source.focusShieldRuleStoreHealth === "empty" || source.focusShieldRuleStoreHealth === "ready" || source.focusShieldRuleStoreHealth === "degraded") {
    sanitized.focusShieldRuleStoreHealth = source.focusShieldRuleStoreHealth;
  }

  const activeScope = sanitizeFocusShieldInterventionScope({
    kind: "android-surface",
    ruleId: source.activeFocusShieldUnlockRuleId,
    packageName: source.activeFocusShieldUnlockPackageName
  });
  const activeExpiresAt = typeof source.activeFocusShieldUnlockExpiresAt === "string"
    && Number.isFinite(Date.parse(source.activeFocusShieldUnlockExpiresAt))
    ? source.activeFocusShieldUnlockExpiresAt
    : null;
  if (activeScope?.kind === "android-surface" && activeExpiresAt) {
    sanitized.activeFocusShieldUnlockExpiresAt = activeExpiresAt;
    sanitized.activeFocusShieldUnlockRuleId = activeScope.ruleId;
    sanitized.activeFocusShieldUnlockPackageName = activeScope.packageName;
  }

  return sanitized;
}

function sanitizeFocusShieldCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 64 ? value : undefined;
}

function sanitizeFocusShieldCalibrationResult(value: unknown): FocusShieldCalibrationResult {
  if (!isRecord(value) || !isFocusShieldCalibrationState(value.state)) return fallbackFocusShieldCalibration;

  const rule = value.rule === undefined ? undefined : sanitizeFocusShieldRule(value.rule) ?? undefined;
  const message = typeof value.message === "string" ? value.message.trim().slice(0, 240) || undefined : undefined;
  return { state: value.state, rule, message };
}

function sanitizeFocusShieldRuleOperationResult(value: unknown): FocusShieldRuleOperationResult {
  if (!isRecord(value)) return fallbackFocusShieldRuleOperation;

  const rule = value.rule === null || value.rule === undefined ? null : sanitizeFocusShieldRule(value.rule);
  const message = typeof value.message === "string" ? value.message.trim().slice(0, 240) : fallbackFocusShieldRuleOperation.message;
  return { available: value.available === true, rule, message };
}

function isFocusShieldCalibrationState(value: unknown): value is FocusShieldCalibrationResult["state"] {
  return value === "idle"
    || value === "calibrating"
    || value === "ready"
    || value === "success"
    || value === "cancelled"
    || value === "timeout"
    || value === "unsupported-tree"
    || value === "revoked-permission"
    || value === "app-switched"
    || value === "service-interrupted"
    || value === "unavailable"
    || value === "failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function clearEarnedUnlockWindow() {
  return (await getNativeModule()?.clearEarnedUnlockWindow?.()) ?? fallbackStatus;
}

export async function startRiskWindowMonitoring(startHour = 22, endHour = 6, startMinute = 0, endMinute = 0) {
  return (await getNativeModule()?.startRiskWindowMonitoring?.(startHour, endHour, startMinute, endMinute)) ?? fallbackStatus;
}

export async function stopRiskWindowMonitoring() {
  return (await getNativeModule()?.stopRiskWindowMonitoring?.()) ?? fallbackStatus;
}

export async function presentFamilyActivityPicker() {
  return (await getNativeModule()?.presentFamilyActivityPicker?.()) ?? fallbackStatus;
}

export type SafariExtensionSettingsTarget = "content-blocker" | "focus-shield";

export async function openSafariExtensionSettings(target: SafariExtensionSettingsTarget = "content-blocker") {
  return withNativeTimeout(
    "openSafariExtensionSettings",
    (module) => module.openSafariExtensionSettings?.(target) ?? module.openProtectionSettings(),
    () => fallbackStatus,
    20_000
  );
}

export async function openProtectionSettings() {
  const result = (await getNativeModule()?.openProtectionSettings()) ?? fallbackStatus;
  const { settingsHandoff: raw, ...status } = result;
  const handoff = normalizeWebsiteHandoffReceipt(raw);
  return { ...status, ...(handoff?.kind === 'settings' ? {settingsHandoff:handoff} : {}) };
}

export async function runActivationDiagnostics(
  adultHost = "pornhub.com",
  normalHost = "www.khanacademy.org",
  requireReviewedAdultFeed = false
) {
  return withNativeTimeout(
    "runActivationDiagnostics",
    (module) =>
      module.runActivationDiagnostics
        ? module.runActivationDiagnostics(adultHost, normalHost, requireReviewedAdultFeed)
        : Promise.resolve(fallbackActivationDiagnostics),
    () => fallbackActivationDiagnostics,
    25_000
  );
}

export async function getPendingIntervention(actionScope:string|null=null) {
  if(!admittedScope(actionScope))return null;
  const module = getNativeModule();
  const read=Platform.OS==='ios'?module?.getPendingInterventionV2:module?.getPendingIntervention;
  if(!read)return null;
  const pending=await read.call(module,actionScope);
  if(!admittedScope(actionScope))return null;
  if (!pending) return null;
  const interventionId = sanitizePendingInterventionId(pending.interventionId);
  if (!interventionId) return null;
  const scope = sanitizeFocusShieldInterventionScope(pending.scope);
  return {
    ...pending,
    interventionId,
    ...(scope ? { scope } : { scope: undefined })
  };
}

export async function clearPendingIntervention(interventionId: string,scope:string|null=null) {
  if(!admittedScope(scope))return false;
  const sanitizedInterventionId = sanitizePendingInterventionId(interventionId);
  if (!sanitizedInterventionId) return false;
  const module = getNativeModule();
  const clear=Platform.OS==='ios'?module?.clearPendingInterventionV2:module?.clearPendingIntervention;
  if(!clear)return false;
  const accepted=await clear.call(module,sanitizedInterventionId,scope);return admittedScope(scope)&&accepted===true;
}

function sanitizePendingInterventionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

export async function getChallengePhotoCapabilities(): Promise<PhotoCapabilities> {
  try { return readPhotoCapabilities(await getNativeModule()?.getChallengePhotoCapabilities?.()); }
  catch { return readPhotoCapabilities(null); }
}
export async function classifyChallengePhoto(uri: string, expectedLabels: string[], operationId: string): Promise<ChallengePhotoClassification> {
  const module = getNativeModule();
  if (!module?.classifyChallengePhoto || !module.cancelChallengePhoto) return unavailablePhoto();
  return readPhotoClassification(await module.classifyChallengePhoto(uri, expectedLabels, operationId));
}
export async function cancelChallengePhoto(operationId: string): Promise<boolean> {
  try { return (await getNativeModule()?.cancelChallengePhoto?.(operationId)) === true; } catch { return false; }
}

export type VpnConsentResult = {
  granted: boolean;
  vpnConsentRequired: boolean;
  adultFilterActive: boolean;
};

export function addVpnConsentListener(
  callback: (event: VpnConsentResult) => void
): EventSubscription {
  const module = getNativeModule();
  if (!module) {
    return { remove: () => {} };
  }
  const emitter = module as NativeFreedProtection & EventEmitterLike;
  return emitter.addListener("onVpnConsentResult", callback);
}

export type DnsGuardRuntimeEvent = {
  running: boolean;
  runtimeReady: boolean;
  adultFilterActive?: boolean;
  dnsGuardCoverageReady?: boolean;
  dnsGuardCaptivePaused?: boolean;
  dnsGuardCoverageIssueCode?: string;
  dnsGuardIpv6MalformedPackets?: number;
  dnsGuardIpv6UnsupportedPackets?: number;
  dnsGuardIpv4ResolverRouteCount?: number;
  dnsGuardIpv6ResolverRouteCount?: number;
  stopReason?: string | null;
  stateVersion: number;
};

export function addDnsGuardRuntimeListener(
  callback: (event: DnsGuardRuntimeEvent) => void
): EventSubscription {
  const module = getNativeModule();
  if (!module) {
    return { remove: () => {} };
  }
  const emitter = module as NativeFreedProtection & DnsGuardEventEmitterLike;
  return emitter.addListener("onDnsGuardRuntimeChanged", callback);
}

type EventEmitterLike = {
  addListener(eventName: "onVpnConsentResult", listener: (event: VpnConsentResult) => void): EventSubscription;
};

type DnsGuardEventEmitterLike = {
  addListener(eventName: "onDnsGuardRuntimeChanged", listener: (event: DnsGuardRuntimeEvent) => void): EventSubscription;
};


function unavailableAppGroups(reason = 'app-groups-native-unavailable'): AppGroupsSnapshot {
  return { version: 1, supported: false, platform: 'unsupported', revision: 0, configurationGeneration: 0, scopeEpoch: 0,
    groups: [], permissions: { authorized: false, usageAccess: false, runtimeConnected: false }, monitorBudget: { used: 0, limit: 20 },
    maxGroups: 6, legacyCompatibility: { retained: false, applicationCount: 0, categoryCount: 0, webDomainCount: 0 }, reason };
}
function unavailableAppGroupBinding(reason: string, stage: AppGroupBindingReceipt['stage'] = 'unavailable'): AppGroupBindingReceipt {
  // A fresh diagnostic UUID has no relationship to account/intervention scope.
  const operationId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16); return (character === 'x' ? random : (random & 3) | 8).toString(16);
  });
  return { version: 1, operationId, supported: false, accepted: false, bindingCurrent: false, ownerVerified: false, stage, reason,
    generation: null, scopeEpoch: null, errorCode: null, errorDomain: null };
}
let acknowledgedNativeBinding:NativeAccountBinding|null=null;
let nativeAccountCurrent:()=>boolean=()=>false;
let activeAccountCarrier:object|null=null;
const nativeCancellationHandles=new Map<string,string>();
const admittedScope=(scope:unknown):scope is string=>typeof scope==='string'&&acknowledgedNativeBinding?.actionScope===scope&&nativeAccountCurrent();
export const isNativeAccountActionScopeCurrent=(scope:string|null)=>admittedScope(scope);
/** The SharedObject never escapes these closures or enters persistent storage. */
export function createNativeAccountSession(isCurrent:()=>boolean=()=>false,purpose:'private'|'cleanup'='private'):NativeAccountSessionDriver|null {
 const native=getNativeModule();if(!native?.FreedAccountBindingSession||!native.prepareAccountBindingV2||!native.commitAccountBindingV2)return null;
 const carrier=new native.FreedAccountBindingSession();let ownBinding:NativeAccountBinding|null=null;let retired=false,prepared:{owner:string;sequence:number;ticket:string;revision:number|null}|null=null;
 acknowledgedNativeBinding=null;activeAccountCarrier=carrier;nativeAccountCurrent=()=>purpose==='private'&&!retired&&activeAccountCarrier===carrier&&isCurrent();
 return {
  async prepare(owner,transition,sequence){if(retired||!isCurrent())throw Error('native-account-session-retired');const raw=await Promise.resolve(native.prepareAccountBindingV2!(carrier,JSON.stringify([owner,sequence]),transition,sequence));if(retired||!isCurrent())throw Error('native-account-session-retired');const checked=validateNativeAccountPreparation(raw);if(checked)prepared={owner,sequence,ticket:checked.ticket,revision:checked.admissionRevision};return raw;},
  async commit(ticket){if(retired||!isCurrent()||!prepared||ticket!==prepared.ticket)throw Error('native-account-ticket-stale');const raw=await Promise.resolve(native.commitAccountBindingV2!(carrier,ticket));if(retired||!isCurrent())throw Error('native-account-session-retired');const binding=validateNativeAccountBinding(raw,prepared.owner,prepared.sequence,prepared.revision);if(binding){if(purpose==='private')acknowledgedNativeBinding=binding;ownBinding=binding;nativeCancellationHandles.set(binding.actionScope,binding.bindingHandle);if(nativeCancellationHandles.size>32)nativeCancellationHandles.delete(nativeCancellationHandles.keys().next().value!);}return raw;},
  async prepareCleanup(){if(retired||!isCurrent()||!ownBinding)return null;const captured=ownBinding;const receipt=await boundedNativeCleanup(()=>native.prepareAccountProtectionCleanup?.(captured.actionScope,captured.bindingHandle));return !retired&&isCurrent()&&ownBinding===captured?receipt:null;},
  retire(){if(retired)return;retired=true;if(activeAccountCarrier===carrier){acknowledgedNativeBinding=null;activeAccountCarrier=null;nativeAccountCurrent=()=>false;}carrier.release();if(ownBinding)void cancelNativeAccountResources(ownBinding.actionScope);}
 };
}
/** Cancellation only: exact previously delivered native handle, never current-owner fallback. */
export async function cancelNativeAccountResources(scope:string,evidenceSessionId='',captureOperationId=''):Promise<import('./native-account-contract').NativeResourceCancellation>{
 const handle=nativeCancellationHandles.get(scope);if(!handle)return {state:'unavailable',osDismissalConfirmed:false};
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const result=await Promise.race([Promise.resolve(getNativeModule()?.cancelAccountSessionResources?.(handle,evidenceSessionId,captureOperationId)),new Promise<null>(r=>{timer=setTimeout(()=>r(null),1500);})]);
  const v=result as {version?:unknown;bindingHandle?:unknown;state?:unknown;osDismissalConfirmed?:unknown}|null;
  return v?.version===2&&v.bindingHandle===handle&&['cancelled','pending','notApplicable','unavailable'].includes(String(v.state))&&v.osDismissalConfirmed===false?{state:v.state as 'pending',osDismissalConfirmed:false}:{state:'unavailable',osDismissalConfirmed:false};
 }catch{return {state:'unavailable',osDismissalConfirmed:false};}finally{if(timer)clearTimeout(timer);}
}
/** Compatibility name: reads one already acknowledged v2 admission; never invokes raw/v1 bind. */
export async function setAppGroupActionScope(scope:string):Promise<AppGroupBindingReceipt>{
 const binding=acknowledgedNativeBinding;
 if(!binding||!admittedScope(scope))return unavailableAppGroupBinding('native-account-admission-required');
 return {version:1,operationId:binding.bindingHandle,supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:binding.generation,scopeEpoch:binding.scopeEpoch,errorCode:null,errorDomain:null};
}
async function boundedNativeCleanup(work:()=>unknown,expectedId?:string):Promise<NativeCleanupReceipt|null>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve().then(work).then(raw=>validateNativeCleanupReceipt(raw,expectedId)).catch(()=>null),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),1500);})]);}finally{if(timer)clearTimeout(timer);}
}
export async function prepareNativeAccountCleanup(scope:string,handle:string):Promise<NativeCleanupReceipt|null>{
 if(!admittedScope(scope)||acknowledgedNativeBinding?.bindingHandle!==handle)return null;
 return boundedNativeCleanup(()=>getNativeModule()?.prepareAccountProtectionCleanup?.(scope,handle));
}
export async function executeNativeAccountCleanup(operationId:string):Promise<NativeCleanupReceipt|null>{
 if(!nativeAccountUUID(operationId))return null;
 return boundedNativeCleanup(()=>getNativeModule()?.executeAccountProtectionCleanup?.(operationId),operationId);
}
export async function getNativeAccountCleanup(operationId:string):Promise<NativeCleanupReceipt|null>{
 if(!nativeAccountUUID(operationId))return null;
 return boundedNativeCleanup(()=>getNativeModule()?.getAccountProtectionCleanup?.(operationId),operationId);
}

export async function getAppGroups(scope: string): Promise<AppGroupsSnapshot> {
  if (!admittedScope(scope)) return unavailableAppGroups('native-account-admission-required');
  try {
    const result = await getNativeModule()?.getAppGroups?.(scope);
    if(!admittedScope(scope))return unavailableAppGroups('native-account-admission-stale');
    return validateAppGroupsSnapshot(result) ?? unavailableAppGroups('app-groups-read-invalid');
  } catch { return unavailableAppGroups('app-groups-read-failed'); }
}
type GroupActionOperation = import('../../../src/lib/app-groups-contract').AppGroupActionDiagnostics['operation'];
function groupActionReceipt(receipt: AppGroupReceipt, operation: GroupActionOperation, request: {expectedStoreRevision: number; expectedRevision?: number}, raw?: unknown, stage?: import('../../../src/lib/app-groups-contract').AppGroupActionDiagnostics['stage']): AppGroupReceipt {
 const nativeDiagnostics=raw && typeof raw==='object' ? (raw as {diagnostics?:unknown}).diagnostics : null;
 const fields=nativeDiagnostics && typeof nativeDiagnostics==='object' ? nativeDiagnostics as Record<string,unknown> : {};
 const diagnostics=validateAppGroupActionDiagnostics({version:1,operationId:unavailableAppGroupBinding('').operationId,stage:receipt.accepted?'complete':'native-operation',reason:receipt.reason,configurationGeneration:receipt.snapshot.supported?receipt.snapshot.configurationGeneration:null,storeRevision:request?.expectedStoreRevision??null,groupRevision:request?.expectedRevision??null,errorCode:null,errorDomain:null,...fields,operation,...(stage?{stage,reason:receipt.reason}:{})});
 return {...receipt,...(diagnostics?{diagnostics}:{})};
}
async function groupMutation(method: 'createAppGroup' | 'updateAppGroup' | 'removeAppGroup' | 'presentAppGroupPicker', request: AppGroupCreateRequest | AppGroupUpdateRequest | AppGroupTargetRequest, scope: string, header = '', footer = ''): Promise<AppGroupReceipt> {
 const operation:GroupActionOperation=method==='createAppGroup'?'create':method==='updateAppGroup'?'update':method==='removeAppGroup'?'remove':'picker';
 const failure=(reason:string,stage:import('../../../src/lib/app-groups-contract').AppGroupActionDiagnostics['stage'],snapshot=unavailableAppGroups(reason),raw?:unknown)=>groupActionReceipt({accepted:false,reason,snapshot},operation,request,raw,stage);
 const native = getNativeModule();
 if (!admittedScope(scope) || !native?.[method]) return failure('app-groups-native-unavailable','unavailable');
 try {
  const result = method === 'createAppGroup' ? await native.createAppGroup!(request as AppGroupCreateRequest, scope)
    : method === 'updateAppGroup' ? await native.updateAppGroup!(request as AppGroupUpdateRequest, scope)
      : method === 'removeAppGroup' ? await native.removeAppGroup!(request as AppGroupTargetRequest, scope)
        : await native.presentAppGroupPicker!(request as AppGroupTargetRequest, scope, header, footer);
  if(!admittedScope(scope))return failure('native-account-admission-stale','bridge-validation');
  const receipt=validateAppGroupReceipt(result);
  if(!receipt)return failure('app-group-receipt-invalid','bridge-validation',undefined,result);
  return isAppGroupMutationConfirmed(method,request,receipt)?groupActionReceipt(receipt,operation,request,result):failure('app-group-configuration-not-confirmed','bridge-readback',receipt.snapshot,result);
 } catch {return failure('app-group-operation-failed','native-operation');}
}
export const createAppGroup = (request: AppGroupCreateRequest, scope: string) => groupMutation('createAppGroup', request, scope);
export const updateAppGroup = (request: AppGroupUpdateRequest, scope: string) => groupMutation('updateAppGroup', request, scope);
/** V2 is negotiated explicitly. Old binaries never fall back to a differently sized v1 grant. */
export function isEarnedAppTimeAvailable(): boolean {
  const native = getNativeModule();
  return typeof native?.FreedAccountBindingSession==='function' && typeof native?.prepareAccountBindingV2==='function' && typeof native?.commitAccountBindingV2==='function' && typeof native?.prepareEarnedAppTimeOffer === 'function' && typeof native?.grantEarnedAppTimeBreak === 'function' && typeof native?.getEarnedAppTimeGrant === 'function' && typeof native?.updateAppGroupWithEarnedTime === 'function';
}
const earnedOwnerScopeValid = admittedScope;
async function scopedNativeCall<T>(scope:string,work:()=>Promise<T>):Promise<T>{if(!admittedScope(scope))throw Error('native-account-admission-stale');const result=await work();if(!admittedScope(scope))throw Error('native-account-admission-stale');return result;}
const earnedEvidenceMethods = ['beginEarnedChallengeEvidence','setEarnedChallengeEvidencePhase','getEarnedChallengeEvidence','verifyEarnedChallengePhoto','captureEarnedChallengePhoto','finishEarnedChallengeEvidence'] as const;
/** Native verification is negotiated separately from timer/v2 app-time support. */
export function isEarnedChallengeEvidenceAvailable():boolean {
 const native=getNativeModule();return typeof native?.FreedAccountBindingSession==='function'&&earnedEvidenceMethods.every(method=>typeof native?.[method]==='function');
}
export async function beginEarnedChallengeEvidence(request:EarnedChallengeEvidenceBeginRequest,scope:string,offer:EarnedAppTimeOffer):Promise<EarnedChallengeEvidenceReceipt> {
 if(!earnedOwnerScopeValid(scope)||!isEarnedChallengeEvidenceBeginRequest(request,offer))return unavailableEarnedChallengeEvidence('earned-evidence-request-invalid');
 const native=getNativeModule();if(!native?.beginEarnedChallengeEvidence)return unavailableEarnedChallengeEvidence('earned-evidence-unavailable');
 try{return validateEarnedChallengeEvidenceReceipt(await scopedNativeCall(scope,()=>native.beginEarnedChallengeEvidence!(request,scope)),offer,request)??unavailableEarnedChallengeEvidence('earned-evidence-receipt-invalid',true);}
 catch{return unavailableEarnedChallengeEvidence('earned-evidence-native-failed',true);}
}
async function readOrChangeEarnedEvidence(method:'getEarnedChallengeEvidence'|'setEarnedChallengeEvidencePhase'|'finishEarnedChallengeEvidence'|'captureEarnedChallengePhoto',request:EarnedChallengeEvidenceReadRequest|EarnedChallengeEvidencePhaseRequest|EarnedChallengePhotoCaptureRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer):Promise<EarnedChallengeEvidenceReceipt> {
 if(!session||!earnedOwnerScopeValid(scope)||!isEarnedAppTimeOffer(offer))return unavailableEarnedChallengeEvidence('earned-evidence-request-invalid');
 const begin=earnedEvidenceBeginFromSession(session);
 if(!isEarnedChallengeEvidenceSession(session,offer,begin)||request.evidenceSessionId!==session.evidenceSessionId)return unavailableEarnedChallengeEvidence('earned-evidence-request-invalid');
 const valid=method==='setEarnedChallengeEvidencePhase'?isEarnedChallengeEvidencePhaseRequest(request):method==='captureEarnedChallengePhoto'?isEarnedChallengePhotoCaptureRequest(request)&&session.method==='photo'&&session.phase==='active'&&earnedPhotoTemplateTargets(session.templateId,offer.requestedSeconds).includes((request as EarnedChallengePhotoCaptureRequest).targetId):isEarnedChallengeEvidenceReadRequest(request);
 if(!valid)return unavailableEarnedChallengeEvidence('earned-evidence-request-invalid');
 const native=getNativeModule();if(!native?.[method])return unavailableEarnedChallengeEvidence('earned-evidence-unavailable');
 try{
  const raw=method==='setEarnedChallengeEvidencePhase'?await native.setEarnedChallengeEvidencePhase!(request as EarnedChallengeEvidencePhaseRequest,scope):method==='captureEarnedChallengePhoto'?await native.captureEarnedChallengePhoto!(request as EarnedChallengePhotoCaptureRequest,scope):method==='finishEarnedChallengeEvidence'?await native.finishEarnedChallengeEvidence!(request as EarnedChallengeEvidenceReadRequest,scope):await native.getEarnedChallengeEvidence!(request as EarnedChallengeEvidenceReadRequest,scope);
  if(!admittedScope(scope))return unavailableEarnedChallengeEvidence('native-account-admission-stale');
  const receipt=validateEarnedChallengeEvidenceReceipt(raw,offer,begin,session);
  if(!receipt||receipt.accepted&&method==='finishEarnedChallengeEvidence'&&receipt.session?.phase!=='completed'||receipt.accepted&&method==='setEarnedChallengeEvidencePhase'&&receipt.session?.phase!==(request as EarnedChallengeEvidencePhaseRequest).phase||receipt.accepted&&method==='captureEarnedChallengePhoto'&&!Object.hasOwn(receipt,'result'))return unavailableEarnedChallengeEvidence('earned-evidence-receipt-invalid',true);
  return receipt;
 }catch{return unavailableEarnedChallengeEvidence('earned-evidence-native-failed',true);}
}
export const getEarnedChallengeEvidence=(request:EarnedChallengeEvidenceReadRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>readOrChangeEarnedEvidence('getEarnedChallengeEvidence',request,scope,session,offer);
export const setEarnedChallengeEvidencePhase=(request:EarnedChallengeEvidencePhaseRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>readOrChangeEarnedEvidence('setEarnedChallengeEvidencePhase',request,scope,session,offer);
export const finishEarnedChallengeEvidence=(request:EarnedChallengeEvidenceReadRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>readOrChangeEarnedEvidence('finishEarnedChallengeEvidence',request,scope,session,offer);
export const captureEarnedChallengePhoto=(request:EarnedChallengePhotoCaptureRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>readOrChangeEarnedEvidence('captureEarnedChallengePhoto',request,scope,session,offer);
/** Compatibility URI checks cannot prove that the native camera captured an image. */
export async function verifyEarnedChallengePhoto(_request:EarnedChallengePhotoRequest,_scope:string,_session:EarnedChallengeEvidenceSession,_offer:EarnedAppTimeOffer):Promise<EarnedChallengeEvidenceReceipt> {
 return unavailableEarnedChallengeEvidence('earned-photo-native-capture-required',typeof getNativeModule()?.verifyEarnedChallengePhoto==='function');
}
export async function prepareEarnedAppTimeOffer(request: EarnedAppTimeOfferRequest, scope: string): Promise<EarnedAppTimeOfferReceipt> {
  if (!isEarnedAppTimeOfferRequest(request) || !earnedOwnerScopeValid(scope)) return unavailableEarnedAppTimeOffer('earned-time-request-invalid');
  const native = getNativeModule();
  if (!native?.prepareEarnedAppTimeOffer) return unavailableEarnedAppTimeOffer('earned-time-unavailable');
  try { return validateEarnedAppTimeOfferReceipt(await scopedNativeCall(scope,()=>native.prepareEarnedAppTimeOffer!(request, scope)), request) ?? unavailableEarnedAppTimeOffer('earned-time-offer-invalid', true); }
  catch { return unavailableEarnedAppTimeOffer('earned-time-native-failed', true); }
}
export async function grantEarnedAppTimeBreak(request: EarnedAppTimeGrantRequest, scope: string, offer: EarnedAppTimeOffer): Promise<EarnedAppTimeGrantReceipt> {
  if (!isEarnedAppTimeGrantRequest(request) || !earnedOwnerScopeValid(scope) || !isEarnedAppTimeOffer(offer) || request.offerId !== offer.offerId || !offer.availableMethods.includes(request.evidence.method) || !isEarnedAppTimeTemplateBinding(request.templateId, request.templateVersion, request.category, request.evidence.method, offer.requestedSeconds)) return unavailableEarnedAppTimeGrant('earned-time-request-invalid');
  const native = getNativeModule();
  if (!native?.grantEarnedAppTimeBreak) return unavailableEarnedAppTimeGrant('earned-time-unavailable');
  try { return validateEarnedAppTimeGrantReceipt(await scopedNativeCall(scope,()=>native.grantEarnedAppTimeBreak!(request, scope)), request, offer) ?? unavailableEarnedAppTimeGrant('earned-time-grant-invalid', true); }
  catch { return unavailableEarnedAppTimeGrant('earned-time-native-failed', true); }
}
/** Recovery readback never invokes a grant method. A saved reference is not unlock authority. */
export async function getEarnedAppTimeGrant(request: EarnedAppTimeGrantRequest, scope: string, offer: EarnedAppTimeOffer): Promise<EarnedAppTimeGrantReceipt> {
  if (!isEarnedAppTimeGrantRequest(request) || !earnedOwnerScopeValid(scope) || !isEarnedAppTimeOffer(offer) || request.offerId !== offer.offerId || !offer.availableMethods.includes(request.evidence.method) || !isEarnedAppTimeTemplateBinding(request.templateId, request.templateVersion, request.category, request.evidence.method, offer.requestedSeconds)) return unavailableEarnedAppTimeGrant('earned-time-request-invalid');
  const native = getNativeModule();
  if (!native?.getEarnedAppTimeGrant) return unavailableEarnedAppTimeGrant('earned-time-unavailable');
  try { return validateEarnedAppTimeGrantReceipt(await scopedNativeCall(scope,()=>native.getEarnedAppTimeGrant!(request, scope)), request, offer) ?? unavailableEarnedAppTimeGrant('earned-time-grant-invalid', true); }
  catch { return unavailableEarnedAppTimeGrant('earned-time-native-failed', true); }
}
export async function updateAppGroupWithEarnedTime(request: AppGroupEarnedTimeUpdateRequest, scope: string): Promise<AppGroupReceipt> {
  const failure = (reason: string, stage: import('../../../src/lib/app-groups-contract').AppGroupActionDiagnostics['stage'] = 'native-operation', snapshot=unavailableAppGroups(reason), raw?:unknown): AppGroupReceipt => groupActionReceipt({accepted:false,reason,snapshot},'update-earned',request,raw,stage);
  if (!isAppGroupEarnedTimeUpdateRequest(request, Platform.OS === 'android' ? 'android' : 'ios') || !earnedOwnerScopeValid(scope)) return failure('earned-time-group-request-invalid','request-validation');
  const native = getNativeModule();
  if (!native?.updateAppGroupWithEarnedTime) return failure('earned-time-unavailable','unavailable');
  try {
    const raw = await scopedNativeCall(scope,()=>native.updateAppGroupWithEarnedTime!(request, scope));
    const receipt = validateAppGroupReceipt(raw);
    if (!receipt) return failure('earned-time-group-receipt-invalid','bridge-validation',undefined,raw);
    if (!receipt.accepted) return groupActionReceipt(receipt,'update-earned',request,raw);
    const group = receipt.snapshot.groups.find(value => value.id === request.id);
    const budget = validateEarnedAppTimeBudget(group?.extraTimeBudget);
    if (request.preferredBreakSeconds !== undefined && (group?.preferredBreakSeconds ?? 300) !== request.preferredBreakSeconds) return failure('earned-time-preference-not-confirmed','bridge-readback',receipt.snapshot,raw);
    const ruleMatches = group?.rule.kind === request.rule.kind && (request.rule.kind === 'before-use' || request.rule.kind === 'daily-limit' && group.rule.kind === 'daily-limit' && group.rule.limitMinutes === request.rule.limitMinutes || request.rule.kind === 'scheduled' && group.rule.kind === 'scheduled' && group.rule.startMinute === request.rule.startMinute && group.rule.endMinute === request.rule.endMinute && group.rule.days.length === request.rule.days.length && group.rule.days.every(day => request.rule.kind === 'scheduled' && request.rule.days.includes(day)));
    if (!group || receipt.snapshot.revision <= request.expectedStoreRevision || group.revision < request.expectedRevision || group.name !== request.name.trim() || group.enabled !== request.enabled || group.enabled && !group.ready || !ruleMatches || group.packages.length !== request.packages.length || !group.packages.every(value => request.packages.includes(value)) || !budget || budget.configuredCapMinutes !== request.extraTimeCapMinutes) return failure('earned-time-group-not-confirmed','bridge-readback',receipt.snapshot,raw);
    return groupActionReceipt(receipt,'update-earned',request,raw);
  } catch { return failure('earned-time-native-failed'); }
}
export const removeAppGroup = (request: AppGroupTargetRequest, scope: string) => groupMutation('removeAppGroup', request, scope);
export async function discardPendingAppGroupSelection(request: AppGroupTargetRequest, scope: string): Promise<AppGroupSelectionDiscardReceipt> {
  const failure = (reason: string): AppGroupSelectionDiscardReceipt => ({accepted:false,reason,operation:'discard-pending-selection',targetId:typeof request?.id==='string'?request.id:null,pendingSelectionDiscarded:false,snapshot:unavailableAppGroups(reason)});
  if (!admittedScope(scope) || !request || request.version !== 1 || !Number.isSafeInteger(request.expectedStoreRevision) || request.expectedStoreRevision < 0
    || !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 || typeof request.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(request.id)) return failure('app-group-discard-request-invalid');
  const native = getNativeModule();
  if (!native?.discardPendingAppGroupSelection) return failure('app-groups-native-unavailable');
  try { return validateAppGroupSelectionDiscardReceipt(await scopedNativeCall(scope,()=>native.discardPendingAppGroupSelection!(request, scope)), request) ?? failure('app-group-discard-receipt-invalid'); }
  catch { return failure('app-group-discard-native-failed'); }
}
export const presentAppGroupPicker = (request: AppGroupTargetRequest, scope: string, header: string, footer: string) => groupMutation('presentAppGroupPicker', request, scope, header, footer);
export async function getInstalledGroupApps(query = '', offset = 0, limit = 60, scope:string|null=null): Promise<InstalledGroupAppsPage> {
  if(!admittedScope(scope))return {supported:false,apps:[],total:0,nextOffset:null,reason:'native-account-admission-required'};
  const result = await getNativeModule()?.getInstalledGroupApps?.(query, offset, Math.max(1, Math.min(60, limit)),scope);
  if(!admittedScope(scope))return {supported:false,apps:[],total:0,nextOffset:null,reason:'native-account-admission-stale'};
  return result?.supported === true && Array.isArray(result.apps) ? result : { supported: false, apps: [], total: 0, nextOffset: null, reason: result?.reason ?? 'installed-apps-unavailable' };
}

export async function suspendAppGroupOperations(scope:string|null=null): Promise<boolean> {
  if(!admittedScope(scope))return false;
  try { return (await getNativeModule()?.suspendAppGroupOperations?.(scope)) === true; } catch { return false; }
}

// Internal selected-website prototype: no opaque token or application authority crosses this bridge.
export type WebsiteRecoveryProbeSnapshot = { supported:boolean; accepted:boolean; revision:number; generation:number; epoch:number; optedIn:boolean; pendingCount:number; activeCount:number; installed:boolean; openParentSupported:boolean; reason:string };
const unavailableWebsiteProbe = ():WebsiteRecoveryProbeSnapshot => ({supported:false,accepted:false,revision:-1,generation:-1,epoch:-1,optedIn:false,pendingCount:0,activeCount:0,installed:false,openParentSupported:false,reason:'internal-probe-unavailable'});
function readWebsiteProbe(raw:unknown):WebsiteRecoveryProbeSnapshot {
  if (!raw || typeof raw !== 'object') return unavailableWebsiteProbe();
  const r=raw as Record<string,unknown>, out=unavailableWebsiteProbe();
  for (const key of ['supported','accepted','optedIn','installed','openParentSupported'] as const) out[key]=r[key]===true;
  for (const key of ['revision','generation','epoch','pendingCount','activeCount'] as const) if (typeof r[key]==='number' && Number.isSafeInteger(r[key])) out[key]=r[key] as number;
  if (typeof r.reason==='string') out.reason=r.reason;
  return out;
}
export async function getWebsiteRecoveryProbe():Promise<WebsiteRecoveryProbeSnapshot> {try{return readWebsiteProbe(await getNativeModule()?.getWebsiteRecoveryProbe?.());}catch{return unavailableWebsiteProbe();}}
export async function mutateWebsiteRecoveryProbe(operation:'opt-in'|'activate'|'discard'|'remove', snapshot:WebsiteRecoveryProbeSnapshot):Promise<WebsiteRecoveryProbeSnapshot> {
  if (!snapshot.supported || snapshot.revision<0 || snapshot.generation<0 || snapshot.epoch<0) return unavailableWebsiteProbe();
  try{return readWebsiteProbe(await getNativeModule()?.mutateWebsiteRecoveryProbe?.(operation,snapshot.revision,snapshot.generation,snapshot.epoch));}catch{return unavailableWebsiteProbe();}
}
export async function presentWebsiteRecoveryProbePicker(snapshot:WebsiteRecoveryProbeSnapshot):Promise<{accepted:boolean;reason:string}> {
  if (!snapshot.supported || !snapshot.optedIn) return {accepted:false,reason:'internal-probe-disabled'};
  try{const r=await getNativeModule()?.presentWebsiteRecoveryProbePicker?.(snapshot.revision) as {accepted?:unknown;reason?:unknown}|undefined;return {accepted:r?.accepted===true,reason:typeof r?.reason==='string'?r.reason:'picker-unavailable'};}catch{return {accepted:false,reason:'picker-unavailable'};}
}
export async function probeRawWebsiteTokenAvailability():Promise<boolean|null> {try{const r=await getNativeModule()?.probeRawWebsiteTokenAvailability?.() as {supported?:unknown;tokenAvailable?:unknown}|undefined;return r?.supported===true && typeof r.tokenAvailable==='boolean'?r.tokenAvailable:null;}catch{return null;}}


export type ShieldRuntimeDiagnosticRecord = {
  version: 1; role: 'configuration'|'action'; callback: 'app'|'site'|'category';
  phase: 'entry'|'return'; action: 'none'|'primary'|'secondary'|'unknown';
  outcome: 'none'|'configured'|'close'|'deferred'|'openParent';
  elapsedMilliseconds: number; timestamp: number; binaryVersion: string;
};
export type ShieldRuntimeDiagnosticSnapshot = {
  enabled: boolean; status: 'diagnostic'|'unknown'; binaryVersion: string|null; records: ShieldRuntimeDiagnosticRecord[];
};
const unknownShieldDiagnostics = ():ShieldRuntimeDiagnosticSnapshot => ({enabled:false,status:'unknown',binaryVersion:null,records:[]});
function readShieldDiagnostics(raw:unknown):ShieldRuntimeDiagnosticSnapshot {
  const unknown=unknownShieldDiagnostics();
  if (!raw || typeof raw !== 'object') return unknown;
  const r=raw as Record<string,unknown>;
  if (r.enabled!==true || typeof r.status!=='string' || !['diagnostic','unknown'].includes(r.status) ||
    typeof r.binaryVersion!=='string' || !/^[0-9]+(?:\.[0-9]+){0,3}$/.test(r.binaryVersion) || r.binaryVersion.length>32 ||
    !Array.isArray(r.records) || r.records.length>12) return unknown;
  const binaryVersion=r.binaryVersion, now=Date.now()/1000;
  const records:ShieldRuntimeDiagnosticRecord[]=[];
  const slots=new Set<string>();
  for (const item of r.records) {
    if (!item || typeof item!=='object') continue;
    const v=item as Record<string,unknown>;
    if(v.version!==1 || v.binaryVersion!==binaryVersion ||
      ['role','callback','phase','action','outcome'].some(key=>typeof v[key]!=='string') ||
      !['configuration','action'].includes(String(v.role)) || !['app','site','category'].includes(String(v.callback)) ||
      !['entry','return'].includes(String(v.phase)) || !['none','primary','secondary','unknown'].includes(String(v.action)) ||
      !['none','configured','close','deferred','openParent'].includes(String(v.outcome)) ||
      typeof v.elapsedMilliseconds!=='number' || !Number.isFinite(v.elapsedMilliseconds) || v.elapsedMilliseconds<0 || v.elapsedMilliseconds>86400000 ||
      typeof v.timestamp!=='number' || !Number.isFinite(v.timestamp) || v.timestamp<=0 || v.timestamp>now || now-v.timestamp>86400) continue;
    if(v.phase==='entry' ? v.outcome!=='none' || v.elapsedMilliseconds!==0 || (v.role==='configuration' ? v.action!=='none' : v.action==='none') :
      v.role==='configuration' ? v.action!=='none' || v.outcome!=='configured' : v.action==='none' || !['close','deferred','openParent'].includes(String(v.outcome))) continue;
    const slot=`${v.role}.${v.callback}.${v.phase}`;
    if (slots.has(slot)) return unknown;
    slots.add(slot);
    records.push({version:1,role:v.role as ShieldRuntimeDiagnosticRecord['role'],callback:v.callback as ShieldRuntimeDiagnosticRecord['callback'],
      phase:v.phase as ShieldRuntimeDiagnosticRecord['phase'],action:v.action as ShieldRuntimeDiagnosticRecord['action'],outcome:v.outcome as ShieldRuntimeDiagnosticRecord['outcome'],
      elapsedMilliseconds:v.elapsedMilliseconds,timestamp:v.timestamp,binaryVersion});
  }
  return {enabled:true,status:records.length?'diagnostic':'unknown',binaryVersion,records};
}
// Read only. No JS authority, mutation, preview activation or handoff fallback.
export async function getShieldRuntimeDiagnostics():Promise<ShieldRuntimeDiagnosticSnapshot> {
  try{return readShieldDiagnostics(await getNativeModule()?.getShieldRuntimeDiagnostics?.());}catch{return unknownShieldDiagnostics();}
}

/** Account-free; no private session is bound or cleared by this adapter. */
export const deviceAdultProtection = createDeviceAdultAdapter(getNativeModule);

/** Native-owned staged pilot; old binaries fail closed with no Families mutation. */
export const recoveryDnsPilot = createRecoveryDnsPilotAdapter(() => getNativeModule(), scope => admittedScope(scope));
