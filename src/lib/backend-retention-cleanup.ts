import { timingSafeEqual } from "node:crypto";
import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { redactOperationalText } from "@/lib/operational-redaction";
import {
  isMaintenanceSecret,
  isSupabaseServiceRoleKey
} from "@/lib/server-credential-safety";

type Env = Record<string, string | undefined>;
type Fetcher = typeof fetch;

export type BackendRetentionCleanupTarget =
  | "analytics"
  | "adult-domain-feed"
  | "recovery-backups"
  | "purchase-verification"
  | "ai-backend";

export type BackendRetentionCleanupTableResult = {
  target: BackendRetentionCleanupTarget;
  tableName: string;
  status: "ok" | "unconfigured" | "invalid" | "error";
  deletedCount: number | null;
  reason?: string;
};

export type BackendRetentionCleanupResult = {
  ok: boolean;
  provider: "supabase" | "custom" | "unconfigured" | "invalid" | "error";
  status: "ok" | "unconfigured" | "invalid" | "error";
  cleanedAt: string;
  cutoff: string;
  tables: BackendRetentionCleanupTableResult[];
  reason?: string;
};

export type BackendRetentionCleanupProvider = (
  cleanedAt: string,
  cutoff: string
) => Promise<BackendRetentionCleanupResult> | BackendRetentionCleanupResult;

let backendRetentionCleanupProvider: BackendRetentionCleanupProvider | null = null;

const cleanupTargets: Array<{
  target: BackendRetentionCleanupTarget;
  envKey: string;
  defaultTable: string;
}> = [
  { target: "analytics", envKey: "SUPABASE_ANALYTICS_TABLE", defaultTable: "recovery_analytics_events" },
  { target: "adult-domain-feed", envKey: "SUPABASE_ADULT_FEED_TABLE", defaultTable: "adult_domain_feed_versions" },
  { target: "recovery-backups", envKey: "SUPABASE_RECOVERY_BACKUP_TABLE", defaultTable: "encrypted_recovery_backups" },
  { target: "purchase-verification", envKey: "SUPABASE_PURCHASE_AUDIT_TABLE", defaultTable: "purchase_verification_events" },
  { target: "ai-backend", envKey: "SUPABASE_AI_EVENTS_TABLE", defaultTable: "ai_backend_events" }
];

export function configureBackendRetentionCleanupProvider(provider: BackendRetentionCleanupProvider | null) {
  backendRetentionCleanupProvider = provider;
}

export function validateBackendMaintenanceAuth(request: Request, env: Env = process.env) {
  const secret = readEnv(env, "BACKEND_MAINTENANCE_SECRET") ?? readEnv(env, "CRON_SECRET");
  if (!secret || !isMaintenanceSecret(secret)) return false;
  const authorization = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const explicitHeader = request.headers.get("x-freed-maintenance-secret")?.trim();
  return safeSecretEqual(bearer, secret) || safeSecretEqual(explicitHeader, secret);
}

