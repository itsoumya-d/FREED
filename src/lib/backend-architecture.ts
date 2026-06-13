import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import {
  isApnsEnvironment,
  isAppleIssuerId,
  isAppleKeyId,
  isAppleTeamId,
  isBundleId,
  isFcmServerKey,
  isFirebaseProjectId,
  isGoogleAccessToken,
  isGoogleAiApiKey,
  isGoogleServiceAccountEmail,
  isJwt,
  isMaintenanceSecret,
  isOpenAiApiKey,
  isPrivateKeyPem,
  isRedisRestToken,
  isServerSecret,
  isSupabaseServiceRoleKey,
  isUsableRemoteModelId
} from "@/lib/server-credential-safety";

export type BackendEnvironment = Record<string, string | undefined>;

export type BackendComponentReadiness = {
  ready: boolean;
  configured: boolean;
  missing: string[];
  dataBoundary: string;
};

export type BackendArchitectureReadiness = {
  schemaVersion: "backend-v1";
  tables: {
    analytics: string;
    adultDomainFeedVersions: string;
    encryptedRecoveryBackups: string;
    purchaseVerificationEvents: string;
    aiBackendEvents: string;
    backendJobRuns: string;
  };
  components: {
    supabase: BackendComponentReadiness;
    redis: BackendComponentReadiness;
    ai: BackendComponentReadiness;
    purchases: BackendComponentReadiness;
    notifications: BackendComponentReadiness;
    recoveryBackupSync: BackendComponentReadiness;
    maintenance: BackendComponentReadiness;
  };
  privacy: {
    returnsSecrets: false;
    serverOnlyKeys: string[];
    forbiddenPublicPrefixes: string[];
  };
};

const SERVER_ONLY_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BACKEND_MAINTENANCE_SECRET",
  "CRON_SECRET",
  "FREED_BACKEND_PROVIDER_TIMEOUT_MS",
  "FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "FREED_AI_PROVIDER_RESPONSE_MAX_BYTES",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_GENAI_API_KEY",
  "APP_STORE_PRIVATE_KEY",
  "APP_STORE_PRIVATE_KEY_BASE64",
  "APP_STORE_SERVER_API_JWT",
  "FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64",
  "GOOGLE_PLAY_ACCESS_TOKEN",
  "FCM_SERVER_KEY",
  "FCM_ACCESS_TOKEN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64",
  "REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES",
  "APNS_PRIVATE_KEY",
  "APNS_PRIVATE_KEY_BASE64"
];

const FORBIDDEN_PUBLIC_PREFIXES = [
  "EXPO_PUBLIC_SUPABASE_SERVICE_ROLE",
  "EXPO_PUBLIC_SUPABASE_JWT_SECRET",
  "EXPO_PUBLIC_SUPABASE_DB_PASSWORD",
  "EXPO_PUBLIC_CRON_SECRET",
  "EXPO_PUBLIC_REDIS",
  "EXPO_PUBLIC_UPSTASH",
  "EXPO_PUBLIC_OPENAI",
  "EXPO_PUBLIC_GEMINI",
  "EXPO_PUBLIC_GOOGLE_API",
  "EXPO_PUBLIC_GOOGLE_GENAI",
  "EXPO_PUBLIC_APP_STORE_PRIVATE_KEY",
  "EXPO_PUBLIC_APP_STORE_SERVER_API_JWT",
  "EXPO_PUBLIC_GOOGLE_PLAY_SERVICE_ACCOUNT",
  "EXPO_PUBLIC_GOOGLE_PLAY_ACCESS_TOKEN",
  "EXPO_PUBLIC_FCM_SERVER",
  "EXPO_PUBLIC_FCM_ACCESS_TOKEN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT",
  "EXPO_PUBLIC_REMOTE_NOTIFICATION_DISPATCH_SECRET",
  "EXPO_PUBLIC_APNS",
  "EXPO_PUBLIC_BACKEND_MAINTENANCE_SECRET"
];

