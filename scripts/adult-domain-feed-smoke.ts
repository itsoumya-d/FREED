import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { SAFARI_SHORT_FORM_WEB_RULE_FILTERS } from "../src/lib/blocking-engine";
import { formatEndpointIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import { fetchRemoteProviderResponse, readRemoteProviderJson } from "../src/lib/remote-provider-timeout";

const { assertSafeReportPath: assertSafeWorkspaceReportPath } = require("./lib/report-path-safety");

type SmokeResult = {
  id: string;
  status: "PASS" | "FAIL";
  detail: string;
};

type JsonRecord = Record<string, unknown>;

type AdultDomainFeedSmokeReport = {
  schemaVersion: "adult-domain-feed-smoke-v1";
  generatedAt: string;
  sanitized: true;
  endpoint: string | null;
  summary: {
    passCount: number;
    failCount: number;
  };
  feed: null | {
    version: string;
    generatedAt: string;
    checksum: string;
    domainCount: number;
    exceptionCount: number;
    sourceCount: number;
    reviewedSourceReportCount: number;
    fetchedSourceReportCount: number;
    rejectedNormalDomainCount: number;
    cacheStatus: string;
    cacheTtlSeconds: number | null;
    cacheExpiresAt: string;
    sourceMaxBytes: number | null;
  };
  contractProof: {
    endpointPathRequired: "/api/adult-domain-feed";
    requestTimeoutMs: number;
    feedContract: {
      maxFeedAgeHours: number;
      maxClockSkewMinutes: number;
      readinessRequired: true;
      headersRequired: string[];
      allowedCacheStatuses: string[];
      cacheTtlSeconds: number | null;
      sourceMaxBytes: number | null;
      sourceMaxBytesRange: {
        minBytes: number;
        maxBytes: number;
      };
      normalBrowsingDomainsChecked: string[];
      rejectedNormalDomainCount: number;
    };
    syncProofs: {
      feedJsonContractValidated: boolean;
      conditional304Validated: boolean;
      safariContentBlockerExportValidated: boolean;
      safariFormatQuery: "format=safari-content-blocker";
      safariShortFormWebRuleCount: number;
    };
    sourceReportBoundary: {
      reviewedSourceReportCount: number;
      fetchedSourceReportCount: number;
      sanitizedSourceReportsRequired: true;
      sourceUrlQueryStringsForbidden: true;
      rawSourceUrlsWithQueryStringsOmitted: true;
      fullDomainListOmitted: true;
    };
    responseBoundary: {
      privateEchoPatternsChecked: number;
      secretValuesOmitted: true;
      serverSecretKeyNamesChecked: string[];
      reportContainsOnlyCountsAndMetadata: true;
    };
  };
  results: SmokeResult[];
};

const DEFAULT_ADULT_FEED_SMOKE_TIMEOUT_MS = 8_000;
const MIN_ADULT_FEED_SMOKE_TIMEOUT_MS = 50;
const MAX_ADULT_FEED_SMOKE_TIMEOUT_MS = 15_000;
const CACHE_STATUSES = new Set(["hit", "miss", "stale-if-error"]);
const SOURCE_STATUSES = new Set(["fetched", "skipped", "failed"]);
const NORMAL_BROWSING_DOMAINS = ["google.com", "youtube.com", "instagram.com", "wikipedia.org", "github.com"];
const REQUIRED_FEED_RESPONSE_HEADERS = [
  "ETag",
  "X-FREED-Adult-Feed-Version",
  "X-FREED-Adult-Feed-Checksum",
  "X-FREED-Adult-Feed-Cache",
  "X-FREED-Adult-Feed-Cache-Expires-At",
  "X-FREED-Adult-Feed-Source-Max-Bytes"
] as const;
const FORBIDDEN_REPORT_PATTERNS = [
  /https?:\/\/[^\s"'<>]+/i,
  /token=(?!redacted)[^"'&\s]+/i,
  /(?:api[_-]?key|secret|password)=([^"'&\s]+)/i,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /ya29\.[0-9A-Za-z._-]{20,}/,
  /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/,
  /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i
] as const;
const MIN_SOURCE_MAX_BYTES = 10_000;
const MAX_SOURCE_MAX_BYTES = 5_000_000;
const MAX_ADULT_FEED_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ADULT_FEED_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SERVER_SECRET_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "BACKEND_MAINTENANCE_SECRET",
  "CRON_SECRET",
  "FREED_ADULT_DOMAIN_FEED_SOURCE_URLS",
  "FREED_ADULT_DOMAIN_FEED_EXTRA_DOMAINS",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
  "FCM_SERVER_KEY",
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_BASE64"
] as const;

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function readBoundedTimeoutMs() {
  const raw = readEnv("FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS") ?? readEnv("EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS");
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_ADULT_FEED_SMOKE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_ADULT_FEED_SMOKE_TIMEOUT_MS;
  return Math.max(MIN_ADULT_FEED_SMOKE_TIMEOUT_MS, Math.min(MAX_ADULT_FEED_SMOKE_TIMEOUT_MS, Math.round(parsed)));
}

function parseArgs(argv: string[]) {
  const options = {
    endpoint: readEnv("EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT"),
    reportPath: null as string | null,
    selfTest: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--endpoint") {
      options.endpoint = next();
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report.");
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run smoke:adult-domain-feed -- [options]

Validates the deployed app/api/adult-domain-feed route. The command checks the
normalized feed JSON, freshness/cache headers, reviewed source reports,
conditional 304 behavior, and Safari content-blocker export used by iOS.

Options:
  --endpoint <url>              Deployed /api/adult-domain-feed route.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object JSON body.`);
  }
  return value as JsonRecord;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function appendQuery(endpoint: string, key: string, value: string) {
  const parsed = new URL(endpoint);
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function stripEtag(value: string | null) {
  return (value ?? "").replace(/^W\//, "").replace(/^"|"$/g, "");
}

function validateEndpoint(endpoint: string | null): SmokeResult {
  if (!endpoint) {
    return { id: "adult-feed-endpoint", status: "FAIL", detail: "EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT is not configured." };
  }

  const endpointIssues = getProductionEndpointIssues(endpoint, "adult domain feed endpoint").filter(
    (entry) => entry.issue !== "is not configured"
  );
  if (endpointIssues.length > 0) {
    return { id: "adult-feed-endpoint", status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }

  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== "/api/adult-domain-feed" && !pathname.endsWith("/api/adult-domain-feed")) {
      return { id: "adult-feed-endpoint", status: "FAIL", detail: "adult domain feed endpoint must target /api/adult-domain-feed." };
    }
  } catch {
    return { id: "adult-feed-endpoint", status: "FAIL", detail: "adult domain feed endpoint is not a valid URL." };
  }

  return { id: "adult-feed-endpoint", status: "PASS", detail: endpoint };
}

function sanitizeEndpointForReport(endpoint: string | null) {
  if (!endpoint) return null;
  try {
    const parsed = new URL(endpoint);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeDetailForReport(detail: string, env: Record<string, string | undefined> = process.env) {
  let sanitized = detail
    .replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/(?:api[_-]?key|secret|password)=([^"'&\s]+)/gi, "[redacted-secret-param]")
    .replace(/token=(?!redacted)[^"'&\s]+/gi, "token=[redacted]")
    .replace(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]")
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[redacted-google-key]")
    .replace(/ya29\.[0-9A-Za-z._-]{20,}/g, "[redacted-google-token]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-domain]");

  for (const key of SERVER_SECRET_KEYS) {
    const value = env[key]?.trim();
    if (!value || value.length < 8) continue;
    sanitized = sanitized.split(value).join(`[redacted-${key}]`);
  }
  return sanitized.slice(0, 1_000);
}

function sanitizeResultsForReport(results: SmokeResult[]) {
  return results.map((result) => ({
    ...result,
    detail: sanitizeDetailForReport(result.detail)
  }));
}

function assertFeedHeaders(headers: Headers, body: JsonRecord) {
  const version = headers.get("x-freed-adult-feed-version");
  const checksum = headers.get("x-freed-adult-feed-checksum");
  const rawEtag = headers.get("etag");
  const etag = stripEtag(rawEtag);
  const cacheStatus = headers.get("x-freed-adult-feed-cache");
  const cacheExpiresAt = headers.get("x-freed-adult-feed-cache-expires-at");
  const sourceMaxBytesHeader = headers.get("x-freed-adult-feed-source-max-bytes");
  const ingestion = asRecord(body.ingestion, "feed ingestion");
  const cache = asRecord(ingestion.cache, "feed cache");
  const sourceMaxBytes = Number.parseInt(sourceMaxBytesHeader ?? "", 10);

  assert.equal(typeof version, "string", "X-FREED-Adult-Feed-Version header is required");
  assert.equal(typeof checksum, "string", "X-FREED-Adult-Feed-Checksum header is required");
  assert.equal(String(body.version), version);
  assert.equal(String(body.checksum), checksum);
  assert.equal(rawEtag, `"${checksum}"`, "ETag must be a quoted checksum validator");
  assert.equal(etag, checksum);
  assert.ok(cacheStatus && CACHE_STATUSES.has(cacheStatus), "X-FREED-Adult-Feed-Cache must be hit, miss, or stale-if-error");
  assert.ok(cacheExpiresAt && Number.isFinite(Date.parse(cacheExpiresAt)), "X-FREED-Adult-Feed-Cache-Expires-At must be valid ISO time");
  assert.ok(
    Number.isInteger(sourceMaxBytes) && sourceMaxBytes >= MIN_SOURCE_MAX_BYTES && sourceMaxBytes <= MAX_SOURCE_MAX_BYTES,
    "X-FREED-Adult-Feed-Source-Max-Bytes must be an integer between 10000 and 5000000"
  );
  assert.equal(sourceMaxBytes, cache.sourceMaxBytes, "source max bytes header must match cache metadata");
}

function assertNoSecretEcho(value: unknown) {
  const text = JSON.stringify(value);
  assert.equal(/token=(?!redacted)[^"'&\s]+/i.test(text), false);
  assert.equal(/(?:api[_-]?key|secret|password)=([^"'&\s]+)/i.test(text), false);
  assert.equal(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/.test(text), false);
  assert.equal(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(text), false);
}

function assertSanitizedSourceReports(sourceReports: unknown[]) {
  assert.ok(sourceReports.length > 0, "Production feed must include at least one reviewed source report.");
  let fetchedCount = 0;
  for (const reportValue of sourceReports) {
    const report = asRecord(reportValue, "source report");
    assert.equal(typeof report.id, "string");
    assert.equal(typeof report.label, "string");
    assert.equal(typeof report.url, "string");
    assert.ok(SOURCE_STATUSES.has(String(report.status)), "source report status must be fetched, skipped, or failed");
    assert.equal(typeof report.sourceLineCount, "number");
    assert.equal(typeof report.domainCount, "number");
    assert.equal(typeof report.rejectedNormalDomainCount, "number");
    if (report.status === "fetched") fetchedCount += 1;

    const url = new URL(String(report.url));
    assert.equal(url.search, "", "source report URLs must not expose query strings");
    assert.equal(url.hash, "", "source report URLs must not expose fragments");
  }
  assert.ok(fetchedCount > 0, "Production feed must fetch at least one reviewed source.");
}

function assertReadiness(body: JsonRecord, domains: unknown[]) {
  const readiness = asRecord(body.readiness, "feed readiness");
  assert.equal(readiness.ready, true);
  assert.equal(readiness.version, body.version);
  assert.equal(readiness.generatedAt, body.generatedAt);
  assert.equal(readiness.checksum, body.checksum);
  assert.equal(readiness.domainCount, domains.length);
  assert.ok(Number(readiness.sourceCount) >= 1);
  assert.deepEqual(readiness.issues, []);
}

function assertFeedFreshness(generatedAt: string, nowMs = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);
  assert.ok(Number.isFinite(generatedAtMs), "feed generatedAt must be valid ISO time");
  assert.ok(generatedAtMs <= nowMs + MAX_ADULT_FEED_CLOCK_SKEW_MS, "feed generatedAt must not be in the future");
  assert.ok(
    nowMs - generatedAtMs <= MAX_ADULT_FEED_AGE_MS,
    "feed generatedAt must be no older than 48 hours for daily reviewed-source sync"
  );
}

function assertAdultFeedBody(value: unknown, headers: Headers, nowMs = Date.now()) {
  const body = asRecord(value, "adult domain feed");
  const domains = asArray(body.domains, "feed domains");
  const exceptions = asArray(body.exceptions, "feed exceptions");
  const sources = asArray(body.sources, "feed sources");
  const ingestion = asRecord(body.ingestion, "feed ingestion");
  const cache = asRecord(ingestion.cache, "feed cache");
  const sourceReports = asArray(ingestion.sourceReports, "feed source reports");
  const rejectedNormalDomains = asArray(ingestion.rejectedNormalDomains, "rejected normal domains");

  assert.equal(typeof body.version, "string");
  assert.equal(typeof body.generatedAt, "string");
  assertFeedFreshness(String(body.generatedAt), nowMs);
  assert.equal(typeof body.checksum, "string");
  assert.ok(domains.length > 0, "feed must include at least one adult domain");
  assert.ok(sources.length > 0, "feed must include source metadata");
  assert.ok(exceptions.length > 0, "feed must include normal browsing exceptions");
  assert.ok(CACHE_STATUSES.has(String(cache.status)), "feed cache status must be hit, miss, or stale-if-error");
  assert.equal(typeof cache.ttlSeconds, "number");
  assert.equal(typeof cache.sourceMaxBytes, "number");
  assert.ok(
    Number(cache.sourceMaxBytes) >= MIN_SOURCE_MAX_BYTES && Number(cache.sourceMaxBytes) <= MAX_SOURCE_MAX_BYTES,
    "feed cache sourceMaxBytes must stay within documented bounds"
  );
  assert.ok(Number.isFinite(Date.parse(String(cache.expiresAt))), "feed cache expiresAt must be valid ISO time");

  for (const domain of domains) {
    assert.equal(typeof domain, "string");
    assert.equal(NORMAL_BROWSING_DOMAINS.includes(String(domain)), false, `normal browsing domain leaked into adult feed: ${domain}`);
  }
  assert.ok(rejectedNormalDomains.every((domain) => typeof domain === "string"));

  assertFeedHeaders(headers, body);
  assertReadiness(body, domains);
  assertSanitizedSourceReports(sourceReports);
  assertNoSecretEcho(body);
  return body;
}

function summarizeFeedForReport(feed: JsonRecord | null): AdultDomainFeedSmokeReport["feed"] {
  if (!feed) return null;
  const domains = Array.isArray(feed.domains) ? feed.domains : [];
  const exceptions = Array.isArray(feed.exceptions) ? feed.exceptions : [];
  const sources = Array.isArray(feed.sources) ? feed.sources : [];
  const ingestion = isRecord(feed.ingestion) ? feed.ingestion : {};
  const cache = isRecord(ingestion.cache) ? ingestion.cache : {};
  const sourceReports = Array.isArray(ingestion.sourceReports) ? ingestion.sourceReports : [];
  const rejectedNormalDomains = Array.isArray(ingestion.rejectedNormalDomains) ? ingestion.rejectedNormalDomains : [];
  return {
    version: String(feed.version ?? ""),
    generatedAt: String(feed.generatedAt ?? ""),
    checksum: String(feed.checksum ?? ""),
    domainCount: domains.length,
    exceptionCount: exceptions.length,
    sourceCount: sources.length,
    reviewedSourceReportCount: sourceReports.length,
    fetchedSourceReportCount: sourceReports.filter((report) => isRecord(report) && report.status === "fetched").length,
    rejectedNormalDomainCount: rejectedNormalDomains.length,
    cacheStatus: String(cache.status ?? ""),
    cacheTtlSeconds: typeof cache.ttlSeconds === "number" && Number.isFinite(cache.ttlSeconds) ? cache.ttlSeconds : null,
    cacheExpiresAt: String(cache.expiresAt ?? ""),
    sourceMaxBytes: typeof cache.sourceMaxBytes === "number" && Number.isFinite(cache.sourceMaxBytes)
      ? cache.sourceMaxBytes
      : null
  };
}

function resultPassed(results: SmokeResult[], id: string) {
  return results.some((entry) => entry.id === id && entry.status === "PASS");
}

function buildContractProof(
  feed: JsonRecord | null,
  results: SmokeResult[]
): AdultDomainFeedSmokeReport["contractProof"] {
  const summary = summarizeFeedForReport(feed);
  return {
    endpointPathRequired: "/api/adult-domain-feed",
    requestTimeoutMs: readBoundedTimeoutMs(),
    feedContract: {
      maxFeedAgeHours: MAX_ADULT_FEED_AGE_MS / (60 * 60 * 1000),
      maxClockSkewMinutes: MAX_ADULT_FEED_CLOCK_SKEW_MS / (60 * 1000),
      readinessRequired: true,
      headersRequired: [...REQUIRED_FEED_RESPONSE_HEADERS],
      allowedCacheStatuses: [...CACHE_STATUSES],
      cacheTtlSeconds: summary?.cacheTtlSeconds ?? null,
      sourceMaxBytes: summary?.sourceMaxBytes ?? null,
      sourceMaxBytesRange: {
        minBytes: MIN_SOURCE_MAX_BYTES,
        maxBytes: MAX_SOURCE_MAX_BYTES
      },
      normalBrowsingDomainsChecked: [...NORMAL_BROWSING_DOMAINS],
      rejectedNormalDomainCount: summary?.rejectedNormalDomainCount ?? 0
    },
    syncProofs: {
      feedJsonContractValidated: resultPassed(results, "adult-feed-json-contract"),
      conditional304Validated: resultPassed(results, "adult-feed-conditional-304"),
      safariContentBlockerExportValidated: resultPassed(results, "adult-feed-safari-content-blocker"),
      safariFormatQuery: "format=safari-content-blocker",
      safariShortFormWebRuleCount: SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length
    },
    sourceReportBoundary: {
      reviewedSourceReportCount: summary?.reviewedSourceReportCount ?? 0,
      fetchedSourceReportCount: summary?.fetchedSourceReportCount ?? 0,
      sanitizedSourceReportsRequired: true,
      sourceUrlQueryStringsForbidden: true,
      rawSourceUrlsWithQueryStringsOmitted: true,
      fullDomainListOmitted: true
    },
    responseBoundary: {
      privateEchoPatternsChecked: FORBIDDEN_REPORT_PATTERNS.length,
      secretValuesOmitted: true,
      serverSecretKeyNamesChecked: [...SERVER_SECRET_KEYS],
      reportContainsOnlyCountsAndMetadata: true
    }
  };
}

function assertSafariContentBlockerBody(value: unknown, feedChecksum: string, feedDomainCount: number) {
  const body = asRecord(value, "Safari content-blocker feed");
  const rules = asArray(body.rules, "Safari content-blocker rules");
  const ingestion = asRecord(body.ingestion, "Safari content-blocker ingestion");

  assert.equal(body.checksum, feedChecksum);
  assert.ok(rules.length >= feedDomainCount + SAFARI_SHORT_FORM_WEB_RULE_FILTERS.length, "Safari content-blocker export must include adult domains and short-form web rules");
  assert.equal(typeof ingestion.rejectedNormalDomainCount, "number");
  assertSanitizedSourceReports(asArray(ingestion.sourceReports, "Safari source reports"));
  assertNoSecretEcho(body);

  const filters = rules.map((ruleValue) => {
    const rule = asRecord(ruleValue, "Safari rule");
    const trigger = asRecord(rule.trigger, "Safari rule trigger");
    const action = asRecord(rule.action, "Safari rule action");
    assert.equal(action.type, "block");
    assert.equal(typeof trigger["url-filter"], "string");
    return String(trigger["url-filter"]);
  });
  assert.ok(filters.some((filter) => filter.includes("youtube") && filter.includes("/shorts")), "Safari rules must block YouTube Shorts web paths");
  assert.ok(filters.some((filter) => filter.includes("instagram") && filter.includes("/reel")), "Safari rules must block Instagram Reels web paths");
  assert.ok(filters.some((filter) => filter.includes("tiktok") && filter.includes("/foryou")), "Safari rules must block TikTok For You web paths");
}

async function fetchJson(endpoint: string, timeoutMs: number, label: string) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" }
  }, timeoutMs, label);
  const body = await readRemoteProviderJson(response, timeoutMs, `${label} response`);
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(body).slice(0, 240)}`);
  }
  return { response, body };
}

async function smokeFeedJson(endpoint: string, timeoutMs: number) {
  const { response, body } = await fetchJson(endpoint, timeoutMs, "Adult-domain feed smoke request");
  return assertAdultFeedBody(body, response.headers);
}

async function smokeConditional304(endpoint: string, checksum: string, timeoutMs: number) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "If-None-Match": `"${checksum}"`,
      "X-FREED-Adult-Feed-Checksum": checksum
    }
  }, timeoutMs, "Adult-domain feed conditional smoke request");
  assert.equal(response.status, 304);
  assert.equal(response.headers.get("etag"), `"${checksum}"`);
  assert.equal(stripEtag(response.headers.get("etag")), checksum);
  assert.equal(response.headers.get("x-freed-adult-feed-checksum"), checksum);
}

