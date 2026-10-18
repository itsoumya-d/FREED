import { isFcmRegistrationToken } from "./notifications.js";

/** Server-only callable contracts. Never reuse these types in mobile persistence. */
export const COLLECTIONS = {
  aggregateAnalytics: "aggregate_analytics",
  backupMetadata: "backup_metadata",
  purchaseClaims: "purchase_claims",
  purchaseAudits: "purchase_audits",
  purchaseNotificationReceipts: "purchase_notification_receipts",
  purchaseAccountFences: "purchase_account_fences",
  redactedAiEvents: "redacted_ai_events",
  backendJobs: "backend_jobs",
  rateLimits: "rate_limits",
  leases: "leases",
  pushTokens: "push_tokens",
  notificationJobs: "notification_jobs",
  deletionTombstones: "deletion_tombstones",
  adultFeedMetadata: "adult_feed_metadata",
  // Admin-only DNS metadata has separate strict controller schemas. Device
  // consent survives account detachment; these paths join bounded TTL cleanup.
  recoveryDnsInstallations: "recoveryDnsInstallations",
  recoveryDnsOwners: "recoveryDnsOwners",
  recoveryDnsPilot: "recoveryDnsPilot",
  recoveryDnsRequests: "recoveryDnsRequests",
  idempotency: "idempotency"
} as const;

export const ANALYTICS_SNAPSHOT_SCHEMA_VERSION = "aggregate-snapshot-v1";
export type AggregateAnalyticsDay = { day: string; checkIns: number; completedChallenges: number };
export type AggregateAnalyticsSnapshotInput = {
  schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION; lineageId: string; baseRevision: number; snapshotId: string;
  days: AggregateAnalyticsDay[]; consentVersion: "analytics-consent-v1"; userOptedInAt: string; dataRetentionDays: 14;
};
export type AggregateAnalyticsInput = { day: string; checkIns: number; completedChallenges: number; clientEventId: string } | AggregateAnalyticsSnapshotInput;
export type BackupMetadataInput = { backupId: string; encryptedBytes: number; ciphertextSha256: string; clientEventId: string };
export type BackupIdentifierInput = { backupId: string };
export type BackupMutationInput = BackupIdentifierInput & { clientEventId: string };
export type PushTokenInput = { installationId: string; token: string; clientEventId: string };
export type DeletionRequestInput = { clientEventId: string; expectedAccountUid: string };
export const REVIEW_ACCESS_VERSION = 1 as const;
export type ReviewAccessState = { reviewAccessVersion: typeof REVIEW_ACCESS_VERSION; ownerUid: string } & (
  | { access: "none"; expiresAt: null; capabilities: [] }
  | { access: "review"; expiresAt: string; capabilities: ["ad-free", "premium-features"] }
);
export type ReviewAccessDocument = {
  uid: string; kind: "review-access-v1"; status: "active" | "revoked"; createdAt: unknown; expiresAt: unknown;
};

export const JOURNEY_OFFER_VERSION = 1 as const;
export type JourneyOfferState = { offerVersion: typeof JOURNEY_OFFER_VERSION; acknowledged: boolean };
export type JourneyOfferAcknowledgementInput = {
  offerVersion: typeof JOURNEY_OFFER_VERSION;
  decision: "free" | "purchased";
  eventId: string;
};
export type JourneyOfferAcknowledgementDocument = {
  uid: string;
  kind: "journey-offer-v1";
  status: JourneyOfferAcknowledgementInput["decision"];
  createdAt: unknown;
};

/** These document shapes are server-only; direct mobile Firestore access is denied. */
export type AggregateAnalyticsDocument =
  | { day: string; checkIns: number; completedChallenges: number; updatedAt: unknown; expiresAt: unknown }
  | { uid: string; schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION; lineageId: string; revision: number; snapshotId: string; updatedAt: unknown; expiresAt: unknown }
  | { uid: string; schemaVersion: typeof ANALYTICS_SNAPSHOT_SCHEMA_VERSION; lineageId: string; day: string; checkIns: number; completedChallenges: number; updatedAt: unknown; expiresAt: unknown };
