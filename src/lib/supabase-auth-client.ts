import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";

type Env = Record<string, string | undefined>;
type Fetcher = typeof fetch;

export type SupabaseAuthProvider = "apple" | "google";

export type SupabaseAuthConfig = {
  supabaseUrl: string | null;
  anonKey: string | null;
  redirectUrl: string | null;
};

export type SupabaseAuthReadiness = {
  ready: boolean;
  configured: boolean;
  missing: string[];
  dataBoundary: string;
};

export type SupabaseAuthActionResult = {
  ok: boolean;
  status: "sent" | "opened" | "unconfigured" | "invalid" | "error";
  reason?: string;
  url?: string;
};

const EXPO_PUBLIC_ENV_PREFIX = "EXPO_PUBLIC_";
const SUPABASE_ENV_PREFIX = "SUPABASE_";
const PUBLIC_SUPABASE_SECRET_KEY_SUFFIXES = [
  ["SERVICE", "ROLE", "KEY"],
  ["SERVICE", "ROLE"],
  ["JWT", "SECRET"],
  ["DB", "PASSWORD"]
] as const;
const PUBLIC_SUPABASE_SECRET_KEYS = PUBLIC_SUPABASE_SECRET_KEY_SUFFIXES.map(
  (parts) => EXPO_PUBLIC_ENV_PREFIX + SUPABASE_ENV_PREFIX + parts.join("_")
);
const FREED_AUTH_REDIRECT_SCHEMES = new Set(["freed:", "app.freed.recovery:"]);
const DEFAULT_SUPABASE_AUTH_TIMEOUT_MS = 8_000;
const MIN_SUPABASE_AUTH_TIMEOUT_MS = 500;
const MAX_SUPABASE_AUTH_TIMEOUT_MS = 15_000;
const DEFAULT_SUPABASE_AUTH_RESPONSE_MAX_BYTES = 128_000;
const MIN_SUPABASE_AUTH_RESPONSE_MAX_BYTES = 1_024;
const MAX_SUPABASE_AUTH_RESPONSE_MAX_BYTES = 1_000_000;

