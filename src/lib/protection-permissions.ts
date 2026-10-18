import type { AppGuardMode } from './recovery-state';
import { describeAppGuard } from './app-guard';
import type { ProtectionActivationDiagnostics, ProtectionCapability, ProtectionStatus } from "freed-protection";
import {
  nativeAdultDomainFeedReadyForActivation,
  hasReviewedNativeAdultDomainFeed,
  safariAdultDomainFeedReadyForActivation
} from "./adult-domain-feed-provenance";
import { hasPrivateDnsSetupConflict } from "./protection-setup-presenter";

export type ProtectionIntent = 'websites' | 'apps' | 'both';

export type ProtectionPermissionStatus = "complete" | "needed" | "optional" | "unavailable";

export type ProtectionPermissionStep = {
  id: string;
  title: string;
  permissionLabel: string;
  platform: "ios" | "android" | "all" | "unknown";
  required: boolean;
  status: ProtectionPermissionStatus;
  reason: string;
  dataBoundary: string;
  action:
    | "configure-app-guard"
    | "apply-adult-filter"
    | "sync-adult-domain-feed"
    | "request-authorization"
    | "choose-ios-targets"
    | "choose-android-apps"
    | "open-settings"
    | "request-android-notification-permission"
    | "open-usage-access-settings"
    | "open-private-dns-settings"
    | "on-demand";
};

export const PROTECTION_PERMISSION_EXPLANATION =
  "To protect you from explicit content and doomscroll loops, FREED needs these permissions to monitor only selected apps and sites through platform APIs, block known adult domains, and open a recovery challenge when a harmful site, search, or app-limit threshold is reached.";

export function getSelectedScreenTimeTargetCount(status: ProtectionStatus | null): number {
  const individualCount =
    (status?.selectedApplications ?? 0) +
    (status?.selectedCategories ?? 0) +
    (status?.selectedWebDomains ?? 0);
  const aggregateCount = status?.selectedScreenTimeTokenCount ?? 0;

  return Math.max(0, individualCount, aggregateCount);
}

