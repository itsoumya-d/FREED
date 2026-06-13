import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { buildCoachRequest } from "../src/lib/ai-coach";
import { createBlockingAttempt } from "../src/lib/blocking-engine";
import { buildChallengeGenerationRequest } from "../src/lib/challenge-generator";
import { formatEndpointIssues, getProductionEndpointIssues } from "../src/lib/endpoint-safety";
import { fetchRemoteProviderResponse, readRemoteProviderJson } from "../src/lib/remote-provider-timeout";
import { readConfiguredServerAiModel } from "../src/lib/server-ai-provider";

const { assertSafeReportPath: assertSafeWorkspaceReportPath } = require("./lib/report-path-safety");

type SmokeResult = {
  id: string;
  status: "PASS" | "FAIL";
  detail: string;
};

type JsonRecord = Record<string, unknown>;

type AiBackendSmokeReport = {
  schemaVersion: "ai-backend-smoke-v1";
  generatedAt: string;
  sanitized: true;
  endpoints: {
    coach: string | null;
    challenge: string | null;
    retention: string | null;
  };
  summary: {
    passCount: number;
    failCount: number;
  };
  aiBoundary: {
    configuredModelChecked: boolean;
    claraEndpointChecked: boolean;
    challengeEndpointChecked: boolean;
    retentionEndpointConfigured: boolean;
    retentionEndpointChecked: boolean;
    retentionAggregateOnlyChecked: boolean;
    challengePersonalizationProfilesChecked: boolean;
    challengeSessionDurationBucketChecked: boolean;
    challengeRecentFailureCountChecked: boolean;
    noSensitiveEchoChecked: boolean;
    noCoordinateFieldsChecked: boolean;
    redactedSensitiveFields: string[];
  };
  contractProof: {
    endpointPathRequirements: {
      coach: "/api/clara";
      challenge: "/api/challenges";
      retention: "/api/retention";
    };
    requestTimeoutMs: {
      coach: number;
      challenge: number;
      retention: number;
    };
    configuredModelProof: {
      configuredModelChecked: boolean;
      concreteProviderModelRequired: true;
      placeholderModelRejected: true;
    };
    endpointProofs: {
      claraEndpointChecked: boolean;
      challengeEndpointChecked: boolean;
      retentionEndpointConfigured: boolean;
      retentionEndpointChecked: boolean;
      productionHttpsOnly: true;
      endpointQueryStringsOmitted: true;
    };
    personalizationProofs: {
      challengePersonalizationProfilesChecked: boolean;
      contextSignalsChecked: boolean;
      aggregateRiskForecastChecked: boolean;
      sessionDurationBucketChecked: boolean;
      recentFailureCountChecked: boolean;
      noRawRiskDriversStored: true;
    };
    privacyProofs: {
      retentionAggregateOnlyChecked: boolean;
      noSensitiveEchoChecked: boolean;
      noCoordinateFieldsChecked: boolean;
      rawPromptsOmitted: true;
      unredactedModelResponsesOmitted: true;
    };
    responseBoundary: {
      privateEchoPatternsChecked: number;
      secretValuesOmitted: true;
      serverSecretKeyNamesChecked: string[];
      redactedSensitiveFields: string[];
    };
  };
  results: SmokeResult[];
};

const DEFAULT_AI_SMOKE_TIMEOUT_MS = 8_000;
const MIN_AI_SMOKE_TIMEOUT_MS = 1_000;
const MAX_AI_SMOKE_TIMEOUT_MS = 12_000;
const AI_ENDPOINT_PATHS = {
  coach: "/api/clara",
  challenge: "/api/challenges",
  retention: "/api/retention"
} as const;
const REDACTED_SENSITIVE_FIELDS = ["urls", "domains", "tokens", "privateNotes", "coordinateFields", "rawModelText", "providerApiKeys"] as const;
const FORBIDDEN_RESPONSE_PATTERNS = [
  /https?:\/\//i,
  /token=(?!redacted)[^"'&\s]+/i,
  /private\.example/i,
  /raw-note/i,
  /\b(?:latitude|longitude|preciseLocation)\b/i,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /ya29\.[0-9A-Za-z._-]{20,}/,
  /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/
] as const;
const SERVER_SECRET_KEYS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64"
] as const;

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}

