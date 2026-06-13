#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { assertSafeReportPath } = require("./lib/report-path-safety");

const SCHEMA_VERSION = "freed-android-apk-download-live-check-v1";
const DEFAULT_HANDOFF_REPORT = "docs/validation/artifacts/android-download-current/android-apk-download-handoff.json";
const DEFAULT_REPORT = "docs/validation/artifacts/android-download-current/android-apk-download-live-check.json";
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TEXT_RESPONSE_BYTES = 256 * 1024;
const REQUIRED_PAGE_TEXT = [
  {
    id: "download-page-install-troubleshooting-section",
    text: "Install Troubleshooting",
  },
  {
    id: "download-page-apk-use-boundary-section",
    text: "APK Use Boundary",
  },
  {
    id: "download-page-current-build-status-section",
    text: "Current Android Build Status",
  },
  {
    id: "download-page-side-load-qa-apk",
    text: "Side-load QA APK",
  },
  {
    id: "download-page-not-play-upload-evidence",
    text: "Not Play upload evidence",
  },
  {
    id: "download-page-upload-signed-aab-command",
    text: "upload-signed AAB",
  },
  {
    id: "download-page-troubleshooting-qr-target",
    text: "Phone cannot open the QR target",
  },
  {
    id: "download-page-troubleshooting-unknown-apps",
    text: "Install unknown apps prompt appears",
  },
  {
    id: "download-page-troubleshooting-allow-from-source",
    text: "Allow from this source",
  },
  {
    id: "download-page-troubleshooting-package-conflicts",
    text: "App not installed or package conflicts",
  },
  {
    id: "download-page-troubleshooting-storage-low",
    text: "Install fails because storage is low",
  },
  {
    id: "download-page-support-routes-section",
    text: "Support Routes",
  },
  {
    id: "download-page-support-download-route",
    text: "Download route",
  },
  {
    id: "download-page-support-metadata-route",
    text: "/metadata.json",
  },
  {
    id: "download-page-support-qr-route",
    text: "/qr.svg",
  },
  {
    id: "download-page-support-live-check-boundary",
    text: "The live check must pass for the page route, metadata route, QR route, and APK route before phone-side install QA begins.",
  },
  {
    id: "download-page-after-install-section",
    text: "After Install",
  },
  {
    id: "download-page-same-device-evidence-section",
    text: "Same-Device Evidence Sequence",
  },
  {
    id: "download-page-same-device-install-qa",
    text: "Install QA report",
  },
  {
    id: "download-page-same-device-permission-wizard",
    text: "permission wizard",
  },
  {
    id: "download-page-same-device-real-browser",
    text: "real-browser evidence",
  },
  {
    id: "download-page-activation-same-device-rule",
    text: "adult-block plus normal-allow test pass on the same physical device",
  },
  {
    id: "download-page-recovery-notifications-section",
    text: "Recovery Notifications",
  },
  {
    id: "download-page-runtime-notification-prompt",
    text: "runtime notification prompt",
  },
  {
    id: "download-page-app-notification-settings-fallback",
    text: "Android app notification settings",
  },
  {
    id: "download-page-notification-permission-report",
    text: "android-notification-permission-report.json",
  },
  {
    id: "download-page-flow-dns-guard",
    text: "DNS Guard / VPN consent",
  },
  {
    id: "download-page-flow-usage-access",
    text: "Usage Access",
  },
  {
    id: "download-page-flow-accessibility",
    text: "Accessibility consent",
  },
  {
    id: "download-page-flow-activation-test",
    text: "activation test",
  },
  {
    id: "download-page-qa-commands-section",
    text: "QA Commands",
  },
  {
    id: "download-page-device-discovery-command",
    text: "npm run evidence:android-devices",
  },
  {
    id: "download-page-install-qa-plan-command",
    text: "--plan-only",
  },
  {
    id: "download-page-install-qa-command",
    text: "npm run qa:android-install",
  },
  {
    id: "download-page-permission-wizard-command",
    text: "npm run evidence:permission-wizard",
  },
  {
    id: "download-page-real-browser-command",
    text: "npm run evidence:android-real-browser",
  },
];

