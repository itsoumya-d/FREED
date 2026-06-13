#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-store-launch-catalog-audit-v1";
const DEFAULT_REPORT = "docs/validation/artifacts/store-launch-catalog-current/store-launch-catalog-audit.json";
const CATALOG_PATH = "store/store-products.json";
const APP_STORE_CSV_PATH = "store/app-store/in-app-purchases.csv";
const PLAY_STORE_CSV_PATH = "store/play-store/products.csv";
const SCREENSHOT_MANIFEST_PATH = "store/screenshots/manifest.json";
const LISTING_SCREENSHOT_PLAN_PATH = "store/screenshots/listing-screenshot-plan.md";
const LISTING_SCREENSHOT_MANIFEST_TEMPLATE_PATH = "store/screenshots/listing/manifest.template.json";
const LISTING_SCREENSHOT_MANIFEST_PATH = "store/screenshots/listing/manifest.json";
const CONSOLE_PACKET_PATH = "store/console-launch-packet.md";
const LAUNCH_PLANS = [
  { planId: "yearly", productId: "freed_premium_yearly", priceUsd: "39.99" },
  { planId: "monthly", productId: "freed_premium_monthly", priceUsd: "9.99" },
  { planId: "lifetime", productId: "freed_premium_lifetime", priceUsd: "79.99" },
];
const LAUNCH_PRODUCT_IDS = LAUNCH_PLANS.map((plan) => plan.productId);
const FUTURE_PRODUCT_IDS = ["freed_family_yearly", "freed_accountability_monthly", "freed_ai_coach_monthly"];
const LISTING_SCREENSHOT_EXPECTED_IDS = [
  "turn-on-real-protection",
  "block-adult-sites-safely",
  "interrupt-app-loops",
  "recover-in-the-moment",
  "keep-privacy-local",
  "upgrade-without-ad-breaks",
];
const LISTING_SCREENSHOT_REQUIRED_FIELDS = [
  "id",
  "platform",
  "deviceClass",
  "sourceBuild",
  "sourceCapturePath",
  "finalAssetPath",
  "headline",
  "screen",
  "width",
  "height",
  "sha256",
  "reviewBoundary",
];

