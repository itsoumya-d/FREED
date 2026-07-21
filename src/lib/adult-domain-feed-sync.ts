import {
  compileSafariContentBlockerRules,
  createAdultDomainFeed,
  getAdultDomainFeedReadiness,
  getEmbeddedAdultDomainFeed,
  type AdultDomainFeed,
  type AdultDomainFeedSource
} from "@/lib/blocking-engine";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { safeUserFacingMessage } from "@/lib/user-facing-error";

type ProtectionStatus = import("freed-protection").ProtectionStatus;
type ProtectionCapability = import("freed-protection").ProtectionCapability;
type AdultDomainFeedLayerStatus = Pick<
  ProtectionStatus,
  | "adultDomainFeedChecksum"
  | "adultDomainFeedDomainCount"
  | "safariContentBlockerChecksum"
  | "safariContentBlockerRuleCount"
>;
type AdultDomainFeedLayerCapability = Pick<ProtectionCapability, "platform" | "safariContentBlocker">;

export type AdultDomainFeedResolveResult =
  | {
      feed: AdultDomainFeed;
      provider: "remote" | "embedded";
      warning: string | null;
      notModified: false;
    }
  | {
      feed: null;
      provider: "remote-cache";
      warning: null;
      notModified: true;
      checksum: string;
    };

export type AdultDomainFeedSyncResult =
  | {
      feed: AdultDomainFeed;
      status: ProtectionStatus;
      provider: "remote" | "embedded";
      warning: string | null;
    }
  | {
      feed: null;
      status: ProtectionStatus;
      provider: "remote-cache";
      warning: null;
    };

export type AdultDomainFeedResolveOptions = {
  timeoutMs?: number | string | null;
  maxBytes?: number | string | null;
};

type FetchLikeResponse = Pick<Response, "ok" | "json" | "status"> & Partial<Pick<Response, "body" | "headers" | "text">>;
type FetchLike = (input: string, init?: RequestInit) => Promise<FetchLikeResponse>;

const DEFAULT_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS = 8_000;
const MIN_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS = 50;
const MAX_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS = 15_000;
const DEFAULT_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES = 5_000_000;
const MIN_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES = 100_000;
const MAX_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES = 10_000_000;
const MAX_ADULT_FEED_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ADULT_FEED_CLOCK_SKEW_MS = 5 * 60 * 1000;

export async function resolveAdultDomainFeed(
  fetcher: FetchLike = fetch,
  endpoint = readFeedEndpoint(),
  currentChecksum?: string | null,
  options: AdultDomainFeedResolveOptions = {}
): Promise<AdultDomainFeedResolveResult> {
  const endpointConfigured = Boolean(endpoint?.trim());
  const safeEndpoint = sanitizeRemoteFeedEndpoint(endpoint);
  if (!safeEndpoint) {
    return {
      feed: getEmbeddedAdultDomainFeed(),
      provider: "embedded",
      warning: endpointConfigured ? "Remote adult domain feed endpoint is not production-safe." : null,
      notModified: false
    };
  }

  try {
    const normalizedChecksum = normalizeFeedChecksum(currentChecksum);
    const { response, payload } = await fetchRemoteFeedPayload(
      fetcher,
      safeEndpoint,
      {
        method: "GET",
        headers: buildConditionalFeedHeaders(normalizedChecksum)
      },
      normalizeFeedSyncTimeoutMs(options.timeoutMs ?? readFeedSyncTimeoutMs()),
      normalizeFeedResponseMaxBytes(options.maxBytes ?? readFeedResponseMaxBytes())
    );
    if (response.status === 304 && normalizedChecksum) {
      return {
        feed: null,
        provider: "remote-cache",
        warning: null,
        notModified: true,
        checksum: normalizedChecksum
      };
    }
    if (!response.ok) throw new Error(`Adult domain feed returned ${response.status}.`);
    const feed = parseRemoteFeed(payload);
    const readiness = getAdultDomainFeedReadiness(feed);
    if (!readiness.ready) throw new Error(readiness.issues.join("; "));
    const freshnessIssue = remoteFeedFreshnessIssue(feed.generatedAt);
    if (freshnessIssue) throw new Error(freshnessIssue);
    return { feed, provider: "remote", warning: null, notModified: false };
  } catch (error) {
    return {
      feed: getEmbeddedAdultDomainFeed(),
      provider: "embedded",
      warning: safeUserFacingMessage(error, "Remote adult domain feed failed."),
      notModified: false
    };
  }
}

export async function syncNativeAdultDomainFeed(fetcher: FetchLike = fetch): Promise<AdultDomainFeedSyncResult> {
  const {
    configureAdultDomainFeed,
    configureSafariContentBlockerRules,
    getProtectionCapabilities,
    getProtectionStatus
  } = await import("freed-protection");
  const [capability, initialStatus] = await Promise.all([getProtectionCapabilities(), getProtectionStatus()]);
  let status = initialStatus;
  const currentChecksum = getConditionalAdultFeedChecksumForStatus(status, capability);
  const resolved = await resolveAdultDomainFeed(fetcher, readFeedEndpoint(), currentChecksum);

  if (resolved.notModified) {
    return { feed: null, status, provider: "remote-cache", warning: null };
  }

  const { feed, provider, warning } = resolved;
  const nativeAlreadySynced =
    status.adultDomainFeedChecksum === feed.checksum &&
    (status.adultDomainFeedDomainCount ?? 0) === feed.domains.length;
  const safariRules = compileSafariContentBlockerRules(feed);
  const safariAlreadySynced =
    status.safariContentBlockerChecksum === feed.checksum &&
    (status.safariContentBlockerRuleCount ?? 0) === safariRules.length;

  if (!nativeAlreadySynced) {
    status = await configureAdultDomainFeed(feed.domains, feed.version, feed.checksum, feed.generatedAt);
  }

  if (!safariAlreadySynced) {
    status = await configureSafariContentBlockerRules(
      JSON.stringify(safariRules),
      feed.version,
      feed.checksum,
      feed.generatedAt
    );
  }

  return { feed, status, provider, warning };
}

