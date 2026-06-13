import {
  compileSafariContentBlockerRules
} from "@/lib/blocking-engine";
import { resolveCachedAdultDomainFeed } from "@/lib/adult-domain-feed-ingestion";
import {
  publishAdultDomainFeedVersion,
  sanitizeAdultDomainFeedSourceReport
} from "@/lib/adult-domain-feed-publication";
import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit,
  runBackendJob
} from "@/lib/backend-infrastructure";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match, X-FREED-Adult-Feed-Checksum",
  "Cache-Control": "public, max-age=3600"
};
const MAX_ADULT_FEED_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ADULT_FEED_CLOCK_SKEW_MS = 5 * 60 * 1000;

function json(payload: unknown, status = 200, headers: HeadersInit = corsHeaders) {
  return Response.json(payload, { status, headers });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request: Request) {
  const rateLimit = await enforceBackendRateLimit({
    route: "adult-domain-feed",
    request,
    limit: 120,
    windowSeconds: 60
  });
  if (!rateLimit.allowed) {
    return json(
      {
        error: backendRateLimitError(rateLimit, "Too many feed requests."),
        status: rateLimit.status,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      },
      backendRateLimitHttpStatus(rateLimit)
    );
  }

  const url = new URL(request.url);
  const { feed, readiness, sourceReports, rejectedNormalDomains, cache } = await resolveCachedAdultDomainFeed();
  const publicSourceReports = sourceReports.map(sanitizeAdultDomainFeedSourceReport);
  const feedHeaders = {
    ...corsHeaders,
    "ETag": formatFeedEtag(feed.checksum),
    "X-FREED-Adult-Feed-Version": feed.version,
    "X-FREED-Adult-Feed-Checksum": feed.checksum,
    "X-FREED-Adult-Feed-Cache": cache.status,
    "X-FREED-Adult-Feed-Cache-Expires-At": cache.expiresAt,
    "X-FREED-Adult-Feed-Source-Max-Bytes": String(cache.sourceMaxBytes)
  };
  const requestedValidators = readRequestedFeedValidators(
    url.searchParams.get("checksum"),
    request.headers.get("If-None-Match"),
    request.headers.get("X-FREED-Adult-Feed-Checksum")
  );

  if (!readiness.ready) {
    return json({ error: "Adult domain feed failed validation.", readiness, sourceReports: publicSourceReports, rejectedNormalDomains }, 500, feedHeaders);
  }

  if (reviewedSourceRefreshUnavailable(sourceReports, cache.status)) {
    return json(
      {
        error: "Adult domain feed has no fetched reviewed source; devices should keep their local embedded fallback.",
        readiness: {
          ...readiness,
          ready: false,
          issues: [...readiness.issues, "no configured reviewed adult-domain feed source fetched successfully"]
        },
        sourceReports: publicSourceReports,
        rejectedNormalDomains,
        ingestion: { cache }
      },
      503,
      feedHeaders
    );
  }

  const freshnessIssue = feedFreshnessIssue(feed.generatedAt);
  if (freshnessIssue) {
    return json(
      {
        error: "Adult domain feed is stale or future-dated; devices should keep their local embedded fallback.",
        readiness: {
          ...readiness,
          ready: false,
          issues: [...readiness.issues, freshnessIssue]
        },
        sourceReports: publicSourceReports,
        rejectedNormalDomains,
        ingestion: { cache }
      },
      503,
      feedHeaders
    );
  }

  if (requestedValidators.wildcard || requestedValidators.checksums.includes(feed.checksum)) {
    return new Response(null, { status: 304, headers: feedHeaders });
  }

  const safariRules = compileSafariContentBlockerRules(feed);
  const publicationContext = cache.status === "miss"
    ? await publishFreshFeedContext({ feed, readiness, sourceReports, rejectedNormalDomains, safariRuleCount: safariRules.length })
    : cachedPublicationContext(feed, cache.status);

  if (url.searchParams.get("format") === "safari-content-blocker") {
    return json({
      version: feed.version,
      generatedAt: feed.generatedAt,
      checksum: feed.checksum,
      rules: safariRules,
      ingestion: {
        sourceReports: publicSourceReports,
        rejectedNormalDomainCount: rejectedNormalDomains.length,
        cache
      },
      publication: publicationContext.publication,
      publicationJob: publicationContext.publicationJob
    }, 200, feedHeaders);
  }

  return json({
    ...feed,
    readiness,
    ingestion: {
      sourceReports: publicSourceReports,
      rejectedNormalDomains,
      cache
    },
    publication: publicationContext.publication,
    publicationJob: publicationContext.publicationJob
  }, 200, feedHeaders);
}