function printHelp() {
  console.log(`Usage: npm run audit:store-catalog -- [options]

Validates the local v1 Core 3 store catalog, App Store CSV, Play CSV, IAP
review screenshot manifest, listing screenshot capture plan, and console
handoff references. It does not inspect or mutate App Store Connect or Google
Play Console.

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

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readJsonIfExists(relativePath) {
  const absolutePath = resolveInputPath(relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { error: "", exists: false, value: null };
  }
  try {
    return { error: "", exists: true, value: readJson(relativePath) };
  } catch (error) {
    return { error: error.message || "JSON could not be parsed.", exists: true, value: null };
  }
}

function sha256File(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(resolveInputPath(relativePath))).digest("hex");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  if (inQuotes) throw new Error("CSV contains an unterminated quoted field.");
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).filter((values) => values.some((value) => value !== "")).map((values) =>
    Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""])),
  );
}

function readPngDimensions(relativePath) {
  const buffer = fs.readFileSync(resolveInputPath(relativePath));
  if (buffer.length < 24 || buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
    throw new Error(`${relativePath} is not a PNG file.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function pushCheck(checks, id, passed, detail, next = "") {
  checks.push({
    id,
    status: passed ? "pass" : "fail",
    detail,
    next,
  });
}

function hasExactSet(values, expected) {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}

function productByPlan(products) {
  return Object.fromEntries((products || []).map((product) => [product.planId, product]));
}

function csvByPlan(rows) {
  return Object.fromEntries(rows.map((row) => [row.plan_id, row]));
}

function normalizeSha256(value) {
  return String(value || "").trim().replace(/^sha256-/i, "");
}

function missingListingFields(asset) {
  return LISTING_SCREENSHOT_REQUIRED_FIELDS.filter((field) => {
    const value = asset?.[field];
    if (field === "width" || field === "height") return !Number.isFinite(Number(value)) || Number(value) <= 0;
    return typeof value !== "string" || !value.trim();
  });
}

function summarizeListingScreenshotTemplate(template) {
  const assets = Array.isArray(template?.assets) ? template.assets : [];
  const assetIds = assets.map((asset) => asset.id).filter(Boolean);
  const missingRequiredFields = assets.flatMap((asset) =>
    missingListingFields(asset)
      .filter((field) => !["sourceBuild", "sourceCapturePath", "finalAssetPath", "sha256"].includes(field))
      .map((field) => `${asset.id || "missing-id"}.${field}`),
  );
  const valid =
    template?.schemaVersion === "freed-store-listing-screenshot-template-v1" &&
    template?.finalManifestPath === LISTING_SCREENSHOT_MANIFEST_PATH &&
    hasExactSet(assetIds, LISTING_SCREENSHOT_EXPECTED_IDS) &&
    missingRequiredFields.length === 0;
  return {
    assetCount: assets.length,
    assetIds,
    exists: Boolean(template),
    finalManifestPath: template?.finalManifestPath || LISTING_SCREENSHOT_MANIFEST_PATH,
    missingRequiredFields,
    path: LISTING_SCREENSHOT_MANIFEST_TEMPLATE_PATH,
    schemaVersion: template?.schemaVersion || "",
    valid,
  };
}

function summarizeListingScreenshotReadiness() {
  const manifestRead = readJsonIfExists(LISTING_SCREENSHOT_MANIFEST_PATH);
  const base = {
    expectedAssetIds: LISTING_SCREENSHOT_EXPECTED_IDS,
    manifestPath: LISTING_SCREENSHOT_MANIFEST_PATH,
    requiredBeforeStoreUpload: true,
    templatePath: LISTING_SCREENSHOT_MANIFEST_TEMPLATE_PATH,
  };

  if (!manifestRead.exists) {
    return {
      ...base,
      assetCount: 0,
      blockers: ["listing-screenshot-manifest-missing"],
      exists: false,
      next: `Capture signed-build public listing screenshots and write ${LISTING_SCREENSHOT_MANIFEST_PATH}.`,
      readyForStoreUpload: false,
      status: "pending-capture",
    };
  }

  if (!manifestRead.value) {
    return {
      ...base,
      assetCount: 0,
      blockers: ["listing-screenshot-manifest-unreadable"],
      error: manifestRead.error,
      exists: true,
      next: `Fix ${LISTING_SCREENSHOT_MANIFEST_PATH} so it is valid JSON.`,
      readyForStoreUpload: false,
      status: "invalid",
    };
  }

  const manifest = manifestRead.value;
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
  const assetIds = assets.map((asset) => asset.id).filter(Boolean);
  const missingConceptIds = LISTING_SCREENSHOT_EXPECTED_IDS.filter((id) => !assetIds.includes(id));
  const extraConceptIds = assetIds.filter((id) => !LISTING_SCREENSHOT_EXPECTED_IDS.includes(id));
  const missingFields = assets.flatMap((asset) =>
    missingListingFields(asset).map((field) => `${asset.id || "missing-id"}.${field}`),
  );

  const assetResults = assets.map((asset) => {
    const finalAssetPath = asset.finalAssetPath || "";
    const absolutePath = finalAssetPath ? resolveInputPath(finalAssetPath) : "";
    const fileExists = Boolean(absolutePath && fs.existsSync(absolutePath));
    let actualSha256 = "";
    let dimensions = { height: 0, width: 0 };
    let pngReadable = false;
    if (fileExists) {
      try {
        actualSha256 = sha256File(finalAssetPath);
        dimensions = readPngDimensions(finalAssetPath);
        pngReadable = true;
      } catch {
        pngReadable = false;
      }
    }
    return {
      dimensionsMatch:
        pngReadable &&
        dimensions.width === Number(asset.width || 0) &&
        dimensions.height === Number(asset.height || 0),
      fileExists,
      finalAssetPath,
      hashMatches: Boolean(actualSha256 && normalizeSha256(asset.sha256) === actualSha256),
      id: asset.id || "",
      platform: asset.platform || "",
      pngReadable,
    };
  });

  const blockers = [
    manifest.schemaVersion !== "freed-store-listing-screenshots-v1" ? "listing-screenshot-schema-invalid" : "",
    missingConceptIds.length > 0 ? "listing-screenshot-required-concepts-missing" : "",
    extraConceptIds.length > 0 ? "listing-screenshot-unexpected-concepts-present" : "",
    missingFields.length > 0 ? "listing-screenshot-required-fields-missing" : "",
    assetResults.some((asset) => !asset.fileExists) ? "listing-screenshot-final-assets-missing" : "",
    assetResults.some((asset) => asset.fileExists && !asset.pngReadable) ? "listing-screenshot-final-assets-not-png" : "",
    assetResults.some((asset) => asset.fileExists && asset.pngReadable && !asset.dimensionsMatch)
      ? "listing-screenshot-dimensions-mismatch"
      : "",
    assetResults.some((asset) => asset.fileExists && asset.pngReadable && !asset.hashMatches)
      ? "listing-screenshot-hash-mismatch"
      : "",
  ].filter(Boolean);

  return {
    ...base,
    assetCount: assets.length,
    assetResults,
    blockers,
    exists: true,
    extraConceptIds,
    missingConceptIds,
    missingFields,
    next:
      blockers.length === 0
        ? "Use these verified public listing screenshots for store listing upload only."
        : `Fix ${LISTING_SCREENSHOT_MANIFEST_PATH} and regenerate any mismatched public listing screenshot assets.`,
    readyForStoreUpload: blockers.length === 0,
    schemaVersion: manifest.schemaVersion || "",
    sourceBuilds: [...new Set(assets.map((asset) => asset.sourceBuild).filter(Boolean))],
    status: blockers.length === 0 ? "ready-for-store-upload" : "invalid",
  };
}

function buildReport() {
  const checks = [];
  let catalog = null;
  let appRows = [];
  let playRows = [];
  let screenshotManifest = null;
  let listingScreenshotPlan = "";
  let listingScreenshotTemplate = null;
  let consolePacket = "";

  try {
    catalog = readJson(CATALOG_PATH);
    appRows = parseCsv(readText(APP_STORE_CSV_PATH));
    playRows = parseCsv(readText(PLAY_STORE_CSV_PATH));
    screenshotManifest = readJson(SCREENSHOT_MANIFEST_PATH);
    listingScreenshotPlan = readText(LISTING_SCREENSHOT_PLAN_PATH);
    listingScreenshotTemplate = readJson(LISTING_SCREENSHOT_MANIFEST_TEMPLATE_PATH);
    consolePacket = readText(CONSOLE_PACKET_PATH);
  } catch (error) {
    pushCheck(checks, "source-files-readable", false, error.message || "Store launch sources could not be read.");
  }

  if (!catalog || !screenshotManifest) {
    return finalizeReport(checks);
  }

  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const productPlanMap = productByPlan(products);
  const appRowMap = csvByPlan(appRows);
  const playRowMap = csvByPlan(playRows);
  const screenshotAssets = Array.isArray(screenshotManifest.assets) ? screenshotManifest.assets : [];
  const screenshotProductIds = screenshotAssets.map((asset) => asset.productId);
  const listingScreenshotTemplateSummary = summarizeListingScreenshotTemplate(listingScreenshotTemplate);
  const listingScreenshotReadiness = summarizeListingScreenshotReadiness();

  pushCheck(checks, "catalog-schema", catalog.schemaVersion === "freed-store-products-v1", `${CATALOG_PATH} schema is ${catalog.schemaVersion || "missing"}.`);
  pushCheck(checks, "bundle-and-package", catalog.bundleId === "app.freed.recovery" && catalog.packageName === "app.freed.recovery", "Catalog bundle/package match app.freed.recovery.");
  pushCheck(checks, "premium-entitlement", catalog.entitlementId === "premium", "Catalog entitlement is premium.");
  pushCheck(checks, "launch-product-order", JSON.stringify(catalog.launchProductIds || []) === JSON.stringify(LAUNCH_PRODUCT_IDS), "Launch products are yearly, monthly, lifetime in order.");
  pushCheck(checks, "future-products-disabled", hasExactSet(catalog.futureProductsDisabledForV1 || [], FUTURE_PRODUCT_IDS), "Future family/accountability/AI coach SKUs are disabled for v1.");
  pushCheck(checks, "products-core3-only", hasExactSet(products.map((product) => product.productId), LAUNCH_PRODUCT_IDS), "Catalog products contain only Core 3 product IDs.");

  for (const plan of LAUNCH_PLANS) {
    const product = productPlanMap[plan.planId];
    const appRow = appRowMap[plan.planId];
    const playRow = playRowMap[plan.planId];
    const screenshot = screenshotAssets.find((asset) => asset.planId === plan.planId);
    pushCheck(checks, `${plan.planId}-catalog-product`, Boolean(product && product.productId === plan.productId && product.priceUsd === plan.priceUsd), `${plan.planId} catalog product matches product ID and price.`);
    pushCheck(checks, `${plan.planId}-app-store-row`, Boolean(appRow && appRow.product_id === plan.productId && appRow.price_usd_intent === plan.priceUsd && appRow.entitlement_id === "premium"), `${plan.planId} App Store CSV row matches product, price, and entitlement.`);
    pushCheck(checks, `${plan.planId}-play-store-row`, Boolean(playRow && playRow.product_id === plan.productId && playRow.price_usd_intent === plan.priceUsd && playRow.entitlement_id === "premium"), `${plan.planId} Play CSV row matches product, price, and entitlement.`);
    pushCheck(checks, `${plan.planId}-screenshot-manifest`, Boolean(screenshot && screenshot.productId === plan.productId && screenshot.path), `${plan.planId} screenshot manifest row exists.`);
  }

  pushCheck(
    checks,
    "apple-product-types",
    productPlanMap.yearly?.apple?.productType === "auto-renewable-subscription" &&
      productPlanMap.monthly?.apple?.productType === "auto-renewable-subscription" &&
      productPlanMap.lifetime?.apple?.productType === "non-consumable" &&
      productPlanMap.yearly?.apple?.subscriptionGroupId === "freed_premium" &&
      productPlanMap.monthly?.apple?.subscriptionGroupId === "freed_premium" &&
      productPlanMap.lifetime?.apple?.subscriptionGroupId === null,
    "App Store product types are subscription/subscription/non-consumable.",
  );
  pushCheck(
    checks,
    "google-product-types",
    productPlanMap.yearly?.google?.productType === "subscription" &&
      productPlanMap.monthly?.google?.productType === "subscription" &&
      productPlanMap.lifetime?.google?.productType === "one-time-product" &&
      productPlanMap.lifetime?.google?.purchaseType === "non-consumable",
    "Play product types are subscription/subscription/one-time non-consumable.",
  );
  pushCheck(checks, "app-store-csv-core3-only", hasExactSet(appRows.map((row) => row.product_id), LAUNCH_PRODUCT_IDS), "App Store CSV contains only Core 3 product IDs.");
  pushCheck(checks, "play-store-csv-core3-only", hasExactSet(playRows.map((row) => row.product_id), LAUNCH_PRODUCT_IDS), "Play CSV contains only Core 3 product IDs.");
  pushCheck(checks, "screenshots-core3-only", hasExactSet(screenshotProductIds, LAUNCH_PRODUCT_IDS), "Screenshot manifest contains only Core 3 product screenshots.");
  pushCheck(
    checks,
    "future-products-not-in-active-sources",
    ![...products.map((product) => product.productId), ...appRows.map((row) => row.product_id), ...playRows.map((row) => row.product_id), ...screenshotProductIds].some((productId) =>
      FUTURE_PRODUCT_IDS.includes(productId),
    ),
    "Future SKUs are absent from active catalog, CSV, and screenshot rows.",
  );

  let screenshotHashPass = true;
  let screenshotDimensionPass = true;
  for (const asset of screenshotAssets) {
    try {
      const actualHash = sha256File(asset.path);
      const dimensions = readPngDimensions(asset.path);
      if (actualHash !== asset.sha256) screenshotHashPass = false;
      if (dimensions.width !== asset.width || dimensions.height !== asset.height) screenshotDimensionPass = false;
    } catch {
      screenshotHashPass = false;
      screenshotDimensionPass = false;
    }
  }
  pushCheck(checks, "screenshot-hashes", screenshotHashPass, "Screenshot hashes match the manifest.");
  pushCheck(checks, "screenshot-dimensions", screenshotDimensionPass, "Screenshot PNG dimensions match the manifest.");
  pushCheck(
    checks,
    "console-packet-references",
    [CATALOG_PATH, APP_STORE_CSV_PATH, PLAY_STORE_CSV_PATH, SCREENSHOT_MANIFEST_PATH, LISTING_SCREENSHOT_PLAN_PATH].every((needle) =>
      consolePacket.includes(needle),
    ),
    "Console launch packet references catalog, CSVs, IAP screenshot manifest, and listing screenshot plan.",
  );
  pushCheck(
    checks,
    "listing-screenshot-plan",
    listingScreenshotPlan.includes("FREED Store Listing Screenshot Plan") &&
      listingScreenshotPlan.includes("TURN ON REAL PROTECTION") &&
      listingScreenshotPlan.includes("BLOCK ADULT SITES SAFELY") &&
      listingScreenshotPlan.includes("INTERRUPT APP LOOPS") &&
      listingScreenshotPlan.includes("RECOVER IN THE MOMENT") &&
      listingScreenshotPlan.includes("KEEP PRIVACY LOCAL") &&
      listingScreenshotPlan.includes("UPGRADE WITHOUT AD BREAKS") &&
      listingScreenshotPlan.includes("store/screenshots/listing/manifest.json") &&
      listingScreenshotPlan.includes("manifest.template.json") &&
      listingScreenshotPlan.includes("Do not use these screenshots as physical-device protection evidence"),
    "Listing screenshot plan defines public listing captures separately from IAP review screenshots and physical-device evidence.",
  );
  pushCheck(
    checks,
    "listing-screenshot-manifest-template",
    listingScreenshotTemplateSummary.valid,
    "Listing screenshot manifest template covers the six public listing concepts and points to the final manifest path.",
    "Keep the template scoped to public listing assets; the final manifest must be generated from signed-build captures before store upload.",
  );
  if (listingScreenshotReadiness.exists) {
    pushCheck(
      checks,
      "listing-screenshot-final-manifest-valid",
      listingScreenshotReadiness.readyForStoreUpload === true,
      listingScreenshotReadiness.readyForStoreUpload
        ? "Public listing screenshot manifest and final assets are valid for store listing upload."
        : `Public listing screenshot manifest is present but not valid: ${listingScreenshotReadiness.blockers.join(", ")}`,
      "Fix or remove the final listing screenshot manifest; missing final listing screenshots are tracked as pending launch work, but malformed final assets block the catalog audit.",
    );
  }

  return finalizeReport(checks, {
    listingScreenshotReadiness,
    sourceArtifacts: {
      storeProductsCatalog: { path: CATALOG_PATH, sha256: `sha256-${sha256File(CATALOG_PATH)}` },
      appStoreConnectCsv: { path: APP_STORE_CSV_PATH, sha256: `sha256-${sha256File(APP_STORE_CSV_PATH)}` },
      googlePlayProductsCsv: { path: PLAY_STORE_CSV_PATH, sha256: `sha256-${sha256File(PLAY_STORE_CSV_PATH)}` },
      screenshotManifest: { path: SCREENSHOT_MANIFEST_PATH, sha256: `sha256-${sha256File(SCREENSHOT_MANIFEST_PATH)}` },
      listingScreenshotPlan: { path: LISTING_SCREENSHOT_PLAN_PATH, sha256: `sha256-${sha256File(LISTING_SCREENSHOT_PLAN_PATH)}` },
      listingScreenshotManifestTemplate: {
        path: LISTING_SCREENSHOT_MANIFEST_TEMPLATE_PATH,
        sha256: `sha256-${sha256File(LISTING_SCREENSHOT_MANIFEST_TEMPLATE_PATH)}`,
      },
    },
    launchProductIds: Object.fromEntries(LAUNCH_PLANS.map((plan) => [plan.planId, plan.productId])),
    futureProductsDisabledForV1: FUTURE_PRODUCT_IDS,
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
      "Local catalog precheck only. This does not prove App Store Connect or Google Play Console products exist, are reviewed, or have passed sandbox purchases.",
    checks,
    ...extra,
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function runSelfTest() {
  assert.deepEqual(parseCsv('a,b\n1,"two, too"\n3,"quoted ""value"""\n'), [
    { a: "1", b: "two, too" },
    { a: "3", b: 'quoted "value"' },
  ]);
  assert.throws(() => parseCsv('a,b\n1,"bad\n'), /unterminated/);
  assert.equal(hasExactSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hasExactSet(["a", "b", "b"], ["a", "b"]), false);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-store-catalog-audit-"));
  try {
    const pngPath = path.join(tempDir, "one.png");
    fs.writeFileSync(
      pngPath,
      Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000020802000000", "hex"),
    );
    assert.deepEqual(readPngDimensions(pngPath), { width: 1, height: 2 });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  assert.throws(() => parseArgs(["--report", "docs/validation/evidence/store-catalog.json"]), /docs\/validation\/evidence/);
  console.log("store launch catalog audit self-test: pass");
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

main();