function printHelp() {
  console.log(`Usage: npm run qa:android-download:live-check -- [options]

Checks whether the local Android APK download page and APK route are reachable.
This is a local side-load QA probe only; it does not install the APK or create
Play Console release evidence.

Options:
  --handoff <path>      Android download handoff JSON.
                        Default: ${DEFAULT_HANDOFF_REPORT}
  --report <path>       Sanitized JSON report under docs/validation/artifacts.
                        Default: ${DEFAULT_REPORT}
  --url <url>           Local page URL to probe. Defaults to the handoff QR
                        target URL, then a private LAN URL, then localhost.
  --timeout-ms <ms>     Per-request timeout, 500-30000. Default: ${DEFAULT_TIMEOUT_MS}
  --self-test           Run offline parser/probe checks.
`);
}

function parseArgs(argv) {
  const options = {
    handoff: DEFAULT_HANDOFF_REPORT,
    pageUrl: "",
    reportPath: DEFAULT_REPORT,
    selfTest: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--handoff") options.handoff = next();
    else if (arg === "--report") options.reportPath = next();
    else if (arg === "--timeout-ms") options.timeoutMs = parseBoundedInteger(next(), arg, 500, 30000);
    else if (arg === "--url") options.pageUrl = next();
    else if (arg === "--self-test") options.selfTest = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.handoff = assertSafeInputReportPath(options.handoff, "--handoff");
  options.reportPath = assertSafeReportPath(options.reportPath, "--report");
  if (options.pageUrl) options.pageUrl = assertSafeLocalHttpUrl(options.pageUrl, "--url");
  return options;
}

function parseBoundedInteger(value, label, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function repoRelative(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
}

function assertSafeInputReportPath(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.includes("\0") || normalized.includes("\n") || normalized.includes("\r")) {
    throw new Error(`${label} must be a plain JSON file path.`);
  }
  if (normalized.startsWith("-") || /[;&|`$<>]/.test(normalized)) {
    throw new Error(`${label} must not contain shell syntax or flags.`);
  }
  const relative = repoRelative(normalized);
  if (!relative.startsWith("docs/validation/artifacts/")) {
    throw new Error(`${label} must be under docs/validation/artifacts/<run-id>.`);
  }
  if (!relative.endsWith(".json")) throw new Error(`${label} must end in .json.`);
  return relative;
}

function assertSafeLocalHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${label} must be a valid local http:// URL.`);
  }
  if (parsed.protocol !== "http:") throw new Error(`${label} must use http:// for the local QA server.`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must not include credentials, query strings, or fragments.`);
  }
  const host = parsed.hostname.toLowerCase();
  const localHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  if (!localHost) throw new Error(`${label} must target localhost or a private LAN host.`);
  return parsed.toString();
}

function readHandoff(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing Android download handoff: ${relativePath}`);
  const handoff = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  if (handoff.schemaVersion !== "freed-android-apk-download-handoff-v1") {
    throw new Error("--handoff must be a freed-android-apk-download-handoff-v1 JSON artifact.");
  }
  if (handoff.sanitized !== true) throw new Error("--handoff must be sanitized.");
  return handoff;
}

function chooseDefaultPageUrl(handoff) {
  const lanUrls = Array.isArray(handoff.server?.lanUrls) ? handoff.server.lanUrls : [];
  const candidates = [handoff.server?.qrTargetUrl || "", ...lanUrls.filter((url) => url !== handoff.server?.qrTargetUrl)];
  const safeCandidates = candidates
    .map((url) => String(url || "").trim())
    .filter(Boolean)
    .map((url) => {
      try {
        const safeUrl = assertSafeLocalHttpUrl(url, "handoff server URL");
        return {
          host: new URL(safeUrl).hostname.toLowerCase(),
          url: safeUrl,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const qrTarget = safeCandidates.find((candidate) => candidate.url === handoff.server?.qrTargetUrl);
  const privateLanTarget = safeCandidates.find((candidate) => !["localhost", "127.0.0.1"].includes(candidate.host));
  const fallbackTarget = safeCandidates[0];
  const selected = qrTarget || privateLanTarget || fallbackTarget;
  if (!selected) throw new Error("handoff server URL must include a safe localhost or private LAN URL.");
  return selected.url;
}

function resolveProbeTargets(handoff, pageUrlOverride) {
  const pageUrl = pageUrlOverride || chooseDefaultPageUrl(handoff);
  const parsedPageUrl = new URL(pageUrl);
  const downloadPath = handoff.server?.downloadPath || "";
  if (!downloadPath.startsWith("/download/")) throw new Error("handoff server downloadPath must start with /download/.");
  const downloadUrl = new URL(downloadPath, `${parsedPageUrl.protocol}//${parsedPageUrl.host}`).toString();
  const metadataPath = handoff.server?.metadataPath || "/metadata.json";
  if (metadataPath !== "/metadata.json") throw new Error("handoff server metadataPath must be /metadata.json.");
  const metadataUrl = new URL(metadataPath, `${parsedPageUrl.protocol}//${parsedPageUrl.host}`).toString();
  return {
    downloadUrl: assertSafeLocalHttpUrl(downloadUrl, "download URL"),
    metadataUrl: assertSafeLocalHttpUrl(metadataUrl, "metadata URL"),
    pageUrl,
  };
}

function requestHead(url, timeoutMs, requestImpl = http.request) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const req = requestImpl(
      url,
      {
        method: "HEAD",
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({
            contentLength: Number.parseInt(String(res.headers["content-length"] || "0"), 10) || 0,
            contentType: String(res.headers["content-type"] || ""),
            elapsedMs: Date.now() - startedAt,
            error: "",
            ok: true,
            status: Number(res.statusCode || 0),
            url,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error(`request timed out after ${timeoutMs} ms`));
    });
    req.on("error", (error) => {
      resolve({
        contentLength: 0,
        contentType: "",
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        status: 0,
        url,
      });
    });
    req.end();
  });
}

function requestText(url, timeoutMs, requestImpl = http.request) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const req = requestImpl(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        let receivedBytes = 0;
        let tooLarge = false;
        res.on("data", (chunk) => {
          receivedBytes += chunk.length;
          if (receivedBytes <= MAX_TEXT_RESPONSE_BYTES) {
            chunks.push(chunk);
            return;
          }
          tooLarge = true;
          req.destroy(new Error(`response exceeded ${MAX_TEXT_RESPONSE_BYTES} bytes`));
        });
        res.on("end", () => {
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            contentLength: Number.parseInt(String(res.headers["content-length"] || "0"), 10) || receivedBytes,
            contentType: String(res.headers["content-type"] || ""),
            elapsedMs: Date.now() - startedAt,
            error: tooLarge ? `response exceeded ${MAX_TEXT_RESPONSE_BYTES} bytes` : "",
            ok: !tooLarge,
            status: Number(res.statusCode || 0),
            url,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error(`request timed out after ${timeoutMs} ms`));
    });
    req.on("error", (error) => {
      resolve({
        body: "",
        contentLength: 0,
        contentType: "",
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        status: 0,
        url,
      });
    });
    req.end();
  });
}