export function getConditionalAdultFeedChecksumForStatus(
  status: AdultDomainFeedLayerStatus,
  capability?: AdultDomainFeedLayerCapability | null
) {
  const nativeChecksum = normalizeFeedChecksum(status.adultDomainFeedChecksum);
  const safariChecksum = normalizeFeedChecksum(status.safariContentBlockerChecksum);
  const nativeDomainCount = normalizeNonnegativeCount(status.adultDomainFeedDomainCount);
  const safariRuleCount = normalizeNonnegativeCount(status.safariContentBlockerRuleCount);
  const nativeLayerReady = !!nativeChecksum && nativeDomainCount > 0;
  const safariCanBePrimaryLayer =
    capability?.platform === "ios" ||
    capability?.safariContentBlocker === true;
  const safariLayerExpected =
    safariCanBePrimaryLayer ||
    !!safariChecksum ||
    safariRuleCount > 0;
  const expectedSafariRuleCount = nativeDomainCount;
  const minimumSafariRuleCount = 1;
  const safariLayerReady =
    !safariLayerExpected ||
    (!!safariChecksum &&
      safariRuleCount >= (nativeLayerReady ? expectedSafariRuleCount : minimumSafariRuleCount));

  if (!nativeLayerReady && !(safariCanBePrimaryLayer && safariLayerReady && safariChecksum)) return null;
  if (!safariLayerReady) return null;
  if (safariLayerExpected && nativeLayerReady && nativeChecksum !== safariChecksum) return null;
  return nativeChecksum ?? safariChecksum;
}

function buildConditionalFeedHeaders(checksum: string | null): HeadersInit | undefined {
  if (!checksum) return undefined;
  return {
    "If-None-Match": `"${checksum}"`,
    "X-FREED-Adult-Feed-Checksum": checksum
  };
}

function readFeedEndpoint() {
  return process.env.EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT?.trim() ?? "";
}

function sanitizeRemoteFeedEndpoint(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return getProductionEndpointIssues(trimmed, "adult domain feed endpoint").length === 0 ? trimmed : null;
}

function readFeedSyncTimeoutMs() {
  return process.env.EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS?.trim() ?? "";
}

function readFeedResponseMaxBytes() {
  return process.env.EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES?.trim() ?? "";
}

function normalizeFeedChecksum(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

function remoteFeedFreshnessIssue(generatedAt: string, nowMs = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) return "Remote adult domain feed generatedAt is invalid.";
  if (generatedAtMs > nowMs + MAX_ADULT_FEED_CLOCK_SKEW_MS) {
    return "Remote adult domain feed generatedAt must not be in the future.";
  }
  if (nowMs - generatedAtMs > MAX_ADULT_FEED_AGE_MS) {
    return "Remote adult domain feed generatedAt is older than 48 hours.";
  }
  return null;
}

function normalizeNonnegativeCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

async function fetchRemoteFeedPayload(
  fetcher: FetchLike,
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
  maxBytes: number
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Adult domain feed sync timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetcher(endpoint, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
    const payload = response.status === 304
      ? undefined
      : await Promise.race([
          readBoundedResponseJson(response, {
            timeoutMs,
            maxBytes,
            label: "Adult domain feed response",
            abort: () => controller?.abort()
          }),
          timeoutPromise
        ]);
    return { response, payload };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function normalizeFeedSyncTimeoutMs(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS;
  return Math.max(
    MIN_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS,
    Math.min(MAX_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS, Math.round(parsed))
  );
}

function normalizeFeedResponseMaxBytes(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES,
    Math.min(MAX_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}

function parseRemoteFeed(value: unknown): AdultDomainFeed {
  if (!isRecord(value)) throw new Error("Adult domain feed payload is not an object.");
  const domains = stringArray(value.domains);
  const exceptions = stringArray(value.exceptions);
  const sources = Array.isArray(value.sources)
    ? value.sources.filter(isRecord).map((source): AdultDomainFeedSource => ({
        id: typeof source.id === "string" ? source.id.slice(0, 64) : "server-extra",
        label: typeof source.label === "string" ? source.label.slice(0, 80) : "Remote adult-domain feed",
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt.slice(0, 40) : undefined,
        domainCount: typeof source.domainCount === "number" && Number.isFinite(source.domainCount)
          ? Math.max(0, Math.round(source.domainCount))
          : domains.length
      }))
    : [];

  return createAdultDomainFeed({
    version: typeof value.version === "string" ? value.version : "remote-feed",
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : new Date().toISOString(),
    domains,
    exceptions,
    sources
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
