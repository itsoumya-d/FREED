import {
  ADULT_DOMAIN_SEEDS,
  DEFAULT_ALLOWED_NORMAL_DOMAINS,
  createAdultDomainFeed,
  getAdultDomainFeedReadiness,
  normalizeAdultDomainCandidate,
  type AdultDomainFeed,
  type AdultDomainFeedReadiness,
  type AdultDomainFeedSource
} from "@/lib/blocking-engine";
import { formatEndpointIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";

export type AdultDomainFeedSourceConfig = {
  id: string;
  label: string;
  url: string;
};

export type AdultDomainFeedSourceConfigParseResult = {
  sources: AdultDomainFeedSourceConfig[];
  issues: string[];
};

export type AdultDomainFeedSourceReport = {
  id: string;
  label: string;
  url: string;
  status: "fetched" | "skipped" | "failed";
  sourceLineCount: number;
  domainCount: number;
  rejectedNormalDomainCount: number;
  issue?: string;
};

export type AdultDomainFeedIngestionResult = {
  feed: AdultDomainFeed;
  readiness: AdultDomainFeedReadiness;
  sourceReports: AdultDomainFeedSourceReport[];
  rejectedNormalDomains: string[];
};

type TextFetchLikeResponse = Pick<Response, "ok" | "status" | "text"> & Partial<Pick<Response, "body" | "headers">>;
type TextFetchLike = (input: string, init?: RequestInit) => Promise<TextFetchLikeResponse>;
type AdultDomainFeedCacheStatus = "hit" | "miss" | "stale-if-error";

export type CachedAdultDomainFeedIngestionResult = AdultDomainFeedIngestionResult & {
  cache: {
    status: AdultDomainFeedCacheStatus;
    ttlSeconds: number;
    expiresAt: string;
    stale: boolean;
    sourceMaxBytes: number;
    refreshIssue?: string;
    refreshFailedSourceCount?: number;
  };
};

type CachedAdultDomainFeedEntry = {
  key: string;
  expiresAtMs: number;
  result: AdultDomainFeedIngestionResult;
  ttlSeconds: number;
  sourceMaxBytes: number;
  stale: boolean;
  refreshIssue?: string;
  refreshFailedSourceCount?: number;
};

export const REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES = [
  "oisd-nsfw",
  "stevenblack",
  "cloudflare-family",
  "freed-custom"
] as const;

const DEFAULT_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS = 60 * 60;
const MIN_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS = 60;
const MAX_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS = 8_000;
const MIN_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS = 50;
const MAX_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS = 15_000;
const DEFAULT_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES = 2_000_000;
const MIN_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES = 10_000;
const MAX_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES = 5_000_000;
const STALE_ADULT_DOMAIN_FEED_RETRY_SECONDS = 5 * 60;

let adultDomainFeedCache: CachedAdultDomainFeedEntry | null = null;
let adultDomainFeedInflight: { key: string; promise: Promise<CachedAdultDomainFeedEntry> } | null = null;

export function parseAdultDomainFeedSourceConfig(raw = ""): AdultDomainFeedSourceConfig[] {
  return parseAdultDomainFeedSourceConfigWithIssues(raw).sources;
}

export function parseAdultDomainFeedSourceConfigWithIssues(raw = ""): AdultDomainFeedSourceConfigParseResult {
  const sources: AdultDomainFeedSourceConfig[] = [];
  const issues: string[] = [];
  const seenIds = new Set<string>();

  raw.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const lineNumber = index + 1;
    const [rawId, rawLabel, ...urlParts] = line.split("|").map((part) => part.trim());
    const url = urlParts.join("|").trim();
    if (!rawId || !rawLabel || !url) {
      issues.push(`FREED_ADULT_DOMAIN_FEED_SOURCE_URLS line ${lineNumber} must use id|label|https://source-url`);
      return;
    }

    const id = normalizeAdultDomainFeedSourceId(rawId);
    if (!reviewedAdultDomainFeedSourceFamily(id)) {
      issues.push(
        `${rawLabel} adult-domain feed source id must identify a reviewed source family: ${REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES.join(", ")}`
      );
    }
    if (seenIds.has(id)) {
      issues.push(`FREED_ADULT_DOMAIN_FEED_SOURCE_URLS must not repeat source id ${id}`);
    }
    seenIds.add(id);
    sources.push({
      id,
      label: rawLabel.slice(0, 80),
      url
    });
  });

  return { sources, issues };
}

