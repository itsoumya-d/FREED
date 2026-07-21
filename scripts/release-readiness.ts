import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { classifyUrl } from "../src/lib/blocking-engine";
import { getChallengeGenerationReadiness } from "../src/lib/challenge-generator";
import { getMonetizationReadiness } from "../src/lib/monetization";
import { getCoachReadiness } from "../src/lib/ai-coach";
import { getBackendArchitectureReadiness, type BackendComponentReadiness } from "../src/lib/backend-architecture";
import {
  parseAdultDomainFeedSourceConfigWithIssues,
  REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES,
  reviewedAdultDomainFeedSourceFamily
} from "../src/lib/adult-domain-feed-ingestion";
import { formatEndpointIssues, getProductionBaseUrlIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import { getAnalyticsEndpointIssues } from "../src/lib/recovery-analytics";
import { classifierSafetyCorpus } from "./classifier-safety-corpus";
import { getValidationEvidenceResults } from "./validation-evidence";

const { assertSafeReportPath: assertSafeWorkspaceReportPath } = require("./lib/report-path-safety");

type AuditStatus = "pass" | "warn" | "fail";

type AuditItem = {
  id: string;
  status: AuditStatus;
  evidence: string;
  next?: string;
};

const root = process.cwd();
const ANDROID_DEBUG_CERT_SHA256 = "fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c";
type ReleaseReadinessOptions = {
  strict: boolean;
  reportPath: string | null;
};

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function parseArgs(argv: string[]): ReleaseReadinessOptions {
  const options: ReleaseReadinessOptions = {
    strict: false,
    reportPath: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--strict") options.strict = true;
    else if (arg === "--report") options.reportPath = next();
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

let options: ReleaseReadinessOptions;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid release readiness arguments.");
  process.exit(1);
}

const strict = options.strict;
const DEFAULT_DEPENDENCY_AUDIT_REPORT = "docs/validation/artifacts/release-readiness-current/dependency-audit-report.json";
const DEPENDENCY_AUDIT_REPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function file(path: string) {
  return join(root, path);
}

function read(path: string) {
  return readFileSync(file(path), "utf8");
}

function sha256File(path: string) {
  return createHash("sha256").update(readFileSync(file(path))).digest("hex");
}

function has(path: string) {
  return existsSync(file(path));
}

function reportPathSafetySource() {
  return has("scripts/lib/report-path-safety.js") ? read("scripts/lib/report-path-safety.js") : "";
}

function manifestPermissionTags(manifest: string, permission: string) {
  return Array.from(manifest.matchAll(/<uses-permission\b[^>]*>/g), ([tag]) => tag).filter((tag) =>
    tag.includes(`android:name="${permission}"`)
  );
}

function manifestDoesNotShipPermission(manifest: string, permission: string) {
  const tags = manifestPermissionTags(manifest, permission);
  return tags.length === 0 || tags.every((tag) => tag.includes('tools:node="remove"'));
}

function manifestOmitsPermission(manifest: string, permission: string) {
  return manifestPermissionTags(manifest, permission).length === 0;
}

function countFiles(path: string, matcher: RegExp) {
  if (!has(path)) return 0;
  return readdirSync(file(path)).filter((name) => matcher.test(name)).length;
}

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function readAiServerKey() {
  return readEnv("OPENAI_API_KEY") ?? readEnv("GEMINI_API_KEY") ?? readEnv("GOOGLE_API_KEY") ?? readEnv("GOOGLE_GENAI_API_KEY");
}

function readGeminiAiServerKey() {
  return readEnv("GEMINI_API_KEY") ?? readEnv("GOOGLE_API_KEY") ?? readEnv("GOOGLE_GENAI_API_KEY");
}

function isPlaceholderConfigValue(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  const placeholderTokens = new Set(["test", "test-key", "sample", "mock", "local", "fallback", "dummy"]);
  return (
    !normalized ||
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    placeholderTokens.has(normalized) ||
    normalized
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .some((token) => placeholderTokens.has(token))
  );
}

function hasUsableConfigValue(key: string) {
  return !isPlaceholderConfigValue(readEnv(key));
}

function boundedIntegerEnvIssue(key: string, min: number, max: number) {
  const raw = readEnv(key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== raw || parsed < min || parsed > max) {
    return `${key} must be an integer between ${min} and ${max}`;
  }
  return null;
}

function normalizeCertificateSha256(value: string) {
  return String(value || "")
    .replace(/[^a-f0-9]/gi, "")
    .toLowerCase();
}

function parseKeytoolCertificateOutput(stdout: string) {
  const certificateSha256Digest = normalizeCertificateSha256(stdout.match(/\bSHA256:\s*([A-F0-9:]+)/i)?.[1] || "");
  const certificateDn = (stdout.match(/^Owner:\s*(.+)$/m)?.[1] || "").trim();
  return {
    certificateDn,
    certificateSha256Digest,
    debugSigned:
      certificateSha256Digest === ANDROID_DEBUG_CERT_SHA256 ||
      /CN=Android Debug\b/i.test(certificateDn)
  };
}

function androidUploadKeystoreInspectionIssue(storeFilePath: string, storePassword: string, keyAlias: string) {
  try {
    const output = execFileSync(
      "keytool",
      ["-list", "-v", "-keystore", storeFilePath, "-storepass", storePassword, "-alias", keyAlias],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30_000,
        maxBuffer: 1024 * 1024
      }
    );
    const proof = parseKeytoolCertificateOutput(output);
    if (!proof.certificateSha256Digest) {
      return "FREED_ANDROID_UPLOAD_STORE_FILE inspectable upload keystore certificate";
    }
    if (proof.debugSigned) {
      return "FREED_ANDROID_UPLOAD_STORE_FILE non-debug upload keystore";
    }
    return null;
  } catch {
    return "FREED_ANDROID_UPLOAD_STORE_FILE inspectable upload keystore";
  }
}

function apiRoutePathIssue(endpoint: string | null | undefined, label: string, expectedPath: string) {
  if (!endpoint) return null;
  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    const normalizedExpected = expectedPath.replace(/\/+$/, "");
    if (pathname !== normalizedExpected && !pathname.endsWith(normalizedExpected)) {
      return `${label} must target ${normalizedExpected}`;
    }
  } catch {
    // Endpoint safety helpers report malformed URLs.
  }
  return null;
}

function productionApiRouteIssues(endpoint: string | null | undefined, label: string, expectedPath: string) {
  return [
    ...formatEndpointIssues(getProductionEndpointIssues(endpoint, label)),
    apiRoutePathIssue(endpoint, label, expectedPath)
  ].filter((issue): issue is string => Boolean(issue));
}

function isAppleIssuerId(value: string | null) {
  return Boolean(
    value &&
      !isPlaceholderConfigValue(value) &&
      !/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(value.trim()) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

function isAppleKeyId(value: string | null) {
  return Boolean(value && !isPlaceholderConfigValue(value) && /^[A-Z0-9]{10}$/.test(value.trim()));
}

function isPrivateKeyPem(value: string | null | undefined) {
  return Boolean(
    value &&
      !isPlaceholderConfigValue(value) &&
      /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(value) &&
      /-----END (?:EC |RSA )?PRIVATE KEY-----/.test(value)
  );
}

function isJwt(value: string | null) {
  return Boolean(value && !isPlaceholderConfigValue(value) && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim()));
}

function isPublicSupabaseAnonKey(value: string | null) {
  const token = value?.trim();
  if (!isJwt(token ?? null) || /service[_-]?role|jwt[_-]?secret/i.test(token)) return false;
  const parts = token.split(".");
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return !payload.role || payload.role === "anon";
  } catch {
    return true;
  }
}

function isGoogleServiceAccountEmail(value: string | null | undefined) {
  return Boolean(
    value &&
      !isPlaceholderConfigValue(value) &&
      /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/i.test(value.trim())
  );
}

function isGoogleAccessToken(value: string | null) {
  return Boolean(value && !isPlaceholderConfigValue(value) && (value.trim().startsWith("ya29.") || value.trim().length >= 40));
}

function isGoogleAiApiKey(value: string | null) {
  return Boolean(value && !isPlaceholderConfigValue(value) && /^AIza[0-9A-Za-z_-]{30,}$/.test(value.trim()));
}

function isOpenAiApiKey(value: string | null) {
  return Boolean(value && !isPlaceholderConfigValue(value) && /^sk-(?:proj-)?[0-9A-Za-z_-]{20,}$/.test(value.trim()));
}

function readBase64Env(key: string) {
  const value = readEnv(key);
  if (!value) return null;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function readPrivateKeyConfig(key: string, base64Key: string) {
  return readEnv(key)?.replace(/\\n/g, "\n") ?? readBase64Env(base64Key);
}

function readGooglePlayServiceAccount() {
  const value = readEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? readBase64Env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64");
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getStoreVerificationCredentialGaps() {
  const missing: string[] = [];
  const appStoreEnvironment = readEnv("APP_STORE_SERVER_API_ENV");
  const appStorePrivateKey = readPrivateKeyConfig("APP_STORE_PRIVATE_KEY", "APP_STORE_PRIVATE_KEY_BASE64");
  const appStoreIssuerCredentialsReady =
    isAppleIssuerId(readEnv("APP_STORE_ISSUER_ID")) &&
    isAppleKeyId(readEnv("APP_STORE_KEY_ID")) &&
    isPrivateKeyPem(appStorePrivateKey);
  const appStoreJwtReady = isJwt(readEnv("APP_STORE_SERVER_API_JWT"));
  const googleServiceAccount = readGooglePlayServiceAccount();
  const googleServiceAccountReady =
    isGoogleServiceAccountEmail(typeof googleServiceAccount?.client_email === "string" ? googleServiceAccount.client_email : null) &&
    isPrivateKeyPem(typeof googleServiceAccount?.private_key === "string" ? googleServiceAccount.private_key : null);
  const googleAccessTokenReady = isGoogleAccessToken(readEnv("GOOGLE_PLAY_ACCESS_TOKEN"));

  if (appStoreEnvironment !== "production") missing.push("App Store Server API production environment");
  if (!hasUsableConfigValue("APP_STORE_BUNDLE_ID")) missing.push("App Store bundle ID");
  if (!appStoreIssuerCredentialsReady && !appStoreJwtReady) missing.push("App Store server verification credentials");
  if (!hasUsableConfigValue("GOOGLE_PLAY_PACKAGE_NAME")) missing.push("Google Play package name");
  if (!googleServiceAccountReady && !googleAccessTokenReady) missing.push("Google Play verification credentials");

  return missing;
}

function item(id: string, status: AuditStatus, evidence: string, next?: string): AuditItem {
  return { id, status, evidence, next };
}

function passOrFail(id: string, condition: boolean, evidence: string, next: string) {
  return item(id, condition ? "pass" : "fail", evidence, condition ? undefined : next);
}

function readJsonObject(path: string) {
  if (!has(path)) return null;
  try {
    const parsed = JSON.parse(read(path));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const ISO_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HOSTED_LEGAL_URL_AUDIT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REPORT_FUTURE_SKEW_MS = 5 * 60 * 1000;

function isoUtcTimestampMs(value: unknown) {
  if (typeof value !== "string" || !ISO_UTC_TIMESTAMP_PATTERN.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}

function hostedLegalAuditFreshnessIssue(report: Record<string, unknown>) {
  const generatedAtMs = isoUtcTimestampMs(report.generatedAt);
  if (generatedAtMs === null) return "hosted legal audit generatedAt ISO UTC timestamp";
  const nowMs = Date.now();
  if (generatedAtMs > nowMs + REPORT_FUTURE_SKEW_MS) return "hosted legal audit generatedAt must not be in the future";
  if (nowMs - generatedAtMs > HOSTED_LEGAL_URL_AUDIT_MAX_AGE_MS) {
    return "hosted legal audit generatedAt must be no older than 24 hours";
  }
  return null;
}

function dependencyAuditReportFreshnessIssue(report: Record<string, unknown>) {
  const generatedAtMs = isoUtcTimestampMs(report.generatedAt);
  if (generatedAtMs === null) return "dependency audit generatedAt ISO UTC timestamp";
  const nowMs = Date.now();
  if (generatedAtMs > nowMs + REPORT_FUTURE_SKEW_MS) return "dependency audit generatedAt must not be in the future";
  if (nowMs - generatedAtMs > DEPENDENCY_AUDIT_REPORT_MAX_AGE_MS) {
    return "dependency audit generatedAt must be no older than 24 hours";
  }
  return null;
}

function releaseVerifierExpectedGateIds(verifier: string) {
  const match = verifier.match(/const expectedReleaseReadinessGateIds = \[([\s\S]*?)\];/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, id]) => id);
}

function releaseVerifierExpectedPreflightCheckIds(verifier: string) {
  const match = verifier.match(/const expectedPreflightReportCheckIds = \[([\s\S]*?)\];/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, id]) => id);
}

function releaseEnvPreflightReportCheckIds(preflightScript: string) {
  const match = preflightScript.match(/const checks = \[([\s\S]*?)\n\s*\];\n\n\s*const report = buildReport/);
  if (!match) return [];
  return Array.from(
    match[1].matchAll(/(?:check|checkEndpoint|checkEndpointWithTimeout)\(\s*(?:"([^"]+)"|'([^']+)')/g),
    ([, doubleQuotedId, singleQuotedId]) => doubleQuotedId || singleQuotedId
  );
}

function releaseVerifierGateManifestIssue(auditItems: AuditItem[]) {
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const expectedIds = releaseVerifierExpectedGateIds(verifier);
  const actualIds = auditItems.map((entry) => entry.id);
  if (expectedIds.length === 0) return "release verifier expected release readiness gate manifest is missing";

  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);
  const missing = actualIds.filter((id) => !expectedSet.has(id));
  const stale = expectedIds.filter((id) => !actualSet.has(id));
  const duplicateExpected = expectedIds.filter((id, index) => expectedIds.indexOf(id) !== index);
  const duplicateActual = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  const sameOrder =
    expectedIds.length === actualIds.length &&
    expectedIds.every((id, index) => id === actualIds[index]);

  const issues = [];
  if (missing.length > 0) issues.push(`missing from verifier manifest: ${missing.join(", ")}`);
  if (stale.length > 0) issues.push(`stale verifier manifest entries: ${stale.join(", ")}`);
  if (duplicateExpected.length > 0) issues.push(`duplicate verifier manifest entries: ${[...new Set(duplicateExpected)].join(", ")}`);
  if (duplicateActual.length > 0) issues.push(`duplicate release audit gates: ${[...new Set(duplicateActual)].join(", ")}`);
  if (issues.length === 0 && !sameOrder) issues.push("verifier manifest order differs from release audit gate order");

  return issues.length > 0 ? issues.join("; ") : null;
}

function releaseVerifierPreflightCheckManifestIssue() {
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const preflightScript = has("scripts/release-env-preflight.js") ? read("scripts/release-env-preflight.js") : "";
  const expectedIds = releaseVerifierExpectedPreflightCheckIds(verifier);
  const actualIds = releaseEnvPreflightReportCheckIds(preflightScript);
  if (expectedIds.length === 0) return "release verifier expected preflight check manifest is missing";
  if (actualIds.length === 0) return "release env preflight report check list could not be parsed";

  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);
  const missing = actualIds.filter((id) => !expectedSet.has(id));
  const stale = expectedIds.filter((id) => !actualSet.has(id));
  const duplicateExpected = expectedIds.filter((id, index) => expectedIds.indexOf(id) !== index);
  const duplicateActual = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  const sameOrder =
    expectedIds.length === actualIds.length &&
    expectedIds.every((id, index) => id === actualIds[index]);

  const issues = [];
  if (missing.length > 0) issues.push(`missing from verifier preflight manifest: ${missing.join(", ")}`);
  if (stale.length > 0) issues.push(`stale verifier preflight manifest entries: ${stale.join(", ")}`);
  if (duplicateExpected.length > 0) issues.push(`duplicate verifier preflight manifest entries: ${[...new Set(duplicateExpected)].join(", ")}`);
  if (duplicateActual.length > 0) issues.push(`duplicate release preflight checks: ${[...new Set(duplicateActual)].join(", ")}`);
  if (issues.length === 0 && !sameOrder) issues.push("verifier preflight manifest order differs from release preflight check order");

  return issues.length > 0 ? issues.join("; ") : null;
}

function readinessStatus(missing: string[]) {
  return missing.length === 0 ? "pass" : "fail";
}

function parseJsonObjectFromOutput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function auditClassifier(): AuditItem {
  const failures = classifierSafetyCorpus.filter((entry) => classifyUrl(entry.url).verdict !== entry.expected);
  const groups = new Set(classifierSafetyCorpus.map((entry) => entry.group));
  const packageJson = read("package.json");
  const verifier = read("scripts/release-verify.js");
  const blockingEngine = read("src/lib/blocking-engine.ts");
  const adultFeedRoute = has("app/api/adult-domain-feed+api.ts") ? read("app/api/adult-domain-feed+api.ts") : "";
  const adultFeedIngestion = has("src/lib/adult-domain-feed-ingestion.ts") ? read("src/lib/adult-domain-feed-ingestion.ts") : "";
  const adultFeedSync = has("src/lib/adult-domain-feed-sync.ts") ? read("src/lib/adult-domain-feed-sync.ts") : "";
  const boundedResponseJson = has("src/lib/bounded-response-json.ts") ? read("src/lib/bounded-response-json.ts") : "";
  const checks = [
    failures.length === 0,
    classifierSafetyCorpus.length >= 35,
    groups.has("normal-browsing"),
    groups.has("recovery-research"),
    groups.has("adult-search-intent"),
    groups.has("adult-domain"),
    groups.has("overmatch-guard"),
    packageJson.includes('"audit:classifier"'),
    packageJson.includes('"audit:android-classifier"'),
    verifier.includes('"audit:classifier"'),
    verifier.includes('"audit:android-classifier"'),
    has("scripts/classifier-safety-audit.ts")
      && has("scripts/android-classifier-parity-audit.ts"),
    blockingEngine.includes("createAdultDomainFeed"),
    blockingEngine.includes("getAdultDomainFeedReadiness"),
    blockingEngine.includes("compileSafariContentBlockerRules"),
    adultFeedRoute.includes("format") && adultFeedRoute.includes("safari-content-blocker"),
    adultFeedRoute.includes("resolveCachedAdultDomainFeed"),
    adultFeedRoute.includes("X-FREED-Adult-Feed-Checksum"),
    adultFeedRoute.includes("X-FREED-Adult-Feed-Cache"),
    adultFeedRoute.includes("X-FREED-Adult-Feed-Source-Max-Bytes"),
    adultFeedRoute.includes("Access-Control-Allow-Headers") && adultFeedRoute.includes("If-None-Match"),
    adultFeedRoute.includes("formatFeedEtag"),
    adultFeedRoute.includes("readRequestedFeedValidators"),
    adultFeedRoute.includes("normalizeRequestedChecksums"),
    adultFeedRoute.includes("requestedValidators.checksums.includes(feed.checksum)"),
    adultFeedRoute.includes("reviewedSourceRefreshUnavailable"),
    adultFeedRoute.includes("no configured reviewed adult-domain feed source fetched successfully"),
    adultFeedRoute.includes("MAX_ADULT_FEED_AGE_MS"),
    adultFeedRoute.includes("adult domain feed generatedAt is older than 48 hours"),
    adultFeedRoute.includes("adult domain feed generatedAt is in the future"),
    adultFeedSync.includes("If-None-Match"),
    adultFeedSync.includes("remote-cache"),
    adultFeedSync.includes("nativeAlreadySynced"),
    adultFeedSync.includes("getConditionalAdultFeedChecksumForStatus"),
    adultFeedSync.includes("safariCanBePrimaryLayer"),
    adultFeedSync.includes("safariLayerExpected"),
    adultFeedSync.includes("minimumSafariRuleCount"),
    adultFeedSync.includes("SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length"),
    adultFeedSync.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS"),
    adultFeedSync.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES"),
    adultFeedSync.includes("sanitizeRemoteFeedEndpoint"),
    adultFeedSync.includes('getProductionEndpointIssues(trimmed, "adult domain feed endpoint")'),
    adultFeedSync.includes("fetchRemoteFeedPayload"),
    adultFeedSync.includes("readBoundedResponseJson"),
    adultFeedSync.includes('label: "Adult domain feed response"'),
    boundedResponseJson.includes("responseTooLargeError"),
    adultFeedSync.includes("Adult domain feed sync timed out"),
    adultFeedSync.includes("remoteFeedFreshnessIssue"),
    adultFeedSync.includes("Remote adult domain feed generatedAt is older than 48 hours"),
    adultFeedSync.includes("Remote adult domain feed generatedAt must not be in the future"),
    adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"),
    adultFeedIngestion.includes("resolveCachedAdultDomainFeed"),
    adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS"),
    adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS"),
    adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES"),
    adultFeedIngestion.includes("readResponseTextWithByteLimit"),
    adultFeedIngestion.includes("adult-domain-feed-source-too-large"),
    adultFeedIngestion.includes("stale-if-error"),
    adultFeedIngestion.includes("fetchSourceTextWithTimeout"),
    adultFeedIngestion.includes("getProductionEndpointIssues"),
    adultFeedIngestion.includes("reviewedAdultDomainFeedSourceFamily(source.id)"),
    adultFeedIngestion.includes("rejectedNormalDomains")
  ];

  return passOrFail(
    "adult-only-classifier",
    checks.every(Boolean),
    failures.length === 0
      ? `Classifier safety corpus passes ${classifierSafetyCorpus.length} normal, recovery, overmatch, adult-search, and adult-domain cases; adult feed route uses cached, timeout- and byte-bounded reviewed ingestion with checksum/304 sync headers, stale-if-error protection, 48-hour route freshness enforcement, future-date route rejection, fail-closed reviewed-source refresh handling, and client sync fallback for stale or future remote feeds.`
      : `Classifier safety corpus failures: ${failures.map((entry) => entry.id).join(", ")}.`,
    "Fix classifier parity before release."
  );
}

function auditAndroidNative(): AuditItem {
  const settings = read("android/settings.gradle");
  const manifest = read("modules/freed-protection/android/src/main/AndroidManifest.xml");
  const appManifest = read("android/app/src/main/AndroidManifest.xml");
  const webViewFixtureBuild = read("android/qa-webview-fixture/build.gradle");
  const webViewFixtureActivity = read("android/qa-webview-fixture/src/main/java/app/freed/qawebview/WebViewFixtureActivity.java");
  const vpnService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt");
  const vpnAutostartReceiver = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnAutostartReceiver.kt");
  const accessibilityService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt");
  const accessibilityServiceConfig = read("modules/freed-protection/android/src/main/res/xml/freed_accessibility_service.xml");
  const interventionActivity = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedInterventionActivity.kt");
  const classifier = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedUrlClassifier.kt");
  const protectionModule = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt");
  const nativeDoomscrollApps = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedDoomscrollApps.kt");
  const adultDomainFeed = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAdultDomainFeed.kt");
  const doomscrollApps = read("src/lib/doomscroll-apps.ts");
  const nativeIntervention = read("src/lib/native-intervention.ts");
  const policyPack = has("docs/store-policy/android-accessibility-and-fgs-disclosure.md")
    ? read("docs/store-policy/android-accessibility-and-fgs-disclosure.md")
    : "";
  const checks = [
    manifest.includes("FreedAccessibilityService"),
    manifest.includes("FreedVpnService"),
    manifest.includes("FOREGROUND_SERVICE_SPECIAL_USE"),
    manifest.includes("android.permission.RECEIVE_BOOT_COMPLETED"),
    manifest.includes("FreedVpnAutostartReceiver"),
    manifest.includes("android.intent.action.BOOT_COMPLETED"),
    manifest.includes("android.intent.action.MY_PACKAGE_REPLACED"),
    !manifest.includes("SYSTEM_ALERT_WINDOW"),
    !/SYSTEM_ALERT_WINDOW(?![^<]*tools:node="remove")/.test(appManifest),
    vpnService.includes(".addRoute(PRIMARY_DNS, 32)"),
    vpnService.includes(".addRoute(SECONDARY_DNS, 32)"),
    vpnService.includes("DNS_RESOLVERS = listOf(PRIMARY_DNS, SECONDARY_DNS)"),
    vpnService.includes("for (resolver in DNS_RESOLVERS)"),
    vpnService.includes("lastForwardResolver"),
    vpnService.includes("dnsGuardUptimeMs"),
    vpnService.includes("val dnsGuardRuntimeReady: Boolean"),
    vpnService.includes("val dnsGuardRuntimeIssue: String?"),
    vpnService.includes("dnsGuardSessionQueries.incrementAndGet()"),
    vpnService.includes("dnsGuardBlockedQueries.incrementAndGet()"),
    vpnService.includes("dnsGuardAllowedQueries.incrementAndGet()"),
    vpnService.includes("dnsGuardServfailResponses.incrementAndGet()"),
    vpnService.includes("STOP_REASON_VPN_REVOKED = \"vpn-revoked\""),
    vpnService.includes("finishDnsGuardFromLoop(descriptor, stopReason)"),
    vpnService.includes("PREF_DNS_GUARD_USER_ENABLED = \"dns_guard_user_enabled\""),
    vpnService.includes("ACTION_RESTORE = \"app.freed.protection.RESTORE_DNS_GUARD\""),
    vpnService.includes("VpnService.prepare(context) != null"),
    vpnService.includes("recordAutoRestart(context, action, AUTO_RESTART_RESULT_STARTED, null)"),
    vpnService.includes("setUserEnabled(this, false)"),
    vpnService.includes("val normalizedHost = dnsInterventionHost(host, classification)"),
    vpnService.includes("lastBlockedHost = normalizedHost"),
    vpnService.includes("recordAndLaunchDnsIntervention(normalizedHost, classification)"),
    vpnService.includes("FreedUrlClassifier.normalizeHostForStorage(result.host)"),
    vpnService.includes("FreedUrlClassifier.normalizeHostForStorage(questionHost)"),
    !vpnService.includes("lastBlockedHost = host"),
    !vpnService.includes("recordAndLaunchDnsIntervention(host, classification)"),
    vpnAutostartReceiver.includes("Intent.ACTION_BOOT_COMPLETED"),
    vpnAutostartReceiver.includes("Intent.ACTION_MY_PACKAGE_REPLACED"),
    vpnAutostartReceiver.includes("FreedVpnService.restartAfterSystemEvent"),
    !vpnService.includes('.addRoute("0.0.0.0", 0)'),
    accessibilityService.includes("collectLikelyFocusedUrlText"),
    accessibilityService.includes("isWebViewContext"),
    accessibilityService.includes("android.webkit.WebView"),
    accessibilityService.includes("FreedUrlClassifier.classifyFocusedInput(candidate, adultDomainFeed)"),
    accessibilityService.includes("shouldCollectFocusedCandidateText(packageName, node, text)"),
    accessibilityService.includes("sourceIsKnownBrowserUrlField(packageName, source)"),
    accessibilityService.includes("nodeLooksLikeUrlOrSearchField(source)"),
    accessibilityService.includes("looksLikeBoundedFocusedSearchText(text)"),
    accessibilityService.includes("sourceHasUrlFieldSignal"),
    accessibilityService.includes("nodeHasUrlFieldSignal"),
    !accessibilityService.includes("if (looksLikeUrlOrSearch(text)) return true"),
    accessibilityService.includes("FreedUrlClassifier.normalizeHostForStorage(result.host)"),
    classifier.includes("focused-search.app.freed.local"),
    classifier.includes("fun normalizeHostForStorage(input: String): String"),
    classifier.includes("sanitizeHostCandidate"),
    classifier.includes("focused-search:$explicitSearch"),
    classifier.includes("focused-search-education:$explicitSearch"),
    classifier.includes("shouldTreatAsUrlCandidate(input)"),
    accessibilityService.includes("isConfiguredBlockedApp"),
    accessibilityService.includes("configured-app:"),
    accessibilityService.includes("queryUsageStatsTodayMs"),
    accessibilityService.includes("maxOf(storedUsageMs + activeSessionMs, platformUsageMs)"),
    !accessibilityService.includes("unsafeCheckOpNoThrow"),
    nativeDoomscrollApps.includes("short-form:instagram-reels"),
    nativeDoomscrollApps.includes("short-form:tiktok-feed"),
    accessibilityService.includes("isSustainedShortFormScroll"),
    accessibilityService.includes("requireSelectedSurfaceSignal"),
    accessibilityService.includes("hasSelectedShortFormSurfaceSignal"),
    accessibilityService.includes("requireSelectedSurfaceSignal && !hasSelectedShortFormSurfaceSignal(rule, event)"),
    accessibilityService.includes("YOUTUBE_SHORTS_RULE -> packageName == YOUTUBE_PACKAGE && containsSelectedShortsNode(rootInActiveWindow, depth = 0)"),
    accessibilityService.includes("INSTAGRAM_REELS_RULE -> packageName == INSTAGRAM_PACKAGE && containsSelectedReelsNode(rootInActiveWindow, depth = 0)"),
    !accessibilityService.includes("requireSurfaceSignal && !hasShortFormSurfaceSignal(rule, event)"),
    accessibilityService.includes("hasShortFormSurfaceSignal"),
    accessibilityService.includes("shortFormLabelSignals"),
    accessibilityService.includes("shortFormViewIdSignals"),
    accessibilityServiceConfig.includes("typeViewScrolled"),
    accessibilityService.includes("AccessibilityEvent.TYPE_VIEW_SCROLLED"),
    accessibilityService.includes("MIN_SHORT_FORM_SCROLL_EVENTS"),
    accessibilityService.includes("FreedAdultDomainFeed.domains(this)"),
    protectionModule.includes("SUPPORTED_BLOCKED_APP_PACKAGES"),
    protectionModule.includes("SUPPORTED_BLOCKED_APP_PACKAGES.contains(it)"),
    protectionModule.includes("FreedDoomscrollApps.packageForShortFormHost(normalizedHost)"),
    accessibilityService.includes("FreedDoomscrollApps.shortFormHostForRule(rule)"),
    nativeDoomscrollApps.includes("SUPPORTED_BLOCKED_APP_PACKAGES"),
    nativeDoomscrollApps.includes('"com.reddit.frontpage"'),
    nativeDoomscrollApps.includes('"com.ss.android.ugc.trill"'),
    nativeDoomscrollApps.includes('"com.tiktok"'),
    doomscrollApps.includes("SUPPORTED_DOOMSCROLL_APP_PACKAGES"),
    doomscrollApps.includes("primaryDoomscrollPackageBySupportedPackage"),
    doomscrollApps.includes("surfaceForDoomscrollAppPackage"),
    protectionModule.includes("PENDING_INTERVENTION_MAX_AGE_MS"),
    protectionModule.includes("PENDING_INTERVENTION_FUTURE_SKEW_MS"),
    protectionModule.includes("isFreshPendingIntervention(detectedAt)"),
    protectionModule.includes("clearPendingInterventionPrefs(prefs)"),
    protectionModule.includes("sanitizedPendingHost"),
    protectionModule.includes("sanitizedPendingSourcePackage"),
    nativeIntervention.includes("SUPPORTED_NATIVE_INTERVENTION_APP_PACKAGES"),
    nativeIntervention.includes("SUPPORTED_DOOMSCROLL_APP_PACKAGES"),
    doomscrollApps.includes("SHORT_FORM_RULE_PACKAGES"),
    doomscrollApps.includes("SHORT_FORM_RULE_HOSTS"),
    nativeIntervention.includes("SHORT_FORM_RULE_HOSTS"),
    nativeIntervention.includes("hostForShortFormRule"),
    nativeIntervention.includes("packageForShortFormRule"),
    nativeIntervention.includes("supportedNativeAppPackageSet.has(normalized)"),
    nativeIntervention.includes('APP_INTERVENTION_FALLBACK_HOST = "selected-app.app.freed.local"'),
    !nativeIntervention.includes("shortFormRulePackages"),
    nativeIntervention.includes("configured-app:unsupported"),
    nativeIntervention.includes("normalizePendingReason"),
    protectionModule.includes('AsyncFunction("configureAdultDomainFeed"'),
    protectionModule.includes("adultDomainFeedDomainCount"),
    protectionModule.includes("statusPayloadWithAndroidDiagnostics"),
    protectionModule.includes('putIfMissing("adultDomainFeedDomainCount", FreedAdultDomainFeed.domainCount(context))'),
    protectionModule.includes('putIfMissing("dnsGuardResolverCount", FreedVpnService.DNS_RESOLVERS.size)'),
    manifest.includes("android.permission.PACKAGE_USAGE_STATS"),
    protectionModule.includes("UsageStatsManager"),
    protectionModule.includes("AppOpsManager.OPSTR_GET_USAGE_STATS"),
    !protectionModule.includes("unsafeCheckOpNoThrow"),
    protectionModule.includes("Settings.ACTION_USAGE_ACCESS_SETTINGS"),
    protectionModule.includes("usageStatsAuthorized"),
    protectionModule.includes("usageStatsObservedPackageNames"),
    protectionModule.includes("usageStatsTodayMinutes"),
    protectionModule.includes("usageStatsTodayMinutesByPackage"),
    accessibilityService.includes("AppOpsManager.OPSTR_GET_USAGE_STATS"),
    vpnService.includes("FreedAdultDomainFeed.domains(this)"),
    adultDomainFeed.includes("object FreedAdultDomainFeed"),
    adultDomainFeed.includes("MAX_DOMAINS = 50_000"),
    adultDomainFeed.includes("cachedRawDomains"),
    adultDomainFeed.includes("cachedDomains"),
    settings.includes("qa-webview-fixture"),
    webViewFixtureBuild.includes('applicationId "app.freed.qawebview"'),
    webViewFixtureActivity.includes("android.webkit.WebView"),
    webViewFixtureActivity.includes("ADULT_TEST_URL"),
    manifest.includes('android:noHistory="true"'),
    manifest.includes('android:excludeFromRecents="true"'),
    interventionActivity.includes("setFinishOnTouchOutside(false)"),
    interventionActivity.includes("finishAndRemoveTask()"),
    interventionActivity.includes("FLAG_ACTIVITY_REORDER_TO_FRONT"),
    classifier.includes("searchEngineDomains"),
    classifier.includes("adultDomainFeed.firstOrNull"),
    classifier.includes("recoveryDomainContextTerms"),
	    protectionModule.includes('"private_dns_mode"'),
	    protectionModule.includes('AsyncFunction("openPrivateDnsSettings"'),
	    protectionModule.includes('ACTION_PRIVATE_DNS_SETTINGS = "android.settings.PRIVATE_DNS_SETTINGS"'),
	    protectionModule.includes("ACTION_PRIVATE_DNS_SETTINGS,\n        listOf(Intent(Settings.ACTION_WIRELESS_SETTINGS), Intent(Settings.ACTION_SETTINGS))"),
	    protectionModule.includes("Settings.ACTION_WIRELESS_SETTINGS"),
    protectionModule.includes("FreedVpnService.startUserEnabledGuard(context)"),
	    protectionModule.includes("isVpnConsentRequired(context)"),
	    protectionModule.includes("VpnService.prepare(context) != null"),
	    protectionModule.includes("vpnConsentRequired = true"),
	    protectionModule.includes("vpnConsentRequired = false"),
	    protectionModule.includes("Android VPN consent is not approved for DNS Guard"),
	    protectionModule.includes("androidSettingsRoutes"),
	    protectionModule.includes("openAndroidSettingsRoute"),
	    protectionModule.includes("resolveActivity(context.packageManager)"),
	    protectionModule.includes("appDetailsSettingsIntent(context)"),
	    protectionModule.includes("Settings.ACTION_APPLICATION_DETAILS_SETTINGS"),
	    protectionModule.includes("androidSettingsRouteOpened"),
	    protectionModule.includes("androidSettingsRouteComponent"),
	    protectionModule.includes("openedComponent"),
	    protectionModule.includes("flattenToString()"),
	    protectionModule.includes("androidSettingsFallbackUsed"),
	    protectionModule.includes("androidSettingsRouteError"),
	    protectionModule.includes("androidSettingsRouteOpenedAt"),
	    protectionModule.includes("persistAndroidSettingsRoute"),
	    protectionModule.includes("lastAndroidSettingsRoute"),
	    protectionModule.includes("ACTION_ACCESSIBILITY_DETAILS_SETTINGS"),
	    protectionModule.includes("Intent.EXTRA_COMPONENT_NAME"),
	    protectionModule.includes("accessibilityServiceDetailsSettingsIntent(context)"),
	    protectionModule.includes("Settings.ACTION_ACCESSIBILITY_SETTINGS"),
	    protectionModule.includes("Settings.ACTION_USAGE_ACCESS_SETTINGS"),
	    protectionModule.includes("Private DNS state is reported for QA because strict Private DNS can affect DNS Guard resolver behavior."),
	    protectionModule.includes("Local VpnService fallback routes only configured DNS resolver IPs and never proxies full traffic."),
	    protectionModule.includes("routes DNS resolver IPs only for adult-domain blocking"),
	    protectionModule.includes("dnsGuardAutoRestartEligible"),
    protectionModule.includes("dnsGuardLastAutoRestartResult"),
    protectionModule.includes("dnsGuardLastForwardFailure"),
    protectionModule.includes("dnsGuardUptimeMs"),
    protectionModule.includes("FreedVpnService.dnsGuardRuntimeReady"),
    protectionModule.includes("FreedVpnService.dnsGuardRuntimeIssue"),
    protectionModule.includes("DNS Guard runtime is not ready"),
    protectionModule.includes('"issueCodes" to issueCodes'),
    protectionModule.includes('"android-vpn-consent-required"'),
    protectionModule.includes('"android-usage-access-disabled"'),
    protectionModule.includes('"android-selected-apps-missing"'),
    protectionModule.includes('"android-normal-smoke-blocked"'),
    protectionModule.includes("dnsGuardLastStopReason"),
    protectionModule.includes("dnsGuardSessionQueries"),
    protectionModule.includes("dnsGuardBlockedQueries"),
    protectionModule.includes("dnsGuardServfailResponses"),
    policyPack.includes("Play Console AccessibilityService declaration"),
    policyPack.includes("not as a disability assistance feature"),
    policyPack.includes("selected app packages"),
    policyPack.includes("supported browser address/search fields"),
    policyPack.includes("redacted local focused-search handoff"),
    policyPack.includes("focused WebView URL/search fields"),
    policyPack.includes("selected short-form labels"),
    policyPack.includes("No screenshots"),
    policyPack.includes("No OCR"),
    policyPack.includes("No raw page text scraping"),
    policyPack.includes("No packet inspection"),
    policyPack.includes("No MITM HTTPS"),
    policyPack.includes("No raw path/query persistence"),
    policyPack.includes("android.permission.FOREGROUND_SERVICE_SPECIAL_USE"),
    policyPack.includes("android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"),
    policyPack.includes("User-enabled DNS-only VPN fallback"),
    policyPack.includes("routes only configured DNS resolver IPs"),
    policyPack.includes("session counts"),
    policyPack.includes("stop reason"),
    policyPack.includes("restart after device reboot or app update"),
    policyPack.includes("existing Android VPN consent"),
    policyPack.includes("android.playPolicyAccessibilityReviewId"),
    policyPack.includes("android.playPolicySpecialUseFgsReviewId")
  ];

  return passOrFail(
    "android-native-safety-contract",
    checks.every(Boolean),
    "Android native module is DNS-only by default, avoids overlay permission, reports Private DNS state for QA without silently changing it, opens FREED Accessibility service details first with Accessibility/Usage/Usage Access rationale/Private DNS/Network app/system fallbacks, declares the Settings-displayed FREED Usage Access reason/config activity, covers supported browsers/focused WebViews including raw focused adult-search text, supports opt-in app package interruption with stale native handoff cleanup plus host/source-package normalization and JS allowlisted app unlock sources, normalizes DNS Guard blocked-host handoffs before persistence/notification, package-level Usage Access diagnostics and current selected Shorts/Reels/For You confirmation at short-form deadlines, exposes DNS Guard resolver/session lifecycle/restart counters plus runtime-ready activation proof, includes a QA WebView fixture, mirrors search-engine adult-intent classification, and has a Play policy disclosure pack for AccessibilityService plus special-use foreground-service review.",
    "Re-check Android manifest, Accessibility extraction, QA WebView fixture, VPN routing, native classifier parity, and the Android Play policy disclosure pack."
  );
}

function auditPrivacyContract(): AuditItem {
  const privacyManifest = read("ios/FREED/PrivacyInfo.xcprivacy");
  const appConfig = read("app.json");
  const appManifest = read("android/app/src/main/AndroidManifest.xml");
  const generatedReleaseManifestPaths = [
    "android/app/build/intermediates/merged_manifest/release/expoReleaseOverrideMaxSdkConflicts/AndroidManifest.xml",
    "android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml",
    "android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml",
    "android/app/build/intermediates/packaged_manifests/release/processReleaseManifestForPackage/AndroidManifest.xml"
  ];
  const generatedReleaseManifests = generatedReleaseManifestPaths.filter(has).map((path) => read(path));
  const androidBackupRules = has("android/app/src/main/res/xml/freed_data_extraction_rules.xml")
    ? read("android/app/src/main/res/xml/freed_data_extraction_rules.xml")
    : "";
  const iosInfoPlist = read("ios/FREED/Info.plist");
  const iosDataProtectionEntitlements = [
    "ios/FREED/FREED.entitlements",
    "ios/FREEDDeviceActivityMonitor/FREEDDeviceActivityMonitor.entitlements",
    "ios/FREEDShieldAction/FREEDShieldAction.entitlements",
    "ios/FREEDShieldConfiguration/FREEDShieldConfiguration.entitlements",
    "ios/FREEDSafariContentBlocker/FREEDSafariContentBlocker.entitlements"
  ].map((path) => (has(path) ? read(path) : ""));
  const envExample = read(".env.example");
  const envProductionExample = read(".env.production.example");
  const privacyDataMap = read("docs/privacy-data-map.md");
  const recoveryState = read("src/lib/recovery-state.ts");
  const nativeIntervention = read("src/lib/native-intervention.ts");
  const challengeContext = has("src/lib/challenge-context.ts") ? read("src/lib/challenge-context.ts") : "";
  const appSurface = read("src/features/freed-app.tsx");
  const protectionReadiness = has("src/lib/protection-readiness.ts") ? read("src/lib/protection-readiness.ts") : "";
  const protectionPermissions = read("src/lib/protection-permissions.ts");
  const performanceAudit = has("scripts/performance-safety-audit.js") ? read("scripts/performance-safety-audit.js") : "";
  const androidPolicyPack = has("docs/store-policy/android-accessibility-and-fgs-disclosure.md")
    ? read("docs/store-policy/android-accessibility-and-fgs-disclosure.md")
    : "";
  const iosPolicyPack = has("docs/store-policy/ios-screen-time-safari-dns-review.md")
    ? read("docs/store-policy/ios-screen-time-safari-dns-review.md")
    : "";
  const parsedAppConfig = JSON.parse(appConfig) as {
    expo?: { android?: { permissions?: string[]; blockedPermissions?: string[]; allowBackup?: boolean } };
  };
  const requestedAndroidPermissions = parsedAppConfig.expo?.android?.permissions ?? [];
  const blockedAndroidPermissions = parsedAppConfig.expo?.android?.blockedPermissions ?? [];
  const unneededChallengePermissions = [
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_AUDIO",
    "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
    "android.permission.ACCESS_MEDIA_LOCATION",
    "android.permission.MANAGE_EXTERNAL_STORAGE"
  ];
  const deniedAndroidPermissions = [
    "com.google.android.gms.permission.AD_ID",
    "android.permission.ACCESS_ADSERVICES_AD_ID",
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
    "android.permission.ACCESS_ADSERVICES_TOPICS",
    "android.permission.SYSTEM_ALERT_WINDOW",
    ...unneededChallengePermissions
  ];
  const weatherTransportIssues = [
    boundedIntegerEnvIssue("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS", 500, 15_000),
    boundedIntegerEnvIssue("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES", 1_024, 1_000_000)
  ].filter((issue): issue is string => Boolean(issue));
  const checks = [
    has("docs/privacy-data-map.md"),
    has("scripts/privacy-safety-audit.js"),
    read("package.json").includes("node -- scripts/privacy-safety-audit.js"),
    has("scripts/performance-safety-audit.js"),
    read("package.json").includes("node -- scripts/performance-safety-audit.js"),
    performanceAudit.includes("runtime-no-continuous-screenshot-or-ocr"),
    performanceAudit.includes("runtime-no-continuous-image-classification"),
    performanceAudit.includes("MediaProjection"),
    performanceAudit.includes("VNRecognizeTextRequest"),
    performanceAudit.includes("TextRecognition"),
    performanceAudit.includes("ImagePicker.launchCameraAsync"),
    performanceAudit.includes("VNClassifyImageRequest"),
    performanceAudit.includes("ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)"),
    performanceAudit.includes("Accessibility, DNS Guard, DeviceActivity, and Safari blocker protection paths do not run Vision/ML Kit loops"),
    protectionPermissions.includes("continuous image classification"),
    privacyManifest.includes("<key>NSPrivacyTracking</key>"),
    privacyManifest.includes("<false/>"),
    privacyManifest.includes("<key>NSPrivacyCollectedDataTypes</key>"),
    !appConfig.includes("NSUserTrackingUsageDescription"),
    appConfig.includes('"microphonePermission": false'),
    appConfig.includes('"photosPermission": false'),
    !iosInfoPlist.includes("NSMicrophoneUsageDescription"),
    !iosInfoPlist.includes("NSPhotoLibraryUsageDescription"),
    iosDataProtectionEntitlements.every(
      (contents) =>
        contents.includes("<key>com.apple.developer.default-data-protection</key>") &&
        contents.includes("<string>NSFileProtectionComplete</string>")
    ),
    !/(com\.google\.android\.gms\.permission\.AD_ID|android\.permission\.ACCESS_ADSERVICES_(AD_ID|ATTRIBUTION|TOPICS))(?![^<]*tools:node="remove")/.test(appManifest),
    unneededChallengePermissions.every(
      (permission) =>
        !requestedAndroidPermissions.includes(permission) &&
        blockedAndroidPermissions.includes(permission) &&
        manifestDoesNotShipPermission(appManifest, permission)
    ),
    generatedReleaseManifests.every((manifest) =>
      deniedAndroidPermissions.every((permission) => manifestOmitsPermission(manifest, permission))
    ),
    parsedAppConfig.expo?.android?.allowBackup === false,
    appManifest.includes('android:allowBackup="false"'),
    appManifest.includes('android:fullBackupContent="false"'),
    appManifest.includes('android:dataExtractionRules="@xml/freed_data_extraction_rules"'),
    androidBackupRules.includes("<cloud-backup"),
    androidBackupRules.includes("<device-transfer"),
    ["sharedpref", "database", "file", "external", "root"].every((domain) =>
      androidBackupRules.includes(`domain="${domain}"`)
    ),
    envExample.includes("OPENAI_API_KEY="),
    envProductionExample.includes("OPENAI_API_KEY="),
    envExample.includes("OPENAI_MODEL="),
    envProductionExample.includes("OPENAI_MODEL="),
    envExample.includes("GEMINI_API_KEY="),
    envProductionExample.includes("GEMINI_API_KEY="),
    !envProductionExample.includes("EXPO_PUBLIC_OPENAI_API_KEY"),
    !envExample.includes("EXPO_PUBLIC_OPENAI_API_KEY"),
    !envProductionExample.includes("EXPO_PUBLIC_GEMINI_API_KEY"),
    !envExample.includes("EXPO_PUBLIC_GEMINI_API_KEY"),
    !envProductionExample.includes("EXPO_PUBLIC_GOOGLE_API_KEY"),
    !envExample.includes("EXPO_PUBLIC_GOOGLE_API_KEY"),
    !envProductionExample.includes("EXPO_PUBLIC_GOOGLE_GENAI_API_KEY"),
    !envExample.includes("EXPO_PUBLIC_GOOGLE_GENAI_API_KEY"),
    envExample.includes("UPSTASH_REDIS_REST_TOKEN="),
    envProductionExample.includes("UPSTASH_REDIS_REST_TOKEN="),
    envExample.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET="),
    envProductionExample.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET="),
    envExample.includes("FCM_ACCESS_TOKEN="),
    envProductionExample.includes("FCM_ACCESS_TOKEN="),
    envExample.includes("FIREBASE_PROJECT_ID="),
    envProductionExample.includes("FIREBASE_PROJECT_ID="),
    envExample.includes("APNS_PRIVATE_KEY="),
    envProductionExample.includes("APNS_PRIVATE_KEY="),
    !envProductionExample.includes("EXPO_PUBLIC_UPSTASH"),
    !envExample.includes("EXPO_PUBLIC_UPSTASH"),
    !envProductionExample.includes("EXPO_PUBLIC_REMOTE_NOTIFICATION"),
    !envExample.includes("EXPO_PUBLIC_REMOTE_NOTIFICATION"),
    !envProductionExample.includes("EXPO_PUBLIC_FCM"),
    !envExample.includes("EXPO_PUBLIC_FCM"),
    !envProductionExample.includes("EXPO_PUBLIC_FIREBASE"),
    !envExample.includes("EXPO_PUBLIC_FIREBASE"),
    !envProductionExample.includes("EXPO_PUBLIC_APNS"),
    !envExample.includes("EXPO_PUBLIC_APNS"),
    envExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED=false"),
    envProductionExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED=false"),
    envExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS"),
    envExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES"),
    envProductionExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS"),
    envProductionExample.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES"),
    weatherTransportIssues.length === 0,
    challengeContext.includes("getChallengeWeatherContextConfig"),
    challengeContext.includes("latitude.toFixed(1)"),
    challengeContext.includes("getProductionEndpointIssues"),
    challengeContext.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS"),
    challengeContext.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES"),
    challengeContext.includes("readBoundedResponseJson"),
    appSurface.includes("if (!weatherConfig.enabled)"),
	    appSurface.includes("Test Protection"),
	    appSurface.includes("DNS-only VPN"),
	    appSurface.includes("local VpnService routes DNS resolver IPs only"),
	    appSurface.includes("configured limits or selected short-form thresholds"),
	    appSurface.includes("getSelectedScreenTimeTargetCount"),
	    appSurface.includes("getProtectionSetupReadiness"),
    appSurface.includes("@/lib/protection-readiness"),
    appSurface.includes("await syncNativeAdultDomainFeed()"),
    appSurface.includes('case "sync-adult-domain-feed":'),
    appSurface.includes("Activation test refreshed the reviewed adult-domain feed before checking native readiness"),
    protectionPermissions.includes("sync-adult-domain-feed"),
    protectionPermissions.includes("getSelectedScreenTimeTargetCount"),
    protectionPermissions.includes("selectedScreenTimeTokenCount"),
    protectionReadiness.includes("nativeConfiguredAppCount = protectionStatus?.blockedApplications ?? 0"),
    protectionReadiness.includes("getSelectedScreenTimeTargetCount(protectionStatus)"),
    protectionReadiness.includes("selectedIosTargets > 0 && protectionStatus?.appLimitScheduled"),
    protectionReadiness.includes("protectionStatus?.appInterventionAuthorized"),
    protectionReadiness.includes("protectionStatus?.usageStatsAuthorized"),
    protectionReadiness.includes("nativeConfiguredAppCount > 0"),
    appSurface.includes("Promise.allSettled(["),
    appSurface.includes("freshReadiness.activationReady"),
    appSurface.includes('Platform.OS === "ios"'),
    appSurface.includes('Platform.OS === "android"'),
    appSurface.includes('protectionCapability?.platform === "ios"'),
    appSurface.includes('protectionCapability?.platform === "android"'),
    appSurface.includes("if (activationComplete || !nativeProtectionPlatform)"),
    appSurface.includes("Finish required protection setup before entering FREED on this device"),
    appSurface.includes("Finish Setup"),
    appSurface.includes("Continue Preview"),
    !appSurface.includes("Continue Later"),
    appSurface.includes("onChooseApps"),
    appSurface.includes("appSelectionReturnToProtectionSetup"),
    appSurface.includes("appSelectionReturnPending"),
    appSurface.includes("onAppSelectionReturnHandled"),
    appSurface.includes("requiresAndroidAppSelection"),
    appSurface.includes("Select At Least 1 App"),
    appSurface.includes("disabled={requiresAndroidAppSelection && selectedCount <= 0}"),
    appSurface.includes('selectedAppPackageCount <= 0'),
    appSurface.includes("waitingNoticeShown"),
    appSurface.includes("is still not complete. Finish the opened setup step and return to FREED; setup will continue automatically."),
    appSurface.includes("Choose at least one app to protect. Returning to app selection now; FREED will sync and continue setup when you return."),
    appSurface.includes("Selected apps are saved. Syncing app timers to native protection now."),
    appSurface.includes("Selected apps are already synced. Continuing protection setup automatically."),
    appSurface.includes("Select at least one Android app timer to finish protection setup."),
    appSurface.includes("Choose Apps to Protect"),
    appSurface.includes('No Android app timers are selected yet. Choose at least one app now so activation can finish.'),
    appSurface.includes('setScreen(recoveryState.onboardingPaywallPresentedAt || recoveryState.premium ? "protectionSetup" : "paywall")'),
    appSurface.includes("without saving a blocked attempt"),
    appSurface.includes("PrivacySupportCard"),
    appSurface.includes("FREED_PRIVACY_POLICY_URL"),
    appSurface.includes("support@freedrecovery.app"),
    appSurface.includes("Server Deletion"),
    appSurface.includes("Delete Local Data"),
    appSurface.includes("deleteLocalRecoveryData"),
    appSurface.includes("createDefaultRecoveryState"),
    appSurface.includes("stopAdultContentFilter()"),
    appSurface.includes("stopRiskWindowMonitoring()"),
    appSurface.includes("clearEarnedUnlockWindow()"),
    appSurface.includes("configureBlockedAppPackages(\n        []"),
    privacyDataMap.includes("Challenge weather context"),
    privacyDataMap.includes("Disabled by default"),
    privacyDataMap.includes("production-safe HTTPS weather endpoint"),
    privacyDataMap.includes("exact coordinates are not sent to AI"),
    recoveryState.includes("sanitizeStoredAttemptHost"),
    recoveryState.includes("sanitizeSourceAttemptHost"),
    androidPolicyPack.includes("No sale or sharing of AccessibilityService data"),
    androidPolicyPack.includes("Data Safety Mapping"),
    androidPolicyPack.includes("Sharing: none for AccessibilityService/DNS Guard data"),
    androidPolicyPack.includes("No raw URL path/query persistence"),
    androidPolicyPack.includes("host-level redaction"),
    nativeIntervention.includes("SUPPORTED_NATIVE_INTERVENTION_APP_PACKAGES"),
    nativeIntervention.includes("supportedNativeAppPackageSet.has(normalized)"),
    nativeIntervention.includes('APP_INTERVENTION_FALLBACK_HOST = "selected-app.app.freed.local"'),
    nativeIntervention.includes("configured-app:unsupported"),
    nativeIntervention.includes("createDeepLinkInterventionAttempt"),
    nativeIntervention.includes("ios-safari-short-form"),
    nativeIntervention.includes("hostMatchesDomain(sourceHost, expectedHost)"),
    nativeIntervention.includes("normalizePendingReason"),
    privacyDataMap.includes("docs/store-policy/android-accessibility-and-fgs-disclosure.md"),
    iosPolicyPack.includes("FREED cannot and does not read third-party app screens on iOS"),
    iosPolicyPack.includes("does not receive users' Safari browsing history"),
    iosPolicyPack.includes("No all-domain DNS profile"),
    iosPolicyPack.includes("No challenge media upload in the current local-first build"),
    privacyDataMap.includes("docs/store-policy/ios-screen-time-safari-dns-review.md")
  ];

  return passOrFail(
    "privacy-safety-contract",
    checks.every(Boolean),
    weatherTransportIssues.length > 0
      ? weatherTransportIssues.join(", ")
      : "Privacy data map/audit exist, blocked attempt hosts and unlock sources are normalized before persistence with supported-app allowlisting for native app handoffs, iOS declares no tracking for the current build, iOS app/extension entitlements default local recovery and app-group files to Complete Data Protection, Android disables implicit OS backup/device transfer and source plus generated release manifests do not ship Ad ID, microphone, overlay, or media-library/storage permissions for on-demand camera challenges, AI, Redis, push, and store-verification provider secrets are server-only, optional weather context is disabled by default with coarse-coordinate and production-safe endpoint/transport safeguards, Profile exposes privacy policy/support/server-deletion/local-deletion controls with native protection cleanup, Android and iOS policy disclosures cover Accessibility/DNS Guard plus Screen Time/Safari data boundaries, and setup activation testing avoids fake recovery history.",
    "Fix privacy declarations, data map, or secret exposure before release."
  );
}

function auditRuntimeDataIntegrity(): AuditItem {
  const packageJson = read("package.json");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const smokeHarnessAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const script = has("scripts/runtime-data-integrity-audit.js") ? read("scripts/runtime-data-integrity-audit.js") : "";
  const appSurface = read("src/features/freed-app.tsx");
  const monetization = read("src/lib/monetization.ts");
  const recoveryState = read("src/lib/recovery-state.ts");
  const analytics = read("src/lib/recovery-analytics.ts");
  const urgeForecast = read("src/lib/urge-risk-forecast.ts");
  const challengeTemplates = read("src/data/challenge-templates.ts");
  const tests = read("tests/core.test.ts");
  const checks = [
    packageJson.includes('"audit:runtime-data": "node -- scripts/runtime-data-integrity-audit.js"'),
    verifier.includes('"audit:runtime-data"'),
    smokeHarnessAudit.includes("runtime data integrity audit"),
    script.includes("premium-entitlement-no-ui-toggle"),
    script.includes("monetization-defaults-native"),
    script.includes("manual-check-source"),
    script.includes("legacy-test-lab-normalized"),
    script.includes("analytics-no-test-lab-metric"),
    script.includes("qa-adult-attempt-dev-only"),
    script.includes("real-iso-ad-country-validation"),
    script.includes("no-reserved-adult-seed-domain"),
    script.includes("source-aware-intervention-copy"),
    script.includes("urge-forecast-real-local-signals"),
    script.includes("challenge-copy-no-fake-overclaim"),
    appSurface.includes("onManagePlan={() => setScreen(\"paywall\")}"),
    appSurface.includes("buildLocalUrgeRiskForecast(recoveryState)"),
    appSurface.includes("sendGatedAnalyticsPayload(recoveryState, recoveryState.analyticsSharing)"),
    appSurface.includes("Only aggregate counts and rates are sent after consent"),
    appSurface.includes('AppState.currentState === "active"'),
    appSurface.includes("recordAppSessionStart(current)"),
    recoveryState.includes("analyticsSharing: AnalyticsSharingSettings"),
    recoveryState.includes("updateAnalyticsSharingSettings"),
    recoveryState.includes("closedAt: opened"),
    !appSurface.includes("setPremium(!premium)"),
    monetization.includes('EXPO_PUBLIC_MONETIZATION_MODE === "mock" ? "mock" : "native"'),
    monetization.includes('if (requestedMode === "mock" && isProductionRuntime()) return "native";'),
    analytics.includes("manualCheckInterceptions"),
    analytics.includes("appInterceptions"),
    analytics.includes("productionMetrics"),
    analytics.includes("appForegroundMinutes"),
    analytics.includes("blockedAttemptSourceBreakdown"),
    analytics.includes("peakUrgeHour"),
    analytics.includes("hourlyUrgePattern"),
    analytics.includes("unlockFrequencyPerWeek"),
    analytics.includes("streakHistory"),
    analytics.includes("challengeSuccessByCategory"),
    analytics.includes("ANALYTICS_CONSENT_VERSION"),
    analytics.includes("analytics-consent-version-mismatch"),
    analytics.includes("configured-analytics-endpoint-missing"),
    analytics.includes("analytics-endpoint-consent-stale"),
    analytics.includes("EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES"),
    analytics.includes("readBoundedResponseJson"),
    !analytics.includes("testLabInterceptions"),
    urgeForecast.includes('source: "local-recovery-signals"'),
    urgeForecast.includes("excludesBrowsingDetails: true"),
    urgeForecast.includes("usesRawLocation: false"),
    !urgeForecast.includes("Math.random"),
    !challengeTemplates.includes("impossible to fake"),
    tests.includes("manual URL checks cannot create test-lab recovery history"),
    tests.includes("local urge risk forecast uses real signals without leaking private details"),
    tests.includes('AppState\\.currentState === "active"')
  ];

  return passOrFail(
    "runtime-data-integrity-contract",
    checks.every(Boolean),
    "Runtime data integrity audit prevents user-facing premium toggles, implicit or production mock monetization, test-lab recovery history, fake analytics metrics, fake urge forecasts, unguarded QA adult attempts, reserved fake adult seed domains, all-purpose adult-site intervention copy for app shields by requiring source-aware intervention copy, placeholder AdMob country codes, and overclaimed challenge verification copy while requiring real aggregate production metrics.",
    "Restore npm run audit:runtime-data and remove fake-data paths from production runtime surfaces."
  );
}

function auditAccessibilityContract(): AuditItem {
  const packageJson = read("package.json");
  const script = has("scripts/accessibility-safety-audit.js") ? read("scripts/accessibility-safety-audit.js") : "";
  const appSurface = read("src/features/freed-app.tsx");
  const releaseVerifier = read("scripts/release-verify.js");
  const checks = [
    packageJson.includes('"audit:accessibility"'),
    packageJson.includes("node -- scripts/accessibility-safety-audit.js"),
    releaseVerifier.includes('"audit:accessibility"'),
    script.includes("shared-pill-buttons-are-named"),
    script.includes("bottom-navigation-tabs-are-named"),
    script.includes("panic-action-is-explicit"),
    appSurface.includes("accessibilityLabel={accessibilityLabel ?? label}"),
    appSurface.includes('accessibilityRole="tab"'),
    appSurface.includes('accessibilityLabel="Open urge support"'),
    appSurface.includes('accessibilityRole="radio"')
  ];

  return passOrFail(
    "accessibility-safety-contract",
    checks.every(Boolean),
    "Accessibility audit covers named buttons, radio choices, selected states, bottom tabs, and immediate urge support.",
    "Restore accessibility labels/roles and npm run audit:accessibility before release verification."
  );
}

function auditChallengeVerificationContract(): AuditItem {
  const packageJson = read("package.json");
  const releaseVerifier = read("scripts/release-verify.js");
  const script = has("scripts/challenge-verification-audit.ts") ? read("scripts/challenge-verification-audit.ts") : "";
  const verification = read("src/lib/challenge-verification.ts");
  const appSurface = read("src/features/freed-app.tsx");
  const nativeIndex = read("modules/freed-protection/src/index.ts");
  const iosModule = read("modules/freed-protection/ios/FreedProtectionModule.swift");
  const androidModule = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt");
  const checks = [
    packageJson.includes('"audit:challenges"'),
    packageJson.includes("scripts/challenge-verification-audit.ts"),
    releaseVerifier.includes('"audit:challenges"'),
    script.includes("physical-effort-requires-motion"),
    script.includes("outdoor-walk-requires-location"),
    script.includes("generic-walk-uses-steps"),
    script.includes("production-challenge-families-covered"),
    script.includes("custom-challenge-families-inferred"),
    script.includes("specific-photo-targets-require-camera-label-match"),
    script.includes("connection-requires-explicit-action"),
    verification.includes('"photo"'),
    verification.includes('"connection"'),
    verification.includes("expectedPhotoLabels"),
    appSurface.includes("ImagePicker.launchCameraAsync"),
    appSurface.includes("base64: false"),
    appSurface.includes("exif: false"),
    appSurface.includes("classifyChallengePhoto(photoUri, expectedLabels)"),
    appSurface.includes("deleteTemporaryChallengePhoto(photoUri)"),
    appSurface.includes("Complete a connection action to verify this challenge."),
    appSurface.includes('label={onMessagePartner ? "Message Partner" : "I Reached Out"}'),
    nativeIndex.includes("classifyChallengePhoto"),
    iosModule.includes("VNClassifyImageRequest"),
    androidModule.includes("ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)")
  ];

  return passOrFail(
    "challenge-verification-contract",
    checks.every(Boolean),
    "Challenge verification audit covers production challenge-family coverage and custom/fallback family inference, motion, steps, accurate foreground location fixes, photo labels, connection actions, and timer-only calm resets with native photo classifier wiring.",
    "Restore npm run audit:challenges and the native/app challenge verification evidence gates before release."
  );
}

function auditChallengePersonalizationContext(): AuditItem {
  const engine = read("src/lib/recovery-engine.ts");
  const generator = read("src/lib/challenge-generator.ts");
  const challengeRoute = read("app/api/challenges+api.ts");
  const context = has("src/lib/challenge-context.ts") ? read("src/lib/challenge-context.ts") : "";
  const appSurface = read("src/features/freed-app.tsx");
  const nativeIntervention = read("src/lib/native-intervention.ts");
  const recoveryState = read("src/lib/recovery-state.ts");
  const nativeBridge = read("modules/freed-protection/src/index.ts");
  const androidModule = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt");
  const androidService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt");
  const tests = read("tests/core.test.ts");
  const checks = [
    engine.includes("buildInterventionContextFromAttempt"),
    engine.includes("surfaceFromAttempt"),
    engine.includes("interventionContext?.surface"),
    engine.includes("sessionDurationBucket"),
    engine.includes("recentFailureCount"),
    engine.includes("ChallengeContextSignal"),
    engine.includes("UrgeRiskForecastSignal"),
    engine.includes("riskForecast?.level"),
    engine.includes("inferChallengeEngineFamilies"),
    engine.includes("recoveryChallengeFamilies"),
    engine.includes('families.has("anti-relapse")'),
    engine.includes('families.has("late-night")'),
    generator.includes("dayPartFromHour"),
    generator.includes("sanitizeInterventionContext"),
    generator.includes("sanitizeContextSignals"),
    generator.includes("sanitizeRiskForecast"),
    generator.includes("Use intervention context only as coarse surface/category data"),
    generator.includes("Use context signals only when present"),
    generator.includes("Use the urge risk forecast only as aggregate local context"),
    generator.includes("Use session duration only as a coarse bucket"),
    generator.includes("Treat recent failed resets as aggregate count signals"),
    generator.includes("sessionDurationBucket"),
    generator.includes("recentFailureCount"),
    challengeRoute.includes("sessionDurationBuckets"),
    challengeRoute.includes("Use session duration only as a coarse bucket"),
    challengeRoute.includes("Treat recent failed resets as aggregate count signals"),
    context.includes("buildOpenMeteoWeatherUrl"),
    context.includes("latitude.toFixed(1)"),
    context.includes("weatherCodeToCondition"),
    appSurface.includes("activeInterventionContext"),
    appSurface.includes("buildInterventionContextFromAttempt(activeAttempt)"),
    appSurface.includes("buildChallengeContextSignals(todayCheckIn)"),
    appSurface.includes("riskForecast: urgeRiskForecast"),
    appSurface.includes("recentFailureCount"),
    appSurface.includes('history.outcome === "still-urging"'),
    appSurface.includes("Location.getForegroundPermissionsAsync"),
    appSurface.includes("fetchChallengeWeatherContext"),
    nativeIntervention.includes("sanitizeSessionDurationSeconds"),
    recoveryState.includes("sanitizeAttemptSessionDuration"),
    nativeBridge.includes("sessionDurationSec?: number"),
    androidService.includes("PENDING_SESSION_DURATION_SECONDS"),
    androidService.includes("currentForegroundSessionMs"),
    androidModule.includes('"sessionDurationSec" to sanitizedPendingSessionDuration(prefs)'),
    tests.includes("challenge set adapts to privacy-safe intervention context"),
    tests.includes("challenge set adapts to check-in context signals"),
    tests.includes("challenge context uses check-ins and coarse real-weather inputs"),
    tests.includes("challenge generation request uses recovery signals without browsing details"),
    tests.includes("sessionDurationBucket"),
    tests.includes("failed resets"),
    tests.includes("request.profile.contextSignals"),
    tests.includes("challenge set uses local urge forecast as an aggregate ranking signal")
  ];

  return passOrFail(
    "challenge-personalization-context",
    checks.every(Boolean),
    "Challenge generation uses time, weekend, timezone, slip history, outcome history, aggregate recent failed-reset counts, preferences, production challenge-family scoring, coarse intervention context including app/short-form session-duration buckets, local urge forecast, and privacy-safe check-in/location-permission/weather context without raw browsing details.",
    "Restore privacy-safe intervention/context-signal personalization before release."
  );
}

function auditDisciplineConfigurationContract(): AuditItem {
  const state = read("src/lib/recovery-state.ts");
  const doomscrollApps = read("src/lib/doomscroll-apps.ts");
  const recoveryEngine = read("src/lib/recovery-engine.ts");
  const appSurface = read("src/features/freed-app.tsx");
  const generator = read("src/lib/challenge-generator.ts");
  const templates = read("src/data/challenge-templates.ts");
  const nativeBridge = read("modules/freed-protection/src/index.ts");
  const iosModule = read("modules/freed-protection/ios/FreedProtectionModule.swift");
  const iosDeviceActivity = read("ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift");
  const androidModule = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt");
  const androidService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt");
  const tests = read("tests/core.test.ts");
  const checks = [
    state.includes("DisciplineSettings"),
    state.includes("DOOMSCROLL_APP_OPTIONS"),
    state.includes("SUPPORTED_DOOMSCROLL_APP_PACKAGES"),
    doomscrollApps.includes("androidPackageAliases"),
    doomscrollApps.includes("expandDoomscrollAppPackages"),
    doomscrollApps.includes("primaryDoomscrollPackageBySupportedPackage"),
    doomscrollApps.includes("surfaceForDoomscrollAppPackage"),
    recoveryEngine.includes("surfaceForDoomscrollAppPackage"),
    state.includes("blockedAppPackages"),
    state.includes("shortFormInterruptionSeconds"),
    state.includes("sanitizeBlockedAppPackages"),
    state.includes("createDefaultDisciplineSettings"),
    state.includes("updateDisciplineSettings"),
    state.includes("recordEarnedUnlock"),
    state.includes("MAX_EARNED_UNLOCK_MINUTES = 120"),
    state.includes("buildChallengePreferenceSignal"),
    appSurface.includes("DISCIPLINE RULES"),
    appSurface.includes("SettingStepper"),
    appSurface.includes("updateDisciplineSettings(current, update)"),
    appSurface.includes("completionSubmittedRef.current"),
    appSurface.includes("if (completionSubmittedRef.current) return"),
    appSurface.includes("disabled={completionSubmitting}"),
    appSurface.includes("return recordEarnedUnlock(completed, challenge"),
    !appSurface.includes('return outcome === "helped"'),
    appSurface.includes("getActiveNativeEarnedUnlock(recoveryState.earnedUnlocks, Platform.OS"),
    appSurface.includes("applyEarnedUnlockWindow(activeNativeUnlock.expiresAt, activeNativeUnlock.sourceAttemptHost)"),
    appSurface.includes("clearEarnedUnlockWindow()"),
    appSurface.includes("createDeepLinkInterventionAttempt"),
    appSurface.includes("Linking.getInitialURL()"),
    appSurface.includes('Linking.addEventListener("url"'),
    appSurface.includes("unless a Screen Time-sourced earned unlock is running"),
    appSurface.includes('Platform.OS === "android" ? appPackageForEarnedUnlockSource(unlock.sourceAttemptHost) : undefined'),
    appSurface.includes("DOOMSCROLL_APP_OPTIONS"),
    state.includes("getActiveBlockedAppPackages"),
    state.includes("isWeekendModeActive"),
    appSurface.includes("getActiveBlockedAppPackages(disciplineSettings"),
    appSurface.includes("disciplineSettings.shortFormInterruptionSeconds"),
    appSurface.includes("parseClockTime(disciplineSettings.sleepStartTime)"),
    appSurface.includes("startRiskWindowMonitoring(start.hour, end.hour, start.minute, end.minute)"),
    nativeBridge.includes("applyEarnedUnlockWindow"),
    nativeBridge.includes("clearEarnedUnlockWindow"),
    nativeBridge.includes("configureBlockedAppPackages"),
    nativeBridge.includes("appLimitScheduled?: boolean"),
    nativeBridge.includes("appLimitReachedToday?: boolean"),
    nativeBridge.includes("appLimitReachedDate?: string"),
    nativeBridge.includes("dailyLimitMinutes?: number"),
    nativeBridge.includes("shortFormInterruptionSeconds?: number"),
    nativeBridge.includes("selectedScreenTimeTokenCount?: number"),
    nativeBridge.includes("adultFilterStaysActiveDuringEarnedUnlock?: boolean"),
    nativeBridge.includes("activeUnlockSourcePackage?: string"),
    nativeBridge.includes("startMinute = 0"),
    iosModule.includes("applyEarnedUnlockWindow"),
    iosModule.includes('AsyncFunction("configureBlockedAppPackages"'),
    iosModule.includes("DeviceActivityEvent.Name(self.appLimitEventName)"),
    iosModule.includes("makeSelectedAppLimitEvent"),
    iosModule.includes("includesPastActivity: true"),
    iosModule.includes('"appLimitScheduled": isAppLimitMonitoringActive()'),
    iosModule.includes('"appLimitReachedToday": appLimitReachedDateValue == localDateKey()'),
    iosModule.includes('payload["appLimitReachedDate"] = appLimitReachedDateValue'),
    iosModule.includes('"dailyLimitMinutes": configuredDailyLimitMinutes()'),
    iosModule.includes("startMinute: Int, endMinute: Int"),
    iosModule.includes("DateComponents(hour: startHour, minute: startMinute)"),
    iosModule.includes("Screen Time earned unlock. Adult web filtering stays active"),
    iosModule.includes("isScreenTimeUnlockSource"),
    iosModule.includes("guard self.isScreenTimeUnlockSource(sourceAttemptHost) else"),
    iosModule.includes("sanitizeHostForStorage(trimmed) == screenTimeShieldHost"),
    iosModule.includes('earnedUnlockSourceKey = "freed.earnedUnlock.source"'),
    iosModule.includes("set(self.screenTimeShieldHost, forKey: self.earnedUnlockSourceKey)"),
    iosModule.includes("guard isScreenTimeUnlockSource(storedSource) else"),
    iosDeviceActivity.includes('earnedUnlockSourceKey = "freed.earnedUnlock.source"'),
    iosDeviceActivity.includes("guard isScreenTimeUnlockSource(storedSource) else"),
    iosModule.includes('"selectedScreenTimeTokenCount": selectedScreenTimeTokenCount'),
    iosModule.includes('"adultFilterStaysActiveDuringEarnedUnlock": activeUnlockExpiresAt != nil && active'),
    iosModule.includes('payload["selectedShieldsPausedForEarnedUnlock"] = selectedScreenTimeTokenCount > 0'),
    iosModule.includes("maxEarnedUnlockMinutes = 120"),
    iosModule.includes("boundedEarnedUnlockExpiry"),
    iosDeviceActivity.includes("isEarnedUnlockActive"),
    iosDeviceActivity.includes("eventDidReachThreshold"),
    iosDeviceActivity.includes("freed.selectedAppDailyLimitReached"),
    iosDeviceActivity.includes("applySelectedShieldsForCurrentState"),
    androidModule.includes("applyEarnedUnlockWindow"),
    androidModule.includes("configureBlockedAppPackages"),
    androidModule.includes("FreedAccessibilityService.DAILY_LIMIT_MINUTES"),
    androidModule.includes("FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS"),
    androidModule.includes("FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE"),
    androidModule.includes("FreedAccessibilityService.MAX_EARNED_UNLOCK_MINUTES"),
    androidModule.includes("formatIsoMillis(maxExpiryMs)"),
    androidModule.includes("packageForUnlockSourceHost"),
    androidModule.includes("packageForShortFormRule(rawSource)"),
    androidModule.includes("sanitizedPendingHost"),
    androidModule.includes("sanitizedPendingSourcePackage"),
    androidModule.includes("FreedUrlClassifier.normalizeHostForStorage(strippedSource)"),
    androidModule.includes('removePrefix("configured-app:")'),
    androidModule.includes('removePrefix("short-form:")'),
    androidModule.includes("SUPPORTED_BLOCKED_APP_PACKAGES.contains(normalizedHost)"),
    androidModule.includes("sanitizeDailyLimitMinutes"),
    androidModule.includes("sanitizeShortFormThresholdSeconds"),
    androidService.includes("isDailyAppLimitReached(packageName)"),
    androidService.includes("isEarnedUnlockActiveForPackage(packageName)"),
    androidService.includes("isEarnedUnlockActiveForPackage(normalizedPackage)"),
    androidService.includes("if (sourcePackage == null)"),
    androidService.includes("clearEarnedUnlockPrefs(prefs)"),
    androidService.includes("if (sourcePackage != normalizedPackage)"),
    androidService.includes("if (expiresAt == null)"),
    androidService.includes("if (expiryMs == null)"),
    androidService.includes("SUPPORTED_BLOCKED_APP_PACKAGES.contains(it)"),
    androidService.includes("beginOrContinueShortFormSession"),
    androidService.includes("handler.postDelayed(shortFormRunnable"),
    androidService.includes("hasSelectedShortFormSurfaceSignal"),
    androidService.includes("requireSelectedSurfaceSignal && !hasSelectedShortFormSurfaceSignal(rule, event)"),
    androidService.includes("YOUTUBE_SHORTS_RULE -> packageName == YOUTUBE_PACKAGE && containsSelectedShortsNode(rootInActiveWindow, depth = 0)"),
    androidService.includes("INSTAGRAM_REELS_RULE -> packageName == INSTAGRAM_PACKAGE && containsSelectedReelsNode(rootInActiveWindow, depth = 0)"),
    !androidService.includes("requireSurfaceSignal && !hasShortFormSurfaceSignal(rule, event)"),
    androidService.includes("scheduleEarnedUnlockRelock"),
    androidService.includes("handler.postDelayed(earnedUnlockRelockRunnable"),
    androidService.includes("MAX_EARNED_UNLOCK_MINUTES = 120"),
    androidService.includes("MAX_EARNED_UNLOCK_MINUTES * 60_000L"),
    androidService.includes("currentDailyUsageMs"),
    androidService.includes("APP_USAGE_PREFIX"),
    androidModule.includes("blockedApplications"),
    androidModule.includes("Adult-domain filtering stays protected"),
    generator.includes("disciplinePreferences"),
    generator.includes("Respect discipline settings"),
    templates.includes("disciplinePreferences"),
    tests.includes("discipline settings persist and shape earned unlocks"),
    tests.includes("selectedTikTokAlias"),
    tests.includes("surfaceForDoomscrollAppPackage"),
    tests.includes("discipline settings feed challenge preference signals without raw browsing data")
  ];

  return passOrFail(
    "discipline-configuration-contract",
    checks.every(Boolean),
    "Daily limits, earned unlock duration, opt-in app shields including supported Android package aliases, intensity, outdoor/exercise/social preferences, strict/sleep/focus/work/weekend modes, verified-completion earned unlock history, native earned-unlock windows, iOS DeviceActivity selected-app threshold shielding with Screen Time source-scoped selected-token/adult-filter unlock status, daily-limit-aware Android app-shield sync, selected-surface Android short-form thresholds with current Shorts/Reels/For You deadline confirmation, source-scoped Android earned unlocks, and source-aware Android relock are persisted, expanded, and fed into challenge generation.",
    "Restore persistent discipline settings, verified-completion earned unlock recording, native unlock sync, daily-limit-aware app-shield wiring, source-aware relock, and challenge preference wiring before release."
  );
}

function auditIosNative(): AuditItem {
  const appConfig = read("app.json");
  const appManifest = read("android/app/src/main/AndroidManifest.xml");
  const iosInfoPlist = read("ios/FREED/Info.plist");
  const project = read("ios/FREED.xcodeproj/project.pbxproj");
  const appEntitlements = read("ios/FREED/FREED.entitlements");
  const shieldAction = read("ios/FREEDShieldAction/ShieldActionExtension.swift");
  const shieldConfiguration = read("ios/FREEDShieldConfiguration/ShieldConfigurationExtension.swift");
  const deviceActivity = read("ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift");
  const safariContentBlockerInfo = read("ios/FREEDSafariContentBlocker/Info.plist");
  const safariContentBlockerHandler = read("ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift");
  const safariContentBlockerList = read("ios/FREEDSafariContentBlocker/blockerList.json");
  const module = read("modules/freed-protection/ios/FreedProtectionModule.swift");
  const adultFeedSync = read("src/lib/adult-domain-feed-sync.ts");
  const blockingEngine = read("src/lib/blocking-engine.ts");
  const doomscrollApps = read("src/lib/doomscroll-apps.ts");
  const shortFormWebContract = read("scripts/lib/short-form-web-contract.js");
  const appSurface = read("src/features/freed-app.tsx");
  const safariFocusManifest = read("ios/FREEDSafariFocusShield/manifest.json");
  const safariFocusContent = read("ios/FREEDSafariFocusShield/content.js");
  const safariFocusBackground = read("ios/FREEDSafariFocusShield/background.js");
  const safariFocusHandler = read("ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift");
  const policyPack = has("docs/store-policy/ios-screen-time-safari-dns-review.md")
    ? read("docs/store-policy/ios-screen-time-safari-dns-review.md")
    : "";
  const parsedAppConfig = JSON.parse(appConfig) as { expo?: { scheme?: string } };
  const checks = [
    parsedAppConfig.expo?.scheme === "freed",
    iosInfoPlist.includes("<key>CFBundleURLSchemes</key>") &&
      iosInfoPlist.includes("<string>freed</string>") &&
      iosInfoPlist.includes("<string>app.freed.recovery</string>"),
    appManifest.includes('<data android:scheme="freed"/>') && appManifest.includes('android:launchMode="singleTask"'),
    project.includes("FREEDShieldConfiguration"),
    project.includes("FREEDShieldAction"),
    project.includes("FREEDDeviceActivityMonitor"),
    project.includes("FREEDSafariContentBlocker"),
    project.includes("FREEDSafariFocusShield"),
    project.includes("background.js in Resources"),
    project.includes("blockerList.json in Resources"),
    appEntitlements.includes("com.apple.developer.family-controls"),
    appEntitlements.includes("group.app.freed.recovery"),
    shieldAction.includes("recordPendingIntervention"),
    shieldConfiguration.includes("selected app or site"),
    !shieldConfiguration.includes("adult-content intent before the page loaded"),
    deviceActivity.includes("DeviceActivityMonitor"),
    deviceActivity.includes("eventDidReachThreshold"),
    deviceActivity.includes("freed.selectedAppDailyLimitReached"),
    deviceActivity.includes("applySelectedShieldsForCurrentState"),
    deviceActivity.includes("adultFilterActiveKey"),
    deviceActivity.includes("applyWebContentFilterForCurrentState"),
    deviceActivity.includes("isAdultFilterActive() || isRiskWindowCurrentlyActive()"),
    safariContentBlockerInfo.includes("com.apple.Safari.content-blocker"),
    safariContentBlockerHandler.includes("NSExtensionRequestHandling"),
    safariContentBlockerHandler.includes("safari-content-blocker-rules.json"),
    safariContentBlockerHandler.includes("validatedSharedRulesURL"),
    safariContentBlockerHandler.includes("isValidBlockingRule"),
    safariContentBlockerHandler.includes("rules.allSatisfy(isValidBlockingRule)"),
    safariContentBlockerList.includes("url-filter"),
    !safariContentBlockerList.includes("youtube\\\\.com/shorts"),
    !safariContentBlockerList.includes("instagram\\\\.com/reel"),
    blockingEngine.includes('from "@/lib/doomscroll-apps"'),
    !blockingEngine.includes("export const SAFARI_SHORT_FORM_WEB_RULE_FILTERS = ["),
    doomscrollApps.includes("SAFARI_SHORT_FORM_WEB_RULE_FILTERS"),
    doomscrollApps.includes("youtube\\\\.com/shorts"),
    doomscrollApps.includes("instagram\\\\.com/reel"),
    shortFormWebContract.includes("SHORT_FORM_WEB_SURFACES"),
    shortFormWebContract.includes("isShortFormWebUrl"),
    module.includes("FamilyActivityPicker"),
    module.includes("ManagedSettingsStore"),
    module.includes("pendingInterventionMaxAgeSeconds"),
    module.includes("pendingInterventionFutureSkewSeconds"),
    module.includes("isFreshPendingIntervention(detectedAt)"),
    module.includes("sanitizedPendingHost"),
    module.includes("sanitizeHostForStorage"),
    module.includes('"url": "https://\\(host)"'),
    module.includes("sanitizedPendingSourcePackage"),
    module.includes("clearPendingInterventionDefaults()"),
    module.includes('AsyncFunction("configureBlockedAppPackages"'),
    module.includes("DeviceActivityEvent.Name(self.appLimitEventName)"),
    /saveFamilyActivitySelection\(selection\)[\s\S]*scheduleSelectedAppLimitMonitoring\(\s*selection: selection,\s*limitMinutes: self\.configuredDailyLimitMinutes\(\)\s*\)/.test(module),
    /saveFamilyActivitySelection\(selection\)[\s\S]*self\.applySelectedShieldsForCurrentState\(\)/.test(module),
    module.includes('"appLimitScheduled": isAppLimitMonitoringActive()'),
    module.includes('"appLimitReachedToday": appLimitReachedDateValue == localDateKey()'),
    module.includes('payload["appLimitReachedDate"] = appLimitReachedDateValue'),
    module.includes("appLimitReachedDateKey"),
    module.includes("applyWebContentFilterForCurrentState"),
    module.includes("applySelectedShieldsForCurrentState"),
    module.includes("isAppLimitReachedToday"),
    module.includes("sharedDefaults().bool(forKey: riskWindowCurrentlyActiveKey) || isAppLimitReachedToday()"),
    !/if isAdultFilterActive\(\) \{\s*applySelectedShieldsIfAvailable\(\)\s*\}/.test(module),
    !/if self\.isAdultFilterActive\(\) \{\s*self\.applySelectedShieldsForCurrentState\(\)\s*\}/.test(module),
    module.includes("configureSafariContentBlockerRules"),
    module.includes("Safari adult-domain blocker synced"),
    module.includes("Short-form web paths are handled by Safari Focus Shield"),
    module.includes("validateSafariContentBlockerRules"),
    module.includes("must use a block action"),
    module.includes("SFContentBlockerManager.reloadContentBlocker"),
    module.includes("SFContentBlockerManager.getStateOfContentBlocker"),
    module.includes("refreshSafariContentBlockerStateIfAvailable"),
    module.includes("safariContentBlockerEnabledKey"),
    module.includes("safariContentBlockerStateErrorKey"),
    module.includes("FREED Safari Content Blocker is not enabled in Safari settings"),
    !module.includes("import NetworkExtension"),
    !module.includes("NEDNSSettingsManager"),
    !adultFeedSync.includes("NetworkExtension"),
    appSurface.includes("protectionSyncMessage"),
    appSurface.includes("Safari Content Blocker state needs device verification"),
    appSurface.includes("Safari blocker off"),
    appSurface.includes("Settings > Safari > Extensions"),
    module.includes('"issueCodes": issueCodes'),
    module.includes('"ios-screen-time-authorization-missing"'),
    module.includes('"ios-device-activity-monitor-missing"'),
    module.includes('"ios-safari-rules-missing"'),
    module.includes('"ios-normal-smoke-blocked"'),
    !appSurface.includes("dnsSettingsLastError"),
    appSurface.includes("Adult-domain feed sync fell back safely"),
    safariFocusManifest.includes('\"strict_min_version\": \"15.4\"'),
    safariFocusManifest.includes('\"service_worker\": \"background.js\"'),
    safariFocusContent.includes("runtime?.sendMessage"),
    !safariFocusContent.includes("sendNativeMessage"),
    safariFocusBackground.includes("runtime.onMessage.addListener"),
    safariFocusBackground.includes("sendNativeMessage"),
    safariFocusHandler.includes("approvedRules"),
    policyPack.includes("iOS Screen Time And Safari Review Pack"),
    policyPack.includes("Family Controls entitlement"),
    policyPack.includes("FamilyActivityPicker"),
    policyPack.includes("ManagedSettings adult web filtering"),
    policyPack.includes("DeviceActivity schedules"),
    policyPack.includes("Safari Content Blocker"),
    policyPack.includes("Safari Focus Shield"),
    policyPack.includes("FREED cannot and does not read third-party app screens on iOS"),
    policyPack.includes("FREED cannot and does not detect Instagram Reels, TikTok, or YouTube Shorts inside native third-party apps on iOS"),
    policyPack.includes("FREED does not take screenshots, run OCR, or perform continuous image classification for protection"),
    policyPack.includes("FREED does not use `NEPacketTunnelProvider`, `NETunnelProviderManager`, or `NEVPNManager`"),
    policyPack.includes("FREED does not full-tunnel traffic"),
    policyPack.includes("does not receive users' Safari browsing history"),
    policyPack.includes("ios.familyControlsEntitlementArtifact"),
    policyPack.includes("ios.safariFocusShieldShortFormBlockRunId"),
    policyPack.includes("ios.safariShortFormChallengeHandoffSource=ios-safari-short-form"),
    policyPack.includes("ios.safariShortFormChallengeHandoffRawPathStored=false"),
    policyPack.includes("ios.safariShortFormChallengeHandoffNativeUnlockActive=false"),
    policyPack.includes("https://intervention.freed.app/intervention"),
    !/manager\.isEnabled\s*=/.test(module),
    !module.includes("NEPacketTunnelProvider"),
    !module.includes("NETunnelProviderManager"),
    !module.includes("NEVPNManager")
  ];

  return passOrFail(
    "ios-screen-time-scaffold",
    checks.every(Boolean),
    "iOS app and extension targets include Family Controls/app-group entitlements, exact scoped shield handoff/relock, Safari adult-domain Content Blocker packaging, and an iOS 15.4 Safari Focus Shield with a background-worker native relay and privacy-safe Universal Link recovery. The release gate requires no NetworkExtension implementation or claim.",
    "Restore missing Screen Time extension wiring, app-group entitlement, or iOS App Store review pack before release."
  );
}

function auditPromptTraceability(): AuditItem {
  const checklist = has("docs/prompt-to-artifact-checklist.md") ? read("docs/prompt-to-artifact-checklist.md") : "";
  const completionAudit = has("docs/completion-audit.md") ? read("docs/completion-audit.md") : "";
  const releaseBlockers = has("docs/release-blockers.md") ? read("docs/release-blockers.md") : "";
  const research = has("docs/research-and-architecture.md") ? read("docs/research-and-architecture.md") : "";
  const validationReadme = has("docs/validation/README.md") ? read("docs/validation/README.md") : "";
  const evidenceRunbook = has("docs/validation/evidence-runbook.md") ? read("docs/validation/evidence-runbook.md") : "";
  const packageJson = read("package.json");
  const checks = [
    checklist.includes("Prompt-To-Artifact Checklist"),
    checklist.includes("Current conclusion: not complete"),
    checklist.includes("Missing To Complete The Objective"),
    checklist.includes("production/sandbox App Store / Play Core 3 product IDs"),
    checklist.includes("iOS physical-device evidence"),
    checklist.includes("ios.earnedUnlockSourceHost=screen-time-shield.freed.local"),
    checklist.includes("ios.earnedUnlockRejectedSelectedShieldsStayedActive=true"),
    checklist.includes("Android real-browser/WebView/DNS/app-shield evidence"),
    checklist.includes("battery/RAM/thermal/DNS/network evidence"),
    completionAudit.includes("docs/prompt-to-artifact-checklist.md"),
    completionAudit.includes("docs/validation/evidence-runbook.md"),
    releaseBlockers.includes("Current release audit state"),
    releaseBlockers.includes("npm run verify:release"),
    releaseBlockers.includes("docs/validation/evidence-runbook.md"),
    releaseBlockers.includes("--app-scenario before-limit|shield|earned-unlock|earned-unlock-relock|browser-earned-unlock|all"),
    releaseBlockers.includes("browser/adult-domain earned-unlock no-app-unlock proof"),
    releaseBlockers.includes("android.browserEarnedUnlockConfiguredAppStillShielded=true"),
    releaseBlockers.includes("ios.earnedUnlockSourceHost=screen-time-shield.freed.local"),
    releaseBlockers.includes("ios.earnedUnlockRejectedAdultFilterStillActive=true"),
	    releaseBlockers.includes("iOS Safari plus Android Chrome, Firefox, Edge, and Samsung Internet"),
	    releaseBlockers.includes("Failing gate: `ai-backend-smoke-validation`"),
	    releaseBlockers.includes("npm run smoke:backend-readiness"),
	    releaseBlockers.includes("npm run smoke:supabase-schema"),
    releaseBlockers.includes("npm run smoke:analytics-ingestion"),
    releaseBlockers.includes("npm run audit:runtime-data"),
    releaseBlockers.includes("duplicate active env-file keys"),
    releaseBlockers.includes("malformed non-comment env-file lines"),
    research.includes("2026-05-12 live verification notes"),
    research.includes("source-less or browser/adult-domain challenge windows do not pause selected Screen Time shields"),
    research.includes("canonical Screen Time shield source marker"),
    completionAudit.includes("rejected non-Screen-Time source"),
    completionAudit.includes("iOS Safari plus Android Chrome, Firefox, Edge, and Samsung Internet"),
    validationReadme.includes("Copied template placeholder values"),
    validationReadme.includes("iOS Safari plus Android Chrome, Firefox, Edge, and Samsung Internet"),
    validationReadme.includes("angle-bracket placeholders"),
    validationReadme.includes("template env files"),
    validationReadme.includes("URLs, extra flags"),
    validationReadme.includes("docs/validation/evidence-runbook.md"),
    evidenceRunbook.includes("FREED Evidence Capture Runbook"),
    evidenceRunbook.includes("iOS Safari plus Android Chrome, Firefox, Edge, and Samsung Internet"),
    evidenceRunbook.includes("literal angle-bracket placeholders are rejected"),
    evidenceRunbook.includes("template env files"),
    evidenceRunbook.includes("URLs, extra flags"),
    evidenceRunbook.includes("duplicate active env-file keys"),
    evidenceRunbook.includes("malformed non-comment env-file lines"),
    evidenceRunbook.includes("Target file: `docs/validation/evidence/ios-physical-device.json`"),
    evidenceRunbook.includes("Target file: `docs/validation/evidence/ai-backend-smoke.json`"),
    evidenceRunbook.includes("npm run verify:release"),
    packageJson.includes('"verify:release"')
  ];

  return passOrFail(
    "prompt-to-artifact-traceability",
    checks.every(Boolean),
    "Prompt-to-artifact checklist, completion audit, live research notes, release blockers, evidence rules, and evidence capture runbook are documented.",
    "Update docs/prompt-to-artifact-checklist.md, docs/completion-audit.md, docs/research-and-architecture.md, docs/release-blockers.md, docs/validation/README.md, and docs/validation/evidence-runbook.md before release."
  );
}

function auditReleaseVerifier(): AuditItem {
  const packageJson = read("package.json");
  const script = read("scripts/release-readiness.ts");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const androidApkBuilder = has("scripts/build-android-release-apk.js")
    ? read("scripts/build-android-release-apk.js")
    : "";
  const iosArchiveBuilder = has("scripts/build-ios-release-archive.js")
    ? read("scripts/build-ios-release-archive.js")
    : "";
  const smokeHarnessAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const iosNativeBuildCheck = has("scripts/ios-native-build-check.js") ? read("scripts/ios-native-build-check.js") : "";
  const requiredScripts = [
    "preflight:release-env",
    "typecheck",
    "test:core",
    "audit:smoke-harnesses",
    "export:web",
    "audit:store-legal-hosted",
    "export:android-bundle",
    "build:android-apk:upload-signed",
    "build:android-aab:upload-signed",
    "build:ios-archive:release",
    "audit:client-bundles",
    "smoke:backend-readiness",
    "smoke:supabase-schema",
    "smoke:adult-domain-feed",
    "smoke:analytics-ingestion",
    "smoke:remote-notifications",
    "eval:ai-safety",
    "smoke:ai-backend",
    "smoke:purchase-verification",
    "audit:challenges",
    "audit:classifier",
    "audit:android-classifier",
    "audit:accessibility",
    "audit:privacy",
    "audit:runtime-data",
    "audit:backend",
    "audit:performance",
    "audit:dependencies",
    "evidence:requirements",
    "evidence:artifact-privacy",
    "evidence:templates",
    "evidence:validation",
    "audit:release:strict"
  ];
  const checks = [
    packageJson.includes('"verify:release": "node -- scripts/release-verify.js"'),
    packageJson.includes('"test:core": "node -- scripts/run-ts-entry.js tests/core.test.ts"'),
    packageJson.includes('"audit:smoke-harnesses": "node -- scripts/smoke-harness-audit.js"'),
    packageJson.includes('"audit:release": "node -- scripts/run-ts-entry.js scripts/release-readiness.ts"'),
    packageJson.includes('"audit:release:strict": "node -- scripts/run-ts-entry.js scripts/release-readiness.ts --strict"'),
    packageJson.includes('"build:ios-simulator": "node -- scripts/ios-native-build-check.js"'),
    packageJson.includes('"build:ios-archive:release": "node -- scripts/build-ios-release-archive.js --require-release-signing"'),
    packageJson.includes('"build:android-apk:upload-signed": "node -- scripts/build-android-release-apk.js --arch arm64-v8a --require-upload-signing"'),
    packageJson.includes('"build:android-aab:upload-signed": "node -- scripts/build-android-release-apk.js --artifact aab --arch arm64-v8a --require-upload-signing"'),
    packageJson.includes('"audit:backend": "node -- scripts/backend-architecture-audit.js"'),
    packageJson.includes('"smoke:supabase-schema": "node -- scripts/run-ts-entry.js scripts/supabase-schema-smoke.ts"'),
    packageJson.includes('"evidence:requirements"'),
    packageJson.includes('"evidence:artifact-privacy": "node -- scripts/validation-artifact-privacy-audit.js"'),
    packageJson.includes('"evidence:scaffold"'),
    packageJson.includes('"evidence:ios-physical-device"'),
    packageJson.includes('"evidence:android-real-browser"'),
    packageJson.includes('"evidence:normal-browsing-corpus"'),
    packageJson.includes('"evidence:performance-profile"'),
    packageJson.includes('"evidence:store-ad-sandbox"'),
    packageJson.includes('"evidence:ai-backend-smoke"'),
    packageJson.includes("node -- scripts/validation-evidence-requirements.js"),
    packageJson.includes("node -- scripts/validation-evidence-scaffold.js"),
    packageJson.includes("node -- scripts/validation-artifact-privacy-audit.js"),
    packageJson.includes("node -- scripts/validation-template-audit.js"),
    has("scripts/validation-evidence-requirements.js"),
    has("scripts/validation-evidence-scaffold.js"),
    has("scripts/validation-artifact-privacy-audit.js"),
    has("scripts/validation-template-audit.js"),
    has("scripts/smoke-harness-audit.js"),
    has("scripts/ios-native-build-check.js"),
    has("scripts/build-ios-release-archive.js"),
    iosArchiveBuilder.includes("freed-ios-release-archive-report-v1"),
    iosArchiveBuilder.includes("ios-release-signing"),
    iosArchiveBuilder.includes("ios-release-safari-content-blocker"),
    iosArchiveBuilder.includes("Apple Distribution"),
    iosArchiveBuilder.includes("FREED_IOS_DEVELOPMENT_TEAM"),
    iosArchiveBuilder.includes("FREED_IOS_PROVISIONING_PROFILES_JSON"),
    iosArchiveBuilder.includes("app-store-connect"),
    iosArchiveBuilder.includes("packetTunnelProviderEntitled"),
    iosArchiveBuilder.includes("FREEDSafariContentBlocker.appex"),
    iosArchiveBuilder.includes("FREEDSafariFocusShield.appex"),
    iosArchiveBuilder.includes("inspectSafariFocusShieldResources"),
    !iosArchiveBuilder.includes("shortFormRulesPresent"),
    iosArchiveBuilder.includes("--require-release-signing"),
    iosNativeBuildCheck.includes('const DEFAULT_DESTINATION = "auto"'),
    iosNativeBuildCheck.includes("--simctl-timeout-ms"),
    iosNativeBuildCheck.includes("selectSimulatorDestinationFromDevices"),
    iosNativeBuildCheck.includes("resolveBuildDestination"),
    iosNativeBuildCheck.includes("dryRunDestinationNote"),
    iosNativeBuildCheck.includes("dry-run placeholder"),
    iosNativeBuildCheck.includes("ETIMEDOUT"),
    iosNativeBuildCheck.includes("xcrun simctl timed out"),
    has("scripts/backend-architecture-audit.js"),
    has("scripts/supabase-schema-smoke.ts"),
    has("scripts/lib/png-screenshot-audit.js"),
    has("scripts/lib/android-doomscroll-contract.js"),
    has("scripts/lib/short-form-web-contract.js"),
    has("scripts/lib/evidence-target-safety.js"),
    has("scripts/lib/env-file-safety.js"),
    has("scripts/lib/report-path-safety.js"),
    has("scripts/lib/workspace-path-safety.js"),
    has("scripts/lib/env-file-loader.js"),
    has("scripts/android-emulator-smoke.js"),
    has("scripts/android-real-browser-evidence.js"),
    has("scripts/ios-simulator-smoke.js"),
    has("scripts/ios-physical-device-evidence.js"),
    has("scripts/normal-browsing-corpus-evidence.js"),
    has("scripts/performance-profile-evidence.js"),
    has("scripts/store-ad-sandbox-evidence.js"),
    has("scripts/ai-backend-smoke-evidence.js"),
    has("scripts/ai-backend-smoke-evidence.js"),
    has("scripts/validation-evidence-specs.json"),
    verifier.includes("--list"),
    verifier.includes("--env-file"),
    verifier.includes("--artifact-dir"),
    verifier.includes("--self-test"),
    verifier.includes("FREED_RELEASE_ENV_FILE"),
    verifier.includes("loadEnvFile"),
    verifier.includes("Missing value for --env-file"),
    verifier.includes("Missing value for --artifact-dir"),
    verifier.includes("Unknown option"),
    verifier.includes("reportArtifactNames"),
    verifier.includes("reportArtifactSchemas"),
    verifier.includes("assertReportArtifact"),
    verifier.includes("productionBlockerGroups"),
    verifier.includes("assertPreflightBlockerGroups"),
    verifier.includes("assertReleaseReadinessReport"),
    verifier.includes("assertPassFailResults"),
    verifier.includes("reportArtifactRequiredResultIds"),
    verifier.includes("backend-readiness-http-contract"),
    verifier.includes("challenge-remote-endpoint"),
    verifier.includes("expectedReleaseReadinessGateIds"),
    verifier.includes("prototype-design-files"),
    script.includes("releaseVerifierGateManifestIssue"),
    script.includes("releaseVerifierExpectedGateIds"),
    script.includes("verifier manifest order differs from release audit gate order"),
    script.includes("releaseVerifierExpectedPreflightCheckIds"),
    script.includes("releaseEnvPreflightReportCheckIds"),
    script.includes("releaseVerifierPreflightCheckManifestIssue"),
    script.includes("verifier preflight manifest order differs from release preflight check order"),
    verifier.includes("requiredArrayFields"),
    verifier.includes("expectedPreflightReportCheckIds"),
    verifier.includes("optional-challenge-weather-context"),
    verifier.includes("optional-recovery-backup-sync-endpoint"),
    verifier.includes("optional-supabase-auth-client"),
    verifier.includes("optional-retention-endpoint"),
    verifier.includes("checks must include preflight check"),
    verifier.includes("unexpected preflight check"),
    verifier.includes("blockerGroups"),
    verifier.includes("pass/fail counts must match checks"),
    verifier.includes("missingPreflightCheckIds"),
    verifier.includes("can only be external"),
    verifier.includes("failedPreflightChecks must belong to its preflightCheckIds"),
    verifier.includes("failedPreflightChecks must match failed checks"),
    verifier.includes("fail status must include failedPreflightChecks"),
    verifier.includes("must be strict"),
    verifier.includes("pass/warn/fail counts must match results"),
    verifier.includes("PASS/FAIL status"),
    verifier.includes("pass/fail counts must match results"),
    verifier.includes("must include required result"),
    verifier.includes("reportArtifactRequiredProofValues"),
    verifier.includes("assertReportProofValues"),
    verifier.includes("store-legal-hosted-url-audit.json"),
    verifier.includes("freed-store-legal-hosted-url-audit-v1"),
    verifier.includes("hostedLegalRequiredCheckIds"),
    verifier.includes("assertHostedLegalReport"),
    verifier.includes("audit:store-legal-hosted report artifact routeResults"),
    verifier.includes('path: "result", equals: "pass"'),
    verifier.includes('path: "sanitized", equals: true'),
    verifier.includes("weakPreflightResultPayload"),
    verifier.includes("unsanitizedPreflightPayload"),
    verifier.includes("weakAndroidResultPayload"),
    verifier.includes("weakIosSigningPayload"),
    verifier.includes("weakIosSafariPayload"),
    verifier.includes("unsanitizedAndroidPayload"),
    verifier.includes("unsanitizedDeployedSmokePayload"),
    verifier.includes("conditionalRequiredResultIds"),
    verifier.includes("EXPO_PUBLIC_RETENTION_ENDPOINT"),
    verifier.includes("ISO_UTC_TIMESTAMP_PATTERN"),
    verifier.includes("REPORT_CURRENT_RUN_TOLERANCE_MS"),
    verifier.includes("assertGeneratedAt"),
    verifier.includes("assertReportFileFresh"),
    verifier.includes("existingArtifactDirPathIssue"),
    verifier.includes("lstatSync"),
    verifier.includes("removeExistingReportArtifact"),
    verifier.includes("unlinkSync"),
    verifier.includes("must include ISO generatedAt"),
    verifier.includes("generatedAt must be from the current verifier run"),
    verifier.includes("file must be written by the current verifier run"),
    verifier.includes("release artifact directory must be under docs/validation/artifacts/<run-id>"),
    verifier.includes("release artifact directory existing path components must be directories"),
    verifier.includes("release artifact directory must not include symbolic links"),
    verifier.includes("expected report artifact path must be a file before cleanup"),
    verifier.includes("parsed.toISOString() === value"),
    verifier.includes("minGeneratedAtMs: commandStartedAtMs"),
    verifier.includes("minModifiedAtMs: commandStartedAtMs"),
    verifier.includes("Release verification stopped before npm run"),
    verifier.includes("endpointProofs.claraEndpointChecked"),
    verifier.includes("serverSecretKeyNamesChecked must include APP_STORE_PRIVATE_KEY"),
    verifier.includes("required result retention-remote-endpoint"),
    verifier.includes("warnCount=0"),
    verifier.includes("must include release readiness gate"),
    verifier.includes("unexpected release readiness gate"),
    verifier.includes("privateEchoPatternsChecked"),
    verifier.includes("number between 1 and 100"),
    verifier.includes("secretShapedReportPatterns"),
    verifier.includes("reportSecretShapeIssue"),
    verifier.includes("secretLeakCases"),
    verifier.includes("URL credentials"),
    verifier.includes("OpenAI API key"),
    verifier.includes("Google API key"),
    verifier.includes("Google OAuth access token"),
    verifier.includes("FCM server key"),
    verifier.includes("APA91"),
    verifier.includes("deviceTokenEchoForbidden"),
    verifier.includes("bearer token"),
    verifier.includes("secret-shaped JWT"),
    verifier.includes("secret-shaped bearer token"),
    verifier.includes("secret-shaped device token"),
    verifier.includes("raw secret parameter"),
    verifier.includes("runSelfTest"),
    verifier.includes("release-verify self-test: pass"),
    verifier.includes("report artifact must have failCount=0"),
    verifier.includes("local home path"),
    verifier.includes("report artifact must include a positive passCount"),
    verifier.includes("report artifact must include non-empty"),
    verifier.includes('proofField: "contractProof"'),
    verifier.includes("freed-release-env-preflight-report-v1"),
    verifier.includes("freed-android-apk-build-report-v1"),
    verifier.includes("freed-android-release-build-report-v1"),
    verifier.includes("freed-ios-release-archive-report-v1"),
    verifier.includes("android-apk-build-report.json"),
    verifier.includes("android-aab-build-report.json"),
    verifier.includes("ios-release-archive-report.json"),
    verifier.includes("android-apk-upload-signing"),
    verifier.includes("android-aab-upload-signing"),
    verifier.includes("ios-release-signing"),
    verifier.includes("ios-release-safari-content-blocker"),
    verifier.includes("android-apk-admob-app-id"),
    verifier.includes("android-aab-admob-app-id"),
    verifier.includes("android-apk-signature"),
    verifier.includes('path: "artifactType", equals: "aab"'),
    verifier.includes('path: "aab.hasHermesRuntime", equals: true'),
    verifier.includes('path: "aab.hasJscRuntime", equals: false'),
    verifier.includes('path: "aab.hasReactNativeBundle", equals: true'),
    verifier.includes('path: "aab.abis", includesAll: ["arm64-v8a"]'),
    verifier.includes('path: "archive.packetTunnelProviderEntitled", equals: false'),
    verifier.includes('path: "archive.safariRuleList.usableForManualEvidence", equals: true'),
    verifier.includes('path: "archive.safariFocusShield.usableForManualEvidence", equals: true'),
    verifier.includes("FREEDSafariFocusShield.appex"),
    !verifier.includes("safariRuleList.shortFormRulesPresent"),
    verifier.includes('path: "ipa.sha256", nonEmptyString: true'),
    verifier.includes("buildResult"),
    verifier.includes('path: "selectedEngine", equals: "hermes"'),
    verifier.includes('path: "finalEngine", equals: "hermes"'),
    verifier.includes('path: "adMob.mode", equals: "production"'),
    verifier.includes('path: "adMob.productionReady", equals: true'),
    verifier.includes('path: "adMob.sampleAppIdUsed", equals: false'),
    verifier.includes('path: "apk.signature.verified", equals: true'),
    verifier.includes('path: "apk.signature.debugSigned", equals: false'),
    verifier.includes('path: "apk.signature.v2SchemeVerified", equals: true'),
    verifier.includes("signing.playConsoleReady"),
    verifier.includes('path: "signing.uploadKeystore.checked", equals: true'),
    verifier.includes('path: "signing.uploadKeystore.debugSigned", equals: false'),
    verifier.includes('path: "apk.hasHermesRuntime", equals: true'),
    verifier.includes('path: "apk.hasJscRuntime", equals: false'),
    androidApkBuilder.includes("function canRetryWithJsc"),
    androidApkBuilder.includes("function assertUploadSignedEnginePolicy"),
    androidApkBuilder.includes("--artifact <apk|aab>"),
    androidApkBuilder.includes("loadEnvFile"),
    androidApkBuilder.includes("--env-file <path>"),
    androidApkBuilder.includes("FREED_RELEASE_ENV_FILE"),
    androidApkBuilder.includes("preloadEnvFileForDefaults"),
    androidApkBuilder.includes("releaseEnvFileLoaded"),
    androidApkBuilder.includes("FREED_ANDROID_RELEASE_ARTIFACT"),
    androidApkBuilder.includes("DEFAULT_RELEASE_AAB"),
    androidApkBuilder.includes(":app:bundleRelease"),
    androidApkBuilder.includes("freed-android-release-build-report-v1"),
    androidApkBuilder.includes("android-aab-build"),
    androidApkBuilder.includes("hasHermesRuntime"),
    androidApkBuilder.includes("hasJscRuntime"),
    androidApkBuilder.includes("Android upload signing requires Hermes"),
    androidApkBuilder.includes("!options.requireUploadSigning"),
    androidApkBuilder.includes("--build-idle-timeout-ms"),
    androidApkBuilder.includes("FREED_ANDROID_RELEASE_BUILD_IDLE_TIMEOUT_MS"),
    androidApkBuilder.includes("resetIdleTimeout"),
    androidApkBuilder.includes("Build idle timeout:"),
    androidApkBuilder.includes("function resolveAdMobStatus"),
    androidApkBuilder.includes("android-apk-admob-app-id"),
    androidApkBuilder.includes("production Android AdMob app ID"),
    androidApkBuilder.includes("sampleAppIdUsed"),
    androidApkBuilder.includes("function inspectApkSignature"),
    androidApkBuilder.includes("ANDROID_DEBUG_CERT_SHA256"),
    androidApkBuilder.includes("function inspectUploadKeystore"),
    androidApkBuilder.includes("non-debug upload keystore"),
    androidApkBuilder.includes("uploadKeystore"),
    androidApkBuilder.includes("android-apk-signature"),
    androidApkBuilder.includes("Debug certificate:"),
    androidApkBuilder.includes("forbids JavaScriptCore fallback for Play Console artifacts"),
    verifier.includes("release-readiness-report-v1"),
    verifier.includes("backend-readiness-smoke-v1"),
    verifier.includes("supabase-schema-smoke-v1"),
    verifier.includes("artifactDirPathIssue"),
    verifier.includes("release-env-preflight-report.json"),
    verifier.includes("backend-readiness-smoke-report.json"),
    verifier.includes("supabase-schema-smoke-report.json"),
    verifier.includes("analytics-ingestion-smoke-report.json"),
    verifier.includes("remote-notification-smoke-report.json"),
    verifier.includes("purchase-verification-smoke-report.json"),
    verifier.includes("ai-backend-smoke-report.json"),
    verifier.includes("release-readiness-report.json"),
    verifier.includes("docs/validation/evidence"),
    verifier.includes("loadEnvFile"),
    verifier.includes("envFileAwareScripts"),
    verifier.includes('"build:android-apk:upload-signed"'),
    verifier.includes('"build:android-aab:upload-signed"'),
    verifier.includes("env: releaseEnv.env"),
    verifier.includes("spawnSync"),
    verifier.includes('"audit:smoke-harnesses"'),
    smokeHarnessAudit.includes("env file safety self-test"),
    smokeHarnessAudit.includes('args: ["scripts/lib/env-file-safety.js", "--self-test"]'),
    smokeHarnessAudit.includes("env file loader self-test"),
    smokeHarnessAudit.includes('args: ["scripts/lib/env-file-loader.js", "--self-test"]'),
    smokeHarnessAudit.includes("report path safety self-test"),
    smokeHarnessAudit.includes('args: ["scripts/lib/report-path-safety.js", "--self-test"]'),
    smokeHarnessAudit.includes("release verifier self-test"),
    smokeHarnessAudit.includes('args: ["scripts/release-verify.js", "--self-test"]'),
    smokeHarnessAudit.includes("ios native build check self-test"),
    smokeHarnessAudit.includes('args: ["scripts/ios-native-build-check.js", "--self-test"]'),
    smokeHarnessAudit.includes("ios release archive build self-test"),
    smokeHarnessAudit.includes('args: ["scripts/build-ios-release-archive.js", "--self-test"]'),
    ...requiredScripts.map((script) => verifier.includes(`"${script}"`))
  ];

  return passOrFail(
    "release-verifier-command-sequence",
    checks.every(Boolean),
    "Fail-closed release verifier supports safe --env-file handling with validation evidence/artifact folder rejection, optional safe --artifact-dir sanitized report collection under docs/validation/artifacts/<run-id> with existing-path/symlink rejection, schema/pass-count/fail-count/proof checks, top-level sanitized report-marker checks on every report artifact plus pass result markers for preflight/APK/AAB/iOS archive reports, full release-env preflight check-manifest validation, hosted legal URL availability proof for privacy/support/account-deletion routes, required upload-signed Android APK/AAB and signed iOS Release archive result IDs, required deployed-smoke result IDs including configured AI retention smoke, concrete proof-value checks for Android upload signing, non-debug upload-keystore proof, Play Console readiness, production Android AdMob app-id proof with sample-id rejection, artifact-level APK signature verification with debug-certificate rejection, Hermes engine proof with no JSC fallback for upload-signed Android APKs, packaged Hermes runtime proof with JSC runtime rejection, packaged ABI/bundle/hash/size, local upload-signed AAB build lane using Gradle bundleRelease for Play Console handoff with artifactType/aab proof, iOS App Store Connect export, IPA hash/size, distribution signing, embedded Screen Time/Safari extension, entitlement, no-packet-tunnel, and Safari-rule proof, wall-clock and no-output timeout bounds, endpoint paths, privacy/rejection booleans, timeout bounds, and checked secret-key-name arrays, plus secret-shaped report-value rejection for URL credentials, JWTs, bearer tokens, provider keys, push-token shapes, and local home-profile paths, has executable env-file, report-path, report-validation, signed iOS archive, and bounded iOS native-build helper self-tests in the smoke harness audit, preserves app-level env-file flags through node --, starts with release env preflight, then runs typecheck, core tests, smoke harness self-tests, web export, hosted legal URL audit, Android bundle export, upload-signed Android APK/AAB and signed iOS archive builds, regenerated client bundle audits, backend readiness smoke, Supabase schema smoke, adult-domain feed smoke, analytics ingestion smoke, remote-notification smoke, AI smoke/safety, challenge/classifier/native-parity/accessibility/privacy/runtime-data/backend/performance/dependency audits, evidence requirements, checked artifact privacy, templates, gates, and strict release audit.",
    "Restore scripts/release-verify.js and package.json verify:release so the final release command cannot drift from the runbook."
  );
}

function auditReleaseEnvPreflightHarness(): AuditItem {
  const packageJson = read("package.json");
  const script = has("scripts/release-env-preflight.js") ? read("scripts/release-env-preflight.js") : "";
  const adultFeedSourceContract = has("scripts/lib/adult-domain-feed-source-contract.js")
    ? read("scripts/lib/adult-domain-feed-source-contract.js")
    : "";
  const envFileSafety = has("scripts/lib/env-file-safety.js") ? read("scripts/lib/env-file-safety.js") : "";
  const envFileLoader = has("scripts/lib/env-file-loader.js") ? read("scripts/lib/env-file-loader.js") : "";
  const reportPathSafety = reportPathSafetySource();
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const checks = [
    packageJson.includes('"preflight:release-env"'),
    packageJson.includes("node -- scripts/release-env-preflight.js"),
    verifier.includes('"preflight:release-env"'),
    script.includes("EXPO_PUBLIC_MONETIZATION_MODE"),
    script.includes("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"),
    script.includes("EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_PURCHASE_VERIFY_RESPONSE_MAX_BYTES"),
    script.includes("FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS"),
    script.includes("FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES"),
    script.includes("APP_STORE_SERVER_API_ENV"),
    script.includes("isAppleIssuerId"),
    script.includes("isAppleKeyId"),
    script.includes("isPrivateKeyPem"),
    script.includes("isJwt"),
    script.includes("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"),
    script.includes("isGoogleServiceAccountEmail"),
    script.includes("isGoogleAccessToken"),
    script.includes("androidReleaseSigningIssues"),
    script.includes("android-release-signing"),
    script.includes("FREED_ANDROID_UPLOAD_STORE_FILE"),
    script.includes("FREED_ANDROID_UPLOAD_STORE_PASSWORD"),
    script.includes("FREED_ANDROID_UPLOAD_KEY_ALIAS"),
    script.includes("FREED_ANDROID_UPLOAD_KEY_PASSWORD"),
    script.includes("function inspectAndroidUploadKeystore"),
    script.includes("ANDROID_DEBUG_CERT_SHA256"),
    script.includes("must not use the Android debug keystore certificate"),
    script.includes("EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS"),
    script.includes("EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY"),
    script.includes("admob-request-country"),
    script.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED"),
    script.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENDPOINT"),
    script.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES"),
    script.includes("optional-challenge-weather-context"),
    script.includes("challenge weather endpoint"),
    script.includes("EXPO_PUBLIC_ANALYTICS_ENDPOINT"),
    script.includes("EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES"),
    script.includes("FREED_ANALYTICS_SMOKE_TIMEOUT_MS"),
    script.includes("FREED_ANALYTICS_SUPABASE_TIMEOUT_MS"),
    script.includes("analyticsRuntimeIssues"),
    script.includes("analytics-ingestion-endpoint"),
    script.includes("remote analytics endpoint"),
    script.includes("aggregate analytics API route"),
    script.includes("/api/analytics"),
    script.includes("must not include URL credentials"),
    script.includes("must not include query strings"),
    script.includes("must not include URL fragments"),
    script.includes("EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT"),
    script.includes("EXPO_PUBLIC_BACKEND_READINESS_TIMEOUT_MS"),
    script.includes("backendReadinessEndpointIssues"),
    script.includes("backend readiness derivation source endpoint"),
    script.includes("backend-readiness-endpoint"),
    script.includes("/api/backend/readiness"),
    script.includes("adult-domain-feed-sources"),
    script.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"),
    script.includes("./lib/adult-domain-feed-source-contract"),
    script.includes("parseAdultDomainFeedSourceConfigWithIssues"),
    adultFeedSourceContract.includes("reviewed source family"),
    script.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS"),
    script.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES"),
    script.includes("FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS"),
    script.includes("EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED"),
    script.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES"),
    script.includes("FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS"),
    script.includes("adultDomainFeedRuntimeIssues"),
    script.includes("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT"),
    script.includes("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES"),
    script.includes("optional-recovery-backup-sync-endpoint"),
    script.includes("recovery backup sync endpoint"),
    script.includes("optional-supabase-auth-client"),
    script.includes("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    script.includes("EXPO_PUBLIC_SUPABASE_AUTH_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_SUPABASE_AUTH_RESPONSE_MAX_BYTES"),
    script.includes("baseUrlIssues"),
    script.includes("must be an origin without a path"),
    script.includes("EXPO_PUBLIC_RETENTION_MODE"),
    script.includes("EXPO_PUBLIC_RETENTION_ENDPOINT"),
    script.includes("EXPO_PUBLIC_RETENTION_TIMEOUT_MS"),
    script.includes("optional-retention-endpoint"),
    script.includes("remote retention endpoint"),
    script.includes("checkEndpointWithTimeout"),
    script.includes("EXPO_PUBLIC_AI_COACH_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS"),
    script.includes("supabase-backend-credentials"),
    script.includes("SUPABASE_SERVICE_ROLE_KEY"),
    script.includes("FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS"),
    script.includes("FREED_BACKEND_PROVIDER_TIMEOUT_MS"),
    script.includes("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES"),
    script.includes("isSupabaseServiceRoleKey"),
    script.includes("isMaintenanceSecret"),
    script.includes("redis-backend-infrastructure"),
    script.includes("UPSTASH_REDIS_REST_TOKEN"),
    script.includes("isRedisRestToken"),
    script.includes("remote-notification-provider-credentials"),
    script.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    script.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS"),
    script.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES"),
    script.includes("FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS"),
    script.includes("FIREBASE_PROJECT_ID"),
    script.includes("FIREBASE_SERVICE_ACCOUNT_JSON"),
    script.includes("APNS_ENV=production"),
    script.includes("EXPO_PUBLIC_AI_COACH_MODE"),
    script.includes("EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT"),
    script.includes("FREED_AI_PROVIDER_TIMEOUT_MS"),
    script.includes("FREED_AI_PROVIDER_RESPONSE_MAX_BYTES"),
    script.includes("OPENAI_API_KEY"),
    script.includes("OPENAI_MODEL"),
    script.includes("GEMINI_API_KEY"),
    script.includes("isOpenAiApiKey"),
    script.includes("isGoogleAiApiKey"),
    script.includes("GOOGLE_SAMPLE_ADMOB_PUBLISHER"),
    script.includes("--env-file"),
    script.includes("envFilePathIssue"),
    script.includes("loadEnvFile"),
    script.includes("invalid env file contents"),
    envFileLoader.includes("seenKeys"),
    envFileLoader.includes("repeats"),
    envFileLoader.includes("from line"),
    envFileLoader.includes("export GOOD=again"),
    envFileSafety.includes("docs/validation/evidence"),
    envFileSafety.includes("docs/validation/artifacts"),
    envFileSafety.includes("env file safety self-test: pass"),
    script.includes("release-env-arguments"),
    script.includes("Missing value for --report"),
    script.includes("Unknown option"),
    script.includes("server-secret-public-leakage"),
    script.includes("forbiddenPublicServerSecretIssues"),
    script.includes("FORBIDDEN_PUBLIC_SERVER_SECRET_PREFIXES"),
    script.includes("EXPO_PUBLIC_UPSTASH"),
    script.includes("EXPO_PUBLIC_OPENAI"),
    script.includes("EXPO_PUBLIC_GEMINI"),
    script.includes("EXPO_PUBLIC_APP_STORE_PRIVATE_KEY"),
    script.includes("EXPO_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT"),
    script.includes("EXPO_PUBLIC_REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    script.includes("EXPO_PUBLIC_FCM_ACCESS_TOKEN"),
    script.includes("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    script.includes("EXPO_PUBLIC_APNS"),
    script.includes("--report"),
    script.includes("reportPathIssue"),
    script.includes("assertSafeReportPath"),
    script.includes("sharedReportPathIssue"),
    reportPathSafety.includes("DOCS/VALIDATION/EVIDENCE"),
    reportPathSafety.includes("report path safety self-test: pass"),
    reportPathSafety.includes("docs/validation/evidence"),
    reportPathSafety.includes("docs/validation/artifacts/<run-id>"),
    reportPathSafety.includes("lstatSync"),
    reportPathSafety.includes("must end in .json"),
    reportPathSafety.includes("existing path components"),
    reportPathSafety.includes("symbolic links"),
    reportPathSafety.includes("path must not be a symbolic link"),
    reportPathSafety.includes("must be a local workspace path"),
    reportPathSafety.includes("must stay inside the current workspace"),
    script.includes("freed-release-env-preflight-report-v1"),
    script.includes("./lib/release-blocker-groups"),
    script.includes("buildPreflightBlockerGroups"),
    script.includes("blockerGroups"),
    script.includes("productionBlockerGroups"),
    script.includes("failedPreflightChecks"),
    script.includes("sanitized: true")
  ];

  return passOrFail(
    "release-env-preflight-harness",
    checks.every(Boolean),
    "Release environment preflight fails fast on unsafe env-file/report paths, duplicate or malformed env-file contents, including validation evidence/artifact folder env-file paths, EXPO_PUBLIC_* server-secret leakage, missing production monetization, purchase-verification endpoint configuration and client/provider timeout/response-size bounds, store verification, Android upload signing with keytool-based debug-keystore rejection, AdMob, remote AI configuration plus client/provider timeout/response-size bounds, Supabase/Redis backend secrets and schema smoke timeout/response-size bounds, deployed backend-readiness endpoint configuration and timeout bounds, remote notification dispatch credentials/provider response-size/smoke timeout bounds, adult-domain feed endpoint/source configuration plus source fetch timeout/size bounds, aggregate analytics ingestion endpoint configuration plus client timeout/response-size bounds, malformed optional iOS DNS settings, unsafe enabled challenge-weather endpoints, unsafe non-/api/analytics collectors, unsafe hosted-backup sync endpoints plus sync timeout/response-size bounds, optional Supabase Auth timeout/response-size bounds, unsafe timeout-bounded remote retention endpoints, and sanitized release blocker group summaries before expensive release verification steps.",
    "Restore scripts/release-env-preflight.js and wire npm run preflight:release-env as the first release verification command."
  );
}

function envTemplateIncludesKey(template: string, key: string) {
  return new RegExp(`(?:^|\\n)\\s*#?\\s*${key}=`).test(template);
}

function envTemplateValue(template: string, key: string) {
  const match = template.match(new RegExp(`(?:^|\\n)\\s*${key}=([^\\n]*)`));
  return match ? match[1].trim() : null;
}

function duplicateActiveEnvTemplateKeys(template: string) {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  for (const [index, rawLine] of template.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) continue;

    const key = match[1];
    const firstLine = seen.get(key);
    if (firstLine !== undefined) {
      duplicates.push(`${key} line ${index + 1} repeats line ${firstLine}`);
    } else {
      seen.set(key, index + 1);
    }
  }
  return duplicates;
}

function auditProductionEnvTemplate(): AuditItem {
  const template = has(".env.production.example") ? read(".env.production.example") : "";
  const requiredKeys = [
    "EXPO_PUBLIC_MONETIZATION_MODE",
    "EXPO_PUBLIC_STORE_PROVIDER",
    "EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID",
    "EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT",
    "EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS",
    "EXPO_PUBLIC_PURCHASE_VERIFY_RESPONSE_MAX_BYTES",
    "FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS",
    "FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES",
    "EXPO_PUBLIC_IAP_PRODUCT_YEARLY",
    "EXPO_PUBLIC_IAP_PRODUCT_MONTHLY",
    "EXPO_PUBLIC_IAP_PRODUCT_LIFETIME",
    "APP_STORE_BUNDLE_ID",
    "APP_STORE_SERVER_API_ENV",
    "APP_STORE_ISSUER_ID",
    "APP_STORE_KEY_ID",
    "APP_STORE_PRIVATE_KEY",
    "APP_STORE_PRIVATE_KEY_BASE64",
    "APP_STORE_SERVER_API_JWT",
    "GOOGLE_PLAY_PACKAGE_NAME",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
    "GOOGLE_PLAY_ACCESS_TOKEN",
    "FREED_IOS_DEVELOPMENT_TEAM",
    "FREED_IOS_CODE_SIGN_STYLE",
    "FREED_IOS_CODE_SIGN_IDENTITY",
    "FREED_IOS_PROFILE_SPECIFIER",
    "FREED_IOS_PROVISIONING_PROFILES_JSON",
    "FREED_IOS_ALLOW_PROVISIONING_UPDATES",
    "FREED_REQUIRE_IOS_RELEASE_SIGNING",
    "FREED_ANDROID_UPLOAD_STORE_FILE",
    "FREED_ANDROID_UPLOAD_STORE_PASSWORD",
    "FREED_ANDROID_UPLOAD_KEY_ALIAS",
    "FREED_ANDROID_UPLOAD_KEY_PASSWORD",
    "FREED_REQUIRE_ANDROID_RELEASE_SIGNING",
    "EXPO_PUBLIC_ADMOB_APP_ID_IOS",
    "EXPO_PUBLIC_ADMOB_APP_ID_ANDROID",
    "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS",
    "EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_ANDROID",
    "EXPO_PUBLIC_ADMOB_USE_TEST_ADS",
    "EXPO_PUBLIC_AI_COACH_MODE",
    "EXPO_PUBLIC_AI_COACH_ENDPOINT",
    "EXPO_PUBLIC_AI_COACH_TIMEOUT_MS",
    "EXPO_PUBLIC_AI_CHALLENGE_MODE",
    "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT",
    "EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS",
    "FREED_AI_PROVIDER",
    "FREED_AI_PROVIDER_TIMEOUT_MS",
    "FREED_AI_PROVIDER_RESPONSE_MAX_BYTES",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "GEMINI_API_KEY",
    "GEMINI_MODEL"
  ];
  const optionalDocumentedKeys = [
    "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID",
    "EXPO_PUBLIC_REVENUECAT_API_KEY_IOS",
    "EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID",
    "EXPO_PUBLIC_IAP_PRODUCT_FAMILY",
    "EXPO_PUBLIC_IAP_PRODUCT_ACCOUNTABILITY",
    "EXPO_PUBLIC_IAP_PRODUCT_AI_COACH",
    "EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY",
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL",
    "EXPO_PUBLIC_SUPABASE_AUTH_TIMEOUT_MS",
    "EXPO_PUBLIC_SUPABASE_AUTH_RESPONSE_MAX_BYTES",
    "EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS",
    "EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES",
    "EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED",
    "FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS",
    "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT",
    "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_TIMEOUT_MS",
    "EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES",
    "EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS",
    "EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES",
    "FREED_ANALYTICS_SMOKE_TIMEOUT_MS",
    "EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT",
    "EXPO_PUBLIC_BACKEND_READINESS_TIMEOUT_MS",
    "FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS",
    "FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS",
    "FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES",
    "FREED_ANALYTICS_SUPABASE_TIMEOUT_MS",
    "FREED_BACKEND_PROVIDER_TIMEOUT_MS",
    "FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS",
    "SUPABASE_ANALYTICS_TABLE",
    "SUPABASE_ADULT_FEED_TABLE",
    "SUPABASE_PURCHASE_AUDIT_TABLE",
    "SUPABASE_AI_EVENTS_TABLE",
    "SUPABASE_JOB_RUNS_TABLE",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS",
    "FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES",
    "FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS",
    "FCM_SERVER_KEY",
    "FCM_ACCESS_TOKEN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_SERVICE_ACCOUNT_JSON",
    "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
    "APNS_KEY_ID",
    "APNS_TEAM_ID",
    "APNS_BUNDLE_ID",
    "APNS_PRIVATE_KEY",
    "APNS_PRIVATE_KEY_BASE64"
  ];
  const missing = [...requiredKeys, ...optionalDocumentedKeys].filter((key) => !envTemplateIncludesKey(template, key));
  const duplicateKeys = duplicateActiveEnvTemplateKeys(template);
  const checks = [
    has(".env.production.example"),
    missing.length === 0,
    duplicateKeys.length === 0,
    envTemplateValue(template, "EXPO_PUBLIC_MONETIZATION_MODE") === "native",
    envTemplateValue(template, "EXPO_PUBLIC_STORE_PROVIDER") === "native-iap",
    envTemplateValue(template, "APP_STORE_SERVER_API_ENV") === "production",
    envTemplateValue(template, "FREED_REQUIRE_ANDROID_RELEASE_SIGNING") === "true",
    envTemplateValue(template, "EXPO_PUBLIC_ADMOB_USE_TEST_ADS") === "false",
    envTemplateValue(template, "EXPO_PUBLIC_AI_COACH_MODE") === "remote",
    envTemplateValue(template, "EXPO_PUBLIC_AI_CHALLENGE_MODE") === "remote",
    envTemplateValue(template, "EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED") === "true",
    !template.includes("EXPO_PUBLIC_OPENAI_API_KEY"),
    !template.includes("EXPO_PUBLIC_GEMINI_API_KEY"),
    !template.includes("EXPO_PUBLIC_GOOGLE_API_KEY"),
    !template.includes("EXPO_PUBLIC_GOOGLE_GENAI_API_KEY"),
    !template.includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
    !template.includes("EXPO_PUBLIC_SUPABASE_JWT_SECRET"),
    !template.includes("EXPO_PUBLIC_UPSTASH"),
    !template.includes("EXPO_PUBLIC_REMOTE_NOTIFICATION"),
    !template.includes("EXPO_PUBLIC_FCM"),
    !template.includes("EXPO_PUBLIC_FIREBASE"),
    !template.includes("EXPO_PUBLIC_APNS"),
    !template.includes("EXPO_PUBLIC_APP_STORE_PRIVATE_KEY"),
    !template.includes("EXPO_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT"),
    template.includes("Google sample publisher IDs are rejected")
  ];

  return passOrFail(
    "production-env-template",
    checks.every(Boolean),
    missing.length > 0
      ? `.env.production.example is missing keys: ${missing.join(", ")}.`
      : duplicateKeys.length > 0
        ? `.env.production.example has duplicate active keys: ${duplicateKeys.join(", ")}.`
        : ".env.production.example includes production store, iOS archive signing, Android upload signing, ad, purchase-verification, AI, adult-domain feed, Supabase/Redis backend, notification, and optional fallback keys with safe release defaults and no duplicate active keys.",
    "Update .env.production.example so release candidates start from a complete production env handoff template."
  );
}

function auditValidationEvidenceWorkflow(): AuditItem {
  const packageJson = read("package.json");
  const runner = has("scripts/run-ts-entry.js") ? read("scripts/run-ts-entry.js") : "";
  const requirementsScript = has("scripts/validation-evidence-requirements.js")
    ? read("scripts/validation-evidence-requirements.js")
    : "";
  const scaffold = has("scripts/validation-evidence-scaffold.js") ? read("scripts/validation-evidence-scaffold.js") : "";
  const androidBrowserEvidence = has("scripts/android-real-browser-evidence.js") ? read("scripts/android-real-browser-evidence.js") : "";
  const androidDoomscrollContract = has("scripts/lib/android-doomscroll-contract.js") ? read("scripts/lib/android-doomscroll-contract.js") : "";
  const performanceEvidence = has("scripts/performance-profile-evidence.js") ? read("scripts/performance-profile-evidence.js") : "";
  const evidenceOutputSafety = has("scripts/lib/evidence-output-safety.js") ? read("scripts/lib/evidence-output-safety.js") : "";
  const blockerGroups = has("scripts/lib/release-blocker-groups.js") ? read("scripts/lib/release-blocker-groups.js") : "";
  const promote = has("scripts/validation-evidence-promote.ts") ? read("scripts/validation-evidence-promote.ts") : "";
  const artifactPrivacyAudit = has("scripts/validation-artifact-privacy-audit.js")
    ? read("scripts/validation-artifact-privacy-audit.js")
    : "";
  const templateAudit = has("scripts/validation-template-audit.js") ? read("scripts/validation-template-audit.js") : "";
  const smokeHarnessAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const specs = has("scripts/validation-evidence-specs.json") ? read("scripts/validation-evidence-specs.json") : "";
  const validator = has("scripts/validation-evidence.ts") ? read("scripts/validation-evidence.ts") : "";
  const validationReadme = has("docs/validation/README.md") ? read("docs/validation/README.md") : "";
  const evidenceRunbook = has("docs/validation/evidence-runbook.md") ? read("docs/validation/evidence-runbook.md") : "";
  const tests = read("tests/core.test.ts");
  const topLevelPlatformSanitizedReportIssueCount = (validator.match(/\$\{path\}\.sanitized must be true/g) ?? []).length;
  const checks = [
    packageJson.includes('"evidence:requirements"'),
    packageJson.includes('"evidence:scaffold"'),
    packageJson.includes('"evidence:validation:draft"'),
    packageJson.includes('"evidence:promote"'),
    packageJson.includes('"evidence:artifact-privacy"'),
    packageJson.includes('"evidence:ios-physical-device"'),
    packageJson.includes('"evidence:android-real-browser"'),
    packageJson.includes('"evidence:normal-browsing-corpus"'),
    packageJson.includes('"evidence:performance-profile"'),
    packageJson.includes('"evidence:store-ad-sandbox"'),
    packageJson.includes('"evidence:ai-backend-smoke"'),
    packageJson.includes('"esbuild"'),
    packageJson.includes("node -- scripts/run-ts-entry.js scripts/validation-evidence.ts"),
    packageJson.includes("node -- scripts/run-ts-entry.js scripts/validation-evidence-promote.ts"),
    packageJson.includes("scripts/validation-evidence-promote.ts"),
    has("scripts/validation-evidence-specs.json"),
    has("scripts/run-ts-entry.js"),
    runner.includes('process.env.ESBUILD_WORKER_THREADS ||= "0"'),
    runner.includes("esbuild.stop()"),
    has("scripts/validation-evidence-requirements.js"),
    has("scripts/validation-evidence-scaffold.js"),
    has("scripts/validation-evidence-promote.ts"),
    has("scripts/validation-artifact-privacy-audit.js"),
    has("scripts/validation-template-audit.js"),
    has("scripts/lib/validation-requirements-schema.js"),
    validator.includes("collectLocalHomePathIssues"),
    validator.includes("must not contain local home-profile paths"),
    requirementsScript.includes("VALIDATION_REQUIREMENTS_SCHEMA_VERSION"),
    requirementsScript.includes("schemaVersion"),
    requirementsScript.includes("generatedAt"),
    requirementsScript.includes("reportArtifactCommands"),
    requirementsScript.includes("reportArtifactCommandList"),
    requirementsScript.includes("handoffDocuments"),
    requirementsScript.includes("handoffDocumentCommands"),
    requirementsScript.includes("handoffDocumentCommandList"),
    requirementsScript.includes("finalVerificationCommand"),
    requirementsScript.includes("productionEnvChecklist"),
    scaffold.includes("reportArtifactCommands"),
    scaffold.includes("reportArtifactCommandList"),
    scaffold.includes("VALIDATION_REQUIREMENTS_SCHEMA_VERSION"),
    scaffold.includes("schemaVersion"),
    scaffold.includes("handoffDocuments"),
    scaffold.includes("handoffDocumentCommands"),
    scaffold.includes("handoffDocumentCommandList"),
    scaffold.includes("productionEnvChecklist"),
    scaffold.includes("## Canonical Handoff Commands"),
    scaffold.includes("These commands are generated from the same shared source"),
    scaffold.includes("captureHelperCommandMap"),
    templateAudit.includes("reportArtifactCommandList"),
    templateAudit.includes("captureHelperCommandMap"),
    templateAudit.includes("handoffDocumentPaths"),
    templateAudit.includes("handoffDocumentCommandList"),
    templateAudit.includes("VALIDATION_REQUIREMENTS_SCHEMA_VERSION"),
    templateAudit.includes("requirements.json schemaVersion"),
    templateAudit.includes("requirements.json generatedAt"),
    templateAudit.includes("productionEnvChecklist"),
    templateAudit.includes("requirements.json productionEnvChecklist"),
    templateAudit.includes("expectedHandoffDocChecklistPhrases"),
    templateAudit.includes("privateEvidenceWarning"),
    templateAudit.includes("canonical handoff commands section"),
    templateAudit.includes("expectedHandoffCommandsForPackage"),
    artifactPrivacyAudit.includes("checked-artifact-local-paths"),
    artifactPrivacyAudit.includes("checked-artifact-apple-device-names"),
    artifactPrivacyAudit.includes("rawCoreDeviceHostPattern"),
    artifactPrivacyAudit.includes("hasLocalHomePath"),
    artifactPrivacyAudit.includes("./lib/local-path-privacy"),
    artifactPrivacyAudit.includes("sanitizeLocalHomePaths"),
    has("scripts/lib/png-screenshot-audit.js"),
    has("scripts/lib/android-doomscroll-contract.js"),
    has("scripts/lib/short-form-web-contract.js"),
    has("scripts/lib/adult-domain-feed-source-contract.js"),
    has("scripts/lib/evidence-target-safety.js"),
    has("scripts/lib/evidence-output-safety.js"),
    evidenceOutputSafety.includes("docs/validation/artifacts/<run-id>"),
    evidenceOutputSafety.includes("must be under docs/validation/artifacts/<run-id>"),
    evidenceOutputSafety.includes("must stay inside the current workspace"),
    has("scripts/lib/env-file-loader.js"),
    has("scripts/lib/release-blocker-groups.js"),
    blockerGroups.includes("productionBlockerGroups"),
    blockerGroups.includes("runIdForArtifactRoot"),
    blockerGroups.includes("reportArtifactCommands"),
    blockerGroups.includes("reportArtifactCommandList"),
    blockerGroups.includes("captureHelperCommandMap"),
    blockerGroups.includes("handoffDocumentPaths"),
    blockerGroups.includes("handoffDocumentCommandList"),
    blockerGroups.includes("productionEnvChecklist"),
    blockerGroups.includes("docs/validation/artifacts"),
    blockerGroups.includes("production-backend-infrastructure"),
    blockerGroups.includes("androidApkBuild"),
    blockerGroups.includes("androidAabBuild"),
    blockerGroups.includes("iosArchiveBuild"),
    blockerGroups.includes("android-apk-build-report.json"),
    blockerGroups.includes("android-aab-build-report.json"),
    blockerGroups.includes("ios-release-archive-report.json"),
    blockerGroups.includes("backend-readiness-smoke-report.json"),
    blockerGroups.includes("supabase-schema-smoke-report.json"),
    blockerGroups.includes("adult-domain-feed-smoke-report.json"),
    blockerGroups.includes("analytics-ingestion-smoke-report.json"),
    blockerGroups.includes("remote-notification-smoke-report.json"),
    blockerGroups.includes("purchase-verification-smoke-report.json"),
    blockerGroups.includes("ai-backend-smoke-report.json"),
    blockerGroups.includes("release-readiness-report.json"),
    blockerGroups.includes("production-monetization"),
    blockerGroups.includes("production-android-signing"),
    blockerGroups.includes("ios-physical-device-validation"),
    blockerGroups.includes("npm run qa:android-install"),
    requirementsScript.includes("productionBlockerGroups"),
    scaffold.includes("productionBlockerGroups"),
    templateAudit.includes("productionBlockerGroups"),
    has("scripts/ios-physical-device-evidence.js"),
    has("scripts/android-real-browser-evidence.js"),
    androidBrowserEvidence.includes("assertSafeArtifactOutputDir"),
    androidBrowserEvidence.includes("--app-scenario"),
    androidBrowserEvidence.includes("--scenario <none|allowed|adult|focused-search|synced-feed|both|all>"),
    androidBrowserEvidence.includes("--focused-search-query"),
    androidBrowserEvidence.includes("focused-browser-search"),
    androidBrowserEvidence.includes("focusedSearchProof"),
    androidBrowserEvidence.includes("--adult-domain-feed-host"),
    androidBrowserEvidence.includes("synced-adult-domain-feed"),
    androidBrowserEvidence.includes("adultDomainFeedProof"),
    androidBrowserEvidence.includes("android.adultDomainFeedAccessibilityArtifact"),
    androidBrowserEvidence.includes("--dns-guard-proof"),
    androidBrowserEvidence.includes("--dns-guard-host"),
    androidBrowserEvidence.includes("--dns-guard-visible-wait-ms"),
    androidBrowserEvidence.includes("captureDnsGuardProof"),
    androidBrowserEvidence.includes("dnsGuardProof"),
    androidBrowserEvidence.includes("android.dnsGuardBlockArtifact"),
    androidBrowserEvidence.includes("android.dnsGuardInterventionVisible=true"),
    androidBrowserEvidence.includes("visibleInterventionProof"),
    androidBrowserEvidence.includes("dnsGuardVisibleInterventionSignals"),
    androidBrowserEvidence.includes("android-real-browser-evidence-fill-template.json"),
    androidBrowserEvidence.includes("buildEvidenceFillTemplate"),
    androidBrowserEvidence.includes("android.installQaRunId"),
    androidBrowserEvidence.includes("freed-android-install-qa-report-v1"),
    androidBrowserEvidence.includes("android.dnsGuardLifecycleArtifact"),
    androidBrowserEvidence.includes("android.dnsGuardSessionQueries"),
    androidBrowserEvidence.includes("android.dnsGuardBlockedQueries"),
    androidBrowserEvidence.includes("android.dnsGuardAllowedQueries"),
    androidBrowserEvidence.includes("android.dnsGuardServfailResponses"),
    androidBrowserEvidence.includes("android.dnsGuardMalformedPackets"),
    androidBrowserEvidence.includes("parseDnsGuardLifecycleCounters"),
    androidBrowserEvidence.includes("parsedDnsGuardCounters"),
    androidBrowserEvidence.includes("android.adultDomainFeedDnsGuardArtifact"),
    androidBrowserEvidence.includes("--dns-guard-restart-proof"),
    androidBrowserEvidence.includes("captureDnsGuardRestartProof"),
    androidBrowserEvidence.includes("dnsGuardRestartProof"),
    androidBrowserEvidence.includes("android.dnsGuardRestartRunId"),
    androidBrowserEvidence.includes("android.dnsGuardRestartNoSilentPromptConfirmed"),
    androidBrowserEvidence.includes("--permission-proof"),
    androidBrowserEvidence.includes("capturePermissionProof"),
    androidBrowserEvidence.includes("freed-android-permission-report-v1"),
    androidBrowserEvidence.includes("android-accessibility-permission-report.json"),
    androidBrowserEvidence.includes("android-usage-access-permission-report.json"),
    androidBrowserEvidence.includes("android-notification-permission-report.json"),
    androidBrowserEvidence.includes("androidUsageAccessManualTogglePath"),
    androidBrowserEvidence.includes("noSilentUsageAccessGrant"),
    androidBrowserEvidence.includes("noPackageSpecificUsageAccessDeepLinkClaim"),
    androidBrowserEvidence.includes("notificationRuntimePromptShown"),
    androidBrowserEvidence.includes("notificationSettingsFallbackOpenedIfDenied"),
    androidBrowserEvidence.includes("android.accessibilityPermissionArtifact"),
    androidBrowserEvidence.includes("android.usageAccessPermissionArtifact"),
    androidBrowserEvidence.includes("android.notificationPermissionArtifact"),
    androidBrowserEvidence.includes("android.usageStatsObservedPackages"),
    androidBrowserEvidence.includes("androidPermissionWizardProof"),
    androidBrowserEvidence.includes("android.permissionWizardArtifact"),
    androidBrowserEvidence.includes("freed-permission-wizard-report-v1"),
    androidBrowserEvidence.includes("android.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy"),
    androidBrowserEvidence.includes("android.permissionWizardTestProtectionPassed=true"),
    androidBrowserEvidence.includes("--native-status-proof"),
    androidBrowserEvidence.includes("captureNativeStatusProof"),
    androidBrowserEvidence.includes("android-native-status.png"),
    androidBrowserEvidence.includes("android-native-status-text.txt"),
    androidBrowserEvidence.includes("android-dns-guard-lifecycle-report.json"),
    androidBrowserEvidence.includes("freed-android-app-intervention-report-v1"),
    androidBrowserEvidence.includes("freed-android-earned-unlock-report-v1"),
    androidBrowserEvidence.includes("freed-android-browser-earned-unlock-report-v1"),
    androidBrowserEvidence.includes("freed-android-browser-intercept-report-v1"),
    androidBrowserEvidence.includes("freed-dns-guard-block-report-v1"),
    androidBrowserEvidence.includes("freed-dns-guard-lifecycle-report-v1"),
    androidBrowserEvidence.includes("freed-dns-guard-restart-report-v1"),
    androidBrowserEvidence.includes("dns-guard-restart-started-report.json"),
    androidBrowserEvidence.includes("dns-guard-restart-skipped-report.json"),
    androidBrowserEvidence.includes("android.adultDomainFeedStatusArtifact"),
    androidBrowserEvidence.includes("freed-android-adult-domain-feed-status-report-v1"),
    androidBrowserEvidence.includes("android-adult-domain-feed-status-report.json"),
    androidBrowserEvidence.includes("syncedAdultDomainFeedUsed"),
    androidBrowserEvidence.includes("--focused-webview-proof"),
    androidBrowserEvidence.includes("captureFocusedWebViewProof"),
    androidBrowserEvidence.includes("android.focusedWebViewPackage"),
    androidBrowserEvidence.includes("android.focusedWebViewArtifact"),
    androidBrowserEvidence.includes("./lib/android-doomscroll-contract"),
    androidBrowserEvidence.includes("shortFormReleaseProfile"),
    !androidBrowserEvidence.includes("const SHORT_FORM_RELEASE_PROFILES = {"),
    androidDoomscrollContract.includes("SHORT_FORM_RELEASE_PROFILES"),
    androidDoomscrollContract.includes("DEFAULT_SHORT_FORM_PACKAGE"),
    androidDoomscrollContract.includes("YOUTUBE_SHORTS_RULE"),
    androidDoomscrollContract.includes("INSTAGRAM_REELS_RULE"),
    androidDoomscrollContract.includes("TIKTOK_FEED_RULE"),
    androidBrowserEvidence.includes("android.shortFormInterventionId"),
    androidBrowserEvidence.includes("android.shortFormUsageBeforeLimitMinutes"),
    androidBrowserEvidence.includes("android.shortFormSelectedSurfaceArtifact"),
    androidBrowserEvidence.includes("freed-short-form-surface-report-v1"),
    androidBrowserEvidence.includes("Accessibility node-tree confirmation without screenshot/frame analysis"),
    androidBrowserEvidence.includes("android.shortFormSelectedSurfaceVerified"),
    androidBrowserEvidence.includes("android.instagramReelsArtifact"),
    androidBrowserEvidence.includes("android.instagramReelsInterventionId"),
    androidBrowserEvidence.includes("android.instagramReelsUsageBeforeLimitMinutes"),
    androidBrowserEvidence.includes("android.instagramReelsSelectedSurfaceArtifact"),
    androidBrowserEvidence.includes("android.instagramReelsSelectedSurfaceVerified"),
    androidBrowserEvidence.includes("android.tiktokFeedArtifact"),
    androidBrowserEvidence.includes("android.tiktokFeedInterventionId"),
    androidBrowserEvidence.includes("android.tiktokFeedUsageBeforeLimitMinutes"),
    androidBrowserEvidence.includes("android.tiktokFeedSelectedSurfaceArtifact"),
    androidBrowserEvidence.includes("android.tiktokFeedSelectedSurfaceVerified"),
    androidBrowserEvidence.includes("configured-app:<package>"),
    androidBrowserEvidence.includes("--play-policy-proof"),
    androidBrowserEvidence.includes("capturePlayPolicyProof"),
    androidBrowserEvidence.includes("freed-android-play-policy-report-v1"),
    androidBrowserEvidence.includes("playPolicyProofUsableForManualEvidence"),
    androidBrowserEvidence.includes("android.playPolicyAccessibilityReviewId"),
    androidBrowserEvidence.includes("--back-stack-check"),
    androidBrowserEvidence.includes("captureBackStackCheck"),
    androidBrowserEvidence.includes("android.backStackCleanupArtifact"),
    androidBrowserEvidence.includes("--tool-timeout-ms"),
    androidBrowserEvidence.includes("FREED_ANDROID_REAL_BROWSER_TOOL_TIMEOUT_MS"),
    androidBrowserEvidence.includes("timed out after ${options.timeoutMs}ms"),
    androidBrowserEvidence.includes("activeDeviceToolTimeoutMs"),
    androidBrowserEvidence.includes("android.focusedBrowserSearchRedactedHost=focused-search.app.freed.local"),
    androidBrowserEvidence.includes("android.focusedBrowserSearchRawQueryStored=false"),
    androidBrowserEvidence.includes("configured-app-shield"),
    androidBrowserEvidence.includes("earned-unlock-app-allow"),
    androidBrowserEvidence.includes("androidChallengeVerificationProof"),
    androidBrowserEvidence.includes("android.challengePhotoClassifier=ML Kit"),
    androidBrowserEvidence.includes("android.challengePhotoNoBase64OrExif=true"),
    androidBrowserEvidence.includes("android.challengePhotoTemporaryFileDeleted=true"),
    androidBrowserEvidence.includes("android.challengeLocationBestAccuracyMeters<=80"),
    androidBrowserEvidence.includes("assertUsefulScreenshot"),
    androidBrowserEvidence.includes("screenshotAnalysis"),
    androidBrowserEvidence.includes("safeExternalHost"),
    androidBrowserEvidence.includes("safeExternalHttpsUrl"),
    read("scripts/ios-physical-device-evidence.js").includes("assertSafeArtifactOutputDir"),
    read("scripts/ios-physical-device-evidence.js").includes("safeExternalHost"),
    read("scripts/ios-physical-device-evidence.js").includes("safeExternalHttpsUrl"),
    read("scripts/ios-physical-device-evidence.js").includes("--tool-timeout-ms"),
    read("scripts/ios-physical-device-evidence.js").includes("FREED_IOS_PHYSICAL_TOOL_TIMEOUT_MS"),
    read("scripts/ios-physical-device-evidence.js").includes("timed out after ${options.timeoutMs}ms"),
    read("scripts/ios-physical-device-evidence.js").includes("inspectAppPackage"),
    read("scripts/ios-physical-device-evidence.js").includes("ios-app-package-proof.json"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-ios-app-package-proof-v1"),
    read("scripts/ios-physical-device-evidence.js").includes("ios-physical-device-evidence-fill-template.json"),
    read("scripts/ios-physical-device-evidence.js").includes("buildEvidenceFillTemplate"),
    read("scripts/ios-physical-device-evidence.js").includes("pending-manual-qa"),
    read("scripts/ios-physical-device-evidence.js").includes("FREEDSafariContentBlocker.appex"),
    read("scripts/ios-physical-device-evidence.js").includes("FREEDSafariFocusShield.appex"),
    read("scripts/ios-physical-device-evidence.js").includes("inspectSafariFocusShieldResources"),
    read("scripts/ios-physical-device-evidence.js").includes("com.apple.developer.family-controls"),
    read("scripts/ios-physical-device-evidence.js").includes("packageProofUsableForManualEvidence"),
    read("scripts/ios-physical-device-evidence.js").includes("inspectSafariContentBlockerRules"),
    read("scripts/ios-physical-device-evidence.js").includes("safariRuleFailures"),
    read("scripts/ios-physical-device-evidence.js").includes("youtube-shorts-web"),
    read("scripts/ios-physical-device-evidence.js").includes("instagram-reels-web"),
    read("scripts/ios-physical-device-evidence.js").includes("tiktok-for-you-web"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.permissionWizardArtifact"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-permission-wizard-report-v1"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.permissionWizardTestProtectionPassed=true"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.familyControlsEntitlementTeamId"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.familyControlsStatus=approved"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.appGroupProvisioningProfileId"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.selectedTokenCounts>0"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.selectedAppDailyLimitMinutes="),
    read("scripts/ios-physical-device-evidence.js").includes("ios.safariContentBlockerEmbedded=true"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.safariContentBlockerIdentifier=app.freed.recovery.safari-content-blocker"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.safariContentBlockerChecksum=fnv1a32:<8-hex>"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.safariContentBlockerEnabled=true"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-ios-safari-content-blocker-report-v1"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.earnedUnlockSourceHost=screen-time-shield.freed.local"),
    read("scripts/ios-physical-device-evidence.js").includes("earnedUnlockRejectsNonScreenTimeSource"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.earnedUnlockRejectedSourceHost="),
    read("scripts/ios-physical-device-evidence.js").includes("ios.earnedUnlockRejectedSelectedShieldsStayedActive=true"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.earnedUnlockRejectedAdultFilterStillActive=true"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.normalBrowsingAllowedUrl="),
    read("scripts/ios-physical-device-evidence.js").includes("ios.adultInterceptedHost="),
    read("scripts/ios-physical-device-evidence.js").includes("challengePhotoVerifiedOnDevice"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.challengePhotoClassifier=Vision"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.challengePhotoNoBase64OrExif=true"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.challengePhotoTemporaryFileDeleted=true"),
    read("scripts/ios-physical-device-evidence.js").includes("ios.challengeLocationBestAccuracyMeters<=80"),
    read("scripts/performance-profile-evidence.js").includes("assertSafeArtifactOutputDir"),
    read("scripts/performance-profile-evidence.js").includes("safeExternalHttpsUrl"),
    read("scripts/performance-profile-evidence.js").includes("--tool-timeout-ms"),
    read("scripts/performance-profile-evidence.js").includes("FREED_PERFORMANCE_DEVICE_TOOL_TIMEOUT_MS"),
    read("scripts/performance-profile-evidence.js").includes("timed out after ${options.timeoutMs}ms"),
    performanceEvidence.includes("UNSAFE_PROTECTION_MODE_TERMS"),
    performanceEvidence.includes("not full VPN, full traffic proxying, packet inspection, or MITM HTTPS"),
    read("scripts/performance-profile-evidence.js").includes("--android-background-cpu-proof"),
    read("scripts/performance-profile-evidence.js").includes("parseCpuPercentFromDumpsys"),
    read("scripts/performance-profile-evidence.js").includes("android-background-cpu-proof.txt"),
    read("scripts/performance-profile-evidence.js").includes("noPacketInspectionConfirmed"),
    read("scripts/performance-profile-evidence.js").includes("noMitmHttpsConfirmed"),
    read("scripts/performance-profile-evidence.js").includes("noContinuousScreenshotOrOcrConfirmed"),
    read("scripts/performance-profile-evidence.js").includes("noContinuousImageClassificationConfirmed"),
    read("scripts/performance-profile-evidence.js").includes("freed-routing-proof-report-v1"),
    read("scripts/performance-profile-evidence.js").includes("android-routing-proof-report.json"),
    read("scripts/performance-profile-evidence.js").includes("networkSpeedArtifact"),
    read("scripts/performance-profile-evidence.js").includes("dnsLatencyArtifact"),
    read("scripts/performance-profile-evidence.js").includes("performance-profile-evidence-fill-template.json"),
    read("scripts/performance-profile-evidence.js").includes("buildEvidenceFillTemplate"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-challenge-photo-report-v1"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-challenge-motion-report-v1"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-challenge-steps-report-v1"),
    read("scripts/ios-physical-device-evidence.js").includes("freed-challenge-location-report-v1"),
    read("scripts/android-real-browser-evidence.js").includes("freed-challenge-photo-report-v1"),
    read("scripts/android-real-browser-evidence.js").includes("freed-challenge-motion-report-v1"),
    read("scripts/android-real-browser-evidence.js").includes("freed-challenge-steps-report-v1"),
    read("scripts/android-real-browser-evidence.js").includes("freed-challenge-location-report-v1"),
    has("scripts/normal-browsing-corpus-evidence.js"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("assertSafeArtifactOutputDir"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("safeExternalHttpsUrl"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("staticClassifierRowsAreManualBrowserTargets"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("buildBrowserSummaryRows"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("buildBrowserReportTemplate"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("browser-report-templates"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("buildBrowserChecklist"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("normal-browsing-browser-checklist.md"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("normal-browsing-browser-summary.template.json"),
    read("scripts/normal-browsing-corpus-evidence.js").includes("normal-browsing-evidence-fill-template.json"),
    has("scripts/performance-profile-evidence.js"),
    has("scripts/store-ad-sandbox-evidence.js"),
    read("scripts/store-ad-sandbox-evidence.js").includes("assertSafeArtifactOutputDir"),
    read("scripts/store-ad-sandbox-evidence.js").includes("safeExternalHttpsEndpoint"),
    read("scripts/store-ad-sandbox-evidence.js").includes("URL credentials"),
    read("scripts/store-ad-sandbox-evidence.js").includes("query strings"),
    read("scripts/store-ad-sandbox-evidence.js").includes("URL fragments"),
    read("scripts/store-ad-sandbox-evidence.js").includes("PURCHASE_VERIFY_ENDPOINT_PATH"),
    read("scripts/store-ad-sandbox-evidence.js").includes("/api/purchases/verify"),
    read("scripts/store-ad-sandbox-evidence.js").includes("validateRewardedAdUnitId"),
    read("scripts/store-ad-sandbox-evidence.js").includes("GOOGLE_SAMPLE_ADMOB_PUBLISHER"),
    read("scripts/store-ad-sandbox-evidence.js").includes("production-format AdMob rewarded unit id"),
    read("scripts/store-ad-sandbox-evidence.js").includes("Google sample publisher id"),
    read("scripts/store-ad-sandbox-evidence.js").includes("loadEnvFile"),
    read("scripts/store-ad-sandbox-evidence.js").includes("--release-env-file line 4 repeats GOOD from line 1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("applyReleaseEnv"),
    read("scripts/store-ad-sandbox-evidence.js").includes("releaseEnvFileLoaded"),
    read("scripts/store-ad-sandbox-evidence.js").includes("store-ad-sandbox-evidence-fill-template.json"),
    read("scripts/store-ad-sandbox-evidence.js").includes("paywall-launch-scope-report.template.json"),
    read("scripts/store-ad-sandbox-evidence.js").includes("freed-paywall-launch-scope-report-v1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("store-console-product-setup-report.template.json"),
    read("scripts/store-ad-sandbox-evidence.js").includes("freed-store-console-product-setup-report-v1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("rewarded-ad-request-report.template.json"),
    read("scripts/store-ad-sandbox-evidence.js").includes("freed-rewarded-ad-request-report-v1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("store-intervention-flow-report.templates.json"),
    read("scripts/store-ad-sandbox-evidence.js").includes("freed-store-intervention-flow-report-v1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("store-privacy-disclosure-report.template.json"),
    read("scripts/store-ad-sandbox-evidence.js").includes("freed-store-privacy-disclosure-report-v1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("STORE_CONSOLE_PAYMENT_HANDOFF.md"),
    read("scripts/store-ad-sandbox-evidence.js").includes("STORE_SANDBOX_TEST_PLAN.md"),
    read("scripts/store-ad-sandbox-evidence.js").includes("buildConsolePaymentHandoff"),
    read("scripts/store-ad-sandbox-evidence.js").includes("buildStoreSandboxTestPlan"),
    read("scripts/store-ad-sandbox-evidence.js").includes("Core 3 Launch Products"),
    read("scripts/store-ad-sandbox-evidence.js").includes("Core 3 Sandbox Matrix"),
    read("scripts/store-ad-sandbox-evidence.js").includes("Future SKUs Inactive"),
    read("scripts/store-ad-sandbox-evidence.js").includes("purchase-verification-smoke-v1"),
    read("scripts/store-ad-sandbox-evidence.js").includes("Do not submit production"),
    has("scripts/ai-backend-smoke-evidence.js"),
    read("scripts/ai-backend-smoke-evidence.js").includes("assertSafeArtifactOutputDir"),
    read("scripts/ai-backend-smoke-evidence.js").includes("safeExternalHttpsEndpoint"),
    read("scripts/ai-backend-smoke-evidence.js").includes("URL credentials"),
    read("scripts/ai-backend-smoke-evidence.js").includes("query strings"),
    read("scripts/ai-backend-smoke-evidence.js").includes("URL fragments"),
    read("scripts/ai-backend-smoke-evidence.js").includes("AI_ENDPOINT_PATHS"),
    read("scripts/ai-backend-smoke-evidence.js").includes("/api/clara"),
    read("scripts/ai-backend-smoke-evidence.js").includes("/api/challenges"),
    read("scripts/ai-backend-smoke-evidence.js").includes("/api/retention"),
    read("scripts/ai-backend-smoke-evidence.js").includes("loadEnvFile"),
	    read("scripts/ai-backend-smoke-evidence.js").includes("--release-env-file line 4 repeats GOOD from line 1"),
	    read("scripts/ai-backend-smoke-evidence.js").includes("applyReleaseEnv"),
	    read("scripts/ai-backend-smoke-evidence.js").includes("releaseEnvFileLoaded"),
	    read("scripts/ai-backend-smoke-evidence.js").includes("ai-backend-smoke-evidence-fill-template.json"),
	    read("scripts/ai-backend-smoke-evidence.js").includes("--retention-endpoint"),
	    read("scripts/ai-backend-smoke-evidence.js").includes("retentionAggregateOnlyVerified"),
	    read("scripts/ai-backend-smoke-evidence.js").includes('"latitude"'),
	    read("scripts/ai-backend-smoke-evidence.js").includes('"preciseLocation"'),
    smokeHarnessAudit.includes("ios physical-device evidence harness"),
    smokeHarnessAudit.includes("png screenshot analyzer"),
    smokeHarnessAudit.includes("evidence target safety"),
    smokeHarnessAudit.includes("evidence output safety"),
    smokeHarnessAudit.includes("env file safety"),
    smokeHarnessAudit.includes("report path safety"),
    smokeHarnessAudit.includes("android real-browser evidence harness"),
    smokeHarnessAudit.includes("normal-browsing corpus evidence harness"),
    smokeHarnessAudit.includes("performance profile evidence harness"),
    smokeHarnessAudit.includes("store/ad sandbox evidence harness"),
    smokeHarnessAudit.includes("AdMob console readiness self-test"),
    smokeHarnessAudit.includes("ai backend smoke evidence harness"),
    templateAudit.includes("validateNormalBrowsingTemplate"),
    templateAudit.includes("validateIosPhysicalDeviceTemplate"),
    templateAudit.includes("validateAndroidRealBrowserTemplate"),
    templateAudit.includes("dnsGuardRestartRunId"),
    templateAudit.includes("validateStoreAdTemplate"),
    templateAudit.includes("validateAiBackendTemplate"),
    templateAudit.includes("classifierCorpusCaseCount"),
    templateAudit.includes("iOS physical-device field examples"),
    templateAudit.includes("Android real-browser field examples"),
    templateAudit.includes("earnedUnlockRelockRunId"),
    templateAudit.includes("earnedUnlockActivityName"),
    templateAudit.includes("earnedUnlockSelectedTokenCount"),
    templateAudit.includes("earnedUnlockAdultFilterStillActive"),
    templateAudit.includes("earnedUnlockSourceHost"),
    templateAudit.includes("earnedUnlockRejectedSourceRunId"),
    templateAudit.includes("earnedUnlockRejectedSelectedShieldsStayedActive"),
    templateAudit.includes("store/ad sandbox field examples"),
    templateAudit.includes("AI backend smoke field examples"),
    templateAudit.includes("normal-browsing corpus examples aligned to the current classifier corpus"),
    specs.includes("requiredFields"),
    specs.includes("requiredCommands"),
    specs.includes("evidence[] local artifact or production-safe HTTPS QA/report URL"),
    specs.includes("ios.isPhysicalDevice=true"),
    specs.includes("ios.familyControlsEntitlementTeamId"),
    specs.includes("ios.familyControlsEntitlementArtifact"),
    specs.includes("ios.familyControlsEntitlementArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true"),
    specs.includes("ios.appGroupProvisioningArtifact"),
    specs.includes("ios.appGroupProvisioningArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true"),
    specs.includes("ios.completeDataProtectionEntitlementArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true"),
    specs.includes("ios.familyControlsAuthorizationRunId"),
    specs.includes("ios.familyControlsAuthorizationArtifact"),
    specs.includes("ios.appLimitScheduled=true"),
    specs.includes("ios.selectedAppDailyLimitMinutes between 5 and 240"),
    specs.includes("ios.selectedAppDailyLimitActivityName=freed.selectedAppDailyLimit"),
    specs.includes("ios.selectedAppDailyLimitEventName=freed.selectedAppDailyLimitReached"),
    specs.includes("ios.selectedAppDailyLimitReachedToday=true"),
    specs.includes("ios.selectedAppDailyLimitReachedDate yyyy-MM-dd"),
    specs.includes("ios.selectedAppDailyLimitRunId"),
    specs.includes("ios.selectedAppDailyLimitArtifact"),
    specs.includes("ios.selectedAppDailyLimitArtifact local freed-ios-screen-time-app-limit-report-v1 JSON with sanitized=true"),
    specs.includes("safariContentBlockerReloaded"),
    specs.includes("safariContentBlockerAdultBlock"),
    specs.includes("safariFocusShieldShortFormBlock"),
    specs.includes("safariShortFormChallengeHandoff"),
    specs.includes("ios.safariContentBlockerEmbedded=true"),
    specs.includes("ios.safariContentBlockerIdentifier=app.freed.recovery.safari-content-blocker"),
    specs.includes("ios.safariContentBlockerBuildRunId"),
    specs.includes("ios.safariContentBlockerBuildArtifact"),
    specs.includes("ios.safariContentBlockerBuildArtifact local freed-ios-app-package-proof-v1 JSON with sanitized=true"),
    specs.includes("ios.safariContentBlockerReloadRunId"),
    specs.includes("ios.safariContentBlockerReloadArtifact"),
    specs.includes("ios.safariContentBlockerReloadArtifact local freed-ios-safari-content-blocker-report-v1 JSON with sanitized=true"),
    specs.includes("ios.safariContentBlockerChecksum fnv1a32:<8-hex>"),
    specs.includes("ios.safariContentBlockerRuleCount>=1"),
    specs.includes("ios.safariContentBlockerAdultBlockRunId"),
    specs.includes("ios.safariContentBlockerAdultBlockArtifact"),
    specs.includes("ios.safariContentBlockerAdultBlockArtifact local freed-ios-safari-content-blocker-report-v1 JSON with sanitized=true"),
    specs.includes("ios.safariFocusShieldEmbedded=true"),
    specs.includes("ios.safariFocusShieldIdentifier=app.freed.recovery.safari-focus-shield"),
    specs.includes("ios.safariFocusShieldBuildRunId"),
    specs.includes("ios.safariFocusShieldBuildArtifact"),
    specs.includes("ios.safariFocusShieldShortFormUrl"),
    specs.includes("ios.safariFocusShieldShortFormBlockRunId"),
    specs.includes("ios.safariFocusShieldShortFormBlockArtifact"),
    specs.includes("ios.safariFocusShieldShortFormBlockArtifact local freed-ios-safari-focus-shield-report-v1 JSON with sanitized=true"),
    specs.includes("ios.safariShortFormChallengeHandoffSource=ios-safari-short-form"),
    specs.includes("ios.safariShortFormChallengeHandoffRawPathStored=false"),
    specs.includes("ios.safariShortFormChallengeHandoffNativeUnlockActive=false"),
    specs.includes("earnedUnlockAllowsSelectedApps"),
    specs.includes("earnedUnlockRejectsNonScreenTimeSource"),
    specs.includes("ios.earnedUnlockAppAllowRunId"),
    specs.includes("ios.earnedUnlockAppAllowArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true"),
    specs.includes("ios.earnedUnlockRelockArtifact"),
    specs.includes("ios.earnedUnlockRelockArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true"),
    specs.includes("ios.earnedUnlockDurationMinutes between 1 and 120"),
    specs.includes("ios.earnedUnlockActivityName=freed.earnedUnlockWindow"),
    specs.includes("ios.earnedUnlockSelectedTokenCount=ios.selectedTokenCounts"),
    specs.includes("ios.earnedUnlockAdultFilterStillActive=true"),
    specs.includes("ios.earnedUnlockSourceHost=screen-time-shield.freed.local"),
    specs.includes("ios.earnedUnlockRejectedSourceRunId"),
    specs.includes("ios.earnedUnlockRejectedSourceArtifact"),
    specs.includes("ios.earnedUnlockRejectedSourceArtifact local freed-ios-earned-unlock-report-v1 JSON with sanitized=true"),
    specs.includes("ios.earnedUnlockRejectedSourceHost is a blocked browser/adult-domain source"),
    specs.includes("ios.earnedUnlockRejectedSelectedShieldsStayedActive=true"),
    specs.includes("ios.earnedUnlockRejectedAdultFilterStillActive=true"),
    specs.includes("ios.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true"),
    specs.includes("ios.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true"),
    specs.includes("ios.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true"),
    specs.includes("ios.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true"),
    specs.includes("ios.shieldActionHandoffRunId"),
    specs.includes("ios.adultInterceptArtifact"),
    specs.includes("android.isPhysicalDevice=true"),
    specs.includes("androidInstallLaunchQa"),
    specs.includes("android.installQaArtifact local freed-android-install-qa-report-v1 JSON"),
    specs.includes("android.chromeInterceptRunId"),
    specs.includes("android.chromeInterceptArtifact"),
    specs.includes("android.chromeInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.firefoxInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.edgeInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.samsungInternetInterceptArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.usageStatsAuthorized=true"),
    specs.includes("android.accessibilityPermissionArtifact local freed-android-permission-report-v1 JSON with sanitized=true"),
    specs.includes("android.accessibilitySettingsRouteComponent matches FREED AccessibilityService native target"),
    specs.includes("android.usageAccessPermissionRunId"),
    specs.includes("android.usageAccessPermissionArtifact local freed-android-permission-report-v1 JSON with sanitized=true"),
    specs.includes("android.notificationPermissionArtifact local freed-android-permission-report-v1 JSON with sanitized=true"),
    specs.includes("android.notificationRuntimePromptShown=true"),
    specs.includes("android.notificationSettingsFallbackOpenedIfDenied=true"),
    specs.includes("android.usageStatsObservedPackageNames includes every configured and short-form proof package"),
    specs.includes("android.usageStatsTodayMinutes>=configuredAppShieldUsageBeforeLimitMinutes"),
    specs.includes("android.usageStatsTodayMinutesByPackage includes every configured and short-form proof package"),
    specs.includes("focusedBrowserSearchIntercept"),
    specs.includes("android.focusedBrowserSearchArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.focusedBrowserSearchRedactedHost=focused-search.app.freed.local"),
    specs.includes("android.focusedBrowserSearchRawQueryStored=false"),
    specs.includes("android.focusedWebViewArtifact"),
    specs.includes("android.focusedWebViewArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.configuredAppShieldDailyLimitMinutes"),
    specs.includes("android.configuredAppShieldBeforeLimitAllowRunId"),
    specs.includes("android.configuredAppShieldBeforeLimitAllowArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true"),
    specs.includes("android.configuredAppShieldRunId"),
    specs.includes("android.configuredAppShieldUsageAtInterventionMinutes"),
    specs.includes("android.configuredAppShieldArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true"),
    specs.includes("android.shortFormInterventionId=short-form:youtube-shorts"),
    specs.includes("android.shortFormBelowThresholdAllowArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true"),
    specs.includes("android.shortFormArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true"),
    specs.includes("android.shortFormSelectedSurfaceArtifact"),
    specs.includes("android.shortFormSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON with sanitized=true"),
    specs.includes("android.shortFormSelectedSurfaceVerified=true"),
    specs.includes("android.shortFormUsageBeforeLimitMinutes lower than android.configuredAppShieldDailyLimitMinutes"),
    specs.includes("instagramReelsSustainedIntercept"),
    specs.includes("android.instagramReelsInterventionId=short-form:instagram-reels"),
    specs.includes("android.instagramReelsArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true"),
    specs.includes("android.instagramReelsSelectedSurfaceArtifact"),
    specs.includes("android.instagramReelsSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON with sanitized=true"),
    specs.includes("android.instagramReelsSelectedSurfaceVerified=true"),
    specs.includes("android.instagramReelsUsageBeforeLimitMinutes lower than android.configuredAppShieldDailyLimitMinutes"),
    specs.includes("tiktokFeedSustainedIntercept"),
    specs.includes("android.tiktokFeedInterventionId=short-form:tiktok-feed"),
    specs.includes("android.tiktokFeedArtifact local freed-android-app-intervention-report-v1 JSON with sanitized=true"),
    specs.includes("android.tiktokFeedUsageBeforeLimitMinutes lower than android.configuredAppShieldDailyLimitMinutes"),
    specs.includes("android.tiktokFeedSelectedSurfaceArtifact"),
    specs.includes("android.tiktokFeedSelectedSurfaceArtifact local freed-short-form-surface-report-v1 JSON with sanitized=true"),
    specs.includes("android.tiktokFeedSelectedSurfaceVerified=true"),
    specs.includes("android.earnedUnlockAppAllowRunId"),
    specs.includes("android.earnedUnlockAppAllowArtifact local freed-android-earned-unlock-report-v1 JSON with sanitized=true"),
    specs.includes("earnedUnlockAutoRelock"),
    specs.includes("android.earnedUnlockRelockRunId"),
    specs.includes("android.earnedUnlockRelockArtifact"),
    specs.includes("android.earnedUnlockRelockArtifact local freed-android-earned-unlock-report-v1 JSON with sanitized=true"),
    specs.includes("android.earnedUnlockDurationMinutes between 1 and 120"),
    specs.includes("android.earnedUnlockSourcePackage=android.configuredAppShieldPackage"),
    specs.includes("android.earnedUnlockRelockUsageMinutes at least android.configuredAppShieldDailyLimitMinutes"),
    specs.includes("android.challengePhotoArtifact local freed-challenge-photo-report-v1 JSON with sanitized=true"),
    specs.includes("android.challengeMotionArtifact local freed-challenge-motion-report-v1 JSON with sanitized=true"),
    specs.includes("android.challengeStepsArtifact local freed-challenge-steps-report-v1 JSON with sanitized=true"),
    specs.includes("android.challengeLocationArtifact local freed-challenge-location-report-v1 JSON with sanitized=true"),
    specs.includes("browserEarnedUnlockDoesNotUnlockApps"),
    specs.includes("android.browserEarnedUnlockNoAppUnlockRunId"),
    specs.includes("android.browserEarnedUnlockNoAppUnlockArtifact"),
    specs.includes("android.browserEarnedUnlockNoAppUnlockArtifact local freed-android-browser-earned-unlock-report-v1 JSON with sanitized=true"),
    specs.includes("android.browserEarnedUnlockSourceHost is a blocked browser/adult-domain source"),
    specs.includes("android.browserEarnedUnlockNativeAppUnlockActive=false"),
    specs.includes("android.browserEarnedUnlockConfiguredAppStillShielded=true"),
    specs.includes("android.browserEarnedUnlockAdultFilterStillActive=true"),
    specs.includes("android.dnsGuardInterventionVisible=true"),
    specs.includes("android.dnsGuardLifecycleArtifact"),
    specs.includes("android.dnsGuardBlockArtifact local freed-dns-guard-block-report-v1 JSON with sanitized=true"),
    specs.includes("android.dnsGuardLifecycleArtifact local freed-dns-guard-lifecycle-report-v1 JSON with sanitized=true"),
    specs.includes("android.dnsGuardRestartArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true"),
    specs.includes("android.dnsGuardRestartSkippedArtifact local freed-dns-guard-restart-report-v1 JSON with sanitized=true"),
    specs.includes("android.dnsGuardSessionQueries>=2"),
    specs.includes("android.dnsGuardBlockedQueries>=1"),
    specs.includes("android.dnsGuardAllowedQueries>=1"),
    specs.includes("android.dnsGuardServfailResponses>=0"),
    specs.includes("android.dnsGuardMalformedPackets>=0"),
    specs.includes("android.adultDomainFeedVersion"),
    specs.includes("android.adultDomainFeedChecksum fnv1a32:<8-hex>"),
    specs.includes("android.adultDomainFeedStatusArtifact local freed-android-adult-domain-feed-status-report-v1 JSON with sanitized=true"),
    specs.includes("android.adultDomainFeedAccessibilityRunId"),
    specs.includes("android.adultDomainFeedAccessibilityArtifact local freed-android-browser-intercept-report-v1 JSON with sanitized=true"),
    specs.includes("android.adultDomainFeedDnsGuardArtifact"),
    specs.includes("android.adultDomainFeedDnsGuardArtifact local freed-dns-guard-block-report-v1 JSON with sanitized=true"),
    specs.includes("android.playPolicyAccessibilityReviewId"),
    specs.includes("android.playPolicyAccessibilityArtifact"),
    specs.includes("android.playPolicyAccessibilityArtifact local freed-android-play-policy-report-v1 JSON with sanitized=true"),
    specs.includes("android.playPolicySpecialUseFgsArtifact local freed-android-play-policy-report-v1 JSON with sanitized=true"),
    specs.includes("store.adRequestCountryCode ISO 3166-1 alpha-2"),
    specs.includes("normalBrowsing.classifierCorpusSource=scripts/classifier-safety-corpus.ts"),
    specs.includes("normalBrowsing.classifierCorpusCaseCount equals current classifier corpus length"),
    specs.includes("normalBrowsing.browserMatrix includes iOS Safari"),
    specs.includes("normalBrowsing.browserMatrix includes Android Chrome"),
    specs.includes("normalBrowsing.browserMatrix includes Android Firefox"),
    specs.includes("normalBrowsing.browserMatrix includes Android Edge"),
    specs.includes("normalBrowsing.browserMatrix includes Samsung Internet"),
    specs.includes("normalBrowsing.browserMatrix[].isPhysicalDevice=true"),
    specs.includes("normalBrowsing.browserMatrix[].runId"),
    specs.includes("normalBrowsing.browserMatrix[].resultArtifact"),
    specs.includes("normalBrowsing.browserMatrix[].resultArtifact local freed-normal-browsing-browser-report-v1 JSON with sanitized=true"),
    specs.includes("normalBrowsing.browserMatrix[].falsePositiveCount=0"),
    specs.includes("normalBrowsing.browserMatrix[].missedAdultBlockCount=0"),
    specs.includes("profile.downloadMbpsDuring>=80% of profile.downloadMbpsBefore"),
    specs.includes("profile.platformProfiles includes iOS physical device"),
    specs.includes("profile.platformProfiles includes Android physical device"),
    specs.includes("profile.platformProfiles[].runId"),
    specs.includes("profile.platformProfiles[].profilerArtifact"),
    specs.includes("profile.platformProfiles[].backgroundCpuRunId"),
    specs.includes("profile.platformProfiles[].backgroundCpuArtifact"),
    specs.includes("profile.platformProfiles[].routingProofRunId"),
    specs.includes("profile.platformProfiles[].routingProofArtifact"),
    specs.includes("profile.platformProfiles[].routingProofArtifact local freed-routing-proof-report-v1 JSON with sanitized=true"),
    specs.includes("profile.platformProfiles[].backgroundCpuPercent<=5"),
    specs.includes("profile.platformProfiles[].networkSpeedRunId"),
    specs.includes("profile.platformProfiles[].networkSpeedArtifact"),
    specs.includes("profile.platformProfiles[].networkSpeedArtifact local freed-network-speed-report-v1 JSON with sanitized=true"),
    specs.includes("profile.platformProfiles[].dnsLatencyRunId"),
    specs.includes("profile.platformProfiles[].dnsLatencyArtifact"),
    specs.includes("profile.platformProfiles[].dnsLatencyArtifact local freed-dns-latency-report-v1 JSON with sanitized=true"),
    specs.includes("profile.platformProfiles[].noForegroundPollingLoopObserved=true"),
    specs.includes("profile.platformProfiles[].noFullTrafficProxyConfirmed=true"),
    specs.includes("profile.platformProfiles[].noPacketInspectionConfirmed=true"),
    specs.includes("profile.platformProfiles[].noMitmHttpsConfirmed=true"),
    specs.includes("profile.platformProfiles[].noContinuousScreenshotOrOcrConfirmed=true"),
    specs.includes("profile.platformProfiles[].noContinuousImageClassificationConfirmed=true"),
    specs.includes("android.testedBrowserPackages includes Edge"),
    specs.includes("android.testedBrowserPackages includes Samsung Internet"),
    specs.includes("android.samsungInternetInterceptRunId"),
    specs.includes("android.samsungInternetInterceptArtifact"),
    scaffold.includes("requiredFields"),
    scaffold.includes("requiredCommands"),
    scaffold.includes("Remote evidence URLs must use real QA/report/artifact paths"),
    scaffold.includes("Evidence references must be files under the artifact folder or production-safe HTTPS QA/report URLs"),
    scaffold.includes("signed QA artifact query strings are allowed only for evidence links"),
    scaffold.includes("production API endpoint fields also reject query strings"),
    specs.includes("rewardedAdNonPersonalizedRequest"),
    specs.includes("rewardedAdCountryContextRecorded"),
    specs.includes("rewardedOnlyAdFormat"),
    specs.includes("noInterstitialOrBannerAdsRequested"),
    specs.includes("premiumNoRewardedAdRequested"),
    specs.includes("storePrivacyDisclosureReviewed"),
    specs.includes("releaseEnvPreflightPassed"),
    specs.includes("store.purchaseVerifyEndpoint production-safe, no URL credentials/query/fragment, and matches configured purchase verification endpoint"),
    specs.includes("store.releasePreflightCommand"),
    specs.includes("store.releasePreflightRunId"),
    specs.includes("store.releasePreflightArtifact"),
    specs.includes("store.privacyDisclosureReviewId"),
    specs.includes("store.iosPurchaseRunId"),
    specs.includes("store.iosPurchaseArtifact"),
    specs.includes("store.iosPurchaseTransactionId numeric StoreKit format"),
    specs.includes("store.iosRestoreRunId"),
    specs.includes("store.iosRestoreTransactionId numeric StoreKit format"),
    specs.includes("store.androidPurchaseRunId"),
    specs.includes("store.androidOrderId GPA.1234-5678-9012-34567 format"),
    specs.includes("store.androidRestoreRunId"),
    specs.includes("store.androidRestoreArtifact"),
    specs.includes("store.androidPurchaseTokenHash=sha256-<64-hex-chars>"),
    specs.includes("store.purchaseVerificationPassCount>=6"),
    specs.includes("store.purchaseVerificationArtifact local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof"),
    specs.includes("Core 3 fake-known yearly/monthly/lifetime PASS result rows"),
    specs.includes("matching launchProductIdsChecked"),
    specs.includes("store.restoreVerificationArtifact local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof"),
    specs.includes("store.restoreVerificationPassCount>=6"),
    specs.includes("store.restoreVerificationFailedCount=0"),
    specs.includes("store.paywallLaunchScopeArtifact local freed-paywall-launch-scope-report-v1 JSON with sanitized=true"),
    specs.includes("paywallCore3OnlyShown"),
    specs.includes("store.consoleProductSetupArtifact local freed-store-console-product-setup-report-v1 JSON with sanitized=true"),
    specs.includes("storeConsoleProductsConfigured"),
    specs.includes("store.privacyDisclosureArtifact local freed-store-privacy-disclosure-report-v1 JSON with sanitized=true"),
    specs.includes("store.rewardedAdCompletionRunId"),
    specs.includes("store.rewardedAdCompletionArtifact"),
    specs.includes("store.rewardedAdCompletionArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true"),
    specs.includes("store.freeRewardedInterventionArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true"),
    specs.includes("store.adFailureFallbackArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true"),
    specs.includes("store.premiumNoAdInterventionArtifact local freed-store-intervention-flow-report-v1 JSON with sanitized=true"),
    specs.includes("store.rewardedAdRequestArtifact"),
    specs.includes("store.rewardedAdRequestArtifact local freed-rewarded-ad-request-report-v1 JSON with sanitized=true"),
    specs.includes("store.rewardedAdFormat=rewarded"),
    specs.includes("store.noInterstitialOrBannerAdRequestsConfirmed=true"),
    specs.includes("store.premiumNoRewardedAdRequested=true"),
    specs.includes("store.privacyDisclosureArtifact"),
    specs.includes("ai.safetyEvalCaseCount>=10"),
    specs.includes("ai.coachEndpoint production-safe, no URL credentials/query/fragment, and matches configured remote coach endpoint"),
    specs.includes("ai.challengeEndpoint production-safe, no URL credentials/query/fragment, and matches configured remote challenge endpoint"),
    specs.includes("ai.retentionEndpoint production-safe, no URL credentials/query/fragment, and matches configured remote retention endpoint"),
    specs.includes("ai.releasePreflightCommand"),
    specs.includes("ai.releasePreflightRunId"),
    specs.includes("ai.releasePreflightArtifact"),
    specs.includes("ai.smokeEndpointPassCount>=2"),
    specs.includes("ai.coachSmokeRunId"),
    specs.includes("ai.coachSmokeArtifact"),
    specs.includes("ai.challengeSmokeRunId"),
    specs.includes("ai.challengeSmokeArtifact"),
    specs.includes("ai.retentionSmokeRunId"),
    specs.includes("ai.retentionSmokeArtifact"),
    specs.includes("retentionAggregateOnlyVerified=true"),
    specs.includes("ai.noSensitiveEchoSampleCount>=2"),
    specs.includes("ai.noSensitiveEchoRunId"),
    specs.includes("ai.noSensitiveEchoArtifact"),
    specs.includes("ai.safetyEvalArtifact"),
    specs.includes("ai.smokeReportArtifact"),
    specs.includes("local ai-backend-smoke-v1 JSON report with sanitized=true, contractProof"),
    specs.includes("ai.providerFallbackArtifact"),
    read("scripts/store-ad-sandbox-evidence.js").includes("local purchase-verification-smoke-v1 JSON report with sanitized=true, contractProof"),
    read("scripts/ai-backend-smoke-evidence.js").includes("local ai-backend-smoke-v1 JSON report with sanitized=true, contractProof"),
    validator.includes("ios.isPhysicalDevice"),
    validator.includes("ios.familyControlsEntitlementTeamId"),
    validator.includes("familyControlsEntitlementArtifact"),
    validator.includes("iosAppPackageProofReportIssues"),
    validator.includes("freed-ios-app-package-proof-v1"),
    validator.includes("familyControlsAuthorizationRunId"),
    validator.includes("familyControlsAuthorizationArtifact"),
    validator.includes("appLimitScheduled"),
    validator.includes("selectedAppDailyLimitMinutes"),
    validator.includes("selectedAppDailyLimitActivityName"),
    validator.includes("selectedAppDailyLimitReachedToday must be true"),
    validator.includes("selectedAppDailyLimitReachedDate must use yyyy-MM-dd format"),
    validator.includes("selectedAppDailyLimitRunId"),
    validator.includes("iosSelectedAppDailyLimitReportIssues"),
    validator.includes("freed-ios-screen-time-app-limit-report-v1"),
    validator.includes("safariContentBlockerEmbedded must be true"),
    validator.includes("safariContentBlockerIdentifier must be app.freed.recovery.safari-content-blocker"),
    validator.includes("safariContentBlockerChecksum must use fnv1a32:<8-hex> format"),
    validator.includes("safariContentBlockerRuleCount >= 1"),
    validator.includes("adult-domain rules only"),
    validator.includes("iosSafariContentBlockerReportIssues"),
    validator.includes("freed-ios-safari-content-blocker-report-v1"),
    validator.includes("iosSafariFocusShieldReportIssues"),
    validator.includes("freed-ios-safari-focus-shield-report-v1"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("safariContentBlockerBuildRunId"),
    validator.includes("safariContentBlockerReloadArtifact"),
    validator.includes("safariContentBlockerAdultBlockRunId"),
    validator.includes("ios.earnedUnlockDurationMinutes between 1 and 120"),
    validator.includes("ios.earnedUnlockActivityName must be freed.earnedUnlockWindow"),
    validator.includes("ios.earnedUnlockSelectedTokenCount must equal selected shield token count"),
    validator.includes("ios.earnedUnlockAdultFilterStillActive must be true"),
    validator.includes("ios.earnedUnlockSourceHost must be screen-time-shield.freed.local"),
    validator.includes("ios.earnedUnlockRejectedSourceHost must be a browser/adult-domain source"),
    validator.includes("ios.earnedUnlockRejectedSelectedShieldsStayedActive must be true"),
    validator.includes("ios.earnedUnlockRejectedAdultFilterStillActive must be true"),
    validator.includes("iosEarnedUnlockReportIssues"),
    validator.includes("freed-ios-earned-unlock-report-v1"),
    validator.includes("earnedUnlockRelockRunId"),
    validator.includes("earnedUnlockRelockArtifact"),
    validator.includes("shieldActionHandoffRunId"),
    validator.includes("adultInterceptArtifact"),
    validator.includes("android.isPhysicalDevice"),
    validator.includes("chromeInterceptRunId"),
    validator.includes("chromeInterceptArtifact"),
    validator.includes("androidBrowserInterceptReportIssues"),
    validator.includes("freed-android-browser-intercept-report-v1"),
    validator.includes("androidPermissionReportIssues"),
    validator.includes("freed-android-permission-report-v1"),
    validator.includes("noHiddenMonitoring"),
    validator.includes("nativeStatusUsageStatsAuthorized"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("usageStatsAuthorized must be true"),
    validator.includes("usageAccessPermissionRunId"),
    validator.includes("usageStatsObservedPackageNames must include every configured and short-form proof package"),
    validator.includes("usageStatsTodayMinutes must be at least android.configuredAppShieldUsageBeforeLimitMinutes"),
    validator.includes("usageStatsTodayMinutesByPackage must include non-negative minutes for every configured and short-form proof package"),
    validator.includes("focusedBrowserSearchRunId"),
    validator.includes("focusedBrowserSearchRedactedHost must be focused-search.app.freed.local"),
    validator.includes("focusedBrowserSearchRawQueryStored must be false"),
    validator.includes("focusedWebViewArtifact"),
    validator.includes("androidAppInterventionReportIssues"),
    validator.includes("freed-android-app-intervention-report-v1"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("androidEarnedUnlockReportIssues"),
    validator.includes("freed-android-earned-unlock-report-v1"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("androidBrowserEarnedUnlockNoAppUnlockReportIssues"),
    validator.includes("freed-android-browser-earned-unlock-report-v1"),
    validator.includes("configuredAppShieldPackage"),
    validator.includes("configuredAppShieldDailyLimitMinutes"),
    validator.includes("configuredAppShieldBeforeLimitAllowRunId"),
    validator.includes("configuredAppShieldUsageAtInterventionMinutes"),
    validator.includes("dnsGuardLifecycleArtifact"),
    validator.includes("dnsGuardBlockReportIssues"),
    validator.includes("freed-dns-guard-block-report-v1"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("dnsGuardLifecycleReportIssues"),
    validator.includes("freed-dns-guard-lifecycle-report-v1"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("dnsGuardRestartReportIssues"),
    validator.includes("freed-dns-guard-restart-report-v1"),
    validator.includes("diagnostics must be omitted from sanitized restart evidence"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("android.dnsGuardInterventionVisible must be true"),
    validator.includes("android.dnsGuardSessionQueries >= 2"),
    validator.includes("android.dnsGuardBlockedQueries >= 1"),
    validator.includes("android.dnsGuardAllowedQueries >= 1"),
    validator.includes("android.dnsGuardServfailResponses >= 0"),
    validator.includes("android.dnsGuardMalformedPackets >= 0"),
    validator.includes("android.dnsGuardSessionQueries must cover blocked plus allowed DNS queries"),
    validator.includes("adultDomainFeedChecksum"),
    validator.includes("androidAdultDomainFeedStatusReportIssues"),
    validator.includes("freed-android-adult-domain-feed-status-report-v1"),
    validator.includes("adultDomainFeedAccessibilityRunId"),
    validator.includes("syncedAdultDomainFeedUsed"),
    validator.includes("adultDomainFeedDnsGuardArtifact"),
    validator.includes("android.earnedUnlockDurationMinutes between 1 and 120"),
    validator.includes("earnedUnlockSourcePackage must match android.configuredAppShieldPackage"),
    validator.includes("earnedUnlockRelockUsageMinutes must be at least android.configuredAppShieldDailyLimitMinutes"),
    validator.includes("browserEarnedUnlockSourceHost must be a browser/adult-domain source"),
    validator.includes("android.browserEarnedUnlockNativeAppUnlockActive must be false"),
    validator.includes("android.browserEarnedUnlockConfiguredAppStillShielded must be true"),
    validator.includes("android.browserEarnedUnlockAdultFilterStillActive must be true"),
    validator.includes("playPolicySpecialUseFgsReviewId"),
    validator.includes("playPolicySpecialUseFgsArtifact"),
    validator.includes("androidPlayPolicyReportIssues"),
    validator.includes("freed-android-play-policy-report-v1"),
    validator.includes("androidInstallQaReportIssues"),
    validator.includes("freed-android-install-qa-report-v1"),
    validator.includes("normalBrowsingBrowserMatrixIssues"),
    validator.includes("normalBrowsing.browserMatrix must include Android Chrome"),
    validator.includes("duplicates"),
    validator.includes("falsePositiveCount must be 0"),
    validator.includes("missedAdultBlockCount must be 0"),
    validator.includes("performancePlatformProfilesIssues"),
    validator.includes("profile.platformProfiles must include Android physical device"),
    validator.includes("profilerArtifact"),
    validator.includes("backgroundCpuRunId"),
    validator.includes("backgroundCpuArtifact"),
    validator.includes("routingProofRunId"),
    validator.includes("routingProofArtifact"),
    validator.includes("performanceRoutingProofReportIssues"),
    validator.includes("freed-routing-proof-report-v1"),
    validator.includes("routingProofArtifact.sanitized must be true"),
    validator.includes("networkSpeedArtifact"),
    validator.includes("dnsLatencyArtifact"),
    validator.includes("backgroundCpuPercent must be between 0 and 5"),
    validator.includes("noFullTrafficProxyConfirmed must be true"),
    validator.includes("noPacketInspectionConfirmed must be true"),
    validator.includes("noMitmHttpsConfirmed must be true"),
	    validator.includes("noContinuousScreenshotOrOcrConfirmed must be true"),
	    validator.includes("noContinuousImageClassificationConfirmed must be true"),
	    validator.includes("adRequestNonPersonalized"),
	    validator.includes("storeRewardedAdRequestArtifactIssues"),
	    validator.includes("freed-rewarded-ad-request-report-v1"),
	    validator.includes("rewardedAdRequestProofUsableForManualEvidence"),
	    validator.includes("noInterstitialRequested"),
	    validator.includes("noRawDeviceIdentifiersStored"),
	    validator.includes("rewardedAdFormat must be rewarded"),
	    validator.includes("noInterstitialOrBannerAdRequestsConfirmed must be true"),
	    validator.includes("premiumNoRewardedAdRequested must be true"),
	    validator.includes("FREED store/ad release evidence may only use rewarded ads"),
    validator.includes("store.releasePreflightCommand must be npm run preflight:release-env"),
    validator.includes("adRequestCountryCode"),
    validator.includes("iso3166Alpha2CountryCodes"),
    validator.includes("privacyDisclosureReviewId"),
    validator.includes("storePrivacyDisclosureArtifactIssues"),
    validator.includes("freed-store-privacy-disclosure-report-v1"),
    validator.includes("privacyDisclosureProofUsableForManualEvidence"),
    validator.includes("reviewedStoreSurfaces must include"),
    validator.includes("app-store-connect-app-privacy"),
    validator.includes("privacyDataMapHash"),
    validator.includes("noRawReceiptsOrTokensStored"),
    validator.includes("collectForbiddenEvidenceFieldIssues"),
    validator.includes("collectForbiddenEvidenceTextIssues"),
    validator.includes("skipExactPaths"),
    validator.includes("iosPurchaseRunId"),
    validator.includes("iosPurchaseArtifact"),
    validator.includes("androidRestoreRunId"),
    validator.includes("androidRestoreArtifact"),
    validator.includes("purchaseVerificationPassCount"),
    validator.includes("purchaseVerificationArtifact"),
    validator.includes("storePurchaseVerificationArtifactIssues"),
    validator.includes("restoreVerificationArtifact"),
    validator.includes("PURCHASE_VERIFICATION_REQUIRED_RESULT_IDS"),
    validator.includes("reportResultIssues"),
    validator.includes("schemaVersion must be purchase-verification-smoke-v1"),
    validator.includes("${pathPrefix}.sanitized must be true"),
    validator.includes("contractProof.endpointPathRequired"),
    validator.includes("contractProof.responseBoundary.secretValuesOmitted"),
    validator.includes("results must include required result"),
    validator.includes("restoreVerificationPassCount"),
    validator.includes("rewardedAdCompletionRunId"),
    validator.includes("rewardedAdCompletionArtifact"),
    validator.includes("storeInterventionFlowArtifactIssues"),
    validator.includes("storePaywallLaunchScopeArtifactIssues"),
    validator.includes("freed-paywall-launch-scope-report-v1"),
    validator.includes("freed-store-console-product-setup-report-v1"),
    validator.includes("freed-store-intervention-flow-report-v1"),
    validator.includes("interventionFlowProofUsableForManualEvidence"),
    validator.includes("free-rewarded-intervention"),
    validator.includes("premium-no-ad-intervention"),
    validator.includes("rewardedAdRequestArtifact"),
    validator.includes("privacyDisclosureArtifact"),
    validator.includes("forbiddenSensitiveStoreFields"),
    validator.includes("rawReceipt"),
    validator.includes("purchaseToken"),
    validator.includes("adNetworkSecret"),
    validator.includes("App Store transaction id format"),
    validator.includes("full sha256 hash label"),
    validator.includes("safetyEvalCaseCount"),
    validator.includes("ai.releasePreflightCommand must be npm run preflight:release-env"),
    validator.includes("coachSmokeRunId"),
    validator.includes("coachSmokeArtifact"),
    validator.includes("challengeSmokeRunId"),
    validator.includes("challengeSmokeArtifact"),
    validator.includes("smokeEndpointPassCount"),
    validator.includes("noSensitiveEchoSampleCount"),
    validator.includes("noSensitiveEchoRunId"),
    validator.includes("noSensitiveEchoArtifact"),
    validator.includes("safetyEvalArtifact"),
    validator.includes("readLocalJsonEvidenceArtifact"),
    validator.includes("aiBackendSmokeReportArtifactIssues"),
    validator.includes("AI_BACKEND_REQUIRED_RESULT_IDS"),
    validator.includes("ai.smokeReportArtifact.schemaVersion must be ai-backend-smoke-v1"),
    validator.includes("ai.smokeReportArtifact.sanitized must be true"),
    validator.includes("challenge-remote-endpoint"),
    validator.includes("contractProof.endpointPathRequirements.coach"),
    validator.includes("contractProof.responseBoundary.secretValuesOmitted"),
    validator.includes("providerFallbackArtifact"),
    validator.includes("forbiddenSensitiveAiFields"),
    validator.includes("rawPrompt"),
    validator.includes("providerApiKey"),
    validator.includes("toISOString"),
    validator.includes("Date.now"),
    validator.includes("--evidence-dir"),
    validator.includes("--draft-evidence-dir"),
    validator.includes("Unknown option"),
    validator.includes("Missing value for --evidence-dir"),
    validator.includes("normalizedEvidenceDirOption"),
    validator.includes("evidence directory must be inside the current workspace"),
    validator.includes("draft evidence directory must be outside docs/validation/evidence"),
    runner.includes("buildSync"),
    runner.includes("--env-file"),
    runner.includes("loadEnvFile"),
    runner.includes("FREED_RELEASE_ENV_FILE"),
    runner.includes("release env file"),
    runner.includes("Missing value for --env-file"),
    runner.includes("external:"),
    runner.includes('"react-native"'),
    runner.includes("process.argv = [originalArgv[0], entryPath, ...entryArgs]"),
    scaffold.includes("docs/validation/artifacts"),
    scaffold.includes("evidence:validation:draft"),
    scaffold.includes("evidence:promote"),
    scaffold.includes("Unknown option"),
    scaffold.includes("Missing value for --run-id"),
    scaffold.includes("Missing value for --output"),
    scaffold.includes("CAPTURE_PLAN.md"),
    scaffold.includes("buildCapturePlan"),
    scaffold.includes("Refusing to scaffold draft evidence inside docs/validation/evidence"),
    scaffold.includes("Production Environment Preflight"),
    scaffold.includes("captureHelperCommand"),
    scaffold.includes("captureHelperNotes"),
    scaffold.includes("preloads non-secret store provider, Core 3 product IDs, entitlement"),
    scaffold.includes("preloads non-secret coach endpoint, challenge endpoint, optional retention endpoint, and model context"),
    scaffold.includes("Vision camera labels"),
    scaffold.includes("ML Kit camera labels"),
    scaffold.includes("Explicit store/ad CLI flags override release env-file values"),
    scaffold.includes("releaseEnvFileLoaded=true"),
    scaffold.includes("reportArtifactCommandList"),
    scaffold.includes("captureHelperCommandMap"),
    blockerGroups.includes("npm run evidence:ios-physical-device"),
    scaffold.includes("--app <signed-freed-app-or-ipa>"),
    scaffold.includes("ios-app-package-proof.json"),
    scaffold.includes("ios-physical-device-evidence-fill-template.json"),
    blockerGroups.includes("npm run qa:android-install"),
    scaffold.includes("npm run evidence:android-real-browser"),
    scaffold.includes("android-real-browser-evidence-fill-template.json"),
    scaffold.includes("--app-scenario browser-earned-unlock"),
    scaffold.includes("android.browserEarnedUnlockNativeAppUnlockActive=false"),
    blockerGroups.includes("npm run evidence:normal-browsing-corpus"),
    scaffold.includes("normal-browsing-browser-summary.template.json"),
    scaffold.includes("browser-report-templates/*.template.json"),
    scaffold.includes("normal-browsing-evidence-fill-template.json"),
    blockerGroups.includes("npm run evidence:performance-profile"),
    scaffold.includes("performance-profile-evidence-fill-template.json"),
    blockerGroups.includes("npm run evidence:store-ad-sandbox"),
    blockerGroups.includes("npm run evidence:ai-backend-smoke"),
    scaffold.includes("store-ad-sandbox-evidence-fill-template.json"),
    scaffold.includes("store-console-product-setup-report.template.json"),
    scaffold.includes("freed-store-console-product-setup-report-v1"),
    scaffold.includes("ai-backend-smoke-evidence-fill-template.json"),
    blockerGroups.includes("EXPO_PUBLIC_MONETIZATION_MODE=native"),
    blockerGroups.includes("EXPO_PUBLIC_SUPABASE_URL"),
    blockerGroups.includes("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    scaffold.includes("Public backend routing env values"),
    blockerGroups.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT"),
    blockerGroups.includes("EXPO_PUBLIC_ANALYTICS_ENDPOINT"),
    blockerGroups.includes("EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT"),
    scaffold.includes("Server-only/private env values"),
    blockerGroups.includes("APP_STORE_SERVER_API_ENV=production"),
    blockerGroups.includes("OPENAI_API_KEY and OPENAI_MODEL"),
    blockerGroups.includes("GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENAI_API_KEY"),
    blockerGroups.includes("SUPABASE_URL"),
    blockerGroups.includes("SUPABASE_SERVICE_ROLE_KEY"),
    blockerGroups.includes("UPSTASH_REDIS_REST_URL"),
    blockerGroups.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS with reviewed id|label|https://source-url entries"),
    blockerGroups.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    blockerGroups.includes("FCM credentials with FIREBASE_PROJECT_ID"),
    blockerGroups.includes("APNs production signing credentials"),
    blockerGroups.includes("Supabase service-role keys, Redis tokens, push credentials"),
    scaffold.includes("Device URL checklist"),
    promote.includes("getValidationEvidenceResults"),
    promote.includes("Refusing to overwrite existing evidence files without --force"),
    promote.includes("Refusing to promote from docs/validation/evidence"),
    promote.includes("Draft validation failed. No files were promoted."),
    promote.includes("Unknown option"),
    promote.includes("Missing value for --from"),
    specs.includes("challengePhotoVerifiedOnDevice"),
    specs.includes("ios.challengePhotoNoBase64OrExif=true"),
    specs.includes("ios.permissionWizardRunId"),
    specs.includes("ios.permissionWizardArtifact local freed-permission-wizard-report-v1 JSON with sanitized=true"),
    specs.includes("ios.permissionWizardFlowOrder=onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete"),
    specs.includes("ios.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy"),
    specs.includes("ios.challengeLocationBestAccuracyMeters<=80"),
    specs.includes("android.challengePhotoNoBase64OrExif=true"),
    specs.includes("android.permissionWizardRunId"),
    specs.includes("android.permissionWizardArtifact local freed-permission-wizard-report-v1 JSON with sanitized=true"),
    specs.includes("android.permissionWizardFlowOrder=onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete"),
    specs.includes("android.permissionExplanationSummary includes monitor only selected apps/sites, block known adult domains, and harmful site/search/app-limit threshold copy"),
    specs.includes("android.challengeLocationBestAccuracyMeters<=80"),
    validator.includes("permissionWizardEvidenceIssues"),
    validator.includes("permissionWizardReportIssues"),
    validator.includes("freed-permission-wizard-report-v1"),
    validator.includes("challengeVerificationEvidenceIssues"),
    templateAudit.includes("challengePhotoTemporaryFileDeleted"),
    templateAudit.includes("validateDraftPackage"),
    templateAudit.includes("validateDraftPackageReadme"),
    templateAudit.includes("expectedCaptureHelperCommand"),
    templateAudit.includes("expectedReportArtifactCommands"),
    templateAudit.includes("reportArtifactCommandList"),
    templateAudit.includes("captureHelperCommandMap"),
    templateAudit.includes("captureHelperCommand"),
    templateAudit.includes("handoffDocumentCommands"),
    templateAudit.includes("requirements.json"),
    templateAudit.includes("README.md"),
    templateAudit.includes("CAPTURE_PLAN.md"),
    templateAudit.includes("expectedHandoffCommands"),
    templateAudit.includes("validateHandoffDoc"),
    templateAudit.includes('validateHandoffDoc("docs/validation/README.md")'),
    templateAudit.includes('validateHandoffDoc("docs/validation/evidence-runbook.md")'),
    templateAudit.includes("shared release/evidence handoff details"),
    blockerGroups.includes("release-readiness-report.json"),
    templateAudit.includes("scripts/validation-evidence-specs.json"),
    validationReadme.includes("npm run evidence:validation:draft"),
    validationReadme.includes("npm run evidence:promote"),
    validationReadme.includes("unknown flags or missing option values"),
    validationReadme.includes("unsafe `--evidence-dir` values"),
    validationReadme.includes("paths outside the workspace"),
    validationReadme.includes("Scaffolded drafts are refused inside `docs/validation/evidence/`"),
    validationReadme.includes("promotion refuses to use `docs/validation/evidence/` as its draft source"),
    validationReadme.includes("CAPTURE_PLAN.md"),
    validationReadme.includes("per-gate checklist"),
    validationReadme.includes("release preflight contract"),
    validationReadme.includes("normal-browsing allow/block URL"),
    validationReadme.includes("UTC ISO timestamp"),
    validationReadme.includes("future timestamps are rejected"),
    validationReadme.includes("adRequestNonPersonalized"),
    validationReadme.includes("store-ad-sandbox-evidence-fill-template.json"),
    validationReadme.includes("paywall-launch-scope-report.template.json"),
    validationReadme.includes("freed-paywall-launch-scope-report-v1"),
    validationReadme.includes("store-console-product-setup-report.template.json"),
    validationReadme.includes("freed-store-console-product-setup-report-v1"),
    validationReadme.includes("rewarded-ad-request-report.template.json"),
    validationReadme.includes("freed-rewarded-ad-request-report-v1"),
    validationReadme.includes("store-intervention-flow-report.templates.json"),
    validationReadme.includes("freed-store-intervention-flow-report-v1"),
    validationReadme.includes("store-privacy-disclosure-report.template.json"),
    validationReadme.includes("freed-store-privacy-disclosure-report-v1"),
    validationReadme.includes("ai-backend-smoke-evidence-fill-template.json"),
    validationReadme.includes("adRequestCountryCode"),
    validationReadme.includes("reserved or placeholder codes"),
    validationReadme.includes("privacyDisclosureReviewId"),
    validationReadme.includes("store.releasePreflightCommand"),
    validationReadme.includes("iosPurchaseRunId"),
    validationReadme.includes("iosPurchaseArtifact"),
    validationReadme.includes("androidRestoreRunId"),
    validationReadme.includes("androidRestoreArtifact"),
    validationReadme.includes("purchaseVerificationPassCount"),
    validationReadme.includes("purchaseVerificationArtifact"),
    validationReadme.includes("1000001234567890"),
    validationReadme.includes("GPA.1234-5678-9012-34567"),
    validationReadme.includes("rewardedAdCompletionRunId"),
    validationReadme.includes("rewardedAdCompletionArtifact"),
    validationReadme.includes("rewardedAdRequestArtifact"),
    validationReadme.includes("supportive/no-punitive copy"),
    validationReadme.includes("no raw device identifier"),
    validationReadme.includes("privacyDisclosureArtifact"),
    validationReadme.includes("no advertising ID permission"),
    validationReadme.includes("raw receipts"),
    validationReadme.includes("store-verification credentials"),
    validationReadme.includes("safetyEvalCaseCount"),
    validationReadme.includes("ai.releasePreflightCommand"),
    validationReadme.includes("release-env-preflight-report.json"),
    validationReadme.includes("backend-readiness-smoke-report.json"),
    validationReadme.includes("supabase-schema-smoke-report.json"),
    validationReadme.includes("adult-domain-feed-smoke-report.json"),
    validationReadme.includes("analytics-ingestion-smoke-report.json"),
    validationReadme.includes("remote-notification-smoke-report.json"),
    validationReadme.includes("purchase-verification-smoke-report.json"),
    validationReadme.includes("ai-backend-smoke-report.json"),
    validationReadme.includes("npm run audit:release:strict -- --report docs/validation/artifacts/<run-id>/release-readiness-report.json"),
    validationReadme.includes("npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/ios-physical-device-capture"),
    validationReadme.includes("npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/android-real-browser-capture"),
    validationReadme.includes("android.installQaArtifact"),
    validationReadme.includes("checks.androidInstallLaunchQa=true"),
    validationReadme.includes("npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/<run-id>"),
    evidenceRunbook.includes("backend-readiness-smoke-report.json"),
    evidenceRunbook.includes("supabase-schema-smoke-report.json"),
    evidenceRunbook.includes("adult-domain-feed-smoke-report.json"),
    evidenceRunbook.includes("analytics-ingestion-smoke-report.json"),
    evidenceRunbook.includes("remote-notification-smoke-report.json"),
    evidenceRunbook.includes("purchase-verification-smoke-report.json"),
    evidenceRunbook.includes("ai-backend-smoke-report.json"),
    evidenceRunbook.includes("npm run audit:release:strict -- --report docs/validation/artifacts/<run-id>/release-readiness-report.json"),
    evidenceRunbook.includes("npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/ios-physical-device-capture"),
    evidenceRunbook.includes("npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/android-real-browser-capture"),
    evidenceRunbook.includes("android.installQaArtifact"),
    evidenceRunbook.includes("checks.androidInstallLaunchQa=true"),
    evidenceRunbook.includes("strict release readiness"),
    validationReadme.includes("coachSmokeRunId"),
    validationReadme.includes("coachSmokeArtifact"),
    validationReadme.includes("challengeSmokeRunId"),
    validationReadme.includes("challengeSmokeArtifact"),
    validationReadme.includes("noSensitiveEchoSampleCount"),
    validationReadme.includes("noSensitiveEchoRunId"),
    validationReadme.includes("noSensitiveEchoArtifact"),
    validationReadme.includes("safetyEvalArtifact"),
    validationReadme.includes("providerFallbackArtifact"),
    validationReadme.includes("raw prompts"),
    validationReadme.includes("provider API keys"),
    validationReadme.includes("ios.isPhysicalDevice"),
    validationReadme.includes("docs/store-policy/ios-screen-time-safari-dns-review.md"),
    validationReadme.includes("--app <signed-freed-app-or-ipa>"),
    validationReadme.includes("ios-app-package-proof.json"),
    validationReadme.includes("familyControlsAuthorizationRunId"),
    validationReadme.includes("permissionWizardFlowOrder"),
    validationReadme.includes("permissionExplanationSummary"),
    validationReadme.includes("permissionWizardTestProtectionPassed=true"),
    validationReadme.includes("familyControlsAuthorizationArtifact"),
    validationReadme.includes("familyActivityPickerAppLimitScheduledImmediately=true"),
    validationReadme.includes("familyActivityPickerAppLimitActivityName=freed.selectedAppDailyLimit"),
    validationReadme.includes("familyActivityPickerAppLimitEventName=freed.selectedAppDailyLimitReached"),
    validationReadme.includes("selectedAppDailyLimitReachedToday"),
    validationReadme.includes("selectedAppDailyLimitReachedDate"),
    validationReadme.includes("selectedAppDailyLimitRunId"),
    validationReadme.includes("selectedAppDailyLimitArtifact"),
    validationReadme.includes("safariContentBlockerReloaded"),
    validationReadme.includes("safariContentBlockerAdultBlock"),
    validationReadme.includes("safariContentBlockerBuildRunId"),
    validationReadme.includes("safariContentBlockerReloadArtifact"),
    validationReadme.includes("freed-ios-safari-content-blocker-report-v1"),
    validationReadme.includes("safariContentBlockerChecksum"),
    validationReadme.includes("safariContentBlockerRuleCount"),
    validationReadme.includes("safariContentBlockerAdultBlockArtifact"),
    validationReadme.includes("safariShortFormChallengeHandoff"),
    validationReadme.includes("safariShortFormChallengeHandoffSource=ios-safari-short-form"),
    validationReadme.includes("safariShortFormChallengeHandoffRawPathStored=false"),
    validationReadme.includes("safariShortFormChallengeHandoffNativeUnlockActive=false"),
    validationReadme.includes("earnedUnlockAllowsSelectedApps"),
    validationReadme.includes("earnedUnlockRelockRunId"),
    validationReadme.includes("earnedUnlockDurationMinutes"),
    validationReadme.includes("earnedUnlockActivityName"),
    validationReadme.includes("earnedUnlockSelectedTokenCount"),
    validationReadme.includes("earnedUnlockAdultFilterStillActive"),
    validationReadme.includes("earnedUnlockRejectsNonScreenTimeSource"),
    validationReadme.includes("earnedUnlockSourceHost=screen-time-shield.freed.local"),
    validationReadme.includes("earnedUnlockRejectedSourceHost"),
    validationReadme.includes("earnedUnlockRejectedSelectedShieldsStayedActive"),
    validationReadme.includes("earnedUnlockRejectedAdultFilterStillActive"),
    validationReadme.includes("Vision labels"),
    validationReadme.includes("temporary photo cleanup"),
    validationReadme.includes("accurate foreground location fixes"),
    validationReadme.includes("shieldActionHandoffRunId"),
    validationReadme.includes("adultInterceptArtifact"),
    validationReadme.includes("android.isPhysicalDevice"),
    validationReadme.includes("chromeInterceptRunId"),
    validationReadme.includes("chromeInterceptArtifact"),
    validationReadme.includes("freed-android-app-intervention-report-v1"),
    validationReadme.includes("freed-android-earned-unlock-report-v1"),
    validationReadme.includes("freed-android-browser-earned-unlock-report-v1"),
    validationReadme.includes("freed-android-browser-intercept-report-v1"),
    validationReadme.includes("--scenario focused-search"),
    validationReadme.includes("--focused-search-query"),
    validationReadme.includes("--scenario synced-feed"),
    validationReadme.includes("--adult-domain-feed-host"),
    validationReadme.includes("--dns-guard-proof"),
    validationReadme.includes("android.dnsGuardBlockArtifact"),
    validationReadme.includes("freed-dns-guard-block-report-v1"),
    validationReadme.includes("android.dnsGuardInterventionVisible=true"),
    validationReadme.includes("android.dnsGuardLifecycleArtifact"),
    validationReadme.includes("freed-dns-guard-lifecycle-report-v1"),
    validationReadme.includes("android.dnsGuardRestartArtifact"),
    validationReadme.includes("freed-dns-guard-restart-report-v1"),
    validationReadme.includes("freed-android-adult-domain-feed-status-report-v1"),
    validationReadme.includes("android.dnsGuardSessionQueries"),
    validationReadme.includes("android.dnsGuardBlockedQueries"),
    validationReadme.includes("android.dnsGuardAllowedQueries"),
    validationReadme.includes("android.dnsGuardServfailResponses"),
    validationReadme.includes("android.dnsGuardMalformedPackets"),
    validationReadme.includes("--back-stack-check"),
    validationReadme.includes("backStackCleanupArtifact"),
    validationReadme.includes("--permission-proof"),
    validationReadme.includes("freed-permission-wizard-report-v1"),
    validationReadme.includes("freed-android-permission-report-v1"),
    validationReadme.includes("--native-status-proof"),
    validationReadme.includes("accessibilityPermissionArtifact"),
    validationReadme.includes("android.permissionWizardArtifact"),
    validationReadme.includes("usageStatsAuthorized=true"),
    validationReadme.includes("usageAccessPermissionRunId"),
    validationReadme.includes("usageAccessPermissionArtifact"),
    validationReadme.includes("--focused-webview-proof"),
    validationReadme.includes("--play-policy-proof"),
    validationReadme.includes("--app-scenario short-form"),
    validationReadme.includes("short-form:instagram-reels"),
    validationReadme.includes("short-form:tiktok-feed"),
    validationReadme.includes("focusedBrowserSearchRedactedHost=focused-search.app.freed.local"),
    validationReadme.includes("focusedBrowserSearchRawQueryStored=false"),
    validationReadme.includes("focusedWebViewArtifact"),
    validationReadme.includes("configuredAppShieldDailyLimitMinutes"),
    validationReadme.includes("configuredAppShieldBeforeLimitAllowRunId"),
    validationReadme.includes("configuredAppShieldRunId"),
    validationReadme.includes("configuredAppShieldUsageAtInterventionMinutes"),
    validationReadme.includes("earnedUnlockAppAllowRunId"),
    validationReadme.includes("earnedUnlockRelockArtifact"),
    validationReadme.includes("--earned-unlock-minutes"),
    validationReadme.includes("earnedUnlockSourcePackage"),
    validationReadme.includes("earnedUnlockRelockUsageMinutes"),
    validationReadme.includes("ML Kit labels"),
    validationReadme.includes("no base64/EXIF media payload"),
    validationReadme.includes("--app-scenario browser-earned-unlock"),
    validationReadme.includes("browserEarnedUnlockDoesNotUnlockApps"),
    validationReadme.includes("browserEarnedUnlockNativeAppUnlockActive=false"),
    validationReadme.includes("browserEarnedUnlockConfiguredAppStillShielded=true"),
    validationReadme.includes("browserEarnedUnlockAdultFilterStillActive=true"),
    validationReadme.includes("freed-challenge-photo-report-v1"),
    validationReadme.includes("freed-challenge-motion-report-v1"),
    validationReadme.includes("freed-challenge-steps-report-v1"),
    validationReadme.includes("freed-challenge-location-report-v1"),
    validationReadme.includes("freed-short-form-surface-report-v1"),
    validationReadme.includes("adultDomainFeedAccessibilityRunId"),
    validationReadme.includes("adultDomainFeedAccessibilityArtifact"),
    validationReadme.includes("adultDomainFeedDnsGuardArtifact"),
    validationReadme.includes("playPolicyAccessibilityReviewId"),
    validationReadme.includes("playPolicyAccessibilityArtifact"),
    validationReadme.includes("docs/store-policy/android-accessibility-and-fgs-disclosure.md"),
    validationReadme.includes("normalBrowsing.classifierCorpusSource"),
    validationReadme.includes("ios-physical-device-evidence-fill-template.json"),
    validationReadme.includes("android-real-browser-evidence-fill-template.json"),
    validationReadme.includes("normal-browsing-browser-checklist.md"),
    validationReadme.includes("normal-browsing-browser-summary.template.json"),
    validationReadme.includes("browser-report-templates/*.template.json"),
    validationReadme.includes("normal-browsing-evidence-fill-template.json"),
    validationReadme.includes("must equal the current shared classifier safety corpus length"),
    validationReadme.includes("normalBrowsing.browserMatrix"),
    validationReadme.includes("unique allowed"),
    validationReadme.includes("freed-normal-browsing-browser-report-v1"),
    validationReadme.includes("falsePositiveCount=0"),
    validationReadme.includes("missedAdultBlockCount=0"),
    validationReadme.includes("platformProfiles"),
    validationReadme.includes("--android-background-cpu-proof"),
    validationReadme.includes("background CPU run/artifact/percent at 5% or less"),
    validationReadme.includes("routing-proof run/artifact"),
    validationReadme.includes("freed-routing-proof-report-v1"),
    validationReadme.includes("network-speed and DNS-latency report artifact fields with `sanitized=true`"),
    validationReadme.includes("freed-network-speed-report-v1"),
    validationReadme.includes("freed-dns-latency-report-v1"),
    validationReadme.includes("noFullTrafficProxyConfirmed=true"),
    validationReadme.includes("noPacketInspectionConfirmed"),
    validationReadme.includes("noMitmHttpsConfirmed"),
    validationReadme.includes("noContinuousScreenshotOrOcrConfirmed"),
    validationReadme.includes("noContinuousImageClassificationConfirmed"),
    validationReadme.includes("performance-profile-evidence-fill-template.json"),
    evidenceRunbook.includes("npm run evidence:validation:draft"),
    evidenceRunbook.includes("npm run evidence:promote"),
    evidenceRunbook.includes("permissionWizardFlowOrder=onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete"),
    evidenceRunbook.includes("permissionExplanationSummary"),
    evidenceRunbook.includes("permissionWizardTestProtectionPassed=true"),
    evidenceRunbook.includes("Do not scaffold drafts inside `docs/validation/evidence/`"),
    evidenceRunbook.includes("promotion command refuses `docs/validation/evidence/` as a draft source"),
    evidenceRunbook.includes("CAPTURE_PLAN.md"),
    evidenceRunbook.includes("date-only values are rejected"),
    evidenceRunbook.includes("future values are rejected"),
    evidenceRunbook.includes("adRequestNonPersonalized"),
    evidenceRunbook.includes("adRequestCountryCode"),
    evidenceRunbook.includes("paywall-launch-scope-report.template.json"),
    evidenceRunbook.includes("freed-paywall-launch-scope-report-v1"),
    evidenceRunbook.includes("store-console-product-setup-report.template.json"),
    evidenceRunbook.includes("freed-store-console-product-setup-report-v1"),
    evidenceRunbook.includes("paywallCore3OnlyShown"),
    evidenceRunbook.includes("freed-rewarded-ad-request-report-v1"),
    evidenceRunbook.includes("rewarded-ad-request-report.template.json"),
    evidenceRunbook.includes("do not use reserved or placeholder"),
    evidenceRunbook.includes("privacyDisclosureReviewId"),
    evidenceRunbook.includes("store.releasePreflightCommand"),
    evidenceRunbook.includes("Purchase verification report ID"),
    evidenceRunbook.includes("numeric StoreKit format"),
    evidenceRunbook.includes("sha256-<64-hex-chars>"),
    evidenceRunbook.includes("store.iosPurchaseRunId"),
    evidenceRunbook.includes("store.iosPurchaseArtifact"),
    evidenceRunbook.includes("store.androidRestoreRunId"),
    evidenceRunbook.includes("store.androidRestoreArtifact"),
    evidenceRunbook.includes("rewardedAdCompletionRunId"),
    evidenceRunbook.includes("rewardedAdCompletionArtifact"),
    evidenceRunbook.includes("rewardedAdRequestArtifact"),
    evidenceRunbook.includes("freed-store-intervention-flow-report-v1"),
    evidenceRunbook.includes("store-intervention-flow-report.templates.json"),
    evidenceRunbook.includes("privacyDisclosureArtifact"),
    evidenceRunbook.includes("freed-store-privacy-disclosure-report-v1"),
    evidenceRunbook.includes("store-privacy-disclosure-report.template.json"),
    evidenceRunbook.includes("raw receipts"),
    evidenceRunbook.includes("ad-network secrets"),
    evidenceRunbook.includes("Safety eval result summary"),
    evidenceRunbook.includes("ai.releasePreflightCommand"),
    evidenceRunbook.includes("No-sensitive-echo sample count"),
    evidenceRunbook.includes("ai.coachSmokeRunId"),
    evidenceRunbook.includes("ai.coachSmokeArtifact"),
    evidenceRunbook.includes("ai.challengeSmokeRunId"),
    evidenceRunbook.includes("ai.challengeSmokeArtifact"),
    evidenceRunbook.includes("ai.noSensitiveEchoRunId"),
    evidenceRunbook.includes("ai.noSensitiveEchoArtifact"),
    evidenceRunbook.includes("ai.safetyEvalArtifact"),
    evidenceRunbook.includes("ai.providerFallbackArtifact"),
    evidenceRunbook.includes("raw prompts"),
    evidenceRunbook.includes("provider API keys"),
    evidenceRunbook.includes("ios.isPhysicalDevice=true"),
    evidenceRunbook.includes("docs/store-policy/ios-screen-time-safari-dns-review.md"),
    evidenceRunbook.includes("--app <signed-freed-app-or-ipa>"),
    evidenceRunbook.includes("ios-app-package-proof.json"),
    evidenceRunbook.includes("packageProofUsableForManualEvidence=true"),
    evidenceRunbook.includes("ios.familyControlsAuthorizationRunId"),
    evidenceRunbook.includes("ios.familyControlsAuthorizationArtifact"),
    evidenceRunbook.includes("ios.familyActivityPickerAppLimitScheduledImmediately=true"),
    evidenceRunbook.includes("ios.familyActivityPickerAppLimitActivityName=freed.selectedAppDailyLimit"),
    evidenceRunbook.includes("ios.familyActivityPickerAppLimitEventName=freed.selectedAppDailyLimitReached"),
    evidenceRunbook.includes("familyActivityPickerSchedulesDailyLimit=true"),
    evidenceRunbook.includes("ios.selectedAppDailyLimitRunId"),
    evidenceRunbook.includes("freed.selectedAppDailyLimitReached"),
    evidenceRunbook.includes("ios.selectedAppDailyLimitReachedToday=true"),
    evidenceRunbook.includes("ios.safariContentBlockerEmbedded=true"),
    evidenceRunbook.includes("ios.safariContentBlockerBuildRunId"),
    evidenceRunbook.includes("safariRuleFailures"),
    evidenceRunbook.includes("ios.safariContentBlockerReloadRunId"),
    evidenceRunbook.includes("ios.safariContentBlockerChecksum"),
    evidenceRunbook.includes("freed-ios-safari-content-blocker-report-v1"),
    evidenceRunbook.includes("safariContentBlockerAdultBlock"),
    evidenceRunbook.includes("ios.earnedUnlockAppAllowRunId"),
    evidenceRunbook.includes("ios.earnedUnlockRelockArtifact"),
    evidenceRunbook.includes("ios.earnedUnlockActivityName=freed.earnedUnlockWindow"),
    evidenceRunbook.includes("ios.earnedUnlockSelectedTokenCount"),
    evidenceRunbook.includes("ios.earnedUnlockAdultFilterStillActive"),
    evidenceRunbook.includes("ios.earnedUnlockSourceHost=screen-time-shield.freed.local"),
    evidenceRunbook.includes("ios.earnedUnlockRejectedSourceRunId"),
    evidenceRunbook.includes("ios.earnedUnlockRejectedSelectedShieldsStayedActive=true"),
    evidenceRunbook.includes("earnedUnlockRejectsNonScreenTimeSource=true"),
    evidenceRunbook.includes("ios.challengePhotoClassifier=Vision"),
    evidenceRunbook.includes("freed-challenge-photo-report-v1"),
    evidenceRunbook.includes("freed-challenge-motion-report-v1"),
    evidenceRunbook.includes("freed-challenge-steps-report-v1"),
    evidenceRunbook.includes("freed-challenge-location-report-v1"),
    evidenceRunbook.includes("freed-short-form-surface-report-v1"),
    evidenceRunbook.includes("ios.challengePhotoNoBase64OrExif=true"),
    evidenceRunbook.includes("raw-photo-not-persisted"),
    evidenceRunbook.includes("ios.challengeLocationBestAccuracyMeters<=80"),
    evidenceRunbook.includes("ios.shieldActionHandoffRunId"),
    evidenceRunbook.includes("ios.adultInterceptArtifact"),
    evidenceRunbook.includes("android.isPhysicalDevice=true"),
    evidenceRunbook.includes("android.chromeInterceptRunId"),
    evidenceRunbook.includes("android.chromeInterceptArtifact"),
    evidenceRunbook.includes("freed-android-app-intervention-report-v1"),
    evidenceRunbook.includes("freed-android-earned-unlock-report-v1"),
    evidenceRunbook.includes("freed-android-browser-earned-unlock-report-v1"),
    evidenceRunbook.includes("freed-android-browser-intercept-report-v1"),
    evidenceRunbook.includes("freed-android-permission-report-v1"),
    evidenceRunbook.includes("freed-permission-wizard-report-v1"),
    evidenceRunbook.includes("--permission-proof"),
    evidenceRunbook.includes("--native-status-proof"),
    evidenceRunbook.includes("android.accessibilityPermissionArtifact"),
    evidenceRunbook.includes("androidSettingsRouteComponent"),
    evidenceRunbook.includes("android.usageAccessPermissionArtifact"),
    evidenceRunbook.includes("android.notificationPermissionArtifact"),
    evidenceRunbook.includes("runtime notification prompt"),
    evidenceRunbook.includes("android.usageStatsAuthorized=true"),
    evidenceRunbook.includes("android.usageStatsObservedPackageNames"),
    evidenceRunbook.includes("android.usageStatsTodayMinutes"),
    evidenceRunbook.includes("android.usageStatsTodayMinutesByPackage"),
    evidenceRunbook.includes("--scenario focused-search"),
    evidenceRunbook.includes("--focused-search-query"),
    evidenceRunbook.includes("--focused-webview-proof"),
    evidenceRunbook.includes("--scenario synced-feed"),
    evidenceRunbook.includes("--adult-domain-feed-host"),
    evidenceRunbook.includes("--dns-guard-proof"),
    evidenceRunbook.includes("--dns-guard-host"),
    evidenceRunbook.includes("--back-stack-check"),
    evidenceRunbook.includes("android.backStackCleanupArtifact"),
    evidenceRunbook.includes("android.focusedBrowserSearchRunId"),
    evidenceRunbook.includes("android.focusedBrowserSearchRedactedHost=focused-search.app.freed.local"),
    evidenceRunbook.includes("android.focusedBrowserSearchRawQueryStored=false"),
    evidenceRunbook.includes("android.focusedWebViewArtifact"),
    evidenceRunbook.includes("android.configuredAppShieldPackage"),
    evidenceRunbook.includes("android.configuredAppShieldDailyLimitMinutes"),
    evidenceRunbook.includes("android.configuredAppShieldBeforeLimitAllowRunId"),
    evidenceRunbook.includes("android.configuredAppShieldUsageAtInterventionMinutes"),
    evidenceRunbook.includes("android.earnedUnlockAppAllowRunId"),
    evidenceRunbook.includes("android.earnedUnlockRelockRunId"),
    evidenceRunbook.includes("android.earnedUnlockSourcePackage"),
    evidenceRunbook.includes("android.earnedUnlockRelockUsageMinutes"),
    evidenceRunbook.includes("android.challengePhotoClassifier=ML Kit"),
    evidenceRunbook.includes("android.challengePhotoNoBase64OrExif=true"),
    evidenceRunbook.includes("android.challengeLocationBestAccuracyMeters<=80"),
    evidenceRunbook.includes("android.browserEarnedUnlockNoAppUnlockRunId"),
    evidenceRunbook.includes("android.browserEarnedUnlockSourceHost"),
    evidenceRunbook.includes("android.browserEarnedUnlockNativeAppUnlockActive=false"),
    evidenceRunbook.includes("android.browserEarnedUnlockConfiguredAppStillShielded=true"),
    evidenceRunbook.includes("android.browserEarnedUnlockAdultFilterStillActive=true"),
    evidenceRunbook.includes("android.dnsGuardBlockArtifact"),
    evidenceRunbook.includes("freed-dns-guard-block-report-v1"),
    evidenceRunbook.includes("android.dnsGuardInterventionVisible=true"),
    evidenceRunbook.includes("android.dnsGuardLifecycleArtifact"),
    evidenceRunbook.includes("freed-dns-guard-lifecycle-report-v1"),
    evidenceRunbook.includes("android.dnsGuardRestartArtifact"),
    evidenceRunbook.includes("freed-dns-guard-restart-report-v1"),
    evidenceRunbook.includes("freed-android-adult-domain-feed-status-report-v1"),
    evidenceRunbook.includes("android.dnsGuardSessionQueries"),
    evidenceRunbook.includes("android.dnsGuardBlockedQueries"),
    evidenceRunbook.includes("android.dnsGuardAllowedQueries"),
    evidenceRunbook.includes("android.dnsGuardServfailResponses"),
    evidenceRunbook.includes("android.dnsGuardMalformedPackets"),
    evidenceRunbook.includes("android.adultDomainFeedStatusRunId"),
    evidenceRunbook.includes("android.adultDomainFeedAccessibilityArtifact"),
    evidenceRunbook.includes("android.adultDomainFeedDnsGuardArtifact"),
    evidenceRunbook.includes("fnv1a32:<8-hex>"),
    evidenceRunbook.includes("android.playPolicySpecialUseFgsReviewId"),
    evidenceRunbook.includes("android.playPolicySpecialUseFgsArtifact"),
    evidenceRunbook.includes("docs/store-policy/android-accessibility-and-fgs-disclosure.md"),
    evidenceRunbook.includes("ios-physical-device-evidence-fill-template.json"),
    evidenceRunbook.includes("android-real-browser-evidence-fill-template.json"),
    evidenceRunbook.includes("store-ad-sandbox-evidence-fill-template.json"),
    evidenceRunbook.includes("ai-backend-smoke-evidence-fill-template.json"),
    evidenceRunbook.includes("normalBrowsing.classifierCorpusFailedCount=0"),
    evidenceRunbook.includes("normal-browsing-browser-checklist.md"),
    evidenceRunbook.includes("normal-browsing-browser-summary.template.json"),
    evidenceRunbook.includes("browser-report-templates/*.template.json"),
    evidenceRunbook.includes("normal-browsing-evidence-fill-template.json"),
    evidenceRunbook.includes("equal to the current corpus length"),
    evidenceRunbook.includes("must be unique within their URL group"),
    evidenceRunbook.includes("normalBrowsing.browserMatrix"),
    evidenceRunbook.includes("isPhysicalDevice=true"),
    evidenceRunbook.includes("resultArtifact"),
    evidenceRunbook.includes("freed-normal-browsing-browser-report-v1"),
    evidenceRunbook.includes("falsePositiveCount=0"),
    evidenceRunbook.includes("missedAdultBlockCount=0"),
    evidenceRunbook.includes("profile.platformProfiles"),
    evidenceRunbook.includes("--android-background-cpu-proof"),
    evidenceRunbook.includes("profiler/report artifact"),
    evidenceRunbook.includes("background CPU run ID/artifact/percent"),
    evidenceRunbook.includes("freed-routing-proof-report-v1"),
    evidenceRunbook.includes("network-speed run ID/artifact"),
    evidenceRunbook.includes("numeric speed/latency values are rejected without matching local JSON report artifacts"),
    evidenceRunbook.includes("freed-network-speed-report-v1"),
    evidenceRunbook.includes("freed-dns-latency-report-v1"),
    evidenceRunbook.includes("profile.platformProfiles[].backgroundCpuPercent <= 5"),
    evidenceRunbook.includes("noContinuousImageClassificationConfirmed=true"),
    evidenceRunbook.includes("performance-profile-evidence-fill-template.json"),
    evidenceRunbook.includes("no-full-traffic-proxy proof"),
    tests.includes("validation evidence scaffold writes drafts outside release evidence gate"),
    tests.includes("validation evidence workflow refuses release-gated draft paths"),
    tests.includes("store and AI evidence helpers reject malformed release env files before capture"),
    tests.includes("store and AI evidence helpers reject bad env-file environment values before capture"),
    tests.includes("FREED_RELEASE_ENV_FILE: \"https://secrets.freedrecovery.app/prod.env\""),
    tests.includes("--release-env-file line 4 repeats GOOD from line 1"),
    tests.includes("outside-workspace"),
    tests.includes("draft evidence directory must be outside docs\\/validation\\/evidence"),
    tests.includes("rawReceipt must be omitted"),
    tests.includes("rawPrompt must be omitted"),
    tests.includes("reservedAdCountryFailing"),
    tests.includes("dateFailing"),
    tests.includes("futureDateFailing"),
    tests.includes("safariContentBlockerFailing"),
    tests.includes("safariContentBlockerAdultBlockArtifact\\.checks\\.noPacketInspection"),
    tests.includes("android\\.tiktokFeedArtifact\\.checks\\.noScreenshotAnalysis"),
    tests.includes("android\\.earnedUnlockRelockArtifact\\.checks\\.samePackageRelocked"),
    tests.includes("android\\.browserEarnedUnlockNoAppUnlockArtifact\\.checks\\.nativeAppUnlockNotActivated"),
    tests.includes("iosEarnedUnlockFailing"),
    tests.includes("earnedUnlockRejectedSourceHost"),
    tests.includes("iosChallengeEvidenceFailing"),
    tests.includes("earnedUnlockRelockFailing"),
    tests.includes("androidChallengeEvidenceFailing"),
    tests.includes("duplicateUrlFailing"),
    tests.includes("iosTransactionFailing"),
    tests.includes("payloadWideSensitiveTextFailing"),
    tests.includes("nestedApprovedStoreFieldNameFailing"),
    tests.includes("nestedApprovedAiFieldNameFailing"),
    tests.includes("releasePreflightCommand must be npm run preflight:release-env"),
    tests.includes("full sha256 hash label"),
    tests.includes("backgroundCpuRunId must use a concrete machine-readable ID"),
    tests.includes("backgroundCpuPercent must be between 0 and 5"),
    tests.includes("routingProofArtifact\\.sanitized must be true"),
    tests.includes("routingProofArtifact\\.checks\\.noFullTrafficProxyConfirmed"),
    tests.includes("networkSpeedArtifact\\.metrics\\.downloadMbpsDuring"),
    tests.includes("dnsLatencyArtifact\\.checks\\.dnsLatencyWithinThreshold"),
    tests.includes("challengePhotoArtifact\\.checks\\.noContinuousImageClassification"),
    tests.includes("challengeLocationArtifact\\.checks\\.noRawCoordinatesPersisted"),
    tests.includes("shortFormSelectedSurfaceArtifact\\.checks\\.noScreenshotAnalysis"),
    tests.includes("dnsGuardBlockArtifact\\.checks\\.adultDomainBlocked"),
    tests.includes("dnsGuardLifecycleArtifact\\.checks\\.foregroundServiceVisible"),
    tests.includes("dnsGuardRestartArtifact\\.sanitized must be true"),
    tests.includes("dnsGuardRestartSkippedArtifact\\.checks\\.noSilentVpnPermissionPrompt"),
    tests.includes("resultArtifact\\.counts\\.allowedUrlCount"),
    tests.includes("resultArtifact\\.checks\\.noFalsePositives"),
    tests.includes("unsafeProtectionModeFailing"),
    validator.includes("UNSAFE_PROTECTION_MODE_TERMS"),
    validator.includes("challengePhotoReportIssues"),
    validator.includes("freed-challenge-photo-report-v1"),
    validator.includes("challengePhotoArtifact.sanitized must be true"),
    validator.includes("challengeMotionReportIssues"),
    validator.includes("freed-challenge-motion-report-v1"),
    validator.includes("challengeMotionArtifact.sanitized must be true"),
    validator.includes("challengeStepsReportIssues"),
    validator.includes("freed-challenge-steps-report-v1"),
    validator.includes("challengeStepsArtifact.sanitized must be true"),
    validator.includes("challengeLocationReportIssues"),
    validator.includes("freed-challenge-location-report-v1"),
    validator.includes("challengeLocationArtifact.sanitized must be true"),
    validator.includes("androidAppInterventionReportIssues"),
    validator.includes("freed-android-app-intervention-report-v1"),
    validator.includes("androidEarnedUnlockReportIssues"),
    validator.includes("freed-android-earned-unlock-report-v1"),
    validator.includes("androidBrowserEarnedUnlockNoAppUnlockReportIssues"),
    validator.includes("freed-android-browser-earned-unlock-report-v1"),
    validator.includes("shortFormSurfaceReportIssues"),
    validator.includes("freed-short-form-surface-report-v1"),
    topLevelPlatformSanitizedReportIssueCount >= 9,
    validator.includes("androidBrowserInterceptReportIssues"),
    validator.includes("freed-android-browser-intercept-report-v1"),
    validator.includes("dnsGuardBlockReportIssues"),
    validator.includes("freed-dns-guard-block-report-v1"),
    validator.includes("dnsGuardLifecycleReportIssues"),
    validator.includes("freed-dns-guard-lifecycle-report-v1"),
    validator.includes("normalBrowsingBrowserReportIssues"),
    validator.includes("freed-normal-browsing-browser-report-v1"),
    validator.includes("resultArtifact.sanitized must be true"),
    validator.includes("performanceRoutingProofReportIssues"),
    validator.includes("freed-routing-proof-report-v1"),
    validator.includes("routingProofArtifact.sanitized must be true"),
    validator.includes("performanceNetworkSpeedReportIssues"),
    validator.includes("freed-network-speed-report-v1"),
    validator.includes("networkSpeedArtifact.sanitized must be true"),
    validator.includes("performanceDnsLatencyReportIssues"),
    validator.includes("freed-dns-latency-report-v1"),
    validator.includes("dnsLatencyArtifact.sanitized must be true"),
    validator.includes("not full VPN, full traffic proxying, packet inspection, or MITM HTTPS"),
    tests.includes("browserEarnedUnlockDoesNotUnlockApps"),
    tests.includes("permissionWizardRunId"),
    tests.includes("permissionExplanationSummary"),
    tests.includes("permissionWizardArtifact\\.sanitized must be true"),
    tests.includes("iosPermissionWizardFailing"),
    tests.includes("androidPermissionWizardFailing"),
    tests.includes("accessibilityPermissionArtifact\\.sanitized must be true"),
    tests.includes("usageAccessPermissionArtifact\\.checks\\.usageStatsAuthorized"),
    tests.includes("usageAccessPermissionArtifact\\.androidSettingsRouteOpened must be android\\.settings\\.USAGE_ACCESS_SETTINGS"),
    tests.includes("usageAccessPermissionArtifact\\.checks\\.noSilentUsageAccessGrant"),
    tests.includes("adultDomainFeedStatusArtifact\\.sanitized must be true"),
    tests.includes("adultDomainFeedAccessibilityArtifact\\.checks\\.syncedAdultDomainFeedUsed"),
    tests.includes("chromeInterceptArtifact\\.checks\\.accessibilityEventUsed"),
    tests.includes("--app-scenario browser-earned-unlock"),
    tests.includes("validation evidence promotion validates every draft before copying")
  ];

  return passOrFail(
    "validation-evidence-workflow",
    checks.every(Boolean),
    "Schema-versioned evidence requirements, scaffold capture plans, machine-readable production env checklist, machine-readable handoff document commands, canonical capture-plan command sections, TypeScript entrypoint cleanup, checked-in artifact privacy audit, checked-in draft-package plus handoff-doc production-env/no-secret drift checks, iOS physical-device, Android install QA plus real-browser, normal-browsing corpus, performance, store/ad sandbox, and AI backend smoke capture helpers, unsafe draft-dir and capture output-dir rejection, draft validation, background CPU performance proof, and fail-closed promotion commands are wired and documented.",
    "Restore validation evidence scaffold/draft/promote scripts, docs, and tests before release evidence capture."
  );
}

function auditStoreLaunchConfig(): AuditItem {
  const missing: string[] = [];

  const addMissing = (condition: boolean, label: string) => {
    if (!condition) missing.push(label);
  };

  let eas: any = null;
  let appJson: any = null;
  let products: any = null;
  let screenshotManifest: any = null;
  let listingScreenshotTemplate: any = null;

  try {
    eas = has("eas.json") ? JSON.parse(read("eas.json")) : null;
  } catch {
    missing.push("valid eas.json");
  }

  try {
    appJson = has("app.json") ? JSON.parse(read("app.json")) : null;
  } catch {
    missing.push("valid app.json");
  }

  try {
    products = has("store/store-products.json") ? JSON.parse(read("store/store-products.json")) : null;
  } catch {
    missing.push("valid store/store-products.json");
  }

  try {
    screenshotManifest = has("store/screenshots/manifest.json") ? JSON.parse(read("store/screenshots/manifest.json")) : null;
  } catch {
    missing.push("valid store/screenshots/manifest.json");
  }

  try {
    listingScreenshotTemplate = has("store/screenshots/listing/manifest.template.json")
      ? JSON.parse(read("store/screenshots/listing/manifest.template.json"))
      : null;
  } catch {
    missing.push("valid store/screenshots/listing/manifest.template.json");
  }

  const packageJson = has("package.json") ? read("package.json") : "";
  const privacyPolicy = has("store/privacy-policy.md") ? read("store/privacy-policy.md") : "";
  const appStoreMetadata = has("store/app-store/metadata.md") ? read("store/app-store/metadata.md") : "";
  const appStorePrivacy = has("store/app-store/app-privacy.md") ? read("store/app-store/app-privacy.md") : "";
  const playStoreMetadata = has("store/play-store/metadata.md") ? read("store/play-store/metadata.md") : "";
  const playStoreProductsCsv = has("store/play-store/products.csv") ? read("store/play-store/products.csv") : "";
  const playStoreDataSafety = has("store/play-store/data-safety.md") ? read("store/play-store/data-safety.md") : "";
  const appStorePurchasesCsv = has("store/app-store/in-app-purchases.csv") ? read("store/app-store/in-app-purchases.csv") : "";
  const consoleLaunchPacket = has("store/console-launch-packet.md") ? read("store/console-launch-packet.md") : "";
  const listingScreenshotPlan = has("store/screenshots/listing-screenshot-plan.md")
    ? read("store/screenshots/listing-screenshot-plan.md")
    : "";
  const pricingEconomics = has("store/pricing-economics.md") ? read("store/pricing-economics.md") : "";
  const submissionChecklist = has("store/release-submission-checklist.md") ? read("store/release-submission-checklist.md") : "";
  const easSubmitGuard = has("scripts/eas-submit-guard.js") ? read("scripts/eas-submit-guard.js") : "";
  const easWorkflowAudit = has("scripts/eas-workflow-audit.js") ? read("scripts/eas-workflow-audit.js") : "";
  const easInternalWorkflow = has(".eas/workflows/freed-internal-builds.yml") ? read(".eas/workflows/freed-internal-builds.yml") : "";
  const easStoreWorkflow = has(".eas/workflows/freed-store-builds.yml") ? read(".eas/workflows/freed-store-builds.yml") : "";
  const smokeHarnessAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const publicPrivacyRoute = has("app/privacy.tsx") ? read("app/privacy.tsx") : "";
  const publicSupportRoute = has("app/support.tsx") ? read("app/support.tsx") : "";
  const publicDeletionRoute = has("app/account-deletion.tsx") ? read("app/account-deletion.tsx") : "";
  const legalPages = has("src/features/legal-pages.tsx") ? read("src/features/legal-pages.tsx") : "";
  const privacyMap = has("docs/privacy-data-map.md") ? read("docs/privacy-data-map.md") : "";
  const androidPolicy = has("docs/store-policy/android-accessibility-and-fgs-disclosure.md")
    ? read("docs/store-policy/android-accessibility-and-fgs-disclosure.md")
    : "";
  const iosPolicy = has("docs/store-policy/ios-screen-time-safari-dns-review.md")
    ? read("docs/store-policy/ios-screen-time-safari-dns-review.md")
    : "";

  addMissing(eas?.cli?.appVersionSource === "remote", "EAS remote app version source");
  addMissing(Boolean(eas?.build?.internal && eas?.build?.production), "EAS internal and production build profiles");
  addMissing(eas?.build?.internal?.android?.buildType === "apk", "EAS internal Android APK profile");
  addMissing(eas?.build?.production?.android?.buildType === "app-bundle", "EAS production Android app-bundle profile");
  addMissing(eas?.build?.production?.channel === "production", "EAS production channel");
  addMissing(eas?.submit?.production?.android?.track === "internal", "Play submit stays on internal track before promotion");
  addMissing(eas?.submit?.production?.android?.releaseStatus === "draft", "Play submit releaseStatus stays draft before evidence passes");
  addMissing(eas?.submit?.production?.ios && typeof eas.submit.production.ios === "object", "iOS EAS submit profile placeholder");
  addMissing(packageJson.includes('"eas:build:internal"'), "internal EAS build npm script");
  addMissing(packageJson.includes('"eas:build:production"'), "production EAS build npm script");
  addMissing(packageJson.includes('"eas:submit:internal"'), "internal EAS submit npm script");
  addMissing(packageJson.includes('"eas:submit:production"'), "production EAS submit npm script");
  addMissing(
    packageJson.includes('"eas:submit:internal": "node -- scripts/eas-submit-guard.js --profile internal"') &&
      packageJson.includes('"eas:submit:production": "node -- scripts/eas-submit-guard.js --profile production"'),
    "EAS submit npm scripts route through guarded wrapper"
  );
  addMissing(
    easSubmitGuard.includes("freed-eas-submit-guard-v1") &&
      easSubmitGuard.includes("FREED_STORE_PRODUCTION_SUBMIT_APPROVED") &&
      easSubmitGuard.includes("strict-release-evidence-pass") &&
      easSubmitGuard.includes("production EAS submit must stay on the Play internal track before evidence approval") &&
      easSubmitGuard.includes("production EAS submit must keep Play releaseStatus as draft before evidence approval") &&
      easSubmitGuard.includes("submitForReview") &&
      easSubmitGuard.includes("eas submit guard self-test: pass"),
    "EAS submit guard blocks live-submit drift before evidence approval"
  );
  addMissing(
    smokeHarnessAudit.includes("eas submit guard syntax") &&
      smokeHarnessAudit.includes("eas submit guard self-test"),
    "EAS submit guard smoke harness coverage"
  );
  addMissing(
    smokeHarnessAudit.includes("FREED_SMOKE_HARNESS_CHECK_TIMEOUT_MS") &&
      smokeHarnessAudit.includes("timeout: checkTimeoutMs") &&
      smokeHarnessAudit.includes("Timed out after ${timeoutMs}ms."),
    "bounded smoke harness check timeout"
  );
  addMissing(packageJson.includes('"audit:eas-workflows": "node -- scripts/eas-workflow-audit.js"'), "EAS workflow audit npm script");
  addMissing(
    easInternalWorkflow.includes("FREED Internal QA Builds") &&
      easInternalWorkflow.includes("workflow_dispatch") &&
      easInternalWorkflow.includes("profile: internal") &&
      easInternalWorkflow.includes("platform: android") &&
      easInternalWorkflow.includes("platform: ios") &&
      easInternalWorkflow.includes("refresh_ad_hoc_provisioning_profile: true") &&
      easInternalWorkflow.includes("npm run eas:submit:internal -- --dry-run"),
    "manual EAS internal QA workflow"
  );
  addMissing(
    easStoreWorkflow.includes("FREED Store Artifact Builds") &&
      easStoreWorkflow.includes("workflow_dispatch") &&
      easStoreWorkflow.includes("profile: production") &&
      easStoreWorkflow.includes("platform: android") &&
      easStoreWorkflow.includes("platform: ios") &&
      easStoreWorkflow.includes("npm run audit:smoke-harnesses") &&
      easStoreWorkflow.includes("npm run eas:submit:production -- --dry-run") &&
      easStoreWorkflow.includes("Do not run live production submission from EAS Workflows") &&
      easStoreWorkflow.includes("strict-release-evidence-pass") &&
      !easStoreWorkflow.includes("type: submit"),
    "manual EAS store artifact workflow with no live submit job"
  );
  addMissing(
    easWorkflowAudit.includes("freed-internal-builds.yml") &&
      easWorkflowAudit.includes("freed-store-builds.yml") &&
      easWorkflowAudit.includes("store-no-submit-job") &&
      easWorkflowAudit.includes("store-submit-boundary") &&
      easWorkflowAudit.includes("eas workflow audit self-test: pass") &&
      smokeHarnessAudit.includes("eas workflow audit self-test") &&
      smokeHarnessAudit.includes("eas workflow audit"),
    "EAS workflow audit smoke harness coverage"
  );
  addMissing(packageJson.includes('"build:android-aab:upload-signed"'), "local upload-signed Android AAB build npm script");
  addMissing(packageJson.includes('"build:ios-archive:release"'), "local signed iOS Release archive npm script");
  addMissing(appJson?.expo?.ios?.bundleIdentifier === "app.freed.recovery", "iOS bundle identifier");
  addMissing(appJson?.expo?.android?.package === "app.freed.recovery", "Android package identifier");
  addMissing(appJson?.expo?.web?.output === "static", "Expo web static output for public store pages");

  const launchProductIds = Array.isArray(products?.launchProductIds) ? products.launchProductIds : [];
  const requiredLaunchPlanIdsInOrder = ["yearly", "monthly", "lifetime"];
  const requiredLaunchProductIdsInOrder = [
    "freed_premium_yearly",
    "freed_premium_monthly",
    "freed_premium_lifetime"
  ];
  const csvPlanOrder = (csv: string) =>
    csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(",", 1)[0])
      .filter(Boolean);
  const orderMatches = (actual: string[], expected: string[]) =>
    actual.length === expected.length && expected.every((value, index) => actual[index] === value);
  const launchProductSet = new Set(launchProductIds);
  const productPlanIds = Array.isArray(products?.products)
    ? products.products.map((product: { planId?: string }) => product.planId).filter(Boolean)
    : [];
  const productIdSet = new Set(
    Array.isArray(products?.products)
      ? products.products.map((product: { productId?: string }) => product.productId).filter(Boolean)
      : []
  );
  const productRows = Array.isArray(products?.products) ? products.products : [];
  const productByPlan = new Map(
    productRows.map((product: { planId?: string }) => [product.planId, product])
  );
  const requiredProductConfigs = [
    {
      appleType: "auto-renewable-subscription",
      billingPeriod: "P1M",
      googleType: "subscription",
      planId: "monthly",
      productId: "freed_premium_monthly",
      reviewScreenshot: "store/screenshots/paywall-monthly.png"
    },
    {
      appleType: "auto-renewable-subscription",
      billingPeriod: "P1Y",
      googleType: "subscription",
      planId: "yearly",
      productId: "freed_premium_yearly",
      reviewScreenshot: "store/screenshots/paywall-yearly.png"
    },
    {
      appleType: "non-consumable",
      billingPeriod: "lifetime",
      googleType: "one-time-product",
      planId: "lifetime",
      productId: "freed_premium_lifetime",
      reviewScreenshot: "store/screenshots/paywall-lifetime.png"
    }
  ];
  const hasPerStoreProductMetadata = requiredProductConfigs.every((config) => {
    const product = productByPlan.get(config.planId) as {
      apple?: Record<string, unknown>;
      google?: Record<string, unknown>;
      priceUsd?: string;
      productId?: string;
    } | undefined;
    const apple = product?.apple ?? {};
    const google = product?.google ?? {};
    const appleLocalization = apple.localizations as Record<string, { displayName?: string; description?: string }> | undefined;
    const googleLocalization = google.localizations as Record<string, { displayName?: string; description?: string }> | undefined;
    const appleDescription = appleLocalization?.["en-US"]?.description ?? "";
    const googleDescription = googleLocalization?.["en-US"]?.description ?? "";
    return (
      product?.productId === config.productId &&
      apple.productId === config.productId &&
      apple.productType === config.appleType &&
      apple.referenceName &&
      apple.priceUsdIntent === product.priceUsd &&
      apple.reviewScreenshot === config.reviewScreenshot &&
      appleDescription.includes("DNS Guard") &&
      google.productId === config.productId &&
      google.productType === config.googleType &&
      google.billingPeriod === config.billingPeriod &&
      google.priceUsdIntent === product.priceUsd &&
      google.status === "draft-until-sandbox-verified" &&
      googleDescription.includes("no-ad challenge entry") &&
      (config.planId === "lifetime" || apple.subscriptionGroupId === "freed_premium") &&
      (config.planId === "lifetime" || google.basePlanId === config.planId) &&
      (config.planId !== "lifetime" || google.purchaseType === "non-consumable")
    );
  });
  const economicsRows = Array.isArray(products?.launchEconomics?.plans) ? products.launchEconomics.plans : [];
  const economicsByPlan = new Map(economicsRows.map((row: { planId?: string }) => [row.planId, row]));
  const hasLaunchEconomics =
    products?.launchEconomics?.schemaVersion === "freed-launch-economics-v1" &&
    products?.launchEconomics?.source === "store/pricing-economics.md" &&
    products?.launchEconomics?.conservativeStoreFeePercent === 30 &&
    products?.launchEconomics?.optimizedStoreFeePercent === 15 &&
    products?.launchEconomics?.monthlyReferenceGrossUsd === "9.99" &&
    products?.launchEconomics?.serverVerificationRequired === true &&
    products?.launchEconomics?.rewardedAdsOnlyForFreeUsers === true &&
    products?.launchEconomics?.premiumNoAdChallengeEntry === true &&
    economicsByPlan.get("monthly")?.productId === "freed_premium_monthly" &&
    economicsByPlan.get("monthly")?.estimatedNetUsdAt30PercentStoreFee === "6.99" &&
    economicsByPlan.get("monthly")?.estimatedNetUsdAt15PercentStoreFee === "8.49" &&
    economicsByPlan.get("yearly")?.productId === "freed_premium_yearly" &&
    economicsByPlan.get("yearly")?.monthlyEquivalentGrossUsd === "3.33" &&
    economicsByPlan.get("yearly")?.discountVsMonthlyPercent === 67 &&
    economicsByPlan.get("yearly")?.profitabilityRole === "primary-value" &&
    economicsByPlan.get("lifetime")?.productId === "freed_premium_lifetime" &&
    economicsByPlan.get("lifetime")?.breakevenMonthsVsMonthly === 8 &&
    economicsByPlan.get("lifetime")?.breakevenYearsVsYearly === 2 &&
    economicsByPlan.get("lifetime")?.profitabilityRole === "cashflow-anchor";
  addMissing(products?.schemaVersion === "freed-store-products-v1", "store product catalog schema");
  addMissing(products?.bundleId === "app.freed.recovery", "store product catalog bundle ID");
  addMissing(products?.packageName === "app.freed.recovery", "store product catalog package name");
  addMissing(products?.entitlementId === "premium", "premium entitlement id");
  addMissing(products?.subscriptionGroupId === "freed_premium", "premium subscription group id");
  addMissing(
    launchProductIds.length === 3 &&
      launchProductSet.has("freed_premium_monthly") &&
      launchProductSet.has("freed_premium_yearly") &&
      launchProductSet.has("freed_premium_lifetime"),
    "Core 3 launch product ids only"
  );
  addMissing(orderMatches(launchProductIds, requiredLaunchProductIdsInOrder), "Core 3 launch product ids use yearly/monthly/lifetime order");
  addMissing(
    productPlanIds.includes("monthly") && productPlanIds.includes("yearly") && productPlanIds.includes("lifetime"),
    "yearly/monthly/lifetime product plans"
  );
  addMissing(orderMatches(productPlanIds, requiredLaunchPlanIdsInOrder), "Core 3 product catalog uses yearly/monthly/lifetime order");
  addMissing(
    productIdSet.has("freed_premium_monthly") &&
      productIdSet.has("freed_premium_yearly") &&
      productIdSet.has("freed_premium_lifetime"),
    "Core 3 product metadata"
  );
  addMissing(hasPerStoreProductMetadata, "per-store Core 3 console product metadata");
  addMissing(hasLaunchEconomics, "Core 3 launch pricing economics and profitability assumptions");
  addMissing(
    has("store/pricing-economics.md") &&
      pricingEconomics.includes("FREED Launch Pricing Economics") &&
      pricingEconomics.includes("Apple App Store Small Business Program") &&
      pricingEconomics.includes("Google Play service fees") &&
      pricingEconomics.includes("Conservative fee model: 30% store fee") &&
      pricingEconomics.includes("Optimized fee model: 15% store fee") &&
      pricingEconomics.includes("USD 3.33 per month equivalent") &&
      pricingEconomics.includes("8-month breakeven against monthly") &&
      pricingEconomics.includes("Do not promote production until sandbox purchase"),
    "store pricing economics handoff"
  );
  addMissing(
    products?.consoleExportFiles?.appStoreConnectCsv === "store/app-store/in-app-purchases.csv" &&
      products?.consoleExportFiles?.googlePlayCsv === "store/play-store/products.csv",
    "store product console export file references"
  );
  addMissing(
    appStorePurchasesCsv.includes("plan_id,product_id,apple_type,subscription_group_id,duration") &&
      appStorePurchasesCsv.includes("monthly,freed_premium_monthly,auto-renewable-subscription,freed_premium,P1M") &&
      appStorePurchasesCsv.includes("yearly,freed_premium_yearly,auto-renewable-subscription,freed_premium,P1Y") &&
      appStorePurchasesCsv.includes("lifetime,freed_premium_lifetime,non-consumable,,lifetime"),
    "App Store Connect Core 3 IAP CSV"
  );
  addMissing(orderMatches(csvPlanOrder(appStorePurchasesCsv), requiredLaunchPlanIdsInOrder), "App Store Connect IAP CSV uses yearly/monthly/lifetime order");
  const appStoreReviewScreenshotPaths = Array.from(
    new Set(appStorePurchasesCsv.match(/store\/screenshots\/[A-Za-z0-9_.-]+\.png/g) ?? [])
  );
  const screenshotRows = Array.isArray(screenshotManifest?.assets) ? screenshotManifest.assets : [];
  const screenshotByPath = new Map(screenshotRows.map((asset: { path?: string }) => [asset.path, asset]));
  const listingTemplateRows = Array.isArray(listingScreenshotTemplate?.assets) ? listingScreenshotTemplate.assets : [];
  const listingTemplateIds = listingTemplateRows
    .map((asset: { id?: string }) => asset.id)
    .filter(Boolean);
  const requiredListingTemplateIds = [
    "turn-on-real-protection",
    "block-adult-sites-safely",
    "interrupt-app-loops",
    "recover-in-the-moment",
    "keep-privacy-local",
    "upgrade-without-ad-breaks"
  ];
  const requiredStoreScreenshotConfigs = [
    {
      path: "store/screenshots/paywall-monthly.png",
      planId: "monthly",
      productId: "freed_premium_monthly"
    },
    {
      path: "store/screenshots/paywall-yearly.png",
      planId: "yearly",
      productId: "freed_premium_yearly"
    },
    {
      path: "store/screenshots/paywall-lifetime.png",
      planId: "lifetime",
      productId: "freed_premium_lifetime"
    }
  ];
  const hasStoreScreenshotManifest =
    screenshotManifest?.schemaVersion === "freed-store-screenshots-v1" &&
    screenshotManifest?.reviewBoundary?.core3Only === true &&
    screenshotManifest?.reviewBoundary?.requiresFreshStoreSandboxScreenshotsBeforeProduction === true &&
    screenshotManifest?.reviewBoundary?.futureProductsHidden?.includes("freed_family_yearly") &&
    screenshotManifest?.reviewBoundary?.futureProductsHidden?.includes("freed_accountability_monthly") &&
    screenshotManifest?.reviewBoundary?.futureProductsHidden?.includes("freed_ai_coach_monthly") &&
    requiredStoreScreenshotConfigs.every((config) => {
      const asset = screenshotByPath.get(config.path) as {
        height?: number;
        planId?: string;
        productId?: string;
        purpose?: string;
        sha256?: string;
        width?: number;
      } | undefined;
      return (
        has(config.path) &&
        appStoreReviewScreenshotPaths.includes(config.path) &&
        asset?.planId === config.planId &&
        asset?.productId === config.productId &&
        asset?.purpose?.includes("IAP review screenshot") &&
        asset?.width === 1180 &&
        asset?.height === 2676 &&
        typeof asset?.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(asset.sha256) &&
        sha256File(config.path) === asset.sha256
      );
    });
  addMissing(
    appStoreReviewScreenshotPaths.length === 3 &&
      appStoreReviewScreenshotPaths.every((screenshotPath) => has(screenshotPath)),
    "App Store IAP review screenshot files"
  );
  addMissing(hasStoreScreenshotManifest, "store screenshot manifest and Core 3 IAP screenshot checksums");
  addMissing(
    listingScreenshotPlan.includes("FREED Store Listing Screenshot Plan") &&
      listingScreenshotPlan.includes("TURN ON REAL PROTECTION") &&
      listingScreenshotPlan.includes("BLOCK ADULT SITES SAFELY") &&
      listingScreenshotPlan.includes("INTERRUPT APP LOOPS") &&
      listingScreenshotPlan.includes("RECOVER IN THE MOMENT") &&
      listingScreenshotPlan.includes("KEEP PRIVACY LOCAL") &&
      listingScreenshotPlan.includes("UPGRADE WITHOUT AD BREAKS") &&
      listingScreenshotPlan.includes("store/screenshots/listing/manifest.template.json") &&
      listingScreenshotPlan.includes("store/screenshots/listing/manifest.json") &&
      listingScreenshotPlan.includes("Do not use these screenshots as physical-device protection evidence"),
    "App Store / Play listing screenshot capture plan"
  );
  addMissing(
    listingScreenshotTemplate?.schemaVersion === "freed-store-listing-screenshot-template-v1" &&
      listingScreenshotTemplate?.finalManifestPath === "store/screenshots/listing/manifest.json" &&
      listingTemplateRows.length === requiredListingTemplateIds.length &&
      requiredListingTemplateIds.every((id) => listingTemplateIds.includes(id)) &&
      listingTemplateRows.every((asset: { headline?: string; reviewBoundary?: string; screen?: string }) =>
        Boolean(asset.headline && asset.screen && asset.reviewBoundary?.includes("not physical-device protection evidence"))
      ),
    "App Store / Play listing screenshot manifest template"
  );
  addMissing(
    playStoreProductsCsv.includes("plan_id,product_id,product_type,base_plan_id,billing_period") &&
      playStoreProductsCsv.includes("monthly,freed_premium_monthly,subscription,monthly,P1M") &&
      playStoreProductsCsv.includes("yearly,freed_premium_yearly,subscription,yearly,P1Y") &&
      playStoreProductsCsv.includes("lifetime,freed_premium_lifetime,one-time-product,,lifetime"),
    "Google Play Core 3 product CSV"
  );
  addMissing(orderMatches(csvPlanOrder(playStoreProductsCsv), requiredLaunchPlanIdsInOrder), "Google Play product CSV uses yearly/monthly/lifetime order");
  addMissing(
    Array.isArray(products?.futureProductsDisabledForV1) &&
      products.futureProductsDisabledForV1.includes("freed_ai_coach_monthly") &&
      products.futureProductsDisabledForV1.includes("freed_family_yearly") &&
      products.futureProductsDisabledForV1.includes("freed_accountability_monthly"),
    "future product ids disabled for v1"
  );

  addMissing(privacyPolicy.includes("Android Accessibility") && privacyPolicy.includes("DNS-only VPN"), "Android privacy policy permission disclosures");
  addMissing(privacyPolicy.includes("Family Controls") && privacyPolicy.includes("DeviceActivity"), "iOS privacy policy permission disclosures");
  addMissing(privacyPolicy.includes("Purchase verification") && privacyPolicy.includes("support@freedrecovery.app"), "payments/support privacy policy details");
  addMissing(
    appStoreMetadata.includes("Core 3 launch products") &&
      appStoreMetadata.includes("Review Notes") &&
      appStoreMetadata.includes("store/screenshots/manifest.json") &&
      appStoreMetadata.includes("store/screenshots/listing-screenshot-plan.md"),
    "App Store metadata, review notes, and IAP screenshot manifest reference"
  );
  addMissing(appStoreMetadata.includes("Family Controls") && appStoreMetadata.includes("Safari Content Blocker"), "App Store Screen Time/Safari disclosure");
  addMissing(playStoreMetadata.includes("AccessibilityService") && playStoreMetadata.includes("VpnService"), "Play Accessibility/VpnService declarations");
  addMissing(playStoreMetadata.includes("Data Safety Draft") && playStoreMetadata.includes("Family/accountability/AI coach SKUs are disabled for v1"), "Play Data Safety and v1 product declaration");
  addMissing(playStoreMetadata.includes("store/screenshots/listing-screenshot-plan.md"), "Play listing screenshot plan reference");
  addMissing(playStoreDataSafety.includes("FREED Google Play Data Safety Answer Sheet"), "Play Data Safety answer sheet");
  addMissing(
    playStoreDataSafety.includes("Purchase history") &&
      playStoreDataSafety.includes("Device or other IDs") &&
      playStoreDataSafety.includes("App interactions") &&
      playStoreDataSafety.includes("Web browsing history") &&
      playStoreDataSafety.includes("not sent off device"),
    "Play Data Safety collected/not-collected data declarations"
  );
  addMissing(
    playStoreDataSafety.includes("Encryption in transit") &&
      playStoreDataSafety.includes("Data deletion mechanism") &&
      playStoreDataSafety.includes("support@freedrecovery.app") &&
      playStoreDataSafety.includes("Families policy") &&
      playStoreDataSafety.includes("No"),
    "Play Data Safety security/deletion/families answers"
  );
  addMissing(appStorePrivacy.includes("FREED App Store App Privacy Answer Sheet"), "App Store privacy answer sheet");
  addMissing(
    appStorePrivacy.includes("Data used to track users: No") &&
      appStorePrivacy.includes("Purchase History") &&
      appStorePrivacy.includes("Device ID") &&
      appStorePrivacy.includes("Product Interaction") &&
      appStorePrivacy.includes("Browsing History") &&
      appStorePrivacy.includes("not sent off device"),
    "App Store privacy tracking and data-category declarations"
  );
  addMissing(
    appStorePrivacy.includes("Family Controls") &&
      appStorePrivacy.includes("ManagedSettings") &&
      appStorePrivacy.includes("DeviceActivity") &&
      appStorePrivacy.includes("Safari Content Blocker") &&
      appStorePrivacy.includes("dns-settings"),
    "App Store privacy Screen Time/Safari/DNS review alignment"
  );
  addMissing(consoleLaunchPacket.includes("FREED Console Launch Packet"), "store console launch packet");
  addMissing(publicPrivacyRoute.includes("PrivacyPolicyPage"), "public /privacy route");
  addMissing(publicSupportRoute.includes("SupportPage"), "public /support route");
  addMissing(publicDeletionRoute.includes("AccountDeletionPage"), "public /account-deletion route");
  addMissing(
    legalPages.includes("FREED Privacy Policy") &&
      legalPages.includes("Effective date: June 6, 2026") &&
      legalPages.includes("Android Accessibility") &&
      legalPages.includes("DNS-only VPN") &&
      legalPages.includes("Family Controls") &&
      legalPages.includes("DeviceActivity") &&
      legalPages.includes("Purchase verification") &&
      legalPages.includes("Data deletion") &&
      legalPages.includes("support@freedrecovery.app"),
    "public privacy page permission/payment/deletion disclosures"
  );
  addMissing(
    legalPages.includes("FREED Support") &&
      legalPages.includes("Google Play") &&
      legalPages.includes("App Store") &&
      legalPages.includes("AccessibilityService") &&
      legalPages.includes("VpnService") &&
      legalPages.includes("Account deletion"),
    "public support page store and protection support scope"
  );
  addMissing(
    legalPages.includes("FREED Account Deletion") &&
      legalPages.includes("Delete Local Data") &&
      legalPages.includes("hosted encrypted backup sync") &&
      legalPages.includes("purchase audit records") &&
      legalPages.includes("legal retention") &&
      legalPages.includes("https://freedrecovery.app/account-deletion"),
    "public account deletion page local and hosted deletion scope"
  );
  addMissing(
    consoleLaunchPacket.includes("Do not submit production") &&
      consoleLaunchPacket.includes("Play internal track and draft release") &&
      consoleLaunchPacket.includes("App Store Connect/TestFlight beta only"),
    "console packet draft/internal submission guard"
  );
  addMissing(
    consoleLaunchPacket.includes("app.freed.recovery") &&
      consoleLaunchPacket.includes("https://freedrecovery.app/privacy") &&
      consoleLaunchPacket.includes("https://freedrecovery.app/account-deletion") &&
      consoleLaunchPacket.includes("support@freedrecovery.app"),
    "console packet app identifiers and URLs"
  );
  addMissing(
    consoleLaunchPacket.includes("freed_premium_monthly") &&
      consoleLaunchPacket.includes("freed_premium_yearly") &&
      consoleLaunchPacket.includes("freed_premium_lifetime") &&
      consoleLaunchPacket.includes("store/app-store/in-app-purchases.csv") &&
      consoleLaunchPacket.includes("store/play-store/products.csv") &&
      consoleLaunchPacket.includes("store/screenshots/manifest.json") &&
      consoleLaunchPacket.includes("store/screenshots/listing-screenshot-plan.md") &&
      consoleLaunchPacket.includes("store/screenshots/listing/manifest.template.json") &&
      consoleLaunchPacket.includes("subscription group `freed_premium`") &&
      consoleLaunchPacket.includes("base plans `yearly`") &&
      consoleLaunchPacket.includes("`monthly` with billing period `P1M`") &&
      consoleLaunchPacket.includes("store/pricing-economics.md") &&
      consoleLaunchPacket.includes("67% discount against monthly") &&
      consoleLaunchPacket.includes("8-month breakeven against monthly") &&
      consoleLaunchPacket.includes("freed_family_yearly") &&
      consoleLaunchPacket.includes("freed_accountability_monthly") &&
      consoleLaunchPacket.includes("freed_ai_coach_monthly"),
    "console packet Core 3 economics and disabled future product scope"
  );
  addMissing(
    consoleLaunchPacket.includes("Google Play Console Setup") &&
      consoleLaunchPacket.includes("store/play-store/data-safety.md") &&
      consoleLaunchPacket.includes("Data Safety") &&
      consoleLaunchPacket.includes("AccessibilityService") &&
      consoleLaunchPacket.includes("VpnService") &&
      consoleLaunchPacket.includes("npm run build:android-aab:upload-signed") &&
      consoleLaunchPacket.includes("npm run build:ios-archive:release") &&
      consoleLaunchPacket.includes("FREED_ANDROID_UPLOAD_STORE_FILE") &&
      consoleLaunchPacket.includes("CMake exit 137") &&
      consoleLaunchPacket.includes("EAS build URL") &&
      consoleLaunchPacket.includes("Do not use the older side-load APK as proof of latest native code"),
    "console packet Play Data Safety, Accessibility, VPN, Android signing, iOS archive setup, and EAS Android fallback"
  );
  addMissing(
    consoleLaunchPacket.includes("App Store Connect Setup") &&
      consoleLaunchPacket.includes("store/app-store/app-privacy.md") &&
      consoleLaunchPacket.includes("App Privacy") &&
      consoleLaunchPacket.includes("Family Controls") &&
      consoleLaunchPacket.includes("DeviceActivity") &&
      consoleLaunchPacket.includes("Safari Content Blocker"),
    "console packet App Privacy and Screen Time/Safari setup"
  );
  addMissing(
    consoleLaunchPacket.includes("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT") &&
      consoleLaunchPacket.includes("App Store Server API credentials") &&
      consoleLaunchPacket.includes("Google Play service-account credentials") &&
      consoleLaunchPacket.includes("EXPO_PUBLIC_ADMOB_USE_TEST_ADS=false"),
    "console packet payments, server verification, and AdMob production setup"
  );
  addMissing(
    consoleLaunchPacket.includes("docs/validation/evidence/store-ad-sandbox.json") &&
      consoleLaunchPacket.includes("console product setup proof for Core 3 only") &&
      consoleLaunchPacket.includes("docs/validation/evidence/android-real-browser.json") &&
      consoleLaunchPacket.includes("docs/validation/evidence/ios-physical-device.json") &&
      consoleLaunchPacket.includes("docs/validation/evidence/performance-profile.json") &&
      consoleLaunchPacket.includes("docs/validation/evidence/ai-backend-smoke.json"),
    "console packet release evidence checklist"
  );
  addMissing(
    submissionChecklist.includes("Production submission must wait") &&
      submissionChecklist.includes("npm run verify:release") &&
      submissionChecklist.includes("store/screenshots/listing-screenshot-plan.md"),
    "store submission checklist gates"
  );
  addMissing(privacyMap.includes("Accessibility") && privacyMap.includes("purchase"), "privacy data map alignment source");
  addMissing(androidPolicy.includes("AccessibilityService") && androidPolicy.includes("VpnService"), "Android store policy disclosure doc");
  addMissing(iosPolicy.includes("Family Controls") && iosPolicy.includes("Safari"), "iOS store policy disclosure doc");

  return item(
    "store-launch-config",
    readinessStatus(missing),
    missing.length === 0
      ? "EAS build/submit profiles, manual internal/store artifact workflows, workflow audit, and guarded submit wrapper, Core 3 product catalog with App Store/Play console CSV handoff rows, IAP review screenshots with checksummed manifest, listing screenshot capture plan, launch pricing economics, public privacy/support/deletion routes, console launch packet, privacy policy, App Store metadata/privacy answers, Play metadata/Data Safety answers, policy disclosures, and submission checklist are present with production submit kept draft/internal until evidence passes."
      : `Missing: ${missing.join(", ")}.`,
    missing.length === 0
      ? undefined
      : "Restore EAS store profiles, manual EAS workflow handoffs, submit guard, Core 3 launch product metadata, listing screenshot plan/template, economics, public privacy/support/deletion routes, console packet, privacy/policy docs, and draft-gated store submission handoff before release."
  );
}

function auditStoreLegalHostedUrls(): AuditItem {
  const reportPath = "docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json";
  const report = readJsonObject(reportPath);
  const requiredRouteIds = ["privacy", "support", "account-deletion"];
  const requiredCheckIds = requiredRouteIds.flatMap((routeId) => [
    `hosted-status-${routeId}`,
    `hosted-final-url-${routeId}`,
    `hosted-content-type-${routeId}`,
    `hosted-body-${routeId}`,
    `hosted-content-${routeId}`,
    `hosted-indexing-${routeId}`
  ]);
  const missing: string[] = [];

  if (!report) {
    missing.push(`${reportPath} passing hosted URL audit report`);
  } else {
    const checks = Array.isArray(report.checks) ? (report.checks as Array<Record<string, unknown>>) : [];
    const publicUrls = report.publicUrls && typeof report.publicUrls === "object" ? (report.publicUrls as Record<string, unknown>) : {};
    const routeResults = Array.isArray(report.routeResults) ? (report.routeResults as Array<Record<string, unknown>>) : [];
    const passedCheckIds = new Set(
      checks
        .filter((check) => check.status === "pass")
        .map((check) => (typeof check.id === "string" ? check.id : ""))
        .filter(Boolean)
    );
    const failedCheckIds = checks
      .filter((check) => check.status !== "pass")
      .map((check) => (typeof check.id === "string" ? check.id : "unknown"))
      .filter(Boolean);

    if (report.schemaVersion !== "freed-store-legal-hosted-url-audit-v1") {
      missing.push("hosted legal audit schemaVersion=freed-store-legal-hosted-url-audit-v1");
    }
    if (report.sanitized !== true) missing.push("hosted legal audit sanitized=true");
    const freshnessIssue = hostedLegalAuditFreshnessIssue(report);
    if (freshnessIssue) missing.push(freshnessIssue);
    if (report.result !== "pass") missing.push("hosted legal audit result=pass");
    if (report.failCount !== 0) missing.push("hosted legal audit failCount=0");
    if (routeResults.length !== requiredRouteIds.length) missing.push("hosted legal audit routeResults for privacy/support/account-deletion");

    for (const routeId of requiredRouteIds) {
      if (typeof publicUrls[routeId] !== "string" || !String(publicUrls[routeId]).startsWith("https://freedrecovery.app/")) {
        missing.push(`public URL for ${routeId}`);
      }
    }
    const missingCheckIds = requiredCheckIds.filter((checkId) => !passedCheckIds.has(checkId));
    if (missingCheckIds.length > 0) missing.push(`passing hosted checks: ${missingCheckIds.join(", ")}`);
    if (failedCheckIds.length > 0) missing.push(`failed hosted checks: ${failedCheckIds.join(", ")}`);
  }

  return item(
    "store-legal-hosted-url-validation",
    readinessStatus(missing),
    missing.length === 0
      ? `Public privacy, support, and account-deletion URLs have a fresh passing sanitized hosted availability audit at ${reportPath}.`
      : `Missing: ${missing.join(", ")}.`,
    missing.length === 0
      ? undefined
      : "Deploy the static web export to https://freedrecovery.app, verify DNS/TLS/CDN routing for /privacy, /support, and /account-deletion, then rerun npm run audit:store-legal-hosted before release."
  );
}

function auditMonetization(): AuditItem {
  const ios = getMonetizationReadiness({ mode: "native", platform: "ios" });
  const android = getMonetizationReadiness({ mode: "native", platform: "android" });
  const packageJson = read("package.json");
  const runtime = read("src/lib/native-monetization-runtime.ts");
  const appSurface = read("src/features/freed-app.tsx");
  const appConfig = read("app.config.js");
  const androidRootBuildGradle = read("android/build.gradle");
  const androidAppBuildGradle = read("android/app/build.gradle");
  const androidManifest = read("android/app/src/main/AndroidManifest.xml");
  // Accept either expo-iap (StoreKit 2 / Google Play Billing — preferred) or
  // the legacy RevenueCat path. The runtime prefers expo-iap when both are
  // installed.
  const storeProviderInstalled = packageJson.includes("expo-iap") || packageJson.includes("react-native-purchases");
  const storeAdapterWired =
    runtime.includes("createNativeIapStoreAdapter") || runtime.includes("createRevenueCatStoreAdapter");
  const nativeProviderWired =
    storeProviderInstalled &&
    packageJson.includes("react-native-google-mobile-ads") &&
    runtime.includes("configureNativeMonetizationProvider") &&
    storeAdapterWired &&
    runtime.includes("createAdMobRewardedAdapter") &&
    appSurface.includes("configureNativeMonetizationRuntime") &&
    appConfig.includes("react-native-google-mobile-ads") &&
    androidRootBuildGradle.includes("ext.googleMobileAdsJson") &&
    androidRootBuildGradle.includes("appJSONGoogleMobileAdsAppID                  : rootProject.ext.freedGoogleMobileAdsAndroidAppId") &&
    androidAppBuildGradle.includes("freedGoogleMobileAdsAndroidAppId             : admobAndroidAppId ?: debugAdmobAndroidAppId") &&
    androidManifest.includes('android:name="com.google.android.gms.ads.APPLICATION_ID"') &&
    androidManifest.includes("${freedGoogleMobileAdsAndroidAppId}") &&
    androidManifest.includes('tools:replace="android:value"');
  const missing = [
    ...new Set([
      ...ios.missing.map((part) => `iOS ${part}`),
      ...android.missing.map((part) => `Android ${part}`),
      ...getStoreVerificationCredentialGaps()
    ])
  ].filter((part) => !(nativeProviderWired && part.endsWith("native monetization provider")));
  missing.push(
    ...[
      apiRoutePathIssue(readEnv("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"), "purchase verify endpoint", "/api/purchases/verify"),
      boundedIntegerEnvIssue("EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS", 500, 15_000),
      boundedIntegerEnvIssue("EXPO_PUBLIC_PURCHASE_VERIFY_RESPONSE_MAX_BYTES", 1_024, 2_000_000),
      boundedIntegerEnvIssue("FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS", 500, 15_000),
      boundedIntegerEnvIssue("FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES", 1_024, 2_000_000)
    ].filter((issue): issue is string => Boolean(issue))
  );

  return item(
    "production-monetization",
    readinessStatus(missing),
    missing.length === 0 ? "Native IAP/store provider, platform-specific AdMob config, and bounded purchase verification transport are present." : `Missing: ${missing.join(", ")}.`,
    missing.length === 0
      ? undefined
      : nativeProviderWired
        ? "Configure native IAP product IDs, purchase-verification endpoint, server-only App Store/Play verification credentials, platform AdMob env vars, optional purchase verification timeout/response-size bounds, and optional RevenueCat fallback only if selected; then validate store/ad and premium no-ad intervention sandboxes."
        : "Wire production purchase/restore/rewarded-ad providers and configure platform env vars."
  );
}

function androidReleaseSigningCredentialGaps() {
  const missing: string[] = [];
  const storeFile = readEnv("FREED_ANDROID_UPLOAD_STORE_FILE");
  const storePassword = readEnv("FREED_ANDROID_UPLOAD_STORE_PASSWORD");
  const keyAlias = readEnv("FREED_ANDROID_UPLOAD_KEY_ALIAS");
  const addIssue = (issue: string | null) => {
    if (issue && !missing.includes(issue)) missing.push(issue);
  };
  for (const key of [
    "FREED_ANDROID_UPLOAD_STORE_FILE",
    "FREED_ANDROID_UPLOAD_STORE_PASSWORD",
    "FREED_ANDROID_UPLOAD_KEY_ALIAS",
    "FREED_ANDROID_UPLOAD_KEY_PASSWORD"
  ]) {
    if (!hasUsableConfigValue(key)) missing.push(key);
  }
  const storeFilePath = storeFile ? (isAbsolute(storeFile) ? storeFile : resolve(root, storeFile)) : null;
  if (storeFilePath && !existsSync(storeFilePath)) {
    missing.push("FREED_ANDROID_UPLOAD_STORE_FILE existing keystore path");
  }
  if (storeFile && /(?:^|[/\\])debug\.keystore$/i.test(storeFile)) {
    addIssue("FREED_ANDROID_UPLOAD_STORE_FILE non-debug upload keystore");
  }
  if (
    storeFilePath &&
    existsSync(storeFilePath) &&
    hasUsableConfigValue("FREED_ANDROID_UPLOAD_STORE_PASSWORD") &&
    hasUsableConfigValue("FREED_ANDROID_UPLOAD_KEY_ALIAS") &&
    storePassword &&
    keyAlias
  ) {
    addIssue(androidUploadKeystoreInspectionIssue(storeFilePath, storePassword, keyAlias));
  }
  return missing;
}

function auditAndroidReleaseSigning(): AuditItem {
  const buildGradle = has("android/app/build.gradle") ? read("android/app/build.gradle") : "";
  const envTemplate = has(".env.production.example") ? read(".env.production.example") : "";
  const apkBuilder = has("scripts/build-android-release-apk.js") ? read("scripts/build-android-release-apk.js") : "";
  const packageJson = has("package.json") ? read("package.json") : "";
  const keystoreSetup = has("scripts/android-upload-keystore-setup.js") ? read("scripts/android-upload-keystore-setup.js") : "";
  const configChecks = [
    packageJson.includes('"setup:android-upload-keystore"'),
    keystoreSetup.includes("android-upload"),
    keystoreSetup.includes("FREED_ANDROID_UPLOAD_STORE_FILE"),
    keystoreSetup.includes("--generate-passwords"),
    keystoreSetup.includes("must stay outside this repository"),
    keystoreSetup.includes("keytool"),
    buildGradle.includes("FREED_ANDROID_UPLOAD_STORE_FILE"),
    buildGradle.includes("FREED_ANDROID_UPLOAD_STORE_PASSWORD"),
    buildGradle.includes("FREED_ANDROID_UPLOAD_KEY_ALIAS"),
    buildGradle.includes("FREED_ANDROID_UPLOAD_KEY_PASSWORD"),
    buildGradle.includes("freed.requireAndroidReleaseSigning"),
    buildGradle.includes("FREED_REQUIRE_ANDROID_RELEASE_SIGNING"),
    buildGradle.includes("androidUploadStoreFilePath"),
    buildGradle.includes("androidReleaseSigningConfigured ? signingConfigs.release : signingConfigs.debug"),
    !buildGradle.includes("signingConfig signingConfigs.debug\n            def enableShrinkResources"),
    envTemplate.includes("FREED_ANDROID_UPLOAD_STORE_FILE="),
    envTemplate.includes("FREED_ANDROID_UPLOAD_STORE_PASSWORD="),
    envTemplate.includes("FREED_ANDROID_UPLOAD_KEY_ALIAS="),
    envTemplate.includes("FREED_ANDROID_UPLOAD_KEY_PASSWORD="),
    envTemplate.includes("FREED_REQUIRE_ANDROID_RELEASE_SIGNING=true"),
    apkBuilder.includes("--require-upload-signing"),
    apkBuilder.includes("--artifact <apk|aab>"),
    apkBuilder.includes("FREED_ANDROID_RELEASE_ARTIFACT"),
    apkBuilder.includes("DEFAULT_RELEASE_AAB"),
    apkBuilder.includes(":app:bundleRelease"),
    apkBuilder.includes("android-aab-upload-signing"),
    apkBuilder.includes("freed-android-release-build-report-v1"),
    apkBuilder.includes("--report <path>"),
    apkBuilder.includes("freed-android-apk-build-report-v1"),
    apkBuilder.includes("assertSafeReportPath"),
    apkBuilder.includes("~/Downloads/FREED-release-arm64.apk"),
    apkBuilder.includes("function buildInstallHandoff"),
    apkBuilder.includes("function buildAndroidArtifactHandoffMarkdown"),
    apkBuilder.includes("function writeAndroidArtifactHandoff"),
    apkBuilder.includes("ANDROID_APK_INSTALL_HANDOFF.md"),
    apkBuilder.includes("handoffDocumentWritten"),
    apkBuilder.includes("installHandoff"),
    apkBuilder.includes("qa:android-install"),
    apkBuilder.includes("installQaCommandString"),
    apkBuilder.includes("ANDROID_PROTECTION_FLOW_ORDER"),
    apkBuilder.includes("protectionFlowOrderString"),
    apkBuilder.includes("activationReadinessRule"),
    apkBuilder.includes("localInstallSupported"),
    apkBuilder.includes("playUploadArtifact"),
    apkBuilder.includes("playConsoleReady"),
    apkBuilder.includes("buildResult"),
    apkBuilder.includes("reportResult"),
    apkBuilder.includes("--self-test"),
    apkBuilder.includes("FREED_ANDROID_REQUIRE_UPLOAD_SIGNING"),
    apkBuilder.includes("FREED_REQUIRE_ANDROID_RELEASE_SIGNING"),
    apkBuilder.includes("--build-idle-timeout-ms"),
    apkBuilder.includes("FREED_ANDROID_RELEASE_BUILD_IDLE_TIMEOUT_MS"),
    apkBuilder.includes("resetIdleTimeout"),
    apkBuilder.includes("function resolveAdMobStatus"),
    apkBuilder.includes("Android upload signing requires a production Android AdMob app ID"),
    apkBuilder.includes("android-apk-admob-app-id"),
    apkBuilder.includes("function inspectApkSignature"),
    apkBuilder.includes("ANDROID_DEBUG_CERT_SHA256"),
    apkBuilder.includes("function inspectUploadKeystore"),
    apkBuilder.includes("non-debug upload keystore"),
    apkBuilder.includes("uploadKeystore"),
    apkBuilder.includes("android-apk-signature"),
    apkBuilder.includes("Debug certificate:"),
    apkBuilder.includes("Signing mode:")
  ];
  const missing = [
    ...(!configChecks.every(Boolean) ? ["Gradle/env-template Android release signing wiring"] : []),
    ...androidReleaseSigningCredentialGaps()
  ];

  return item(
    "production-android-signing",
    readinessStatus(missing),
    missing.length === 0
      ? "Android release upload signing config and keystore credentials are present for Play artifacts."
      : `Missing: ${missing.join(", ")}.`,
    missing.length === 0
      ? undefined
      : "Configure FREED_ANDROID_UPLOAD_STORE_FILE, FREED_ANDROID_UPLOAD_STORE_PASSWORD, FREED_ANDROID_UPLOAD_KEY_ALIAS, and FREED_ANDROID_UPLOAD_KEY_PASSWORD with secure upload signing values before producing Play Console artifacts."
  );
}

function auditDependencySecurity(): AuditItem {
  const cachedReportPath = configuredDependencyAuditReportPath();
  if (cachedReportPath) {
    const cachedReport = readJsonObject(cachedReportPath);
    if (cachedReport?.schemaVersion === "freed-dependency-audit-v1" && cachedReport.vulnerabilitySummary) {
      const freshnessIssue = dependencyAuditReportFreshnessIssue(cachedReport);
      if (!freshnessIssue) {
        return dependencyAuditItemFromWrapperReport(cachedReport, null);
      }
    }
  }

  let raw = "";
  let exitCode: number | null = null;
  try {
    raw = execFileSync(process.execPath, [file("scripts/dependency-audit.js"), "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000
    });
  } catch (error) {
    const failed = error as { stdout?: string | Buffer; stderr?: string | Buffer; status?: number };
    const stdout = Buffer.isBuffer(failed.stdout) ? failed.stdout.toString("utf8") : failed.stdout ?? "";
    const stderr = Buffer.isBuffer(failed.stderr) ? failed.stderr.toString("utf8") : failed.stderr ?? "";
    raw = [stdout, stderr].filter(Boolean).join("\n");
    exitCode = typeof failed.status === "number" ? failed.status : null;
  }

  const report = parseJsonObjectFromOutput(raw) as
    | {
        schemaVersion?: string;
        result?: string;
        audit?: {
          exitCode?: number | null;
          failureKind?: string | null;
        };
        issues?: unknown;
        vulnerabilitySummary?: {
          total?: number;
          critical?: number;
          high?: number;
          moderate?: number;
          low?: number;
          info?: number;
        };
        metadata?: {
          vulnerabilities?: {
            total?: number;
            critical?: number;
            high?: number;
            moderate?: number;
            low?: number;
          };
        };
      }
    | null;

  if (report?.schemaVersion === "freed-dependency-audit-v1" && report.vulnerabilitySummary) {
    return dependencyAuditItemFromWrapperReport(report, exitCode);
  }

  if (report?.metadata?.vulnerabilities) {
    const vulnerabilities = report.metadata?.vulnerabilities;
    const total = vulnerabilities?.total ?? 0;
    return passOrFail(
      "dependency-security",
      total === 0,
      total === 0
        ? "Production dependency audit reports 0 vulnerabilities."
        : `Production dependency audit reports ${total} vulnerabilities: ${JSON.stringify(vulnerabilities)}.`,
      "Run npm run audit:dependencies and resolve production dependency advisories before release."
    );
  }

  if (/found\s+0\s+vulnerabilities/i.test(raw)) {
    return passOrFail(
      "dependency-security",
      true,
      "Production dependency audit reports 0 vulnerabilities.",
      "Run npm run audit:dependencies and resolve production dependency advisories before release."
    );
  }

  return item(
    "dependency-security",
    "fail",
    dependencyAuditFailureEvidence(raw, exitCode),
    "Run npm run audit:dependencies and fix any npm audit or registry issue before release."
  );
}

function configuredDependencyAuditReportPath() {
  const configured = readEnv("FREED_DEPENDENCY_AUDIT_REPORT");
  if (configured?.toLowerCase() === "none") return null;
  const candidate = configured || DEFAULT_DEPENDENCY_AUDIT_REPORT;
  try {
    return relative(root, assertSafeReportPath(candidate)).replace(/\\/g, "/");
  } catch {
    return null;
  }
}

function dependencyAuditItemFromWrapperReport(
  report: {
    audit?: { exitCode?: number | null; failureKind?: string | null };
    result?: string;
    issues?: unknown;
    vulnerabilitySummary?: { total?: number; critical?: number; high?: number; moderate?: number; low?: number; info?: number };
  },
  fallbackExitCode: number | null
) {
  const vulnerabilities = report.vulnerabilitySummary;
  const total = vulnerabilities?.total ?? 0;
  const wrapperExitCode = typeof report.audit?.exitCode === "number" ? report.audit.exitCode : fallbackExitCode;
  return passOrFail(
    "dependency-security",
    report.result === "pass" && total === 0,
    report.result === "pass" && total === 0
      ? "Production dependency audit reports 0 vulnerabilities."
      : dependencyAuditWrapperFailureEvidence(report, wrapperExitCode),
    "Run npm run audit:dependencies and resolve production dependency advisories before release."
  );
}

function dependencyAuditWrapperFailureEvidence(
  report: {
    audit?: { failureKind?: string | null };
    issues?: unknown;
    vulnerabilitySummary?: { total?: number; critical?: number; high?: number; moderate?: number; low?: number; info?: number };
  },
  exitCode: number | null
) {
  const vulnerabilities = report.vulnerabilitySummary;
  const total = vulnerabilities?.total ?? 0;
  if (total > 0) {
    return `Production dependency audit reports ${total} vulnerabilities: ${JSON.stringify(vulnerabilities)}.`;
  }

  const issues = Array.isArray(report.issues) ? report.issues.filter((issue) => typeof issue === "string") : [];
  const summary = issues.join(" ").slice(0, 360);
  const exitDetail = exitCode === null ? "" : ` after exit code ${exitCode}`;
  if (report.audit?.failureKind === "tool-unavailable") {
    return summary
      ? `Production dependency audit command was unavailable${exitDetail}: ${summary}`
      : `Production dependency audit command was unavailable${exitDetail}.`;
  }
  if (report.audit?.failureKind === "timeout") {
    return summary
      ? `Production dependency audit timed out${exitDetail}: ${summary}`
      : `Production dependency audit timed out${exitDetail}.`;
  }
  return summary
    ? `Production dependency audit did not return a parseable vulnerability report${exitDetail}: ${summary}`
    : `Production dependency audit did not return a parseable vulnerability report${exitDetail}.`;
}

function dependencyAuditFailureEvidence(raw: string, exitCode: number | null) {
  const summary = summarizeDependencyAuditOutput(raw);
  const exitDetail = exitCode === null ? "" : ` after exit code ${exitCode}`;
  return summary
    ? `Production dependency audit did not return a parseable vulnerability report${exitDetail}: ${summary}`
    : `Production dependency audit did not return a parseable vulnerability report${exitDetail}.`;
}

function summarizeDependencyAuditOutput(raw: string) {
  return sanitizeReportText(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")
    .slice(0, 360);
}

function componentGaps(label: string, component: BackendComponentReadiness) {
  return component.ready ? [] : component.missing.map((gap) => `${label}: ${gap}`);
}

function auditProductionBackendInfrastructure(): AuditItem {
  const readiness = getBackendArchitectureReadiness(process.env);
  const providerTimeoutIssue = boundedIntegerEnvIssue("FREED_BACKEND_PROVIDER_TIMEOUT_MS", 500, 15_000);
  const providerResponseMaxIssue = boundedIntegerEnvIssue("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES", 1_024, 5_000_000);
  const schemaSmokeTimeoutIssue = boundedIntegerEnvIssue("FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS", 500, 15_000);
  const backupSyncTimeoutIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_TIMEOUT_MS", 500, 15_000);
  const backupSyncResponseIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_RESPONSE_MAX_BYTES", 1_024, 5_000_000);
  const backupSyncEndpoint = readEnv("EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT");
  const backupSyncEndpointIssues = backupSyncEndpoint
    ? productionApiRouteIssues(backupSyncEndpoint, "recovery backup sync endpoint", "/api/recovery-backup/sync")
    : [];
  const supabaseAuthTimeoutIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_SUPABASE_AUTH_TIMEOUT_MS", 500, 15_000);
  const supabaseAuthResponseIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_SUPABASE_AUTH_RESPONSE_MAX_BYTES", 1_024, 1_000_000);
  const publicSupabaseUrl = readEnv("EXPO_PUBLIC_SUPABASE_URL");
  const publicAnonKey = readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const missing = [
    ...componentGaps("Supabase", readiness.components.supabase),
    ...(publicSupabaseUrl
      ? formatEndpointIssues(getProductionBaseUrlIssues(publicSupabaseUrl, "Supabase public Auth base URL"))
      : ["Supabase public lockout proof: EXPO_PUBLIC_SUPABASE_URL"]),
    ...(!isPublicSupabaseAnonKey(publicAnonKey)
      ? ["Supabase public lockout proof: EXPO_PUBLIC_SUPABASE_ANON_KEY"]
      : []),
    ...componentGaps("Redis", readiness.components.redis),
    ...componentGaps("encrypted recovery backup sync", readiness.components.recoveryBackupSync),
    ...backupSyncEndpointIssues,
    ...componentGaps("retention cleanup", readiness.components.maintenance),
    ...(providerTimeoutIssue ? [providerTimeoutIssue] : []),
    ...(providerResponseMaxIssue ? [providerResponseMaxIssue] : []),
    ...(schemaSmokeTimeoutIssue ? [schemaSmokeTimeoutIssue] : []),
    ...(backupSyncTimeoutIssue ? [backupSyncTimeoutIssue] : []),
    ...(backupSyncResponseIssue ? [backupSyncResponseIssue] : []),
    ...(supabaseAuthTimeoutIssue ? [supabaseAuthTimeoutIssue] : []),
    ...(supabaseAuthResponseIssue ? [supabaseAuthResponseIssue] : [])
  ];
  const uniqueMissing = Array.from(new Set(missing));

  return item(
    "production-backend-infrastructure",
    readinessStatus(uniqueMissing),
    uniqueMissing.length === 0
      ? "Supabase/PostgreSQL, Redis/Upstash, encrypted backup sync, and retention cleanup backend infrastructure are configured with production-shaped server-only credentials and bounded provider/client calls."
      : `Missing: ${uniqueMissing.join(", ")}.`,
    uniqueMissing.length === 0
      ? undefined
      : "Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, BACKEND_MAINTENANCE_SECRET or CRON_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, and optional FREED_BACKEND_PROVIDER_TIMEOUT_MS / FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES / FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS with production values, then rerun npm run preflight:release-env."
  );
}

function auditProductionAdultDomainFeed(): AuditItem {
  const missing: string[] = [];
  missing.push(
    ...productionApiRouteIssues(
      readEnv("EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT"),
      "adult domain feed endpoint",
      "/api/adult-domain-feed"
    )
  );
  missing.push(
    ...[
      boundedIntegerEnvIssue("EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS", 50, 15_000),
      boundedIntegerEnvIssue("EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES", 100_000, 10_000_000),
      boundedIntegerEnvIssue("FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS", 50, 15_000),
      boundedIntegerEnvIssue("FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS", 60, 86_400),
      boundedIntegerEnvIssue("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS", 50, 15_000),
      boundedIntegerEnvIssue("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES", 10_000, 5_000_000)
    ].filter((issue): issue is string => Boolean(issue))
  );

  const sourceConfigText = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS");
  const sourceConfigParseResult = parseAdultDomainFeedSourceConfigWithIssues(sourceConfigText ?? "");
  const sourceConfigs = sourceConfigParseResult.sources;
  missing.push(...sourceConfigParseResult.issues);
  if (readEnv("EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED") !== "true") {
    missing.push("reviewed adult-domain feed provenance requirement is not enabled");
  }
  if (!sourceConfigText || isPlaceholderConfigValue(sourceConfigText) || sourceConfigs.length === 0) {
    missing.push("reviewed adult-domain feed source URL list");
  }
  for (const source of sourceConfigs) {
    if (!reviewedAdultDomainFeedSourceFamily(source.id)) {
      missing.push(
        `${source.label} adult-domain feed source id must identify a reviewed source family: ${REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES.join(", ")}`
      );
    }
    missing.push(
      ...formatEndpointIssues(
        getProductionEndpointIssues(source.url, `${source.label} adult-domain feed source`)
      )
    );
  }

  const uniqueMissing = Array.from(new Set(missing));
  return item(
    "production-adult-domain-feed",
    readinessStatus(uniqueMissing),
    uniqueMissing.length === 0
      ? `Adult-domain feed endpoint and ${sourceConfigs.length} reviewed source feed${sourceConfigs.length === 1 ? "" : "s"} are configured with production-safe HTTPS origins and bounded feed transport.`
      : `Missing: ${uniqueMissing.join(", ")}.`,
    uniqueMissing.length === 0
      ? undefined
      : "Configure EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT, EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true, and FREED_ADULT_DOMAIN_FEED_SOURCE_URLS with reviewed id|label|https://source-url entries before relying on dynamic adult-domain blocking."
  );
}

function auditProductionAnalyticsIngestion(): AuditItem {
  const endpointIssues = getAnalyticsEndpointIssues(readEnv("EXPO_PUBLIC_ANALYTICS_ENDPOINT")).map((issue) =>
    issue === "missing-analytics-endpoint" ? "remote analytics endpoint is not configured" : issue
  );
  const runtimeIssues = [
    boundedIntegerEnvIssue("EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS", 250, 15_000),
    boundedIntegerEnvIssue("EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES", 1_024, 2_000_000),
    boundedIntegerEnvIssue("FREED_ANALYTICS_SMOKE_TIMEOUT_MS", 250, 15_000),
    boundedIntegerEnvIssue("FREED_ANALYTICS_SUPABASE_TIMEOUT_MS", 250, 15_000)
  ].filter((issue): issue is string => Boolean(issue));
  const uniqueMissing = Array.from(new Set([...endpointIssues, ...runtimeIssues]));

  return item(
    "production-analytics-ingestion",
    readinessStatus(uniqueMissing),
    uniqueMissing.length === 0
      ? "Aggregate analytics ingestion endpoint is configured as a production-safe /api/analytics route; runtime sharing remains explicit opt-in, aggregate-only, and timeout/response-size-bounded."
      : `Missing: ${uniqueMissing.join(", ")}.`,
    uniqueMissing.length === 0
      ? undefined
      : "Configure EXPO_PUBLIC_ANALYTICS_ENDPOINT as the deployed aggregate-only /api/analytics route after privacy review, while keeping runtime analytics sharing explicit opt-in and timeout/response-size-bounded."
  );
}

function auditProductionNotificationBackend(): AuditItem {
  const readiness = getBackendArchitectureReadiness(process.env);
  const providerTimeoutIssue = boundedIntegerEnvIssue("FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS", 500, 15_000);
  const providerResponseMaxIssue = boundedIntegerEnvIssue("FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES", 1_024, 2_000_000);
  const smokeTimeoutIssue = boundedIntegerEnvIssue("FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS", 500, 15_000);
  const missing = Array.from(new Set([
    ...componentGaps("remote notification dispatch", readiness.components.notifications),
    ...(providerTimeoutIssue ? [providerTimeoutIssue] : []),
    ...(smokeTimeoutIssue ? [smokeTimeoutIssue] : []),
    ...(providerResponseMaxIssue ? [providerResponseMaxIssue] : [])
  ]));

  return item(
    "production-notification-backend",
    readinessStatus(missing),
    missing.length === 0
      ? "Server-authorized remote notification dispatch is configured with production-shaped FCM/APNs credentials, dispatch secret, and bounded provider/smoke calls."
      : `Missing: ${missing.join(", ")}.`,
    missing.length === 0
      ? undefined
      : "Configure REMOTE_NOTIFICATION_DISPATCH_SECRET, optional FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS / FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES, FCM credentials with FIREBASE_PROJECT_ID or Firebase service-account project_id, and APNs production signing credentials before enabling server-triggered recovery-safe push dispatch."
  );
}

function auditAiBackend(): AuditItem {
  const coach = getCoachReadiness({ mode: "remote" });
  const challenge = getChallengeGenerationReadiness({ mode: "remote" });
  const missing = [...coach.missing, ...challenge.missing];
  const aiProvider = (readEnv("FREED_AI_PROVIDER") ?? readEnv("AI_PROVIDER") ?? "").toLowerCase();
  const openAiReady = isOpenAiApiKey(readEnv("OPENAI_API_KEY")) && hasUsableConfigValue("OPENAI_MODEL");
  const geminiReady = isGoogleAiApiKey(readGeminiAiServerKey()) && hasUsableConfigValue("GEMINI_MODEL");
  const providerAllowed = !aiProvider || aiProvider === "openai" || aiProvider === "gemini";
  const providerReady = providerAllowed && (aiProvider === "openai" ? openAiReady : aiProvider === "gemini" ? geminiReady : openAiReady || geminiReady);
  const providerTimeoutIssue = boundedIntegerEnvIssue("FREED_AI_PROVIDER_TIMEOUT_MS", 500, 60_000);
  const providerResponseMaxIssue = boundedIntegerEnvIssue("FREED_AI_PROVIDER_RESPONSE_MAX_BYTES", 10_000, 5_000_000);
  const coachClientTimeoutIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_AI_COACH_TIMEOUT_MS", 1_000, 12_000);
  const challengeClientTimeoutIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS", 1_000, 12_000);
  const retentionMode = (readEnv("EXPO_PUBLIC_RETENTION_MODE") ?? "local").toLowerCase();
  const retentionEndpoint = readEnv("EXPO_PUBLIC_RETENTION_ENDPOINT");
  const retentionClientTimeoutIssue = boundedIntegerEnvIssue("EXPO_PUBLIC_RETENTION_TIMEOUT_MS", 1_000, 12_000);
  const endpointIssues = [
    ...productionApiRouteIssues(readEnv("EXPO_PUBLIC_AI_COACH_ENDPOINT"), "remote coach endpoint", "/api/clara"),
    ...productionApiRouteIssues(readEnv("EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT"), "remote challenge endpoint", "/api/challenges")
  ].filter((entry) => !entry.endsWith(" is not configured"));
  if (retentionMode !== "local" && retentionMode !== "remote") {
    missing.push("EXPO_PUBLIC_RETENTION_MODE must be local or remote");
  }
  if (retentionMode === "remote" && !retentionEndpoint) {
    missing.push("remote retention endpoint is not configured");
  }
  if (retentionEndpoint) {
    endpointIssues.push(...productionApiRouteIssues(retentionEndpoint, "remote retention endpoint", "/api/retention"));
  }
  missing.push(...endpointIssues);
  if (!providerReady) missing.push("server OPENAI_API_KEY and OPENAI_MODEL, or GEMINI_API_KEY/GOOGLE_API_KEY/GOOGLE_GENAI_API_KEY and GEMINI_MODEL");
  if (providerTimeoutIssue) missing.push(providerTimeoutIssue);
  if (providerResponseMaxIssue) missing.push(providerResponseMaxIssue);
  if (coachClientTimeoutIssue) missing.push(coachClientTimeoutIssue);
  if (challengeClientTimeoutIssue) missing.push(challengeClientTimeoutIssue);
  if (retentionClientTimeoutIssue) missing.push(retentionClientTimeoutIssue);

  return item(
    "production-ai-backend",
    readinessStatus(missing),
    missing.length === 0 ? "Remote CLARA and dynamic challenge endpoints/providers are configured with bounded server provider calls." : `Missing: ${missing.join(", ")}.`,
    missing.length === 0 ? undefined : "Configure privacy-reviewed remote coach and challenge-generation endpoints or providers, keep optional FREED_AI_PROVIDER_TIMEOUT_MS and FREED_AI_PROVIDER_RESPONSE_MAX_BYTES bounded, then run npm run eval:ai-safety against the release build."
  );
}

function auditAiSafetyHarness(): AuditItem {
  const packageJson = read("package.json");
  const script = has("scripts/ai-safety-eval.ts") ? read("scripts/ai-safety-eval.ts") : "";
  const checks = [
    packageJson.includes('"eval:ai-safety"'),
    packageJson.includes('"eval:ai-safety": "node -- scripts/run-ts-entry.js scripts/ai-safety-eval.ts"'),
    script.includes("coach-request-redacts-user-text-and-slip-summary"),
    script.includes("coach-crisis-input-stays-local-in-remote-mode"),
    script.includes("readBoundedResponseJson"),
    script.includes("remote-coach-output-is-redacted-before-display"),
    script.includes("remote-challenge-output-is-redacted-before-display"),
    script.includes("challenge-api-fallback-does-not-echo-sensitive-input"),
    script.includes("challenge-api-incomplete-remote-output-falls-back")
  ];

  return passOrFail(
    "ai-safety-eval-harness",
    checks.every(Boolean),
    "AI safety eval script covers CLARA redaction, crisis local routing, challenge generation privacy, bounded route response reads, and API fallback safety.",
    "Restore npm run eval:ai-safety before connecting a production AI backend."
  );
}

function auditAiBackendSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const script = has("scripts/ai-backend-smoke.ts") ? read("scripts/ai-backend-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:ai-backend"'),
    packageJson.includes('"smoke:ai-backend": "node -- scripts/run-ts-entry.js scripts/ai-backend-smoke.ts"'),
    smokeAudit.includes("ai-backend-smoke.ts"),
    smokeAudit.includes("--self-test"),
    script.includes("configured-ai-model"),
    script.includes("OPENAI_MODEL"),
    script.includes("GEMINI_MODEL"),
    script.includes("clara-remote-endpoint"),
    script.includes("challenge-remote-endpoint"),
    script.includes("challenge-personalization-profiles"),
    script.includes("EXPO_PUBLIC_RETENTION_ENDPOINT"),
    script.includes("EXPO_PUBLIC_RETENTION_TIMEOUT_MS"),
    script.includes("--retention-endpoint"),
    script.includes("retention-remote-endpoint"),
    script.includes("retentionEndpointChecked"),
    script.includes("retentionAggregateOnlyChecked"),
    script.includes("freeHighRisk"),
    script.includes("contextSignals"),
    script.includes("riskForecast"),
    script.includes("sessionDurationBucket"),
    script.includes("recentFailureCount"),
    script.includes("challengeSessionDurationBucketChecked"),
    script.includes("challengeRecentFailureCountChecked"),
    script.includes("Private [redacted-link]"),
    script.includes("assertNoCoordinateFields"),
    script.includes("assertNoSensitiveEcho"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson"),
    script.includes("ai-backend-smoke-v1"),
    script.includes("contractProof"),
    script.includes("endpointPathRequirements"),
    script.includes("endpointPathIssue"),
    script.includes("configuredModelProof"),
    script.includes("personalizationProofs"),
    script.includes("privacyProofs"),
    script.includes("responseBoundary"),
    script.includes("serverSecretKeyNamesChecked"),
    script.includes("secretValuesOmitted"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("aiBoundary"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
    reportPathSafetySource().includes("must end in .json"),
    reportPathSafetySource().includes("symbolic links"),
    script.includes("EXPO_PUBLIC_AI_COACH_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS")
  ];

  return passOrFail(
    "ai-backend-smoke-harness",
    checks.every(Boolean),
    "AI backend smoke script can validate configured model plus deployed timeout-bounded CLARA, challenge, optional aggregate-only retention, personalization profile, context-signal, aggregate risk-forecast, coarse session-duration bucket, aggregate failed-reset count, no-coordinate, and no-sensitive-echo endpoints with sanitized JSON report artifacts before release.",
    "Restore npm run smoke:ai-backend before connecting a production AI backend."
  );
}

function auditPurchaseVerificationSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const script = has("scripts/purchase-verification-smoke.ts") ? read("scripts/purchase-verification-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:purchase-verification"'),
    packageJson.includes('"smoke:purchase-verification": "node -- scripts/run-ts-entry.js scripts/purchase-verification-smoke.ts"'),
    smokeAudit.includes("purchase-verification-smoke.ts"),
    smokeAudit.includes("--self-test"),
    script.includes("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT"),
    script.includes("EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson"),
    script.includes("purchase-verification-endpoint"),
    script.includes("/api/purchases/verify"),
    script.includes("purchase-unknown-product-fails-closed"),
    script.includes("purchase-fake-known-yearly-token-fails-closed"),
    script.includes("purchase-fake-known-monthly-token-fails-closed"),
    script.includes("purchase-fake-known-lifetime-token-fails-closed"),
    script.includes("launchProductIdsChecked"),
    script.includes("fakeKnownTokenRejectedByPlan"),
    script.includes("purchase-verification-smoke-v1"),
    script.includes("contractProof"),
    script.includes("syntheticOnly"),
    script.includes("serverSecretKeyNamesChecked"),
    script.includes("rawReceiptEchoRejected"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("verificationBoundary"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
    script.includes("assertNoTokenEcho")
  ];

  return passOrFail(
    "purchase-verification-smoke-harness",
    checks.every(Boolean),
    "Purchase verification smoke script can validate deployed timeout-bounded purchase endpoint fail-closed and token-redaction behavior with sanitized JSON report artifacts.",
    "Restore npm run smoke:purchase-verification before validating production store verification."
  );
}

function auditBackendReadinessSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const script = has("scripts/backend-readiness-smoke.ts") ? read("scripts/backend-readiness-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:backend-readiness"'),
    packageJson.includes('"smoke:backend-readiness": "node -- scripts/run-ts-entry.js scripts/backend-readiness-smoke.ts"'),
    verifier.includes('"smoke:backend-readiness"'),
    smokeAudit.includes("backend-readiness-smoke.ts"),
    smokeAudit.includes("--self-test"),
    script.includes("EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT"),
    script.includes("deriveReadinessEndpoint"),
    script.includes("backend readiness derivation source endpoint"),
    script.includes("backend-readiness-http-contract"),
    script.includes("backend-readiness-no-secret-echo"),
    script.includes("backend-readiness-core-infrastructure-ready"),
    script.includes("backend-readiness-data-boundaries"),
    script.includes("backend-readiness-smoke-v1"),
    script.includes("infrastructureProof"),
    script.includes("coreComponentsReady"),
    script.includes("serverOnlyKeyNamesChecked"),
    script.includes("requestTimeoutMs"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
    script.includes("Cache-Control: no-store"),
    script.includes("SUPABASE_SERVICE_ROLE_KEY"),
    script.includes("UPSTASH_REDIS_REST_TOKEN"),
    script.includes("assertNoServerSecretEcho"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson")
  ];

  return passOrFail(
    "backend-readiness-smoke-harness",
    checks.every(Boolean),
    "Backend readiness smoke script validates the deployed no-store readiness route, core Supabase/Redis/backup/maintenance readiness, endpoint safety, data-boundary copy, no server-secret echo, and sanitized JSON report artifacts before release verification proceeds.",
    "Restore npm run smoke:backend-readiness before trusting production backend infrastructure readiness."
  );
}

function auditSupabaseSchemaSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const script = has("scripts/supabase-schema-smoke.ts") ? read("scripts/supabase-schema-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:supabase-schema"'),
    packageJson.includes('"smoke:supabase-schema": "node -- scripts/run-ts-entry.js scripts/supabase-schema-smoke.ts"'),
    verifier.includes('"smoke:supabase-schema"'),
    smokeAudit.includes("supabase-schema-smoke.ts"),
    smokeAudit.includes("--self-test"),
    script.includes("SUPABASE_URL"),
    script.includes("SUPABASE_SERVICE_ROLE_KEY"),
    script.includes("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    script.includes("FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS"),
    script.includes("supabase-schema-config"),
    script.includes("supabase-schema-core-table-contracts"),
    script.includes("supabase-schema-public-client-lockout"),
    script.includes("supabase-schema-no-secret-echo"),
    script.includes("supabase-schema-smoke-v1"),
    script.includes("getProductionBaseUrlIssues"),
    script.includes("Supabase base URL"),
    script.includes("tableContracts"),
    script.includes("accessProof"),
    script.includes("publicAnonUsedOnlyForLockout"),
    script.includes("requiredColumns"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("sanitizeSupabaseRestEndpointForReport"),
    script.includes('parsed.username = ""'),
    script.includes('parsed.password = ""'),
    script.includes('parsed.search = ""'),
    script.includes('parsed.hash = ""'),
    script.includes("schemaBoundary"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
    script.includes("recovery_analytics_events"),
    script.includes("adult_domain_feed_versions"),
    script.includes("encrypted_recovery_backups"),
    script.includes("purchase_verification_events"),
    script.includes("ai_backend_events"),
    script.includes("backend_job_runs"),
    script.includes("isSupabaseServiceRoleKey"),
    script.includes("limit=0"),
    script.includes("assertPublicClientLockedOut"),
    script.includes("assertNoServerSecretEcho"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson")
  ];

  return passOrFail(
    "supabase-schema-smoke-harness",
    checks.every(Boolean),
    "Supabase schema smoke script validates the deployed production Supabase REST schema with service-role credentials, public anon lockout, required backend tables/columns, bounded read-only limit=0 requests, no server-secret echo, and sanitized JSON report artifacts.",
    "Restore npm run smoke:supabase-schema before trusting that the production Supabase migration has been applied."
  );
}

function auditAdultDomainFeedSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const route = has("app/api/adult-domain-feed+api.ts") ? read("app/api/adult-domain-feed+api.ts") : "";
  const publication = has("src/lib/adult-domain-feed-publication.ts") ? read("src/lib/adult-domain-feed-publication.ts") : "";
  const script = has("scripts/adult-domain-feed-smoke.ts") ? read("scripts/adult-domain-feed-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:adult-domain-feed"'),
    packageJson.includes('"smoke:adult-domain-feed": "node -- scripts/run-ts-entry.js scripts/adult-domain-feed-smoke.ts"'),
    verifier.includes('"smoke:adult-domain-feed"'),
    smokeAudit.includes("adult-domain-feed-smoke.ts"),
    smokeAudit.includes("--self-test"),
    publication.includes("export function sanitizeAdultDomainFeedSourceReport"),
    route.includes("sanitizeAdultDomainFeedSourceReport"),
    route.includes("sourceReports: publicSourceReports"),
    script.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT"),
    script.includes("FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS"),
    script.includes("adult-feed-json-contract"),
    script.includes("adult-feed-conditional-304"),
    script.includes("adult-feed-safari-content-blocker"),
    script.includes("adult-domain-feed-smoke-v1"),
    script.includes("contractProof"),
    script.includes("endpointPathRequired"),
    script.includes("feedJsonContractValidated"),
    script.includes("conditional304Validated"),
    script.includes("safariContentBlockerExportValidated"),
    script.includes("rawSourceUrlsWithQueryStringsOmitted"),
    script.includes("fullDomainListOmitted"),
    script.includes("serverSecretKeyNamesChecked"),
    script.includes("secretValuesOmitted"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("summarizeFeedForReport"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
    script.includes("X-FREED-Adult-Feed-Checksum"),
    script.includes("X-FREED-Adult-Feed-Cache"),
    script.includes("X-FREED-Adult-Feed-Source-Max-Bytes"),
    script.includes("sourceMaxBytes"),
    script.includes("MAX_ADULT_FEED_AGE_MS"),
    script.includes("feed generatedAt must be no older than 48 hours"),
    script.includes("assertSanitizedSourceReports"),
    script.includes("SAFARI_SHORT_FORM_WEB_RULE_FILTERS"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson")
  ];

  return passOrFail(
    "adult-domain-feed-smoke-harness",
    checks.every(Boolean),
    "Adult-domain feed smoke script validates the deployed feed JSON, 48-hour freshness/cache/source-size headers, reviewed sanitized source reports, conditional 304 sync behavior, Safari content-blocker export, and sanitized metadata-only JSON report artifacts before release verification proceeds.",
    "Restore npm run smoke:adult-domain-feed before relying on a production dynamic adult-domain feed."
  );
}

function auditAnalyticsIngestionSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const route = has("app/api/analytics+api.ts") ? read("app/api/analytics+api.ts") : "";
  const ingestion = has("src/lib/recovery-analytics-ingestion.ts") ? read("src/lib/recovery-analytics-ingestion.ts") : "";
  const script = has("scripts/analytics-ingestion-smoke.ts") ? read("scripts/analytics-ingestion-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:analytics-ingestion"'),
    packageJson.includes('"smoke:analytics-ingestion": "node -- scripts/run-ts-entry.js scripts/analytics-ingestion-smoke.ts"'),
    verifier.includes('"smoke:analytics-ingestion"'),
    smokeAudit.includes("analytics-ingestion-smoke.ts"),
    smokeAudit.includes("--self-test"),
    route.includes("ingestRecoveryAnalytics"),
    route.includes("enforceBackendRateLimit"),
	    ingestion.includes("sanitizeAnalyticsIngestionRequest"),
	    ingestion.includes("findForbiddenAnalyticsFields"),
	    ingestion.includes("findUnsafeAnalyticsStrings"),
	    ingestion.includes("normalizeAnalyticsKey"),
	    ingestion.includes("private_notes"),
	    ingestion.includes("rawURL"),
	    ingestion.includes("purchase_token"),
	    ingestion.includes("receiptData"),
	    ingestion.includes("access[_-]?token"),
    ingestion.includes("hasCompleteBlockedAttemptSourceBreakdown"),
    ingestion.includes("hasCompleteHourlyUrgePattern"),
    ingestion.includes("hasCompleteChallengeSuccessByCategory"),
    ingestion.includes("analyticsIngestionTimeIssue"),
    ingestion.includes("Analytics userOptedInAt must not be in the future"),
    ingestion.includes("Analytics generatedForDateKey must not be in the future"),
    ingestion.includes("FREED_ANALYTICS_SUPABASE_TIMEOUT_MS"),
    script.includes("EXPO_PUBLIC_ANALYTICS_ENDPOINT"),
    script.includes("FREED_ANALYTICS_SMOKE_TIMEOUT_MS"),
    script.includes("analytics-ingestion-aggregate-contract"),
    script.includes("analytics-ingestion-incomplete-metrics-rejection"),
    script.includes("analytics-ingestion-future-timestamp-rejection"),
    script.includes("analytics-ingestion-sensitive-rejection"),
    script.includes("buildAnalyticsSmokeRequest"),
    script.includes("buildIncompleteMetricsRejectionRequest"),
    script.includes("buildFutureConsentRejectionRequest"),
    script.includes("buildFutureSnapshotRejectionRequest"),
    script.includes("buildSensitiveRejectionRequest"),
    script.includes("analytics-ingestion-smoke-v1"),
    script.includes("contractProof"),
    script.includes("acceptedAggregateSnapshot"),
    script.includes("sensitivePayloadRejectedWithoutEcho"),
    script.includes("serverSecretKeyNamesChecked"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("summarizeAnalyticsSmokeRequest"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
	    script.includes("private_notes"),
	    script.includes("rawURL"),
	    script.includes("purchase_token"),
	    script.includes("receiptData"),
	    script.includes("assertNoPrivateEcho"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson")
  ];

  return passOrFail(
    "analytics-ingestion-smoke-harness",
    checks.every(Boolean),
    "Analytics ingestion smoke script validates the deployed aggregate-only /api/analytics route, bounded endpoint safety, complete production-metric snapshot acceptance, future timestamp rejection, incomplete/mismatched aggregate rejection, raw private-field rejection without response echo, and sanitized JSON report artifacts before release verification proceeds.",
    "Restore npm run smoke:analytics-ingestion before enabling opt-in production recovery analytics."
  );
}

function auditRemoteNotificationSmokeHarness(): AuditItem {
  const packageJson = read("package.json");
  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
  const smokeAudit = has("scripts/smoke-harness-audit.js") ? read("scripts/smoke-harness-audit.js") : "";
  const route = has("app/api/notifications/send+api.ts") ? read("app/api/notifications/send+api.ts") : "";
  const notifications = has("src/lib/remote-notifications.ts") ? read("src/lib/remote-notifications.ts") : "";
  const script = has("scripts/remote-notification-smoke.ts") ? read("scripts/remote-notification-smoke.ts") : "";
  const checks = [
    packageJson.includes('"smoke:remote-notifications"'),
    packageJson.includes('"smoke:remote-notifications": "node -- scripts/run-ts-entry.js scripts/remote-notification-smoke.ts"'),
    verifier.includes('"smoke:remote-notifications"'),
    smokeAudit.includes("remote-notification-smoke.ts"),
    smokeAudit.includes("--self-test"),
    route.includes("validateRemoteNotificationAuth"),
    route.includes("sendRemoteNotification"),
    route.includes("enforceBackendRateLimit"),
    notifications.includes("sanitizeRemoteNotificationRequest"),
    notifications.includes("allowedRequestKeys"),
    notifications.includes("normalizeDeviceToken"),
    notifications.includes("FCM_DEVICE_TOKEN_PATTERN"),
    notifications.includes("APNS_DEVICE_TOKEN_PATTERN"),
    notifications.includes("sanitizeNotificationReason"),
    notifications.includes("buildSafeRemoteNotificationPayload"),
    script.includes("FREED_REMOTE_NOTIFICATION_SMOKE_ENDPOINT"),
    script.includes("FREED_REMOTE_NOTIFICATION_SMOKE_TIMEOUT_MS"),
    script.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    script.includes("deriveNotificationEndpoint"),
    script.includes("remote notification derivation source endpoint"),
    script.includes("remote-notification-unauthorized-rejection"),
    script.includes("remote-notification-supported-kind-rejection"),
    script.includes("remote-notification-sensitive-rejection"),
    script.includes("remote-notification-smoke-v1"),
    script.includes("contractProof"),
    script.includes("nonSendingSmoke"),
    script.includes("presetCopyServerSideOnly"),
    script.includes("providerCallsExpected: false"),
    script.includes("serverSecretKeyNamesChecked"),
    script.includes("--report"),
    script.includes("writeSmokeReport"),
    script.includes("sanitizeDetailForReport"),
    script.includes("dispatchBoundary"),
    script.includes("sendsPush: false"),
    script.includes("SMOKE_FCM_DEVICE_TOKEN"),
    script.includes("deviceTokenEchoForbidden"),
    script.includes("privateEchoPatternsChecked"),
    script.includes("FCM_DEVICE_TOKEN_ECHO_PATTERN"),
    script.includes("assertSafeReportPath"),
    script.includes("report-path-safety"),
    reportPathSafetySource().includes("docs/validation/evidence"),
    reportPathSafetySource().includes("docs/validation/artifacts/<run-id>"),
    script.includes("buildUnsupportedKindRejectedRequest"),
    script.includes("buildSensitiveRejectedRequest"),
    script.includes("assertNoPrivateEcho"),
    script.includes("fetchRemoteProviderResponse"),
    script.includes("readRemoteProviderJson")
  ];

  return passOrFail(
    "remote-notification-smoke-harness",
    checks.every(Boolean),
    "Remote notification smoke script validates the deployed dispatch route without sending a push by proving unauthorized rejection, supported-kind allowlist rejection, dispatch-secret-authorized private-field rejection, no exact smoke device-token, push-token, or secret echo, and sanitized non-sending JSON report artifacts.",
    "Restore npm run smoke:remote-notifications before enabling server-triggered recovery-safe push dispatch."
  );
}

function auditClientBundleSecretHarness(): AuditItem {
  const packageJson = read("package.json");
  const script = has("scripts/client-bundle-secret-audit.js") ? read("scripts/client-bundle-secret-audit.js") : "";
  const checks = [
    packageJson.includes('"export:web"'),
    packageJson.includes('"export:android-bundle"'),
    packageJson.includes('"audit:client-bundles"'),
    packageJson.includes("node -- scripts/client-bundle-secret-audit.js"),
    script.includes("SUPABASE_SERVICE_ROLE_KEY"),
    script.includes("UPSTASH_REDIS_REST_TOKEN"),
    script.includes("OPENAI_API_KEY"),
    script.includes("APP_STORE_PRIVATE_KEY"),
    script.includes("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"),
    script.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    script.includes("FIREBASE_SERVICE_ACCOUNT_JSON"),
    script.includes("APNS_PRIVATE_KEY"),
    script.includes("verifyPurchasePayload"),
    script.includes("createServerAiText"),
    script.includes("sendRemoteNotification"),
    script.includes("cleanupExpiredBackendRows"),
    script.includes("android/app/src/main/assets/index.android.bundle")
  ];

  return passOrFail(
    "client-bundle-secret-audit-harness",
    checks.every(Boolean),
    "Client bundle secret audit can scan regenerated web and Android bundles for server-only store, AI, Supabase, Redis, notification, maintenance, and purchase-verifier leakage.",
    "Restore export:web, export:android-bundle, and audit:client-bundles before release verification."
  );
}

function auditBackendArchitectureContract(): AuditItem {
	  const packageJson = read("package.json");
	  const verifier = has("scripts/release-verify.js") ? read("scripts/release-verify.js") : "";
	  const schema = has("docs/backend/supabase-schema.sql") ? read("docs/backend/supabase-schema.sql") : "";
	  const migrationPath = "supabase/migrations/20260518000100_freed_backend_core.sql";
	  const analyticsPrivacyMigrationPath = "supabase/migrations/20260520000100_harden_analytics_privacy_keys.sql";
  const productionBackendPacketPath = "docs/backend/production-backend.md";
  const supabaseDeploymentPacketScriptPath = "scripts/supabase-deployment-packet.js";
	  const migration = has(migrationPath) ? read(migrationPath) : "";
	  const analyticsPrivacyMigration = has(analyticsPrivacyMigrationPath) ? read(analyticsPrivacyMigrationPath) : "";
  const productionBackendPacket = has(productionBackendPacketPath) ? read(productionBackendPacketPath) : "";
  const supabaseDeploymentPacketScript = has(supabaseDeploymentPacketScriptPath) ? read(supabaseDeploymentPacketScriptPath) : "";
  const readiness = has("src/lib/backend-architecture.ts") ? read("src/lib/backend-architecture.ts") : "";
  const backendEventAudit = has("src/lib/backend-event-audit.ts") ? read("src/lib/backend-event-audit.ts") : "";
  const backendProviderTimeout = has("src/lib/backend-provider-timeout.ts") ? read("src/lib/backend-provider-timeout.ts") : "";
  const backendInfrastructure = has("src/lib/backend-infrastructure.ts") ? read("src/lib/backend-infrastructure.ts") : "";
  const adultFeedPublication = has("src/lib/adult-domain-feed-publication.ts") ? read("src/lib/adult-domain-feed-publication.ts") : "";
  const backendRetentionCleanup = has("src/lib/backend-retention-cleanup.ts") ? read("src/lib/backend-retention-cleanup.ts") : "";
  const remoteNotifications = has("src/lib/remote-notifications.ts") ? read("src/lib/remote-notifications.ts") : "";
  const credentialSafety = has("src/lib/server-credential-safety.ts") ? read("src/lib/server-credential-safety.ts") : "";
  const serverRequestBody = has("src/lib/server-request-body.ts") ? read("src/lib/server-request-body.ts") : "";
  const notificationRoute = has("app/api/notifications/send+api.ts") ? read("app/api/notifications/send+api.ts") : "";
  const analyticsIngestion = has("src/lib/recovery-analytics-ingestion.ts") ? read("src/lib/recovery-analytics-ingestion.ts") : "";
  const analyticsRoute = has("app/api/analytics+api.ts") ? read("app/api/analytics+api.ts") : "";
  const recoveryBackupSync = has("src/lib/recovery-backup-sync.ts") ? read("src/lib/recovery-backup-sync.ts") : "";
  const recoveryBackupSyncRoute = has("app/api/recovery-backup/sync+api.ts") ? read("app/api/recovery-backup/sync+api.ts") : "";
  const backendCleanupRoute = has("app/api/backend/cleanup+api.ts") ? read("app/api/backend/cleanup+api.ts") : "";
  const readinessRoute = has("app/api/backend/readiness+api.ts") ? read("app/api/backend/readiness+api.ts") : "";
  const auditScript = has("scripts/backend-architecture-audit.js") ? read("scripts/backend-architecture-audit.js") : "";
  const envTemplate = has(".env.production.example") ? read(".env.production.example") : "";
  const edgeShared = has("supabase/functions/_shared/freed_edge_contract.ts") ? read("supabase/functions/_shared/freed_edge_contract.ts") : "";
  const edgeAdultFeedSync = has("supabase/functions/adult-domain-feed-sync/index.ts") ? read("supabase/functions/adult-domain-feed-sync/index.ts") : "";
  const edgeRetentionCleanup = has("supabase/functions/analytics-retention-cleanup/index.ts") ? read("supabase/functions/analytics-retention-cleanup/index.ts") : "";
  const edgeConfig = has("supabase/config.toml") ? read("supabase/config.toml") : "";
  const edgeFunctionSources = `${edgeShared}\n${edgeAdultFeedSync}\n${edgeRetentionCleanup}`;
  const checks = [
    packageJson.includes('"audit:backend": "node -- scripts/backend-architecture-audit.js"'),
    packageJson.includes('"evidence:supabase-deploy-packet": "node -- scripts/supabase-deployment-packet.js"'),
    verifier.includes('"audit:backend"'),
	    schema.includes("public.recovery_analytics_events"),
	    schema.includes("public.adult_domain_feed_versions"),
	    schema.includes("public.encrypted_recovery_backups"),
	    schema.includes("public.purchase_verification_events"),
	    schema.includes("public.ai_backend_events"),
	    schema.includes("public.backend_job_runs"),
	    schema.includes("freed_jsonb_has_forbidden_normalized_keys"),
	    schema.includes("recovery_analytics_events_no_raw_payload_keys"),
	    schema.includes("receiptdata"),
	    schema.includes("purchasetoken"),
	    schema.includes("blockedAttemptSourceBreakdown"),
    schema.includes("streakHistory"),
    schema.includes("jsonb_path_exists"),
    schema.includes("encrypted_recovery_backups_no_raw_payload_keys"),
	    schema.includes("purchase_verification_events_hash_shape"),
	    schema.includes("ai_backend_events_no_sensitive_payload_keys"),
	    schema.includes("backend_job_runs_no_sensitive_metadata_keys"),
	    has(migrationPath),
	    has(analyticsPrivacyMigrationPath),
	    migration.includes("FREED production backend core migration"),
	    analyticsPrivacyMigration.includes("FREED aggregate analytics privacy-key hardening"),
	    analyticsPrivacyMigration.includes("freed_jsonb_has_forbidden_normalized_keys"),
	    analyticsPrivacyMigration.includes("recovery_analytics_events_no_raw_payload_keys"),
	    analyticsPrivacyMigration.includes("alter table public.recovery_analytics_events"),
    has(productionBackendPacketPath),
    has(supabaseDeploymentPacketScriptPath),
    productionBackendPacket.includes(migrationPath),
    productionBackendPacket.includes(analyticsPrivacyMigrationPath),
    productionBackendPacket.includes("docs/backend/supabase-schema.sql"),
    productionBackendPacket.includes("recovery_analytics_events"),
    productionBackendPacket.includes("adult_domain_feed_versions"),
    productionBackendPacket.includes("encrypted_recovery_backups"),
    productionBackendPacket.includes("purchase_verification_events"),
    productionBackendPacket.includes("ai_backend_events"),
    productionBackendPacket.includes("backend_job_runs"),
    productionBackendPacket.includes("adult-domain-feed-sync"),
    productionBackendPacket.includes("analytics-retention-cleanup"),
    productionBackendPacket.includes("verify_jwt = false"),
    productionBackendPacket.includes("BACKEND_MAINTENANCE_SECRET or CRON_SECRET"),
    productionBackendPacket.includes("SUPABASE_SERVICE_ROLE_KEY"),
    productionBackendPacket.includes("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    productionBackendPacket.includes("UPSTASH_REDIS_REST_TOKEN"),
    productionBackendPacket.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"),
    productionBackendPacket.includes("EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true"),
    productionBackendPacket.includes("EXPO_PUBLIC_ANALYTICS_ENDPOINT"),
    productionBackendPacket.includes("EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT"),
    productionBackendPacket.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    productionBackendPacket.includes("npm run evidence:supabase-deploy-packet -- --report docs/validation/artifacts/<run-id>/supabase-deployment-packet.json"),
    productionBackendPacket.includes("npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/release-env-preflight-report.json"),
    productionBackendPacket.includes("npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/backend-readiness-smoke-report.json"),
    productionBackendPacket.includes("npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/supabase-schema-smoke-report.json"),
    productionBackendPacket.includes("npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/adult-domain-feed-smoke-report.json"),
    productionBackendPacket.includes("npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/analytics-ingestion-smoke-report.json"),
    productionBackendPacket.includes("npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/remote-notification-smoke-report.json"),
    productionBackendPacket.includes("npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/purchase-verification-smoke-report.json"),
    productionBackendPacket.includes("purchase-verification-smoke-report.json"),
    !productionBackendPacket.includes("npm run smoke:store-sandbox"),
    !productionBackendPacket.includes("store-ad-sandbox-report.json"),
    productionBackendPacket.includes("Do not paste real secrets"),
    productionBackendPacket.includes("Never define `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`"),
    supabaseDeploymentPacketScript.includes("freed-supabase-deployment-packet-v1"),
    supabaseDeploymentPacketScript.includes("supabase-live-project-target"),
    supabaseDeploymentPacketScript.includes("secretValuesOmitted: true"),
    supabaseDeploymentPacketScript.includes("supabase secrets set --env-file <production-env-file>"),
    supabaseDeploymentPacketScript.includes("supabase db push"),
    supabaseDeploymentPacketScript.includes("supabase functions deploy adult-domain-feed-sync"),
    supabaseDeploymentPacketScript.includes("supabase functions deploy analytics-retention-cleanup"),
    supabaseDeploymentPacketScript.includes("report-path-safety"),
    supabaseDeploymentPacketScript.includes("local-path-privacy"),
    supabaseDeploymentPacketScript.includes("productionBlockerGroups"),
    supabaseDeploymentPacketScript.includes("productionEnvChecklist"),
    supabaseDeploymentPacketScript.includes("reportArtifactCommandList"),
    supabaseDeploymentPacketScript.includes("releaseBlockerHandoff"),
    supabaseDeploymentPacketScript.includes("supabase-shared-blocker-handoff"),
    supabaseDeploymentPacketScript.includes("supabase-shared-env-checklist"),
    supabaseDeploymentPacketScript.includes("production-backend-infrastructure"),
    supabaseDeploymentPacketScript.includes("production-adult-domain-feed"),
    supabaseDeploymentPacketScript.includes("production-analytics-ingestion"),
    supabaseDeploymentPacketScript.includes("production-notification-backend"),
    supabaseDeploymentPacketScript.includes("production-monetization"),
    supabaseDeploymentPacketScript.includes("production-ai-backend"),
    supabaseDeploymentPacketScript.includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
	    migration.includes("create extension if not exists pgcrypto"),
    migration.includes("create table if not exists public.recovery_analytics_events"),
    migration.includes("create table if not exists public.adult_domain_feed_versions"),
    migration.includes("create table if not exists public.encrypted_recovery_backups"),
    migration.includes("create table if not exists public.purchase_verification_events"),
    migration.includes("create table if not exists public.ai_backend_events"),
    migration.includes("create table if not exists public.backend_job_runs"),
    migration.includes("alter table public.recovery_analytics_events enable row level security"),
    migration.includes("alter table public.adult_domain_feed_versions enable row level security"),
    migration.includes("alter table public.encrypted_recovery_backups enable row level security"),
    migration.includes("alter table public.purchase_verification_events enable row level security"),
    migration.includes("alter table public.ai_backend_events enable row level security"),
    migration.includes("alter table public.backend_job_runs enable row level security"),
    migration.includes("revoke all on table public.recovery_analytics_events from anon, authenticated, public"),
    migration.includes("revoke all on table public.adult_domain_feed_versions from anon, authenticated, public"),
    migration.includes("revoke all on table public.encrypted_recovery_backups from anon, authenticated, public"),
    migration.includes("revoke all on table public.purchase_verification_events from anon, authenticated, public"),
    migration.includes("revoke all on table public.ai_backend_events from anon, authenticated, public"),
    migration.includes("revoke all on table public.backend_job_runs from anon, authenticated, public"),
	    migration.includes("grant select, insert, update, delete on table public.recovery_analytics_events to service_role"),
	    migration.includes("grant select, insert, update, delete on table public.adult_domain_feed_versions to service_role"),
	    migration.includes("grant select, insert, update, delete on table public.encrypted_recovery_backups to service_role"),
	    migration.includes("grant select, insert, update, delete on table public.purchase_verification_events to service_role"),
	    migration.includes("grant select, insert, update, delete on table public.ai_backend_events to service_role"),
	    migration.includes("grant select, insert, update, delete on table public.backend_job_runs to service_role"),
	    migration.includes("recovery_analytics_events_privacy_flags"),
	    migration.includes("freed_jsonb_has_forbidden_normalized_keys"),
	    migration.includes("recovery_analytics_events_no_raw_payload_keys"),
	    migration.includes("receiptdata"),
	    migration.includes("purchasetoken"),
	    migration.includes("encrypted_recovery_backups_no_raw_payload_keys"),
    migration.includes("purchase_verification_events_hash_shape"),
    migration.includes("ai_backend_events_no_sensitive_payload_keys"),
    migration.includes("backend_job_runs_no_sensitive_metadata_keys"),
    has("supabase/functions/_shared/freed_edge_contract.ts"),
    has("supabase/functions/adult-domain-feed-sync/index.ts"),
    has("supabase/functions/analytics-retention-cleanup/index.ts"),
    has("supabase/config.toml"),
    edgeConfig.includes("[functions.adult-domain-feed-sync]"),
    edgeConfig.includes("[functions.analytics-retention-cleanup]"),
    (edgeConfig.match(/verify_jwt\s*=\s*false/g) ?? []).length >= 2,
    edgeConfig.includes("maintenance-secret"),
    edgeShared.includes("Deno.env.get"),
    edgeShared.includes("SUPABASE_SERVICE_ROLE_KEY"),
    edgeShared.includes("BACKEND_MAINTENANCE_SECRET"),
    edgeShared.includes("CRON_SECRET"),
    edgeShared.includes("deleteExpiredRows"),
    edgeShared.includes("upsertSupabaseRow"),
    edgeShared.includes("productionSafeHttpsOrigin(baseUrl)"),
    edgeShared.includes("supabase-url-not-production-safe-origin"),
    edgeShared.includes("recordBackendJobRun"),
    edgeShared.includes("acquireEdgeRedisLock"),
    edgeShared.includes("releaseEdgeRedisLock"),
    edgeShared.includes("UPSTASH_REDIS_REST_URL"),
    edgeShared.includes("UPSTASH_REDIS_REST_TOKEN"),
    edgeShared.includes("FREED_BACKEND_PROVIDER_TIMEOUT_MS"),
    edgeShared.includes("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES"),
    edgeShared.includes("fetchProviderWithTimeout"),
    edgeShared.includes("Supabase edge retention cleanup request"),
    edgeShared.includes("Supabase edge upsert request"),
    edgeShared.includes("productionSafeHttpsOrigin(redisUrl)"),
    edgeShared.includes("Redis edge job base URL is not a production-safe HTTPS origin"),
    edgeShared.includes("redisPipelineUrl"),
    edgeShared.includes("readJsonBodyWithByteLimit"),
    edgeShared.includes("Redis edge pipeline response"),
    !edgeShared.includes("response.json()"),
    edgeShared.includes("SUPABASE_JOB_RUNS_TABLE"),
    edgeShared.includes("backend_job_runs"),
    edgeShared.includes("idempotency_key"),
    edgeShared.includes("FORBIDDEN_METADATA_KEYS"),
    edgeShared.includes("resolution=merge-duplicates,return=minimal"),
    edgeShared.includes("count=exact,return=minimal"),
    edgeAdultFeedSync.includes("Deno.serve"),
    edgeAdultFeedSync.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"),
    edgeAdultFeedSync.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES"),
    edgeShared.includes("readTextBodyWithByteLimit"),
    edgeShared.includes("adult-domain-feed-source-too-large"),
    edgeShared.includes("url.username || url.password || url.search || url.hash"),
    edgeShared.includes('!url.pathname || url.pathname === "/"'),
    edgeShared.includes("isPrivateOrReservedIpv4"),
    edgeShared.includes("isPrivateOrReservedIpv6"),
    edgeAdultFeedSync.includes("SUPABASE_ADULT_FEED_TABLE"),
    edgeAdultFeedSync.includes("storesFullDomainList: false"),
    edgeAdultFeedSync.includes("noPacketInspection"),
    edgeAdultFeedSync.includes("noScreenshotAnalysis"),
    edgeAdultFeedSync.includes("noRawBrowsingData"),
    edgeAdultFeedSync.includes("recordBackendJobRun"),
    edgeAdultFeedSync.includes("acquireEdgeRedisLock"),
    edgeAdultFeedSync.includes("releaseEdgeRedisLock"),
    edgeAdultFeedSync.includes("FREED_EDGE_JOB_LOCK_TTL_MS"),
    edgeAdultFeedSync.includes("adult-domain-feed-sync:"),
    edgeRetentionCleanup.includes("Deno.serve"),
    edgeRetentionCleanup.includes("recordBackendJobRun"),
    edgeRetentionCleanup.includes("acquireEdgeRedisLock"),
    edgeRetentionCleanup.includes("releaseEdgeRedisLock"),
    edgeRetentionCleanup.includes("FREED_EDGE_JOB_LOCK_TTL_MS"),
    edgeRetentionCleanup.includes("SUPABASE_ANALYTICS_TABLE"),
    edgeRetentionCleanup.includes("SUPABASE_RECOVERY_BACKUP_TABLE"),
    edgeRetentionCleanup.includes("SUPABASE_PURCHASE_AUDIT_TABLE"),
    edgeRetentionCleanup.includes("SUPABASE_AI_EVENTS_TABLE"),
    edgeRetentionCleanup.includes("analytics-retention-cleanup"),
    envTemplate.includes("FREED_EDGE_JOB_LOCK_TTL_MS="),
    !edgeFunctionSources.includes("EXPO_PUBLIC_"),
    !edgeAdultFeedSync.includes("domains: domains"),
    !edgeAdultFeedSync.includes("domainList"),
    readiness.includes("getBackendArchitectureReadiness"),
    readiness.includes("returnsSecrets: false"),
    readiness.includes("FORBIDDEN_PUBLIC_PREFIXES"),
    readiness.includes("getProductionBaseUrlIssues"),
    readiness.includes("Supabase base URL"),
    readiness.includes("Redis base URL"),
    credentialSafety.includes("isPlaceholderValue"),
    credentialSafety.includes("isServerSecret"),
    credentialSafety.includes("isSupabaseServiceRoleKey"),
    credentialSafety.includes("isRedisRestToken"),
    credentialSafety.includes("isMaintenanceSecret"),
    credentialSafety.includes("isFcmServerKey"),
    credentialSafety.includes("isFirebaseProjectId"),
    credentialSafety.includes("isApnsEnvironment"),
    readiness.includes("isSupabaseServiceRoleKey"),
    readiness.includes("isRedisRestToken"),
    readiness.includes("isMaintenanceSecret"),
    readiness.includes("UPSTASH_REDIS_REST_URL"),
    readiness.includes("FCM_SERVER_KEY"),
    readiness.includes("isFirebaseProjectId"),
    readiness.includes("BACKEND_MAINTENANCE_SECRET"),
    backendEventAudit.includes("configurePurchaseVerificationAuditProvider"),
    backendEventAudit.includes("configureAiBackendAuditProvider"),
    backendEventAudit.includes("purchase_token_hash"),
    backendEventAudit.includes("payload_summary"),
    backendEventAudit.includes("SUPABASE_PURCHASE_AUDIT_TABLE"),
    backendEventAudit.includes("SUPABASE_AI_EVENTS_TABLE"),
    backendEventAudit.includes("isSupabaseServiceRoleKey"),
    backendEventAudit.includes("readBackendProviderTimeoutMs"),
    backendEventAudit.includes("getProductionBaseUrlIssues"),
    backendEventAudit.includes("Supabase backend audit base URL"),
    backendProviderTimeout.includes("timed out after"),
    backendInfrastructure.includes("enforceBackendRateLimit"),
    backendInfrastructure.includes("acquireBackendRedisLock"),
    backendInfrastructure.includes("recordBackendJobRun"),
    backendInfrastructure.includes("runBackendJob"),
    backendInfrastructure.includes("readBackendProviderTimeoutMs"),
    backendProviderTimeout.includes("timed out after"),
    backendInfrastructure.includes("UPSTASH_REDIS_REST_URL"),
    backendInfrastructure.includes("isRedisRestToken"),
    backendInfrastructure.includes("shouldFailClosedRateLimit"),
    backendInfrastructure.includes("FREED_BACKEND_RATE_LIMIT_FAIL_CLOSED"),
    backendInfrastructure.includes("backendRateLimitHttpStatus"),
    backendInfrastructure.includes("Redis rate-limit base URL"),
    backendInfrastructure.includes("Redis lock base URL"),
    backendInfrastructure.includes("Redis unlock base URL"),
    backendInfrastructure.includes("isSupabaseServiceRoleKey"),
    backendInfrastructure.includes("SUPABASE_JOB_RUNS_TABLE"),
    backendInfrastructure.includes('"analytics"'),
    backendInfrastructure.includes("on_conflict=idempotency_key"),
    backendInfrastructure.includes("getProductionBaseUrlIssues"),
    backendInfrastructure.includes("Supabase backend job-run base URL"),
    adultFeedPublication.includes("readBackendProviderTimeoutMs"),
    adultFeedPublication.includes("getProductionBaseUrlIssues"),
    adultFeedPublication.includes("Supabase adult-domain feed base URL"),
    backendProviderTimeout.includes("timed out after"),
    remoteNotifications.includes("validateRemoteNotificationAuth"),
    remoteNotifications.includes("timingSafeEqual"),
    remoteNotifications.includes("isServerSecret"),
    remoteNotifications.includes("sanitizeRemoteNotificationRequest"),
    remoteNotifications.includes("allowedRequestKeys"),
    remoteNotifications.includes("normalizeDeviceToken"),
    remoteNotifications.includes("sanitizeNotificationReason"),
    remoteNotifications.includes("buildSafeRemoteNotificationPayload"),
    remoteNotifications.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET"),
    remoteNotifications.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS"),
    remoteNotifications.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES"),
    remoteNotifications.includes("readBoundedResponseJson"),
    remoteNotifications.includes("fetchNotificationProviderResponse"),
    remoteNotifications.includes("timed out after"),
    remoteNotifications.includes("FCM_SERVER_KEY"),
    remoteNotifications.includes("FIREBASE_PROJECT_ID"),
    remoteNotifications.includes("APNS_PRIVATE_KEY"),
    remoteNotifications.includes("isFcmServerKey"),
    remoteNotifications.includes("isFirebaseProjectId"),
    remoteNotifications.includes("isGoogleAccessToken"),
    remoteNotifications.includes("isPrivateKeyPem"),
    remoteNotifications.includes("isAppleKeyId"),
    remoteNotifications.includes("isAppleTeamId"),
    remoteNotifications.includes("isBundleId"),
    remoteNotifications.includes("isApnsEnvironment"),
    remoteNotifications.includes("route: \"checkin\""),
    notificationRoute.includes("sendRemoteNotification"),
    notificationRoute.includes("enforceBackendRateLimit"),
    notificationRoute.includes("backendRateLimitHttpStatus"),
    notificationRoute.includes("readBoundedJsonBody"),
    analyticsRoute.includes("ingestRecoveryAnalytics"),
    analyticsIngestion.includes("FREED_ANALYTICS_SUPABASE_TIMEOUT_MS"),
    analyticsIngestion.includes("Analytics Supabase ingestion timed out"),
    analyticsIngestion.includes("getProductionBaseUrlIssues"),
    analyticsIngestion.includes("Supabase analytics base URL"),
    analyticsRoute.includes("enforceBackendRateLimit"),
    analyticsRoute.includes("backendRateLimitError"),
    analyticsRoute.includes("readBoundedJsonBody"),
    serverRequestBody.includes("readBoundedJsonBody"),
    serverRequestBody.includes("content-length"),
    serverRequestBody.includes("application/json"),
    serverRequestBody.includes("Malformed JSON body."),
    serverRequestBody.includes("413"),
    recoveryBackupSync.includes("sanitizeRecoveryBackupSyncRequest"),
    recoveryBackupSync.includes("syncEncryptedRecoveryBackup"),
    recoveryBackupSync.includes("Supabase Auth user endpoint"),
    recoveryBackupSync.includes("SUPABASE_RECOVERY_BACKUP_TABLE"),
    recoveryBackupSync.includes("isSupabaseServiceRoleKey"),
    recoveryBackupSync.includes("getProductionBaseUrlIssues"),
    recoveryBackupSync.includes("Supabase Auth base URL"),
    recoveryBackupSync.includes("Supabase encrypted backup base URL"),
    recoveryBackupSync.includes("readBoundedResponseJson"),
    recoveryBackupSync.includes("readBackendProviderResponseMaxBytes"),
    has("src/lib/supabase-auth-client.ts"),
    read("src/lib/supabase-auth-client.ts").includes("requestSupabaseMagicLink"),
    read("src/lib/supabase-auth-client.ts").includes("buildSupabaseOAuthUrl"),
    read("src/lib/supabase-auth-client.ts").includes("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    read("src/lib/supabase-auth-client.ts").includes("EXPO_PUBLIC_SUPABASE_AUTH_TIMEOUT_MS"),
    read("src/lib/supabase-auth-client.ts").includes("EXPO_PUBLIC_SUPABASE_AUTH_RESPONSE_MAX_BYTES"),
    read("src/lib/supabase-auth-client.ts").includes("getProductionBaseUrlIssues"),
    read("src/lib/supabase-auth-client.ts").includes("Supabase Auth base URL"),
    read("src/lib/supabase-auth-client.ts").includes("readBoundedResponseJson"),
    read("src/features/freed-app.tsx").includes("requestSupabaseMagicLink"),
    read("src/features/freed-app.tsx").includes("extractSupabaseAccessTokenFromUrl"),
    recoveryBackupSyncRoute.includes("syncEncryptedRecoveryBackup"),
    recoveryBackupSyncRoute.includes("enforceBackendRateLimit"),
    backendRetentionCleanup.includes("cleanupExpiredBackendRows"),
    backendRetentionCleanup.includes("validateBackendMaintenanceAuth"),
    backendRetentionCleanup.includes("BACKEND_MAINTENANCE_SECRET"),
    backendRetentionCleanup.includes("timingSafeEqual"),
    backendRetentionCleanup.includes("isMaintenanceSecret"),
    backendRetentionCleanup.includes("isSupabaseServiceRoleKey"),
    backendRetentionCleanup.includes("getProductionBaseUrlIssues"),
    backendRetentionCleanup.includes("Supabase retention cleanup base URL"),
    backendRetentionCleanup.includes("expires_at=lt."),
    backendCleanupRoute.includes("cleanupExpiredBackendRows"),
    backendCleanupRoute.includes("runBackendJob"),
    backendCleanupRoute.includes('jobName: "analytics-retention-cleanup"'),
    readinessRoute.includes("getBackendArchitectureReadiness(process.env)"),
    readinessRoute.includes('"Cache-Control": "no-store"'),
    auditScript.includes("supabase-schema-core-tables"),
	    auditScript.includes("supabase-migration-artifact"),
	    auditScript.includes("supabase-edge-functions-cron-contract"),
	    auditScript.includes(migrationPath),
	    auditScript.includes(analyticsPrivacyMigrationPath),
    auditScript.includes("backend-readiness-route-no-secrets"),
    auditScript.includes("encrypted-recovery-backup-sync"),
    auditScript.includes("retention-cleanup-job"),
    auditScript.includes("bounded-json-request-bodies"),
    envTemplate.includes("BACKEND_MAINTENANCE_SECRET="),
    envTemplate.includes("EXPO_PUBLIC_SUPABASE_ANON_KEY="),
    envTemplate.includes("SUPABASE_RECOVERY_BACKUP_TABLE=encrypted_recovery_backups"),
    envTemplate.includes("SUPABASE_PURCHASE_AUDIT_TABLE=purchase_verification_events"),
    envTemplate.includes("UPSTASH_REDIS_REST_TOKEN="),
    envTemplate.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET="),
    envTemplate.includes("FIREBASE_PROJECT_ID="),
    envTemplate.includes("APNS_PRIVATE_KEY="),
    !envTemplate.includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
    !envTemplate.includes("EXPO_PUBLIC_UPSTASH")
  ];

  return passOrFail(
    "backend-architecture-contract",
    checks.every(Boolean),
    "Backend contract covers the compact production backend deployment packet, deployable Supabase migration plus Supabase Edge Function cron/admin paths, PostgreSQL analytics, feed versions, encrypted recovery backup sync, purchase verification audits, redacted AI events, retention cleanup, job runs, bounded public JSON request bodies, explicit public-client revokes with service-role-only grants, timeout-bounded Redis/Upstash rate limits and locks with production fail-closed behavior, server-authorized timeout-bounded FCM/APNs notification dispatch with validated provider credentials, and a no-secret readiness endpoint.",
    "Restore backend schema/migration, readiness route, env handoff, and backend audit before release."
  );
}

function auditExternalValidation(): AuditItem[] {
  return getValidationEvidenceResults(root).map((result) =>
    item(result.id, result.status, result.evidence, result.next)
  );
}

const designFiles = ["freed.html", "ios-frame.jsx", "freed-v2/tokens.css", "freed-v2/tokens.js"];
const appSurfaceSource = read("src/features/freed-app.tsx");
const protectionPermissionsSource = read("src/lib/protection-permissions.ts");
const recoveryStateSource = read("src/lib/recovery-state.ts");
const audit: AuditItem[] = [
  passOrFail(
    "prototype-design-files",
    designFiles.every(has) && countFiles("ref", /\.png$/) > 0 && countFiles("ref2", /\.png$/) > 0,
    "Prototype files and exported visual references are present.",
    "Restore missing design/prototype references."
  ),
  passOrFail(
    "app-surface",
    ["app/index.tsx", "src/features/freed-app.tsx", "src/constants/design.ts"].every(has) &&
      appSurfaceSource.includes("AppSelectionScreen") &&
      appSurfaceSource.includes('setScreen("appSelection")') &&
      appSurfaceSource.includes("completeOnboardingWithSelectedApps") &&
      appSurfaceSource.includes("getInitialScreenForRecoveryState") &&
      appSurfaceSource.includes("markOnboardingPaywallPresented") &&
      appSurfaceSource.includes("markProtectionActivated") &&
      appSurfaceSource.includes("clearProtectionActivation") &&
      appSurfaceSource.includes("hasProtectionActivationForPlatform") &&
      appSurfaceSource.includes("hasNativeProtectionActivationRevoked") &&
      appSurfaceSource.includes("if (readiness.activationReady) return false") &&
      appSurfaceSource.includes("shouldReturnToProtectionSetupAfterRevocation") &&
      appSurfaceSource.includes("Protection was turned off or changed in system settings") &&
      appSurfaceSource.includes("setupAutoAdvanceRef") &&
      appSurfaceSource.includes("continueAfterOptional") &&
      appSurfaceSource.includes("waitingForAppReturn") &&
      appSurfaceSource.includes("returnedFromExternalStep") &&
      appSurfaceSource.includes('pending.waitingForAppReturn && !pending.returnedFromExternalStep && completedStep.status !== "complete"') &&
      appSurfaceSource.includes("orderedSetupActionLabel") &&
      appSurfaceSource.includes("Continuing setup: ${nextRequiredStep.title}.") &&
      appSurfaceSource.includes("can be finished later. Continuing setup:") &&
      appSurfaceSource.includes("All required setup rows are ready. Running the activation test now.") &&
      appSurfaceSource.includes("activationRecoveryStep") &&
      appSurfaceSource.includes("getProtectionActivationRecoveryStep(permissionPlan, activationTest?.nativeDiagnostics)") &&
      appSurfaceSource.includes("label={`Fix: ${activationRecoveryStep.title}`}") &&
      protectionPermissionsSource.includes("getProtectionActivationRecoveryStep") &&
      protectionPermissionsSource.includes("diagnostics.issueCodes") &&
      protectionPermissionsSource.includes("android-vpn-consent-required") &&
      protectionPermissionsSource.includes("ios-safari-rules-missing") &&
      protectionPermissionsSource.includes("diagnostics.vpnConsentRequired === true") &&
      protectionPermissionsSource.includes("diagnostics.privateDnsMode === \"hostname\"") &&
      protectionPermissionsSource.includes("ios-safari-content-blocker") &&
      appSurfaceSource.includes("if (nextRequiredStep.id === completedStep.id) return") &&
      appSurfaceSource.includes("return `Continue: ${nextRequiredStep.title}`") &&
      appSurfaceSource.includes("Open: ${nextRequiredStep.title}") &&
      appSurfaceSource.includes("appSelectionReturnToProtectionSetup") &&
      appSurfaceSource.includes("appSelectionReturnPending") &&
      appSurfaceSource.includes("onAppSelectionReturnHandled") &&
      appSurfaceSource.includes("Selected apps are saved. Syncing app timers to native protection now.") &&
      appSurfaceSource.includes("disabled={requiresAndroidAppSelection && selectedCount <= 0}") &&
      appSurfaceSource.includes("Last Android settings route:") &&
      appSurfaceSource.includes("Target Android settings component:") &&
      appSurfaceSource.includes("androidSettingsFallbackUsed") &&
      appSurfaceSource.includes("androidSettingsRouteComponent") &&
      appSurfaceSource.includes("androidSettingsRouteError") &&
      appSurfaceSource.includes("adultFilterStep ? runStepAction(adultFilterStep) : runAction(\"adult\", applyAdultContentFilter)") &&
      appSurfaceSource.includes("appInterventionStep ? runStepAction(appInterventionStep) : runAction(\"apps\", requestProtectionAuthorization)") &&
      appSurfaceSource.includes("usageAccessStep ? runStepAction(usageAccessStep) : runAction(\"usage\", openUsageAccessSettings)") &&
      appSurfaceSource.includes("orderedSetupActionLabel(adultFilterStep, \"Enable Adult Block\")") &&
      appSurfaceSource.includes("orderedSetupActionLabel(appInterventionStep, \"Enable App Timer Permission\")") &&
      appSurfaceSource.includes("orderedSetupActionLabel(usageAccessStep, \"Enable Usage Access\")") &&
      appSurfaceSource.includes('privateDnsStep ? runStepAction(privateDnsStep) : runAction("settings", openPrivateDnsSettings)') &&
      appSurfaceSource.includes("interventionBodyForAttempt") &&
      appSurfaceSource.includes("selected app or short-form loop") &&
      appSurfaceSource.includes("explicit search before it could turn into a scroll loop") &&
      appSurfaceSource.includes("blocked an explicit site before the page loaded") &&
      appSurfaceSource.includes("App and short-form earned unlocks pause only the package that earned them; browser challenge windows stay local") &&
      !appSurfaceSource.includes("detected adult-content intent and interrupted the loop before the page loaded") &&
      recoveryStateSource.includes("protectionActivatedAt") &&
      recoveryStateSource.includes("onboardingPaywallPresentedAt") &&
      appSurfaceSource.includes("selectedAppPackageCount={disciplineSettings.blockedAppPackages.length}") &&
      !appSurfaceSource.includes("selected by default"),
    "Expo Router shell and FREED app surface are present, with explicit app selection before paywall, persisted paywall handoff, platform-scoped protection activation before main entry, source-aware intervention copy, native setup readiness revocation returning users to setup, Android settings route fallback diagnostics, permission setup auto-advancing plus labeling actions to the next required OS/native step after return, and failed activation diagnostics mapped back to exact setup repair actions.",
    "Restore app shell or main feature surface."
  ),
  auditPromptTraceability(),
  auditReleaseVerifier(),
  auditReleaseEnvPreflightHarness(),
  auditProductionEnvTemplate(),
  auditStoreLaunchConfig(),
  auditStoreLegalHostedUrls(),
  auditValidationEvidenceWorkflow(),
  auditClassifier(),
  auditIosNative(),
  auditAndroidNative(),
  auditChallengeVerificationContract(),
  auditChallengePersonalizationContext(),
  auditDisciplineConfigurationContract(),
  auditAccessibilityContract(),
  auditPrivacyContract(),
  auditRuntimeDataIntegrity(),
  auditBackendArchitectureContract(),
  auditProductionBackendInfrastructure(),
  auditProductionAnalyticsIngestion(),
  auditProductionNotificationBackend(),
  auditProductionAdultDomainFeed(),
  auditAndroidReleaseSigning(),
  auditDependencySecurity(),
  passOrFail(
    "monetization-adapter-scaffold",
    has("src/lib/native-monetization-adapter.ts") &&
      has("src/lib/native-iap-adapter.ts") &&
      has("src/lib/purchase-verification.ts") &&
      has("app/api/purchases/verify+api.ts") &&
      read("src/lib/native-iap-adapter.ts").includes("createNativeIapStoreAdapter") &&
      read("src/lib/native-iap-adapter.ts").includes("EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT") &&
      read("src/lib/native-iap-adapter.ts").includes('getProductionEndpointIssues(endpoint, "purchase verify endpoint")') &&
      read("src/lib/native-iap-adapter.ts").includes("EXPO_PUBLIC_PURCHASE_VERIFY_TIMEOUT_MS") &&
      read("src/lib/native-iap-adapter.ts").includes("EXPO_PUBLIC_PURCHASE_VERIFY_RESPONSE_MAX_BYTES") &&
      read("src/lib/native-iap-adapter.ts").includes("readBoundedResponseJson") &&
      read("src/lib/native-iap-adapter.ts").includes("Purchase verification request timed out") &&
      read("src/lib/native-iap-adapter.ts").includes("Native purchases fail closed unless FREED's server confirms") &&
      read("src/lib/native-monetization-adapter.ts").includes("createAdMobRewardedAdapter") &&
      read("src/lib/monetization.ts").includes("Native purchase returned a product reserved for a future FREED release.") &&
      read("src/lib/monetization.ts").includes("Native restore returned a product reserved for a future FREED release.") &&
      read("src/lib/native-monetization-adapter.ts").includes("restoredProductIds.size > 0") &&
      read("src/lib/native-monetization-adapter.ts").includes("Restored premium entitlement did not match a FREED launch product.") &&
      read("src/lib/purchase-verification.ts").includes("verifyPurchasePayload") &&
      read("src/lib/purchase-verification.ts").includes("createAppleServerJwt") &&
      read("src/lib/purchase-verification.ts").includes("createGooglePlayAccessToken") &&
      read("src/lib/purchase-verification.ts").includes("FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS") &&
      read("src/lib/purchase-verification.ts").includes("FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES") &&
      read("src/lib/purchase-verification.ts").includes("readBoundedResponseJson") &&
      read("src/lib/purchase-verification.ts").includes("sanitizePurchaseToken") &&
      read("src/lib/purchase-verification.ts").includes("sanitizePurchaseReason") &&
      read("src/lib/purchase-verification.ts").includes("fetchStoreProviderResponse") &&
      read("src/lib/purchase-verification.ts").includes("timed out after") &&
      read("src/lib/purchase-verification.ts").includes("isJwt") &&
      read("src/lib/purchase-verification.ts").includes("isGoogleAccessToken") &&
      read("src/lib/purchase-verification.ts").includes("GOOGLE_PLAY_PACKAGE_NAME") &&
      read("app.config.js").includes("react-native-google-mobile-ads") &&
      !read("app.json").includes('"react-native-google-mobile-ads"'),
    "Native monetization adapter scaffolds exist for expo-iap entitlements, server-minted store verification, fail-closed validated purchase verification, Core 3-only purchase/restore product activation, AdMob-style rewarded ads, and dynamic Google Mobile Ads config without ignored root app.json keys.",
    "Restore native IAP, purchase verification, and ad adapters before wiring production billing/ad SDKs."
  ),
  passOrFail(
    "server-ai-routes",
    has("app/api/clara+api.ts") &&
      has("app/api/challenges+api.ts") &&
      has("app/api/retention+api.ts") &&
      has("src/lib/server-ai-provider.ts") &&
      read("src/lib/server-ai-provider.ts").includes("isOpenAiApiKey") &&
      read("src/lib/server-ai-provider.ts").includes("isGoogleAiApiKey") &&
      read("src/lib/server-ai-provider.ts").includes("isUsableRemoteModelId") &&
      read("src/lib/server-ai-provider.ts").includes("FREED_AI_PROVIDER_TIMEOUT_MS") &&
      read("src/lib/server-ai-provider.ts").includes("FREED_AI_PROVIDER_RESPONSE_MAX_BYTES") &&
      read("src/lib/server-ai-provider.ts").includes("readBoundedResponseJson") &&
      read("src/lib/server-ai-provider.ts").includes("fetchServerAiProviderResponse") &&
      read("src/lib/server-ai-provider.ts").includes("timed out after"),
    "Expo API routes for CLARA, dynamic challenge generation, and retention orchestration are present, and server AI runtime rejects placeholder provider keys/models while bounding provider calls.",
    "Restore app/api/clara+api.ts, app/api/challenges+api.ts, app/api/retention+api.ts, and server AI credential validation."
  ),
  auditAiSafetyHarness(),
  auditBackendReadinessSmokeHarness(),
  auditSupabaseSchemaSmokeHarness(),
  auditAdultDomainFeedSmokeHarness(),
  auditAnalyticsIngestionSmokeHarness(),
  auditRemoteNotificationSmokeHarness(),
  auditAiBackendSmokeHarness(),
  auditPurchaseVerificationSmokeHarness(),
  auditClientBundleSecretHarness(),
  auditMonetization(),
  auditAiBackend(),
  ...auditExternalValidation()
];

const releaseVerifierGateDrift = releaseVerifierGateManifestIssue(audit);
if (releaseVerifierGateDrift) {
  const verifierGate = audit.find((entry) => entry.id === "release-verifier-command-sequence");
  if (verifierGate) {
    verifierGate.status = "fail";
    verifierGate.evidence = `Release verifier expected release readiness gate manifest drifted: ${releaseVerifierGateDrift}.`;
    verifierGate.next = "Update scripts/release-verify.js expectedReleaseReadinessGateIds to match the full scripts/release-readiness.ts audit gate order.";
  }
}

const releaseVerifierPreflightCheckDrift = releaseVerifierPreflightCheckManifestIssue();
if (releaseVerifierPreflightCheckDrift) {
  const verifierGate = audit.find((entry) => entry.id === "release-verifier-command-sequence");
  if (verifierGate) {
    verifierGate.status = "fail";
    verifierGate.evidence = `Release verifier expected preflight check manifest drifted: ${releaseVerifierPreflightCheckDrift}.`;
    verifierGate.next = "Update scripts/release-verify.js expectedPreflightReportCheckIds to match the full scripts/release-env-preflight.js report check order.";
  }
}

const counts = audit.reduce<Record<AuditStatus, number>>(
  (accumulator, entry) => {
    accumulator[entry.status] += 1;
    return accumulator;
  },
  { pass: 0, warn: 0, fail: 0 }
);

function sanitizeReportText(value: string) {
  return value
    .replace(/https?:\/\/[^\s,|)]+/gi, "[redacted-url]")
    .replace(/\b(?:token|secret|password|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key|receipt)=\S+/gi, "[redacted-secret]")
    .replace(/\b(?:sk-(?:proj-)?[0-9A-Za-z_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z._-]{20,})\b/g, "[redacted-secret]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-secret]");
}

function writeReleaseReadinessReport(reportPath: string) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(
    absolute,
    `${JSON.stringify(
      {
        schemaVersion: "release-readiness-report-v1",
        generatedAt: new Date().toISOString(),
        sanitized: true,
        strict,
        summary: {
          passCount: counts.pass,
          warnCount: counts.warn,
          failCount: counts.fail
        },
        results: audit.map((entry) => ({
          id: entry.id,
          status: entry.status,
          evidence: sanitizeReportText(entry.evidence),
          next: sanitizeReportText(entry.next ?? "")
        }))
      },
      null,
      2
    )}\n`
  );
}

if (options.reportPath) {
  writeReleaseReadinessReport(options.reportPath);
}

console.log("# FREED release readiness audit");
console.log(`Result: ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`);
console.log("");
console.log("| Status | Gate | Evidence | Next |");
console.log("| --- | --- | --- | --- |");

for (const entry of audit) {
  const next = entry.next ?? "";
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} | ${next.replace(/\|/g, "/")} |`);
}

if (strict && counts.fail > 0) {
  process.exitCode = 1;
}
