#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { syntheticQaIsDevOnlyOrRemoved, inspectNativeMonetizationDefaults, inspectRewardedResetChoice, inspectMembershipManagementRoute } = require('./lib/cleanup-source-contract');

function read(path) {
  return readFileSync(path, "utf8");
}

function check(id, condition, detail, next) {
  return {
    id,
    status: condition ? "PASS" : "FAIL",
    detail,
    next: condition ? "" : next,
  };
}

function behavioralTestsPass(paths) {
  try {
    for (const path of paths) {
      execFileSync(process.execPath, ["scripts/run-ts-entry.js", path], {
        cwd: process.cwd(), encoding: "utf8", timeout: 60_000, maxBuffer: 2_000_000,
      });
    }
    return true;
  } catch {
    return false;
  }
}

const appSurface = read("src/features/freed-app.tsx");
const blockingEngine = read("src/lib/blocking-engine.ts");
const androidClassifier = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedUrlClassifier.kt");
const recoveryState = read("src/lib/recovery-state.ts");
const analytics = read("src/lib/recovery-analytics.ts");
const urgeForecast = read("src/lib/urge-risk-forecast.ts");
const retentionOrchestrator = read("src/lib/retention-orchestrator.ts");
const monetization = read("src/lib/monetization.ts");
const challengeTemplates = read("src/data/challenge-templates.ts");
const releasePreflight = read("scripts/release-env-preflight.js");
const storeAdEvidence = read("scripts/store-ad-sandbox-evidence.js");
// These local tests exercise saved requests, replay, stale acknowledgements,
// UTC rollover and failed writes. Source checks below only verify UI wiring.
const analyticsBehaviorVerified = behavioralTestsPass([
  "tests/durable-state-cell.test.ts",
  "tests/recovery-analytics-snapshot.test.ts",
  "tests/analytics-reconciliation.test.ts",
]);