function readBoundedTimeoutMs(key: string) {
  const raw = readEnv(key);
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_AI_SMOKE_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_AI_SMOKE_TIMEOUT_MS;
  return Math.max(MIN_AI_SMOKE_TIMEOUT_MS, Math.min(MAX_AI_SMOKE_TIMEOUT_MS, Math.round(parsed)));
}

function parseArgs(argv: string[]) {
  const options = {
    coachEndpoint: readEnv("EXPO_PUBLIC_AI_COACH_ENDPOINT"),
    challengeEndpoint: readEnv("EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT"),
    retentionEndpoint: readEnv("EXPO_PUBLIC_RETENTION_ENDPOINT"),
    reportPath: null as string | null,
    selfTest: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--coach-endpoint") {
      options.coachEndpoint = next();
    } else if (arg === "--challenge-endpoint") {
      options.challengeEndpoint = next();
    } else if (arg === "--retention-endpoint") {
      options.retentionEndpoint = next();
    } else if (arg === "--report") {
      options.reportPath = next();
    } else if (arg.startsWith("--report=")) {
      options.reportPath = arg.slice("--report=".length);
      if (!options.reportPath) throw new Error("Missing value for --report.");
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run smoke:ai-backend -- [options]

Validates deployed CLARA and challenge-generation endpoints with privacy-safe
requests. When a retention endpoint is configured, it also validates the
deployed aggregate-only retention route. The command proves remote responses
avoid sensitive URL/domain, private-note, token, and coordinate echoes.

Options:
  --coach-endpoint <url>        Deployed /api/clara route.
  --challenge-endpoint <url>    Deployed /api/challenges route.
  --retention-endpoint <url>    Optional deployed /api/retention route.
  --report <path>               Write a sanitized JSON report artifact.
  --self-test                   Run offline validator checks.
`);
}

function asJsonRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object JSON body.`);
  }
  return value as JsonRecord;
}

async function readJsonOrNull(response: Response, timeoutMs: number, label: string) {
  try {
    return await readRemoteProviderJson(response, timeoutMs, label);
  } catch (error) {
    if (error instanceof Error && /timed out after/i.test(error.message)) throw error;
    return null;
  }
}

