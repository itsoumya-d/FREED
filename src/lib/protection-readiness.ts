import type { AppGuardMode } from './recovery-state';
import { describeAppGuard } from './app-guard';
import type { ProtectionCapability, ProtectionStatus } from "freed-protection";
import { nativeAdultDomainFeedReadyForActivation, safariAdultDomainFeedReadyForActivation, hasReviewedNativeAdultDomainFeed } from "./adult-domain-feed-provenance";
import {
  buildProtectionPermissionPlan,
  getSelectedScreenTimeTargetCount,
  getProtectionPermissionProgress,
  type ProtectionIntent,
  type ProtectionPermissionStep
} from "./protection-permissions";

export type { ProtectionIntent } from './protection-permissions';
export type ProtectionFeatureStatus = 'On' | 'Off' | 'Needs attention' | 'Unavailable';
export type ProtectionFeatureReadiness = {
  status: ProtectionFeatureStatus;
  ready: boolean;
  supported: boolean;
  scope: string;
  explanation: string;
};

export type ProtectionSetupReadiness = {
  intent: ProtectionIntent;
  websiteProtectionReady: boolean;
  appLimitsReady: boolean;
  safariCoverageReady: boolean;
  websiteProtection: ProtectionFeatureReadiness;
  appLimits: ProtectionFeatureReadiness;
  safariCoverage: ProtectionFeatureReadiness;
  selectedIosTargets: number;
  adultFilterActive: boolean;
  nativeAdultFeedCount: number;
  nativeConfiguredAppCount: number;
  appInterventionReady: boolean;
  appCount: number;
  permissionPlan: ProtectionPermissionStep[];
  permissionProgress: ReturnType<typeof getProtectionPermissionProgress>;
  activationReady: boolean;
};

