import {
  acquireEdgeRedisLock,
  clampNumber,
  deleteExpiredRows,
  jsonResponse,
  optionsResponse,
  recordBackendJobRun,
  releaseEdgeRedisLock,
  readEnv,
  requireMaintenanceAuth
} from "../_shared/freed_edge_contract.ts";

const RETENTION_TARGETS = [
  {
    env: "SUPABASE_ANALYTICS_TABLE",
    fallback: "recovery_analytics_events"
  },
  {
    env: "SUPABASE_ADULT_FEED_TABLE",
    fallback: "adult_domain_feed_versions"
  },
  {
    env: "SUPABASE_RECOVERY_BACKUP_TABLE",
    fallback: "encrypted_recovery_backups"
  },
  {
    env: "SUPABASE_PURCHASE_AUDIT_TABLE",
    fallback: "purchase_verification_events"
  },
  {
    env: "SUPABASE_AI_EVENTS_TABLE",
    fallback: "ai_backend_events"
  }
];

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
  const cutoffIso = new Date().toISOString();
  const idempotencyKey = `analytics-retention-cleanup:${cutoffIso.slice(0, 10)}`;
  const lockTtlMs = clampNumber(readEnv("FREED_EDGE_JOB_LOCK_TTL_MS"), 600_000, 1_000, 3_600_000);
  const lock = await acquireEdgeRedisLock(`freed:edge:analytics-retention-cleanup:${cutoffIso.slice(0, 10)}`, lockTtlMs);
  if (!lock.acquired) {
    await recordBackendJobRun({
      jobName: "analytics-retention-cleanup",
      idempotencyKey: `${idempotencyKey}:skipped:${startedAt.replace(/[^0-9]/g, "")}`,
      status: "skipped",
      startedAt,
      finishedAt: new Date().toISOString(),
      metadata: {
        lockStatus: lock.status,
        lockProvider: lock.provider,
        failureCode: lock.status === "locked" ? "edge-job-already-running" : "edge-job-lock-unavailable",
        targetCount: RETENTION_TARGETS.length
      }
    }).catch(() => null);
    return jsonResponse(
      {
        ok: false,
        jobName: "analytics-retention-cleanup",
        error: lock.status === "locked" ? "edge-job-already-running" : "edge-job-lock-unavailable",
        lockStatus: lock.status
      },
      lock.status === "locked" ? 409 : 503
    );
  }

  const results = [];

  try {

  await recordBackendJobRun({
    jobName: "analytics-retention-cleanup",
    idempotencyKey,
    status: "started",
    startedAt,
    finishedAt: null,
    metadata: {
      targetCount: RETENTION_TARGETS.length,
      lockStatus: lock.status,
      cutoffDate: cutoffIso.slice(0, 10)
    }
  }).catch(() => null);

  for (const target of RETENTION_TARGETS) {
    const table = readEnv(target.env, target.fallback);
    results.push({
      target: target.env,
      ...(await deleteExpiredRows(table, cutoffIso))
    });
  }

  const ok = results.every((result) => result.status === "deleted-expired");
  await recordBackendJobRun({
    jobName: "analytics-retention-cleanup",
    idempotencyKey,
    status: ok ? "succeeded" : "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    metadata: {
      targetCount: results.length,
      failedTargetCount: results.filter((result) => result.status !== "deleted-expired").length,
      deletedRowCount: results.reduce((count, result) => count + (Number(result.deletedCount) || 0), 0),
      lockStatus: lock.status,
      cutoffDate: cutoffIso.slice(0, 10)
    }
  }).catch(() => null);

  return jsonResponse({
    ok,
    jobName: "analytics-retention-cleanup",
    cutoffIso,
    targetCount: results.length,
    results
  }, ok ? 200 : 503);
  } finally {
    await releaseEdgeRedisLock(lock);
  }
});