/** Purpose-specific setup never asks for the other feature's native permissions. */
export function buildProtectionPermissionPlan(
  capability: ProtectionCapability | null,
  status: ProtectionStatus | null,
  intent: ProtectionIntent = 'both',
  expectedAppGuardMode?: AppGuardMode
): ProtectionPermissionStep[] {
  let legacy = buildLegacyProtectionPermissionPlan(capability, status);
  if (capability?.appGuardModes === true) {
    const guard = describeAppGuard(capability, status, expectedAppGuardMode);
    legacy = legacy.map(step => step.id === 'ios-screen-time-targets' ? { ...step, title: 'Selected individual applications',
      status: !capability.screenTime ? 'unavailable' as const : guard.targets > 0 ? 'complete' as const : status?.authorized ? 'needed' as const : 'unavailable' as const,
      reason: 'Choose individual applications in Apple’s picker. Categories and domains remain available to older policies but cannot enable this app guard.' }
      : step.id === 'ios-selected-app-limit-monitor' ? { ...step, title: 'Saved app guard', permissionLabel: 'Native app guard configuration', action: 'configure-app-guard' as const,
        status: !guard.supported ? 'unavailable' as const : guard.ready ? 'complete' as const : 'needed' as const, reason: guard.explanation } : step);
    if (capability.platform === 'android') legacy.push({ id: 'android-app-guard', title: 'Saved app guard', permissionLabel: 'Native app guard configuration', platform: 'android', required: true,
      status: !guard.supported ? 'unavailable' : guard.ready ? 'complete' : 'needed', reason: guard.explanation, dataBoundary: 'Selected package IDs and native guard state only.', action: 'configure-app-guard' });
  }
  if (intent === 'both') return legacy;
  const websites = new Set([
    'ios-screen-time', 'ios-adult-web-filter', 'ios-safari-content-blocker',
    'android-native-adult-domain-feed', 'android-dns-guard',
    'android-recovery-notifications', 'android-private-dns-guidance', 'native-build-required',
  ]);
  const apps = new Set([
    'ios-screen-time', 'ios-screen-time-targets', 'ios-selected-app-limit-monitor',
    'android-app-guard', 'android-usage-access', 'android-accessibility', 'android-doomscroll-apps', 'native-build-required',
  ]);
  return legacy.filter(step => (intent === 'websites' ? websites : apps).has(step.id)).map(step => {
    if (step.id === 'ios-screen-time' && intent === 'apps' && !capability?.managedSettings) {
      return { ...step, status: 'unavailable' as const };
    }
    if (step.status === 'complete' && (step.id === 'ios-adult-web-filter' && (status?.authorized !== true || status?.adultFilterActive !== true) || step.id === 'ios-selected-app-limit-monitor' && status?.authorized !== true)) {
      return { ...step, status: 'needed' as const };
    }
    if (step.id === 'ios-safari-content-blocker') {
      return { ...step, required: false,
        reason: "Adds separate adult-domain rules in Safari. Apple's adult web policy can work independently." };
    }
    if (step.id === 'android-native-adult-domain-feed') {
      return { ...step, status: step.status === 'unavailable' ? step.status : hasReviewedNativeAdultDomainFeed(status) ? 'complete' as const : 'needed' as const,
        reason: 'Loads the reviewed adult-domain feed into Android DNS Guard before website protection is ready.' };
    }
    if (step.id === 'android-dns-guard') {
      const nativeReady = status?.adultFilterActive === true && status?.dnsGuardCoverageReady === true && status?.vpnConsentRequired !== true;
      return { ...step, status: step.status === 'complete' && !nativeReady ? 'needed' as const : step.status };
    }
    if (step.id === 'android-accessibility') {
      return { ...step, title: 'Selected app interruption',
        reason: capability?.appGuardModes ? 'Uses foreground app events to enforce the saved guard mode for selected packages.' : 'Uses foreground app events to enforce configured daily limits for selected packages.',
        dataBoundary: 'App limits use package IDs and foreground duration. App-limit setup does not request in-app content inspection.' };
    }
    return step;
  });
}

