import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Storage } from "@google-cloud/storage";

import * as coreData from "./core-data.js";

type CoreDataApi = {
  BACKUP_MAX_BYTES: number;
  SIGNED_URL_TTL_MS: number;
  ACCOUNT_DELETION_COOLDOWN_MS: number;
  USER_LINKED_RECORD_SCOPES: readonly string[];
  getBackupObjectPath: (uid: string, backupId: string) => string;
  getSignedUrlSpec: (action: "read" | "write", now: number, expectedBytes: number | undefined, generation: string) => {
    version: "v4";
    action: "read" | "write";
    expires: number;
    contentType?: string;
    extensionHeaders?: Readonly<Record<string, string>>;
    queryParams?: Readonly<Record<string, string>>;
  };
  assertBackupStartAllowed: (metadata: BackupState | undefined) => void;
  createVerificationClaim: (metadata: BackupState, objectGeneration: string) => VerificationClaim;
  assertVerificationCommit: (metadata: BackupState, claim: VerificationClaim) => void;
  assertAcceptableContentEncoding: (contentEncoding: string | undefined) => void;
  verifyCiphertext: (input: {
    source: AsyncIterable<Uint8Array>;
    expectedBytes: number;
    expectedSha256: string;
    removeInvalid: () => Promise<void>;
  }) => Promise<{ ok: boolean; verifiedBytes: number; sha256: string }>;
  requireVerifiedBackup: (input: {
    requesterUid: string;
    backupId: string;
    metadata: { uid: string; backupId: string; objectPath: string; status: string } | undefined;
  }) => string;
  deleteEncryptedBackup: (input: {
    objectPath: string;
    deleteObject: (path: string) => Promise<void>;
    deleteMetadata: () => Promise<void>;
    isObjectNotFound: (error: unknown) => boolean;
  }) => Promise<void>;
  deleteFirebaseAccountData: (uid: string, deps: {
    deleteBackupObjects: (uid: string) => Promise<void>;
    deleteRecords: (scope: string, uid: string) => Promise<void>;
    deleteAuthIdentity: (uid: string) => Promise<void>;
  }) => Promise<void>;
  sweepFirebaseAccountDeletion: (uid: string, now: number, deps: AccountDeletionDeps) => Promise<{
    status: "cooldown";
    expiresAt: number;
  }>;
  getDeletionFenceAction: (
    fence: { status: "deleting" } | { status: "cooldown"; expiresAt: number },
    now: number
  ) => "retry" | "retain" | "remove";
};

type AccountDeletionDeps = {
  deleteBackupObjects: (uid: string) => Promise<void>;
  deleteRecords: (scope: string, uid: string) => Promise<void>;
  deleteAuthIdentity: (uid: string) => Promise<void>;
};

type BackupState = {
  uid: string;
  backupId: string;
  expectedBytes: number;
  ciphertextSha256: string;
  objectPath: string;
  status: "preparing" | "uploading" | "verifying" | "verified" | "invalid";
  uploadSessionId: string;
  sentinelGeneration?: string;
  objectGeneration?: string;
};

type VerificationClaim = {
  uploadSessionId: string;
  sentinelGeneration: string;
  objectGeneration: string;
  expectedBytes: number;
  ciphertextSha256: string;
  objectPath: string;
};

const api = coreData as unknown as CoreDataApi;

test("Firebase core data workflow module is available", async () => {
  const modulePath: string = "./core-data.js";
  const module = await import(modulePath).catch(() => null);
  assert.ok(module, "expected the Firebase core data workflow module to exist");
});

