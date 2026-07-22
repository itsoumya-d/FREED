/** Server-only callable contracts. Never reuse these types in mobile persistence. */
export const COLLECTIONS = {
  aggregateAnalytics: "aggregate_analytics",
  backupMetadata: "backup_metadata",
  purchaseClaims: "purchase_claims",
  purchaseAudits: "purchase_audits",
  redactedAiEvents: "redacted_ai_events",
  backendJobs: "backend_jobs",
  rateLimits: "rate_limits",
  leases: "leases",
  pushTokens: "push_tokens",
  deletionTombstones: "deletion_tombstones",
  adultFeedMetadata: "adult_feed_metadata",
  idempotency: "idempotency"
} as const;

export type AggregateAnalyticsInput = { day: string; checkIns: number; completedChallenges: number; clientEventId: string };
export type BackupMetadataInput = { backupId: string; encryptedBytes: number; ciphertextSha256: string; clientEventId: string };
export type BackupIdentifierInput = { backupId: string };
export type BackupMutationInput = BackupIdentifierInput & { clientEventId: string };
export type PushTokenInput = { installationId: string; token: string; clientEventId: string };
export type DeletionRequestInput = { clientEventId: string };

/** These document shapes are server-only; direct mobile Firestore access is denied. */
export type AggregateAnalyticsDocument = { day: string; checkIns: number; completedChallenges: number; updatedAt: unknown; expiresAt: unknown };
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
export type PushTokenDocument = { uid: string; installationId: string; token: string; updatedAt: unknown; expiresAt: unknown };
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
  [COLLECTIONS.aggregateAnalytics]: ["day", "checkIns", "completedChallenges", "updatedAt", "expiresAt"],
  [COLLECTIONS.backupMetadata]: [
    "uid", "backupId", "expectedBytes", "verifiedBytes", "ciphertextSha256", "objectPath", "status",
    "uploadSessionId", "sentinelGeneration", "objectGeneration",
    "createdAt", "updatedAt", "verifiedAt", "expiresAt"
  ],
  [COLLECTIONS.purchaseClaims]: [
    "uid", "provider", "productId", "status", "storeReferenceHash", "orderReferenceHash", "verifiedAt", "entitlementExpiresAt"
  ],
  [COLLECTIONS.purchaseAudits]: [
    "uid", "provider", "productId", "status", "storeReferenceHash", "orderReferenceHash", "verifiedAt", "entitlementExpiresAt", "expiresAt"
  ],
  [COLLECTIONS.redactedAiEvents]: [
    "uid", "eventType", "outcome", "provider", "model", "crisisFallback", "inputCharacterCount",
    "outputCharacterCount", "generatedItemCount", "createdAt", "expiresAt"
  ],
  [COLLECTIONS.backendJobs]: ["kind", "uid", "status", "createdAt", "expiresAt"],
  [COLLECTIONS.rateLimits]: ["count", "windowStartedAt", "expiresAt"],
  [COLLECTIONS.leases]: ["owner", "acquiredAt", "expiresAt", "token"],
  [COLLECTIONS.pushTokens]: ["uid", "installationId", "token", "updatedAt", "expiresAt"],
  [COLLECTIONS.deletionTombstones]: ["uid", "requestedAt", "status", "expiresAt"],
  [COLLECTIONS.adultFeedMetadata]: ["version", "checksum", "source", "generatedAt", "publishedAt", "domainCount", "objectKey"],
  [COLLECTIONS.idempotency]: ["createdAt", "expiresAt"]
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
  for (const key of Object.keys(document)) {
    if (!SERVER_DOCUMENT_FIELDS[collection].includes(key) || (DISALLOWED_KEYS.test(key) && !allowedSensitiveNamedIdentifier(collection, key))) {
      throw new Error("Sensitive or unsupported server document.");
    }
  }
  return document;
}

function allowedSensitiveNamedIdentifier(collection: string, key: string): boolean {
  return key === "ciphertextSha256" ||
    (collection === COLLECTIONS.adultFeedMetadata && (key === "domainCount" || key === "objectKey"));
}

export function parseAggregateAnalytics(value: unknown): AggregateAnalyticsInput {
  const record = strictRecord(value, ["day", "checkIns", "completedChallenges", "clientEventId"]);
  const day = requiredString(record, "day");
  const checkIns = requiredInteger(record, "checkIns", 0, 100);
  const completedChallenges = requiredInteger(record, "completedChallenges", 0, 100);
  const clientEventId = requiredIdentifier(record, "clientEventId");
  if (!DAY.test(day)) throw new Error("Unsupported aggregate analytics day.");
  return { day, checkIns, completedChallenges, clientEventId };
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
  return {
    installationId: requiredIdentifier(record, "installationId"),
    token: requiredIdentifier(record, "token"),
    clientEventId: requiredIdentifier(record, "clientEventId")
  };
}

export function parseDeletionRequest(value: unknown): DeletionRequestInput {
  const record = strictRecord(value, ["clientEventId"]);
  return { clientEventId: requiredIdentifier(record, "clientEventId") };
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