function buildLegacyProtectionPermissionPlan(
  capability: ProtectionCapability | null,
  status: ProtectionStatus | null
): ProtectionPermissionStep[] {
  const platform = capability?.platform ?? "unknown";
  const selectedIosTargets = getSelectedScreenTimeTargetCount(status);
  const reportedAdultFilterActive =
    status?.adultFilterActive ??
    Boolean(
      status?.active &&
        ((platform === "ios" && status.mode === "screen-time") ||
          (platform === "android" && (status.mode === "dns" || status.mode === "vpn-fallback")))
    );
  const androidNativeFeedReady = nativeAdultDomainFeedReadyForActivation(status);
  const androidPrivateDnsMode = status?.privateDnsMode;
  const androidDnsGuardRuntimeReady = status?.dnsGuardRuntimeReady === true &&
    status?.dnsGuardCaptivePaused !== true && status?.dnsGuardCoverageReady !== false &&
    status?.privateDnsActive !== true && (!androidPrivateDnsMode || androidPrivateDnsMode === "off");

  if (platform === "ios") {
    const screenTimeAvailable = Boolean(capability?.screenTime);
    const managedSettingsAvailable = Boolean(capability?.managedSettings);
    const safariContentBlockerAvailable = capability?.safariContentBlocker === true;
    return [
      {
        id: "ios-screen-time",
        title: "Screen Time protection",
        permissionLabel: "FamilyControls and ManagedSettings",
        platform,
        required: true,
        status: screenTimeAvailable ? (status?.authorized ? "complete" : "needed") : "unavailable",
        reason: "Allows FREED to request Apple's adult web filter, shield selected apps or domains, and relock after Screen Time-sourced earned unlocks.",
        dataBoundary: "Apple exposes opaque Screen Time tokens; FREED does not read other app screens or browsing history.",
        action: "request-authorization"
      },
      {
        id: "ios-adult-web-filter",
        title: "Adult web filter",
        permissionLabel: "ManagedSettings adult-content policy",
        platform,
        required: true,
        status: managedSettingsAvailable ? (reportedAdultFilterActive ? "complete" : "needed") : "unavailable",
        reason: "Applies Apple's low-latency adult-content web policy without packet inspection or screen-capture analysis.",
        dataBoundary: "Filtering happens through Screen Time settings; raw URLs are not stored by FREED.",
        action: "apply-adult-filter"
      },
      {
        id: "ios-screen-time-targets",
        title: "App and domain shields",
        permissionLabel: "FamilyActivityPicker",
        platform,
        required: true,
        status: screenTimeAvailable
          ? selectedIosTargets > 0
            ? "complete"
            : status?.authorized
              ? "needed"
              : "unavailable"
          : "unavailable",
        reason: "Lets the user choose which apps, categories, or domains can be shielded during high-risk windows.",
        dataBoundary: "Only selected opaque tokens and counts are stored in the shared app group.",
        action: "choose-ios-targets"
      },
      {
        id: "ios-selected-app-limit-monitor",
        title: "Selected app daily limit",
        permissionLabel: "DeviceActivity threshold events",
        platform,
        required: true,
        status: screenTimeAvailable
          ? status?.appLimitScheduled
            ? "complete"
            : selectedIosTargets > 0 && status?.authorized
              ? "needed"
              : "unavailable"
          : "unavailable",
        reason: "Lets iOS shield selected apps, categories, or domains after the configured daily limit without reading in-app screens.",
        dataBoundary: "The system reports only that selected opaque Screen Time tokens crossed a duration threshold.",
        action: "choose-ios-targets"
      },
      {
        id: "ios-safari-content-blocker",
        title: "Safari adult-domain rules",
        permissionLabel: "Safari Content Blocker",
        platform,
        required: true,
        status: safariContentBlockerAvailable
          ? safariAdultDomainFeedReadyForActivation(status)
            ? "complete"
            : "needed"
          : "unavailable",
        reason: "Loads the reviewed adult-domain feed into Safari as a first-line blocker for known explicit sites; production activation does not rely on the embedded seed alone.",
        dataBoundary: "Safari receives a domain rule list only; FREED does not inspect page contents.",
        action: "open-settings"
      },
      ...sharedOnDemandPermissionSteps(platform)
    ];
  }

  if (platform === "android") {
    const dnsGuardAvailable = Boolean(capability?.localVpnFallback);
    const nativeFeedAvailable = Boolean(capability?.dnsFiltering);
    const usageStatsAvailable = Boolean(capability?.usageStats);
    const accessibilityAvailable = Boolean(capability?.accessibility);
    const androidNotificationPermissionRequired = status?.androidNotificationPermissionRequired === true;
    const androidNotificationPermissionGranted = status?.androidNotificationPermissionGranted !== false;
    return [
      {
        id: "android-native-adult-domain-feed",
        title: "Reviewed adult-domain feed",
        permissionLabel: "Native feed sync",
        platform,
        required: true,
        status: nativeFeedAvailable ? (androidNativeFeedReady ? "complete" : "needed") : "unavailable",
        reason: "Loads the reviewed remote adult-domain feed into Android Accessibility and DNS Guard before activation; the embedded seed remains a local fallback only.",
        dataBoundary: "Native status exposes only the feed version, checksum, and domain count; FREED does not store browsing history.",
        action: "sync-adult-domain-feed"
      },
      {
        id: "android-dns-guard",
        title: "Adult-domain DNS Guard",
        permissionLabel: "DNS-only VPN permission",
        platform,
        required: true,
        status: dnsGuardAvailable ? (reportedAdultFilterActive && androidDnsGuardRuntimeReady ? "complete" : "needed") : "unavailable",
        reason: "Blocks known adult domains at DNS lookup time without routing all device traffic through FREED.",
        dataBoundary: "Only DNS questions are classified locally; FREED does not MITM HTTPS or proxy normal traffic.",
        action: "apply-adult-filter"
      },
      {
        id: "android-recovery-notifications",
        title: "Recovery notification visibility",
        permissionLabel: "Notifications",
        platform,
        required: false,
        status: dnsGuardAvailable
          ? !androidNotificationPermissionRequired || androidNotificationPermissionGranted
            ? "complete"
            : "optional"
          : "unavailable",
        reason: "Keeps the DNS Guard recovery-challenge notification visible on Android 13+ when Android blocks a background challenge launch.",
        dataBoundary: "Notifications contain route/kind metadata and a redacted blocked host only; FREED does not store notification history or full DNS history.",
        action: "request-android-notification-permission"
      },
      {
        id: "android-usage-access",
        title: "Usage timer checks",
        permissionLabel: "Usage Access",
        platform,
        required: true,
        status: usageStatsAvailable ? (status?.usageStatsAuthorized ? "complete" : "needed") : "unavailable",
        reason: "Lets FREED cross-check same-day foreground time for selected apps so limits survive app switches and service restarts.",
        dataBoundary: "FREED reads aggregate foreground duration for selected packages only, not in-app content or screen text.",
        action: "open-usage-access-settings"
      },
      {
        id: "android-accessibility",
        title: "App and browser interruption",
        permissionLabel: "Accessibility Service",
        platform,
        required: true,
        status: accessibilityAvailable ? (status?.appInterventionAuthorized ? "complete" : "needed") : "unavailable",
        reason: "Detects supported browser address fields, selected app launches, and sustained short-form loops for challenge handoff.",
        dataBoundary: "Processing stays on device and is limited to app package, focused URL/search fields, labels, and scroll events.",
        action: "request-authorization"
      },
      {
        id: "android-doomscroll-apps",
        title: "Doomscroll app limits",
        permissionLabel: "Selected app packages",
        platform,
        required: true,
        status:
          accessibilityAvailable &&
          usageStatsAvailable &&
          (status?.blockedApplications ?? 0) > 0 &&
          status?.usageStatsAuthorized
            ? "complete"
            : accessibilityAvailable && usageStatsAvailable
              ? "needed"
              : "unavailable",
        reason: "Keeps Instagram, YouTube, TikTok, X, and Reddit interruptions tied to configured limits and source-scoped app or short-form earned unlocks.",
        dataBoundary: "FREED stores supported package IDs and usage duration, not in-app content.",
        action: "choose-android-apps"
      },
      {
        id: "android-private-dns-guidance",
        title: "Private DNS guidance",
        permissionLabel: "Android Network & internet settings",
        platform,
        required: false,
        status: androidPrivateDnsMode === "hostname" ? "needed" : androidPrivateDnsMode === "off" ? "complete" : "optional",
        reason: "Strict Private DNS can change DNS Guard resolver behavior, so FREED guides you to review it before release or device QA.",
        dataBoundary: "FREED reads only Android's Private DNS mode/specifier setting for diagnostics; it does not read DNS history or change DNS settings silently.",
        action: "open-private-dns-settings"
      },
      ...sharedOnDemandPermissionSteps(platform)
    ];
  }

  return [
    {
      id: "native-build-required",
      title: "Native protection build",
      permissionLabel: "Signed iOS or Android app",
      platform: "unknown",
      required: true,
      status: "unavailable",
      reason: "Real blocking requires native platform APIs that are unavailable in Expo Go or web preview.",
      dataBoundary: "The preview keeps recovery state local and does not simulate device-wide monitoring.",
      action: "open-settings"
    },
    ...sharedOnDemandPermissionSteps("unknown")
  ];
}

