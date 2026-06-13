export function isPlaceholderValue(value: string | null) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  const placeholderTokens = new Set(["test", "test-key", "sample", "mock", "local", "fallback", "dummy"]);
  return (
    normalized.includes("placeholder") ||
    normalized.includes("changeme") ||
    normalized.includes("your-") ||
    normalized.includes("example") ||
    placeholderTokens.has(normalized) ||
    normalized
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .some((token) => placeholderTokens.has(token))
  );
}

export function isOpenAiApiKey(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^sk-(?:proj-)?[0-9A-Za-z_-]{20,}$/.test(value.trim()));
}

export function isGoogleAiApiKey(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^AIza[0-9A-Za-z_-]{30,}$/.test(value.trim()));
}

export function isUsableRemoteModelId(value: string | null) {
  if (!value || isPlaceholderValue(value)) return false;
  const normalized = value.trim().toLowerCase();
  if (["configured-server-model", "gpt-release-safe"].includes(normalized)) return false;
  if (value.length < 4 || value.length > 128) return false;
  return /^[A-Za-z0-9._~:/+=-]+$/.test(value);
}

export function isServerSecret(value: string | null, minLength = 24) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      value.trim().length >= minLength &&
      /^[\x21-\x7e]+$/.test(value.trim())
  );
}

export function isSupabaseServiceRoleKey(value: string | null) {
  return isJwt(value) || isServerSecret(value, 32);
}

export function isRedisRestToken(value: string | null) {
  return isServerSecret(value, 24);
}

export function isMaintenanceSecret(value: string | null) {
  return isServerSecret(value, 24);
}

export function isAppleIssuerId(value: string | null) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      !/^0{8}-0{4}-0{4}-0{4}-0{12}$/i.test(value.trim()) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
  );
}

export function isAppleKeyId(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Z0-9]{10}$/.test(value.trim()));
}

export function isAppleTeamId(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Z0-9]{10}$/.test(value.trim()));
}

export function isPrivateKeyPem(value: string | null) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/.test(value) &&
      /-----END (?:EC |RSA )?PRIVATE KEY-----/.test(value)
  );
}

export function isJwt(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim()));
}

export function isGoogleServiceAccountEmail(value: string | null) {
  return Boolean(
    value &&
      !isPlaceholderValue(value) &&
      /^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/i.test(value.trim())
  );
}

export function isGoogleAccessToken(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && (value.trim().startsWith("ya29.") || value.trim().length >= 40));
}

export function isFcmServerKey(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Za-z0-9:_-]{40,}$/.test(value.trim()));
}

export function isBundleId(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^[A-Za-z0-9][A-Za-z0-9.-]{2,120}$/.test(value.trim()));
}

export function isFirebaseProjectId(value: string | null) {
  return Boolean(value && !isPlaceholderValue(value) && /^[a-z][a-z0-9-]{4,60}[a-z0-9]$/.test(value.trim()));
}

export function isApnsEnvironment(value: string | null) {
  return !value || value === "production" || value === "sandbox";
}

export function isAppStoreServerEnvironment(value: string | null) {
  return !value || value === "production" || value === "sandbox";
}
