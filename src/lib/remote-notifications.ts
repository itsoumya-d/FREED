import { createSign, timingSafeEqual } from "node:crypto";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import {
  isApnsEnvironment,
  isAppleKeyId,
  isAppleTeamId,
  isBundleId,
  isFcmServerKey,
  isFirebaseProjectId,
  isGoogleAccessToken,
  isGoogleServiceAccountEmail,
  isPlaceholderValue,
  isPrivateKeyPem,
  isServerSecret
} from "@/lib/server-credential-safety";

type Env = Record<string, string | undefined>;
type Fetcher = typeof fetch;

const DEFAULT_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS = 8_000;
const MIN_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS = 500;
const MAX_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS = 15_000;
const DEFAULT_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES = 512_000;
const MIN_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES = 1_024;
const MAX_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES = 2_000_000;

export type RemoteNotificationPlatform = "ios" | "android";
export type RemoteNotificationKind =
  | "morning-checkin"
  | "evening-reflection"
  | "night-guard"
  | "challenge-followup"
  | "streak-encouragement";

export type RemoteNotificationRoute = "checkin";

export type RemoteNotificationRequest = {
  platform: RemoteNotificationPlatform;
  token: string;
  kind: RemoteNotificationKind;
};

export type SafeRemoteNotificationPayload = {
  title: string;
  body: string;
  data: {
    route: RemoteNotificationRoute;
    kind: RemoteNotificationKind;
  };
};

export type RemoteNotificationResult = {
  sent: boolean;
  provider: "fcm" | "apns" | "custom" | "fallback";
  status: "ok" | "invalid" | "unauthorized" | "unconfigured" | "failed";
  platform?: RemoteNotificationPlatform;
  kind?: RemoteNotificationKind;
  reason?: string;
};

export type RemoteNotificationProvider = (
  request: RemoteNotificationRequest,
  payload: SafeRemoteNotificationPayload
) => Promise<RemoteNotificationResult> | RemoteNotificationResult;

let remoteNotificationProvider: RemoteNotificationProvider | null = null;

const allowedKinds: RemoteNotificationKind[] = [
  "morning-checkin",
  "evening-reflection",
  "night-guard",
  "challenge-followup",
  "streak-encouragement"
];

const allowedRequestKeys = new Set(["platform", "token", "kind"]);

const forbiddenPayloadKeys = new Set([
  "title",
  "body",
  "message",
  "copy",
  "rawUrl",
  "url",
  "urls",
  "host",
  "hosts",
  "domain",
  "domains",
  "privateNotes",
  "note",
  "notes",
  "transcript",
  "receipt",
  "purchaseToken",
  "preciseLocation",
  "coordinates",
  "screenshot",
  "apiKey"
]);

const FCM_DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9:_-]{20,4096}$/;
const APNS_DEVICE_TOKEN_PATTERN = /^[A-Fa-f0-9]{64}$/;

export function configureRemoteNotificationProvider(provider: RemoteNotificationProvider | null) {
  remoteNotificationProvider = provider;
}

export function validateRemoteNotificationAuth(request: Request, env: Env = process.env) {
  const secret = readEnv(env, "REMOTE_NOTIFICATION_DISPATCH_SECRET");
  if (!secret || !isServerSecret(secret)) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return safeTokenEquals(token, secret);
}

export function sanitizeRemoteNotificationRequest(value: unknown): RemoteNotificationRequest | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyAllowedRequestKeys(value)) return null;
  if (containsForbiddenPayloadKey(value)) return null;

  const platform = value.platform === "ios" || value.platform === "android" ? value.platform : null;
  const kind = allowedKinds.includes(value.kind as RemoteNotificationKind) ? (value.kind as RemoteNotificationKind) : null;
  if (!platform || !kind) return null;
  const token = normalizeDeviceToken(platform, typeof value.token === "string" ? value.token : "");
  if (!token) return null;

  return { platform, token, kind };
}

export function buildSafeRemoteNotificationPayload(kind: RemoteNotificationKind): SafeRemoteNotificationPayload {
  const copy = notificationCopy[kind];
  return {
    title: copy.title,
    body: copy.body,
    data: {
      route: "checkin",
      kind
    }
  };
}