export function getProtectionPermissionProgress(steps: ProtectionPermissionStep[]) {
  const required = steps.filter((step) => step.required);
  const complete = required.filter((step) => step.status === "complete");
  return {
    complete: complete.length,
    required: required.length,
    ready: required.length > 0 && complete.length === required.length
  };
}

export function getProtectionActivationRecoveryStep(
  steps: ProtectionPermissionStep[],
  diagnostics: ProtectionActivationDiagnostics | null | undefined
): ProtectionPermissionStep | null {
  if (!diagnostics || diagnostics.nativeChecksPassed) return null;

  const issueCodes = new Set(diagnostics.issueCodes ?? []);
  const hasCode = (...codes: string[]) => codes.some((code) => issueCodes.has(code));
  const issueText = (diagnostics.issues ?? []).join(" ").toLowerCase();
  const findStep = (...ids: string[]) => ids.map((id) => steps.find((step) => step.id === id)).find(Boolean) ?? null;

  if (diagnostics.platform === "android") {
    if (
      hasCode("android-adult-feed-empty", "android-adult-feed-not-reviewed") ||
      (diagnostics.adultDomainFeedDomainCount ?? 0) <= 0 ||
      issueText.includes("reviewed remote provenance")
    ) {
      return findStep("android-native-adult-domain-feed");
    }
    if (
      hasPrivateDnsSetupConflict(diagnostics) ||
      hasCode("android-private-dns-strict-unsupported", "android-private-dns-encrypted-unsupported", "android-private-dns-state-unknown")
    ) {
      return findStep("android-private-dns-guidance", "android-dns-guard");
    }
    if (
      hasCode(
        "android-dns-guard-not-running",
        "android-dns-guard-runtime-not-ready",
        "android-dns-guard-resolvers-empty",
        "android-vpn-consent-required"
      ) ||
      diagnostics.vpnConsentRequired === true ||
      diagnostics.dnsGuardActive === false ||
      diagnostics.dnsGuardRuntimeReady === false ||
      issueText.includes("dns guard")
    ) {
      return findStep("android-dns-guard");
    }
    if (hasCode("android-usage-access-disabled") || diagnostics.usageStatsAuthorized === false) {
      return findStep("android-usage-access");
    }
    if (hasCode("android-accessibility-disabled") || diagnostics.appInterventionAuthorized === false) {
      return findStep("android-accessibility");
    }
    if (hasCode("android-selected-apps-missing") || (diagnostics.blockedApplications ?? 0) <= 0) {
      return findStep("android-doomscroll-apps");
    }
    if (
      diagnostics.androidNotificationPermissionRequired === true &&
      diagnostics.androidNotificationPermissionGranted === false
    ) {
      return findStep("android-recovery-notifications");
    }
    if (
      hasCode("android-adult-smoke-not-blocked", "android-normal-smoke-blocked") ||
      diagnostics.adultBlocked === false ||
      diagnostics.normalAllowed === false
    ) {
      return findStep("android-dns-guard");
    }
    return null;
  }

  if (diagnostics.platform === "ios") {
    if (
      hasCode("ios-screen-time-authorization-missing") ||
      diagnostics.appInterventionAuthorized === false ||
      issueText.includes("screen time authorization")
    ) {
      return findStep("ios-screen-time");
    }
    if (hasCode("ios-adult-filter-inactive") || issueText.includes("managedsettings adult web filter")) {
      return findStep("ios-adult-web-filter", "ios-screen-time");
    }
    if (
      hasCode("ios-screen-time-targets-missing") ||
      (diagnostics.blockedApplications ?? 0) <= 0 ||
      issueText.includes("no screen time")
    ) {
      return findStep("ios-screen-time-targets");
    }
    if (hasCode("ios-device-activity-monitor-missing") || issueText.includes("deviceactivity")) {
      return findStep("ios-selected-app-limit-monitor", "ios-screen-time-targets");
    }
    if (
      hasCode(
        "ios-safari-rules-missing",
        "ios-safari-extension-disabled",
        "ios-safari-feed-not-reviewed",
        "ios-adult-smoke-not-blocked",
        "ios-normal-smoke-blocked"
      ) ||
      (diagnostics.safariContentBlockerRuleCount ?? 0) <= 0 ||
      diagnostics.safariContentBlockerEnabled === false ||
      issueText.includes("safari content blocker") ||
      diagnostics.adultBlocked === false ||
      diagnostics.normalAllowed === false
    ) {
      return findStep("ios-safari-content-blocker");
    }
    return null;
  }

  return null;
}

