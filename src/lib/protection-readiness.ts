import type { ProtectionCapability, ProtectionStatus } from "freed-protection";
import { nativeAdultDomainFeedReadyForActivation } from "./adult-domain-feed-provenance";
import {
  buildProtectionPermissionPlan,
  getSelectedScreenTimeTargetCount,
  getProtectionPermissionProgress,
  type ProtectionPermissionStep
} from "./protection-permissions";

export type ProtectionSetupReadiness = {
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
  selectedAppPackageCount: number
): ProtectionSetupReadiness {
  const selectedIosTargets = getSelectedScreenTimeTargetCount(protectionStatus);
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
      ? Boolean(protectionCapability.managedSettings && reportedAdultFilterActive)
    : protectionCapability?.platform === "android"
      ? Boolean(
          protectionCapability.localVpnFallback &&
            reportedAdultFilterActive &&
            protectionStatus?.dnsGuardRuntimeReady === true
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
  const appInterventionReady =
    protectionCapability?.platform === "ios"
      ? Boolean(
          protectionCapability.screenTime &&
            protectionStatus?.authorized &&
            selectedIosTargets > 0 && protectionStatus?.appLimitScheduled
        )
    : protectionCapability?.platform === "android"
      ? Boolean(
          protectionCapability.accessibility &&
            protectionCapability.usageStats &&
            protectionStatus?.appInterventionAuthorized &&
            protectionStatus?.usageStatsAuthorized &&
            nativeConfiguredAppCount > 0
        )
      : false;
  const permissionPlan = buildProtectionPermissionPlan(protectionCapability, protectionStatus);
  const permissionProgress = getProtectionPermissionProgress(permissionPlan);

  return {
    selectedIosTargets,
    adultFilterActive,
    nativeAdultFeedCount,
    nativeConfiguredAppCount,
    appInterventionReady,
    appCount,
    permissionPlan,
    permissionProgress,
    activationReady: permissionProgress.ready && adultFilterActive && appInterventionReady
  };
}
