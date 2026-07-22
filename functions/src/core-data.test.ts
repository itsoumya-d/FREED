import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as coreData from "./core-data.js";

type CoreDataApi = {
  BACKUP_MAX_BYTES: number;
  SIGNED_URL_TTL_MS: number;
  USER_LINKED_RECORD_SCOPES: readonly string[];
  getBackupObjectPath: (uid: string, backupId: string) => string;
  getSignedUrlSpec: (action: "read" | "write", now: number, expectedBytes?: number) => {
    version: "v4";
    action: "read" | "write";
    expires: number;
    contentType?: string;
    extensionHeaders?: Readonly<Record<string, string>>;
  };
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
  assert.deepEqual(api.getSignedUrlSpec?.("write", 1_000, 42), {
    version: "v4",
    action: "write",
    expires: 601_000,
    contentType: "application/octet-stream",
    extensionHeaders: { "content-length": "42" }
  });
  assert.deepEqual(api.getSignedUrlSpec?.("read", 1_000), {
    version: "v4",
    action: "read",
    expires: 601_000
  });
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
    "purchase_audits",
    "deletion_tombstones"
  ]);
  assert.equal(api.USER_LINKED_RECORD_SCOPES.includes("aggregate_analytics"), false);

  const records = new Map(api.USER_LINKED_RECORD_SCOPES.map((scope) => [scope, new Set(["firebaseUid123", "otherUid"])]));
  const aggregateAnalytics = new Map([["2026-07-22", { checkIns: 4 }]]);
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
  assert.match(source, /if \(existing\.status === "verified"\) \{[\s\S]*?return \{ ok: true, duplicate: true, status: "verified"/);
  assert.match(source, /deleteFirebaseAccountData\(uid/);
});

async function* asAsyncBytes(chunks: readonly Uint8Array[]) {
  for (const chunk of chunks) yield chunk;
}
