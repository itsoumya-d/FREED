import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import { verifyPurchasePayload } from "@/lib/purchase-verification";
import { readBoundedJsonBody } from "@/lib/server-request-body";

const PURCHASE_VERIFICATION_BODY_LIMIT_BYTES = 32 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceBackendRateLimit({
      route: "purchase-verification",
      request,
      limit: 30,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: backendRateLimitError(rateLimit, "Too many purchase verification requests."),
          status: rateLimit.status,
          retryAfterSeconds: rateLimit.retryAfterSeconds
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: PURCHASE_VERIFICATION_BODY_LIMIT_BYTES,
      routeLabel: "Purchase verification"
    });
    if (!body.ok) {
      return json(
        {
          active: false,
          entitlementId: "premium",
          provider: "fallback",
          status: "invalid",
          reason: body.reason
        },
        body.status
      );
    }

    const result = await verifyPurchasePayload(body.value);
    return json(result, result.status === "invalid" ? 400 : 200);
  } catch {
    return json(
      {
        active: false,
        entitlementId: "premium",
        provider: "fallback",
        status: "invalid",
        reason: "Malformed JSON body."
      },
      400
    );
  }
}