function parseJsonBody(probe) {
  if (!probe.ok || probe.status < 200 || probe.status >= 300 || !probe.body) return { error: "", value: null };
  try {
    return { error: "", value: JSON.parse(probe.body) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), value: null };
  }
}

function buildChecks({ apkSha256, apkSizeBytes, downloadHead, handoff, metadataGet, metadataJson, pageGet, pageHead }) {
  const checks = [];
  const push = (id, passed, detail, next = "") => checks.push({ id, status: passed ? "pass" : "fail", detail, next });
  const pageStatusOk = pageHead.ok && pageHead.status >= 200 && pageHead.status < 300;
  const pageHtml = /text\/html/i.test(pageHead.contentType);
  const pageBodyOk = pageGet.ok && pageGet.status >= 200 && pageGet.status < 300;
  const pageIncludesSha = pageBodyOk && pageGet.body.includes(apkSha256);
  const pageIncludesSize = pageBodyOk && pageGet.body.includes(String(apkSizeBytes));
  const apkStatusOk = downloadHead.ok && downloadHead.status >= 200 && downloadHead.status < 300;
  const apkContentType = /application\/vnd\.android\.package-archive/i.test(downloadHead.contentType);
  const apkLengthMatches = downloadHead.contentLength === apkSizeBytes;
  const metadataStatusOk = metadataGet.ok && metadataGet.status >= 200 && metadataGet.status < 300;
  const metadataJsonType = /application\/json/i.test(metadataGet.contentType);
  const metadataParsed = metadataJson && typeof metadataJson === "object";
  const metadataShaMatches = metadataParsed && metadataJson.apk?.sha256 === apkSha256;
  const metadataSizeMatches = metadataParsed && Number(metadataJson.apk?.sizeBytes || 0) === apkSizeBytes;
  const staleDownloadWarning =
    handoff?.currentBuildStatus?.staleDownloadWarning === true ||
    metadataJson?.currentBuildStatus?.staleDownloadWarning === true;
  const pageIncludesStaleWarning =
    !staleDownloadWarning ||
    (pageBodyOk && pageGet.body.includes("A newer current Android rebuild failed after this APK was produced"));
  const metadataStaleWarningMatches =
    !staleDownloadWarning ||
    (metadataParsed &&
      metadataJson.currentBuildStatus?.staleDownloadWarning === true &&
      metadataJson.currentBuildStatus?.result === "stale-apk-newer-rebuild-failed");

  push("download-page-http-2xx", pageStatusOk, `${pageHead.url} returned HTTP ${pageHead.status || 0}.`, "Start the Android download server, then rerun this live check.");
  push("download-page-html", pageHtml, `${pageHead.url} returned ${pageHead.contentType || "unknown content type"}.`, "The download page should serve crawler/user-readable HTML.");
  push("download-page-current-sha256", pageIncludesSha, `${pageGet.url} ${pageIncludesSha ? "includes" : "does not include"} the handoff APK SHA-256.`, "Restart the download server after regenerating the handoff so the phone-facing page is current.");
  push("download-page-current-size", pageIncludesSize, `${pageGet.url} ${pageIncludesSize ? "includes" : "does not include"} the handoff APK byte size.`, "Restart the download server after rebuilding the APK so the phone-facing page is current.");
  for (const requiredText of REQUIRED_PAGE_TEXT) {
    const pageIncludesText = pageBodyOk && pageGet.body.includes(requiredText.text);
    push(
      requiredText.id,
      pageIncludesText,
      `${pageGet.url} ${pageIncludesText ? "includes" : "does not include"} "${requiredText.text}".`,
      "Restart the download server after regenerating the handoff so the phone-facing page includes install, setup, and evidence guidance.",
    );
  }
  push(
    "download-page-current-build-stale-warning",
    pageIncludesStaleWarning,
    staleDownloadWarning
      ? `${pageGet.url} ${pageIncludesStaleWarning ? "includes" : "does not include"} the stale APK warning for the newer failed Android rebuild.`
      : "The handoff does not require a stale APK warning.",
    "Regenerate the Android download handoff and restart the server so the phone-facing page clearly states when the downloadable APK is not evidence for the latest native code.",
  );
  push("metadata-route-http-2xx", metadataStatusOk, `${metadataGet.url} returned HTTP ${metadataGet.status || 0}.`, "Start the Android download server, then rerun this live check.");
  push("metadata-route-json", metadataJsonType && metadataParsed, `${metadataGet.url} returned ${metadataGet.contentType || "unknown content type"}.`, "Serve /metadata.json as the sanitized Android download handoff metadata.");
  push("metadata-route-current-sha256", metadataShaMatches, `${metadataGet.url} ${metadataShaMatches ? "matches" : "does not match"} the handoff APK SHA-256.`, "Restart the download server after regenerating the handoff so /metadata.json is current.");
  push("metadata-route-current-size", metadataSizeMatches, `${metadataGet.url} ${metadataSizeMatches ? "matches" : "does not match"} the handoff APK byte size.`, "Restart the download server after rebuilding the APK so /metadata.json is current.");
  push(
    "metadata-route-current-build-stale-warning",
    metadataStaleWarningMatches,
    staleDownloadWarning
      ? `${metadataGet.url} ${metadataStaleWarningMatches ? "matches" : "does not match"} the handoff stale APK warning.`
      : "The handoff does not require stale APK metadata.",
    "Restart the download server after regenerating the handoff so /metadata.json includes the current build status.",
  );
  push("apk-route-http-2xx", apkStatusOk, `${downloadHead.url} returned HTTP ${downloadHead.status || 0}.`, "Start the Android download server, then rerun this live check.");
  push("apk-route-content-type", apkContentType, `${downloadHead.url} returned ${downloadHead.contentType || "unknown content type"}.`, "Serve the APK as application/vnd.android.package-archive.");
  push("apk-route-content-length", apkLengthMatches, `${downloadHead.url} returned ${downloadHead.contentLength} bytes; expected ${apkSizeBytes}.`, "Regenerate the download handoff for the selected APK or restart the server with the matching APK.");
  return checks;
}

