#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-paywall-launch-source-audit-v1";
const DEFAULT_REPORT = "docs/validation/artifacts/paywall-launch-scope-current/paywall-launch-source-audit.json";
const PAYWALL_SOURCE_PATH = "src/features/freed-app.tsx";
const OFFER_SOURCE_PATH = "src/components/PremiumOffer.tsx";
const PRESENTER_SOURCE_PATH = "src/lib/paywall-presenter.ts";
const MONETIZATION_SOURCE_PATH = "src/lib/monetization.ts";
const LAUNCH_PLAN_IDS = ["yearly", "monthly"];
const LAUNCH_PRODUCT_IDS = {
  yearly: "freed_premium_yearly",
  monthly: "freed_premium_monthly",
  lifetime: "freed_premium_lifetime",
};
const FUTURE_PLAN_IDS = ["family", "accountability", "ai-coach"];
const FUTURE_PRODUCT_IDS = ["freed_family_yearly", "freed_accountability_monthly", "freed_ai_coach_monthly"];
const FUTURE_PAYWALL_TERMS = [
  ...FUTURE_PRODUCT_IDS,
  "Family Plan",
  "Accountability Plan",
  "AI Coach Plan",
  "Family",
  "Accountability",
  "AI Coach",
];

function printHelp() {
  console.log(`Usage: npm run audit:paywall-launch-scope -- [options]

Validates that the launch paywall source renders and purchases monthly and
yearly plans only. This is a local source precheck; it does not inspect a submitted
binary, App Store Connect, Google Play Console, AdMob, or sandbox purchases.

Options:
  --report <path>  Sanitized JSON report under docs/validation/artifacts.
                   Default: ${DEFAULT_REPORT}
  --self-test      Run offline parser checks.
`);
}

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--report") options.reportPath = next();
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  return options;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function resolveInputPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function readText(relativePath) {
  return fs.readFileSync(resolveInputPath(relativePath), "utf8");
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveInputPath(relativePath))).digest("hex");
}

function normalizeSource(source) {
  return source.replace(/\s+/g, " ");
}

function extractFunctionBlock(source, functionName) {
  const functionIndex = source.indexOf(`function ${functionName}`);
  if (functionIndex < 0) throw new Error(`${functionName} function was not found.`);
  const functionStart = functionIndex + `function ${functionName}`.length;
  let firstBrace = -1;
  let parenDepth = 0;
  for (let index = functionStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth -= 1;
    else if (char === "{" && parenDepth === 0) {
      firstBrace = index;
      break;
    }
  }
  if (firstBrace < 0) throw new Error(`${functionName} function body was not found.`);
  let depth = 0;
  for (let index = firstBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(functionIndex, index + 1);
    }
  }
  throw new Error(`${functionName} function body is not balanced.`);
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function hasExactLaunchPlanConstant(source) {
  return /LAUNCH_PREMIUM_PLAN_IDS\s*=\s*\[\s*"yearly"\s*,\s*"monthly"\s*\]/.test(source);
}

function paywallOmitsFuturePlans(paywallBlock) {
  return !FUTURE_PAYWALL_TERMS.some((term) => paywallBlock.includes(term));
}

function includesAll(source, needles) {
  return needles.every((needle) => source.includes(needle));
}