export function normalizeAdultDomainFeedSourceId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "adult-feed-source";
}

export function reviewedAdultDomainFeedSourceFamily(value: string): (typeof REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES)[number] | null {
  const id = normalizeAdultDomainFeedSourceId(value);
  if (id === "oisd-nsfw" || id.startsWith("oisd-nsfw-")) return "oisd-nsfw";
  if (id === "stevenblack" || id.startsWith("stevenblack-")) return "stevenblack";
  if (id === "cloudflare-family" || id.startsWith("cloudflare-family-")) return "cloudflare-family";
  if (
    id === "freed-custom" ||
    id.startsWith("freed-custom-") ||
    id.startsWith("freed-reviewed-") ||
    id.startsWith("custom-reviewed-")
  ) {
    return "freed-custom";
  }
  return null;
}

export async function ingestAdultDomainFeed({
  fetcher = fetch,
  sourceConfigText = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS") ?? "",
  extraDomainsText = readEnv("FREED_ADULT_DOMAIN_FEED_EXTRA_DOMAINS") ?? "",
  generatedAt = readEnv("FREED_ADULT_DOMAIN_FEED_GENERATED_AT") ?? new Date().toISOString(),
  version = readEnv("FREED_ADULT_DOMAIN_FEED_VERSION") ?? `freed-feed-${generatedAt.slice(0, 10)}`,
  sourceTimeoutMs = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS"),
  sourceMaxBytes = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES")
}: {
  fetcher?: TextFetchLike;
  sourceConfigText?: string;
  extraDomainsText?: string;
  generatedAt?: string;
  version?: string;
  sourceTimeoutMs?: number | string | null;
  sourceMaxBytes?: number | string | null;
} = {}): Promise<AdultDomainFeedIngestionResult> {
  const sources = parseAdultDomainFeedSourceConfig(sourceConfigText);
  const sourceReports: AdultDomainFeedSourceReport[] = [];
  const fetchedDomains: string[] = [];
  const rejectedNormalDomains = new Set<string>();
  const resolvedSourceTimeoutMs = normalizeSourceTimeoutMs(sourceTimeoutMs);
  const resolvedSourceMaxBytes = normalizeSourceMaxBytes(sourceMaxBytes);

  for (const source of sources) {
    const reviewedSourceFamily = reviewedAdultDomainFeedSourceFamily(source.id);
    if (!reviewedSourceFamily) {
      sourceReports.push({
        ...source,
        status: "skipped",
        sourceLineCount: 0,
        domainCount: 0,
        rejectedNormalDomainCount: 0,
        issue: `${source.label} adult-domain feed source id must identify a reviewed source family: ${REVIEWED_ADULT_DOMAIN_FEED_SOURCE_ID_FAMILIES.join(", ")}`
      });
      continue;
    }

    const endpointIssues = getProductionEndpointIssues(source.url, `${source.label} adult-domain feed source`);
    if (endpointIssues.length > 0) {
      sourceReports.push({
        ...source,
        status: "skipped",
        sourceLineCount: 0,
        domainCount: 0,
        rejectedNormalDomainCount: 0,
        issue: formatEndpointIssues(endpointIssues).join("; ")
      });
      continue;
    }

    try {
      const text = await fetchSourceTextWithTimeout(fetcher, source, resolvedSourceTimeoutMs, resolvedSourceMaxBytes);
      const parsed = parseDomainSourceText(text);
      parsed.rejectedNormalDomains.forEach((domain) => rejectedNormalDomains.add(domain));
      fetchedDomains.push(...parsed.domains);
      sourceReports.push({
        ...source,
        status: "fetched",
        sourceLineCount: parsed.sourceLineCount,
        domainCount: parsed.domains.length,
        rejectedNormalDomainCount: parsed.rejectedNormalDomains.length
      });
    } catch (error) {
      sourceReports.push({
        ...source,
        status: "failed",
        sourceLineCount: 0,
        domainCount: 0,
        rejectedNormalDomainCount: 0,
        issue: error instanceof Error ? error.message : "source fetch failed"
      });
    }
  }

  const extraDomains = parseExtraDomains(extraDomainsText);
  extraDomains.rejectedNormalDomains.forEach((domain) => rejectedNormalDomains.add(domain));
  const feedSources: AdultDomainFeedSource[] = [
    {
      id: "embedded-seed",
      label: "FREED embedded adult-domain seed",
      domainCount: ADULT_DOMAIN_SEEDS.length
    },
    ...sourceReports
      .filter((report) => report.status === "fetched")
      .map((report): AdultDomainFeedSource => ({
        id: report.id,
        label: report.label,
        domainCount: report.domainCount
      })),
    ...(extraDomains.domains.length > 0
      ? [
          {
            id: "server-extra",
            label: "Server-reviewed adult-domain feed additions",
            domainCount: extraDomains.domains.length
          }
        ]
      : [])
  ];
  const feed = createAdultDomainFeed({
    version,
    generatedAt,
    domains: [...ADULT_DOMAIN_SEEDS, ...fetchedDomains, ...extraDomains.domains],
    exceptions: DEFAULT_ALLOWED_NORMAL_DOMAINS,
    sources: feedSources
  });

  return {
    feed,
    readiness: getAdultDomainFeedReadiness(feed),
    sourceReports,
    rejectedNormalDomains: Array.from(rejectedNormalDomains).sort()
  };
}