test("backup paths are server-derived and V4 signed URLs expire within ten minutes", () => {
  assert.equal(api.BACKUP_MAX_BYTES, 100 * 1024 * 1024);
  assert.equal(api.SIGNED_URL_TTL_MS, 10 * 60 * 1000);
  assert.equal(
    api.getBackupObjectPath?.("firebaseUid123", "bkp_12345678"),
    "recovery-backups/firebaseUid123/bkp_12345678.bin"
  );
  assert.deepEqual(api.getSignedUrlSpec?.("write", 1_000, 42, "17"), {
    version: "v4",
    action: "write",
    expires: 601_000,
    contentType: "application/octet-stream",
    extensionHeaders: {
      "content-length": "42",
      "x-goog-if-generation-match": "17"
    }
  });
  assert.deepEqual(api.getSignedUrlSpec?.("read", 1_000, undefined, "29"), {
    version: "v4",
    action: "read",
    expires: 601_000,
    queryParams: { generation: "29" }
  });
});

test("production signed-upload contract rejects stale and replayed generations", () => {
  const spec = api.getSignedUrlSpec?.("write", 1_000, 42, "17");
  assert.equal(spec?.extensionHeaders?.["x-goog-if-generation-match"], "17");
  assert.equal(spec?.queryParams?.ifGenerationMatch, undefined);

  let currentGeneration = "17";
  const applyProductionPrecondition = () => {
    const signedGeneration = spec?.extensionHeaders?.["x-goog-if-generation-match"];
    if (signedGeneration !== currentGeneration) throw new Error("generation precondition failed");
    currentGeneration = "18";
  };
  assert.doesNotThrow(applyProductionPrecondition);
  assert.throws(applyProductionPrecondition, /generation precondition failed/i);
  currentGeneration = "19";
  assert.throws(applyProductionPrecondition, /generation precondition failed/i);
});

test("Google Cloud V4 signer includes the generation precondition in signed headers", async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const storage = new Storage({
    projectId: "contract-project",
    credentials: {
      client_email: "signer@contract-project.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    }
  });
  const [signedUrl] = await storage.bucket("contract-bucket").file("backup.bin").getSignedUrl(
    api.getSignedUrlSpec("write", Date.now(), 42, "17")
  );
  const parsed = new URL(signedUrl);
  assert.match(parsed.searchParams.get("X-Goog-SignedHeaders") ?? "", /(?:^|;)x-goog-if-generation-match(?:;|$)/);
  assert.equal(parsed.searchParams.has("ifGenerationMatch"), false);
});

test("concurrent starts and verified overwrite attempts are refused", () => {
  const preparing = backupState({ status: "preparing" });
  assert.throws(() => api.assertBackupStartAllowed?.(preparing), /backup id is already active/i);
  assert.throws(() => api.assertBackupStartAllowed?.(backupState({ status: "verifying" })), /backup id is already active/i);
  assert.throws(() => api.assertBackupStartAllowed?.(backupState({ status: "verified" })), /backup id is already active/i);
  assert.doesNotThrow(() => api.assertBackupStartAllowed?.(undefined));
  assert.doesNotThrow(() => api.assertBackupStartAllowed?.(backupState({ status: "invalid" })));
});

test("concurrent finalize and stale generations cannot commit verification", () => {
  const uploading = backupState({ status: "uploading", sentinelGeneration: "17" });
  const claim = api.createVerificationClaim?.(uploading, "18");
  assert.deepEqual(claim, {
    uploadSessionId: uploading.uploadSessionId,
    sentinelGeneration: "17",
    objectGeneration: "18",
    expectedBytes: uploading.expectedBytes,
    ciphertextSha256: uploading.ciphertextSha256,
    objectPath: uploading.objectPath
  });
  assert.throws(() => api.createVerificationClaim?.({ ...uploading, status: "verifying" }, "18"), /not ready for finalization/i);
  assert.throws(() => api.createVerificationClaim?.(uploading, "17"), /fresh uploaded generation/i);

  const verifying = { ...uploading, status: "verifying" as const, objectGeneration: "18" };
  assert.doesNotThrow(() => api.assertVerificationCommit?.(verifying, claim));
  assert.throws(
    () => api.assertVerificationCommit?.({ ...verifying, uploadSessionId: "stale_session_123" }, claim),
    /verification session changed/i
  );
  assert.throws(
    () => api.assertVerificationCommit?.({ ...verifying, objectGeneration: "19" }, claim),
    /verification session changed/i
  );
});

