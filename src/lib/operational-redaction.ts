const PRIVATE_KEY_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi;
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi;
const DOMAIN_PATTERN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?:\/[^\s"'<>]*)?/gi;
const IPV4_PATTERN =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?(?:\/[^\s"'<>]*)?/g;
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/-]+=*/gi;
const JWT_PATTERN = /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi;
const GOOGLE_TOKEN_PATTERN = /\bya29\.[a-z0-9._-]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|api[_-]?key|purchase[_-]?token|receipt(?:data)?|raw[_-]?receipt|secret|authorization)\s*[:=]\s*["']?[^"',\s}]+["']?/gi;
const SECRET_PLACEHOLDER_PATTERN =
  /\b(?:raw|opaque|private|client|server|service|production|test)[_-]?(?:secret|token|receipt|key)[a-z0-9._-]*/gi;

const SENSITIVE_OPERATIONAL_TEXT_PATTERNS = [
  PRIVATE_KEY_PATTERN,
  URL_PATTERN,
  EMAIL_PATTERN,
  DOMAIN_PATTERN,
  IPV4_PATTERN,
  BEARER_PATTERN,
  JWT_PATTERN,
  GOOGLE_TOKEN_PATTERN,
  SECRET_ASSIGNMENT_PATTERN,
  SECRET_PLACEHOLDER_PATTERN
] as const;

export function containsSensitiveOperationalText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  return SENSITIVE_OPERATIONAL_TEXT_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function redactOperationalText(value: unknown, maxLength = 180): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(PRIVATE_KEY_PATTERN, "[redacted-private-key]")
    .replace(URL_PATTERN, "[redacted-link]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(IPV4_PATTERN, "[redacted-ip]")
    .replace(BEARER_PATTERN, "Bearer [redacted-secret]")
    .replace(JWT_PATTERN, "[redacted-jwt]")
    .replace(GOOGLE_TOKEN_PATTERN, "[redacted-token]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "[redacted-secret]")
    .replace(SECRET_PLACEHOLDER_PATTERN, "[redacted-secret]")
    .replace(DOMAIN_PATTERN, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(1, Math.floor(maxLength)));

  return cleaned || null;
}
