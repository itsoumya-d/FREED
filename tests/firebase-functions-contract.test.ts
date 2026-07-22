import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createFirebaseCallableContracts,
  type FirebaseCallableTransport
} from "../src/lib/firebase-client";

async function run() {
  const calls: Array<{ name: string; data: unknown }> = [];
  const transport: FirebaseCallableTransport = {
    call: async (name, data) => {
      calls.push({ name, data });
      if (name === "getReviewedAdultDomainFeed") return {
        version: "oisd-nsfw-small-0123456789abcdef",
        generatedAt: "2026-07-22T06:30:00.000Z",
        publishedAt: "2026-07-22T06:30:00.000Z",
        checksum: "0".repeat(64),
        source: { id: "oisd-nsfw-small", label: "OISD NSFW Small", url: "https://nsfw-small.oisd.nl/" },
        domains: ["example.xxx"]
      };
      if (name === "startEncryptedBackupUpload") return {
        ok: true,
        requiredHeaders: {
          "content-type": "application/octet-stream",
          "content-length": "10",
          "x-goog-if-generation-match": "17"
        }
      };
      if (name === "requestAccountDeletion") return { ok: true, status: "deleting" };
      return { ok: true };
    }
  };
  const callables = createFirebaseCallableContracts(transport);

  assert.deepEqual(
    await callables.ingestAggregateAnalytics({ day: "2026-07-22", checkIns: 1, completedChallenges: 0, clientEventId: "evt_12345678" }),
    { ok: true }
  );
  assert.deepEqual(calls[0], {
    name: "ingestAggregateAnalytics",
    data: { day: "2026-07-22", checkIns: 1, completedChallenges: 0, clientEventId: "evt_12345678" }
  });
  assert.deepEqual(await callables.startBackupUpload({
    backupId: "bkp_12345678",
    encryptedBytes: 10,
    ciphertextSha256: "a".repeat(64),
    clientEventId: "evt_upload123"
  }), {
    ok: true,
    requiredHeaders: {
      "content-type": "application/octet-stream",
      "content-length": "10",
      "x-goog-if-generation-match": "17"
    }
  });
  assert.equal(calls[1]?.name, "startEncryptedBackupUpload");
  assert.deepEqual(await callables.finalizeBackupUpload({ backupId: "bkp_12345678", clientEventId: "evt_finish123" }), { ok: true });
  assert.equal(calls[2]?.name, "finalizeEncryptedBackupUpload");
  assert.deepEqual(await callables.getBackupDownload({ backupId: "bkp_12345678" }), { ok: true });
  assert.equal(calls[3]?.name, "getEncryptedBackupDownload");
  assert.deepEqual(await callables.deleteBackup({ backupId: "bkp_12345678", clientEventId: "evt_delete123" }), { ok: true });
  assert.equal(calls[4]?.name, "deleteEncryptedBackup");
  await assert.rejects(
    () => callables.startBackupUpload({
      backupId: "bkp_12345678",
      encryptedBytes: 10,
      ciphertextSha256: "a".repeat(64),
      clientEventId: "evt_upload123",
      objectPath: "chosen/by-client.bin"
    } as never),
    /not permitted/i
  );
  assert.deepEqual(await callables.requestAccountDeletion({ clientEventId: "evt_12345678" }), { ok: true, status: "deleting" });
  assert.equal(calls[5]?.name, "requestAccountDeletion");
  assert.deepEqual(await callables.getReviewedAdultDomainFeed(), {
    version: "oisd-nsfw-small-0123456789abcdef",
    generatedAt: "2026-07-22T06:30:00.000Z",
    publishedAt: "2026-07-22T06:30:00.000Z",
    checksum: "0".repeat(64),
    source: { id: "oisd-nsfw-small", label: "OISD NSFW Small", url: "https://nsfw-small.oisd.nl/" },
    domains: ["example.xxx"]
  });
  assert.deepEqual(calls[6], { name: "getReviewedAdultDomainFeed", data: undefined });

  const indexSource = readFileSync("functions/src/index.ts", "utf8");
  const feedFunctionSource = readFileSync("functions/src/adult-feed-firebase.ts", "utf8");
  assert.match(indexSource, /getReviewedAdultDomainFeed/);
  assert.match(indexSource, /refreshReviewedAdultDomainFeed/);
  assert.match(feedFunctionSource, /onCall\(\{[^}]*enforceAppCheck:\s*true[^}]*\}/);
  assert.match(feedFunctionSource, /requireAuthenticatedUid\(request\.auth\?\.uid\)/);
  assert.match(feedFunctionSource, /onSchedule\(\{[\s\S]*schedule:\s*"every 24 hours"[\s\S]*timeZone:\s*"Asia\/Kolkata"/);
  assert.equal(feedFunctionSource.match(/region:\s*"asia-south1"/g)?.length, 2);

  for (const ruleFile of ["firestore.rules", "storage.rules"]) {
    const rules = readFileSync(ruleFile, "utf8");
    assert.match(rules, /allow read, write: if false;/, `${ruleFile} must keep direct mobile access denied`);
    assert.doesNotMatch(rules, /allow\s+(?:read|write)(?:,\s*(?:read|write))?\s*:\s*if\s+(?!false\b)/);
  }
  console.log("firebase callable contract tests passed");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