async function smokeSafariContentBlocker(endpoint: string, checksum: string, domainCount: number, timeoutMs: number) {
  const { body } = await fetchJson(appendQuery(endpoint, "format", "safari-content-blocker"), timeoutMs, "Adult-domain Safari content-blocker smoke request");
  assertSafariContentBlockerBody(body, checksum, domainCount);
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function buildSmokeReport(endpoint: string | null, feed: JsonRecord | null, results: SmokeResult[]): AdultDomainFeedSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  return {
    schemaVersion: "adult-domain-feed-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    endpoint: sanitizeEndpointForReport(endpoint),
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    feed: summarizeFeedForReport(feed),
    contractProof: buildContractProof(feed, results),
    results: sanitizedResults
  };
}

function writeSmokeReport(reportPath: string, report: AdultDomainFeedSmokeReport) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const endpointResult = validateEndpoint(options.endpoint);
  const results: SmokeResult[] = [endpointResult];
  let feed: JsonRecord | null = null;

  if (endpointResult.status === "PASS" && options.endpoint) {
    const timeoutMs = readBoundedTimeoutMs();
    try {
      feed = await smokeFeedJson(options.endpoint, timeoutMs);
      results.push({ id: "adult-feed-json-contract", status: "PASS", detail: `${feed.domains instanceof Array ? feed.domains.length : 0} domains` });
    } catch (error) {
      results.push({ id: "adult-feed-json-contract", status: "FAIL", detail: error instanceof Error ? error.message : "unknown feed JSON failure" });
    }

    if (feed) {
      try {
        await smokeConditional304(options.endpoint, String(feed.checksum), timeoutMs);
        results.push({ id: "adult-feed-conditional-304", status: "PASS", detail: String(feed.checksum) });
      } catch (error) {
        results.push({ id: "adult-feed-conditional-304", status: "FAIL", detail: error instanceof Error ? error.message : "unknown conditional request failure" });
      }

      try {
        await smokeSafariContentBlocker(options.endpoint, String(feed.checksum), asArray(feed.domains, "feed domains").length, timeoutMs);
        results.push({ id: "adult-feed-safari-content-blocker", status: "PASS", detail: String(feed.checksum) });
      } catch (error) {
        results.push({ id: "adult-feed-safari-content-blocker", status: "FAIL", detail: error instanceof Error ? error.message : "unknown Safari content-blocker failure" });
      }
    }
  }

  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(options.reportPath, buildSmokeReport(options.endpoint, feed, results));
  }

  console.log("# FREED adult-domain feed smoke");
  console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log("");
  console.log("| Status | Case | Detail |");
  console.log("| --- | --- | --- |");
  for (const result of results) {
    console.log(`| ${result.status} | ${result.id} | ${sanitizeDetailForReport(result.detail).replace(/\|/g, "/")} |`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

function sampleFeed() {
  return {
    version: "feed-smoke-test",
    generatedAt: "2026-05-18T00:00:00.000Z",
    checksum: "fnv1a32:12345678",
    domains: ["adult.example", "media.adult.example"],
    exceptions: ["youtube.com", "google.com"],
    sources: [{ id: "reviewed", label: "Reviewed Feed", domainCount: 2 }],
    readiness: {
      ready: true,
      version: "feed-smoke-test",
      generatedAt: "2026-05-18T00:00:00.000Z",
      domainCount: 2,
      sourceCount: 1,
      checksum: "fnv1a32:12345678",
      issues: []
    },
    ingestion: {
      sourceReports: [
        {
          id: "reviewed",
          label: "Reviewed Feed",
          url: "https://feeds.freedrecovery.app/reviewed.txt",
          status: "fetched",
          sourceLineCount: 4,
          domainCount: 2,
          rejectedNormalDomainCount: 1
        }
      ],
      rejectedNormalDomains: ["youtube.com"],
      cache: {
        status: "miss",
        ttlSeconds: 3600,
        sourceMaxBytes: 2_000_000,
        expiresAt: "2026-05-18T01:00:00.000Z",
        stale: false
      }
    }
  };
}

function sampleSafariFeed() {
  return {
    version: "feed-smoke-test",
    generatedAt: "2026-05-18T00:00:00.000Z",
    checksum: "fnv1a32:12345678",
    rules: [
      {
        trigger: { "url-filter": "^https?://([^/?#]+\\\\.)?adult\\\\.example([/:?#]|$)" },
        action: { type: "block" }
      },
      {
        trigger: { "url-filter": "^https?://([^/?#]+\\\\.)?media\\\\.adult\\\\.example([/:?#]|$)" },
        action: { type: "block" }
      },
      ...SAFARI_SHORT_FORM_WEB_RULE_FILTERS.map((filter) => ({
        trigger: { "url-filter": filter },
        action: { type: "block" }
      }))
    ],
    ingestion: {
      sourceReports: sampleFeed().ingestion.sourceReports,
      rejectedNormalDomainCount: 1,
      cache: sampleFeed().ingestion.cache
    }
  };
}

function runSelfTest() {
  const selfTestNowMs = Date.parse("2026-05-18T12:00:00.000Z");
  const headers = new Headers({
    ETag: '"fnv1a32:12345678"',
    "X-FREED-Adult-Feed-Version": "feed-smoke-test",
    "X-FREED-Adult-Feed-Checksum": "fnv1a32:12345678",
    "X-FREED-Adult-Feed-Cache": "miss",
    "X-FREED-Adult-Feed-Cache-Expires-At": "2026-05-18T01:00:00.000Z",
    "X-FREED-Adult-Feed-Source-Max-Bytes": "2000000"
  });
  const feed = assertAdultFeedBody(sampleFeed(), headers, selfTestNowMs);
  assertSafariContentBlockerBody(sampleSafariFeed(), String(feed.checksum), asArray(feed.domains, "feed domains").length);
  assert.throws(() => assertSanitizedSourceReports([{ ...sampleFeed().ingestion.sourceReports[0], url: "https://feeds.freedrecovery.app/reviewed.txt?token=secret" }]), /query strings/);
  assert.throws(() => assertAdultFeedBody({ ...sampleFeed(), domains: ["youtube.com"] }, headers, selfTestNowMs), /normal browsing domain/);
  assert.throws(
    () =>
      assertAdultFeedBody(
        {
          ...sampleFeed(),
          generatedAt: "2026-05-15T00:00:00.000Z",
          readiness: {
            ...sampleFeed().readiness,
            generatedAt: "2026-05-15T00:00:00.000Z"
          }
        },
        headers,
        selfTestNowMs
      ),
    /feed generatedAt must be no older than 48 hours/
  );
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/adult-domain-feed").status, "PASS");
  assert.equal(validateEndpoint("https://api.freedrecovery.app/api/analytics").status, "FAIL");
  assert.equal(validateEndpoint("http://localhost:3000/api/adult-domain-feed").status, "FAIL");
  assert.equal(validateEndpoint("https://example.com/api/adult-domain-feed").status, "FAIL");
  const previousFeedSources = process.env.FREED_ADULT_DOMAIN_FEED_SOURCE_URLS;
  process.env.FREED_ADULT_DOMAIN_FEED_SOURCE_URLS = "oisd-nsfw|OISD|https://source.example/feed.txt?token=secret";
  const report = buildSmokeReport(
    "https://api.freedrecovery.app/api/adult-domain-feed?token=secret",
    sampleFeed(),
    [{ id: "redaction", status: "FAIL", detail: "https://source.example/feed.txt?token=secret adult.example eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" }]
  );
  if (previousFeedSources === undefined) {
    delete process.env.FREED_ADULT_DOMAIN_FEED_SOURCE_URLS;
  } else {
    process.env.FREED_ADULT_DOMAIN_FEED_SOURCE_URLS = previousFeedSources;
  }
  const reportText = JSON.stringify(report);
  assert.equal(report.endpoint, "https://api.freedrecovery.app/api/adult-domain-feed");
  assert.equal(report.sanitized, true);
  assert.equal(
    sanitizeEndpointForReport("https://user:pass@api.freedrecovery.app/api/adult-domain-feed?token=secret#access_token=secret"),
    "https://api.freedrecovery.app/api/adult-domain-feed"
  );
  assert.equal(report.feed?.domainCount, 2);
  assert.equal(report.feed?.fetchedSourceReportCount, 1);
  assert.equal(report.contractProof.endpointPathRequired, "/api/adult-domain-feed");
  assert.equal(report.contractProof.requestTimeoutMs, DEFAULT_ADULT_FEED_SMOKE_TIMEOUT_MS);
  assert.equal(report.contractProof.feedContract.maxFeedAgeHours, 48);
  assert.equal(report.contractProof.feedContract.sourceMaxBytes, 2_000_000);
  assert.ok(report.contractProof.feedContract.headersRequired.includes("X-FREED-Adult-Feed-Checksum"));
  assert.equal(report.contractProof.syncProofs.conditional304Validated, false);
  assert.equal(report.contractProof.sourceReportBoundary.fullDomainListOmitted, true);
  assert.equal(report.contractProof.sourceReportBoundary.rawSourceUrlsWithQueryStringsOmitted, true);
  assert.equal(report.contractProof.responseBoundary.secretValuesOmitted, true);
  assert.ok(report.contractProof.responseBoundary.serverSecretKeyNamesChecked.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"));
  const passingReport = buildSmokeReport("https://api.freedrecovery.app/api/adult-domain-feed", sampleFeed(), [
    { id: "adult-feed-endpoint", status: "PASS", detail: "https://api.freedrecovery.app/api/adult-domain-feed" },
    { id: "adult-feed-json-contract", status: "PASS", detail: "2 domains" },
    { id: "adult-feed-conditional-304", status: "PASS", detail: "fnv1a32:12345678" },
    { id: "adult-feed-safari-content-blocker", status: "PASS", detail: "fnv1a32:12345678" }
  ]);
  assert.equal(passingReport.contractProof.syncProofs.feedJsonContractValidated, true);
  assert.equal(passingReport.contractProof.syncProofs.conditional304Validated, true);
  assert.equal(passingReport.contractProof.syncProofs.safariContentBlockerExportValidated, true);
  assert.equal(reportText.includes("adult.example"), false);
  assert.equal(reportText.includes("source.example"), false);
  assert.equal(reportText.includes("redacted-domain"), true);
  assert.equal(reportText.includes("token=secret"), false);
  assert.equal(reportText.includes("eyJhbGciOiJFUzI1NiJ9"), false);
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/adult-domain-feed-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/adult-domain-feed-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("adult-domain-feed-smoke self-test: pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