export async function sendRemoteNotification(
  value: unknown,
  options: { env?: Env; fetcher?: Fetcher } = {}
): Promise<RemoteNotificationResult> {
  const request = sanitizeRemoteNotificationRequest(value);
  if (!request) {
    return {
      sent: false,
      provider: "fallback",
      status: "invalid",
      reason: "Remote notification payload must contain only platform, token, and a supported recovery-safe kind."
    };
  }

  const payload = buildSafeRemoteNotificationPayload(request.kind);
  if (remoteNotificationProvider) return safeResult(await remoteNotificationProvider(request, payload), request);

  return request.platform === "android"
    ? sendFcmNotification(request, payload, options)
    : sendApnsNotification(request, payload, options);
}

async function sendFcmNotification(
  request: RemoteNotificationRequest,
  payload: SafeRemoteNotificationPayload,
  options: { env?: Env; fetcher?: Fetcher }
): Promise<RemoteNotificationResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const legacyKey = readEnv(env, "FCM_SERVER_KEY");
  const timeoutMs = readRemoteNotificationProviderTimeoutMs(env);
  const responseMaxBytes = readRemoteNotificationProviderResponseMaxBytes(env);

  if (isFcmServerKey(legacyKey)) {
    let response: Response;
    try {
      response = await fetchNotificationProviderResponse(
        fetcher,
        "https://fcm.googleapis.com/fcm/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${legacyKey}`
          },
          body: JSON.stringify({
            to: request.token,
            notification: {
              title: payload.title,
              body: payload.body
            },
            data: payload.data
          })
        },
        timeoutMs,
        "FCM legacy notification request"
      );
    } catch (error) {
      return failed("fcm", request, error instanceof Error ? error.message : "FCM notification request failed.");
    }
    if (!response.ok) return failed("fcm", request, `FCM returned ${response.status}.`);
    return ok("fcm", request);
  }

  let accessToken: string | null = null;
  try {
    accessToken = await createFirebaseAccessToken(env, fetcher, timeoutMs, responseMaxBytes);
  } catch (error) {
    return failed("fcm", request, error instanceof Error ? error.message : "Firebase access-token request failed.");
  }
  const serviceAccount = readFirebaseServiceAccount(env);
  const projectId = readFirebaseProjectId(env, serviceAccount);
  if (!accessToken || !isFirebaseProjectId(projectId)) return unconfigured("fcm", request, "FCM server credential is not configured.");
  const firebaseProjectId = projectId ?? "";

  let response: Response;
  try {
    response = await fetchNotificationProviderResponse(
      fetcher,
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(firebaseProjectId)}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: {
            token: request.token,
            notification: {
              title: payload.title,
              body: payload.body
            },
            data: payload.data
          }
        })
      },
      timeoutMs,
      "FCM v1 notification request"
    );
  } catch (error) {
    return failed("fcm", request, error instanceof Error ? error.message : "FCM notification request failed.");
  }
  if (!response.ok) return failed("fcm", request, `FCM returned ${response.status}.`);
  return ok("fcm", request);
}

async function sendApnsNotification(
  request: RemoteNotificationRequest,
  payload: SafeRemoteNotificationPayload,
  options: { env?: Env; fetcher?: Fetcher }
): Promise<RemoteNotificationResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = readRemoteNotificationProviderTimeoutMs(env);
  const jwt = createApnsJwt(env);
  const bundleId = readEnv(env, "APNS_BUNDLE_ID");
  if (!jwt || !isBundleId(bundleId) || !isApnsEnvironment(readEnv(env, "APNS_ENV"))) {
    return unconfigured("apns", request, "APNs signing credential is not configured.");
  }
  const apnsBundleId = bundleId ?? "";

  const host = readEnv(env, "APNS_ENV") === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  let response: Response;
  try {
    response = await fetchNotificationProviderResponse(
      fetcher,
      `https://${host}/3/device/${encodeURIComponent(request.token)}`,
      {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": apnsBundleId,
          "apns-push-type": "alert",
          "apns-priority": "5",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          aps: {
            alert: {
              title: payload.title,
              body: payload.body
            },
            sound: null,
            badge: 0
          },
          ...payload.data
        })
      },
      timeoutMs,
      "APNs notification request"
    );
  } catch (error) {
    return failed("apns", request, error instanceof Error ? error.message : "APNs notification request failed.");
  }
  if (!response.ok) return failed("apns", request, `APNs returned ${response.status}.`);
  return ok("apns", request);
}

