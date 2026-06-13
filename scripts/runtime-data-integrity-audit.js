#!/usr/bin/env node

const { readFileSync } = require("node:fs");

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

const checks = [
  check(
    "premium-entitlement-no-ui-toggle",
      !appSurface.includes("setPremium(!premium)") &&
      !appSurface.includes("setPremium={(value)") &&
      appSurface.includes("onManagePlan={() => setScreen(\"paywall\")}") &&
      appSurface.includes("is active from a verified purchase or restore.") &&
      appSurface.includes("getMembershipPlanLabel"),
    "Premium state is managed by purchase/restore flow, not by a visible local toggle.",
    "Remove direct premium state toggles from user-facing screens and route free users to the paywall."
  ),
  check(
    "monetization-defaults-native",
    monetization.includes('EXPO_PUBLIC_MONETIZATION_MODE === "mock" ? "mock" : "native"') &&
      monetization.includes('if (requestedMode === "mock" && isProductionRuntime()) return "native";') &&
      !monetization.includes('EXPO_PUBLIC_MONETIZATION_MODE === "native" ? "native" : "mock"'),
    "Monetization defaults to native fail-closed mode, and production runtime ignores mock purchase mode.",
    "Default monetization to native and force production bundles back to native even if a mock env flag is present."
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
      appSurface.includes("sendGatedAnalyticsPayload(recoveryState, recoveryState.analyticsSharing)") &&
      appSurface.includes("Only aggregate counts and rates are sent after consent") &&
      appSurface.includes('AppState.currentState === "active"') &&
      appSurface.includes("recordAppSessionStart(current)") &&
      recoveryState.includes("analyticsSharing: AnalyticsSharingSettings") &&
      recoveryState.includes("updateAnalyticsSharingSettings") &&
      recoveryState.includes("closedAt: opened") &&
      !analytics.includes("testLabInterceptions"),
    "Aggregate analytics exposes production metrics for manual/app interventions, app opens, foreground duration, blocked-attempt source breakdowns, unlock frequency, hourly urge patterns, category success rates, persisted opt-in sharing controls, and starts hydrated active sessions without a test-lab metric.",
    "Keep user-facing aggregate metrics real, app-level interventions counted, hydrated active app opens tracked, and the analytics schema current."
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
    appSurface.includes('const showQaControls = typeof __DEV__ !== "undefined" && __DEV__;') &&
      appSurface.includes("{showQaControls ? (") &&
      appSurface.includes("Simulate adult attempt (QA)"),
    "The synthetic adult-attempt shortcut is guarded behind the React Native development flag.",
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
    !challengeTemplates.includes("impossible to fake") &&
      challengeTemplates.includes("real movement evidence") &&
      challengeTemplates.includes("helps discharge the craving"),
    "Challenge copy describes real-world evidence without overclaiming that sensor verification is impossible to bypass.",
    "Replace challenge copy that promises impossible-to-fake completion with grounded sensor/action language."
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
