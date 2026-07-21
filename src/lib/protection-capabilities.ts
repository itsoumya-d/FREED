import type { ProtectionCapability, ProtectionStatus } from "freed-protection";

import type { BlockingAttempt } from "./blocking-engine";
import {
  sanitizeFocusShieldRule,
  type FocusShieldInterventionScope,
  type FocusShieldRule
} from "./focus-shield";
import {
  createNativeInterventionAttempt,
  isFreshPendingIntervention,
  type NativeInterventionAttempt,
  type NativePendingInterventionPayload
} from "./native-intervention";
import type { ChallengeOutcome } from "./recovery-engine";

/**
 * Deliberately excludes selector fingerprints and calibration payloads. This is
 * the only Focus Shield rule shape React UI state should retain.
 */
export type FocusShieldRuleSummary = Pick<
  FocusShieldRule,
  "id" | "packageName" | "displayLabel" | "kind" | "enabled" | "presetId"
>;

export type FocusShieldCapabilityModel = {
  platform: ProtectionCapability["platform"] | "unknown";
  available: boolean;
  calibrationAvailable: boolean;
  ruleManagementAvailable: boolean;
  description: string;
  diagnostics: string[];
};

export type PendingInterventionTracker = {
  inFlight: boolean;
  consumedKeys: Set<string>;
};

type ScopedBlockingAttempt = BlockingAttempt & { scope?: FocusShieldInterventionScope };

export function summarizeFocusShieldRules(rules: readonly unknown[]): FocusShieldRuleSummary[] {
  return rules.flatMap((candidate) => {
    const rule = sanitizeFocusShieldRule(candidate);
    if (!rule) return [];

    const summary: FocusShieldRuleSummary = {
      id: rule.id,
      packageName: rule.packageName,
      displayLabel: rule.displayLabel,
      kind: rule.kind,
      enabled: rule.enabled
    };
    if (rule.presetId) summary.presetId = rule.presetId;
    return [summary];
  });
}

export function getFocusShieldCapabilityModel(
  capability: ProtectionCapability | null,
  status: ProtectionStatus | null,
  rules: readonly FocusShieldRuleSummary[]
): FocusShieldCapabilityModel {
  const platform = capability?.platform ?? "unknown";
  const diagnostics: string[] = [];

  if (platform === "android") {
    if (!capability?.accessibility) {
      diagnostics.push("This Android build does not expose the Accessibility-backed Focus Shield capability.");
    } else if (status?.appInterventionAuthorized !== true) {
      diagnostics.push("Focus Shield permission was revoked. Re-enable FREED Protection in Accessibility settings.");
    }
    if (status?.focusShieldRuleStoreHealth === "degraded") {
      diagnostics.push("The local Focus Shield rule store is degraded or stale. Remove and re-add affected rules.");
    }
    if (
      typeof status?.focusShieldRuleCount === "number" &&
      status.focusShieldRuleCount !== rules.length
    ) {
      diagnostics.push(
        `Native status reports ${status.focusShieldRuleCount} local rule${status.focusShieldRuleCount === 1 ? "" : "s"}, but ${rules.length} loaded. Refresh stale rules before relying on them.`
      );
    }

    return {
      platform,
      available: capability?.accessibility === true,
      calibrationAvailable: capability?.accessibility === true,
      ruleManagementAvailable: capability?.accessibility === true,
      description:
        "Android Focus Shield interrupts selected native-app surfaces using local selector fingerprints. FREED never keeps screen text, screenshots, or raw accessibility trees in recovery state.",
      diagnostics
    };
  }

  if (platform === "ios") {
    if (!capability?.screenTime || !capability?.managedSettings) {
      diagnostics.push("Family Controls entitlement or ManagedSettings capability is missing from this iOS build.");
    } else if (status?.authorized !== true) {
      diagnostics.push("Screen Time permission was revoked. Authorize Family Controls again to restore selected shields.");
    }
    diagnostics.push(
      "iOS native-app limit: FREED cannot inspect native-app screens or calibrate individual in-app surfaces. Use opaque Screen Time app/category tokens instead."
    );

    return {
      platform,
      available: Boolean(capability?.screenTime && capability?.managedSettings),
      calibrationAvailable: false,
      ruleManagementAvailable: false,
      description:
        "iOS cannot inspect native-app screens. Focus Shield uses Screen Time selections for apps and the Safari content blocker for supported short-form web routes.",
      diagnostics
    };
  }

  diagnostics.push(
    "Focus Shield native capabilities are unavailable in this preview build. Test calibration and rule enforcement in a signed Android or iOS device build."
  );
  return {
    platform,
    available: false,
    calibrationAvailable: false,
    ruleManagementAvailable: false,
    description:
      "Preview builds can show Focus Shield setup copy, but they cannot inspect native app surfaces or enforce device shields.",
    diagnostics
  };
}

export function shouldBypassRewardedAdForAttempt(attempt: BlockingAttempt | null | undefined): boolean {
  return Boolean(attempt && attempt.source !== "manual-check");
}

export function getProtectionChallengeCompletionDecision(
  attempt: ScopedBlockingAttempt | null | undefined,
  outcome: ChallengeOutcome
): { grantEarnedUnlock: boolean; applyFocusShieldScope: boolean } {
  const grantEarnedUnlock = outcome === "helped";
  return {
    grantEarnedUnlock,
    applyFocusShieldScope: Boolean(
      grantEarnedUnlock && attempt?.scope?.kind === "android-surface"
    )
  };
}

export function createPendingInterventionTracker(): PendingInterventionTracker {
  return { inFlight: false, consumedKeys: new Set<string>() };
}

export async function consumePendingInterventionOnce({
  tracker,
  getPending,
  clearPending,
  nowMs = Date.now()
}: {
  tracker: PendingInterventionTracker;
  getPending: () => Promise<NativePendingInterventionPayload | null>;
  clearPending: () => Promise<boolean>;
  nowMs?: number;
}): Promise<NativeInterventionAttempt | null> {
  if (tracker.inFlight) return null;
  tracker.inFlight = true;

  try {
    const pending = await getPending();
    if (!pending) return null;

    const key = getPendingInterventionKey(pending);
    if (tracker.consumedKeys.has(key)) return null;
    tracker.consumedKeys.add(key);
    trimConsumedInterventionKeys(tracker.consumedKeys);

    try {
      const cleared = await clearPending();
      if (!cleared) {
        tracker.consumedKeys.delete(key);
        return null;
      }
    } catch (error) {
      tracker.consumedKeys.delete(key);
      throw error;
    }

    if (!isFreshPendingIntervention(pending, nowMs)) return null;
    return createNativeInterventionAttempt(pending);
  } finally {
    tracker.inFlight = false;
  }
}

function getPendingInterventionKey(pending: NativePendingInterventionPayload): string {
  const scope = pending.scope;
  const scopeKey =
    scope?.kind === "android-surface"
      ? `${scope.kind}:${scope.ruleId}:${scope.packageName}`
      : scope?.kind === "android-package"
        ? `${scope.kind}:${scope.packageName}`
        : scope?.kind === "ios-token"
          ? `${scope.kind}:${scope.tokenType}:${scope.token}`
          : scope?.kind === "browser-domain"
            ? `${scope.kind}:${scope.domain}`
            : "unscoped";
  return [pending.detectedAt, pending.matchedRule, pending.sourcePackage, pending.host, scopeKey].join("|");
}

function trimConsumedInterventionKeys(keys: Set<string>) {
  while (keys.size > 32) {
    const oldest = keys.values().next().value as string | undefined;
    if (!oldest) return;
    keys.delete(oldest);
  }
}
