import { readBoundedResponseJson } from "@/lib/bounded-response-json";

export type BackendProviderTimeoutEnv = Record<string, string | undefined>;

export const DEFAULT_BACKEND_PROVIDER_TIMEOUT_MS = 8_000;
export const MIN_BACKEND_PROVIDER_TIMEOUT_MS = 500;
export const MAX_BACKEND_PROVIDER_TIMEOUT_MS = 15_000;
export const DEFAULT_BACKEND_PROVIDER_RESPONSE_MAX_BYTES = 1_000_000;
export const MIN_BACKEND_PROVIDER_RESPONSE_MAX_BYTES = 1_024;
export const MAX_BACKEND_PROVIDER_RESPONSE_MAX_BYTES = 5_000_000;

export function readBackendProviderTimeoutMs(env: BackendProviderTimeoutEnv = process.env) {
  return normalizeBackendProviderTimeoutMs(readEnv(env, "FREED_BACKEND_PROVIDER_TIMEOUT_MS"));
}

export function readBackendProviderResponseMaxBytes(env: BackendProviderTimeoutEnv = process.env) {
  return normalizeBackendProviderResponseMaxBytes(readEnv(env, "FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES"));
}

export async function fetchBackendProviderResponse(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number,
  label: string
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(input, { ...(init ?? {}), ...(controller ? { signal: controller.signal } : {}) }),
      timedOut
    ]);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function readBackendProviderJson(
  response: Response,
  timeoutMs: number,
  label: string,
  maxBytes = readBackendProviderResponseMaxBytes()
): Promise<unknown> {
  return readBoundedResponseJson(response, { timeoutMs, maxBytes, label });
}

export function normalizeBackendProviderTimeoutMs(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BACKEND_PROVIDER_TIMEOUT_MS;
  return Math.max(MIN_BACKEND_PROVIDER_TIMEOUT_MS, Math.min(MAX_BACKEND_PROVIDER_TIMEOUT_MS, Math.round(parsed)));
}

export function normalizeBackendProviderResponseMaxBytes(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BACKEND_PROVIDER_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_BACKEND_PROVIDER_RESPONSE_MAX_BYTES,
    Math.min(MAX_BACKEND_PROVIDER_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}

function readEnv(env: BackendProviderTimeoutEnv, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}