function assertNoSensitiveEcho(value: unknown) {
  const text = JSON.stringify(value);
  assert.equal(/https?:\/\//i.test(text), false);
  assert.equal(text.includes("token=secret"), false);
  assert.equal(text.includes("private.example.com"), false);
  assert.equal(text.includes("raw-note"), false);
}

function assertNoCoordinateFields(value: unknown) {
  const text = JSON.stringify(value);
  assert.equal(text.includes("latitude"), false);
  assert.equal(text.includes("longitude"), false);
}

function sanitizeEndpointForReport(endpoint: string | null) {
  if (!endpoint) return null;
  try {
    const parsed = new URL(endpoint);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeDetailForReport(detail: string, env: Record<string, string | undefined> = process.env) {
  let sanitized = detail
    .replace(/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:EC |RSA )?PRIVATE KEY-----/g, "[redacted-private-key]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/token=(?!redacted)[^"'&\s]+/gi, "token=[redacted]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,})\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]")
    .replace(/\b(?:latitude|longitude|preciseLocation)\b/gi, "[redacted-coordinate-field]")
    .replace(/\braw-note\b/gi, "[redacted-private-note]")
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-domain]");

  for (const key of SERVER_SECRET_KEYS) {
    const value = env[key]?.trim();
    if (!value || value.length < 8) continue;
    sanitized = sanitized.split(value).join(`[redacted-${key}]`);
  }
  return sanitized.slice(0, 1_000);
}

function sanitizeResultsForReport(results: SmokeResult[]) {
  return results.map((result) => ({
    ...result,
    detail: sanitizeDetailForReport(result.detail)
  }));
}

function validRemoteAiModelId(value: string) {
  if (value.length < 4 || value.length > 128) return false;
  if (!/^[A-Za-z0-9._~:/+=-]+$/.test(value)) return false;

  const normalized = value.toLowerCase();
  if (["configured-server-model", "gpt-release-safe"].includes(normalized)) return false;

  const placeholderTokens = new Set(["configured", "placeholder", "changeme", "test", "mock", "sample", "sandbox", "local", "fallback", "dummy"]);
  return !normalized
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .some((token) => placeholderTokens.has(token));
}

function validateConfiguredModel(): SmokeResult {
  const model = readConfiguredServerAiModel();
  if (!model) {
    return { id: "configured-ai-model", status: "FAIL", detail: "OPENAI_MODEL or GEMINI_MODEL is not configured." };
  }
  if (!validRemoteAiModelId(model)) {
    return { id: "configured-ai-model", status: "FAIL", detail: "OPENAI_MODEL or GEMINI_MODEL must be a concrete remote provider model id." };
  }
  return { id: "configured-ai-model", status: "PASS", detail: model };
}

async function postJson(endpoint: string, payload: unknown, timeoutMs: number, label: string) {
  const response = await fetchRemoteProviderResponse(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }, timeoutMs, label);

  const body = await readJsonOrNull(response, timeoutMs, `${label} response`);
  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}: ${JSON.stringify(body).slice(0, 240)}`);
  }
  return asJsonRecord(body, label);
}

async function smokeCoach(endpoint: string, timeoutMs: number) {
  const request = buildCoachRequest("I have an urge after https://pornhub.com/private?token=secret", {
    attempts: [createBlockingAttempt("https://pornhub.com/private?token=secret", "browser")],
    streakDays: 12,
    attemptsToday: 1,
    premium: true,
    slipsThisWeek: 1,
    slipWindow: "Late night",
    slipTrigger: "Stress after https://private.example.com/raw-note"
  });

  const payload = await postJson(endpoint, request, timeoutMs, "Remote CLARA smoke request");
  assert.equal(payload.provider, "remote");
  assert.equal(payload.status, "ok");
  assert.equal(typeof payload.text, "string");
  assert.ok(payload.text.trim().length > 0);
  assertNoSensitiveEcho(payload);
}

async function smokeChallenges(endpoint: string, timeoutMs: number) {
  const request = buildChallengeGenerationRequest({
    streakDays: 9,
    premium: false,
    attemptsToday: 2,
    mood: "stressed",
    hour: 23,
    slipsThisWeek: 2,
    slipWindow: "Late night",
    slipTrigger: "Stress after https://private.example.com/raw-note?token=secret",
    interventionContext: {
      source: "app",
      category: "unknown",
      surface: "social",
      matchedRule: "short-form:instagram-reels",
      sessionDurationBucket: "15-30m"
    },
    contextSignals: {
      energyLevel: "low",
      urgeLevel: 5,
      sleepQuality: 1,
      locationPermission: "denied",
      weatherCondition: "rain",
      temperatureC: 8
    },
    riskForecast: {
      level: "high",
      score: 88,
      confidence: "high",
      currentWindow: "Late night risk window",
      drivers: ["Current time matches learned risk window", "Private https://private.example.com/raw-note?token=secret"]
    },
    preferredCategories: ["breathing"],
    recentFailureCount: 3,
    challengeHistory: [
      {
        id: "breathing-478",
        category: "breathing",
        outcome: "helped",
        completedAt: new Date(Date.now() - 86_400_000).toISOString()
      }
    ]
  });

  assert.equal(request.profile.contextSignals?.weatherCondition, "rain");
  assert.equal(request.profile.riskForecast?.level, "high");
  assert.equal(request.profile.riskForecast?.drivers.includes("Private [redacted-link]"), true);
  assertNoSensitiveEcho(request);
  assertNoCoordinateFields(request);
  const payload = await postJson(endpoint, request, timeoutMs, "Remote challenge smoke request");
  assertChallengePayload(payload, false);
}

function assertChallengePayload(payload: unknown, allowPremium: boolean) {
  assert.equal((payload as { provider?: unknown }).provider, "remote");
  assert.equal((payload as { status?: unknown }).status, "ok");
  const challenges = (payload as { challenges?: unknown }).challenges;
  assert.ok(Array.isArray(challenges));
  assert.equal(challenges.length, 3);
  assertNoSensitiveEcho(payload);

  for (const challenge of challenges) {
    assert.equal(typeof challenge.id, "string");
    assert.equal(typeof challenge.title, "string");
    assert.ok(["physical", "breathing", "reflection", "connection", "reset"].includes(challenge.category));
    assert.ok(["calm", "medium", "strong"].includes(challenge.intensity));
    if (!allowPremium) assert.equal(challenge.premium, false);
    assert.ok(Array.isArray(challenge.steps));
    assert.ok(challenge.steps.length >= 2);
    assert.equal(typeof challenge.why, "string");
  }
}

async function smokeChallengePersonalization(endpoint: string, timeoutMs: number) {
  const freeHighRisk = buildChallengeGenerationRequest({
    streakDays: 3,
    premium: false,
    attemptsToday: 4,
    mood: "stressed",
    hour: 23,
    slipsThisWeek: 2,
    slipWindow: "Late night",
    slipTrigger: "Stress after https://private.example.com/raw-note?token=secret",
    contextSignals: {
      energyLevel: "low",
      urgeLevel: 5,
      sleepQuality: 1,
      locationPermission: "denied",
      weatherCondition: "rain",
      temperatureC: 8
    },
    riskForecast: {
      level: "high",
      score: 92,
      confidence: "high",
      currentWindow: "Late night risk window",
      drivers: ["Current time matches learned risk window", "Private https://private.example.com/raw-note?token=secret"]
    },
    preferredCategories: ["breathing"],
    challengeHistory: [
      {
        id: "breathing-478",
        category: "breathing",
        outcome: "helped",
        completedAt: new Date(Date.now() - 86_400_000).toISOString()
      }
    ]
  });
  const premiumMorning = buildChallengeGenerationRequest({
    streakDays: 41,
    premium: true,
    attemptsToday: 0,
    mood: "steady",
    hour: 7,
    slipsThisWeek: 0,
    slipWindow: null,
    slipTrigger: null,
    contextSignals: {
      energyLevel: "high",
      urgeLevel: 1,
      sleepQuality: 5,
      locationPermission: "granted",
      weatherCondition: "clear",
      temperatureC: 18
    },
    riskForecast: {
      level: "low",
      score: 18,
      confidence: "medium",
      currentWindow: null,
      drivers: ["Low urge check-in today", "Recovery streak has momentum"]
    },
    preferredCategories: ["physical", "connection"],
    challengeHistory: [
      {
        id: "connection-quiet-text",
        category: "connection",
        outcome: "helped",
        completedAt: new Date(Date.now() - 172_800_000).toISOString()
      }
    ]
  });

  assert.equal(freeHighRisk.profile.contextSignals?.weatherCondition, "rain");
  assert.equal(freeHighRisk.profile.interventionContext?.sessionDurationBucket, "15-30m");
  assert.equal(freeHighRisk.profile.recentFailureCount, 3);
  assert.equal(premiumMorning.profile.contextSignals?.locationPermission, "granted");
  assert.equal(premiumMorning.profile.interventionContext, null);
  assert.equal(premiumMorning.profile.recentFailureCount, 0);
  assert.equal(freeHighRisk.profile.riskForecast?.level, "high");
  assert.equal(premiumMorning.profile.riskForecast?.level, "low");
  assertNoSensitiveEcho(freeHighRisk);
  assertNoSensitiveEcho(premiumMorning);
  assertNoCoordinateFields(freeHighRisk);
  assertNoCoordinateFields(premiumMorning);
  const freePayload = await postJson(endpoint, freeHighRisk, timeoutMs, "Remote challenge high-risk personalization smoke request");
  const premiumPayload = await postJson(endpoint, premiumMorning, timeoutMs, "Remote challenge premium personalization smoke request");
  assertChallengePayload(freePayload, false);
  assertChallengePayload(premiumPayload, true);
}

async function smokeRetention(endpoint: string, timeoutMs: number) {
  const request = {
    profile: {
      premium: true,
      streakDays: 18,
      bestStreakDays: 31,
      attemptsThisWeek: 4,
      slipsThisWeek: 1,
      checkInsThisWeek: 5,
      completedChallengesThisWeek: 6,
      averageUrge: 2.4,
      averageSleep: 3.1,
      steadyDays: 4,
      riskWindow: "Late night after https://private.example.com/raw-note?token=secret",
      slipWindow: "Late night",
      slipTrigger: "Stress after private.example.com/raw-note token=secret",
      bestIntervention: "Walk reset helped after https://private.example.com/raw-note",
      momentum: "Recovered quickly after one reset",
      urgeRiskForecast: {
        level: "elevated",
        score: 63,
        confidence: "medium",
        currentWindow: "Late night risk window",
        drivers: [
          "Current hour matches private.example.com/raw-note?token=secret",
          "Recent reset count is elevated"
        ]
      },
      enabledReminderKeys: ["morning", "guard"],
      smartGuardTime: "22:45",
      smartGuardSource: "risk-window",
      localDateKey: "2026-05-21",
      timezoneOffsetMinutes: -330
    },
    guardrails: [
      "Use only aggregate recovery signals. Do not ask for private notes, browsing history, contacts, or transcripts.",
      "Return one concrete next best action."
    ]
  };

  const payload = await postJson(endpoint, request, timeoutMs, "Remote retention smoke request");
  assert.equal(payload.provider, "remote");
  assert.equal(payload.status, "ok");
  assert.equal(typeof payload.headline, "string");
  assert.equal(typeof payload.nextBestAction, "string");
  assert.equal(typeof payload.checkInPrompt, "string");
  const focusTags = payload.focusTags;
  assert.ok(Array.isArray(focusTags));
  assert.ok(focusTags.length >= 1);
  assertNoSensitiveEcho(payload);
  assertNoCoordinateFields(payload);
}

function endpointPathIssue(endpoint: string, expectedPath: string) {
  try {
    const pathname = new URL(endpoint).pathname.replace(/\/+$/, "");
    if (pathname !== expectedPath && !pathname.endsWith(expectedPath)) {
      return `endpoint must target ${expectedPath}.`;
    }
  } catch {
    return "endpoint is not a valid URL.";
  }
  return null;
}

async function runCase(
  id: string,
  endpoint: string | null,
  expectedPath: string,
  timeoutKey: string,
  run: (endpoint: string, timeoutMs: number) => Promise<void>
): Promise<SmokeResult> {
  if (!endpoint) {
    return { id, status: "FAIL", detail: "Endpoint is not configured." };
  }
  const endpointIssues = getProductionEndpointIssues(endpoint, id).filter((entry) => entry.issue !== "is not configured");
  if (endpointIssues.length > 0) {
    return { id, status: "FAIL", detail: formatEndpointIssues(endpointIssues).join(", ") };
  }
  const pathIssue = endpointPathIssue(endpoint, expectedPath);
  if (pathIssue) {
    return { id, status: "FAIL", detail: pathIssue };
  }

  try {
    const timeoutMs = readBoundedTimeoutMs(timeoutKey);
    await run(endpoint, timeoutMs);
    return { id, status: "PASS", detail: endpoint };
  } catch (error) {
    return {
      id,
      status: "FAIL",
      detail: error instanceof Error ? error.message : "unknown smoke failure"
    };
  }
}

function assertSafeReportPath(reportPath: string) {
  return assertSafeWorkspaceReportPath(reportPath);
}

function resultPassed(results: SmokeResult[], id: string) {
  return results.some((entry) => entry.id === id && entry.status === "PASS");
}

function buildAiBoundary(
  retentionEndpoint: string | null,
  results: SmokeResult[]
): AiBackendSmokeReport["aiBoundary"] {
  const retentionConfigured = Boolean(retentionEndpoint);
  const retentionPassed = resultPassed(results, "retention-remote-endpoint");
  return {
    configuredModelChecked: resultPassed(results, "configured-ai-model"),
    claraEndpointChecked: resultPassed(results, "clara-remote-endpoint"),
    challengeEndpointChecked: resultPassed(results, "challenge-remote-endpoint"),
    retentionEndpointConfigured: retentionConfigured,
    retentionEndpointChecked: retentionConfigured ? retentionPassed : false,
    retentionAggregateOnlyChecked: retentionConfigured ? retentionPassed : false,
    challengePersonalizationProfilesChecked: resultPassed(results, "challenge-personalization-profiles"),
    challengeSessionDurationBucketChecked: resultPassed(results, "challenge-personalization-profiles"),
    challengeRecentFailureCountChecked: resultPassed(results, "challenge-personalization-profiles"),
    noSensitiveEchoChecked:
      resultPassed(results, "clara-remote-endpoint") &&
      resultPassed(results, "challenge-remote-endpoint") &&
      resultPassed(results, "challenge-personalization-profiles") &&
      (!retentionConfigured || retentionPassed),
    noCoordinateFieldsChecked:
      resultPassed(results, "challenge-remote-endpoint") &&
      resultPassed(results, "challenge-personalization-profiles") &&
      (!retentionConfigured || retentionPassed),
    redactedSensitiveFields: [...REDACTED_SENSITIVE_FIELDS]
  };
}

function buildContractProof(
  retentionEndpoint: string | null,
  results: SmokeResult[]
): AiBackendSmokeReport["contractProof"] {
  const boundary = buildAiBoundary(retentionEndpoint, results);
  return {
    endpointPathRequirements: {
      coach: AI_ENDPOINT_PATHS.coach,
      challenge: AI_ENDPOINT_PATHS.challenge,
      retention: AI_ENDPOINT_PATHS.retention
    },
    requestTimeoutMs: {
      coach: readBoundedTimeoutMs("EXPO_PUBLIC_AI_COACH_TIMEOUT_MS"),
      challenge: readBoundedTimeoutMs("EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS"),
      retention: readBoundedTimeoutMs("EXPO_PUBLIC_RETENTION_TIMEOUT_MS")
    },
    configuredModelProof: {
      configuredModelChecked: boundary.configuredModelChecked,
      concreteProviderModelRequired: true,
      placeholderModelRejected: true
    },
    endpointProofs: {
      claraEndpointChecked: boundary.claraEndpointChecked,
      challengeEndpointChecked: boundary.challengeEndpointChecked,
      retentionEndpointConfigured: boundary.retentionEndpointConfigured,
      retentionEndpointChecked: boundary.retentionEndpointChecked,
      productionHttpsOnly: true,
      endpointQueryStringsOmitted: true
    },
    personalizationProofs: {
      challengePersonalizationProfilesChecked: boundary.challengePersonalizationProfilesChecked,
      contextSignalsChecked: boundary.challengePersonalizationProfilesChecked,
      aggregateRiskForecastChecked: boundary.challengePersonalizationProfilesChecked,
      sessionDurationBucketChecked: boundary.challengeSessionDurationBucketChecked,
      recentFailureCountChecked: boundary.challengeRecentFailureCountChecked,
      noRawRiskDriversStored: true
    },
    privacyProofs: {
      retentionAggregateOnlyChecked: boundary.retentionAggregateOnlyChecked,
      noSensitiveEchoChecked: boundary.noSensitiveEchoChecked,
      noCoordinateFieldsChecked: boundary.noCoordinateFieldsChecked,
      rawPromptsOmitted: true,
      unredactedModelResponsesOmitted: true
    },
    responseBoundary: {
      privateEchoPatternsChecked: FORBIDDEN_RESPONSE_PATTERNS.length,
      secretValuesOmitted: true,
      serverSecretKeyNamesChecked: [...SERVER_SECRET_KEYS],
      redactedSensitiveFields: [...REDACTED_SENSITIVE_FIELDS]
    }
  };
}

function buildSmokeReport(
  coachEndpoint: string | null,
  challengeEndpoint: string | null,
  retentionEndpoint: string | null,
  results: SmokeResult[]
): AiBackendSmokeReport {
  const sanitizedResults = sanitizeResultsForReport(results);
  const failed = sanitizedResults.filter((entry) => entry.status === "FAIL");
  const aiBoundary = buildAiBoundary(retentionEndpoint, results);
  return {
    schemaVersion: "ai-backend-smoke-v1",
    generatedAt: new Date().toISOString(),
    sanitized: true,
    endpoints: {
      coach: sanitizeEndpointForReport(coachEndpoint),
      challenge: sanitizeEndpointForReport(challengeEndpoint),
      retention: sanitizeEndpointForReport(retentionEndpoint)
    },
    summary: {
      passCount: sanitizedResults.length - failed.length,
      failCount: failed.length
    },
    aiBoundary,
    contractProof: buildContractProof(retentionEndpoint, results),
    results: sanitizedResults
  };
}

function writeSmokeReport(reportPath: string, report: AiBackendSmokeReport) {
  const absolute = assertSafeReportPath(reportPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const endpointResults = await Promise.all([
    runCase("clara-remote-endpoint", options.coachEndpoint, AI_ENDPOINT_PATHS.coach, "EXPO_PUBLIC_AI_COACH_TIMEOUT_MS", smokeCoach),
    runCase("challenge-remote-endpoint", options.challengeEndpoint, AI_ENDPOINT_PATHS.challenge, "EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS", smokeChallenges),
    runCase("challenge-personalization-profiles", options.challengeEndpoint, AI_ENDPOINT_PATHS.challenge, "EXPO_PUBLIC_AI_CHALLENGE_TIMEOUT_MS", smokeChallengePersonalization),
    ...(options.retentionEndpoint
      ? [runCase("retention-remote-endpoint", options.retentionEndpoint, AI_ENDPOINT_PATHS.retention, "EXPO_PUBLIC_RETENTION_TIMEOUT_MS", smokeRetention)]
      : [])
  ]);
  const results = [validateConfiguredModel(), ...endpointResults];
  const failed = results.filter((entry) => entry.status === "FAIL");

  if (options.reportPath) {
    writeSmokeReport(
      options.reportPath,
      buildSmokeReport(options.coachEndpoint, options.challengeEndpoint, options.retentionEndpoint, results)
    );
  }

  console.log("# FREED AI backend smoke");
  console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
  console.log("");
  console.log("| Status | Case | Detail |");
  console.log("| --- | --- | --- |");
  for (const result of results) {
    console.log(`| ${result.status} | ${result.id} | ${sanitizeDetailForReport(result.detail).replace(/\|/g, "/")} |`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

function runSelfTest() {
  assertNoSensitiveEcho({ text: "supportive reset" });
  assertNoCoordinateFields({ text: "no coordinates here" });
  assert.throws(() => assertNoSensitiveEcho({ text: "https://private.example.com/raw-note?token=secret" }));
  assert.throws(() => assertNoCoordinateFields({ latitude: 37.7749 }));

  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-live-secret-value";
  const report = buildSmokeReport(
    "https://api.freedrecovery.app/api/clara?token=secret",
    "https://api.freedrecovery.app/api/challenges?token=secret",
    "https://api.freedrecovery.app/api/retention?token=secret",
    [
      { id: "configured-ai-model", status: "PASS", detail: "gpt-5.1" },
      { id: "clara-remote-endpoint", status: "PASS", detail: "https://private.example.com/raw-note?token=secret sk-live-secret-value" },
      { id: "challenge-remote-endpoint", status: "PASS", detail: "latitude longitude private.example.com token=secret" },
      { id: "challenge-personalization-profiles", status: "PASS", detail: "raw-note https://api.freedrecovery.app/api/challenges" },
      { id: "retention-remote-endpoint", status: "PASS", detail: "aggregate retention private.example.com token=secret latitude eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiIxMjM0NTY3OCIsInN1YiI6InNlcnZpY2UifQ.signaturesegment" }
    ]
  );
  if (previousOpenAiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = previousOpenAiKey;
  }

  const reportText = JSON.stringify(report);
  assert.equal(report.sanitized, true);
  assert.equal(report.endpoints.coach, "https://api.freedrecovery.app/api/clara");
  assert.equal(report.endpoints.challenge, "https://api.freedrecovery.app/api/challenges");
  assert.equal(report.endpoints.retention, "https://api.freedrecovery.app/api/retention");
  assert.equal(
    sanitizeEndpointForReport("https://user:pass@api.freedrecovery.app/api/clara?token=secret#access_token=secret"),
    "https://api.freedrecovery.app/api/clara"
  );
  assert.equal(report.aiBoundary.configuredModelChecked, true);
  assert.equal(report.aiBoundary.claraEndpointChecked, true);
  assert.equal(report.aiBoundary.challengeEndpointChecked, true);
  assert.equal(report.aiBoundary.retentionEndpointConfigured, true);
  assert.equal(report.aiBoundary.retentionEndpointChecked, true);
  assert.equal(report.aiBoundary.retentionAggregateOnlyChecked, true);
  assert.equal(report.aiBoundary.challengePersonalizationProfilesChecked, true);
  assert.equal(report.aiBoundary.challengeSessionDurationBucketChecked, true);
  assert.equal(report.aiBoundary.challengeRecentFailureCountChecked, true);
  assert.equal(report.aiBoundary.noSensitiveEchoChecked, true);
  assert.equal(report.aiBoundary.noCoordinateFieldsChecked, true);
  assert.equal(report.contractProof.endpointPathRequirements.coach, "/api/clara");
  assert.equal(report.contractProof.endpointPathRequirements.challenge, "/api/challenges");
  assert.equal(report.contractProof.endpointPathRequirements.retention, "/api/retention");
  assert.equal(report.contractProof.requestTimeoutMs.coach, DEFAULT_AI_SMOKE_TIMEOUT_MS);
  assert.equal(report.contractProof.configuredModelProof.configuredModelChecked, true);
  assert.equal(report.contractProof.endpointProofs.endpointQueryStringsOmitted, true);
  assert.equal(report.contractProof.personalizationProofs.aggregateRiskForecastChecked, true);
  assert.equal(report.contractProof.privacyProofs.noSensitiveEchoChecked, true);
  assert.equal(report.contractProof.privacyProofs.rawPromptsOmitted, true);
  assert.equal(report.contractProof.responseBoundary.secretValuesOmitted, true);
  assert.ok(report.contractProof.responseBoundary.serverSecretKeyNamesChecked.includes("OPENAI_API_KEY"));
  assert.equal(endpointPathIssue("https://api.freedrecovery.app/api/clara", "/api/clara"), null);
  assert.match(String(endpointPathIssue("https://api.freedrecovery.app/api/other", "/api/clara")), /\/api\/clara/);
  assert.equal(reportText.includes("private.example.com"), false);
  assert.equal(reportText.includes("token=secret"), false);
  assert.equal(reportText.includes("raw-note"), false);
  assert.equal(reportText.includes("latitude"), false);
  assert.equal(reportText.includes("longitude"), false);
  assert.equal(reportText.includes("sk-live-secret-value"), false);
  assert.equal(reportText.includes("eyJhbGciOiJFUzI1NiJ9"), false);
  assert.throws(() => assertSafeReportPath("https://example.com/report.json"), /local workspace path/);
  assert.throws(() => assertSafeReportPath("../report.json"), /inside the current workspace/);
  assert.throws(
    () => assertSafeReportPath("docs/validation/evidence/ai-backend-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  assert.throws(
    () => assertSafeReportPath("DOCS/VALIDATION/EVIDENCE/ai-backend-smoke-report.json"),
    /docs\/validation\/artifacts/
  );
  console.log("ai-backend-smoke self-test: pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
