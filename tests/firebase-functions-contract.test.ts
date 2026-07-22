import assert from "node:assert/strict";

import {
  createFirebaseCallableContracts,
  type FirebaseCallableTransport
} from "../src/lib/firebase-client";

async function run() {
  const calls: Array<{ name: string; data: unknown }> = [];
  const transport: FirebaseCallableTransport = {
    call: async (name, data) => {
      calls.push({ name, data });
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
  await assert.rejects(
    () => callables.registerBackupMetadata({ backupId: "bkp_12345678", encryptedBytes: 10, ciphertextSha256: "a".repeat(64), clientEventId: "evt_12345678", encryptedEnvelope: "never" } as never),
    /not permitted/i
  );
  assert.deepEqual(await callables.requestAccountDeletion({ clientEventId: "evt_12345678" }), { ok: true });
  assert.equal(calls[1]?.name, "requestAccountDeletion");
  console.log("firebase callable contract tests passed");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
