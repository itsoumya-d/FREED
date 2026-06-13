import type {
  AdultDomainFeedIngestionResult,
  AdultDomainFeedSourceReport
} from "@/lib/adult-domain-feed-ingestion";
import type { AdultDomainFeed } from "@/lib/blocking-engine";
import {
  fetchBackendProviderResponse,
  readBackendProviderTimeoutMs
} from "@/lib/backend-provider-timeout";
import { getProductionBaseUrlIssues, getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { redactOperationalText } from "@/lib/operational-redaction";
import { isSupabaseServiceRoleKey } from "@/lib/server-credential-safety";

export type AdultDomainFeedPublicationInput = AdultDomainFeedIngestionResult & {
  safariRuleCount: number;
};

export type AdultDomainFeedPublicationResult = {
  published: boolean;
  provider: "supabase" | "custom" | "unconfigured" | "invalid" | "error" | "skipped";
  status: "ok" | "unconfigured" | "invalid" | "error" | "skipped";
  version: string;
  checksum: string;
  domainCount: number;
  tableName?: string;
  reason?: string;
};

export type AdultDomainFeedPublicationProvider = (
  input: AdultDomainFeedPublicationInput
) => Promise<AdultDomainFeedPublicationResult> | AdultDomainFeedPublicationResult;

let adultDomainFeedPublicationProvider: AdultDomainFeedPublicationProvider | null = null;

export function configureAdultDomainFeedPublicationProvider(provider: AdultDomainFeedPublicationProvider | null) {
  adultDomainFeedPublicationProvider = provider;
}

export async function publishAdultDomainFeedVersion(
  input: AdultDomainFeedPublicationInput
): Promise<AdultDomainFeedPublicationResult> {
  if (!input.readiness.ready) {
    return result(input.feed, {
      published: false,
      provider: "invalid",
      status: "invalid",
      reason: "Adult-domain feed failed readiness checks and was not published."
    });
  }

  if (adultDomainFeedPublicationProvider) {
    return sanitizeAdultDomainFeedPublicationResult(await adultDomainFeedPublicationProvider(input), input.feed);
  }

  return publishWithSupabase(input);
}

async function publishWithSupabase(input: AdultDomainFeedPublicationInput): Promise<AdultDomainFeedPublicationResult> {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tableName = readEnv("SUPABASE_ADULT_FEED_TABLE") ?? "adult_domain_feed_versions";

  if (!supabaseUrl || !serviceKey) {
    return result(input.feed, {
      published: false,
      provider: "unconfigured",
      status: "unconfigured",
      tableName,
      reason: "Supabase adult-domain feed publication is not configured."
    });
  }
  if (!isSupabaseServiceRoleKey(serviceKey)) {
    return result(input.feed, {
      published: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: "Supabase adult-domain feed service-role key is not production-shaped."
    });
  }

  const baseIssues = getProductionBaseUrlIssues(supabaseUrl, "Supabase adult-domain feed base URL");
  if (baseIssues.length > 0) {
    return result(input.feed, {
      published: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: baseIssues.map((issue) => issue.issue).join("; ")
    });
  }

  const endpoint = supabaseTableUrl(supabaseUrl, tableName);
  const endpointIssues = getProductionEndpointIssues(endpoint, "Supabase adult-domain feed endpoint");
  if (endpointIssues.length > 0) {
    return result(input.feed, {
      published: false,
      provider: "invalid",
      status: "invalid",
      tableName,
      reason: endpointIssues.map((issue) => issue.issue).join("; ")
    });
  }

  try {
    const timeoutMs = readBackendProviderTimeoutMs();
    const response = await fetchBackendProviderResponse(`${endpoint}?on_conflict=checksum`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        version: input.feed.version,
        checksum: input.feed.checksum,
        generated_at: input.feed.generatedAt,
        domain_count: input.feed.domains.length,
        safari_rule_count: input.safariRuleCount,
        rejected_normal_domain_count: input.rejectedNormalDomains.length,
        source_reports: input.sourceReports.map(sanitizeAdultDomainFeedSourceReport),
        readiness: sanitizeReadiness(input.readiness)
      })
    }, timeoutMs, "Supabase adult-domain feed publication request");

    if (!response.ok) throw new Error(`Supabase returned ${response.status}.`);

    return result(input.feed, {
      published: true,
      provider: "supabase",
      status: "ok",
      tableName
    });
  } catch (error) {
    return result(input.feed, {
      published: false,
      provider: "error",
      status: "error",
      tableName,
      reason: error instanceof Error ? error.message : "Adult-domain feed publication failed."
    });
  }
}

