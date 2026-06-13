import { redactCoachText } from "@/lib/ai-coach";
import type { CoachRequest } from "@/lib/ai-coach";
import { recordAiBackendEvent } from "@/lib/backend-event-audit";
import {
  backendRateLimitError,
  backendRateLimitHttpStatus,
  enforceBackendRateLimit
} from "@/lib/backend-infrastructure";
import { generateCoachReply, isCrisisSupportInput } from "@/lib/recovery-engine";
import { coarseRecoveryTriggerLabel } from "@/lib/recovery-signal-privacy";
import { readBoundedJsonBody } from "@/lib/server-request-body";
import { safeServerAiFallbackReason } from "@/lib/server-ai-fallback-reason";
import { createServerAiText, readServerAiProviderModel } from "@/lib/server-ai-provider";

const CLARA_BODY_LIMIT_BYTES = 64 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: corsHeaders });
}

function sanitizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

function sanitizeSignalText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = redactCoachText(value).slice(0, 64);
  return cleaned || null;
}

function sanitizeCoachRequest(value: unknown): CoachRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const context = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? (body.context as Record<string, unknown>) : {};
  const slipsThisWeek = sanitizeCount(context.slipsThisWeek);
  const includeSlipSignals = (slipsThisWeek ?? 0) > 0;

  if (typeof body.input !== "string") return null;

  return {
    input: redactCoachText(body.input),
    context: {
      streakDays: typeof context.streakDays === "number" && Number.isFinite(context.streakDays) ? Math.max(0, Math.round(context.streakDays)) : null,
      attemptsToday: typeof context.attemptsToday === "number" && Number.isFinite(context.attemptsToday) ? Math.max(0, Math.round(context.attemptsToday)) : null,
      premium: typeof context.premium === "boolean" ? context.premium : null,
      slipsThisWeek,
      slipWindow: includeSlipSignals ? sanitizeSignalText(context.slipWindow) : null,
      slipTrigger: includeSlipSignals ? coarseRecoveryTriggerLabel(context.slipTrigger) : null,
      recentRiskHosts: Array.isArray(context.recentRiskHosts)
        ? context.recentRiskHosts.filter((host): host is string => typeof host === "string").map((host) => host.slice(0, 120)).slice(0, 5)
        : [],
      recentRules: Array.isArray(context.recentRules)
        ? context.recentRules.filter((rule): rule is string => typeof rule === "string").map((rule) => rule.slice(0, 120)).slice(0, 5)
        : []
    },
    guardrails: [
      "Be calm, supportive, and non-judgmental.",
      "Never shame the user or use sexualized detail.",
      "Give one immediate recovery action before broader advice.",
      "Treat slip summaries as aggregate pattern signals, not as a story to repeat back.",
      "Do not include raw URLs, paths, query strings, or browsing history.",
      "Encourage professional help for crisis, self-harm, abuse, or severe distress."
    ]
  };
}

function sanitizeCoachOutput(input: string) {
  return redactCoachText(input).slice(0, 1_000);
}

function sanitizeFallbackReason(error: unknown) {
  return safeServerAiFallbackReason(error, "CLARA backend fallback.");
}

const CLARA_SYSTEM_INSTRUCTION =
  "You are CLARA, FREED's recovery coach. You are supportive, concise, calm, trauma-aware, non-judgmental, and practical. " +
  "You never include sexualized detail, shame, moral condemnation, or raw browsing details. " +
  "Always give one immediate next action first, then a one-sentence reason. " +
  "Keep total length under 120 words. Reply in plain text only.";

async function createRemoteCoachReply(request: CoachRequest) {
  const text = await createServerAiText({
    taskName: "coach reply",
    systemInstruction: CLARA_SYSTEM_INSTRUCTION,
    userPrompt: `User input: ${request.input}\n\nSafe recovery context: ${JSON.stringify(request.context)}\n\nGuardrails: ${request.guardrails.join(" | ")}`,
    responseFormat: "text",
    temperature: 0.6,
    topP: 0.9,
    maxOutputTokens: 320
  });
  const safeText = sanitizeCoachOutput(text);
  if (!safeText) throw new Error("Remote AI returned an empty coach reply.");
  return safeText;
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

async function recordClaraAudit(
  coachRequest: CoachRequest,
  event: {
    provider: "remote" | "fallback";
    requestKind: string;
    status: "ok" | "fallback";
    crisisFallbackUsed?: boolean;
    reason?: string;
    responseLength?: number;
  }
) {
  await recordAiBackendEvent({
    route: "clara",
    provider: event.provider,
    model: readServerAiProviderModel(),
    requestKind: event.requestKind,
    safetyEvalPassed: event.status === "ok" || event.provider === "fallback",
    redactionPassed: true,
    crisisFallbackUsed: Boolean(event.crisisFallbackUsed),
    responseTokenCount: event.responseLength ? Math.ceil(event.responseLength / 4) : null,
    payloadSummary: {
      status: event.status,
      reasonCode: event.reason ? event.reason.split(/\s+/).slice(0, 6).join("-") : null,
      inputLength: coachRequest.input.length,
      streakDays: coachRequest.context.streakDays,
      attemptsToday: coachRequest.context.attemptsToday,
      premium: coachRequest.context.premium,
      recentRiskHostCount: coachRequest.context.recentRiskHosts.length,
      recentRuleCount: coachRequest.context.recentRules.length,
      slipSignalsIncluded: (coachRequest.context.slipsThisWeek ?? 0) > 0
    }
  }).catch(() => null);
}

export async function POST(request: Request) {
  try {
    const rateLimit = await enforceBackendRateLimit({
      route: "clara",
      request,
      limit: 30,
      windowSeconds: 60
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: backendRateLimitError(rateLimit, "Too many CLARA requests."),
          status: rateLimit.status,
          retryAfterSeconds: rateLimit.retryAfterSeconds
        },
        backendRateLimitHttpStatus(rateLimit)
      );
    }

    const body = await readBoundedJsonBody(request, {
      maxBytes: CLARA_BODY_LIMIT_BYTES,
      routeLabel: "CLARA"
    });
    if (!body.ok) {
      return json({ error: body.reason }, body.status);
    }

    const coachRequest = sanitizeCoachRequest(body.value);
    if (!coachRequest || !coachRequest.input) {
      return json({ error: "Invalid CLARA request." }, 400);
    }

    if (isCrisisSupportInput(coachRequest.input)) {
      const text = generateCoachReply(coachRequest.input, []);
      await recordClaraAudit(coachRequest, {
        provider: "fallback",
        requestKind: "coach-crisis-fallback",
        status: "fallback",
        crisisFallbackUsed: true,
        responseLength: text.length
      });
      return json({
        text,
        provider: "fallback",
        status: "fallback"
      });
    }

    try {
      const text = await createRemoteCoachReply(coachRequest);
      await recordClaraAudit(coachRequest, {
        provider: "remote",
        requestKind: "coach-reply",
        status: "ok",
        responseLength: text.length
      });
      return json({ text, provider: "remote", status: "ok" });
    } catch (error) {
      const text = generateCoachReply(coachRequest.input, []);
      const reason = sanitizeFallbackReason(error);
      await recordClaraAudit(coachRequest, {
        provider: "fallback",
        requestKind: "coach-fallback",
        status: "fallback",
        reason,
        responseLength: text.length
      });
      return json({
        text,
        provider: "fallback",
        status: "fallback",
        reason
      });
    }
  } catch {
    return json({ error: "Malformed JSON body." }, 400);
  }
}
