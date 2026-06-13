import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import {
  sendRemoteNotification,
  validateRemoteNotificationAuth
} from "@/lib/remote-notifications";
import { readBoundedJsonBody } from "@/lib/server-request-body";

const REMOTE_NOTIFICATION_BODY_LIMIT_BYTES = 16 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    if (!validateRemoteNotificationAuth(request)) {
      return json(
        {
          sent: false,
          provider: "fallback",
          status: "unauthorized",
          reason: "Remote notification dispatch is not authorized."
        },
        401
      );
    }

    const rateLimit = await enforceBackendRateLimit({
      route: "notifications",
      request,
      limit: 120,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: backendRateLimitError(rateLimit, "Too many notification dispatch requests."),
          status: rateLimit.status,
          retryAfterSeconds: rateLimit.retryAfterSeconds
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: REMOTE_NOTIFICATION_BODY_LIMIT_BYTES,
      routeLabel: "Remote notification dispatch"
    });
    if (!body.ok) {
      return json(
        {
          sent: false,
          provider: "fallback",
          status: "invalid",
          reason: body.reason
        },
        body.status
      );
    }

    const result = await sendRemoteNotification(body.value);
    const status = result.status === "invalid" ? 400 : result.status === "unconfigured" ? 503 : result.status === "failed" ? 502 : 200;
    return json(result, status);
  } catch {
    return json(
      {
        sent: false,
        provider: "fallback",
        status: "invalid",
        reason: "Malformed JSON body."
      },
      400
    );
  }
}