function safeResult(result: RemoteNotificationResult, request: RemoteNotificationRequest): RemoteNotificationResult {
  return {
    sent: Boolean(result.sent),
    provider: result.provider,
    status: result.status,
    platform: request.platform,
    kind: request.kind,
    reason: sanitizeNotificationReason(result.reason ?? "", 200) || undefined
  };
}

function ok(provider: "fcm" | "apns", request: RemoteNotificationRequest): RemoteNotificationResult {
  return {
    sent: true,
    provider,
    status: "ok",
    platform: request.platform,
    kind: request.kind
  };
}

function failed(provider: "fcm" | "apns", request: RemoteNotificationRequest, reason: string): RemoteNotificationResult {
  return {
    sent: false,
    provider,
    status: "failed",
    platform: request.platform,
    kind: request.kind,
    reason: sanitizeNotificationReason(reason, 200)
  };
}

function unconfigured(provider: "fcm" | "apns", request: RemoteNotificationRequest, reason: string): RemoteNotificationResult {
  return {
    sent: false,
    provider,
    status: "unconfigured",
    platform: request.platform,
    kind: request.kind,
    reason
  };
}

const notificationCopy: Record<RemoteNotificationKind, { title: string; body: string }> = {
  "morning-checkin": {
    title: "FREED morning reset",
    body: "One minute to set the tone before the day starts moving."
  },
  "evening-reflection": {
    title: "FREED evening reflection",
    body: "Check in, lower stimulation, and make tonight easier."
  },
  "night-guard": {
    title: "FREED night guard",
    body: "Phone away, lights low, one clean choice at a time."
  },
  "challenge-followup": {
    title: "FREED reset check",
    body: "Take one steady breath and mark how the reset landed."
  },
  "streak-encouragement": {
    title: "FREED streak support",
    body: "Your next clean choice counts. Check in for a quick reset."
  }
};

function createApnsJwt(env: Env) {
  const keyId = readEnv(env, "APNS_KEY_ID");
  const teamId = readEnv(env, "APNS_TEAM_ID");
  const privateKey = readPrivateKey(env, "APNS_PRIVATE_KEY", "APNS_PRIVATE_KEY_BASE64");
  if (!keyId || !teamId || !privateKey || !isAppleKeyId(keyId) || !isAppleTeamId(teamId) || !isPrivateKeyPem(privateKey)) return null;
  const now = Math.floor(Date.now() / 1000);
  try {
    return signJwt({ alg: "ES256", kid: keyId }, { iss: teamId, iat: now }, privateKey, "ES256");
  } catch {
    return null;
  }
}

async function createFirebaseAccessToken(env: Env, fetcher: Fetcher, timeoutMs: number, responseMaxBytes: number) {
  const directAccessToken = readEnv(env, "FCM_ACCESS_TOKEN");
  if (isGoogleAccessToken(directAccessToken)) return directAccessToken;

  const serviceAccount = readFirebaseServiceAccount(env);
  const clientEmail = serviceAccount ? stringValue(serviceAccount.client_email) : null;
  const privateKey = serviceAccount ? normalizePrivateKey(stringValue(serviceAccount.private_key, 8_000)) : null;
  if (!clientEmail || !privateKey || !isGoogleServiceAccountEmail(clientEmail) || !isPrivateKeyPem(privateKey)) return null;

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    },
    privateKey,
    "RS256"
  );

  const response = await fetchNotificationProviderResponse(
    fetcher,
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    },
    timeoutMs,
    "Firebase access-token request"
  );
  if (!response.ok) return null;
  const payload = await readNotificationProviderJson(response, timeoutMs, "Firebase access-token response", responseMaxBytes).catch(() => null);
  return isRecord(payload) ? stringValue(payload.access_token, 4_000) : null;
}

function readFirebaseServiceAccount(env: Env) {
  const raw = readEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON");
  const encoded = readEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
  const value = raw ?? (encoded ? Buffer.from(encoded, "base64").toString("utf8") : null);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readFirebaseProjectId(env: Env, serviceAccount: Record<string, unknown> | null) {
  return readEnv(env, "FIREBASE_PROJECT_ID") ?? (serviceAccount ? stringValue(serviceAccount.project_id) : null);
}

function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string, algorithm: "ES256" | "RS256") {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  const joseSignature = algorithm === "ES256" ? derEcdsaToJose(signature) : signature;
  return `${signingInput}.${base64Url(joseSignature)}`;
}

