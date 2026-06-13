export type BoundedResponseJsonLike = {
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  body?: ReadableStream<Uint8Array> | null;
  headers?: Pick<Headers, "get">;
};

export type BoundedResponseJsonOptions = {
  timeoutMs: number;
  maxBytes: number;
  label: string;
  abort?: () => void;
};

const textEncoder = new TextEncoder();

export async function readBoundedResponseJson(
  response: BoundedResponseJsonLike,
  options: BoundedResponseJsonOptions
): Promise<unknown> {
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs));
  const maxBytes = Math.max(1, Math.floor(options.maxBytes));
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      abortSafely(options.abort);
      reject(new Error(`${options.label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      readResponseJsonWithByteLimit(response, maxBytes, options.label, options.abort),
      timedOut
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readResponseJsonWithByteLimit(
  response: BoundedResponseJsonLike,
  maxBytes: number,
  label: string,
  abort?: () => void
) {
  const contentLength = parseContentLength(response.headers?.get("content-length") ?? null);
  if (contentLength !== null && contentLength > maxBytes) {
    abortSafely(abort);
    throw responseTooLargeError(label, maxBytes);
  }

  if (response.body && typeof response.body.getReader === "function") {
    const text = await readResponseBodyText(response.body, maxBytes, label, abort);
    return JSON.parse(text);
  }

  if (typeof response.text === "function") {
    const text = await response.text();
    if (byteLength(text) > maxBytes) {
      abortSafely(abort);
      throw responseTooLargeError(label, maxBytes);
    }
    return JSON.parse(text);
  }

  abortSafely(abort);
  throw new Error(`${label} cannot be size-checked because the response body is not readable.`);
}

async function readResponseBodyText(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  label: string,
  abort?: () => void
) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        abortSafely(abort);
        await reader.cancel().catch(() => null);
        throw responseTooLargeError(label, maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function parseContentLength(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function byteLength(value: string) {
  return textEncoder.encode(value).byteLength;
}

function responseTooLargeError(label: string, maxBytes: number) {
  return new Error(`${label} exceeds ${maxBytes} bytes.`);
}

function abortSafely(abort?: () => void) {
  try {
    abort?.();
  } catch {
    // Best-effort cancellation only; preserve the original timeout/size failure.
  }
}
