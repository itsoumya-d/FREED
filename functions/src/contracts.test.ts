import assert from "node:assert/strict";
import test from "node:test";

import {
  COLLECTIONS,
  parseAggregateAnalytics,
  parseBackupMetadataHandshake,
  parseDeletionRequest,
  parsePushTokenRegistration,
  redactAndValidate,
  validateServerDocument
} from "./contracts.js";

import * as contracts from "./contracts.js";

test("aggregate analytics accepts only bounded aggregate values", () => {
  assert.deepEqual(
    parseAggregateAnalytics({ day: "2026-07-22", checkIns: 2, completedChallenges: 1, clientEventId: "evt_12345678" }),
    { day: "2026-07-22", checkIns: 2, completedChallenges: 1, clientEventId: "evt_12345678" }
  );
});

test("contracts reject raw hosts, URLs, recovery text, receipts, notes, and accessibility data", () => {
  for (const value of ["https://private.example/path", "adult.example", "seed phrase words", "receipt-data", "private note", "accessibility snapshot"]) {
    assert.throws(() => redactAndValidate(value), /sensitive or unsupported/i);
  }
  assert.throws(() => parseAggregateAnalytics({ day: "2026-07-22", checkIns: 1, url: "https://private.example" }), /unsupported/i);
});

test("backup handshake stores metadata and cryptographic identifiers but no envelope", () => {
  assert.deepEqual(
    parseBackupMetadataHandshake({
      backupId: "bkp_12345678",
      encryptedBytes: 42,
      ciphertextSha256: "a".repeat(64),
      clientEventId: "evt_abcdefgh"
    }),
    { backupId: "bkp_12345678", encryptedBytes: 42, ciphertextSha256: "a".repeat(64), clientEventId: "evt_abcdefgh" }
  );
  assert.throws(() => parseBackupMetadataHandshake({ backupId: "bkp_12345678", encryptedEnvelope: "secret" }), /unsupported/i);
});

test("push token and deletion callable contracts are minimal", () => {
  const realFcmToken = "fcmRegistrationPrefix123:APA91bG9uZ19yZWFsX3NoYXBlZF90b2tlbi0xMjM0NTY3ODkw";
  assert.deepEqual(
    parsePushTokenRegistration({ installationId: "iid_12345678", token: realFcmToken, clientEventId: "evt_abcdefgh" }),
    { installationId: "iid_12345678", token: realFcmToken, clientEventId: "evt_abcdefgh" }
  );
  for (const invalid of ["short", "your-fcm-token-placeholder", `prefix:${"x".repeat(4_096)}`]) {
    assert.throws(
      () => parsePushTokenRegistration({ installationId: "iid_12345678", token: invalid, clientEventId: "evt_abcdefgh" }),
      /unsupported/i
    );
  }
  assert.throws(() => parsePushTokenRegistration({
    installationId: "iid_12345678",
    token: realFcmToken,
    clientEventId: "evt_abcdefgh",
    title: "arbitrary copy"
  }), /unsupported/i);
  assert.deepEqual(parseDeletionRequest({ clientEventId: "evt_abcdefgh" }), { clientEventId: "evt_abcdefgh" });
});

test("server document schemas reject forbidden fields on every collection family", () => {
  assert.deepEqual(validateServerDocument("adult_feed_metadata", { version: "v1", checksum: "a".repeat(64) }), { version: "v1", checksum: "a".repeat(64) });
  assert.throws(() => validateServerDocument("redacted_ai_events", { eventType: "coach", privateNote: "never" }), /sensitive or unsupported/i);
});

test("notification job documents allow only reviewed queue metadata and aggregate counts", () => {
  const document = {
    uid: "firebaseUid123",
    templateId: "night-guard",
    route: "checkin",
    status: "dispatched",
    scheduledAt: 1,
    createdAt: 1,
    claimedAt: 2,
    dispatchedAt: 3,
    attemptCount: 1,
    expiresAt: 4,
    successCount: 1,
    failureCount: 1,
    invalidTokenCount: 1
  };
  assert.deepEqual(validateServerDocument(COLLECTIONS.notificationJobs, document), document);
  for (const forbidden of ["token", "title", "body", "url", "domain", "providerBody", "recoveryNote"]) {
    assert.throws(
      () => validateServerDocument(COLLECTIONS.notificationJobs, { ...document, [forbidden]: "never" }),
      /sensitive or unsupported/i
    );
  }
});

test("redacted AI audit documents have an exact operational metadata allowlist", () => {
  const event = {
    uid: "firebaseUid123",
    eventType: "clara",
    outcome: "fallback",
    provider: "local",
    model: "gpt-5.6-terra",
    crisisFallback: true,
    inputCharacterCount: 24,
    outputCharacterCount: 180,
    createdAt: 1,
    expiresAt: 2
  };
  assert.deepEqual(validateServerDocument(COLLECTIONS.redactedAiEvents, event), event);
  for (const forbidden of ["prompt", "response", "privateNote", "url", "providerBody", "providerRequestId", "rawError"]) {
    assert.throws(() => validateServerDocument(COLLECTIONS.redactedAiEvents, { ...event, [forbidden]: "never" }), /sensitive or unsupported/i);
  }
});