export function getSupabaseAuthConfig(env: Env = process.env): SupabaseAuthConfig {
  return {
    supabaseUrl: readEnv(env, "EXPO_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv(env, "EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    redirectUrl: readEnv(env, "EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL")
  };
}

export function getSupabaseAuthReadiness(env: Env = process.env): SupabaseAuthReadiness {
  const config = getSupabaseAuthConfig(env);
  const missing = [
    ...publicSecretLeaks(env),
    ...(!config.supabaseUrl ? ["EXPO_PUBLIC_SUPABASE_URL"] : supabaseAuthEndpointIssues(config.supabaseUrl)),
    ...(!config.anonKey ? ["EXPO_PUBLIC_SUPABASE_ANON_KEY"] : anonKeyIssues(config.anonKey)),
    ...(config.redirectUrl ? authRedirectIssues(config.redirectUrl) : [])
  ];
  const uniqueMissing = Array.from(new Set(missing.filter(Boolean))).sort();
  return {
    ready: uniqueMissing.length === 0,
    configured: Boolean(config.supabaseUrl || config.anonKey),
    missing: uniqueMissing,
    dataBoundary:
      "Supabase Auth uses the public project URL and anon key only. FREED stores a short-lived user access token locally for hosted encrypted backup sync; the service-role key, passphrase, and decrypted recovery state stay off the client."
  };
}

export async function requestSupabaseMagicLink(
  email: string,
  options: { env?: Env; redirectTo?: string | null; fetcher?: Fetcher } = {}
): Promise<SupabaseAuthActionResult> {
  const env = options.env ?? process.env;
  const readiness = getSupabaseAuthReadiness(env);
  if (!readiness.ready) {
    return { ok: false, status: "unconfigured", reason: readiness.missing.join("; ") };
  }

  const normalizedEmail = sanitizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, status: "invalid", reason: "Enter a valid account email address." };
  }

  const config = getSupabaseAuthConfig(env);
  const endpoint = supabaseAuthUrl(config.supabaseUrl, "/auth/v1/otp");
  if (!endpoint || !config.anonKey) {
    return { ok: false, status: "unconfigured", reason: "Supabase Auth is not configured." };
  }

  try {
    const timeoutMs = normalizeSupabaseAuthTimeoutMs(readSupabaseAuthTimeoutMs());
    const response = await fetchSupabaseAuthResponseWithTimeout(
      options.fetcher ?? fetch,
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`
        },
        body: JSON.stringify({
          email: normalizedEmail,
          create_user: true,
          ...(options.redirectTo ? { options: { email_redirect_to: options.redirectTo } } : {})
        })
      },
      timeoutMs
    );
    if (response.ok) return { ok: true, status: "sent" };
    const payload = await readBoundedResponseJson(response, {
      timeoutMs,
      maxBytes: normalizeSupabaseAuthResponseMaxBytes(readSupabaseAuthResponseMaxBytes()),
      label: "Supabase Auth response"
    }).catch(() => null);
    return {
      ok: false,
      status: "error",
      reason: sanitizeAuthError(payload) ?? `Supabase Auth returned ${response.status}.`
    };
  } catch {
    return { ok: false, status: "error", reason: "Supabase Auth request failed." };
  }
}

async function fetchSupabaseAuthResponseWithTimeout(
  fetcher: Fetcher,
  endpoint: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Supabase Auth request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(endpoint, {
        ...init,
        signal: controller?.signal
      }),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function buildSupabaseOAuthUrl(
  provider: SupabaseAuthProvider,
  options: { env?: Env; redirectTo?: string | null } = {}
): SupabaseAuthActionResult {
  if (provider !== "apple" && provider !== "google") {
    return { ok: false, status: "invalid", reason: "Unsupported Supabase Auth provider." };
  }
  const env = options.env ?? process.env;
  const readiness = getSupabaseAuthReadiness(env);
  if (!readiness.ready) {
    return { ok: false, status: "unconfigured", reason: readiness.missing.join("; ") };
  }

  const config = getSupabaseAuthConfig(env);
  const url = supabaseAuthUrl(config.supabaseUrl, "/auth/v1/authorize");
  if (!url || !config.anonKey) {
    return { ok: false, status: "unconfigured", reason: "Supabase Auth is not configured." };
  }
  const parsed = new URL(url);
  parsed.searchParams.set("provider", provider);
  if (options.redirectTo) parsed.searchParams.set("redirect_to", options.redirectTo);
  return { ok: true, status: "opened", url: parsed.toString() };
}

export function extractSupabaseAccessTokenFromUrl(url: string): string | null {
  if (!url.trim()) return null;
  try {
    const parsed = new URL(url);
    const candidates = [
      parsed.searchParams.get("access_token"),
      new URLSearchParams(parsed.hash.replace(/^#/, "")).get("access_token")
    ];
    const token = candidates.find((candidate) => candidate && isUsableSupabaseAccessToken(candidate));
    return token ?? null;
  } catch {
    return null;
  }
}

export function isUsableSupabaseAccessToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{16,4096}$/.test(value.trim());
}

function anonKeyIssues(value: string) {
  if (!isUsableSupabaseAccessToken(value)) return ["EXPO_PUBLIC_SUPABASE_ANON_KEY must be a Supabase public anon JWT"];
  if (/service[_-]?role|jwt[_-]?secret/i.test(value)) return ["EXPO_PUBLIC_SUPABASE_ANON_KEY must not contain service-role credentials"];
  const role = jwtRole(value);
  if (role && role !== "anon") return ["EXPO_PUBLIC_SUPABASE_ANON_KEY must use the anon role"];
  return [];
}

function supabaseAuthEndpointIssues(supabaseUrl: string) {
  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase Auth base URL").map((issue) => issue.issue);
  if (baseIssues.length > 0) return baseIssues;
  const endpoint = supabaseAuthUrl(supabaseUrl, "/auth/v1/user");
  return endpoint
    ? getProductionEndpointIssues(endpoint, "Supabase Auth endpoint").map((issue) => issue.issue)
    : ["EXPO_PUBLIC_SUPABASE_URL is not a valid Supabase URL"];
}

function authRedirectIssues(redirectUrl: string) {
  try {
    const parsed = new URL(redirectUrl);
    if (FREED_AUTH_REDIRECT_SCHEMES.has(parsed.protocol)) {
      const callbackPath = parsed.hostname === "auth" && parsed.pathname === "/callback";
      const tripleSlashCallback = !parsed.hostname && parsed.pathname === "/auth/callback";
      return callbackPath || tripleSlashCallback ? [] : ["EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL must target the FREED auth callback path"];
    }
    return getProductionEndpointIssues(redirectUrl, "Supabase Auth redirect URL").map((issue) => issue.issue);
  } catch {
    return ["EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL is not a valid redirect URL"];
  }
}

function supabaseAuthUrl(supabaseUrl: string | null, path: string) {
  if (!supabaseUrl) return null;
  try {
    return new URL(path, supabaseUrl).toString();
  } catch {
    return null;
  }
}

function publicSecretLeaks(env: Env) {
  return PUBLIC_SUPABASE_SECRET_KEYS.filter((key) => readEnv(env, key)).map(
    (key) => `server secret must not be public: ${key}`
  );
}

function sanitizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) && normalized.length <= 254 ? normalized : null;
}

function sanitizeAuthError(value: unknown) {
  if (!isRecord(value)) return null;
  const message = [value.msg, value.error_description, value.error]
    .find((entry) => typeof entry === "string" && entry.trim());
  return typeof message === "string" ? message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]").slice(0, 160) : null;
}

function jwtRole(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const payload = decodeBase64UrlJson(parts[1]);
  return isRecord(payload) && typeof payload.role === "string" ? payload.role : null;
}

function decodeBase64UrlJson(value: string): unknown {
  try {
    const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
    const decoded = globalThis.atob?.(padded);
    return decoded ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
}

function readSupabaseAuthTimeoutMs() {
  return process.env.EXPO_PUBLIC_SUPABASE_AUTH_TIMEOUT_MS?.trim() ?? "";
}

function readSupabaseAuthResponseMaxBytes() {
  return process.env.EXPO_PUBLIC_SUPABASE_AUTH_RESPONSE_MAX_BYTES?.trim() ?? "";
}

function normalizeSupabaseAuthTimeoutMs(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SUPABASE_AUTH_TIMEOUT_MS;
  return Math.max(MIN_SUPABASE_AUTH_TIMEOUT_MS, Math.min(MAX_SUPABASE_AUTH_TIMEOUT_MS, Math.round(parsed)));
}

function normalizeSupabaseAuthResponseMaxBytes(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SUPABASE_AUTH_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_SUPABASE_AUTH_RESPONSE_MAX_BYTES,
    Math.min(MAX_SUPABASE_AUTH_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
