const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const backendMigrationPath = "supabase/migrations/20260518000100_freed_backend_core.sql";
const analyticsPrivacyMigrationPath = "supabase/migrations/20260520000100_harden_analytics_privacy_keys.sql";

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function has(path) {
  return existsSync(join(root, path));
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function check(id, condition, evidence) {
  return {
    id,
    status: condition ? "pass" : "fail",
    evidence
  };
}

const schema = read("docs/backend/supabase-schema.sql");
const backendMigration = has(backendMigrationPath) ? read(backendMigrationPath) : "";
const analyticsPrivacyMigration = has(analyticsPrivacyMigrationPath) ? read(analyticsPrivacyMigrationPath) : "";
const backendReadiness = read("src/lib/backend-architecture.ts");
const credentialSafety = read("src/lib/server-credential-safety.ts");
const endpointSafety = read("src/lib/endpoint-safety.ts");
const readinessRoute = read("app/api/backend/readiness+api.ts");
const analyticsIngestion = read("src/lib/recovery-analytics-ingestion.ts");
const adultFeedPublication = read("src/lib/adult-domain-feed-publication.ts");
const backendEventAudit = read("src/lib/backend-event-audit.ts");
const backendProviderTimeout = read("src/lib/backend-provider-timeout.ts");
const backendInfrastructure = read("src/lib/backend-infrastructure.ts");
const backendRetentionCleanup = read("src/lib/backend-retention-cleanup.ts");
const remoteNotifications = read("src/lib/remote-notifications.ts");
const recoveryBackupSync = read("src/lib/recovery-backup-sync.ts");
const adultFeedRoute = read("app/api/adult-domain-feed+api.ts");
const purchaseVerification = read("src/lib/purchase-verification.ts");
const purchaseRoute = read("app/api/purchases/verify+api.ts");
const claraRoute = read("app/api/clara+api.ts");
const challengeRoute = read("app/api/challenges+api.ts");
const retentionRoute = read("app/api/retention+api.ts");
const serverAiProvider = read("src/lib/server-ai-provider.ts");
const serverRequestBody = read("src/lib/server-request-body.ts");
const boundedResponseJson = has("src/lib/bounded-response-json.ts")
  ? read("src/lib/bounded-response-json.ts")
  : "";
const analyticsRoute = read("app/api/analytics+api.ts");
const notificationRoute = read("app/api/notifications/send+api.ts");
const recoveryBackupSyncRoute = read("app/api/recovery-backup/sync+api.ts");
const backendCleanupRoute = read("app/api/backend/cleanup+api.ts");
const envTemplate = read(".env.production.example");
const edgeShared = has("supabase/functions/_shared/freed_edge_contract.ts")
  ? read("supabase/functions/_shared/freed_edge_contract.ts")
  : "";
const edgeAdultFeedSync = has("supabase/functions/adult-domain-feed-sync/index.ts")
  ? read("supabase/functions/adult-domain-feed-sync/index.ts")
  : "";
const edgeRetentionCleanup = has("supabase/functions/analytics-retention-cleanup/index.ts")
  ? read("supabase/functions/analytics-retention-cleanup/index.ts")
  : "";
const edgeConfig = has("supabase/config.toml") ? read("supabase/config.toml") : "";
const edgeFunctionSources = `${edgeShared}\n${edgeAdultFeedSync}\n${edgeRetentionCleanup}`;

const coreBackendTables = [
  "public.recovery_analytics_events",
  "public.adult_domain_feed_versions",
  "public.encrypted_recovery_backups",
  "public.purchase_verification_events",
  "public.ai_backend_events",
  "public.backend_job_runs"
];

const coreBackendPrivacyConstraints = [
  "recovery_analytics_events_privacy_flags",
  "encrypted_recovery_backups_no_raw_payload_keys",
  "purchase_verification_events_hash_shape",
  "ai_backend_events_no_sensitive_payload_keys",
  "backend_job_runs_no_sensitive_metadata_keys"
];

const coreBackendRlsStatements = coreBackendTables.map(
  (table) => `alter table ${table} enable row level security`
);
const coreBackendPublicRoleRevokes = coreBackendTables.map(
  (table) => `revoke all on table ${table} from anon, authenticated, public`
);
const coreBackendServiceRoleGrants = coreBackendTables.map(
  (table) => `grant select, insert, update, delete on table ${table} to service_role`
);

const checks = [
  check(
    "supabase-schema-core-tables",
    schema.includes("create table if not exists public.recovery_analytics_events") &&
      schema.includes("create table if not exists public.adult_domain_feed_versions") &&
      schema.includes("create table if not exists public.encrypted_recovery_backups") &&
      schema.includes("create table if not exists public.purchase_verification_events") &&
      schema.includes("create table if not exists public.ai_backend_events") &&
      schema.includes("create table if not exists public.backend_job_runs"),
    "Supabase schema covers aggregate analytics, feed versions, encrypted backup sync, sanitized purchase audits, redacted AI events, and backend job runs."
  ),
  check(
    "supabase-schema-privacy-constraints",
    schema.includes("recovery_analytics_events_privacy_flags") &&
      schema.includes("freed_jsonb_has_forbidden_normalized_keys") &&
      schema.includes("recovery_analytics_events_no_raw_payload_keys") &&
      schema.includes("receiptdata") &&
      schema.includes("purchasetoken") &&
      schema.includes("blockedAttemptSourceBreakdown") &&
      schema.includes("streakHistory") &&
      schema.includes("jsonb_path_exists") &&
      schema.includes("encrypted_recovery_backups_no_raw_payload_keys") &&
      schema.includes("purchase_verification_events_hash_shape") &&
      schema.includes("ai_backend_events_no_sensitive_payload_keys") &&
      schema.includes("backend_job_runs_no_sensitive_metadata_keys") &&
      schema.includes("alter table public.recovery_analytics_events enable row level security") &&
      schema.includes("alter table public.encrypted_recovery_backups enable row level security") &&
      schema.includes("alter table public.ai_backend_events enable row level security") &&
      includesAll(schema, coreBackendPublicRoleRevokes) &&
      includesAll(schema, coreBackendServiceRoleGrants),
    "Schema enforces aggregate privacy flags, fixed aggregate analytics source buckets, encrypted-backup envelope shape, hashed identifiers, sensitive-key rejection, RLS on backend tables, public client role revokes, and service-role-only grants."
  ),
  check(
    "supabase-migration-artifact",
    has(backendMigrationPath) &&
      has(analyticsPrivacyMigrationPath) &&
      backendMigration.includes("FREED production backend core migration") &&
      analyticsPrivacyMigration.includes("FREED aggregate analytics privacy-key hardening") &&
      analyticsPrivacyMigration.includes("freed_jsonb_has_forbidden_normalized_keys") &&
      analyticsPrivacyMigration.includes("recovery_analytics_events_no_raw_payload_keys") &&
      backendMigration.includes("create extension if not exists pgcrypto") &&
      includesAll(
        backendMigration,
        coreBackendTables.map((table) => `create table if not exists ${table}`)
      ) &&
      includesAll(backendMigration, coreBackendPrivacyConstraints) &&
      includesAll(backendMigration, coreBackendRlsStatements) &&
      includesAll(backendMigration, coreBackendPublicRoleRevokes) &&
      includesAll(backendMigration, coreBackendServiceRoleGrants),
    `${backendMigrationPath} plus ${analyticsPrivacyMigrationPath} are deployable Supabase migrations for the backend schema with pgcrypto, all core tables, RLS, public-client revokes, service-role grants, and sensitive-payload constraints.`
  ),
  check(
    "supabase-edge-functions-cron-contract",
      has("supabase/functions/_shared/freed_edge_contract.ts") &&
      has("supabase/functions/adult-domain-feed-sync/index.ts") &&
      has("supabase/functions/analytics-retention-cleanup/index.ts") &&
      has("supabase/config.toml") &&
      edgeConfig.includes("[functions.adult-domain-feed-sync]") &&
      edgeConfig.includes("[functions.analytics-retention-cleanup]") &&
      (edgeConfig.match(/verify_jwt\s*=\s*false/g) ?? []).length >= 2 &&
      edgeConfig.includes("maintenance-secret") &&
      edgeShared.includes("Deno.env.get") &&
      edgeShared.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      edgeShared.includes("BACKEND_MAINTENANCE_SECRET") &&
      edgeShared.includes("CRON_SECRET") &&
      edgeShared.includes("deleteExpiredRows") &&
      edgeShared.includes("upsertSupabaseRow") &&
      edgeShared.includes("productionSafeHttpsOrigin(baseUrl)") &&
      edgeShared.includes("supabase-url-not-production-safe-origin") &&
      edgeShared.includes("recordBackendJobRun") &&
      edgeShared.includes("acquireEdgeRedisLock") &&
      edgeShared.includes("releaseEdgeRedisLock") &&
      edgeShared.includes("UPSTASH_REDIS_REST_URL") &&
      edgeShared.includes("UPSTASH_REDIS_REST_TOKEN") &&
      edgeShared.includes("FREED_BACKEND_PROVIDER_TIMEOUT_MS") &&
      edgeShared.includes("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES") &&
      edgeShared.includes("fetchProviderWithTimeout") &&
      edgeShared.includes("Supabase edge retention cleanup request") &&
      edgeShared.includes("Supabase edge upsert request") &&
      edgeShared.includes("productionSafeHttpsOrigin(redisUrl)") &&
      edgeShared.includes("Redis edge job base URL is not a production-safe HTTPS origin") &&
      edgeShared.includes("redisPipelineUrl") &&
      edgeShared.includes("readJsonBodyWithByteLimit") &&
      edgeShared.includes("Redis edge pipeline response") &&
      !edgeShared.includes("response.json()") &&
      edgeShared.includes("SUPABASE_JOB_RUNS_TABLE") &&
      edgeShared.includes("backend_job_runs") &&
      edgeShared.includes("idempotency_key") &&
      edgeShared.includes("FORBIDDEN_METADATA_KEYS") &&
      edgeShared.includes("resolution=merge-duplicates,return=minimal") &&
      edgeShared.includes("count=exact,return=minimal") &&
      edgeShared.includes("parseReviewedAdultDomainFeedSourceUrls") &&
      edgeShared.includes("readTextBodyWithByteLimit") &&
      edgeShared.includes("adult-domain-feed-source-too-large") &&
      edgeShared.includes("isProductionSafeHttpsUrl") &&
      edgeShared.includes("url.username || url.password || url.search || url.hash") &&
      edgeShared.includes('!url.pathname || url.pathname === "/"') &&
      edgeShared.includes("isPrivateOrReservedIpv4") &&
      edgeShared.includes("isPrivateOrReservedIpv6") &&
      edgeAdultFeedSync.includes("Deno.serve") &&
      edgeAdultFeedSync.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_URLS") &&
      edgeAdultFeedSync.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES") &&
      edgeAdultFeedSync.includes("SUPABASE_ADULT_FEED_TABLE") &&
      edgeAdultFeedSync.includes("noPacketInspection") &&
      edgeAdultFeedSync.includes("noScreenshotAnalysis") &&
      edgeAdultFeedSync.includes("noRawBrowsingData") &&
      edgeAdultFeedSync.includes("storesFullDomainList: false") &&
      edgeAdultFeedSync.includes("upsertSupabaseRow") &&
      edgeAdultFeedSync.includes("recordBackendJobRun") &&
      edgeAdultFeedSync.includes("acquireEdgeRedisLock") &&
      edgeAdultFeedSync.includes("releaseEdgeRedisLock") &&
      edgeAdultFeedSync.includes("FREED_EDGE_JOB_LOCK_TTL_MS") &&
      edgeAdultFeedSync.includes("adult-domain-feed-sync:") &&
      edgeRetentionCleanup.includes("Deno.serve") &&
      edgeRetentionCleanup.includes("deleteExpiredRows") &&
      edgeRetentionCleanup.includes("recordBackendJobRun") &&
      edgeRetentionCleanup.includes("acquireEdgeRedisLock") &&
      edgeRetentionCleanup.includes("releaseEdgeRedisLock") &&
      edgeRetentionCleanup.includes("FREED_EDGE_JOB_LOCK_TTL_MS") &&
      edgeRetentionCleanup.includes("SUPABASE_ANALYTICS_TABLE") &&
      edgeRetentionCleanup.includes("SUPABASE_ADULT_FEED_TABLE") &&
      edgeRetentionCleanup.includes("SUPABASE_RECOVERY_BACKUP_TABLE") &&
      edgeRetentionCleanup.includes("SUPABASE_PURCHASE_AUDIT_TABLE") &&
      edgeRetentionCleanup.includes("SUPABASE_AI_EVENTS_TABLE") &&
      edgeRetentionCleanup.includes('"analytics-retention-cleanup"') &&
      envTemplate.includes("FREED_EDGE_JOB_LOCK_TTL_MS=") &&
      !edgeFunctionSources.includes("EXPO_PUBLIC_") &&
      !edgeAdultFeedSync.includes("domains: domains") &&
      !edgeAdultFeedSync.includes("domainList"),
    "Supabase Edge Functions provide deployable cron/admin paths for reviewed adult-domain feed sync and expired-row retention cleanup using explicit verify_jwt=false function config, service-role credentials, maintenance auth, optional Upstash Redis locks, production-safe source/Redis endpoint guards, provider timeouts, bounded Redis JSON responses, sanitized backend_job_runs metadata, no public secret exposure, no full-domain response, and no screenshot/OCR/packet-inspection work."
  ),
  check(
    "backend-readiness-route-no-secrets",
    backendReadiness.includes("returnsSecrets: false") &&
      backendReadiness.includes("SERVER_ONLY_KEYS") &&
      backendReadiness.includes("FORBIDDEN_PUBLIC_PREFIXES") &&
      backendReadiness.includes("forbiddenPublicSecretKeys") &&
      backendReadiness.includes("isOpenAiApiKey") &&
      backendReadiness.includes("isGoogleAiApiKey") &&
      backendReadiness.includes("isUsableRemoteModelId") &&
      backendReadiness.includes("isAppleIssuerId") &&
      backendReadiness.includes("isAppleKeyId") &&
      backendReadiness.includes("isGoogleServiceAccountEmail") &&
      backendReadiness.includes("isGoogleAccessToken") &&
      backendReadiness.includes("isFcmServerKey") &&
      backendReadiness.includes("isFirebaseProjectId") &&
      backendReadiness.includes("isAppleTeamId") &&
      backendReadiness.includes("isBundleId") &&
      backendReadiness.includes("isApnsEnvironment") &&
      backendReadiness.includes('readEnv(env, "APNS_ENV") === "production"') &&
      backendReadiness.includes("isSupabaseServiceRoleKey") &&
      backendReadiness.includes("isRedisRestToken") &&
      backendReadiness.includes("isMaintenanceSecret") &&
      credentialSafety.includes("isPlaceholderValue") &&
      credentialSafety.includes("isServerSecret") &&
      credentialSafety.includes("isPrivateKeyPem") &&
      credentialSafety.includes("isSupabaseServiceRoleKey") &&
      credentialSafety.includes("isRedisRestToken") &&
      credentialSafety.includes("isMaintenanceSecret") &&
      readinessRoute.includes("getBackendArchitectureReadiness(process.env)") &&
      readinessRoute.includes('"Cache-Control": "no-store"'),
    "Backend readiness route reports booleans, gaps, table names, and data boundaries without returning server secrets, and rejects placeholder AI/store/push/Supabase/Redis/maintenance credentials."
  ),
  check(
    "server-only-supabase-boundary",
      analyticsIngestion.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      analyticsIngestion.includes("isSupabaseServiceRoleKey") &&
      analyticsIngestion.includes("SUPABASE_ANALYTICS_TABLE") &&
      analyticsIngestion.includes("FREED_ANALYTICS_SUPABASE_TIMEOUT_MS") &&
      analyticsIngestion.includes("Analytics Supabase ingestion timed out") &&
      analyticsIngestion.includes("getProductionBaseUrlIssues") &&
      analyticsIngestion.includes("Supabase analytics base URL") &&
      adultFeedPublication.includes("SUPABASE_ADULT_FEED_TABLE") &&
      adultFeedPublication.includes("isSupabaseServiceRoleKey") &&
      adultFeedPublication.includes("readBackendProviderTimeoutMs") &&
      adultFeedPublication.includes("getProductionBaseUrlIssues") &&
      adultFeedPublication.includes("Supabase adult-domain feed base URL") &&
      backendEventAudit.includes("SUPABASE_PURCHASE_AUDIT_TABLE") &&
      backendEventAudit.includes("SUPABASE_AI_EVENTS_TABLE") &&
      backendEventAudit.includes("isSupabaseServiceRoleKey") &&
      backendEventAudit.includes("readBackendProviderTimeoutMs") &&
      backendEventAudit.includes("getProductionBaseUrlIssues") &&
      backendEventAudit.includes("Supabase backend audit base URL") &&
      backendInfrastructure.includes("SUPABASE_JOB_RUNS_TABLE") &&
      backendInfrastructure.includes("isSupabaseServiceRoleKey") &&
      backendInfrastructure.includes("readBackendProviderTimeoutMs") &&
      backendInfrastructure.includes("getProductionBaseUrlIssues") &&
      backendInfrastructure.includes("Supabase backend job-run base URL") &&
      backendRetentionCleanup.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      backendRetentionCleanup.includes("isSupabaseServiceRoleKey") &&
      backendRetentionCleanup.includes("getProductionBaseUrlIssues") &&
      backendRetentionCleanup.includes("Supabase retention cleanup base URL") &&
      remoteNotifications.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET") &&
      recoveryBackupSync.includes("SUPABASE_RECOVERY_BACKUP_TABLE") &&
      recoveryBackupSync.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      recoveryBackupSync.includes("isSupabaseServiceRoleKey") &&
      recoveryBackupSync.includes("getProductionBaseUrlIssues") &&
      recoveryBackupSync.includes("Supabase Auth base URL") &&
      recoveryBackupSync.includes("Supabase encrypted backup base URL") &&
      !analyticsIngestion.includes("EXPO_PUBLIC_SUPABASE") &&
      !adultFeedPublication.includes("EXPO_PUBLIC_SUPABASE") &&
      !backendEventAudit.includes("EXPO_PUBLIC_SUPABASE") &&
      !backendInfrastructure.includes("EXPO_PUBLIC_SUPABASE") &&
      !backendInfrastructure.includes("EXPO_PUBLIC_UPSTASH") &&
      !backendRetentionCleanup.includes("EXPO_PUBLIC_SUPABASE") &&
      !remoteNotifications.includes("EXPO_PUBLIC_APNS") &&
      !remoteNotifications.includes("EXPO_PUBLIC_FCM") &&
      !recoveryBackupSync.includes("EXPO_PUBLIC_SUPABASE") &&
      envTemplate.includes("EXPO_PUBLIC_SUPABASE_URL=") &&
      envTemplate.includes("EXPO_PUBLIC_SUPABASE_ANON_KEY=") &&
      !envTemplate.includes("EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY") &&
      envTemplate.includes("SUPABASE_SERVICE_ROLE_KEY=") &&
      envTemplate.includes("BACKEND_MAINTENANCE_SECRET=") &&
      envTemplate.includes("SUPABASE_ADULT_FEED_TABLE=adult_domain_feed_versions") &&
      envTemplate.includes("SUPABASE_RECOVERY_BACKUP_TABLE=encrypted_recovery_backups") &&
      envTemplate.includes("SUPABASE_PURCHASE_AUDIT_TABLE=purchase_verification_events") &&
      envTemplate.includes("SUPABASE_AI_EVENTS_TABLE=ai_backend_events") &&
      envTemplate.includes("SUPABASE_JOB_RUNS_TABLE=backend_job_runs") &&
      envTemplate.includes("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES="),
    "Supabase service-role access stays server-only, production base URLs are clean origins before route derivation, and production env handoff names every backend table."
  ),
  check(
    "route-coverage-backend-slices",
      adultFeedRoute.includes("resolveCachedAdultDomainFeed") &&
      adultFeedRoute.includes("publishAdultDomainFeedVersion") &&
      adultFeedRoute.includes("runBackendJob") &&
      adultFeedRoute.includes("enforceBackendRateLimit") &&
      adultFeedRoute.includes("X-FREED-Adult-Feed-Checksum") &&
      adultFeedRoute.includes("X-FREED-Adult-Feed-Cache") &&
      purchaseRoute.includes("verifyPurchasePayload") &&
      purchaseRoute.includes("enforceBackendRateLimit") &&
      purchaseVerification.includes("recordPurchaseVerificationEvent") &&
      purchaseVerification.includes("isJwt") &&
      purchaseVerification.includes("isAppleIssuerId") &&
      purchaseVerification.includes("isGoogleAccessToken") &&
      purchaseVerification.includes("isGoogleServiceAccountEmail") &&
      purchaseVerification.includes("GOOGLE_PLAY_PACKAGE_NAME") &&
      claraRoute.includes("createServerAiText") &&
      claraRoute.includes("recordAiBackendEvent") &&
      claraRoute.includes("enforceBackendRateLimit") &&
      challengeRoute.includes("createServerAiText") &&
      challengeRoute.includes("recordAiBackendEvent") &&
      challengeRoute.includes("enforceBackendRateLimit") &&
      retentionRoute.includes("createServerAiText") &&
      retentionRoute.includes("recordAiBackendEvent") &&
      retentionRoute.includes("enforceBackendRateLimit") &&
      serverAiProvider.includes("OPENAI_API_KEY") &&
      serverAiProvider.includes("GEMINI_API_KEY") &&
      serverAiProvider.includes("isOpenAiApiKey") &&
      serverAiProvider.includes("isGoogleAiApiKey") &&
      serverAiProvider.includes("isUsableRemoteModelId") &&
      serverAiProvider.includes("FREED_AI_PROVIDER_TIMEOUT_MS") &&
      serverAiProvider.includes("FREED_AI_PROVIDER_RESPONSE_MAX_BYTES") &&
      serverAiProvider.includes("readBoundedResponseJson") &&
      serverAiProvider.includes("fetchServerAiProviderResponse") &&
      serverAiProvider.includes("timed out after") &&
      analyticsIngestion.includes("sanitizeAnalyticsIngestionResult") &&
      analyticsIngestion.includes("sanitizeAnalyticsReason") &&
      notificationRoute.includes("sendRemoteNotification") &&
      notificationRoute.includes("validateRemoteNotificationAuth") &&
      notificationRoute.includes("enforceBackendRateLimit") &&
      recoveryBackupSyncRoute.includes("syncEncryptedRecoveryBackup") &&
      recoveryBackupSyncRoute.includes("enforceBackendRateLimit") &&
      analyticsRoute.includes("ingestRecoveryAnalytics") &&
      analyticsRoute.includes("enforceBackendRateLimit") &&
      backendCleanupRoute.includes("cleanupExpiredBackendRows") &&
      backendCleanupRoute.includes("validateBackendMaintenanceAuth") &&
      backendCleanupRoute.includes("runBackendJob") &&
      purchaseVerification.includes("FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES") &&
      purchaseVerification.includes("readBoundedResponseJson") &&
      purchaseVerification.includes("sanitizePurchaseToken") &&
      purchaseVerification.includes("sanitizePurchaseReason") &&
      backendInfrastructure.includes('"recovery-backup"'),
    "Implemented API routes cover adult-feed publication, purchase verification, timeout-bounded CLARA/challenge/retention AI calls, aggregate analytics ingestion, safe remote notification dispatch, encrypted recovery backup sync, and retention cleanup."
  ),
  check(
    "bounded-json-request-bodies",
      serverRequestBody.includes("readBoundedJsonBody") &&
      serverRequestBody.includes("content-length") &&
      serverRequestBody.includes("application/json") &&
      serverRequestBody.includes("endsWith(\"+json\")") &&
      serverRequestBody.includes("Malformed JSON body.") &&
      boundedResponseJson.includes("readBoundedResponseJson") &&
      boundedResponseJson.includes("content-length") &&
      boundedResponseJson.includes("getReader") &&
      boundedResponseJson.includes("exceeds") &&
      boundedResponseJson.includes("cannot be size-checked") &&
      !boundedResponseJson.includes("response.json()") &&
      backendProviderTimeout.includes("FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES") &&
      backendProviderTimeout.includes("readBoundedResponseJson") &&
      serverRequestBody.includes("413") &&
      !serverRequestBody.includes("request.json(") &&
      analyticsRoute.includes("readBoundedJsonBody") &&
      analyticsRoute.includes("ANALYTICS_BODY_LIMIT_BYTES") &&
      notificationRoute.includes("readBoundedJsonBody") &&
      notificationRoute.includes("REMOTE_NOTIFICATION_BODY_LIMIT_BYTES") &&
      purchaseRoute.includes("readBoundedJsonBody") &&
      purchaseRoute.includes("PURCHASE_VERIFICATION_BODY_LIMIT_BYTES") &&
      claraRoute.includes("readBoundedJsonBody") &&
      claraRoute.includes("CLARA_BODY_LIMIT_BYTES") &&
      challengeRoute.includes("readBoundedJsonBody") &&
      challengeRoute.includes("CHALLENGE_BODY_LIMIT_BYTES") &&
      retentionRoute.includes("readBoundedJsonBody") &&
      retentionRoute.includes("RETENTION_BODY_LIMIT_BYTES") &&
      recoveryBackupSyncRoute.includes("readBoundedJsonBody") &&
      recoveryBackupSyncRoute.includes("RECOVERY_BACKUP_SYNC_BODY_LIMIT_BYTES") &&
      !analyticsRoute.includes("request.json(") &&
      !notificationRoute.includes("request.json(") &&
      !purchaseRoute.includes("request.json(") &&
      !claraRoute.includes("request.json(") &&
      !challengeRoute.includes("request.json(") &&
      !retentionRoute.includes("request.json(") &&
      !recoveryBackupSyncRoute.includes("request.json("),
    "Public JSON POST routes reject non-JSON, malformed, and oversized bodies with route-specific byte limits, and provider JSON response readers reject oversized payloads before analytics, AI, purchase, notification, or backup providers can hang route execution."
  ),
  check(
    "production-endpoint-secretless-urls",
      endpointSafety.includes("parsed.username || parsed.password") &&
      endpointSafety.includes("must not include URL credentials") &&
      endpointSafety.includes("parsed.search") &&
      endpointSafety.includes("must not include query strings") &&
      endpointSafety.includes("parsed.hash") &&
      endpointSafety.includes("must not include URL fragments") &&
      endpointSafety.includes("getProductionBaseUrlIssues") &&
      endpointSafety.includes("must be an origin without a path"),
    "Shared production endpoint and base-origin validation rejects URL credentials, query strings, fragments, and path-bearing provider base URLs before AI, analytics, purchase, notification, backup, Redis, or Supabase provider calls use configured endpoints."
  ),
  check(
    "adult-feed-version-publication",
      adultFeedPublication.includes("configureAdultDomainFeedPublicationProvider") &&
      adultFeedRoute.includes("cachedPublicationContext") &&
      adultFeedRoute.includes("publishFreshFeedContext") &&
      adultFeedRoute.includes("formatFeedEtag") &&
      adultFeedRoute.includes("readRequestedFeedValidators") &&
      adultFeedRoute.includes("requestedValidators.checksums.includes(feed.checksum)") &&
      adultFeedRoute.includes("stale-if-error") &&
      adultFeedPublication.includes("resolution=merge-duplicates,return=minimal") &&
      adultFeedPublication.includes("on_conflict=checksum") &&
      adultFeedPublication.includes("sanitizeAdultDomainFeedSourceReport") &&
      adultFeedPublication.includes("sanitizeSourceUrl") &&
      adultFeedPublication.includes("redactOperationalText") &&
      adultFeedPublication.includes("source_reports") &&
      adultFeedPublication.includes("safari_rule_count") &&
      adultFeedPublication.includes("rejected_normal_domain_count") &&
      !adultFeedPublication.includes("feed.domains,"),
    "Adult-domain feed route caches reviewed source ingestion, returns 304 for unchanged checksums, serves stale reviewed feeds after source-refresh failures, and can upsert sanitized feed-version metadata to Supabase without persisting the full domain list."
  ),
  check(
    "backend-event-audit-persistence",
    backendEventAudit.includes("configurePurchaseVerificationAuditProvider") &&
      backendEventAudit.includes("configureAiBackendAuditProvider") &&
      backendEventAudit.includes("purchase_token_hash") &&
      backendEventAudit.includes("payload_summary") &&
      backendEventAudit.includes("sha256-") &&
      backendEventAudit.includes("redactOperationalText") &&
      backendEventAudit.includes("SUPABASE_PURCHASE_AUDIT_TABLE") &&
      backendEventAudit.includes("SUPABASE_AI_EVENTS_TABLE") &&
      !backendEventAudit.includes("rawReceipt") &&
      !backendEventAudit.includes("rawPrompt:"),
    "Purchase and AI backend routes can persist server-only sanitized audit events with hashed store identifiers and redacted AI summaries."
  ),
  check(
    "redis-rate-limit-and-job-locks",
    backendInfrastructure.includes("configureBackendRateLimitProvider") &&
      backendInfrastructure.includes("enforceBackendRateLimit") &&
      backendInfrastructure.includes("acquireBackendRedisLock") &&
      backendInfrastructure.includes("releaseBackendRedisLock") &&
      backendInfrastructure.includes("recordBackendJobRun") &&
      backendInfrastructure.includes("runBackendJob") &&
      backendInfrastructure.includes("UPSTASH_REDIS_REST_URL") &&
      backendInfrastructure.includes("UPSTASH_REDIS_REST_TOKEN") &&
      backendInfrastructure.includes("isRedisRestToken") &&
      backendInfrastructure.includes("shouldFailClosedRateLimit") &&
      backendInfrastructure.includes("FREED_BACKEND_RATE_LIMIT_FAIL_CLOSED") &&
      backendInfrastructure.includes("readBackendProviderTimeoutMs") &&
      backendInfrastructure.includes("Redis rate-limit base URL") &&
      backendInfrastructure.includes("Redis lock base URL") &&
      backendInfrastructure.includes("Redis unlock base URL") &&
      backendProviderTimeout.includes("readBackendProviderResponseMaxBytes") &&
      backendProviderTimeout.includes("timed out after") &&
      backendInfrastructure.includes("redactOperationalText") &&
      backendInfrastructure.includes("backendRateLimitHttpStatus") &&
      backendInfrastructure.includes("SUPABASE_JOB_RUNS_TABLE") &&
      backendInfrastructure.includes('"analytics"') &&
      backendInfrastructure.includes("idempotency_key") &&
      backendInfrastructure.includes("on_conflict=idempotency_key") &&
      analyticsRoute.includes("backendRateLimitHttpStatus") &&
      claraRoute.includes("backendRateLimitError") &&
      !backendInfrastructure.includes("EXPO_PUBLIC_UPSTASH"),
    "Public backend routes use hashed Redis rate-limit keys, fail closed in production when Redis is unavailable, adult-feed publication can use a timeout- and response-size-bounded Redis lock, and backend job runs persist through server-only bounded Supabase credentials."
  ),
  check(
    "retention-cleanup-job",
    backendRetentionCleanup.includes("configureBackendRetentionCleanupProvider") &&
      backendRetentionCleanup.includes("validateBackendMaintenanceAuth") &&
      backendRetentionCleanup.includes("cleanupExpiredBackendRows") &&
      backendRetentionCleanup.includes("BACKEND_MAINTENANCE_SECRET") &&
      backendRetentionCleanup.includes("CRON_SECRET") &&
      backendRetentionCleanup.includes("timingSafeEqual") &&
      backendRetentionCleanup.includes("isMaintenanceSecret") &&
      backendRetentionCleanup.includes("isSupabaseServiceRoleKey") &&
      backendRetentionCleanup.includes("expires_at=lt.") &&
      backendRetentionCleanup.includes("SUPABASE_RECOVERY_BACKUP_TABLE") &&
      backendRetentionCleanup.includes("SUPABASE_PURCHASE_AUDIT_TABLE") &&
      backendRetentionCleanup.includes("SUPABASE_AI_EVENTS_TABLE") &&
      backendCleanupRoute.includes('jobName: "analytics-retention-cleanup"') &&
      backendCleanupRoute.includes("targetCount: 5") &&
      backendCleanupRoute.includes("validateBackendMaintenanceAuth") &&
      !backendRetentionCleanup.includes("select=") &&
      !backendRetentionCleanup.includes("EXPO_PUBLIC_"),
    "Retention cleanup is secret-authorized, uses the backend job runner, deletes only expired rows by table, and does not select or return stored payloads."
  ),
  check(
    "remote-notification-safety",
	      remoteNotifications.includes("configureRemoteNotificationProvider") &&
	      remoteNotifications.includes("validateRemoteNotificationAuth") &&
	      remoteNotifications.includes("timingSafeEqual") &&
	      remoteNotifications.includes("isServerSecret") &&
	      remoteNotifications.includes("sanitizeRemoteNotificationRequest") &&
	      remoteNotifications.includes("allowedRequestKeys") &&
      remoteNotifications.includes("buildSafeRemoteNotificationPayload") &&
      remoteNotifications.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET") &&
      remoteNotifications.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS") &&
      remoteNotifications.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES") &&
      remoteNotifications.includes("readBoundedResponseJson") &&
      remoteNotifications.includes("fetchNotificationProviderResponse") &&
      remoteNotifications.includes("timed out after") &&
      remoteNotifications.includes("FCM_SERVER_KEY") &&
      remoteNotifications.includes("FIREBASE_PROJECT_ID") &&
	      remoteNotifications.includes("FIREBASE_SERVICE_ACCOUNT_JSON") &&
	      remoteNotifications.includes("APNS_PRIVATE_KEY") &&
	      remoteNotifications.includes("isFcmServerKey") &&
	      remoteNotifications.includes("isGoogleAccessToken") &&
	      remoteNotifications.includes("isGoogleServiceAccountEmail") &&
	      remoteNotifications.includes("isPrivateKeyPem") &&
	      remoteNotifications.includes("isAppleKeyId") &&
	      remoteNotifications.includes("isAppleTeamId") &&
	      remoteNotifications.includes("isBundleId") &&
	      remoteNotifications.includes("isApnsEnvironment") &&
	      remoteNotifications.includes("route: \"checkin\"") &&
	      remoteNotifications.includes("forbiddenPayloadKeys") &&
	      !remoteNotifications.includes("EXPO_PUBLIC_"),
		    "Remote notification dispatch is server-authorized, timeout- and response-size-bounded, uses preset recovery-safe copy, sends only route/kind metadata, and validates server-only FCM/APNs credentials before provider calls."
	  ),
  check(
    "encrypted-recovery-backup-sync",
    recoveryBackupSync.includes("configureRecoveryBackupSyncIdentityProvider") &&
      recoveryBackupSync.includes("configureRecoveryBackupSyncStorageProvider") &&
      recoveryBackupSync.includes("sanitizeRecoveryBackupSyncRequest") &&
      recoveryBackupSync.includes("syncEncryptedRecoveryBackup") &&
      recoveryBackupSync.includes("RECOVERY_BACKUP_VERSION") &&
      recoveryBackupSync.includes("PBKDF2-SHA256") &&
      recoveryBackupSync.includes("AES-GCM") &&
      recoveryBackupSync.includes("Supabase Auth user endpoint") &&
      recoveryBackupSync.includes("hashToken") &&
      recoveryBackupSync.includes("forbiddenSyncKeys") &&
      recoveryBackupSync.includes("sanitizeRecoveryBackupSyncResult") &&
      recoveryBackupSync.includes("normalizeSyncKey") &&
      recoveryBackupSync.includes("containsSensitiveOperationalText") &&
      recoveryBackupSync.includes("SUPABASE_RECOVERY_BACKUP_TABLE") &&
      recoveryBackupSyncRoute.includes('"recovery-backup"') &&
      !recoveryBackupSync.includes("restoreEncryptedRecoveryBackup(") &&
      !recoveryBackupSync.includes("createEncryptedRecoveryBackup(") &&
      !recoveryBackupSync.includes("EXPO_PUBLIC_"),
    "Hosted recovery continuity accepts only client-encrypted backup envelopes, validates Supabase Auth server-side, stores hashed user/device identifiers, and never decrypts backups."
  ),
  check(
    "redis-and-notification-handoff",
    backendReadiness.includes("UPSTASH_REDIS_REST_URL") &&
      backendReadiness.includes("UPSTASH_REDIS_REST_TOKEN") &&
      backendReadiness.includes("rate limits, feed sync locks, idempotency") &&
      backendReadiness.includes("FCM_SERVER_KEY") &&
      backendReadiness.includes("APNS_PRIVATE_KEY") &&
      envTemplate.includes("UPSTASH_REDIS_REST_URL=") &&
      envTemplate.includes("REMOTE_NOTIFICATION_DISPATCH_SECRET=") &&
      envTemplate.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_TIMEOUT_MS=") &&
      envTemplate.includes("FREED_REMOTE_NOTIFICATION_PROVIDER_RESPONSE_MAX_BYTES=") &&
      envTemplate.includes("FCM_SERVER_KEY=") &&
      envTemplate.includes("FIREBASE_PROJECT_ID=") &&
      envTemplate.includes("APNS_PRIVATE_KEY="),
    "Backend readiness and env template document Redis/Upstash plus FCM/APNs as server-only production infrastructure."
  )
];

const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED backend architecture audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