export type BackupMetadataDocument = {
  uid: string;
  backupId: string;
  expectedBytes: number;
  verifiedBytes?: number;
  ciphertextSha256: string;
  objectPath: string;
  status: "preparing" | "uploading" | "verifying" | "verified" | "invalid";
  uploadSessionId: string;
  sentinelGeneration?: string;
  objectGeneration?: string;
  createdAt: unknown;
  updatedAt: unknown;
  verifiedAt?: unknown;
  expiresAt: unknown;
};
export type PurchaseClaimDocument = {
  uid: string;
  provider: string;
  productId: string;
  status: string;
  storeReferenceHash: string;
  orderReferenceHash?: string;
  storeAccountTokenHash?: string;
  verifiedAt: unknown;
  entitlementExpiresAt?: unknown;
};
export type PurchaseAuditDocument = PurchaseClaimDocument & { expiresAt: unknown };
export type RedactedAiEventDocument = {
  uid: string;
  eventType: string;
  outcome: string;
  provider: string;
  model: string;
  crisisFallback: boolean;
  inputCharacterCount: number;
  outputCharacterCount?: number;
  generatedItemCount?: number;
  createdAt: unknown;
  expiresAt: unknown;
};
export type BackendJobDocument = { kind: string; uid?: string; status: string; createdAt: unknown; expiresAt: unknown };
export type RateLimitDocument = { count: number; windowStartedAt: number; expiresAt: number };
export type LeaseDocument = { owner: string; acquiredAt: number; expiresAt: number; token?: number };
export type PushTokenDocument = { uid: string; installationId: string; token: string; createdAt: unknown; updatedAt: unknown; expiresAt: unknown };
export type NotificationJobDocument = {
  uid: string;
  templateId: string;
  route: "checkin";
  status: string;
  scheduledAt: unknown;
  createdAt: unknown;
  claimedAt?: unknown;
  dispatchedAt?: unknown;
  attemptCount: number;
  expiresAt: unknown;
  successCount?: number;
  failureCount?: number;
  invalidTokenCount?: number;
};
export type DeletionTombstoneDocument =
  | { uid: string; requestedAt: unknown; status: "deleting"; expiresAt?: never }
  | { uid: string; requestedAt: unknown; status: "cooldown"; expiresAt: unknown };
export type AdultFeedMetadataDocument = {
  version: string;
  checksum: string;
  source: string;
  generatedAt: unknown;
  publishedAt: unknown;
  domainCount: number;
  objectKey: string;
};

const SERVER_DOCUMENT_FIELDS: Record<string, readonly string[]> = {
  [COLLECTIONS.aggregateAnalytics]: ["uid", "day", "checkIns", "completedChallenges", "schemaVersion", "lineageId", "revision", "snapshotId", "updatedAt", "expiresAt"],
  [COLLECTIONS.backupMetadata]: [
    "uid", "backupId", "expectedBytes", "verifiedBytes", "ciphertextSha256", "objectPath", "status",
    "uploadSessionId", "sentinelGeneration", "objectGeneration",
    "createdAt", "updatedAt", "verifiedAt", "expiresAt"
  ],
  [COLLECTIONS.purchaseClaims]: [
    "uid", "provider", "productId", "status", "storeReferenceHash", "orderReferenceHash", "storeAccountTokenHash", "verifiedAt", "entitlementExpiresAt"
  ],
  [COLLECTIONS.purchaseAudits]: [
    "uid", "provider", "productId", "status", "storeReferenceHash", "orderReferenceHash", "storeAccountTokenHash", "verifiedAt", "entitlementExpiresAt", "expiresAt"
  ],
  [COLLECTIONS.purchaseNotificationReceipts]: ["eventIdHash", "provider", "processedAt", "expiresAt"],
  [COLLECTIONS.purchaseAccountFences]: ["uid", "status", "createdAt", "updatedAt"],
  [COLLECTIONS.redactedAiEvents]: [
    "uid", "eventType", "outcome", "provider", "model", "crisisFallback", "inputCharacterCount",
    "outputCharacterCount", "generatedItemCount", "createdAt", "expiresAt"
  ],
  [COLLECTIONS.backendJobs]: ["kind", "uid", "status", "createdAt", "expiresAt"],
  [COLLECTIONS.rateLimits]: ["count", "windowStartedAt", "expiresAt"],
  [COLLECTIONS.leases]: ["owner", "acquiredAt", "expiresAt", "token"],
  [COLLECTIONS.pushTokens]: ["uid", "installationId", "token", "createdAt", "updatedAt", "expiresAt"],
  [COLLECTIONS.notificationJobs]: [
    "uid", "templateId", "route", "status", "scheduledAt", "createdAt", "claimedAt", "dispatchedAt",
    "attemptCount", "expiresAt", "successCount", "failureCount", "invalidTokenCount"
  ],
  [COLLECTIONS.deletionTombstones]: ["uid", "requestedAt", "status", "expiresAt"],
  [COLLECTIONS.adultFeedMetadata]: ["version", "checksum", "source", "generatedAt", "publishedAt", "domainCount", "objectKey"],
  [COLLECTIONS.idempotency]: ["createdAt", "expiresAt", "schemaVersion", "lineageId", "snapshotId", "acceptedRevision"]
};

