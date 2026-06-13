import {
  createLocalRetentionPlan,
  normalizeRetentionPlan,
  sanitizeRetentionRequest,
  type RetentionPlan,
  type RetentionRequest
} from "@/lib/retention-orchestrator";
import { recordAiBackendEvent } from "@/lib/backend-event-audit";
import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import { readBoundedJsonBody } from "@/lib/server-request-body";
import { safeServerAiFallbackReason } from "@/lib/server-ai-fallback-reason";
import { createServerAiText, readServerAiProviderModel } from "@/lib/server-ai-provider";

const RETENTION_BODY_LIMIT_BYTES = 64 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeFallbackReason(error: unknown) {
  return safeServerAiFallbackReason(error, "Retention backend fallback.");
}

const RETENTION_SYSTEM_INSTRUCTION =
  "Generate one privacy-safe FREED retention plan from aggregate recovery signals only. " +
  "Do not request or include private notes, contacts, browsing history, URLs, domains, transcripts, secrets, shame, or sexualized detail. " +
  "Return JSON ONLY. No Markdown, no commentary.";

const RETENTION_JSON_SCHEMA = {
  type: "object",
  required: ["headline", "nextBestAction", "checkInPrompt", "suggestedGuardTime", "focusTags"],
  properties: {
    headline: { type: "string" },
    nextBestAction: { type: "string" },
    checkInPrompt: { type: "string" },
    suggestedGuardTime: { type: "string", nullable: true },
    focusTags: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" }
    }
  }
};

async function createRemoteRetentionPlan(request: RetentionRequest, fallback: RetentionPlan) {
  const text = await createServerAiText({
    taskName: "retention plan",
    systemInstruction: RETENTION_SYSTEM_INSTRUCTION,
    userPrompt: `Create today's retention plan for this anonymized profile: ${JSON.stringify(request)}`,
    responseFormat: "json",
    geminiResponseSchema: RETENTION_JSON_SCHEMA,
    temperature: 0.55,
    topP: 0.9,
    maxOutputTokens: 500
  });
  const parsed = text ? JSON.parse(text) : null;
  const plan = normalizeRetentionPlan(parsed, { ...fallback, provider: "remote", status: "ok" });
  if (!plan.nextBestAction) throw new Error("Remote AI returned no usable retention plan.");
  return plan;
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

async function recordRetentionAudit(
  request: RetentionRequest,
  plan: RetentionPlan,
  event: { provider: "remote" | "fallback"; requestKind: string; reason?: string }
) {
  await recordAiBackendEvent({
    route: "retention",
    provider: event.provider,
    model: readServerAiProviderModel(),
    requestKind: event.requestKind,
    safetyEvalPassed: true,
    redactionPassed: true,
    payloadSummary: {
      status: plan.status,
      reasonCode: event.reason ? event.reason.split(/\s+/).slice(0, 6).join("-") : null,
      premium: request.profile.premium,
      streakDays: request.profile.streakDays,
      attemptsThisWeek: request.profile.attemptsThisWeek,
      slipsThisWeek: request.profile.slipsThisWeek,
      checkInsThisWeek: request.profile.checkInsThisWeek,
      completedChallengesThisWeek: request.profile.completedChallengesThisWeek,
      urgeRiskLevel: request.profile.urgeRiskForecast.level,
      urgeRiskConfidence: request.profile.urgeRiskForecast.confidence,
      focusTagCount: plan.focusTags.length,
      suggestedGuard: Boolean(plan.suggestedGuardTime),
      smartGuardSource: request.profile.smartGuardSource
    }
  }).catch(() => null);
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceBackendRateLimit({
      route: "retention",
      request,
      limit: 30,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: backendRateLimitError(rateLimit, "Too many retention requests."),
          status: rateLimit.status,
          retryAfterSeconds: rateLimit.retryAfterSeconds
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: RETENTION_BODY_LIMIT_BYTES,
      routeLabel: "Retention orchestration"
    });
    if (!body.ok) {
      return json({ error: body.reason }, body.status);
    }

    const sanitized = sanitizeRetentionRequest(body.value);
    if (!sanitized) {
      return json({ error: "Invalid retention orchestration request." }, 400);
    }

    const fallback = createLocalRetentionPlan(sanitized);
    try {
      const plan = await createRemoteRetentionPlan(sanitized, fallback);
      await recordRetentionAudit(sanitized, plan, { provider: "remote", requestKind: "retention-plan" });
      return json(plan);
    } catch (error) {
      const reason = sanitizeFallbackReason(error);
      const plan = {
        ...fallback,
        provider: "fallback" as const,
        status: "fallback" as const,
        reason
      };
      await recordRetentionAudit(sanitized, plan, {
        provider: "fallback",
        requestKind: "retention-fallback",
        reason
      });
      return json({
        ...plan
      });
    }
  } catch {
    return json({ error: "Malformed JSON body." }, 400);
  }
}