function buildReport() {
  const checks = [];
  let monetizationSource = "";
  let paywallSource = "";
  let paywallBlock = "";
  let offerSource = "";
  let presenterSource = "";

  try {
    monetizationSource = readText(MONETIZATION_SOURCE_PATH);
    paywallSource = readText(PAYWALL_SOURCE_PATH);
    paywallBlock = extractFunctionBlock(paywallSource, "PaywallScreen");
    offerSource = readText(OFFER_SOURCE_PATH);
    presenterSource = readText(PRESENTER_SOURCE_PATH);
    pushCheck(checks, "source-files-readable", true, "Paywall controller, offer view, price presenter, and monetization sources are readable.");
  } catch (error) {
    pushCheck(checks, "source-files-readable", false, error.message || "Paywall launch sources could not be read.");
  }

  if (!monetizationSource || !paywallBlock || !offerSource || !presenterSource) return finalizeReport(checks);

  const normalizedMonetization = normalizeSource(monetizationSource);
  const normalizedPaywall = normalizeSource(paywallBlock);
  const normalizedOffer = normalizeSource(offerSource);

  pushCheck(
    checks,
    "launch-plan-ids-core3",
    hasExactLaunchPlanConstant(monetizationSource),
    "LAUNCH_PREMIUM_PLAN_IDS is yearly, monthly in launch order.",
  );
  pushCheck(
    checks,
    "launch-product-ids-present",
    Object.values(LAUNCH_PRODUCT_IDS).every((productId) => monetizationSource.includes(productId)),
    "Core 3 product IDs are present in monetization config.",
  );
  pushCheck(
    checks,
    "launch-plan-api-filters-core3",
    normalizedMonetization.includes("getPremiumPlans(options).filter((plan) => isLaunchPremiumPlanId(plan.id))"),
    "getLaunchPremiumPlans filters products through isLaunchPremiumPlanId.",
  );
  pushCheck(
    checks,
    "purchase-api-launch-only",
    normalizedMonetization.includes("const plan = getLaunchPremiumPlan(planId, options)") &&
      normalizedMonetization.includes("This premium plan is reserved for a future FREED release."),
    "purchasePremiumPlan resolves only launch products and rejects future plans.",
  );
  pushCheck(
    checks,
    "restore-api-launch-only",
    normalizedMonetization.includes("nativeProvider.restorePremiumPurchases(getLaunchPremiumPlans(options), config)") &&
      normalizedMonetization.includes("Native restore returned a product reserved for a future FREED release."),
    "restorePremiumPurchases passes only launch plans to native restore and rejects future products.",
  );
  pushCheck(
    checks,
    "paywall-uses-launch-plan-api",
    normalizedPaywall.includes("getLaunchPremiumPlans({ platform })"),
    "PaywallScreen gets plans from getLaunchPremiumPlans.",
  );
  pushCheck(
    checks,
    "paywall-renders-launch-plans",
    includesAll(normalizedPaywall, ["launchPlans.map((item)", "<PremiumOffer", "plans={presentations}"]) &&
      includesAll(normalizedOffer, ["plans.map((plan)", "key={plan.id}", "presentation.headline", "presentation.cadence"]),
    "PaywallScreen passes launch product presentations to PremiumOffer, which displays each actual billed amount and cadence.",
  );
  pushCheck(
    checks,
    "paywall-defaults-yearly-value-anchor",
    normalizedPaywall.includes('React.useState<LaunchPremiumPlanId>("yearly")'),
    "PaywallScreen defaults the selected plan to yearly.",
  );
  pushCheck(
    checks,
    "paywall-purchases-selected-plan",
    includesAll(normalizedPaywall, ["selectedPlan={plan}", "onSelectPlan={setPlan}", "if (!busy && selectedPresentation?.canPurchase) onSubscribe(plan)"]) &&
      includesAll(normalizedOffer, ["onPress={() => onSelectPlan(plan.id)}", 'priceStatus === "ready" && selectedPresentation?.canPurchase === true', "disabled={busy || !canSubscribe}", "if (!busy && canSubscribe) onSubscribe()"]),
    "The selected launch plan reaches checkout only after the current store price is verified as purchasable and no purchase is busy.",
  );
  pushCheck(
    checks,
    "paywall-restore-visible",
    normalizedPaywall.includes("onRestore={onRestore}") &&
      includesAll(normalizedOffer, ['label="Restore purchases"', "onPress={onRestore}", "disabled={busy}"]),
    "PaywallScreen passes restore through to the visible offer action.",
  );
  pushCheck(
    checks,
    "paywall-premium-no-ad-copy-visible",
    normalizedOffer.includes("Ad-free resets and recovery challenges"),
    "PremiumOffer describes ad-free recovery value without fabricated introductory offers.",
  );
  pushCheck(
    checks,
    "paywall-server-verification-gates-premium",
    includesAll(paywallSource, [
      "configureNativeMonetizationRuntime({",
      "verifyStorePurchase: async (payload)",
      "return contracts.verifyStorePurchase(payload)",
      "if (result.premium)",
      "setPremiumPlan",
    ]),
    "The native checkout runtime uses authenticated store verification and Premium state follows the verified purchase/restore result.",
  );
  pushCheck(
    checks,
    "paywall-future-products-hidden",
    paywallOmitsFuturePlans(`${paywallBlock}\n${offerSource}`),
    "The paywall controller and offer view omit family/accountability/AI-coach future SKUs and labels.",
    "Remove future product IDs or future plan labels from PaywallScreen until v1 evidence passes.",
  );
  pushCheck(
    checks,
    "paywall-close-is-direct",
    !normalizedPaywall.includes("showDownsell") &&
      includesAll(normalizedPaywall, ["onClose={() => { if (!busy) onClose(); }}"]) &&
      includesAll(normalizedOffer, ['label="Continue with Free"', "onPress={onClose}", "disabled={busy}"]),
    "The offer closes directly to the caller's free path, with no retention modal, except while checkout is busy.",
  );
  pushCheck(
    checks,
    "paywall-prices-fail-closed",
    includesAll(normalizeSource(presenterSource), ['options.status === "ready"', "Boolean(pricing?.storeLocalized)"]) &&
      includesAll(normalizedOffer, ["disabled={busy || !canSubscribe}", 'priceStatus === "loading"', 'label="Retry store prices"', "{priceError ??"]),
    "Unavailable or loading prices disable checkout and expose a retry instead of using fallback prices for native purchases.",
  );
  pushCheck(
    checks,
    "paywall-no-client-premium-bypass",
    includesAll(paywallSource, ["purchasePremiumPlan(planId", "restorePremiumPurchases({ platform", "if (result.premium)", "setPremiumPlan"]),
    "Premium state is set after purchase/restore result.premium, not from a visible client toggle.",
  );

  return finalizeReport(checks, {
    launchPlanIds: LAUNCH_PLAN_IDS,
    launchProductIds: LAUNCH_PRODUCT_IDS,
    futurePlanIdsDisabledForV1: FUTURE_PLAN_IDS,
    futureProductIdsDisabledForV1: FUTURE_PRODUCT_IDS,
    sourceArtifacts: {
      paywall: { path: PAYWALL_SOURCE_PATH, sha256: `sha256-${sha256File(PAYWALL_SOURCE_PATH)}` },
      offer: { path: OFFER_SOURCE_PATH, sha256: `sha256-${sha256File(OFFER_SOURCE_PATH)}` },
      presenter: { path: PRESENTER_SOURCE_PATH, sha256: `sha256-${sha256File(PRESENTER_SOURCE_PATH)}` },
      monetization: { path: MONETIZATION_SOURCE_PATH, sha256: `sha256-${sha256File(MONETIZATION_SOURCE_PATH)}` },
    },
  });
}

