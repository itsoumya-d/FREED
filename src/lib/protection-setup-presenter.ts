import type { ProtectionPermissionStep } from "./protection-permissions";

type SetupContext = {
  platform: "ios" | "android" | "preview";
  step: ProtectionPermissionStep | null;
  complete: boolean;
  ready: boolean;
  busy: string | null;
  dnsStarting?: boolean;
  dnsFailed?: boolean;
  vpnConflict?: boolean;
  privateDnsConflict?: boolean;
};

// Background configuration shares a stage with the preceding human decision.
// Five readiness checks therefore don't become five permission prompts.
export function presentProtectionSetup(context: SetupContext) {
  const ios = context.platform === "ios";
  const total = ios ? 4 : 5;
  const steps: Record<string, { stage: number; title: string; description: string; action: string; instruction: string }> = {
    "ios-screen-time": { stage: 1, title: "Allow Screen Time", description: "Let FREED protect the apps and websites you choose.", action: "Allow Screen Time", instruction: "Approve access in Apple's prompt. You may be asked for your passcode or Face ID." },
    "ios-adult-web-filter": { stage: 1, title: "Turn on web protection", description: "FREED applies Apple's adult-content filter on this iPhone.", action: "Turn on protection", instruction: "We'll apply the filter and take you to app selection." },
    "ios-screen-time-targets": { stage: 2, title: "Choose what to protect", description: "Pick the apps, categories or websites you want help stepping away from.", action: "Choose apps", instruction: "Select at least one item in Apple's picker, then tap Done." },
    "ios-selected-app-limit-monitor": { stage: 2, title: "Set your daily app limit", description: "Choose a daily limit for the apps you selected.", action: "Set daily limit", instruction: "Confirm your selection and daily limit in the picker." },
    "ios-safari-content-blocker": { stage: 3, title: "Protect Safari", description: "Enable FREED Safari Blocker to block known adult websites in Safari.", action: "Open Safari settings", instruction: "Turn on FREED Safari Blocker, then return here. On older iPhones, find Safari → Extensions in Settings." },
    "android-native-adult-domain-feed": { stage: 1, title: "Prepare web protection", description: "Load the website list that FREED uses to block adult content.", action: "Prepare protection", instruction: "We'll prepare the list, then open Android's connection request." },
    "android-dns-guard": { stage: 1, title: "Protect your browsing", description: "FREED filters website addresses on your phone using Android's local VPN connection.", action: "Allow connection", instruction: "Read the disclosure, then tap OK on Android's connection request. Only one VPN can run at a time." },
    "android-usage-access": { stage: 2, title: "Allow app timers", description: "Usage access lets FREED know when your selected apps reach their daily limit.", action: "Open usage access", instruction: "Select FREED and allow usage access, then return here." },
    "android-accessibility": { stage: 3, title: "Enable app protection", description: "Let FREED interrupt selected apps and blocked browser attempts with a recovery reset.", action: "Open accessibility", instruction: "Open FREED Protection under downloaded or installed apps, turn it on, then return here." },
    "android-doomscroll-apps": { stage: 4, title: "Choose what to protect", description: "Select the apps where you want a daily limit and a moment to pause.", action: "Choose apps", instruction: "Choose at least one app. We'll save your selection and check protection." }
  };
  if (context.platform === "preview") return { stage: 1, total: 1, title: "Preview FREED", description: "Device protection is available in the Android and iPhone apps.", action: "Continue preview", instruction: "You can explore recovery tools here.", icon: "phone" as const };
  const current = context.complete
    ? { stage: total, title: "Configuration ready", description: "Your required permissions and local configuration checks passed on this device.", action: "Continue", instruction: "Check actual browsing before relying on protection. You can change settings anytime from Protect." }
    : context.step ? steps[context.step.id]
    : { stage: total, title: "Check configuration", description: "Check native permissions, feed readiness and local URL classification.", action: context.ready ? "Check configuration" : "Refresh setup", instruction: "This check does not open websites or verify real browser or network blocking." };
  const fallback = { stage: 1, title: "Check device support", description: "This build needs native protection support to finish setup.", action: "Refresh setup", instruction: "Open Help for available options on this device." };
  const presentation = context.step?.status === 'unavailable' ? fallback : current ?? fallback;
  return {
    ...presentation,
    ...(context.privateDnsConflict && context.step?.id === "android-dns-guard" && context.step.status !== "unavailable" ? {
      title: "Private DNS guidance",
      description: "Android's DNS settings need review before FREED can start web protection. App protection and recovery tools remain available.",
      instruction: "Review Private DNS settings, then return here and check protection again."
    } : {}),
    ...(context.vpnConflict && context.step?.id === "android-dns-guard" ? {
      title: "Free the VPN connection",
      description: "Another VPN is using the connection FREED needs for web protection.",
      instruction: "Open VPN settings and disconnect the other VPN, then return here. We'll check the connection and start protection."
    } : {}),
    total,
    action: context.busy ? (context.busy === "test" ? "Checking configuration…" : "Setting up…")
      : context.vpnConflict && context.step?.id === "android-dns-guard" ? "Open VPN settings"
      : context.privateDnsConflict && context.step?.id === "android-dns-guard" && context.step.status !== "unavailable" ? "Open Private DNS settings"
      : context.dnsStarting && context.step?.id === "android-dns-guard" ? "Starting protection…"
      : context.dnsFailed && context.step?.id === "android-dns-guard" ? "Retry connection" : presentation.action,
    icon: context.complete ? "check" as const : context.step?.id.includes("targets") || context.step?.id.includes("apps") ? "apps" as const : "shield" as const
  };
}

