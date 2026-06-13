export type BoundedJsonBodyErrorStatus = 400 | 413 | 415;

export type BoundedJsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: BoundedJsonBodyErrorStatus; reason: string };

type ReadBoundedJsonBodyOptions = {
  maxBytes: number;
  routeLabel: string;
};

const textEncoder = new TextEncoder();

function byteLength(value: string) {
  return textEncoder.encode(value).length;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) {
    return `${bytes / (1024 * 1024)} MiB`;
  }
  if (bytes >= 1024 && bytes % 1024 === 0) {
    return `${bytes / 1024} KiB`;
  }
  return `${bytes} bytes`;
}

function isJsonContentType(value: string | null) {
  if (!value) return false;
  const mediaType = value.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}

function readContentLength(headers: Headers) {
  const raw = headers.get("content-length");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== raw.trim()) {
    return Number.NaN;
  }
  return parsed;
}

export async function readBoundedJsonBody(
  request: Request,
  options: ReadBoundedJsonBodyOptions
): Promise<BoundedJsonBodyResult> {
  const maxBytes = Math.max(1, Math.floor(options.maxBytes));
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      status: 415,
      reason: `${options.routeLabel} body must use application/json.`
    };
  }

  const contentLength = readContentLength(request.headers);
  if (Number.isNaN(contentLength)) {
    return {
      ok: false,
      status: 400,
      reason: "Invalid Content-Length header."
    };
  }
  if (contentLength !== null && contentLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      reason: `${options.routeLabel} body exceeds the ${formatBytes(maxBytes)} limit.`
    };
  }

  let text = "";
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      status: 400,
      reason: "Malformed JSON body."
    };
  }

  if (byteLength(text) > maxBytes) {
    return {
      ok: false,
      status: 413,
      reason: `${options.routeLabel} body exceeds the ${formatBytes(maxBytes)} limit.`
    };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 400,
      reason: "Malformed JSON body."
    };
  }
}