export async function cleanupExpiredBackendRows(
  options: { env?: Env; fetcher?: Fetcher; cleanedAt?: string; cutoff?: string } = {}
): Promise<BackendRetentionCleanupResult> {
  const cleanedAt = options.cleanedAt ?? new Date().toISOString();
  const cutoff = cleanIsoDate(options.cutoff) ?? cleanedAt;

  if (backendRetentionCleanupProvider) {
    return backendRetentionCleanupProvider(cleanedAt, cutoff);
  }

  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      provider: "unconfigured",
      status: "unconfigured",
      cleanedAt,
      cutoff,
      tables: cleanupTargets.map((target) => ({
        target: target.target,
        tableName: readEnv(env, target.envKey) ?? target.defaultTable,
        status: "unconfigured",
        deletedCount: null,
        reason: "Supabase retention cleanup is not configured."
      })),
      reason: "Supabase retention cleanup is not configured."
    };
  }
  if (!isSupabaseServiceRoleKey(serviceKey)) {
    return {
      ok: false,
      provider: "invalid",
      status: "invalid",
      cleanedAt,
      cutoff,
      tables: cleanupTargets.map((target) => ({
        target: target.target,
        tableName: readEnv(env, target.envKey) ?? target.defaultTable,
        status: "invalid",
        deletedCount: null,
        reason: "Supabase retention cleanup service-role key is not production-shaped."
      })),
      reason: "Supabase retention cleanup service-role key is not production-shaped."
    };
  }

  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase retention cleanup base URL");
  if (baseIssues.length > 0) {
    const reason = baseIssues.map((issue) => issue.issue).join("; ");
    return {
      ok: false,
      provider: "invalid",
      status: "invalid",
      cleanedAt,
      cutoff,
      tables: cleanupTargets.map((target) => ({
        target: target.target,
        tableName: readEnv(env, target.envKey) ?? target.defaultTable,
        status: "invalid",
        deletedCount: null,
        reason
      })),
      reason
    };
  }

  const tables: BackendRetentionCleanupTableResult[] = [];
  for (const target of cleanupTargets) {
    const tableName = readEnv(env, target.envKey) ?? target.defaultTable;
    tables.push(await deleteExpiredRows({ supabaseUrl, serviceKey, tableName, target: target.target, cutoff, fetcher }));
  }

  const failed = tables.filter((table) => table.status !== "ok");
  return {
    ok: failed.length === 0,
    provider: failed.length === 0 ? "supabase" : failed.some((table) => table.status === "invalid") ? "invalid" : "error",
    status: failed.length === 0 ? "ok" : failed.some((table) => table.status === "invalid") ? "invalid" : "error",
    cleanedAt,
    cutoff,
    tables,
    ...(failed.length > 0 ? { reason: failed.map((table) => `${table.tableName}: ${table.reason ?? table.status}`).join("; ") } : {})
  };
}

async function deleteExpiredRows({
  supabaseUrl,
  serviceKey,
  tableName,
  target,
  cutoff,
  fetcher
}: {
  supabaseUrl: string;
  serviceKey: string;
  tableName: string;
  target: BackendRetentionCleanupTarget;
  cutoff: string;
  fetcher: Fetcher;
}): Promise<BackendRetentionCleanupTableResult> {
  const baseEndpoint = supabaseTableUrl(supabaseUrl, tableName);
  const endpointIssues = getProductionEndpointIssues(baseEndpoint, `Supabase ${target} retention cleanup endpoint`);
  if (endpointIssues.length > 0) {
    return {
      target,
      tableName,
      status: "invalid",
      deletedCount: null,
      reason: endpointIssues.map((issue) => issue.issue).join("; ")
    };
  }

  try {
    const endpoint = `${baseEndpoint}?expires_at=lt.${encodeURIComponent(cutoff)}`;
    const response = await fetcher(endpoint, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "count=exact,return=minimal"
      }
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);
    return {
      target,
      tableName,
      status: "ok",
      deletedCount: countFromContentRange(response.headers.get("content-range"))
    };
  } catch (error) {
    return {
      target,
      tableName,
      status: "error",
      deletedCount: null,
      reason: sanitizeOperationalReason(error instanceof Error ? error.message : "Supabase retention cleanup failed.") ??
        "Supabase retention cleanup failed."
    };
  }
}

function sanitizeOperationalReason(value: unknown) {
  return redactOperationalText(value, 180);
}

function supabaseTableUrl(supabaseUrl: string, tableName: string) {
  const safeTable = encodeURIComponent(tableName.replace(/[^\w-]/g, ""));
  try {
    return new URL(`/rest/v1/${safeTable}`, supabaseUrl).toString();
  } catch {
    return supabaseUrl;
  }
}

function countFromContentRange(value: string | null) {
  const match = value?.match(/\/(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function readEnv(env: Env, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function cleanIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeSecretEqual(candidate: string | null | undefined, secret: string) {
  if (!candidate) return false;
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);
  return candidateBuffer.length === secretBuffer.length && timingSafeEqual(candidateBuffer, secretBuffer);
}
