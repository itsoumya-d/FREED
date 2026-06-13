import {
  acquireEdgeRedisLock,
  clampNumber,
  checksumDomains,
  fetchTextWithTimeout,
  futureIso,
  jsonResponse,
  optionsResponse,
  parseAdultDomainsFromText,
  parseExtraAdultDomains,
  parseReviewedAdultDomainFeedSourceUrls,
  recordBackendJobRun,
  readEnv,
  requireMaintenanceAuth,
  sanitizeSourceReport,
  releaseEdgeRedisLock,
  upsertSupabaseRow
} from "../_shared/freed_edge_contract.ts";

const DEFAULT_TABLE = "adult_domain_feed_versions";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  const auth = requireMaintenanceAuth(request);
  if (!auth.ok) {
    return auth.response;
  }

  if (request.method !== "POST" && request.method !== "GET") {
    return jsonResponse({ ok: false, error: "method-not-allowed" }, 405);
  }

  const startedAt = new Date().toISOString();
  const idempotencyKey = `adult-domain-feed-sync:${startedAt.slice(0, 10)}`;
  const sourceTimeoutMs = clampNumber(readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS"), 8000, 50, 15000);
  const sourceMaxBytes = clampNumber(readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES"), 2_000_000, 10_000, 5_000_000);
  const retentionDays = clampNumber(readEnv("FREED_ADULT_DOMAIN_FEED_RETENTION_DAYS"), 30, 1, 365);
  const tableName = readEnv("SUPABASE_ADULT_FEED_TABLE", DEFAULT_TABLE);
  const configuredSources = parseReviewedAdultDomainFeedSourceUrls(readEnv("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS"));
  const acceptedSources = configuredSources.filter((source) => source.accepted);
  const lockTtlMs = clampNumber(readEnv("FREED_EDGE_JOB_LOCK_TTL_MS"), 600_000, 1_000, 3_600_000);
  const lock = await acquireEdgeRedisLock(`freed:edge:adult-domain-feed-sync:${startedAt.slice(0, 10)}`, lockTtlMs);

  if (!lock.acquired) {
    await recordBackendJobRun({
      jobName: "adult-domain-feed-sync",
      idempotencyKey: `${idempotencyKey}:skipped:${startedAt.replace(/[^0-9]/g, "")}`,
      status: "skipped",
      startedAt,
      finishedAt: new Date().toISOString(),
      metadata: {
        lockStatus: lock.status,
        lockProvider: lock.provider,
        failureCode: lock.status === "locked" ? "edge-job-already-running" : "edge-job-lock-unavailable",
        reviewedSourceCount: acceptedSources.length
      }
    }).catch(() => null);
    return jsonResponse(
      {
        ok: false,
        error: lock.status === "locked" ? "edge-job-already-running" : "edge-job-lock-unavailable",
        lockStatus: lock.status
      },
      lock.status === "locked" ? 409 : 503
    );
  }

  try {

  await recordBackendJobRun({
    jobName: "adult-domain-feed-sync",
    idempotencyKey,
    status: "started",
    startedAt,
    finishedAt: null,
    metadata: {
      reviewedSourceCount: acceptedSources.length,
      configuredSourceCount: configuredSources.length,
      sourceTimeoutMs,
      sourceMaxBytes,
      lockStatus: lock.status,
      storesFullList: false
    }
  }).catch(() => null);

  if (acceptedSources.length === 0) {
    await finishAdultFeedJob({
      idempotencyKey,
      startedAt,
      status: "failed",
      metadata: {
        failureCode: "no-reviewed-adult-domain-sources",
        configuredSourceCount: configuredSources.length,
        reviewedSourceCount: 0,
        sourceMaxBytes,
        lockStatus: lock.status,
        storesFullList: false
      }
    });
    return jsonResponse(
      {
        ok: false,
        error: "no-reviewed-adult-domain-sources",
        reviewedSourceCount: 0,
        readiness: buildReadiness(0, sourceTimeoutMs, sourceMaxBytes)
      },
      503
    );
  }

  const allDomains = new Set<string>();
  const sourceReports = [];
  let rejectedNormalDomainCount = 0;

  for (const source of acceptedSources) {
    try {
      const text = await fetchTextWithTimeout(source.sourceUrl, sourceTimeoutMs, sourceMaxBytes);
      const parsed = parseAdultDomainsFromText(text);
      parsed.domains.forEach((domain) => allDomains.add(domain));
      rejectedNormalDomainCount += parsed.rejectedNormalDomainCount;
      sourceReports.push(
        sanitizeSourceReport({
          id: source.id,
          label: source.label,
          status: "synced",
          domainCount: parsed.domains.length,
          rejectedNormalDomainCount: parsed.rejectedNormalDomainCount
        })
      );
    } catch (error) {
      sourceReports.push(
        sanitizeSourceReport({
          id: source.id,
          label: source.label,
          status: "failed",
          error: error instanceof Error ? error.message : "source fetch failed"
        })
      );
    }
  }

  const extraDomains = parseExtraAdultDomains(readEnv("FREED_ADULT_DOMAIN_FEED_EXTRA_DOMAINS"));
  extraDomains.domains.forEach((domain) => allDomains.add(domain));
  rejectedNormalDomainCount += extraDomains.rejectedNormalDomainCount;
  if (extraDomains.domains.length > 0 || extraDomains.rejectedNormalDomainCount > 0) {
    sourceReports.push(
      sanitizeSourceReport({
        id: "freed-custom-extra",
        label: "FREED reviewed extra domains",
        status: "merged",
        domainCount: extraDomains.domains.length,
        rejectedNormalDomainCount: extraDomains.rejectedNormalDomainCount
      })
    );
  }

  const domains = [...allDomains].sort();
  if (domains.length === 0) {
    await finishAdultFeedJob({
      idempotencyKey,
      startedAt,
      status: "failed",
      metadata: {
        failureCode: "adult-domain-feed-empty",
        reviewedSourceCount: acceptedSources.length,
        failedSourceCount: sourceReports.filter((report) => report.status === "failed").length,
        sourceMaxBytes,
        lockStatus: lock.status,
        storesFullList: false
      }
    });
    return jsonResponse(
      {
        ok: false,
        error: "adult-domain-feed-empty",
        reviewedSourceCount: acceptedSources.length,
        sourceReports,
        readiness: buildReadiness(acceptedSources.length, sourceTimeoutMs, sourceMaxBytes)
      },
      503
    );
  }

  const generatedAt = new Date().toISOString();
  const checksum = checksumDomains(domains);
  const version = readEnv("FREED_ADULT_DOMAIN_FEED_VERSION", `edge-${generatedAt.slice(0, 10)}-${checksum.slice(-8)}`);
  const readiness = buildReadiness(acceptedSources.length, sourceTimeoutMs, sourceMaxBytes);
  const row = {
    version,
    checksum,
    generated_at: generatedAt,
    domain_count: Math.min(domains.length, 50000),
    safari_rule_count: Math.min(domains.length + 4, 50000),
    rejected_normal_domain_count: rejectedNormalDomainCount,
    source_reports: sourceReports,
    readiness,
    expires_at: futureIso(retentionDays)
  };

  const persistence = await upsertSupabaseRow(tableName, row);
  if (!persistence.ok) {
    await finishAdultFeedJob({
      idempotencyKey,
      startedAt,
      status: "failed",
      metadata: {
        failureCode: persistence.error || "supabase-upsert-failed",
        httpStatus: persistence.status,
        reviewedSourceCount: acceptedSources.length,
        feedEntryCount: domains.length,
        lockStatus: lock.status,
        storesFullList: false
      }
    });
    return jsonResponse(
      {
        ok: false,
        error: persistence.error,
        httpStatus: persistence.status,
        checksum,
        domainCount: domains.length,
        rejectedNormalDomainCount,
        sourceReports,
        readiness
      },
      503
    );
  }

  await finishAdultFeedJob({
    idempotencyKey,
    startedAt,
    status: "succeeded",
    metadata: {
      reviewedSourceCount: acceptedSources.length,
      feedEntryCount: domains.length,
      normalEntryRejectCount: rejectedNormalDomainCount,
      safariRuleCount: row.safari_rule_count,
      sourceMaxBytes,
      lockStatus: lock.status,
      storesFullList: false
    }
  });

  return jsonResponse({
    ok: true,
    version,
    checksum,
    domainCount: domains.length,
    rejectedNormalDomainCount,
    safariRuleCount: row.safari_rule_count,
    sourceReports,
    readiness
  });
  } finally {
    await releaseEdgeRedisLock(lock);
  }
});

function buildReadiness(reviewedSourceCount: number, sourceTimeoutMs: number, sourceMaxBytes: number) {
  return {
    edgeFunction: true,
    storesFullDomainList: false,
    reviewedSourceCount,
    sourceTimeoutMs,
    sourceMaxBytes,
    noPacketInspection: true,
    noScreenshotAnalysis: true,
    noRawBrowsingData: true
  };
}

function finishAdultFeedJob(input: {
  idempotencyKey: string;
  startedAt: string;
  status: "succeeded" | "failed";
  metadata: Record<string, unknown>;
}) {
  return recordBackendJobRun({
    jobName: "adult-domain-feed-sync",
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    metadata: input.metadata
  }).catch(() => null);
}
