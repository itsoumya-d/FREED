import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAggregateAnalytics,
  parseBackupMetadataHandshake,
  parseDeletionRequest,
  parsePushTokenRegistration,
  redactAndValidate,
  validateServerDocument
} from "./contracts.js";

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
  assert.deepEqual(
    parsePushTokenRegistration({ installationId: "iid_12345678", token: "fcm_12345678", clientEventId: "evt_abcdefgh" }),
    { installationId: "iid_12345678", token: "fcm_12345678", clientEventId: "evt_abcdefgh" }
  );
  assert.deepEqual(parseDeletionRequest({ clientEventId: "evt_abcdefgh" }), { clientEventId: "evt_abcdefgh" });
});

test("server document schemas reject forbidden fields on every collection family", () => {
  assert.deepEqual(validateServerDocument("adult_feed_metadata", { version: "v1", checksum: "a".repeat(64) }), { version: "v1", checksum: "a".repeat(64) });
  assert.throws(() => validateServerDocument("redacted_ai_events", { eventType: "coach", privateNote: "never" }), /sensitive or unsupported/i);
});
