import { readBoundedResponseJson } from "@/lib/bounded-response-json";

export const DEFAULT_REMOTE_PROVIDER_RESPONSE_MAX_BYTES = 5_000_000;

export async function fetchRemoteProviderJson(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number,
  label: string,
  maxBytes = DEFAULT_REMOTE_PROVIDER_RESPONSE_MAX_BYTES
): Promise<unknown> {
  const response = await fetchRemoteProviderResponse(input, init, timeoutMs, label);
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  return readRemoteProviderJson(response, timeoutMs, `${label} response`, maxBytes);
}

export async function fetchRemoteProviderResponse(
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

export async function readRemoteProviderJson(
  response: Response,
  timeoutMs: number,
  label: string,
  maxBytes = DEFAULT_REMOTE_PROVIDER_RESPONSE_MAX_BYTES
): Promise<unknown> {
  return readBoundedResponseJson(response, { timeoutMs, maxBytes, label });
}
