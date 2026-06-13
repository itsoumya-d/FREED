import { runBackendJob } from "@/lib/backend-infrastructure";
import {
  cleanupExpiredBackendRows,
  validateBackendMaintenanceAuth
} from "@/lib/backend-retention-cleanup";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-FREED-Maintenance-Secret"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  if (!validateBackendMaintenanceAuth(request)) {
    return json(
      {
        ok: false,
        status: "unauthorized",
        reason: "Backend maintenance cleanup is not authorized."
      },
      401
    );
  }

  const now = new Date().toISOString();
  const job = await runBackendJob(
    {
      jobName: "analytics-retention-cleanup",
      idempotencyKey: `analytics-retention-cleanup:${now.slice(0, 10)}`,
      lockKey: `freed:analytics-retention-cleanup:${now.slice(0, 10)}`,
      lockTtlMs: 10 * 60_000,
      metadata: {
        targetCount: 5,
        cutoffDate: now.slice(0, 10)
      }
    },
    () => cleanupExpiredBackendRows({ cleanedAt: now, cutoff: now })
  );

  return json(
    {
      ok: job.status === "succeeded" && job.result?.ok === true,
      status: job.status,
      cleanup: job.result,
      job: {
        status: job.status,
        lockStatus: job.lock.status,
        auditStatus: job.audit.status
      }
    },
    job.status === "skipped" ? 409 : job.result?.status === "unconfigured" ? 503 : job.result?.status === "invalid" ? 400 : 200
  );
}