export async function resolveCachedAdultDomainFeed({
  fetcher = fetch,
  sourceConfigText = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS") ?? "",
  extraDomainsText = readEnv("FREED_ADULT_DOMAIN_FEED_EXTRA_DOMAINS") ?? "",
  generatedAt = readEnv("FREED_ADULT_DOMAIN_FEED_GENERATED_AT") ?? new Date().toISOString(),
  version = readEnv("FREED_ADULT_DOMAIN_FEED_VERSION") ?? `freed-feed-${generatedAt.slice(0, 10)}`,
  cacheTtlSeconds = readEnv("FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS"),
  sourceTimeoutMs = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS"),
  sourceMaxBytes = readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES"),
  nowMs = Date.now()
}: {
  fetcher?: TextFetchLike;
  sourceConfigText?: string;
  extraDomainsText?: string;
  generatedAt?: string;
  version?: string;
  cacheTtlSeconds?: number | string | null;
  sourceTimeoutMs?: number | string | null;
  sourceMaxBytes?: number | string | null;
  nowMs?: number;
} = {}): Promise<CachedAdultDomainFeedIngestionResult> {
  const ttlSeconds = normalizeCacheTtlSeconds(cacheTtlSeconds);
  const resolvedSourceMaxBytes = normalizeSourceMaxBytes(sourceMaxBytes);
  const key = buildCacheKey(sourceConfigText, extraDomainsText, version, resolvedSourceMaxBytes);

  if (adultDomainFeedCache?.key === key && adultDomainFeedCache.expiresAtMs > nowMs) {
    return withCacheInfo(adultDomainFeedCache, adultDomainFeedCache.stale ? "stale-if-error" : "hit");
  }

  if (adultDomainFeedInflight?.key !== key) {
    const staleEntry = adultDomainFeedCache?.key === key ? adultDomainFeedCache : null;
    adultDomainFeedInflight = {
      key,
      promise: ingestAdultDomainFeed({
        fetcher,
        sourceConfigText,
        extraDomainsText,
        generatedAt,
        version,
        sourceTimeoutMs,
        sourceMaxBytes: resolvedSourceMaxBytes
      })
        .then((result) => {
          const staleRefreshIssue = staleEntry ? getStaleRefreshIssue(staleEntry, result) : null;
          if (staleEntry && staleRefreshIssue) {
            const staleRetrySeconds = Math.min(ttlSeconds, STALE_ADULT_DOMAIN_FEED_RETRY_SECONDS);
            const staleCacheEntry = {
              ...staleEntry,
              expiresAtMs: nowMs + staleRetrySeconds * 1000,
              stale: true,
              refreshIssue: staleRefreshIssue.issue,
              refreshFailedSourceCount: staleRefreshIssue.failedSourceCount
            };
            adultDomainFeedCache = staleCacheEntry;
            return staleCacheEntry;
          }

          const entry = {
            key,
            expiresAtMs: nowMs + ttlSeconds * 1000,
            result,
            ttlSeconds,
            sourceMaxBytes: resolvedSourceMaxBytes,
            stale: false
          };
          adultDomainFeedCache = entry;
          return entry;
        })
        .finally(() => {
          if (adultDomainFeedInflight?.key === key) {
            adultDomainFeedInflight = null;
          }
        })
    };
  }

  const entry = await adultDomainFeedInflight.promise;
  return withCacheInfo(entry, entry.stale ? "stale-if-error" : "miss");
}

export function clearAdultDomainFeedCacheForTests() {
  adultDomainFeedCache = null;
  adultDomainFeedInflight = null;
}

