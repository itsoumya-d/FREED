#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const DEFAULT_CHECK_TIMEOUT_MS = 120_000;
const MIN_CHECK_TIMEOUT_MS = 5_000;
const MAX_CHECK_TIMEOUT_MS = 300_000;

function smokeHarnessCheckTimeoutMs(env = process.env) {
  const raw = env.FREED_SMOKE_HARNESS_CHECK_TIMEOUT_MS;
  if (!raw || !raw.trim()) return DEFAULT_CHECK_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_CHECK_TIMEOUT_MS;

  return Math.max(MIN_CHECK_TIMEOUT_MS, Math.min(MAX_CHECK_TIMEOUT_MS, Math.round(parsed)));
}

function formatCheckOutput(result, timeoutMs) {
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (!result.error) return output;

  const errorMessage =
    result.error.code === "ETIMEDOUT"
      ? `Timed out after ${timeoutMs}ms.`
      : `Could not run check: ${result.error.message || result.error.code || "unknown error"}`;

  return [errorMessage, output].filter(Boolean).join("\n");
}

function printCheckManifest() {
  console.log("# FREED smoke harness audit checks");
  console.log(`Check count: ${checks.length}`);
  console.log("");
  for (const check of checks) {
    console.log(`- CHECK: ${check.label}`);
  }
}