test("compressed ciphertext metadata is rejected", () => {
  assert.doesNotThrow(() => api.assertAcceptableContentEncoding?.(undefined));
  assert.doesNotThrow(() => api.assertAcceptableContentEncoding?.("identity"));
  assert.throws(() => api.assertAcceptableContentEncoding?.("gzip"), /content encoding is not permitted/i);
});

test("ciphertext finalization verifies byte count and SHA-256 without parsing an envelope", async () => {
  const bytes = [Buffer.from("encrypted-"), Buffer.from("ciphertext")];
  const expected = createHash("sha256").update(Buffer.concat(bytes)).digest("hex");
  let removed = false;
  const result = await api.verifyCiphertext?.({
    source: asAsyncBytes(bytes),
    expectedBytes: Buffer.concat(bytes).byteLength,
    expectedSha256: expected,
    removeInvalid: async () => { removed = true; }
  });
  assert.deepEqual(result, {
    ok: true,
    verifiedBytes: Buffer.concat(bytes).byteLength,
    sha256: expected
  });
  assert.equal(removed, false);
});

test("size or hash mismatch remains unverified and removes the invalid object", async () => {
  const bytes = [Buffer.from("ciphertext")];
  const digest = createHash("sha256").update(bytes[0]!).digest("hex");
  for (const mismatch of [
    { expectedBytes: bytes[0]!.byteLength + 1, expectedSha256: digest },
    { expectedBytes: bytes[0]!.byteLength, expectedSha256: "0".repeat(64) }
  ]) {
    let removals = 0;
    const result = await api.verifyCiphertext?.({
      source: asAsyncBytes(bytes),
      ...mismatch,
      removeInvalid: async () => { removals += 1; }
    });
    assert.equal(result?.ok, false);
    assert.equal(removals, 1);
  }
});

test("download is allowed only for verified metadata owned by the requester", () => {
  const metadata = {
    uid: "firebaseUid123",
    backupId: "bkp_12345678",
    objectPath: "recovery-backups/firebaseUid123/bkp_12345678.bin",
    status: "verified"
  };
  assert.equal(api.requireVerifiedBackup?.({ requesterUid: "firebaseUid123", backupId: "bkp_12345678", metadata }), metadata.objectPath);
  assert.throws(() => api.requireVerifiedBackup?.({
    requesterUid: "firebaseUid123",
    backupId: "bkp_12345678",
    metadata: { ...metadata, status: "uploading" }
  }), /verified backup is not available/i);
  assert.throws(() => api.requireVerifiedBackup?.({ requesterUid: "differentUid", backupId: "bkp_12345678", metadata }), /verified backup is not available/i);
});

test("encrypted backup deletion is idempotent", async () => {
  let objectExists = true;
  let metadataExists = true;
  const operation = () => api.deleteEncryptedBackup?.({
    objectPath: "recovery-backups/firebaseUid123/bkp_12345678.bin",
    deleteObject: async () => {
      if (!objectExists) throw Object.assign(new Error("not found"), { code: 404 });
      objectExists = false;
    },
    deleteMetadata: async () => { metadataExists = false; },
    isObjectNotFound: (error) => (error as { code?: number }).code === 404
  });
  await operation();
  await operation();
  assert.equal(objectExists, false);
  assert.equal(metadataExists, false);
});