function derEcdsaToJose(signature: Buffer, partLength = 32) {
  let offset = 0;
  if (signature[offset++] !== 0x30) throw new Error("Invalid ECDSA signature.");
  const sequenceLength = signature[offset++];
  if (sequenceLength + offset !== signature.length) throw new Error("Invalid ECDSA signature length.");
  if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA signature R marker.");
  const rLength = signature[offset++];
  let r = signature.subarray(offset, offset + rLength);
  offset += rLength;
  if (signature[offset++] !== 0x02) throw new Error("Invalid ECDSA signature S marker.");
  const sLength = signature[offset++];
  let s = signature.subarray(offset, offset + sLength);

  while (r.length > partLength && r[0] === 0) r = r.subarray(1);
  while (s.length > partLength && s[0] === 0) s = s.subarray(1);
  if (r.length > partLength || s.length > partLength) throw new Error("Invalid ECDSA signature component length.");
  return Buffer.concat([Buffer.alloc(partLength - r.length), r, Buffer.alloc(partLength - s.length), s]);
}

async function fetchNotificationProviderResponse(
  fetcher: Fetcher,
  input: Parameters<Fetcher>[0],
  init: Parameters<Fetcher>[1],
  timeoutMs: number,
  label: string
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(input, { ...(init ?? {}), signal: controller.signal }),
      timeout
    ]);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function readNotificationProviderJson(
  response: Response,
  timeoutMs: number,
  label: string,
  maxBytes: number
): Promise<unknown> {
  return readBoundedResponseJson(response, { timeoutMs, maxBytes, label });
}

function readRemoteNotificationProviderTimeoutMs(env: Env) {
  return normalizeRemoteNotificationProviderTimeoutMs(readEnv(env, "FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS"));
}

function readRemoteNotificationProviderResponseMaxBytes(env: Env) {
  return normalizeRemoteNotificationProviderResponseMaxBytes(readEnv(env, "FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES"));
}

function normalizeRemoteNotificationProviderTimeoutMs(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS;
  return Math.min(MAX_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS, Math.max(MIN_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS, Math.floor(parsed)));
}

function normalizeRemoteNotificationProviderResponseMaxBytes(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES;
  return Math.min(
    MAX_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES,
    Math.max(MIN_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES, Math.floor(parsed))
  );
}

function containsForbiddenPayloadKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPayloadKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => forbiddenPayloadKeys.has(key) || containsForbiddenPayloadKey(child));
}

function hasOnlyAllowedRequestKeys(value: Record<string, unknown>) {
  return Object.keys(value).every((key) => allowedRequestKeys.has(key));
}

function normalizeDeviceToken(platform: RemoteNotificationPlatform, value: string) {
  const token = value.trim();
  if (!token || token.length > 4_096 || isPlaceholderValue(token)) return null;
  if (/https?:\/\//i.test(token) || /[.@/\s]/.test(token)) return null;

  if (platform === "ios") {
    return APNS_DEVICE_TOKEN_PATTERN.test(token) ? token.toLowerCase() : null;
  }

  return FCM_DEVICE_TOKEN_PATTERN.test(token) ? token : null;
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function sanitizeNotificationReason(value: string, maxLength: number) {
  return cleanText(value, maxLength)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b[A-Fa-f0-9]{64}\b/g, "[redacted-apns-token]")
    .replace(/\b[A-Za-z0-9:_-]{20,4096}\b/g, (match) =>
      /^(?:fcm|apns|token|secret|key|ya29|AAAA)/i.test(match) || match.includes(":")
        ? "[redacted-token]"
        : match
    )
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi, "[redacted-domain]")
    .slice(0, maxLength);
}

function stringValue(value: unknown, maxLength = 512) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function normalizePrivateKey(value: string | null) {
  return value?.replace(/\\n/g, "\n") ?? null;
}

function readPrivateKey(env: Env, key: string, base64Key: string) {
  const direct = normalizePrivateKey(readEnv(env, key));
  if (direct) return direct;
  const encoded = readEnv(env, base64Key);
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function base64Url(input: string | Buffer) {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function safeTokenEquals(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}