type CachedFeedResult = Awaited<ReturnType<typeof resolveCachedAdultDomainFeed>>;
type CachedFeedSourceReport = CachedFeedResult["sourceReports"][number];
type FreshFeedPublicationInput = Pick<
  CachedFeedResult,
  "feed" | "readiness" | "sourceReports" | "rejectedNormalDomains"
> & {
  safariRuleCount: number;
};

function reviewedSourceRefreshUnavailable(
  sourceReports: CachedFeedSourceReport[],
  cacheStatus: CachedFeedResult["cache"]["status"]
) {
  return cacheStatus !== "stale-if-error" && sourceReports.length > 0 && sourceReports.every((report) => report.status !== "fetched");
}

function feedFreshnessIssue(generatedAt: string, nowMs = Date.now()) {
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) return "adult domain feed generatedAt is invalid";
  if (generatedAtMs > nowMs + MAX_ADULT_FEED_CLOCK_SKEW_MS) return "adult domain feed generatedAt is in the future";
  if (nowMs - generatedAtMs > MAX_ADULT_FEED_AGE_MS) {
    return "adult domain feed generatedAt is older than 48 hours";
  }
  return null;
}

async function publishFreshFeedContext({
  feed,
  readiness,
  sourceReports,
  rejectedNormalDomains,
  safariRuleCount
}: FreshFeedPublicationInput) {
  const publicationJob = await runBackendJob(
    {
      jobName: "adult-domain-feed-sync",
      idempotencyKey: `adult-domain-feed-sync:${feed.checksum}`,
      lockKey: `freed:adult-domain-feed-sync:${feed.checksum}`,
      lockTtlMs: 60_000,
      metadata: {
        version: feed.version,
        checksum: feed.checksum,
        domainCount: feed.domains.length,
        sourceCount: sourceReports.length,
        safariRuleCount,
        rejectedNormalDomainCount: rejectedNormalDomains.length
      }
    },
    () =>
      publishAdultDomainFeedVersion({
        feed,
        readiness,
        sourceReports,
        rejectedNormalDomains,
        safariRuleCount
      })
  );

  return {
    publication: publicationJob.result ?? {
      published: false,
      provider: "skipped" as const,
      status: "skipped" as const,
      version: feed.version,
      checksum: feed.checksum,
      domainCount: feed.domains.length,
      reason: publicationJob.reason ?? "Adult-domain feed publication is already in progress."
    },
    publicationJob: {
      status: publicationJob.status,
      lockStatus: publicationJob.lock.status,
      auditStatus: publicationJob.audit.status,
      auditRecorded: publicationJob.audit.recorded
    }
  };
}

function formatFeedEtag(checksum: string) {
  return `"${checksum.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function readRequestedFeedValidators(queryChecksum: string | null, ifNoneMatch: string | null, explicitChecksum: string | null) {
  const checksums: string[] = [];
  let wildcard = false;
  const add = (value: string | null, allowWildcard: boolean) => {
    for (const candidate of normalizeRequestedChecksums(value)) {
      if (candidate === "*") {
        if (allowWildcard) wildcard = true;
      } else if (!checksums.includes(candidate)) {
        checksums.push(candidate);
      }
    }
  };

  add(queryChecksum, false);
  add(ifNoneMatch, true);
  add(explicitChecksum, false);

  return { wildcard, checksums };
}

function normalizeRequestedChecksums(value: string | null) {
  const raw = value?.trim() ?? "";
  if (!raw) return [];

  return raw
    .split(",")
    .map((candidate) => stripHttpEntityTag(candidate))
    .filter((candidate): candidate is string => !!candidate);
}

function stripHttpEntityTag(value: string) {
  let trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("W/")) trimmed = trimmed.slice(2).trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed.trim() || null;
}

function cachedPublicationContext(feed: FreshFeedPublicationInput["feed"], cacheStatus: CachedFeedResult["cache"]["status"]) {
  return {
    publication: {
      published: false,
      provider: "skipped" as const,
      status: "skipped" as const,
      version: feed.version,
      checksum: feed.checksum,
      domainCount: feed.domains.length,
      reason: cacheStatus === "stale-if-error"
        ? "Stale adult-domain feed served after reviewed source refresh failed; publication remains tied to the last successful feed refresh."
        : "Cached adult-domain feed served; publication was already attempted during the last feed refresh."
    },
    publicationJob: {
      status: "cached",
      lockStatus: "cached",
      auditStatus: "cached",
      auditRecorded: false
    }
  };
}