function sanitizeAdultDomainFeedPublicationResult(
  value: unknown,
  feed: AdultDomainFeed
): AdultDomainFeedPublicationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result(feed, {
      published: false,
      provider: "error",
      status: "error",
      reason: "Adult-domain feed publication provider returned a malformed response."
    });
  }
  const record = value as Partial<AdultDomainFeedPublicationResult>;
  return result(feed, {
    published: record.published === true && record.status === "ok",
    provider: cleanProvider(record.provider),
    status: cleanStatus(record.status),
    ...(typeof record.tableName === "string" ? { tableName: cleanToken(record.tableName, 80) } : {}),
    reason: record.reason
  });
}

function result(
  feed: AdultDomainFeed,
  patch: Omit<AdultDomainFeedPublicationResult, "version" | "checksum" | "domainCount" | "reason"> & {
    reason?: unknown;
  }
): AdultDomainFeedPublicationResult {
  const { reason: rawReason, ...safePatch } = patch;
  const reason = sanitizeReason(rawReason);
  return {
    ...safePatch,
    version: feed.version,
    checksum: feed.checksum,
    domainCount: feed.domains.length,
    ...(reason ? { reason } : {})
  };
}

export function sanitizeAdultDomainFeedSourceReport(report: AdultDomainFeedSourceReport) {
  return {
    id: cleanToken(report.id, 64),
    label: cleanText(report.label, 80),
    url: sanitizeSourceUrl(report.url),
    status: report.status,
    sourceLineCount: cleanCount(report.sourceLineCount, 1_000_000),
    domainCount: cleanCount(report.domainCount, 50_000),
    rejectedNormalDomainCount: cleanCount(report.rejectedNormalDomainCount, 50_000),
    issue: report.issue ? sanitizeReason(report.issue, 240) : undefined
  };
}

function sanitizeReadiness(value: AdultDomainFeedIngestionResult["readiness"]) {
  return {
    ready: value.ready,
    version: cleanText(value.version, 80),
    checksum: cleanText(value.checksum, 128),
    domainCount: cleanCount(value.domainCount, 50_000),
    sourceCount: cleanCount(value.sourceCount, 100),
    generatedAt: cleanText(value.generatedAt, 40),
    issues: value.issues.map((issue) => cleanText(issue, 160)).filter(Boolean)
  };
}

function sanitizeSourceUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 240);
  } catch {
    return cleanText(value, 120);
  }
}

function cleanToken(value: string, maxLength: number) {
  return value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength) || "unknown";
}

function cleanProvider(value: unknown): AdultDomainFeedPublicationResult["provider"] {
  return value === "supabase" ||
    value === "custom" ||
    value === "unconfigured" ||
    value === "invalid" ||
    value === "error" ||
    value === "skipped"
    ? value
    : "error";
}

function cleanStatus(value: unknown): AdultDomainFeedPublicationResult["status"] {
  return value === "ok" || value === "unconfigured" || value === "invalid" || value === "error" || value === "skipped"
    ? value
    : "error";
}

function sanitizeReason(value: unknown, maxLength = 180) {
  return redactOperationalText(value, maxLength);
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/[<>]/g, "").trim().slice(0, maxLength);
}

function cleanCount(value: number, max: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
}

function supabaseTableUrl(baseUrl: string, tableName: string) {
  try {
    return new URL(`/rest/v1/${encodeURIComponent(tableName)}`, baseUrl).toString();
  } catch {
    return baseUrl;
  }
}

function readEnv(key: string) {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : null;
}