const checks = [
  {
    label: "android smoke harness syntax",
    command: "node",
    args: ["-c", "scripts/android-emulator-smoke.js"],
  },
  {
    label: "android smoke harness self-test",
    command: "node",
    args: ["scripts/android-emulator-smoke.js", "--self-test"],
  },
  {
    label: "png screenshot analyzer syntax",
    command: "node",
    args: ["-c", "scripts/lib/png-screenshot-audit.js"],
  },
  {
    label: "png screenshot analyzer self-test",
    command: "node",
    args: ["scripts/lib/png-screenshot-audit.js", "--self-test"],
  },
  {
    label: "evidence target safety syntax",
    command: "node",
    args: ["-c", "scripts/lib/evidence-target-safety.js"],
  },
  {
    label: "evidence target safety self-test",
    command: "node",
    args: ["scripts/lib/evidence-target-safety.js", "--self-test"],
  },
  {
    label: "evidence output safety syntax",
    command: "node",
    args: ["-c", "scripts/lib/evidence-output-safety.js"],
  },
  {
    label: "evidence output safety self-test",
    command: "node",
    args: ["scripts/lib/evidence-output-safety.js", "--self-test"],
  },
  {
    label: "env file safety syntax",
    command: "node",
    args: ["-c", "scripts/lib/env-file-safety.js"],
  },
  {
    label: "env file safety self-test",
    command: "node",
    args: ["scripts/lib/env-file-safety.js", "--self-test"],
  },
  {
    label: "env file loader syntax",
    command: "node",
    args: ["-c", "scripts/lib/env-file-loader.js"],
  },
  {
    label: "env file loader self-test",
    command: "node",
    args: ["scripts/lib/env-file-loader.js", "--self-test"],
  },
  {
    label: "report path safety syntax",
    command: "node",
    args: ["-c", "scripts/lib/report-path-safety.js"],
  },
  {
    label: "report path safety self-test",
    command: "node",
    args: ["scripts/lib/report-path-safety.js", "--self-test"],
  },
  {
    label: "release verifier self-test",
    command: "node",
    args: ["scripts/release-verify.js", "--self-test"],
  },
  {
    label: "production env gap checklist syntax",
    command: "node",
    args: ["-c", "scripts/release-env-gap-plan.js"],
  },
  {
    label: "production env gap checklist self-test",
    command: "node",
    args: ["scripts/release-env-gap-plan.js", "--self-test"],
  },
  {
    label: "eas submit guard syntax",
    command: "node",
    args: ["-c", "scripts/eas-submit-guard.js"],
  },
  {
    label: "eas submit guard self-test",
    command: "node",
    args: ["scripts/eas-submit-guard.js", "--self-test"],
  },
  {
    label: "eas workflow audit syntax",
    command: "node",
    args: ["-c", "scripts/eas-workflow-audit.js"],
  },
  {
    label: "eas workflow audit self-test",
    command: "node",
    args: ["scripts/eas-workflow-audit.js", "--self-test"],
  },
  {
    label: "eas workflow audit",
    command: "node",
    args: ["scripts/eas-workflow-audit.js"],
  },
  {
    label: "store launch catalog audit syntax",
    command: "node",
    args: ["-c", "scripts/store-launch-catalog-audit.js"],
  },
  {
    label: "store launch catalog audit self-test",
    command: "node",
    args: ["scripts/store-launch-catalog-audit.js", "--self-test"],
  },
  {
    label: "store launch catalog audit",
    command: "node",
    args: ["scripts/store-launch-catalog-audit.js", "--report", "docs/validation/artifacts/store-launch-catalog-current/store-launch-catalog-audit.json"],
  },
  {
    label: "paywall launch scope audit syntax",
    command: "node",
    args: ["-c", "scripts/paywall-launch-scope-audit.js"],
  },
  {
    label: "paywall launch scope audit self-test",
    command: "node",
    args: ["scripts/paywall-launch-scope-audit.js", "--self-test"],
  },
  {
    label: "paywall launch scope audit",
    command: "node",
    args: ["scripts/paywall-launch-scope-audit.js", "--report", "docs/validation/artifacts/paywall-launch-scope-current/paywall-launch-source-audit.json"],
  },
  {
    label: "permission flow source audit syntax",
    command: "node",
    args: ["-c", "scripts/permission-flow-source-audit.js"],
  },
  {
    label: "permission flow source audit self-test",
    command: "node",
    args: ["scripts/permission-flow-source-audit.js", "--self-test"],
  },
  {
    label: "permission flow source audit",
    command: "node",
    args: ["scripts/permission-flow-source-audit.js", "--report", "docs/validation/artifacts/permission-flow-current/permission-flow-source-audit.json"],
  },
  {
    label: "store legal policy audit syntax",
    command: "node",
    args: ["-c", "scripts/store-legal-policy-audit.js"],
  },
  {
    label: "store legal policy audit self-test",
    command: "node",
    args: ["scripts/store-legal-policy-audit.js", "--self-test"],
  },
  {
    label: "store legal policy audit",
    command: "node",
    args: ["scripts/store-legal-policy-audit.js", "--report", "docs/validation/artifacts/store-legal-policy-current/store-legal-policy-audit.json"],
  },
  {
    label: "store legal web export audit syntax",
    command: "node",
    args: ["-c", "scripts/store-legal-web-export-audit.js"],
  },
  {
    label: "store legal web export audit self-test",
    command: "node",
    args: ["scripts/store-legal-web-export-audit.js", "--self-test"],
  },
  {
    label: "store legal web export audit",
    command: "node",
    args: ["scripts/store-legal-web-export-audit.js", "--report", "docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json"],
  },
  {
    label: "store legal hosted URL audit syntax",
    command: "node",
    args: ["-c", "scripts/store-legal-hosted-url-audit.js"],
  },
  {
    label: "store legal hosted URL audit self-test",
    command: "node",
    args: ["scripts/store-legal-hosted-url-audit.js", "--self-test"],
  },
  {
    label: "store legal web deploy packet syntax",
    command: "node",
    args: ["-c", "scripts/store-legal-web-deploy-packet.js"],
  },
  {
    label: "store legal web deploy packet self-test",
    command: "node",
    args: ["scripts/store-legal-web-deploy-packet.js", "--self-test"],
  },
  {
    label: "store legal web deploy packet",
    command: "node",
    args: [
      "scripts/store-legal-web-deploy-packet.js",
      "--run-id",
      "store-legal-web-deploy-current",
      "--output-dir",
      "docs/validation/artifacts/store-legal-web-deploy-current",
    ],
  },
  {
    label: "EAS legal web deploy readiness syntax",
    command: "node",
    args: ["-c", "scripts/eas-legal-web-deploy.js"],
  },
  {
    label: "EAS legal web deploy readiness self-test",
    command: "node",
    args: ["scripts/eas-legal-web-deploy.js", "--self-test"],
  },
  {
    label: "android doomscroll contract syntax",
    command: "node",
    args: ["-c", "scripts/lib/android-doomscroll-contract.js"],
  },
  {
    label: "android doomscroll contract self-test",
    command: "node",
    args: ["scripts/lib/android-doomscroll-contract.js", "--self-test"],
  },
  {
    label: "short-form web contract syntax",
    command: "node",
    args: ["-c", "scripts/lib/short-form-web-contract.js"],
  },
  {
    label: "short-form web contract self-test",
    command: "node",
    args: ["scripts/lib/short-form-web-contract.js", "--self-test"],
  },
  {
    label: "adult-domain feed source contract syntax",
    command: "node",
    args: ["-c", "scripts/lib/adult-domain-feed-source-contract.js"],
  },
  {
    label: "adult-domain feed source contract self-test",
    command: "node",
    args: ["scripts/lib/adult-domain-feed-source-contract.js", "--self-test"],
  },
  {
    label: "android real-browser evidence harness syntax",
    command: "node",
    args: ["-c", "scripts/android-real-browser-evidence.js"],
  },
  {
    label: "android real-browser evidence harness self-test",
    command: "node",
    args: ["scripts/android-real-browser-evidence.js", "--self-test"],
  },
  {
    label: "permission wizard report syntax",
    command: "node",
    args: ["-c", "scripts/permission-wizard-report.js"],
  },
  {
    label: "permission wizard report self-test",
    command: "node",
    args: ["scripts/permission-wizard-report.js", "--self-test"],
  },
  {
    label: "android install QA harness syntax",
    command: "node",
    args: ["-c", "scripts/android-install-qa.js"],
  },
  {
    label: "android install QA harness self-test",
    command: "node",
    args: ["scripts/android-install-qa.js", "--self-test"],
  },
  {
    label: "android APK download server syntax",
    command: "node",
    args: ["-c", "scripts/android-apk-download-server.js"],
  },
  {
    label: "android APK download server self-test",
    command: "node",
    args: ["scripts/android-apk-download-server.js", "--self-test"],
  },
  {
    label: "android APK download ensure syntax",
    command: "node",
    args: ["-c", "scripts/android-apk-download-ensure.js"],
  },
  {
    label: "android APK download ensure self-test",
    command: "node",
    args: ["scripts/android-apk-download-ensure.js", "--self-test"],
  },
  {
    label: "android upload keystore setup syntax",
    command: "node",
    args: ["-c", "scripts/android-upload-keystore-setup.js"],
  },
  {
    label: "android upload keystore setup self-test",
    command: "node",
    args: ["scripts/android-upload-keystore-setup.js", "--self-test"],
  },
  {
    label: "ios smoke harness syntax",
    command: "node",
    args: ["-c", "scripts/ios-simulator-smoke.js"],
  },
  {
    label: "ios smoke harness self-test",
    command: "node",
    args: ["scripts/ios-simulator-smoke.js", "--self-test"],
  },
  {
    label: "ios native build check syntax",
    command: "node",
    args: ["-c", "scripts/ios-native-build-check.js"],
  },
  {
    label: "ios native build check self-test",
    command: "node",
    args: ["scripts/ios-native-build-check.js", "--self-test"],
  },
  {
    label: "ios release archive build syntax",
    command: "node",
    args: ["-c", "scripts/build-ios-release-archive.js"],
  },
  {
    label: "ios release archive build self-test",
    command: "node",
    args: ["scripts/build-ios-release-archive.js", "--self-test"],
  },
  {
    label: "ios physical-device evidence harness syntax",
    command: "node",
    args: ["-c", "scripts/ios-physical-device-evidence.js"],
  },
  {
    label: "ios physical-device evidence harness self-test",
    command: "node",
    args: ["scripts/ios-physical-device-evidence.js", "--self-test"],
  },
  {
    label: "normal-browsing corpus evidence harness syntax",
    command: "node",
    args: ["-c", "scripts/normal-browsing-corpus-evidence.js"],
  },
  {
    label: "normal-browsing corpus evidence harness self-test",
    command: "node",
    args: ["scripts/normal-browsing-corpus-evidence.js", "--self-test"],
  },
  {
    label: "performance profile evidence harness syntax",
    command: "node",
    args: ["-c", "scripts/performance-profile-evidence.js"],
  },
  {
    label: "performance profile evidence harness self-test",
    command: "node",
    args: ["scripts/performance-profile-evidence.js", "--self-test"],
  },
  {
    label: "store/ad sandbox evidence harness syntax",
    command: "node",
    args: ["-c", "scripts/store-ad-sandbox-evidence.js"],
  },
  {
    label: "store/ad sandbox evidence harness self-test",
    command: "node",
    args: ["scripts/store-ad-sandbox-evidence.js", "--self-test"],
  },
  {
    label: "store console browser readiness syntax",
    command: "node",
    args: ["-c", "scripts/store-console-browser-readiness.js"],
  },
  {
    label: "store console browser readiness self-test",
    command: "node",
    args: ["scripts/store-console-browser-readiness.js", "--self-test"],
  },
  {
    label: "AdMob console readiness syntax",
    command: "node",
    args: ["-c", "scripts/admob-console-readiness.js"],
  },
  {
    label: "AdMob console readiness self-test",
    command: "node",
    args: ["scripts/admob-console-readiness.js", "--self-test"],
  },
  {
    label: "backend readiness smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/backend-readiness-smoke.ts", "--self-test"],
  },
  {
    label: "supabase schema smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/supabase-schema-smoke.ts", "--self-test"],
  },
  {
    label: "supabase deployment packet syntax",
    command: "node",
    args: ["-c", "scripts/supabase-deployment-packet.js"],
  },
  {
    label: "supabase deployment packet self-test",
    command: "node",
    args: ["scripts/supabase-deployment-packet.js", "--self-test"],
  },
  {
    label: "supabase deployment packet",
    command: "node",
    args: [
      "scripts/supabase-deployment-packet.js",
      "--report",
      "docs/validation/artifacts/supabase-deployment-current/supabase-deployment-packet.json",
    ],
  },
  {
    label: "adult-domain feed smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/adult-domain-feed-smoke.ts", "--self-test"],
  },
  {
    label: "analytics ingestion smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/analytics-ingestion-smoke.ts", "--self-test"],
  },
  {
    label: "remote notification smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/remote-notification-smoke.ts", "--self-test"],
  },
  {
    label: "purchase verification smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/purchase-verification-smoke.ts", "--self-test"],
  },
  {
    label: "ai backend smoke harness self-test",
    command: "node",
    args: ["scripts/run-ts-entry.js", "scripts/ai-backend-smoke.ts", "--self-test"],
  },
  {
    label: "ai backend smoke evidence harness syntax",
    command: "node",
    args: ["-c", "scripts/ai-backend-smoke-evidence.js"],
  },
  {
    label: "ai backend smoke evidence harness self-test",
    command: "node",
    args: ["scripts/ai-backend-smoke-evidence.js", "--self-test"],
  },
  {
    label: "runtime data integrity audit syntax",
    command: "node",
    args: ["-c", "scripts/runtime-data-integrity-audit.js"],
  },
  {
    label: "runtime data integrity audit",
    command: "node",
    args: ["scripts/runtime-data-integrity-audit.js"],
  },
];

if (process.argv.includes("--list") || process.argv.includes("--manifest")) {
  printCheckManifest();
  process.exit(0);
}

const results = [];
const checkTimeoutMs = smokeHarnessCheckTimeoutMs();

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: checkTimeoutMs,
  });

  const ok = !result.error && result.status === 0;
  results.push({
    check: check.label,
    status: ok ? "PASS" : "FAIL",
    output: formatCheckOutput(result, checkTimeoutMs),
  });
}

const passCount = results.filter((result) => result.status === "PASS").length;
const failCount = results.length - passCount;

console.log("# FREED smoke harness audit");
console.log(`Result: ${passCount} pass, ${failCount} fail`);
console.log("");
for (const result of results) {
  console.log(`- ${result.status}: ${result.check}`);
  if (result.status === "FAIL" && result.output) {
    console.log(result.output);
  }
}

if (failCount > 0) {
  process.exit(1);
}