const DISALLOWED_KEYS = /(?:url|uri|host|domain|recovery|seed|mnemonic|receipt|note|accessibility|envelope|ciphertext|content|text|message|body|screenshot)/i;
const IDENTIFIER = /^[A-Za-z0-9_-]{8,200}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Rejects unsafe text rather than attempting to log or persist it. */
export function redactAndValidate(value: unknown): never {
  if (typeof value === "string" && !/^[A-Za-z0-9_-]{8,200}$/.test(value)) {
    throw new Error("Sensitive or unsupported payload content is not accepted.");
  }
  throw new Error("Sensitive or unsupported payload content is not accepted.");
}

/** Defensive whitelist for Admin writes; this is not callable input validation. */
export function validateServerDocument(collection: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || !SERVER_DOCUMENT_FIELDS[collection]) {
    throw new Error("Sensitive or unsupported server document.");
  }
  const document = value as Record<string, unknown>;
  if (collection === COLLECTIONS.aggregateAnalytics && "uid" in document &&
      (document.schemaVersion !== ANALYTICS_SNAPSHOT_SCHEMA_VERSION || typeof document.lineageId !== "string" || !/^lin_[a-f0-9]{32}$/.test(document.lineageId))) {
    throw new Error("Sensitive or unsupported server document.");
  }
  if ("storeAccountTokenHash" in document && (typeof document.storeAccountTokenHash !== "string" || !/^[a-f0-9]{64}$/.test(document.storeAccountTokenHash))) {
    throw new Error("Sensitive or unsupported server document.");
  }
  for (const key of Object.keys(document)) {
    if (!SERVER_DOCUMENT_FIELDS[collection].includes(key) || (DISALLOWED_KEYS.test(key) && !allowedSensitiveNamedIdentifier(collection, key))) {
      throw new Error("Sensitive or unsupported server document.");
    }
  }
  return document;
}

function allowedSensitiveNamedIdentifier(collection: string, key: string): boolean {
  return key === "ciphertextSha256" ||
    ((collection === COLLECTIONS.purchaseClaims || collection === COLLECTIONS.purchaseAudits) && key === "storeAccountTokenHash") ||
    (collection === COLLECTIONS.adultFeedMetadata && (key === "domainCount" || key === "objectKey"));
}

export function parseAggregateAnalytics(value: unknown): AggregateAnalyticsInput {
  if (value && typeof value === "object" && "schemaVersion" in value) return parseAggregateAnalyticsSnapshot(value);
  const record = strictRecord(value, ["day", "checkIns", "completedChallenges", "clientEventId"]);
  const day = requiredString(record, "day");
  const checkIns = requiredInteger(record, "checkIns", 0, 100);
  const completedChallenges = requiredInteger(record, "completedChallenges", 0, 100);
  const clientEventId = requiredIdentifier(record, "clientEventId");
  if (!DAY.test(day)) throw new Error("Unsupported aggregate analytics day.");
  return { day, checkIns, completedChallenges, clientEventId };
}

export function parseAggregateAnalyticsSnapshot(value: unknown): AggregateAnalyticsSnapshotInput {
  const record = strictRecord(value, ["schemaVersion", "lineageId", "baseRevision", "snapshotId", "days", "consentVersion", "userOptedInAt", "dataRetentionDays"]);
  if (record.schemaVersion !== ANALYTICS_SNAPSHOT_SCHEMA_VERSION || record.consentVersion !== "analytics-consent-v1" || record.dataRetentionDays !== 14) throw new Error("Unsupported aggregate snapshot schema or consent.");
  const lineageId = requiredIdentifier(record, "lineageId");
  const snapshotId = requiredIdentifier(record, "snapshotId");
  if (!/^lin_[a-f0-9]{32}$/.test(lineageId) || !/^snap_[a-f0-9]{64}$/.test(snapshotId)) throw new Error("Unsupported aggregate snapshot identity.");
  const baseRevision = requiredInteger(record, "baseRevision", 0, Number.MAX_SAFE_INTEGER - 1);
  const userOptedInAt = requiredString(record, "userOptedInAt");
  if (!Number.isFinite(Date.parse(userOptedInAt))) throw new Error("Explicit analytics consent is required.");
  if (!Array.isArray(record.days) || record.days.length !== 14) throw new Error("Aggregate snapshot must contain 14 UTC days.");
  const days = record.days.map((value, index): AggregateAnalyticsDay => {
    const bucket = strictRecord(value, ["day", "checkIns", "completedChallenges"]);
    const day = requiredString(bucket, "day");
    const timestamp = Date.parse(`${day}T00:00:00.000Z`);
    if (!DAY.test(day) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== day ||
        (index > 0 && timestamp - Date.parse(`${(record.days as Array<{day: string}>)[index - 1].day}T00:00:00.000Z`) !== 86_400_000)) throw new Error("Unsupported aggregate snapshot UTC day.");
    return { day, checkIns: requiredInteger(bucket, "checkIns", 0, Number.MAX_SAFE_INTEGER),
      completedChallenges: requiredInteger(bucket, "completedChallenges", 0, Number.MAX_SAFE_INTEGER) };
  });
  return { schemaVersion: ANALYTICS_SNAPSHOT_SCHEMA_VERSION, lineageId, baseRevision, snapshotId, days,
    consentVersion: "analytics-consent-v1", userOptedInAt, dataRetentionDays: 14 };
}

