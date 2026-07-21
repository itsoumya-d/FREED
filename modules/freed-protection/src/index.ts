import { requireNativeModule } from "expo-modules-core";
import { sanitizeFocusShieldInterventionScope, sanitizeFocusShieldRule } from "../../../src/lib/focus-shield";
import type {
  FocusShieldCalibrationRequest,
  FocusShieldCalibrationResult,
  FocusShieldInterventionScope,
  FocusShieldRule
} from "../../../src/lib/focus-shield";

export type ProtectionCapability = {
  platform: "ios" | "android" | "web" | "unknown";
  screenTime: boolean;
  managedSettings: boolean;
  accessibility: boolean;
  dnsFiltering: boolean;
  usageStats?: boolean;
  safariContentBlocker?: boolean;
  localVpnFallback: boolean;
  notes: string[];
};

export type ProtectionStatus = {
  authorized: boolean;
  active: boolean;
  adultFilterActive?: boolean;
  appInterventionAuthorized?: boolean;
  usageStatsAuthorized?: boolean;
  usageStatsObservedPackages?: number;
  usageStatsObservedPackageNames?: string[];
  usageStatsTodayMinutes?: number;
  usageStatsTodayMinutesByPackage?: Record<string, number>;
  scheduled?: boolean;
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
  activeUnlockExpiresAt?: string;
  activeUnlockSourcePackage?: string;
  vpnConsentRequired?: boolean;
  privateDnsMode?: "off" | "opportunistic" | "hostname" | "unknown";
  privateDnsSpecifier?: string;
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
  dnsGuardRuntimeReady?: boolean;
  dnsGuardRuntimeIssue?: string;
  dnsGuardUserEnabled?: boolean;
  dnsGuardAutoRestartEligible?: boolean;
  dnsGuardLastAutoRestartAction?: string;
  dnsGuardLastAutoRestartAt?: string;
  dnsGuardLastAutoRestartResult?: "started" | "skipped" | "failed" | string;
  dnsGuardLastAutoRestartSkipReason?: string;
  adultDomainFeedVersion?: string;
  adultDomainFeedChecksum?: string;
  adultDomainFeedDomainCount?: number;
  safariContentBlockerVersion?: string;
  safariContentBlockerChecksum?: string;
  safariContentBlockerRuleCount?: number;
  safariContentBlockerEnabled?: boolean;
  safariContentBlockerStateCheckedAt?: string;
  safariContentBlockerStateError?: string;
  safariContentBlockerLastReloadError?: string;
  dnsSettingsAvailable?: boolean;
  dnsSettingsActive?: boolean;
  dnsSettingsEntitled?: boolean;
  dnsSettingsProvider?: string;
  dnsSettingsMatchDomainCount?: number;
  dnsSettingsLastError?: string;
  mode: "screen-time" | "accessibility" | "dns" | "vpn-fallback" | "prototype";
  message: string;
};

export type PendingIntervention = {
  url: string;
  host: string;
  sourcePackage: string;
  reason: string;
  matchedRule: string;
  detectedAt: string;
  sessionDurationSec?: number;
  scope?: FocusShieldInterventionScope;
};

export type FocusShieldRuleOperationResult = {
  available: boolean;
  rule: FocusShieldRule | null;
  message: string;
};

export type ChallengePhotoClassification = {
  available: boolean;
  matched: boolean;
  labels: string[];
  matchedLabels: string[];
  confidence?: number;
  message: string;
};

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
  dnsGuardResolverCount?: number;
  dnsGuardLastResolver?: string;
  dnsGuardLastForwardFailure?: string;
  dnsGuardUptimeMs?: number;
  dnsGuardSessionQueries?: number;
  dnsGuardAllowedQueries?: number;
  dnsGuardBlockedQueries?: number;
  dnsGuardServfailResponses?: number;
  dnsGuardMalformedPackets?: number;
  dnsGuardUserEnabled?: boolean;
  dnsGuardAutoRestartEligible?: boolean;
  dnsGuardLastAutoRestartAction?: string;
  dnsGuardLastAutoRestartAt?: string;
  dnsGuardLastAutoRestartResult?: "started" | "skipped" | "failed" | string;
  dnsGuardLastAutoRestartSkipReason?: string;
  adultDomainFeedVersion?: string;
  adultDomainFeedChecksum?: string;
  adultDomainFeedDomainCount?: number;
  safariContentBlockerVersion?: string;
  safariContentBlockerRuleCount?: number;
  safariContentBlockerEnabled?: boolean;
  safariContentBlockerStateError?: string;
};

