const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");

const root = resolve(__dirname, "..");
const verifier = require("../scripts/release-verify");
const preflightHelpers = require("../scripts/release-env-preflight");
mkdirSync(join(root, "docs/validation/artifacts"), { recursive: true });
const fixtureRoot = mkdtempSync(join(root, "docs/validation/artifacts/firebase-release-gates-"));
const env = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production" };
function cli(script, args = [], additions = {}) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], { cwd: fixtureRoot, env: { ...env, ...additions }, encoding: "utf8", timeout: 60_000, maxBuffer: 2_000_000 });
  assert.ifError(result.error);
  return result;
}
function preflight(additions = {}, name = "report") {
  const report = `docs/validation/artifacts/checks/${name}.json`;
  const result = cli("scripts/release-env-preflight.js", ["--report", report], additions);
  return { ...result, report: JSON.parse(readFileSync(join(fixtureRoot, report), "utf8")) };
}

try {
  const initial = preflight();
  assert.equal(initial.report.backendProvider, "firebase", "Production defaults must select the canonical Firebase backend.");
  assert.equal(initial.report.checks.find(check => check.id === "iap-product-ids").status, "pass", "Firebase release follows the actual coded monthly/yearly product defaults.");
  assert.equal(initial.status, 1, "Missing Firebase proof must block release.");
  assert.equal(initial.report.checks.some(check => /supabase|redis/.test(check.id)), false);
  assert.equal(initial.report.checks.find(check => check.id === "firebase-production-runtime-evidence").status, "fail");
  assert.match(initial.report.checks.find(check => check.id === "firebase-production-runtime-evidence").detail, /missing|evidence/i);

  const legacy = preflight({ EXPO_PUBLIC_BACKEND_PROVIDER: "legacy" }, "legacy");
  assert.equal(legacy.report.backendProvider, "legacy");
  assert.equal(legacy.report.checks.find(check => check.id === "supabase-backend-credentials").status, "fail");
  assert.equal(legacy.report.checks.find(check => check.id === "redis-backend-infrastructure").status, "fail");

  const common = { EXPO_PUBLIC_BACKEND_PROVIDER: "firebase", EXPO_PUBLIC_FIREBASE_ENV: "production", EXPO_PUBLIC_MONETIZATION_MODE: "native", EXPO_PUBLIC_IAP_PRODUCT_YEARLY: "freed_premium_yearly", EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: "freed_premium_monthly" };
  const monthlyYearly = preflight(common, "plans");
  assert.equal(monthlyYearly.report.checks.find(check => check.id === "iap-product-ids").status, "pass", "Launch needs monthly and yearly only.");
  const leaked = preflight({ ...common, EXPO_PUBLIC_APPLE_STORE_PRIVATE_KEY: "redacted-credential-fixture" }, "leak");
  assert.equal(leaked.report.checks.find(check => check.id === "server-secret-public-leakage").status, "fail");
  assert.equal(JSON.stringify(leaked.report).includes("redacted-credential-fixture"), false);
  const adminLeak = preflight({ ...common, EXPO_PUBLIC_FIREBASE_ADMIN_CREDENTIALS: "redacted-credential-fixture" }, "admin-leak");
  assert.equal(adminLeak.report.checks.find(check => check.id === "server-secret-public-leakage").status, "fail", "Unknown public admin/credential aliases must remain forbidden.");

  mkdirSync(join(fixtureRoot, "android/app"), { recursive: true });
  mkdirSync(join(fixtureRoot, "ios/FREED"), { recursive: true });
  writeFileSync(join(fixtureRoot, ".firebaserc"), JSON.stringify({ projects: { default: "freed-7d5ee" } }));
  writeFileSync(join(fixtureRoot, "android/app/google-services.json"), JSON.stringify({ project_info: { project_id: "freed-7d5ee", project_number: "5477978760" }, client: [{ client_info: { mobilesdk_app_id: "1:5477978760:android:00793100673feb4ab3c53d", android_client_info: { package_name: "app.freed.recovery" } } }] }));
  writeFileSync(join(fixtureRoot, "ios/FREED/GoogleService-Info.plist"), '<plist><dict><key>PROJECT_ID</key><string>freed-7d5ee</string><key>GOOGLE_APP_ID</key><string>1:5477978760:ios:0123456789abcdef123456</string><key>BUNDLE_ID</key><string>app.freed.recovery</string></dict></plist>');
  const configured = preflight(common, "native-config");
  assert.equal(configured.report.checks.find(check => check.id === "firebase-native-app-identifiers").status, "pass");
  assert.equal(configured.report.checks.find(check => check.id === "firebase-production-runtime-evidence").status, "fail", "Native files alone cannot prove deployment or AppCheck.");

  const evidencePath = "docs/validation/artifacts/checks/firebase-runtime.json";
  writeFileSync(join(fixtureRoot, evidencePath), JSON.stringify({ schemaVersion: "freed-firebase-production-runtime-v1", generatedAt: new Date().toISOString(), sanitized: true, result: "pass", projectId: "freed-7d5ee", functionsRegion: "asia-south1", source: "production-native", deployed: true, appCheckEnforced: true }));
  const falseProof = preflight({ ...common, FREED_FIREBASE_RUNTIME_EVIDENCE: evidencePath }, "false-proof");
  assert.equal(falseProof.report.checks.find(check => check.id === "firebase-production-runtime-evidence").status, "fail", "Boolean deployment claims without captured runtime proof must fail.");
  writeFileSync(join(fixtureRoot, evidencePath), JSON.stringify({ schemaVersion: "freed-firebase-production-runtime-v1", generatedAt: "2025-01-01T00:00:00.000Z", sanitized: true, result: "pass", source: "emulator", projectId: "freed-7d5ee", functionsRegion: "asia-south1" }));
  const stale = preflight({ ...common, FREED_FIREBASE_RUNTIME_EVIDENCE: evidencePath }, "stale");
  assert.match(stale.report.checks.find(check => check.id === "firebase-production-runtime-evidence").detail, /stale|fresh|production.native/i);
  const captured = { schemaVersion: "freed-firebase-production-runtime-v2", generatedAt: new Date().toISOString(), sanitized: true, result: "pass", source: "production-native", environment: "production", buildMode: "release", projectId: "freed-7d5ee", functionsRegion: "asia-south1",
    nativeApps: { android: { appId: "1:5477978760:android:00793100673feb4ab3c53d", packageName: "app.freed.recovery" }, ios: { appId: "1:5477978760:ios:0123456789abcdef123456", bundleId: "app.freed.recovery" } },
    deployedCallables: preflightHelpers.FIREBASE_REQUIRED_CALLABLE_NAMES,
    callableResults: preflightHelpers.FIREBASE_REQUIRED_CALLABLE_NAMES.map(name => ({ name, status: "pass", authenticated: true, appCheckAccepted: true, contractValidated: true, remoteProviderConfirmed: true })),
    deployedSecretNames: preflightHelpers.FIREBASE_REQUIRED_SECRET_NAMES,
    appCheck: { enforced: true, debugTokensEnabled: false, unauthenticatedRejected: true, invalidAppCheckRejected: true, iosProvider: "appAttestWithDeviceCheckFallback", androidProvider: "playIntegrity" }, captureArtifacts: [] };
  const claraFixture = require("../scripts/lib/tests/google-clara-fixture").fixture(fixtureRoot);
  const claraEvidence = claraFixture.save();
  captured.claraEvidence = { path: claraEvidence.ai.smokeReportArtifact, sha256: claraEvidence.ai.smokeReportSha256 };
  for (const kind of ["nativeApps", "deployedCallables", "callableResults", "deployedSecretNames", "appCheck"]) {
    const path = `docs/validation/artifacts/checks/capture-${kind}.json`;
    const raw = JSON.stringify({ schemaVersion: "freed-firebase-native-capture-v1", source: "production-native", sanitized: true, generatedAt: captured.generatedAt, kind, proof: captured[kind] });
    writeFileSync(join(fixtureRoot, path), raw);
    captured.captureArtifacts.push({ kind, path, sha256: createHash("sha256").update(raw).digest("hex") });
  }
  writeFileSync(join(fixtureRoot, evidencePath), JSON.stringify(captured));
  const captureFixture = preflight({ ...common, FREED_FIREBASE_RUNTIME_EVIDENCE: evidencePath }, "captured-contract-fixture");
  assert.equal(captureFixture.report.checks.find(check => check.id === "firebase-production-runtime-evidence").status, "pass", "Controlled full capture fixtures exercise acceptance; they are deleted and never promoted as live evidence.");
  assert.equal(preflightHelpers.FIREBASE_REQUIRED_SECRET_NAMES.includes("OPENAI_API_KEY"), false);
  assert.equal(preflightHelpers.FIREBASE_REQUIRED_SECRET_NAMES.includes("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"), true);
  for (const name of ["generateGoogleClaraReply", "getApplePurchaseCheckoutContext", "verifyAppleStorePurchase"]) assert.equal(preflightHelpers.FIREBASE_REQUIRED_CALLABLE_NAMES.includes(name), true);
  for (const name of ["generateClaraReply", "generateChallenges", "generateRetentionPlan"]) assert.equal(preflightHelpers.FIREBASE_REQUIRED_CALLABLE_NAMES.includes(name), false);
  const substituted = { ...captured, appCheck: { ...captured.appCheck, debugTokensEnabled: true } };
  writeFileSync(join(fixtureRoot, evidencePath), JSON.stringify(substituted));
  const modified = preflight({ ...common, FREED_FIREBASE_RUNTIME_EVIDENCE: evidencePath }, "modified-proof");
  assert.equal(modified.report.checks.find(check => check.id === "firebase-production-runtime-evidence").status, "fail");
  assert.match(modified.report.checks.find(check => check.id === "firebase-production-runtime-evidence").detail, /AppCheck|capture artifact/);

  const firebaseList = cli("scripts/release-verify.js", ["--list"], common);
  assert.equal(firebaseList.status, 0);
  assert.match(firebaseList.stdout, /npm --prefix functions run build/);
  assert.match(firebaseList.stdout, /npm --prefix functions (?:run )?test/);
  assert.match(firebaseList.stdout, /test:emulator/);
  assert.equal(firebaseList.stdout.includes("smoke:supabase-schema"), false);
  assert.equal(firebaseList.stdout.includes("smoke:backend-readiness"), false);
  for (const required of ["build:android-aab:upload-signed", "build:ios-archive:release", "eval:ai-safety", "evidence:validation", "audit:performance", "audit:release:strict"]) assert.equal(firebaseList.stdout.includes(required), true);
  const legacyList = cli("scripts/release-verify.js", ["--list"], { EXPO_PUBLIC_BACKEND_PROVIDER: "legacy" });
  assert.equal(legacyList.stdout.includes("smoke:supabase-schema"), true);
  const ids = verifier.getExpectedReleaseReadinessGateIds("firebase");
  const forged = { schemaVersion: "release-readiness-report-v1", backendProvider: "firebase", strict: true, sanitized: true, generatedAt: new Date().toISOString(), summary: { passCount: ids.length, warnCount: 0, failCount: 0 }, results: ids.map(id => ({ id, status: "pass", evidence: "Configuration-only deployment assertion", next: "" })) };
  assert.throws(() => verifier.assertReleaseReadinessReport(forged, "controlled-readiness-fixture.json", common), /runtime evidence|production capture/i, "An all-green manifest must not replace missing live Firebase evidence.");
  const legalIds = ["privacy", "support", "account-deletion"];
  const legalChecks = legalIds.flatMap(id => ["status", "final-url", "content-type", "body", "content", "indexing"].map(kind => ({ id: `hosted-${kind}-${id}`, status: "pass", detail: "Controlled hosted-contract fixture" })));
  const legal = { result: "pass", sanitized: true, passCount: legalChecks.length, failCount: 0, checks: legalChecks,
    publicUrls: preflightHelpers.getLegalUrls(common), routeResults: legalIds.map(id => ({ id, status: 200, finalUrl: preflightHelpers.getLegalUrls(common)[id] })) };
  assert.doesNotThrow(() => verifier.assertHostedLegalReport(legal, "controlled-legal-fixture.json", common));
  const legalOverrideEnv = { ...common, FREED_LEGAL_PRIVACY_URL: "https://freed-landing.web.app/legal/privacy" };
  const legalOverride = { ...legal, publicUrls: preflightHelpers.getLegalUrls(legalOverrideEnv), routeResults: legalIds.map(id => ({ id, status: 200, finalUrl: preflightHelpers.getLegalUrls(legalOverrideEnv)[id] })) };
  assert.doesNotThrow(() => verifier.assertHostedLegalReport(legalOverride, "controlled-legal-fixture.json", legalOverrideEnv));
  const prefixImpersonation = { ...legal, routeResults: legal.routeResults.map(route => route.id === "privacy" ? { ...route, finalUrl: `${route.finalUrl}-unrelated` } : route) };
  assert.throws(() => verifier.assertHostedLegalReport(prefixImpersonation, "controlled-legal-fixture.json", common), /finalUrl|final URL|configured/i);
  console.log("Firebase release gate CLI tests passed");
} finally { rmSync(fixtureRoot, { recursive: true, force: true }); }
