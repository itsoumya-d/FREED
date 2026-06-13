import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import { ingestRecoveryAnalytics } from "@/lib/recovery-analytics-ingestion";
import { readBoundedJsonBody } from "@/lib/server-request-body";

const ANALYTICS_BODY_LIMIT_BYTES = 128 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function statusCode(status: string) {
  if (status === "ok") return 200;
  if (status === "invalid") return 400;
  if (status === "unconfigured") return 503;
  return 502;
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceBackendRateLimit({
      route: "analytics",
      request,
      limit: 60,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          accepted: false,
          provider: rateLimit.provider,
          status: rateLimit.status,
          receivedAt: new Date().toISOString(),
          retryAfterSeconds: rateLimit.retryAfterSeconds,
          reason: backendRateLimitError(rateLimit, "Too many analytics ingestion requests.")
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: ANALYTICS_BODY_LIMIT_BYTES,
      routeLabel: "Analytics ingestion"
    });
    if (!body.ok) {
      return json(
        {
          accepted: false,
          provider: "invalid",
          status: "invalid",
          receivedAt: new Date().toISOString(),
          reason: body.reason
        },
        body.status
      );
    }

    const result = await ingestRecoveryAnalytics(body.value);
    return json(result, statusCode(result.status));
  } catch {
    return json(
      {
        accepted: false,
        provider: "invalid",
        status: "invalid",
        receivedAt: new Date().toISOString(),
        reason: "Malformed JSON body."
      },
      400
    );
  }
}