function finalizeReport(checks, extra = {}) {
  const failCount = checks.filter((check) => check.status === "fail").length;
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result: failCount === 0 ? "pass" : "fail",
    passCount: checks.length - failCount,
    failCount,
    releaseBoundary:
      "Local paywall source precheck only. This does not prove the submitted native build, store products, rewarded ads, server receipt verification, or sandbox purchases passed.",
    checks,
    ...extra,
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runSelfTest() {
  const sample = "function PaywallScreen() { const a = { nested: true }; return <View>{{a}}</View>; } function Next() {}";
  assert.match(extractFunctionBlock(sample, "PaywallScreen"), /nested/);
  const typedParams = "function PaywallScreen({ onClose }: { onClose: () => void }) { return onClose; }";
  assert.match(extractFunctionBlock(typedParams, "PaywallScreen"), /return onClose/);
  assert.equal(hasExactLaunchPlanConstant('export const LAUNCH_PREMIUM_PLAN_IDS = ["yearly", "monthly"] as const;'), true);
  assert.equal(hasExactLaunchPlanConstant('export const LAUNCH_PREMIUM_PLAN_IDS = ["yearly", "family", "monthly"] as const;'), false);
  assert.equal(paywallOmitsFuturePlans("Annual Monthly Lifetime"), true);
  assert.equal(paywallOmitsFuturePlans("Annual Family Plan"), false);
  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/paywall.json"]), /docs\/validation\/evidence/);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-paywall-scope-audit-"));
  try {
    const tempReport = path.join(tempDir, "report.json");
    fs.writeFileSync(tempReport, JSON.stringify(finalizeReport([{ id: "x", status: "pass", detail: "ok", next: "" }]), null, 2));
    assert.equal(JSON.parse(fs.readFileSync(tempReport, "utf8")).schemaVersion, SCHEMA_VERSION);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log("paywall launch scope audit self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  const report = buildReport();
  writeReport(options.reportPath, report);
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(options.reportPath),
        result: report.result,
        passCount: report.passCount,
        failCount: report.failCount,
        schemaVersion: report.schemaVersion,
        sanitized: report.sanitized,
      },
      null,
      2,
    ),
  );
  if (report.result !== "pass") process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReport,
  extractFunctionBlock,
  hasExactLaunchPlanConstant,
  paywallOmitsFuturePlans,
};