async function buildReport(options, requestImpl = http.request) {
  const handoff = readHandoff(options.handoff);
  const targets = resolveProbeTargets(handoff, options.pageUrl);
  const [pageHead, pageGet, metadataGet, downloadHead] = await Promise.all([
    requestHead(targets.pageUrl, options.timeoutMs, requestImpl),
    requestText(targets.pageUrl, options.timeoutMs, requestImpl),
    requestText(targets.metadataUrl, options.timeoutMs, requestImpl),
    requestHead(targets.downloadUrl, options.timeoutMs, requestImpl),
  ]);
  const metadataParse = parseJsonBody(metadataGet);
  const apkSha256 = String(handoff.apk?.sha256 || "");
  const apkSizeBytes = Number(handoff.apk?.sizeBytes || 0);
  const checks = buildChecks({
    apkSha256,
    apkSizeBytes,
    downloadHead,
    handoff,
    metadataGet,
    metadataJson: metadataParse.value,
    pageGet,
    pageHead,
  });
  const failCount = checks.filter((check) => check.status === "fail").length;
  const passCount = checks.length - failCount;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sanitized: true,
    result: failCount === 0 ? "pass" : "fail",
    passCount,
    failCount,
    timeoutMs: options.timeoutMs,
    sourceHandoff: options.handoff,
    target: {
      downloadUrl: targets.downloadUrl,
      metadataUrl: targets.metadataUrl,
      pageUrl: targets.pageUrl,
      qrTargetUrl: handoff.server?.qrTargetUrl || "",
    },
    apk: {
      filename: handoff.apk?.filename || "",
      path: handoff.apk?.path || "",
      sha256: handoff.apk?.sha256 || "",
      sizeBytes: apkSizeBytes,
    },
    probes: {
      download: downloadHead,
      metadata: {
        contentLength: metadataGet.contentLength,
        contentType: metadataGet.contentType,
        elapsedMs: metadataGet.elapsedMs,
        error: metadataGet.error || metadataParse.error,
        ok: metadataGet.ok,
        status: metadataGet.status,
        url: metadataGet.url,
      },
      page: pageHead,
      pageBody: {
        contentLength: pageGet.contentLength,
        contentType: pageGet.contentType,
        elapsedMs: pageGet.elapsedMs,
        error: pageGet.error,
        ok: pageGet.ok,
        status: pageGet.status,
        url: pageGet.url,
      },
    },
    checks,
    releaseBoundary:
      "Local Android APK download live check only. This does not prove install, Android permission consent, browser blocking, upload signing, Play Console readiness, or store approval.",
  };
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function runSelfTest() {
  assert.throws(() => parseArgs(["--url", "https://example.com/"]), /http/);
  assert.throws(() => parseArgs(["--url", "http://example.com/"]), /private LAN/);
  assert.throws(() => parseArgs(["--handoff", "docs/validation/evidence/download.json"]), /artifacts/);
  assert.equal(assertSafeLocalHttpUrl("http://127.0.0.1:8787/", "--url"), "http://127.0.0.1:8787/");
  const targetHandoff = {
    server: {
      downloadPath: "/download/FREED.apk",
      lanUrls: ["http://127.0.0.1:8787/", "http://192.168.1.6:8787/"],
      metadataPath: "/metadata.json",
      qrTargetUrl: "http://192.168.1.6:8787/",
    },
  };
  assert.equal(chooseDefaultPageUrl(targetHandoff), "http://192.168.1.6:8787/");
  assert.equal(resolveProbeTargets(targetHandoff, "").downloadUrl, "http://192.168.1.6:8787/download/FREED.apk");
  assert.equal(resolveProbeTargets(targetHandoff, "http://127.0.0.1:8787/").downloadUrl, "http://127.0.0.1:8787/download/FREED.apk");

  const checks = buildChecks({
    apkSha256: "a".repeat(64),
    apkSizeBytes: 10,
    downloadHead: {
      contentLength: 10,
      contentType: "application/vnd.android.package-archive",
      ok: true,
      status: 200,
      url: "http://127.0.0.1:8787/download/FREED.apk",
    },
    handoff: {
      currentBuildStatus: {
        staleDownloadWarning: true,
      },
    },
    metadataGet: {
      body: JSON.stringify({
        apk: { sha256: "a".repeat(64), sizeBytes: 10 },
        currentBuildStatus: {
          result: "stale-apk-newer-rebuild-failed",
          staleDownloadWarning: true,
        },
      }),
      contentLength: 90,
      contentType: "application/json; charset=utf-8",
      ok: true,
      status: 200,
      url: "http://127.0.0.1:8787/metadata.json",
    },
    metadataJson: {
      apk: { sha256: "a".repeat(64), sizeBytes: 10 },
      currentBuildStatus: {
        result: "stale-apk-newer-rebuild-failed",
        staleDownloadWarning: true,
      },
    },
    pageGet: {
      body: `<html>${"a".repeat(64)} 10 ${REQUIRED_PAGE_TEXT.map(({ text }) => text).join(" ")} A newer current Android rebuild failed after this APK was produced</html>`,
      contentLength: 100,
      contentType: "text/html; charset=utf-8",
      ok: true,
      status: 200,
      url: "http://127.0.0.1:8787/",
    },
    pageHead: {
      contentLength: 100,
      contentType: "text/html; charset=utf-8",
      ok: true,
      status: 200,
      url: "http://127.0.0.1:8787/",
    },
  });
  assert.equal(checks.filter((check) => check.status === "fail").length, 0);
  assert.ok(checks.some((check) => check.id === "download-page-current-sha256"));
  assert.ok(checks.some((check) => check.id === "download-page-support-routes-section"));
  assert.ok(checks.some((check) => check.id === "download-page-current-build-status-section"));
  assert.ok(checks.some((check) => check.id === "download-page-current-build-stale-warning"));
  assert.ok(checks.some((check) => check.id === "metadata-route-current-build-stale-warning"));
  assert.ok(checks.some((check) => check.id === "download-page-support-metadata-route"));
  assert.ok(checks.some((check) => check.id === "download-page-support-qr-route"));
  assert.ok(checks.some((check) => check.id === "download-page-after-install-section"));
  assert.ok(checks.some((check) => check.id === "download-page-real-browser-command"));
  assert.ok(checks.some((check) => check.id === "metadata-route-current-sha256"));
  console.log("android APK download live-check self-test: pass");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    await runSelfTest();
    return;
  }

  const report = await buildReport(options);
  writeReport(options.reportPath, report);
  console.log(
    JSON.stringify(
      {
        artifact: repoRelative(options.reportPath),
        failCount: report.failCount,
        passCount: report.passCount,
        result: report.result,
        sanitized: report.sanitized,
        schemaVersion: report.schemaVersion,
      },
      null,
      2,
    ),
  );
  if (report.failCount > 0) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  buildChecks,
  buildReport,
  chooseDefaultPageUrl,
  resolveProbeTargets,
};