const checks = [
  check(
    "premium-entitlement-no-ui-toggle",
      !appSurface.includes("setPremium(!premium)") &&
      !appSurface.includes("setPremium={(value)") &&
      inspectMembershipManagementRoute(appSurface) &&
      appSurface.includes("is active from a verified purchase or restore.") &&
      appSurface.includes("getMembershipPlanLabel"),
    "Premium state is managed by purchase/restore flow, not by a visible local toggle.",
    "Remove direct premium state toggles from user-facing screens and route free users to the paywall."
  ),
  check(
    "monetization-defaults-native",
    inspectNativeMonetizationDefaults(monetization),
    "Monetization defaults to native fail-closed mode, and production runtime ignores mock purchase mode.",
    "Default monetization to native and force production bundles back to native even if a mock env flag is present."
  ),
  check(
    "rewarded-reset-explicit-choice",
    inspectRewardedResetChoice(appSurface, {
      offer: read("src/components/GuidedResetOffer.tsx"), hook: read("src/hooks/useGuidedResetAccess.ts"),
      access: read("src/lib/guided-reset-access.ts"), monetization,
      runtime: read("src/lib/native-monetization-runtime.ts"), adapter: read("src/lib/native-monetization-adapter.ts"),
    }),
    "Every rewarded SDK request follows an explicit optional-ad choice; paid/review/unknown cannot start ads, native completion requires a real reward and durable owner/session access, repair needs no second ad, and Help/safety remain immediate.",
    "Restore explicit optional-ad choice, current owner/tier/foreground/context checks, consent and real SDK reward, persist-before-reveal, and immediate basic help."
  ),
  check(
    "manual-check-source",
    blockingEngine.includes('source: "browser" | "search" | "manual-check" | "panic-button" | "app"') &&
      appSurface.includes('source: BlockingAttempt["source"] = "manual-check"') &&
      appSurface.includes('createBlockingAttempt(input, "manual-check")') &&
      !appSurface.includes('source: BlockingAttempt["source"] = "test-lab"') &&
      !appSurface.includes('createBlockingAttempt(input, "test-lab")'),
    "User-entered URL checks are recorded as real manual checks, not test-lab attempts.",
    "Replace runtime test-lab sources with manual-check and reserve test-lab only for legacy hydration."
  ),
  check(
    "legacy-test-lab-normalized",
    recoveryState.includes('String(value.source) === "test-lab" ? "manual-check"') &&
      recoveryState.includes('["browser", "search", "manual-check", "panic-button", "app"]'),
    "Legacy test-lab records hydrate into manual-check without dropping old local data.",
    "Keep a one-way legacy normalization path for old persisted attempts."
  ),
  check(
    "analytics-no-test-lab-metric",
    analytics.includes("manualCheckInterceptions") &&
      analytics.includes("appInterceptions") &&
      analytics.includes("productionMetrics") &&
      analytics.includes("appForegroundMinutes") &&
      analytics.includes("blockedAttemptSourceBreakdown") &&
      analytics.includes("peakUrgeHour") &&
      analytics.includes("hourlyUrgePattern") &&
      analytics.includes("unlockFrequencyPerWeek") &&
      analytics.includes("streakHistory") &&
      analytics.includes("challengeSuccessByCategory") &&
      analytics.includes('ANALYTICS_SCHEMA_VERSION = "aggregate-v5"') &&
      analytics.includes("ANALYTICS_CONSENT_VERSION") &&
      analytics.includes("configured-analytics-endpoint-missing") &&
      analytics.includes("analytics-endpoint-consent-stale") &&
      analyticsBehaviorVerified &&
      appSurface.includes("persistRecoveryState(current => prepareAnalyticsSnapshotState(current))") &&
      appSurface.includes("prepareAnalyticsPendingSnapshot(captured, captured.analyticsSharing)") &&
      appSurface.includes("persistRecoveryState(current => stageAnalyticsPendingSnapshot(current, captured, pending))") &&
      appSurface.includes("sendGatedAnalyticsPayload(staged, staged.analyticsSharing)") &&
      appSurface.includes("persistRecoveryState(current => applyPendingAnalyticsSnapshotReceipt(current, staged, result!.snapshotReceipt!))") &&
      appSurface.includes("persistRecoveryState(current => applyAnalyticsSnapshotRecovery(current, staged, result!.snapshotRecovery!))") &&
      appSurface.includes("Only aggregate counts and rates are sent after consent") &&
      appSurface.includes('AppState.currentState === "active"') &&
      appSurface.includes("recordAppSessionStart(current)") &&
      recoveryState.includes("analyticsSharing: AnalyticsSharingSettings") &&
      recoveryState.includes("updateAnalyticsSharingSettings") &&
      recoveryState.includes("closedAt: opened") &&
      !analytics.includes("testLabInterceptions"),
    "Aggregate analytics exposes real consent-gated production metrics without a test-lab metric; durable-state-cell, recovery-analytics-snapshot, and analytics-reconciliation behavioral tests verify saved request retry and exact receipt/recovery handling, with supplemental source checks for persisted UI wiring and hydrated app sessions.",
    "Run tests/durable-state-cell.test.ts, tests/recovery-analytics-snapshot.test.ts, and tests/analytics-reconciliation.test.ts; keep real aggregate metrics and persisted snapshot/acknowledgement wiring current."
  ),
  check(
    "urge-forecast-real-local-signals",
    urgeForecast.includes('URGE_RISK_FORECAST_SCHEMA_VERSION = "local-urge-risk-v1"') &&
      urgeForecast.includes('source: "local-recovery-signals"') &&
      urgeForecast.includes("getDailyCheckInForDay") &&
      urgeForecast.includes("countAttemptsForDay") &&
      urgeForecast.includes("generateWeeklyRecoveryReport") &&
      urgeForecast.includes("excludesBrowsingDetails: true") &&
      urgeForecast.includes("usesRawLocation: false") &&
      !urgeForecast.includes("Math.random") &&
      !urgeForecast.includes("mock") &&
      appSurface.includes("buildLocalUrgeRiskForecast(recoveryState)") &&
      retentionOrchestrator.includes("urgeRiskForecast"),
    "Urge risk forecast is derived from real local recovery signals, excludes browsing/private/location details, and feeds UI/retention without random or mock scoring.",
    "Keep prediction-like UX grounded in local check-ins, attempts, slips, challenge outcomes, and discipline settings only."
  ),
  check(
    "qa-adult-attempt-dev-only",
    syntheticQaIsDevOnlyOrRemoved(appSurface),
    "Synthetic adult-attempt controls are absent or structurally guarded by the React Native development flag.",
    "Keep synthetic QA controls out of release UI, or remove them entirely."
  ),
  check(
    "real-iso-ad-country-validation",
    monetization.includes("ISO_3166_ALPHA2_COUNTRY_CODES.has(normalized)") &&
      releasePreflight.includes("ISO_3166_ALPHA2_COUNTRY_CODES.has(value.trim().toUpperCase())") &&
      storeAdEvidence.includes("ISO_3166_ALPHA2_COUNTRY_CODES.has(countryCode)"),
    "Ad request country metadata is checked against recognized ISO 3166-1 alpha-2 values.",
    "Reject placeholder two-letter values such as ZZ in runtime config, release preflight, and store/ad evidence capture."
  ),
  check(
    "no-reserved-adult-seed-domain",
    !blockingEngine.includes("example-adult.test") &&
      !androidClassifier.includes("example-adult.test") &&
      !appSurface.includes("example-adult.test"),
    "Runtime classifiers and dev-only QA controls do not depend on a reserved fake adult domain.",
    "Use the real adult-domain seed corpus for classifier checks; keep reserved test domains out of production runtime tables."
  ),
  check(
    "source-aware-intervention-copy",
    appSurface.includes("interventionBodyForAttempt") &&
      appSurface.includes("selected app or short-form loop") &&
      appSurface.includes("explicit search before it could turn into a scroll loop") &&
      appSurface.includes("blocked an explicit site before the page loaded") &&
      !appSurface.includes("detected adult-content intent and interrupted the loop before the page loaded"),
    "Relapse interruption copy distinguishes adult sites, explicit searches, selected app/short-form shields, and self-reported urges.",
    "Keep the shared intervention screen from framing every native/app shield as adult-site detection."
  ),
  check(
    "premium-copy-no-plan-mode",
    !appSurface.includes("Plan Mode") &&
      appSurface.includes("Membership") &&
      !appSurface.includes("premium mode, and challenge history"),
    "Profile copy presents membership status without local test-mode language.",
    "Remove plan-mode and premium-mode copy from release UI surfaces."
  ),
  check(
    "challenge-copy-no-fake-overclaim",
    behavioralTestsPass(["tests/challenge-comfort-safety.test.ts"]),
    "Current assembled and retained legacy challenges use voluntary comfort, device-movement, time and alternative language without unsupported physiology or impossible-to-fake guarantees.",
    "Keep actual catalog and legacy display instructions grounded; do not restore discharge-craving or real-movement overclaims to satisfy a source substring."
  ),
];

const passCount = checks.filter((entry) => entry.status === "PASS").length;
const failCount = checks.length - passCount;

console.log("# FREED runtime data integrity audit");
console.log(`Result: ${passCount} pass, ${failCount} fail`);
console.log("");
console.log("| Status | Gate | Detail | Next |");
console.log("| --- | --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status} | ${entry.id} | ${entry.detail.replace(/\|/g, "/")} | ${entry.next.replace(/\|/g, "/")} |`);
}

if (failCount > 0) {
  process.exit(1);
}