type NativeFreedProtection = {
  getCapabilities(): Promise<ProtectionCapability>;
  getStatus(): Promise<ProtectionStatus>;
  requestAuthorization(): Promise<ProtectionStatus>;
  openUsageAccessSettings?(): Promise<ProtectionStatus>;
  openAndroidNotificationSettings?(): Promise<ProtectionStatus>;
  openPrivateDnsSettings?(): Promise<ProtectionStatus>;
  applyAdultContentFilter(): Promise<ProtectionStatus>;
  stopAdultContentFilter?(): Promise<ProtectionStatus>;
  configureBlockedAppPackages?(
    packages: string[],
    dailyLimitMinutes?: number,
    shortFormInterruptionSeconds?: number
  ): Promise<ProtectionStatus>;
  configureAdultDomainFeed?(domains: string[], version: string, checksum: string, generatedAt: string): Promise<ProtectionStatus>;
  configureSafariContentBlockerRules?(rulesJson: string, version: string, checksum: string, generatedAt: string): Promise<ProtectionStatus>;
  configureDnsSettings?(
    resolverURL: string,
    serverAddresses: string[],
    matchDomains: string[],
    providerLabel: string
  ): Promise<ProtectionStatus>;
  clearDnsSettings?(): Promise<ProtectionStatus>;
  applyEarnedUnlockWindow?(expiresAt: string, sourceAttemptHost?: string): Promise<ProtectionStatus>;
  startFocusShieldCalibration?(request: FocusShieldCalibrationRequest): Promise<FocusShieldCalibrationResult>;
  cancelFocusShieldCalibration?(): Promise<FocusShieldCalibrationResult>;
  getFocusShieldCalibration?(): Promise<FocusShieldCalibrationResult>;
  configureFocusShieldRule?(rule: FocusShieldRule): Promise<FocusShieldRuleOperationResult>;
  listFocusShieldRules?(): Promise<FocusShieldRule[]>;
  removeFocusShieldRule?(ruleId: string): Promise<boolean>;
  applyFocusShieldEarnedUnlock?(expiresAt: string, scope: FocusShieldInterventionScope): Promise<ProtectionStatus>;
  clearEarnedUnlockWindow?(): Promise<ProtectionStatus>;
  startRiskWindowMonitoring?(startHour: number, endHour: number, startMinute?: number, endMinute?: number): Promise<ProtectionStatus>;
  stopRiskWindowMonitoring?(): Promise<ProtectionStatus>;
  presentFamilyActivityPicker?(): Promise<ProtectionStatus>;
  openProtectionSettings(): Promise<ProtectionStatus>;
  runActivationDiagnostics?(
    adultHost: string,
    normalHost: string,
    requireReviewedAdultFeed?: boolean
  ): Promise<ProtectionActivationDiagnostics>;
  getPendingIntervention?(): Promise<PendingIntervention | null>;
  clearPendingIntervention?(): Promise<boolean>;
  classifyChallengePhoto?(uri: string, expectedLabels: string[]): Promise<ChallengePhotoClassification>;
};

let nativeModule: NativeFreedProtection | null | undefined;

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

export async function getProtectionCapabilities() {
  return (await getNativeModule()?.getCapabilities()) ?? fallbackCapability;
}

export async function getProtectionStatus() {
  return (await getNativeModule()?.getStatus()) ?? fallbackStatus;
}

export async function requestProtectionAuthorization() {
  return (await getNativeModule()?.requestAuthorization()) ?? fallbackStatus;
}

export async function openUsageAccessSettings() {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.openUsageAccessSettings?.()) ?? module.getStatus();
}

export async function openAndroidNotificationSettings() {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.openAndroidNotificationSettings?.()) ?? module.getStatus();
}

export async function openPrivateDnsSettings() {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.openPrivateDnsSettings?.()) ?? module.getStatus();
}

export async function applyAdultContentFilter() {
  return (await getNativeModule()?.applyAdultContentFilter()) ?? fallbackStatus;
}

export async function stopAdultContentFilter() {
  return (await getNativeModule()?.stopAdultContentFilter?.()) ?? fallbackStatus;
}

export async function configureBlockedAppPackages(
  packages: string[],
  dailyLimitMinutes?: number,
  shortFormInterruptionSeconds?: number
) {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.configureBlockedAppPackages?.(packages, dailyLimitMinutes, shortFormInterruptionSeconds)) ?? module.getStatus();
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

export async function configureDnsSettings(
  resolverURL: string,
  serverAddresses: string[],
  matchDomains: string[],
  providerLabel = "FREED adult-domain DNS"
) {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.configureDnsSettings?.(resolverURL, serverAddresses, matchDomains, providerLabel)) ?? module.getStatus();
}

export async function clearDnsSettings() {
  const module = getNativeModule();
  if (!module) return fallbackStatus;
  return (await module.clearDnsSettings?.()) ?? module.getStatus();
}

export async function applyEarnedUnlockWindow(expiresAt: string, sourceAttemptHost?: string) {
  return (await getNativeModule()?.applyEarnedUnlockWindow?.(expiresAt, sourceAttemptHost)) ?? fallbackStatus;
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

export async function applyFocusShieldEarnedUnlock(expiresAt: string, scope: FocusShieldInterventionScope): Promise<ProtectionStatus> {
  const sanitizedScope = sanitizeFocusShieldInterventionScope(scope);
  if (!sanitizedScope) return fallbackStatus;

  const module = getNativeModule();
  if (!module?.applyFocusShieldEarnedUnlock) return fallbackStatus;
  return module.applyFocusShieldEarnedUnlock(expiresAt, sanitizedScope);
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
  return value === "idle" || value === "calibrating" || value === "ready" || value === "cancelled" || value === "unavailable" || value === "failed";
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

export async function openProtectionSettings() {
  return (await getNativeModule()?.openProtectionSettings()) ?? fallbackStatus;
}

export async function runActivationDiagnostics(
  adultHost = "pornhub.com",
  normalHost = "www.khanacademy.org",
  requireReviewedAdultFeed = false
) {
  const module = getNativeModule();
  if (!module?.runActivationDiagnostics) return fallbackActivationDiagnostics;
  return module.runActivationDiagnostics(adultHost, normalHost, requireReviewedAdultFeed);
}

export async function getPendingIntervention() {
  const module = getNativeModule();
  if (!module?.getPendingIntervention) return null;
  return module.getPendingIntervention();
}

export async function clearPendingIntervention() {
  const module = getNativeModule();
  if (!module?.clearPendingIntervention) return false;
  return module.clearPendingIntervention();
}

export async function classifyChallengePhoto(uri: string, expectedLabels: string[]): Promise<ChallengePhotoClassification> {
  const module = getNativeModule();
  if (!module?.classifyChallengePhoto) {
    return {
      available: false,
      matched: false,
      labels: [],
      matchedLabels: [],
      message: "On-device image classification is unavailable in this build."
    };
  }

  return module.classifyChallengePhoto(uri, expectedLabels);
}
