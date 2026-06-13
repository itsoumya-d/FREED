import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import { syncEncryptedRecoveryBackup } from "@/lib/recovery-backup-sync";
import { readBoundedJsonBody } from "@/lib/server-request-body";

const RECOVERY_BACKUP_SYNC_BODY_LIMIT_BYTES = 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function statusCode(status: string) {
  if (status === "ok") return 200;
  if (status === "invalid") return 400;
  if (status === "unauthorized") return 401;
  if (status === "unconfigured") return 503;
  return 502;
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceBackendRateLimit({
      route: "recovery-backup",
      request,
      limit: 30,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          ok: false,
          status: rateLimit.status,
          reason: backendRateLimitError(rateLimit, "Too many recovery backup sync requests."),
          retryAfterSeconds: rateLimit.retryAfterSeconds
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: RECOVERY_BACKUP_SYNC_BODY_LIMIT_BYTES,
      routeLabel: "Recovery backup sync"
    });
    if (!body.ok) {
      return json(
        {
          ok: false,
          provider: "invalid",
          status: "invalid",
          syncedAt: new Date().toISOString(),
          reason: body.reason
        },
        body.status
      );
    }

    const result = await syncEncryptedRecoveryBackup(body.value, request);
    return json(result, statusCode(result.status));
  } catch {
    return json(
      {
        ok: false,
        provider: "invalid",
        status: "invalid",
        syncedAt: new Date().toISOString(),
        reason: "Malformed JSON body."
      },
      400
    );
  }
}