function parseDomainSourceText(text: string) {
  const domains: string[] = [];
  const rejectedNormalDomains: string[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const domain = normalizeAdultDomainCandidate(line);
    if (!domain) continue;
    if (isNormalBrowsingDomain(domain)) {
      rejectedNormalDomains.push(domain);
      continue;
    }
    domains.push(domain);
  }

  return {
    sourceLineCount: lines.length,
    domains,
    rejectedNormalDomains: Array.from(new Set(rejectedNormalDomains)).sort()
  };
}

function parseExtraDomains(text: string) {
  return parseDomainSourceText(text.replace(/,/g, "\n"));
}

async function fetchSourceTextWithTimeout(
  fetcher: TextFetchLike,
  source: AdultDomainFeedSourceConfig,
  timeoutMs: number,
  sourceMaxBytes: number
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`source fetch timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetcher(source.url, { method: "GET", signal: controller?.signal }),
      timeoutPromise
    ]);
    if (!response.ok) throw new Error(`source returned ${response.status}`);
    return await Promise.race([
      readResponseTextWithByteLimit(response, sourceMaxBytes, () => controller?.abort()),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readResponseTextWithByteLimit(
  response: TextFetchLikeResponse,
  maxBytes: number,
  abortFetch: () => void
) {
  const contentLength = parseContentLength(response.headers?.get("content-length") ?? null);
  if (contentLength !== null && contentLength > maxBytes) {
    throw adultDomainFeedSourceTooLargeError(maxBytes);
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (utf8ByteLength(text) > maxBytes) {
      throw adultDomainFeedSourceTooLargeError(maxBytes);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        abortFetch();
        await reader.cancel().catch(() => null);
        throw adultDomainFeedSourceTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function isNormalBrowsingDomain(domain: string) {
  return DEFAULT_ALLOWED_NORMAL_DOMAINS.some((allowed) =>
    domain === allowed || domain.endsWith(`.${allowed}`) || allowed.endsWith(`.${domain}`)
  );
}

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function buildCacheKey(sourceConfigText: string, extraDomainsText: string, version: string, sourceMaxBytes: number) {
  return [sourceConfigText.trim(), extraDomainsText.trim(), version.trim(), String(sourceMaxBytes)].join("\u0000");
}

function withCacheInfo(
  entry: CachedAdultDomainFeedEntry,
  status: AdultDomainFeedCacheStatus
): CachedAdultDomainFeedIngestionResult {
  return {
    ...entry.result,
    cache: {
      status,
      ttlSeconds: entry.ttlSeconds,
      expiresAt: new Date(entry.expiresAtMs).toISOString(),
      stale: entry.stale,
      sourceMaxBytes: entry.sourceMaxBytes,
      ...(entry.refreshIssue ? { refreshIssue: entry.refreshIssue } : {}),
      ...(entry.refreshFailedSourceCount ? { refreshFailedSourceCount: entry.refreshFailedSourceCount } : {})
    }
  };
}

function normalizeCacheTtlSeconds(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS;
  return Math.max(
    MIN_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS,
    Math.min(MAX_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS, Math.round(parsed))
  );
}

function normalizeSourceTimeoutMs(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS;
  return Math.max(
    MIN_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS,
    Math.min(MAX_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS, Math.round(parsed))
  );
}

function normalizeSourceMaxBytes(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES;
  return Math.max(
    MIN_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES,
    Math.min(MAX_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES, Math.round(parsed))
  );
}

function parseContentLength(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function adultDomainFeedSourceTooLargeError(maxBytes: number) {
  return new Error(`adult-domain-feed-source-too-large: source body exceeds ${maxBytes} bytes`);
}

function getStaleRefreshIssue(staleEntry: CachedAdultDomainFeedEntry, result: AdultDomainFeedIngestionResult) {
  if (result.sourceReports.length === 0) return null;
  const fetchedSourceCount = result.sourceReports.filter((report) => report.status === "fetched").length;
  const failedSourceCount = result.sourceReports.filter((report) => report.status === "failed").length;
  if (fetchedSourceCount > 0 || failedSourceCount === 0) return null;
  if (staleEntry.result.feed.domains.length <= result.feed.domains.length) return null;

  return {
    failedSourceCount,
    issue: `${failedSourceCount} reviewed adult-domain feed source${failedSourceCount === 1 ? "" : "s"} failed during refresh; serving the previous reviewed feed to avoid degrading protection.`
  };
}