export function parseBackupMetadataHandshake(value: unknown): BackupMetadataInput {
  const record = strictRecord(value, ["backupId", "encryptedBytes", "ciphertextSha256", "clientEventId"]);
  const backupId = requiredIdentifier(record, "backupId");
  const encryptedBytes = requiredInteger(record, "encryptedBytes", 0, 100 * 1024 * 1024);
  const ciphertextSha256 = requiredString(record, "ciphertextSha256");
  const clientEventId = requiredIdentifier(record, "clientEventId");
  if (!SHA256.test(ciphertextSha256)) throw new Error("Unsupported backup metadata hash.");
  return { backupId, encryptedBytes, ciphertextSha256, clientEventId };
}

export function parseStartBackupUpload(value: unknown): BackupMetadataInput {
  return parseBackupMetadataHandshake(value);
}

export function parseFinalizeBackupUpload(value: unknown): BackupMutationInput {
  return parseBackupMutation(value);
}

export function parseBackupDownload(value: unknown): BackupIdentifierInput {
  const record = strictRecord(value, ["backupId"]);
  return { backupId: requiredIdentifier(record, "backupId") };
}

export function parseDeleteBackup(value: unknown): BackupMutationInput {
  return parseBackupMutation(value);
}

export function parsePushTokenRegistration(value: unknown): PushTokenInput {
  const record = strictRecord(value, ["installationId", "token", "clientEventId"]);
  if (!isFcmRegistrationToken(record.token)) throw new Error("Unsupported FCM registration token.");
  return {
    installationId: requiredIdentifier(record, "installationId"),
    token: record.token,
    clientEventId: requiredIdentifier(record, "clientEventId")
  };
}

export function parseDeletionRequest(value: unknown): DeletionRequestInput {
  const record = strictRecord(value, ["clientEventId", "expectedAccountUid"]);
  return {
    clientEventId: requiredIdentifier(record, "clientEventId"),
    expectedAccountUid: requiredIdentifier(record, "expectedAccountUid")
  };
}

/** Offer metadata accepts no owner identity, recovery answers, or authority fields. */
export function parseJourneyOfferAcknowledgement(value: unknown): JourneyOfferAcknowledgementInput {
  const record = strictRecord(value, ["offerVersion", "decision", "eventId"]);
  if (record.offerVersion !== JOURNEY_OFFER_VERSION || (record.decision !== "free" && record.decision !== "purchased")) {
    throw new Error("Unsupported journey offer acknowledgement.");
  }
  const eventId = requiredIdentifier(record, "eventId");
  if (!/^journey_[a-f0-9]{32}$/.test(eventId)) throw new Error("Unsupported journey offer event identifier.");
  return { offerVersion: JOURNEY_OFFER_VERSION, decision: record.decision, eventId };
}

/** Review authority cannot be selected, provisioned or renewed by a caller payload. */
export function parseReviewAccessRequest(value: unknown): void {
  if (value !== undefined && value !== null) throw new Error("No review access payload is permitted.");
}

export function parseJourneyOfferStateRequest(value: unknown): void {
  if (value !== undefined && value !== null) throw new Error("No journey offer selection payload is permitted.");
}

function parseBackupMutation(value: unknown): BackupMutationInput {
  const record = strictRecord(value, ["backupId", "clientEventId"]);
  return {
    backupId: requiredIdentifier(record, "backupId"),
    clientEventId: requiredIdentifier(record, "clientEventId")
  };
}

function strictRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unsupported callable payload.");
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    // Whitelisting is deliberate: ciphertextSha256 is a one-way identifier,
    // while fields such as encryptedEnvelope remain forbidden.
    if (!allowedKeys.includes(key) || (DISALLOWED_KEYS.test(key) && key !== "ciphertextSha256")) {
      throw new Error("Sensitive or unsupported payload field.");
    }
  }
  return record;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > 200) {
    throw new Error("Sensitive or unsupported payload content is not accepted.");
  }
  return value;
}

function requiredIdentifier(record: Record<string, unknown>, key: string): string {
  const value = requiredString(record, key);
  if (!IDENTIFIER.test(value)) throw new Error("Unsupported identifier.");
  return value;
}

function requiredInteger(record: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error("Unsupported aggregate value.");
  }
  return value as number;
}