test("purchase claim and audit schemas permit hashes but never raw store references", () => {
  const claim = {
    uid: "firebaseUid123",
    provider: "apple",
    productId: "freed_premium_monthly",
    status: "verified",
    storeReferenceHash: "a".repeat(64),
    orderReferenceHash: "b".repeat(64),
    verifiedAt: 1
  };
  assert.deepEqual(validateServerDocument(COLLECTIONS.purchaseClaims, claim), claim);
  assert.deepEqual(validateServerDocument(COLLECTIONS.purchaseAudits, { ...claim, expiresAt: 2 }), { ...claim, expiresAt: 2 });
  for (const forbidden of ["transactionId", "purchaseToken", "orderId", "signedTransactionInfo", "providerBody", "rawError"]) {
    assert.throws(() => validateServerDocument(COLLECTIONS.purchaseClaims, { ...claim, [forbidden]: "never" }), /sensitive or unsupported/i);
    assert.throws(() => validateServerDocument(COLLECTIONS.purchaseAudits, { ...claim, expiresAt: 2, [forbidden]: "never" }), /sensitive or unsupported/i);
  }
});

test("anonymous aggregate analytics documents cannot contain a Firebase UID", () => {
  assert.deepEqual(
    validateServerDocument(COLLECTIONS.aggregateAnalytics, {
      day: "2026-07-22",
      checkIns: 2,
      completedChallenges: 1,
      updatedAt: 1,
      expiresAt: 2
    }),
    { day: "2026-07-22", checkIns: 2, completedChallenges: 1, updatedAt: 1, expiresAt: 2 }
  );
  assert.throws(
    () => validateServerDocument(COLLECTIONS.aggregateAnalytics, {
      uid: "firebase-user-123",
      day: "2026-07-22",
      checkIns: 2,
      completedChallenges: 1,
      updatedAt: 1,
      expiresAt: 2
    }),
    /sensitive or unsupported/i
  );
});

test("encrypted backup callable payloads are strict allowlists with a 100 MiB ceiling", () => {
  const api = contracts as unknown as Record<string, (value: unknown) => unknown>;
  assert.equal(typeof api.parseStartBackupUpload, "function");
  assert.deepEqual(
    api.parseStartBackupUpload?.({
      backupId: "bkp_12345678",
      encryptedBytes: 100 * 1024 * 1024,
      ciphertextSha256: "a".repeat(64),
      clientEventId: "evt_abcdefgh"
    }),
    {
      backupId: "bkp_12345678",
      encryptedBytes: 100 * 1024 * 1024,
      ciphertextSha256: "a".repeat(64),
      clientEventId: "evt_abcdefgh"
    }
  );
  assert.throws(() => api.parseStartBackupUpload?.({
    backupId: "bkp_12345678",
    encryptedBytes: 100 * 1024 * 1024 + 1,
    ciphertextSha256: "a".repeat(64),
    clientEventId: "evt_abcdefgh"
  }), /unsupported/i);
  assert.throws(() => api.parseStartBackupUpload?.({
    backupId: "bkp_12345678",
    encryptedBytes: 42,
    ciphertextSha256: "a".repeat(64),
    clientEventId: "evt_abcdefgh",
    objectPath: "client/chosen.bin"
  }), /unsupported/i);
});

test("finalize, download, and delete backup payloads expose no object path or content", () => {
  const api = contracts as unknown as Record<string, (value: unknown) => unknown>;
  assert.equal(typeof api.parseFinalizeBackupUpload, "function");
  assert.equal(typeof api.parseBackupDownload, "function");
  assert.equal(typeof api.parseDeleteBackup, "function");
  assert.deepEqual(api.parseFinalizeBackupUpload?.({ backupId: "bkp_12345678", clientEventId: "evt_finalize1" }), {
    backupId: "bkp_12345678",
    clientEventId: "evt_finalize1"
  });
  assert.deepEqual(api.parseBackupDownload?.({ backupId: "bkp_12345678" }), { backupId: "bkp_12345678" });
  assert.deepEqual(api.parseDeleteBackup?.({ backupId: "bkp_12345678", clientEventId: "evt_delete12" }), {
    backupId: "bkp_12345678",
    clientEventId: "evt_delete12"
  });
  assert.throws(() => api.parseBackupDownload?.({ backupId: "bkp_12345678", url: "https://private.example" }), /unsupported/i);
  assert.throws(() => api.parseDeleteBackup?.({ backupId: "bkp_12345678", encryptedEnvelope: "never" }), /unsupported/i);
});

test("backup metadata can bind only server-owned upload sessions and object generations", () => {
  const document = {
    uid: "firebaseUid123",
    backupId: "bkp_12345678",
    expectedBytes: 42,
    ciphertextSha256: "a".repeat(64),
    objectPath: "recovery-backups/firebaseUid123/bkp_12345678.bin",
    status: "verifying",
    uploadSessionId: "session_12345678",
    sentinelGeneration: "17",
    objectGeneration: "18",
    createdAt: 1,
    updatedAt: 2,
    expiresAt: 3
  };
  assert.deepEqual(validateServerDocument(COLLECTIONS.backupMetadata, document), document);
});

test("deletion tombstones distinguish non-expiring deletion from bounded cooldown", () => {
  assert.deepEqual(validateServerDocument(COLLECTIONS.deletionTombstones, {
    uid: "firebaseUid123",
    requestedAt: 1,
    status: "deleting"
  }), { uid: "firebaseUid123", requestedAt: 1, status: "deleting" });
  assert.deepEqual(validateServerDocument(COLLECTIONS.deletionTombstones, {
    uid: "firebaseUid123",
    requestedAt: 1,
    status: "cooldown",
    expiresAt: 2
  }), { uid: "firebaseUid123", requestedAt: 1, status: "cooldown", expiresAt: 2 });
});