test("account deletion removes every user-linked record and identity but preserves anonymous analytics", async () => {
  assert.deepEqual(api.USER_LINKED_RECORD_SCOPES, [
    "backup_metadata",
    "push_tokens",
    "redacted_ai_events",
    "backend_jobs",
    "rate_limits",
    "leases",
    "idempotency",
    "purchase_audits"
  ]);
  assert.equal(api.USER_LINKED_RECORD_SCOPES.includes("aggregate_analytics"), false);
  assert.equal(api.USER_LINKED_RECORD_SCOPES.includes("deletion_tombstones"), false);

  const records = new Map(api.USER_LINKED_RECORD_SCOPES.map((scope) => [scope, new Set(["firebaseUid123", "otherUid"])]));
  const aggregateAnalytics = new Map([["2026-07-22", { checkIns: 4 }]]);
  const deletionSafetyTombstone = new Map([["firebaseUid123", { status: "deleting" }]]);
  const identities = new Set(["firebaseUid123", "otherUid"]);
  const calls: string[] = [];
  await api.deleteFirebaseAccountData?.("firebaseUid123", {
    deleteBackupObjects: async (uid) => { calls.push(`objects:${uid}`); },
    deleteRecords: async (scope, uid) => { calls.push(`${scope}:${uid}`); records.get(scope)?.delete(uid); },
    deleteAuthIdentity: async (uid) => { calls.push(`auth:${uid}`); identities.delete(uid); }
  });

  for (const scope of api.USER_LINKED_RECORD_SCOPES) assert.deepEqual([...records.get(scope)!], ["otherUid"]);
  assert.equal(identities.has("firebaseUid123"), false);
  assert.deepEqual([...aggregateAnalytics.entries()], [["2026-07-22", { checkIns: 4 }]]);
  assert.equal(deletionSafetyTombstone.get("firebaseUid123")?.status, "deleting");
  assert.equal(calls.at(-1), "auth:firebaseUid123");
});

test("partial account deletion fails closed and can be retried before deleting Auth", async () => {
  let failOnce = true;
  let identityExists = true;
  const deps = {
    deleteBackupObjects: async () => undefined,
    deleteRecords: async (scope: string) => {
      if (scope === "backend_jobs" && failOnce) {
        failOnce = false;
        throw new Error("temporary Firestore failure");
      }
    },
    deleteAuthIdentity: async () => { identityExists = false; }
  };
  await assert.rejects(() => api.deleteFirebaseAccountData?.("firebaseUid123", deps), /temporary Firestore failure/i);
  assert.equal(identityExists, true);
  await api.deleteFirebaseAccountData?.("firebaseUid123", deps);
  assert.equal(identityExists, false);
});

test("failed deletion keeps a non-expiring retry fence and retries to cooldown", async () => {
  const deleting = { status: "deleting" as const };
  assert.equal(api.getDeletionFenceAction?.(deleting, Number.MAX_SAFE_INTEGER), "retry");
  let failOnce = true;
  let authDeletes = 0;
  const deps: AccountDeletionDeps = {
    deleteBackupObjects: async () => undefined,
    deleteRecords: async (scope) => {
      if (scope === "backend_jobs" && failOnce) {
        failOnce = false;
        throw new Error("temporary Firestore failure");
      }
    },
    deleteAuthIdentity: async () => { authDeletes += 1; }
  };

  await assert.rejects(() => api.sweepFirebaseAccountDeletion?.("firebaseUid123", 1_000, deps), /temporary Firestore failure/i);
  assert.equal(authDeletes, 0);
  assert.equal(api.getDeletionFenceAction?.(deleting, Number.MAX_SAFE_INTEGER), "retry");

  const cooldown = await api.sweepFirebaseAccountDeletion?.("firebaseUid123", 1_000, deps);
  assert.deepEqual(cooldown, { status: "cooldown", expiresAt: 1_000 + api.ACCOUNT_DELETION_COOLDOWN_MS });
  assert.equal(authDeletes, 1);
});

test("deletion cooldown is retained until its safe expiry and only then removed", () => {
  assert.ok(api.ACCOUNT_DELETION_COOLDOWN_MS >= 60 * 60 * 1000);
  assert.ok(api.ACCOUNT_DELETION_COOLDOWN_MS > api.SIGNED_URL_TTL_MS);
  const expiresAt = 1_000 + api.ACCOUNT_DELETION_COOLDOWN_MS;
  const cooldown = { status: "cooldown" as const, expiresAt };
  assert.equal(api.getDeletionFenceAction?.(cooldown, expiresAt - 1), "retain");
  assert.equal(api.getDeletionFenceAction?.(cooldown, expiresAt), "remove");
});

