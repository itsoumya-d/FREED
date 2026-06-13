#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertSafeArtifactOutputDir } = require("./lib/evidence-output-safety");
const { safeExternalHttpsUrl } = require("./lib/evidence-target-safety");

const TEMPLATE_PATH = path.join("docs", "validation", "templates", "normal-browsing-corpus.template.json");
const CLASSIFIER_CORPUS_PATH = path.join("scripts", "classifier-safety-corpus.ts");
const DEFAULT_BROWSERS = [
  "ios:Safari",
  "android:Chrome:com.android.chrome",
  "android:Firefox:org.mozilla.firefox",
  "android:Edge:com.microsoft.emmx",
  "android:Samsung Internet:com.sec.android.app.sbrowser",
].join(",");

function parseArgs(argv) {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  let outputDirProvided = Boolean(process.env.FREED_NORMAL_BROWSING_OUTPUT);
  const options = {
    browsers: parseBrowserRows(process.env.FREED_NORMAL_BROWSING_BROWSERS || DEFAULT_BROWSERS),
    outputDir: process.env.FREED_NORMAL_BROWSING_OUTPUT || "",
    planOnly: false,
    runId,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--browser") {
      options.browsers.push(parseBrowserRow(next()));
    } else if (arg === "--browsers") {
      options.browsers = parseBrowserRows(next());
    } else if (arg === "--output-dir") {
      options.outputDir = next();
      outputDirProvided = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--run-id") {
      options.runId = safeRunId(next());
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!outputDirProvided) {
    options.outputDir = path.join("docs", "validation", "artifacts", options.runId, "normal-browsing-corpus-capture");
  }
  options.outputDir = assertSafeArtifactOutputDir(options.outputDir, "--output-dir");
  if (options.selfTest) return options;
  validateBrowserRows(options.browsers);
  return options;
}

function printHelp() {
  console.log(`Usage: npm run evidence:normal-browsing-corpus -- [options]

Generates a manual QA run matrix for the normal-browsing false-positive corpus.
It writes CSV/JSON/Markdown artifacts under docs/validation/artifacts but does
not mark evidence as passing.

Options:
  --browser <platform:browser[:package]>
                            Add one browser row, for example ios:Safari or
                            android:Chrome:com.android.chrome.
  --browsers <list>          Comma list of browser rows. Default:
                            ${DEFAULT_BROWSERS}
  --output-dir <path>        Artifact output folder.
  --run-id <id>              Machine-readable run id.
  --plan-only                Print the matrix summary without writing files.
  --self-test                Run offline parser and matrix checks.
`);
}

function safeRunId(value) {
  const normalized = String(value).trim();
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized) || normalized === "." || normalized === "..") {
    throw new Error("Run id may only contain letters, numbers, dots, dashes, underscores, and colons.");
  }
  return normalized;
}

function parseBrowserRows(value) {
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseBrowserRow);
}

function parseBrowserRow(value) {
  const [platform, browserName, browserPackage = ""] = String(value).split(":").map((entry) => entry.trim());
  if (!platform || !browserName) {
    throw new Error(`Invalid browser row: ${value}. Use platform:browser[:package].`);
  }
  return { platform: platform.toLowerCase(), browserName, browserPackage };
}

function validateBrowserRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("At least one browser row is required.");
  const hasIosSafari = rows.some((row) => row.platform === "ios" && row.browserName.toLowerCase() === "safari");
  const hasAndroidChrome = rows.some(
    (row) =>
      row.platform === "android" &&
      row.browserName.toLowerCase().includes("chrome") &&
      row.browserPackage === "com.android.chrome",
  );
  const hasAndroidFirefox = rows.some(
    (row) =>
      row.platform === "android" &&
      row.browserName.toLowerCase().includes("firefox") &&
      row.browserPackage === "org.mozilla.firefox",
  );
  const hasAndroidEdge = rows.some(
    (row) =>
      row.platform === "android" &&
      row.browserName.toLowerCase().includes("edge") &&
      row.browserPackage === "com.microsoft.emmx",
  );
  const hasAndroidSamsung = rows.some(
    (row) =>
      row.platform === "android" &&
      row.browserName.toLowerCase().includes("samsung") &&
      row.browserPackage === "com.sec.android.app.sbrowser",
  );
  if (!hasIosSafari) throw new Error("Browser matrix must include iOS Safari.");
  if (!hasAndroidChrome) throw new Error("Browser matrix must include Android Chrome with com.android.chrome.");
  if (!hasAndroidFirefox) throw new Error("Browser matrix must include Android Firefox with org.mozilla.firefox.");
  if (!hasAndroidEdge) throw new Error("Browser matrix must include Android Edge.");
  if (!hasAndroidSamsung) throw new Error("Browser matrix must include Samsung Internet with com.sec.android.app.sbrowser.");
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function fileSha256Label(relativePath) {
  return `sha256-${crypto.createHash("sha256").update(fs.readFileSync(path.join(process.cwd(), relativePath))).digest("hex")}`;
}

function sourceArtifacts(paths) {
  return paths.map((sourcePath) => ({
    path: sourcePath,
    sha256: fileSha256Label(sourcePath),
  }));
}

function parseClassifierCorpus(source) {
  const rows = [];
  const pattern = /\{\s*id:\s*"([^"]+)",\s*group:\s*"([^"]+)",\s*url:\s*"([^"]+)",\s*expected:\s*"([^"]+)"\s*\}/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    rows.push({
      id: match[1],
      group: match[2],
      url: match[3],
      expected: match[4],
    });
  }
  return rows;
}

function templateUrlRows(template) {
  const normalBrowsing = template.normalBrowsing || {};
  const groups = [
    ["allowed", "allow", normalBrowsing.allowedUrls || []],
    ["recovery-search", "allow", normalBrowsing.recoverySearchUrls || []],
    ["adult-blocked", "block", normalBrowsing.adultBlockedUrls || []],
  ];
  return groups.flatMap(([group, expected, urls]) =>
    urls.map((url, index) => ({
      id: `${group}-${index + 1}`,
      group,
      url,
      expected,
      source: "normal-browsing-template",
    })),
  );
}