export function getBackendArchitectureReadiness(env: BackendEnvironment = {}): BackendArchitectureReadiness {
  const tables = {
    analytics: readEnv(env, "SUPABASE_ANALYTICS_TABLE") ?? "recovery_analytics_events",
    adultDomainFeedVersions: readEnv(env, "SUPABASE_ADULT_FEED_TABLE") ?? "adult_domain_feed_versions",
    encryptedRecoveryBackups: readEnv(env, "SUPABASE_RECOVERY_BACKUP_TABLE") ?? "encrypted_recovery_backups",
    purchaseVerificationEvents: readEnv(env, "SUPABASE_PURCHASE_AUDIT_TABLE") ?? "purchase_verification_events",
    aiBackendEvents: readEnv(env, "SUPABASE_AI_EVENTS_TABLE") ?? "ai_backend_events",
    backendJobRuns: readEnv(env, "SUPABASE_JOB_RUNS_TABLE") ?? "backend_job_runs"
  };

  const publicSecretLeaks = forbiddenPublicSecretKeys(env);
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseServiceRoleKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const supabaseBaseIssues = supabaseUrl
    ? getProductionBaseUrlIssues(supabaseUrl, "Supabase base URL").map((issue) => issue.issue)
    : ["SUPABASE_URL"];
  const supabaseIssues = supabaseUrl && supabaseBaseIssues.length === 0
    ? getProductionEndpointIssues(supabaseRestUrl(supabaseUrl, tables.analytics), "Supabase REST endpoint").map((issue) => issue.issue)
    : supabaseBaseIssues;
  const supabaseMissing = [
    ...(!isSupabaseServiceRoleKey(supabaseServiceRoleKey) ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ...supabaseIssues,
    ...publicSecretLeaks
  ];

  const redisUrl = readEnv(env, "UPSTASH_REDIS_REST_URL");
  const redisToken = readEnv(env, "UPSTASH_REDIS_REST_TOKEN");
  const redisBaseIssues = redisUrl
    ? getProductionBaseUrlIssues(redisUrl, "Redis base URL").map((issue) => issue.issue)
    : ["UPSTASH_REDIS_REST_URL"];
  const redisIssues = redisUrl && redisBaseIssues.length === 0
    ? getProductionEndpointIssues(redisRestUrl(redisUrl), "Redis REST endpoint").map((issue) => issue.issue)
    : redisBaseIssues;
  const redisMissing = [...(!isRedisRestToken(redisToken) ? ["UPSTASH_REDIS_REST_TOKEN"] : []), ...redisIssues, ...publicSecretLeaks];

  const configuredAiProvider = (readEnv(env, "FREED_AI_PROVIDER") ?? readEnv(env, "AI_PROVIDER"))?.toLowerCase();
  const openAiReady = isOpenAiApiKey(readEnv(env, "OPENAI_API_KEY")) && isUsableRemoteModelId(readEnv(env, "OPENAI_MODEL"));
  const geminiReady = isGoogleAiApiKey(readEnv(env, "GEMINI_API_KEY") ?? readEnv(env, "GOOGLE_API_KEY") ?? readEnv(env, "GOOGLE_GENAI_API_KEY")) &&
    isUsableRemoteModelId(readEnv(env, "GEMINI_MODEL"));
  const aiMissing = [
    ...(configuredAiProvider === "openai" && !openAiReady ? ["OPENAI_API_KEY and OPENAI_MODEL"] : []),
    ...(configuredAiProvider === "gemini" && !geminiReady ? ["GEMINI_API_KEY and GEMINI_MODEL"] : []),
    ...(!configuredAiProvider && !openAiReady && !geminiReady ? ["OPENAI_API_KEY and OPENAI_MODEL, or GEMINI_API_KEY and GEMINI_MODEL"] : []),
    ...(configuredAiProvider && !["openai", "gemini"].includes(configuredAiProvider) ? ["FREED_AI_PROVIDER must be openai or gemini"] : []),
    ...publicSecretLeaks
  ];

  const purchaseMissing = [
    ...(!readEnv(env, "APP_STORE_BUNDLE_ID") ? ["APP_STORE_BUNDLE_ID"] : []),
    ...(!hasAppStoreCredential(env) ? ["App Store server verification credentials"] : []),
    ...(!readEnv(env, "GOOGLE_PLAY_PACKAGE_NAME") ? ["GOOGLE_PLAY_PACKAGE_NAME"] : []),
    ...(!hasGooglePlayCredential(env) ? ["Google Play verification credentials"] : []),
    ...publicSecretLeaks
  ];

  const notificationMissing = [
    ...(!isServerSecret(readEnv(env, "REMOTE_NOTIFICATION_DISPATCH_SECRET")) ? ["REMOTE_NOTIFICATION_DISPATCH_SECRET"] : []),
    ...(!hasFcmCredential(env) ? ["FCM server credential"] : []),
    ...(!hasApnsCredential(env) ? ["APNs signing credential"] : []),
    ...publicSecretLeaks
  ];

  const recoveryBackupSyncMissing = [
    ...(!isSupabaseServiceRoleKey(supabaseServiceRoleKey) ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ...supabaseIssues,
    ...publicSecretLeaks
  ];

  const maintenanceMissing = [
    ...(!isMaintenanceSecret(readEnv(env, "BACKEND_MAINTENANCE_SECRET")) && !isMaintenanceSecret(readEnv(env, "CRON_SECRET"))
      ? ["BACKEND_MAINTENANCE_SECRET or CRON_SECRET"]
      : []),
    ...(!isSupabaseServiceRoleKey(supabaseServiceRoleKey) ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ...supabaseIssues,
    ...publicSecretLeaks
  ];

  return {
    schemaVersion: "backend-v1",
    tables,
    components: {
      supabase: component(
        supabaseMissing,
        "Stores aggregate analytics, adult-domain feed versions, encrypted recovery backup envelopes, sanitized purchase verification events, redacted AI backend events, and backend job runs through timeout-bounded provider calls; never stores raw URLs, notes, receipts, purchase tokens, transcripts, screenshots, support contacts, passphrases, or precise location."
      ),
      redis: component(
        redisMissing,
        "Used through timeout-bounded calls for rate limits, feed sync locks, idempotency, and short-lived job coordination only; no browsing history or recovery notes are cached."
      ),
      ai: component(
        aiMissing,
        "Server-only timeout-bounded AI key and model configuration for CLARA, challenge, and retention routes; prompts and outputs must stay redacted before persistence."
      ),
      purchases: component(
        purchaseMissing,
        "Server-only App Store and Google Play verification credentials; audit storage keeps product, entitlement, status, and hashes only."
      ),
      notifications: component(
        notificationMissing,
        "Optional timeout-bounded remote push provider credentials and dispatch secret for future campaigns; local reminders remain the default and notification payloads contain prewritten recovery copy plus route/kind metadata only."
      ),
      recoveryBackupSync: component(
        recoveryBackupSyncMissing,
        "Optional hosted recovery continuity accepts only client-encrypted backup envelopes after Supabase Auth user validation, stores rows by hashed user/device identity, and never receives passphrases or decrypted recovery state."
      ),
      maintenance: component(
        maintenanceMissing,
        "Server-authorized retention cleanup deletes only expired aggregate analytics, feed-version metadata, encrypted backup envelopes, purchase audit rows, and redacted AI event rows; it does not read or return row payloads."
      )
    },
    privacy: {
      returnsSecrets: false,
      serverOnlyKeys: SERVER_ONLY_KEYS,
      forbiddenPublicPrefixes: FORBIDDEN_PUBLIC_PREFIXES
    }
  };
}

function component(missing: string[], dataBoundary: string): BackendComponentReadiness {
  const uniqueMissing = Array.from(new Set(missing.filter(Boolean))).sort();
  return {
    ready: uniqueMissing.length === 0,
    configured: uniqueMissing.length === 0,
    missing: uniqueMissing,
    dataBoundary
  };
}

function readEnv(env: BackendEnvironment, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function supabaseRestUrl(baseUrl: string, tableName: string) {
  try {
    return new URL(`/rest/v1/${encodeURIComponent(tableName)}`, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function redisRestUrl(baseUrl: string) {
  try {
    return new URL("/pipeline", baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function forbiddenPublicSecretKeys(env: BackendEnvironment) {
  return Object.keys(env)
    .filter((key) => env[key])
    .filter((key) => FORBIDDEN_PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .map((key) => `server secret must not be public: ${key}`);
}

function hasAppStoreCredential(env: BackendEnvironment) {
  const privateKey = readPrivateKey(env, "APP_STORE_PRIVATE_KEY", "APP_STORE_PRIVATE_KEY_BASE64");
  return Boolean(
    isJwt(readEnv(env, "APP_STORE_SERVER_API_JWT")) ||
      (
        isAppleIssuerId(readEnv(env, "APP_STORE_ISSUER_ID")) &&
        isAppleKeyId(readEnv(env, "APP_STORE_KEY_ID")) &&
        isPrivateKeyPem(privateKey)
      )
  );
}

function hasGooglePlayCredential(env: BackendEnvironment) {
  const serviceAccount = readGoogleServiceAccount(env);
  const clientEmail = typeof serviceAccount?.client_email === "string" ? serviceAccount.client_email : null;
  const privateKey = typeof serviceAccount?.private_key === "string" ? serviceAccount.private_key : null;
  return Boolean(
    isGoogleAccessToken(readEnv(env, "GOOGLE_PLAY_ACCESS_TOKEN")) ||
      (isGoogleServiceAccountEmail(clientEmail) && isPrivateKeyPem(privateKey))
  );
}

function hasFcmCredential(env: BackendEnvironment) {
  const serviceAccount = readFirebaseServiceAccount(env);
  const clientEmail = typeof serviceAccount?.client_email === "string" ? serviceAccount.client_email : null;
  const privateKey = typeof serviceAccount?.private_key === "string" ? serviceAccount.private_key : null;
  const projectId = readFirebaseProjectId(env, serviceAccount);
  return Boolean(
    isFcmServerKey(readEnv(env, "FCM_SERVER_KEY")) ||
      (isGoogleAccessToken(readEnv(env, "FCM_ACCESS_TOKEN")) && isFirebaseProjectId(projectId)) ||
      (isGoogleServiceAccountEmail(clientEmail) && isPrivateKeyPem(privateKey) && isFirebaseProjectId(projectId))
  );
}

function hasApnsCredential(env: BackendEnvironment) {
  return Boolean(
    isAppleKeyId(readEnv(env, "APNS_KEY_ID")) &&
      isAppleTeamId(readEnv(env, "APNS_TEAM_ID")) &&
      isBundleId(readEnv(env, "APNS_BUNDLE_ID")) &&
      isPrivateKeyPem(readPrivateKey(env, "APNS_PRIVATE_KEY", "APNS_PRIVATE_KEY_BASE64")) &&
      readEnv(env, "APNS_ENV") === "production" &&
      isApnsEnvironment(readEnv(env, "APNS_ENV"))
  );
}

function readPrivateKey(env: BackendEnvironment, directKey: string, base64Key: string) {
  const direct = readEnv(env, directKey);
  if (direct) return direct.replace(/\\n/g, "\n");
  const encoded = readEnv(env, base64Key);
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function readGoogleServiceAccount(env: BackendEnvironment): Record<string, unknown> | null {
  const raw = readEnv(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  const encoded = readEnv(env, "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64");
  const value = raw || (encoded ? Buffer.from(encoded, "base64").toString("utf8") : null);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readFirebaseServiceAccount(env: BackendEnvironment): Record<string, unknown> | null {
  const raw = readEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON");
  const encoded = readEnv(env, "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
  const value = raw || (encoded ? Buffer.from(encoded, "base64").toString("utf8") : null);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readFirebaseProjectId(env: BackendEnvironment, serviceAccount: Record<string, unknown> | null) {
  const direct = readEnv(env, "FIREBASE_PROJECT_ID");
  const fromServiceAccount = typeof serviceAccount?.project_id === "string" ? serviceAccount.project_id : null;
  return direct ?? fromServiceAccount;
}