function sharedOnDemandPermissionSteps(platform: ProtectionPermissionStep["platform"]): ProtectionPermissionStep[] {
  const reminders: ProtectionPermissionStep = {
    id: "local-reminders-optional",
    title: "Recovery reminders",
    permissionLabel: "Notifications",
    platform: "all",
    required: false,
    status: "optional",
    reason: "Schedules local check-in and Night Guard reminders if the user opts in.",
    dataBoundary: "Notification payloads contain route/kind metadata only, not streaks, slips, URLs, or private notes.",
    action: "on-demand"
  };

  if (platform === "ios") {
    return [
      {
        id: "ios-challenge-photo-on-demand",
        title: "Photo challenge verification",
        permissionLabel: "Camera and on-device Vision labels",
        platform,
        required: false,
        status: "optional",
        reason: "Verifies a fresh photo challenge only when the user opens the camera for that challenge.",
        dataBoundary: "No camera roll access, media upload, continuous camera analysis, continuous image classification, screen-capture analysis, or OCR is used.",
        action: "on-demand"
      },
      {
        id: "ios-challenge-motion-on-demand",
        title: "Walking and exercise verification",
        permissionLabel: "Motion sensors and pedometer",
        platform,
        required: false,
        status: "optional",
        reason: "Verifies walking, step, or exercise challenges only while the active challenge is running.",
        dataBoundary: "Foreground motion and pedometer samples are used for challenge completion only; FREED does not sync HealthKit history or run background fitness monitoring.",
        action: "on-demand"
      },
      {
        id: "ios-challenge-location-on-demand",
        title: "Outdoor challenge verification",
        permissionLabel: "Foreground location",
        platform,
        required: false,
        status: "optional",
        reason: "Verifies outdoor movement challenges with accurate foreground location samples only after the user starts that challenge.",
        dataBoundary: "No background location tracking is used; exact coordinates are not sent to AI or stored as recovery history.",
        action: "on-demand"
      },
      reminders
    ];
  }

  if (platform === "android") {
    return [
      {
        id: "android-challenge-photo-on-demand",
        title: "Photo challenge verification",
        permissionLabel: "Camera and on-device ML Kit labels",
        platform,
        required: false,
        status: "optional",
        reason: "Verifies a fresh photo challenge only when the user opens the camera for that challenge.",
        dataBoundary: "No gallery/media-library access, media upload, continuous camera analysis, continuous image classification, screen-capture analysis, or OCR is used.",
        action: "on-demand"
      },
      {
        id: "android-challenge-activity-on-demand",
        title: "Walking and exercise verification",
        permissionLabel: "Activity Recognition, sensors, and steps",
        platform,
        required: false,
        status: "optional",
        reason: "Verifies walking, step, or exercise challenges only while the active challenge is running.",
        dataBoundary: "Foreground activity, accelerometer, and step samples are used for challenge completion only; FREED does not run background fitness monitoring or sync Health Connect history.",
        action: "on-demand"
      },
      {
        id: "android-challenge-location-on-demand",
        title: "Outdoor challenge verification",
        permissionLabel: "Foreground location",
        platform,
        required: false,
        status: "optional",
        reason: "Verifies outdoor movement challenges with accurate foreground location samples only after the user starts that challenge.",
        dataBoundary: "No background location tracking is used; exact coordinates are not sent to AI or stored as recovery history.",
        action: "on-demand"
      },
      reminders
    ];
  }

  return [
    {
      id: "challenge-verification-on-demand",
      title: "Challenge verification",
      permissionLabel: "Camera, motion, steps, and location",
      platform: "all",
      required: false,
      status: "optional",
      reason: "Verifies walking, outdoor movement, exercise, or photo challenges only when the user starts that challenge.",
      dataBoundary: "No continuous camera, image classification, screenshot, OCR, or background location analysis is used.",
      action: "on-demand"
    },
    reminders
  ];
}