function dedupeRows(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = `${row.expected}:${row.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

function buildMatrix(options) {
  const template = readJson(TEMPLATE_PATH);
  const classifierRows = parseClassifierCorpus(readText(CLASSIFIER_CORPUS_PATH));
  const requiredRows = templateUrlRows(template);
  const manualRows = validateManualBrowserRows(dedupeRows(requiredRows));
  const staticClassifierRows = classifierRows.map((row) => ({ ...row, source: CLASSIFIER_CORPUS_PATH }));
  const browserRows = options.browsers.map((browser, index) => ({
    ...browser,
    id: `${browser.platform}-${slug(browser.browserName || `browser-${index + 1}`)}`,
  }));
  const cases = browserRows.flatMap((browser) =>
    manualRows.map((row) => ({
      actualResult: "",
      artifact: "",
      browserId: browser.id,
      browserName: browser.browserName,
      browserPackage: browser.browserPackage,
      expected: row.expected,
      group: row.group,
      notes: "",
      platform: browser.platform,
      source: row.source,
      status: "pending-manual-qa",
      testId: `${browser.id}-${slug(row.id)}`,
      url: row.url,
    })),
  );
  return {
    browserRows,
    cases,
    classifierRows,
    manualRows,
    requiredRows,
    staticClassifierRows,
    template,
  };
}

function validateManualBrowserRows(rows) {
  return rows.map((row) => ({
    ...row,
    url: safeExternalHttpsUrl(row.url, `normal-browsing ${row.group} URL ${row.id}`),
  }));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  const header = [
    "testId",
    "platform",
    "browserName",
    "browserPackage",
    "group",
    "expected",
    "actualResult",
    "url",
    "artifact",
    "status",
    "notes",
    "source",
  ];
  return `${[header, ...rows.map((row) => header.map((field) => row[field]))]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function toClassifierCsv(rows) {
  const header = ["id", "group", "expected", "url", "source"];
  return `${[header, ...rows.map((row) => header.map((field) => row[field]))]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n")}\n`;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function writeJsonArtifact(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeTextArtifact(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function buildNotes(manifest) {
  const lines = [
    `# Normal-Browsing Corpus Capture: ${manifest.runId}`,
    "",
    "This folder contains a manual QA run matrix. It does not satisfy release evidence by itself.",
    `Manifest boundary: \`${manifest.releaseBoundary}\``,
    `Evidence satisfied: \`${manifest.evidenceSatisfied}\``,
    "",
    "How to use:",
    "",
    "1. Run every matrix row on the named physical device/browser with FREED protection enabled.",
    "2. Fill `actualResult`, `artifact`, `status`, and notes in the CSV or copy results into a QA report.",
    "3. Put screenshots, videos, and logs under the same artifact folder or a production-safe HTTPS QA URL.",
    "4. Use `normal-browsing-browser-checklist.md` as the per-browser capture checklist while filling the CSV.",
    "5. Complete the per-browser `browser-report-templates/*.template.json` files and reference the completed local JSON reports from `normalBrowsing.browserMatrix[].resultArtifact`.",
    "6. Fill `normal-browsing-corpus.json` with exact counts and artifact references.",
    "7. Run `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence` before promotion.",
    "",
    "The manual browser matrix intentionally uses only the release template's real external URL sets. Synthetic classifier-corpus URLs are exported separately as static classifier proof and are not physical browser QA targets.",
    "`normal-browsing-corpus-matrix.csv` is the physical-browser run sheet; `classifier-corpus-static.csv` is classifier coverage proof only.",
    "`normal-browsing-browser-summary.template.json` precomputes pending `normalBrowsing.browserMatrix` rows with exact URL counts for each browser. Keep the rows pending until physical-device QA fills device details, result artifacts, pass counts, zero failure counts, and `passed=true`.",
    "`browser-report-templates/*.template.json` are pending `freed-normal-browsing-browser-report-v1` report shapes with `sanitized=true`. Keep them out of final evidence until every pass/no-false-positive/no-missed-block check is true.",
    "`normal-browsing-evidence-fill-template.json` mirrors the final evidence shape but intentionally uses pending values and false checks. Do not promote it without replacing every pending field with real QA evidence.",
    "",
    "Required counts:",
    "",
    `- Classifier corpus cases: ${manifest.counts.classifierCorpusCaseCount}`,
    `- Release allowed URLs: ${manifest.counts.allowedUrlCount}`,
    `- Release recovery-search URLs: ${manifest.counts.recoverySearchUrlCount}`,
    `- Release adult-blocked URLs: ${manifest.counts.adultBlockedUrlCount}`,
    `- Browser rows: ${manifest.counts.browserRowCount}`,
    `- Manual QA rows: ${manifest.counts.manualQaCaseCount}`,
    `- Static classifier-only rows: ${manifest.counts.staticClassifierCaseCount}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function buildBrowserChecklist(matrix, counts, runId) {
  const lines = [
    `# Normal-Browsing Browser Checklist: ${runId}`,
    "",
    "Use this checklist on physical devices only. It is a capture aid, not release evidence by itself.",
    "",
    "For each browser:",
    "",
    "- Record the physical device model and OS version.",
    "- Run every allowed and recovery-search URL and confirm FREED does not interrupt.",
    "- Run every adult-blocked URL/search and confirm FREED interrupts before harmful browsing continues.",
    "- Attach a screenshot/video/log artifact for the completed browser run.",
    "- Set pass counts only after every row below has been manually reviewed.",
    "",
    `Expected per browser: ${counts.allowedUrlCount} allowed, ${counts.recoverySearchUrlCount} recovery-search allowed, ${counts.adultBlockedUrlCount} adult-blocked.`,
    "",
  ];

  for (const browser of matrix.browserRows) {
    const packageLabel = browser.browserPackage ? ` (${browser.browserPackage})` : "";
    lines.push(`## ${browser.platform.toUpperCase()} ${browser.browserName}${packageLabel}`);
    lines.push("");
    lines.push(`Run ID: \`${runId}-${browser.id}-normal-browsing\``);
    lines.push("");

    for (const row of matrix.manualRows) {
      const expected = row.expected === "allow" ? "allow with no FREED interruption" : "block/intervene";
      lines.push(`- [ ] ${row.group}: ${expected} - ${row.url}`);
    }

    lines.push("");
    lines.push("Result fields to transfer into `normalBrowsing.browserMatrix[]`:");
    lines.push("");
    lines.push(`- \`isPhysicalDevice=true\``);
    lines.push(`- \`allowedUrlPassCount=${counts.allowedUrlCount}\``);
    lines.push(`- \`recoverySearchPassCount=${counts.recoverySearchUrlCount}\``);
    lines.push(`- \`adultBlockPassCount=${counts.adultBlockedUrlCount}\``);
    lines.push("- `falsePositiveCount=0`");
    lines.push("- `missedAdultBlockCount=0`");
    lines.push("- `passed=true`");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function countsFor(matrix) {
  return {
    adultBlockedUrlCount: matrix.requiredRows.filter((row) => row.group === "adult-blocked").length,
    allowedUrlCount: matrix.requiredRows.filter((row) => row.group === "allowed").length,
    browserRowCount: matrix.browserRows.length,
    classifierCorpusCaseCount: matrix.classifierRows.length,
    manualQaCaseCount: matrix.cases.length,
    manualQaUrlCount: matrix.manualRows.length,
    recoverySearchUrlCount: matrix.requiredRows.filter((row) => row.group === "recovery-search").length,
    staticClassifierCaseCount: matrix.staticClassifierRows.length,
    uniqueUrlCount: matrix.manualRows.length,
  };
}

function buildBrowserSummaryRows(matrix, counts, runId, resultArtifactTemplateFor = () => "") {
  return matrix.browserRows.map((browser) => {
    const resultArtifactTemplate = resultArtifactTemplateFor(browser);
    const row = {
      status: "pending-manual-qa",
      platform: browser.platform,
      isPhysicalDevice: false,
      deviceModel: "",
      osVersion: "",
      browserName: browser.browserName,
      ...(browser.browserPackage ? { browserPackage: browser.browserPackage } : {}),
      runId: `${runId}-${browser.id}-normal-browsing`,
      resultArtifact: "",
      ...(resultArtifactTemplate ? { resultArtifactTemplate } : {}),
      allowedUrlCount: counts.allowedUrlCount,
      recoverySearchUrlCount: counts.recoverySearchUrlCount,
      adultBlockedUrlCount: counts.adultBlockedUrlCount,
      allowedUrlPassCount: "",
      recoverySearchPassCount: "",
      adultBlockPassCount: "",
      falsePositiveCount: "",
      missedAdultBlockCount: "",
      passed: false,
      notes:
        "Fill device fields, resultArtifact, pass counts, zero failure counts, and passed=true only after physical-browser QA passes every URL row.",
    };
    return row;
  });
}

function buildBrowserReportTemplate(row) {
  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    instructions:
      "Replace pending device/pass fields after physical-browser QA, then reference this completed local JSON report from normalBrowsing.browserMatrix[].resultArtifact.",
    schemaVersion: "freed-normal-browsing-browser-report-v1",
    sanitized: true,
    runId: row.runId,
    platform: row.platform,
    browserName: row.browserName,
    ...(row.browserPackage ? { browserPackage: row.browserPackage } : {}),
    counts: {
      allowedUrlCount: row.allowedUrlCount,
      recoverySearchUrlCount: row.recoverySearchUrlCount,
      adultBlockedUrlCount: row.adultBlockedUrlCount,
      allowedUrlPassCount: "",
      recoverySearchPassCount: "",
      adultBlockPassCount: "",
      falsePositiveCount: "",
      missedAdultBlockCount: "",
    },
    checks: {
      physicalDevice: false,
      passed: false,
      allowedUrlsPassed: false,
      recoverySearchPassed: false,
      adultUrlsBlocked: false,
      noFalsePositives: false,
      noMissedAdultBlocks: false,
    },
  };
}

function browserReportTemplatePath(outputDir, browser) {
  return path.join(outputDir, "browser-report-templates", `${browser.id}-report.template.json`);
}

function buildEvidenceFillTemplate(matrix, counts, browserSummaryRows) {
  return {
    templateStatus: "pending-manual-qa",
    manualVerificationRequired: true,
    instructions:
      "Copy this shape into normal-browsing-corpus.json only after replacing pending values with real physical-device QA results and artifacts.",
    normalBrowsing: {
      classifierCorpusSource: CLASSIFIER_CORPUS_PATH,
      classifierCorpusCaseCount: counts.classifierCorpusCaseCount,
      classifierCorpusPassCount: "",
      classifierCorpusFailedCount: "",
      browserMatrix: browserSummaryRows,
      allowedUrls: matrix.template.normalBrowsing.allowedUrls,
      recoverySearchUrls: matrix.template.normalBrowsing.recoverySearchUrls,
      adultBlockedUrls: matrix.template.normalBrowsing.adultBlockedUrls,
    },
    checks: {
      googleAllowed: false,
      youtubeAllowed: false,
      instagramAllowed: false,
      xTwitterAllowed: false,
      educationAllowed: false,
      streamingAllowed: false,
      gamingAllowed: false,
      productivityAllowed: false,
      recoverySearchAllowed: false,
      adultSearchStillBlocked: false,
    },
  };
}

function capture(options) {
  const matrix = buildMatrix(options);
  validateBrowserRows(matrix.browserRows);
  const counts = countsFor(matrix);
  const browserSummaryRows = buildBrowserSummaryRows(matrix, counts, options.runId, (browser) =>
    repoRelative(browserReportTemplatePath(options.outputDir, browser)),
  );
  const browserReportTemplateArtifacts = matrix.browserRows.map((browser, index) => ({
    browserId: browser.id,
    artifact: repoRelative(browserReportTemplatePath(options.outputDir, browser)),
    runId: browserSummaryRows[index].runId,
  }));
  const manifest = {
    browserReportTemplateArtifacts,
    browserSummaryRows,
    browserRows: matrix.browserRows,
    counts,
    generatedAt: new Date().toISOString(),
    evidenceSatisfied: false,
    manualVerificationRequired: true,
    releaseGate: "normal-browsing-corpus-validation",
    releaseBoundary:
      "Normal-browsing capture packets are setup handoffs only. They do not prove physical-device browser allow/block behavior, zero false positives, or zero missed adult blocks until real QA fills and validates normal-browsing-corpus.json.",
    result: options.planOnly ? "plan-only" : "capture-matrix-created",
    runId: options.runId,
    sanitized: true,
    schema: "freed-normal-browsing-corpus-capture-v1",
    schemaVersion: "freed-normal-browsing-corpus-capture-v1",
    sourceArtifacts: sourceArtifacts([TEMPLATE_PATH, CLASSIFIER_CORPUS_PATH]),
    sourceFiles: [TEMPLATE_PATH, CLASSIFIER_CORPUS_PATH],
    staticClassifierRowsAreManualBrowserTargets: false,
  };

  if (options.planOnly) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  const matrixPath = path.join(options.outputDir, "normal-browsing-corpus-matrix.csv");
  const browserChecklistPath = path.join(options.outputDir, "normal-browsing-browser-checklist.md");
  const classifierPath = path.join(options.outputDir, "classifier-corpus-static.csv");
  const browserSummaryPath = path.join(options.outputDir, "normal-browsing-browser-summary.template.json");
  const evidenceFillTemplatePath = path.join(options.outputDir, "normal-browsing-evidence-fill-template.json");
  const manifestPath = path.join(options.outputDir, "capture-manifest.json");
  const notesPath = path.join(options.outputDir, "CAPTURE_NOTES.md");
  writeTextArtifact(matrixPath, toCsv(matrix.cases));
  writeTextArtifact(browserChecklistPath, buildBrowserChecklist(matrix, counts, options.runId));
  writeTextArtifact(classifierPath, toClassifierCsv(matrix.staticClassifierRows));
  matrix.browserRows.forEach((browser, index) => {
    writeJsonArtifact(browserReportTemplatePath(options.outputDir, browser), buildBrowserReportTemplate(browserSummaryRows[index]));
  });
  writeJsonArtifact(browserSummaryPath, browserSummaryRows);
  writeJsonArtifact(evidenceFillTemplatePath, buildEvidenceFillTemplate(matrix, counts, browserSummaryRows));
  writeJsonArtifact(manifestPath, {
    ...manifest,
    browserChecklistArtifact: repoRelative(browserChecklistPath),
    browserReportTemplateArtifacts,
    browserSummaryArtifact: repoRelative(browserSummaryPath),
    classifierCorpusArtifact: repoRelative(classifierPath),
    evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
    matrixArtifact: repoRelative(matrixPath),
  });
  writeTextArtifact(notesPath, buildNotes(manifest));
  console.log(
    JSON.stringify(
      {
        ...manifest,
        browserSummaryArtifact: repoRelative(browserSummaryPath),
        browserChecklistArtifact: repoRelative(browserChecklistPath),
        browserReportTemplateArtifacts,
        classifierCorpusArtifact: repoRelative(classifierPath),
        evidenceFillTemplateArtifact: repoRelative(evidenceFillTemplatePath),
        manifestArtifact: repoRelative(manifestPath),
        matrixArtifact: repoRelative(matrixPath),
        notesArtifact: repoRelative(notesPath),
      },
      null,
      2,
    ),
  );
}

function runSelfTest() {
  const rows = parseBrowserRows(DEFAULT_BROWSERS);
  assert.equal(rows.length, 5);
  assert.doesNotThrow(() => validateBrowserRows(rows));
  assert.throws(() => validateBrowserRows(parseBrowserRows("ios:Safari")), /Android Chrome/);
  assert.throws(() => validateBrowserRows(parseBrowserRows("android:Chrome:com.android.chrome")), /iOS Safari/);
  assert.throws(() => validateBrowserRows(parseBrowserRows("ios:Safari,android:Chrome:com.android.chrome,android:Brave:com.brave.browser,android:Samsung Internet:com.sec.android.app.sbrowser")), /Android Firefox/);
  assert.throws(() => validateBrowserRows(parseBrowserRows("ios:Safari,android:Chrome:com.android.chrome,android:Firefox:org.mozilla.firefox,android:Samsung Internet:com.sec.android.app.sbrowser")), /Edge/);
  assert.throws(() => validateBrowserRows(parseBrowserRows("ios:Safari,android:Chrome:com.android.chrome,android:Firefox:org.mozilla.firefox,android:Edge:com.microsoft.emmx")), /Samsung Internet/);

  const classifierRows = parseClassifierCorpus(readText(CLASSIFIER_CORPUS_PATH));
  assert.ok(classifierRows.length >= 40);
  const matrix = buildMatrix({ browsers: rows, runId: "self-test" });
  const counts = countsFor(matrix);
  assert.equal(counts.allowedUrlCount, 12);
  assert.equal(counts.recoverySearchUrlCount, 4);
  assert.equal(counts.adultBlockedUrlCount, 4);
  assert.equal(counts.classifierCorpusCaseCount, classifierRows.length);
  assert.equal(counts.browserRowCount, 5);
  assert.equal(counts.staticClassifierCaseCount, classifierRows.length);
  assert.equal(counts.manualQaUrlCount, 20);
  assert.equal(counts.manualQaCaseCount, counts.browserRowCount * counts.manualQaUrlCount);
  assert.equal(matrix.cases.some((row) => row.url.includes("example.")), false);
  const browserSummaryRows = buildBrowserSummaryRows(
    matrix,
    counts,
    "self-test",
    (browser) => `docs/validation/artifacts/self-test/normal-browsing-corpus-capture/browser-report-templates/${browser.id}-report.template.json`,
  );
  assert.equal(browserSummaryRows.length, 5);
  assert.equal(browserSummaryRows[0].runId, "self-test-ios-safari-normal-browsing");
  assert.match(browserSummaryRows[0].resultArtifactTemplate, /ios-safari-report\.template\.json$/);
  assert.equal(browserSummaryRows[0].allowedUrlCount, 12);
  assert.equal(browserSummaryRows[0].allowedUrlPassCount, "");
  assert.equal(browserSummaryRows[0].passed, false);
  assert.equal(browserSummaryRows[1].browserPackage, "com.android.chrome");
  assert.equal(browserSummaryRows[2].browserPackage, "org.mozilla.firefox");
  assert.equal(browserSummaryRows[3].browserPackage, "com.microsoft.emmx");
  assert.equal(browserSummaryRows[4].browserPackage, "com.sec.android.app.sbrowser");
  const reportTemplate = buildBrowserReportTemplate(browserSummaryRows[1]);
  assert.equal(reportTemplate.schemaVersion, "freed-normal-browsing-browser-report-v1");
  assert.equal(reportTemplate.sanitized, true);
  assert.equal(reportTemplate.runId, "self-test-android-chrome-normal-browsing");
  assert.equal(reportTemplate.platform, "android");
  assert.equal(reportTemplate.browserPackage, "com.android.chrome");
  assert.equal(reportTemplate.counts.allowedUrlCount, 12);
  assert.equal(reportTemplate.counts.allowedUrlPassCount, "");
  assert.equal(reportTemplate.checks.noFalsePositives, false);
  const checklist = buildBrowserChecklist(matrix, counts, "self-test");
  assert.match(checklist, /## IOS Safari/);
  assert.match(checklist, /## ANDROID Edge \(com\.microsoft\.emmx\)/);
  assert.match(checklist, /allowedUrlPassCount=12/);
  assert.match(checklist, /recoverySearchPassCount=4/);
  assert.match(checklist, /adultBlockPassCount=4/);
  assert.match(checklist, /missedAdultBlockCount=0/);
  const fillTemplate = buildEvidenceFillTemplate(matrix, counts, browserSummaryRows);
  assert.equal(fillTemplate.templateStatus, "pending-manual-qa");
  assert.equal(fillTemplate.normalBrowsing.classifierCorpusCaseCount, classifierRows.length);
  assert.equal(fillTemplate.normalBrowsing.browserMatrix[1].browserPackage, "com.android.chrome");
  assert.equal(fillTemplate.normalBrowsing.browserMatrix[4].browserPackage, "com.sec.android.app.sbrowser");
  assert.equal(fillTemplate.checks.googleAllowed, false);
  const manifest = {
    counts,
    generatedAt: new Date().toISOString(),
    evidenceSatisfied: false,
    manualVerificationRequired: true,
    releaseBoundary:
      "Normal-browsing capture packets are setup handoffs only. They do not prove physical-device browser allow/block behavior, zero false positives, or zero missed adult blocks until real QA fills and validates normal-browsing-corpus.json.",
    runId: "self-test",
    sanitized: true,
  };
  const notes = buildNotes(manifest);
  assert.match(notes, /Evidence satisfied: `false`/);
  assert.equal(manifest.sanitized, true);
  assert.equal(manifest.evidenceSatisfied, false);
  assert.match(manifest.releaseBoundary, /setup handoffs only/);
  const sourceProof = sourceArtifacts([TEMPLATE_PATH, CLASSIFIER_CORPUS_PATH]);
  assert.deepEqual(sourceProof.map((artifact) => artifact.path), [TEMPLATE_PATH, CLASSIFIER_CORPUS_PATH]);
  assert.ok(sourceProof.every((artifact) => /^sha256-[0-9a-f]{64}$/.test(artifact.sha256)));
  assert.throws(
    () =>
      validateManualBrowserRows([
        { id: "bad", group: "allowed", url: "https://example.com", expected: "allow", source: "self-test" },
      ]),
    /placeholder|reserved/,
  );
  assert.equal(safeRunId("normal-browsing-2026-05-15"), "normal-browsing-2026-05-15");
  assert.throws(() => safeRunId("../bad"));
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "docs/validation/evidence"]), /docs\/validation\/evidence/);
  assert.throws(() => parseArgs(["--self-test", "--output-dir", "../outside-artifacts"]), /current workspace/);
  console.log("normal-browsing-corpus-evidence self-test: pass");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  capture(options);
}

main();