export function getProtectionSetupReadiness(
  protectionCapability: ProtectionCapability | null,
  protectionStatus: ProtectionStatus | null,
  selectedAppPackageCount: number,
  intent: ProtectionIntent = 'both',
  expectedAppGuardMode?: AppGuardMode
): ProtectionSetupReadiness {
  const appGuard = describeAppGuard(protectionCapability, protectionStatus, expectedAppGuardMode);
  const selectedIosTargets = protectionCapability?.platform === 'ios' && protectionCapability.appGuardModes === true ? appGuard.targets : getSelectedScreenTimeTargetCount(protectionStatus);
  const reportedAdultFilterActive =
    protectionStatus?.adultFilterActive ??
    Boolean(
      protectionStatus?.active &&
        ((protectionCapability?.platform === "ios" && protectionStatus.mode === "screen-time") ||
          (protectionCapability?.platform === "android" &&
            (protectionStatus.mode === "dns" || protectionStatus.mode === "vpn-fallback")))
    );
  const adultFilterActive =
    protectionCapability?.platform === "ios"
      ? Boolean(protectionCapability.managedSettings && protectionStatus?.authorized === true && reportedAdultFilterActive && protectionStatus?.adultWebPolicyConfigured !== false)
    : protectionCapability?.platform === "android"
      ? Boolean(
          protectionCapability.localVpnFallback &&
            reportedAdultFilterActive &&
            protectionStatus?.dnsGuardRuntimeReady === true &&
            protectionStatus?.dnsGuardCaptivePaused !== true &&
            protectionStatus?.dnsGuardCoverageReady === true &&
            protectionStatus?.privateDnsActive !== true &&
            (!protectionStatus?.privateDnsMode || protectionStatus.privateDnsMode === "off")
        )
      : false;
  const nativeAdultFeedCount =
    protectionCapability?.platform === "android" && protectionCapability.dnsFiltering
      ? nativeAdultDomainFeedReadyForActivation(protectionStatus)
        ? protectionStatus?.adultDomainFeedDomainCount ?? 0
        : 0
      : 0;
  const nativeConfiguredAppCount = protectionStatus?.blockedApplications ?? 0;
  const appCount = nativeConfiguredAppCount > 0 ? nativeConfiguredAppCount : selectedAppPackageCount;
  const appInterventionReady = appGuard.ready;
  const platform = protectionCapability?.platform;
  const websiteSupported = platform === 'ios'
    ? Boolean(protectionCapability?.screenTime && protectionCapability?.managedSettings)
    : platform === 'android'
      ? Boolean(protectionCapability?.localVpnFallback && protectionCapability?.dnsFiltering)
      : false;
  const appLimitsSupported = platform === 'ios'
    ? Boolean(protectionCapability?.screenTime && protectionCapability?.managedSettings)
    : platform === 'android'
      ? Boolean(protectionCapability?.accessibility && protectionCapability?.usageStats)
      : false;
  const resetDisabled = protectionStatus?.protectionConfigurationResetDisabled === true;
  const websiteProtectionReady = !resetDisabled && websiteSupported && protectionStatus?.adultFilterActive === true && adultFilterActive &&
    (platform !== 'android' || nativeAdultFeedCount > 0 && hasReviewedNativeAdultDomainFeed(protectionStatus) && protectionStatus?.vpnConsentRequired !== true);
  const appLimitsReady = !resetDisabled && appLimitsSupported && appInterventionReady;
  const safariSupported = platform === 'ios' && protectionCapability?.safariContentBlocker === true;
  const safariCoverageReady = !resetDisabled && safariSupported && safariAdultDomainFeedReadyForActivation(protectionStatus);
  const websiteConfigured = !resetDisabled && Boolean(protectionStatus?.adultFilterRequested || reportedAdultFilterActive || protectionStatus?.dnsGuardUserEnabled ||
    (platform === 'android' && (protectionStatus?.dnsGuardRuntimeReady || protectionStatus?.dnsGuardCaptivePaused)));
  const appsConfigured = !resetDisabled && Boolean(platform === 'ios' ? selectedIosTargets > 0 || protectionStatus?.appLimitScheduled
    : nativeConfiguredAppCount > 0 || protectionStatus?.appInterventionAuthorized || protectionStatus?.usageStatsAuthorized);
  const safariConfigured = !resetDisabled && Boolean(protectionStatus?.safariContentBlockerEnabled || (protectionStatus?.safariContentBlockerRuleCount ?? 0) > 0);
  const websiteProtection = featureReadiness(websiteSupported, websiteProtectionReady, websiteConfigured,
    platform === 'ios' ? "Apple's adult-content web policy through authorized Screen Time."
      : platform === 'android' ? 'Reviewed adult-domain blocking at DNS lookups covered by DNS Guard.' : 'Native website protection is unavailable in this preview.',
    platform === 'ios' ? 'The Apple adult web policy works independently of target selection and additional Safari rules. It does not inspect in-app content.'
      : platform === 'android' ? 'Website protection requires a ready DNS Guard runtime and feed. Private DNS conflicts or captive sign-in can interrupt coverage. It does not inspect in-app content.'
        : 'Website blocking requires a supported native iOS or Android build.');
  const appLimits = featureReadiness(appLimitsSupported, appLimitsReady, appsConfigured,
    appGuard.scope, appGuard.explanation);
  const safariCoverage = featureReadiness(safariSupported, safariCoverageReady, safariConfigured,
    'Additional adult-domain rule coverage in Safari.',
    "Safari extension coverage is separate from Apple's adult web policy. Enabling the extension and loading a valid rule feed adds this coverage; it does not inspect page content.");
  const permissionPlan = buildProtectionPermissionPlan(protectionCapability, protectionStatus, intent, expectedAppGuardMode).map(step =>
    platform === 'ios' && step.id === 'ios-adult-web-filter' && protectionStatus?.adultWebPolicyConfigured === false && step.status === 'complete'
      ? { ...step, status: 'needed' as const } : step);
  const permissionProgress = getProtectionPermissionProgress(permissionPlan);

  return {
    intent, websiteProtectionReady, appLimitsReady, safariCoverageReady,
    websiteProtection, appLimits, safariCoverage,
    selectedIosTargets,
    adultFilterActive,
    nativeAdultFeedCount,
    nativeConfiguredAppCount,
    appInterventionReady,
    appCount,
    permissionPlan,
    permissionProgress,
    // Default combined setup intentionally retains the legacy strict activation calculation.
    activationReady: !resetDisabled && permissionProgress.ready && (intent === 'websites' ? websiteProtectionReady
      : intent === 'apps' ? appLimitsReady : adultFilterActive && appInterventionReady)
  };
}

function featureReadiness(supported: boolean, ready: boolean, configured: boolean, scope: string, explanation: string): ProtectionFeatureReadiness {
  return { supported, ready, scope, explanation,
    status: !supported ? 'Unavailable' : ready ? 'On' : configured ? 'Needs attention' : 'Off' };
}