export function hasVpnSetupConflict(status: {
  otherVpnActive?: boolean;
  vpnConsentRequired?: boolean;
  adultFilterActive?: boolean;
  dnsGuardLastStopReason?: string | null;
  alwaysOnVpnPackage?: string | null;
  privateDnsMode?: string;
  privateDnsActive?: boolean;
} | null): boolean {
  if (!status || status.adultFilterActive) return false;
  if (status.alwaysOnVpnPackage && status.alwaysOnVpnPackage !== "app.freed.recovery") return true;
  return status.otherVpnActive === true && status.vpnConsentRequired === false;
}

export function hasPrivateDnsSetupConflict(status: { privateDnsMode?: string; privateDnsActive?: boolean } | null): boolean {
  return status?.privateDnsActive === true ||
    (typeof status?.privateDnsMode === "string" && status.privateDnsMode !== "off");
}

export function canAutoStartDnsGuard(disclosureAcknowledged: boolean, status: Parameters<typeof hasVpnSetupConflict>[0]): boolean {
  return disclosureAcknowledged && status?.vpnConsentRequired === false && status.adultFilterActive !== true &&
    !hasVpnSetupConflict(status) && !hasPrivateDnsSetupConflict(status);
}

export type SetupAdvancePending = {
  fromStepId: string;
  waitingForAppReturn?: boolean;
  returnedFromExternalStep?: boolean;
  continueAfterOptional?: boolean;
  testTriggered?: boolean;
};

export function decideSetupAdvance(options: {
  pending: SetupAdvancePending | null;
  steps: ProtectionPermissionStep[];
  busy: boolean;
  native: boolean;
  complete: boolean;
  ready: boolean;
  testPassed: boolean;
}): { action: "wait" | "clear" | "test" } | { action: "step"; step: ProtectionPermissionStep } {
  const pending = options.pending;
  if (!pending || options.busy || !options.native) return { action: "wait" };
  if (options.complete) return { action: "clear" };
  const previous = options.steps.find(step => step.id === pending.fromStepId);
  if (!previous) return { action: "wait" };
  if (pending.waitingForAppReturn && !pending.returnedFromExternalStep && previous.status !== "complete") return { action: "wait" };
  if (previous.status !== "complete" && !pending.continueAfterOptional) return { action: "wait" };
  const next = options.steps.find(step => step.required && step.status !== "complete");
  if (next && next.id !== previous.id) return { action: "step", step: next };
  if (options.ready && !options.testPassed && !pending.testTriggered) return { action: "test" };
  return { action: options.testPassed ? "clear" : "wait" };
}

export function safariSetupAction(enabled: boolean | null | undefined): "settings" | "sync" {
  return enabled === true ? "sync" : "settings";
}