test("callable integration uses anonymous daily increments and the complete backup workflow", () => {
  const source = readFileSync("src/index.ts", "utf8");
  for (const callable of [
    "startEncryptedBackupUpload",
    "finalizeEncryptedBackupUpload",
    "getEncryptedBackupDownload",
    "deleteEncryptedBackup"
  ]) {
    assert.match(source, new RegExp(`export const ${callable} = onCall\\(\\{ enforceAppCheck: true`));
  }
  assert.doesNotMatch(source, /export const registerEncryptedBackupMetadata/);
  const analyticsHandler = source.slice(
    source.indexOf("export const ingestAggregateAnalytics"),
    source.indexOf("export const startEncryptedBackupUpload")
  );
  assert.match(analyticsHandler, /COLLECTIONS\.aggregateAnalytics, input\.day/);
  assert.match(analyticsHandler, /FieldValue\.increment\(input\.checkIns\)/);
  assert.match(analyticsHandler, /FieldValue\.increment\(input\.completedChallenges\)/);
  assert.doesNotMatch(analyticsHandler, /\buid\s*,\s*\n\s*day:/);
  assert.match(source, /getBackupObjectPath\(uid, input\.backupId\)/);
  assert.match(source, /verifyCiphertext\(/);
  assert.match(source, /requireVerifiedBackup\(/);
  assert.match(source, /if \(owned\.status === "verified"\) \{[\s\S]*?return \{ ok: true, duplicate: true, status: "verified"/);
  assert.match(source, /sweepFirebaseAccountDeletion\(uid/);
});

test("callable integration binds Storage and verification to immutable generations", () => {
  const source = readFileSync("src/index.ts", "utf8");
  assert.match(source, /createUploadSentinel\(/);
  assert.match(source, /status: "preparing"/);
  assert.match(source, /uploadSessionId/);
  assert.match(source, /sentinelGeneration/);
  assert.match(source, /objectGeneration/);
  assert.match(source, /createVerificationClaim\(/);
  assert.match(source, /assertVerificationCommit\(/);
  assert.match(source, /createReadStream\(\{ decompress: false \}\)/);
  assert.match(source, /assertAcceptableContentEncoding\(/);
  assert.match(source, /accountTombstonePath:/);
  assert.match(source, /ensureAccountActive\(uid\)/);
  assert.match(source, /"x-goog-if-generation-match": sentinelGeneration/);
  assert.match(source, /requiredHeaders:[\s\S]*?"x-goog-if-generation-match": sentinelGeneration/);
});

test("account deletion integration reports a fence, retries deleting records, and only expires cooldown", () => {
  const source = readFileSync("src/index.ts", "utf8");
  const deletionHandler = source.slice(
    source.indexOf("export const requestAccountDeletion"),
    source.indexOf("export const cleanupExpiredServerRecords")
  );
  assert.doesNotMatch(deletionHandler, /status:\s*"completed"/);
  assert.match(deletionHandler, /status:\s*"deleting"/);
  const initialFenceWrite = deletionHandler.slice(
    deletionHandler.indexOf("await mutate(uid, \"deletion\""),
    deletionHandler.indexOf("}, false);")
  );
  assert.doesNotMatch(initialFenceWrite, /expiresAt/);
  assert.match(source, /export const retryPendingAccountDeletions = onSchedule/);
  assert.match(source, /where\("status", "==", "deleting"\)/);
  assert.match(source, /status !== "cooldown"/);
  assert.match(source, /Object\.values\(COLLECTIONS\)\.filter\([\s\S]*COLLECTIONS\.deletionTombstones/);
});

async function* asAsyncBytes(chunks: readonly Uint8Array[]) {
  for (const chunk of chunks) yield chunk;
}

function backupState(overrides: Partial<BackupState>): BackupState {
  return {
    uid: "firebaseUid123",
    backupId: "bkp_12345678",
    expectedBytes: 42,
    ciphertextSha256: "a".repeat(64),
    objectPath: "recovery-backups/firebaseUid123/bkp_12345678.bin",
    status: "uploading",
    uploadSessionId: "session_12345678",
    sentinelGeneration: "17",
    ...overrides
  };
}
