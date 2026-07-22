import { randomUUID } from "node:crypto";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type Transaction } from "firebase-admin/firestore";
import { getRemoteConfig } from "firebase-admin/remote-config";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  AiAccessError,
  AiInputError,
  createAiService,
  type AiAuditEvent,
  type AiFeatureGate,
  type AiRoute
} from "./ai.js";
import { COLLECTIONS, validateServerDocument } from "./contracts.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";

if (!getApps().length) initializeApp();

const db = getFirestore();
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const REGION = "asia-south1";
const RATE_WINDOW_MS = 60 * 1_000;
const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const AI_GATE_CACHE_TTL_MS = 60 * 1_000;
const AI_REMOTE_CONFIG_TIMEOUT_MS = 2_000;

export const AI_REMOTE_CONFIG_PARAMETERS = Object.freeze({
  clara: "ai_clara_enabled",
  challenges: "ai_challenges_enabled",
  retention: "ai_retention_enabled"
} satisfies Record<AiRoute, string>);

type RemoteConfigTemplateLike = {
  parameters?: Record<string, { defaultValue?: { value?: unknown } }>;
};

/** Strictly accepts only literal server-template booleans. */
export function readAiFeatureGateTemplate(template: unknown, route: AiRoute): AiFeatureGate {
  if (!isRecord(template) || !isRecord(template.parameters)) return "unavailable";
  const parameter = template.parameters[AI_REMOTE_CONFIG_PARAMETERS[route]];
  if (!isRecord(parameter) || !isRecord(parameter.defaultValue)) return "unavailable";
  const value = parameter.defaultValue.value;
  if (value === "true") return "enabled";
  if (value === "false") return "disabled";
  return "unavailable";
}

/**
 * A successful template is cached for one minute. Once it expires, fetch or
 * validation failure returns unavailable rather than using stale state.
 */
export function createAiFeatureGateReader(
  fetchTemplate: () => Promise<RemoteConfigTemplateLike>,
  now: () => number,
  cacheTtlMs = AI_GATE_CACHE_TTL_MS,
  fetchTimeoutMs = AI_REMOTE_CONFIG_TIMEOUT_MS
) {
  let cached: { expiresAt: number; gates: Record<AiRoute, AiFeatureGate> } | null = null;
  return async (route: AiRoute): Promise<AiFeatureGate> => {
    const currentTime = now();
    if (cached && cached.expiresAt > currentTime) return cached.gates[route];
    try {
      const template = await withHardTimeout(fetchTemplate(), fetchTimeoutMs);
      const gates = {
        clara: readAiFeatureGateTemplate(template, "clara"),
        challenges: readAiFeatureGateTemplate(template, "challenges"),
        retention: readAiFeatureGateTemplate(template, "retention")
      };
      if (Object.values(gates).includes("unavailable")) {
        cached = null;
        return "unavailable";
      }
      cached = { expiresAt: currentTime + cacheTtlMs, gates };
      return gates[route];
    } catch {
      cached = null;
      return "unavailable";
    }
  };
}

async function withHardTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Remote Config unavailable.")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const getFeatureGate = createAiFeatureGateReader(
  () => getRemoteConfig().getTemplate() as Promise<RemoteConfigTemplateLike>,
  () => Date.now()
);

const service = createAiService({
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  getFeatureGate,
  getApiKey: () => OPENAI_API_KEY.value(),
  authorize: authorizeAiCall,
  persistEvent: persistAiEvent
});

export const generateClaraReply = onCall(
  { region: REGION, enforceAppCheck: true, secrets: [OPENAI_API_KEY] },
  async (request) => {
    const uid = requireAuthenticatedUid(request.auth?.uid);
    try {
      return await service.generateClara(uid, request.data);
    } catch (error) {
      throw publicHttpsError(error);
    }
  }
);

export const generateChallenges = onCall(
  { region: REGION, enforceAppCheck: true, secrets: [OPENAI_API_KEY] },
  async (request) => {
    const uid = requireAuthenticatedUid(request.auth?.uid);
    try {
      return await service.generateChallenges(uid, request.data);
    } catch (error) {
      throw publicHttpsError(error);
    }
  }
);

export const generateRetentionPlan = onCall(
  { region: REGION, enforceAppCheck: true, secrets: [OPENAI_API_KEY] },
  async (request) => {
    const uid = requireAuthenticatedUid(request.auth?.uid);
    try {
      return await service.generateRetentionPlan(uid, request.data);
    } catch (error) {
      throw publicHttpsError(error);
    }
  }
);

async function authorizeAiCall(input: {
  uid: string;
  route: AiRoute;
  clientEventId: string;
  perMinute: number;
}) {
  return db.runTransaction(async (transaction) => {
    const result = await runProtectedMutation(firestoreStore(transaction), {
      rateLimitPath: `${COLLECTIONS.rateLimits}/${input.uid}_ai-${input.route}`,
      idempotencyPath: `${COLLECTIONS.idempotency}/${input.uid}_ai-${input.route}_${input.clientEventId}`,
      accountTombstonePath: `${COLLECTIONS.deletionTombstones}/${input.uid}`,
      now: Date.now(),
      windowMs: RATE_WINDOW_MS,
      limit: input.perMinute,
      idempotencyTtlMs: IDEMPOTENCY_TTL_MS
    }, () => undefined);
    if (result === "applied") return "allowed" as const;
    return result;
  });
}

function firestoreStore(transaction: Transaction): TransactionalStore {
  return {
    async get<T extends object>(path: string) {
      const snapshot = await transaction.get(db.doc(path));
      return { value: snapshot.exists ? snapshot.data() as T : undefined };
    },
    async set(path: string, value: object) {
      const [collection] = path.split("/");
      transaction.set(db.doc(path), validateServerDocument(collection ?? "", value));
    }
  };
}

async function persistAiEvent(event: AiAuditEvent): Promise<void> {
  const document: Record<string, unknown> = {
    uid: event.uid,
    eventType: event.eventType,
    outcome: event.outcome,
    provider: event.provider,
    model: event.model,
    crisisFallback: event.crisisFallback,
    inputCharacterCount: event.inputCharacterCount,
    createdAt: Timestamp.fromMillis(event.createdAt),
    expiresAt: Timestamp.fromMillis(event.expiresAt)
  };
  if (event.outputCharacterCount !== undefined) document.outputCharacterCount = event.outputCharacterCount;
  if (event.generatedItemCount !== undefined) document.generatedItemCount = event.generatedItemCount;
  const eventReference = db.collection(COLLECTIONS.redactedAiEvents).doc(randomUUID());
  const tombstoneReference = db.collection(COLLECTIONS.deletionTombstones).doc(event.uid);
  await db.runTransaction(async (transaction) => {
    const tombstone = await transaction.get(tombstoneReference);
    if (tombstone.exists) return;
    transaction.set(eventReference, validateServerDocument(COLLECTIONS.redactedAiEvents, document));
  });
}

function publicHttpsError(error: unknown): HttpsError {
  if (error instanceof AiInputError) {
    return new HttpsError("invalid-argument", "The callable payload is not permitted.");
  }
  if (error instanceof AiAccessError && error.reason === "rate-limited") {
    return new HttpsError("resource-exhausted", "Try again shortly.");
  }
  if (error instanceof AiAccessError && error.reason === "account-deleting") {
    return new HttpsError("failed-precondition", "This account is being deleted.");
  }
  return new HttpsError("internal", "The AI service is temporarily unavailable.");
}

function requireAuthenticatedUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  return uid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
