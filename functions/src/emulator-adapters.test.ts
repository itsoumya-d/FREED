import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { getSignedUrlSpec } from "./core-data.js";
import { runProtectedMutation, type TransactionalStore } from "./transactional.js";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST);

test("Firestore emulator prevents post-tombstone mutation recreation and preserves anonymous aggregates", {
  skip: emulatorEnabled ? false : "requires the Firebase Emulator Suite"
}, async () => {
  const { projectId } = emulatorProject();
  const db = getFirestore(emulatorApp());
  const uid = `emulatorUser_${randomUUID().replaceAll("-", "")}`;
  const tombstone = db.collection("deletion_tombstones").doc(uid);
  const aggregate = db.collection("aggregate_analytics").doc(`2099-12-${String(Math.floor(Math.random() * 20) + 10)}`);
  const business = db.collection("push_tokens").doc(`${uid}_installation`);
  await aggregate.set({ day: aggregate.id, checkIns: 7, completedChallenges: 3 });
  await tombstone.set({ uid, status: "deleting" });

  const result = await db.runTransaction(async (transaction) => runProtectedMutation({
    get: async <T extends object>(path: string) => {
      const snapshot = await transaction.get(db.doc(path));
      return { value: snapshot.exists ? snapshot.data() as T : undefined };
    },
    set: async (path: string, value: object) => { transaction.set(db.doc(path), value); }
  } satisfies TransactionalStore, {
    rateLimitPath: `rate_limits/${uid}_push-token`,
    idempotencyPath: `idempotency/${uid}_push-token_event1234`,
    accountTombstonePath: `deletion_tombstones/${uid}`,
    now: Date.now(),
    windowMs: 60_000,
    limit: 10,
    idempotencyTtlMs: 60_000
  }, () => { transaction.set(business, { uid, token: "never-created" }); }));

  assert.equal(result, "account-deleting");
  assert.equal((await business.get()).exists, false);
  assert.equal((await db.doc(`rate_limits/${uid}_push-token`).get()).exists, false);
  assert.equal((await db.doc(`idempotency/${uid}_push-token_event1234`).get()).exists, false);
  assert.deepEqual((await aggregate.get()).data(), { day: aggregate.id, checkIns: 7, completedChallenges: 3 });

  await tombstone.set({ uid, status: "cooldown", expiresAt: new Date(Date.now() + 60_000) });
  const cooldownBusiness = db.collection("push_tokens").doc(`${uid}_cooldown-installation`);
  const cooldownResult = await db.runTransaction(async (transaction) => runProtectedMutation({
    get: async <T extends object>(path: string) => {
      const snapshot = await transaction.get(db.doc(path));
      return { value: snapshot.exists ? snapshot.data() as T : undefined };
    },
    set: async (path: string, value: object) => { transaction.set(db.doc(path), value); }
  } satisfies TransactionalStore, {
    rateLimitPath: `rate_limits/${uid}_cooldown-push-token`,
    idempotencyPath: `idempotency/${uid}_cooldown-push-token_event1234`,
    accountTombstonePath: `deletion_tombstones/${uid}`,
    now: Date.now(),
    windowMs: 60_000,
    limit: 10,
    idempotencyTtlMs: 60_000
  }, () => { transaction.set(cooldownBusiness, { uid, token: "never-created" }); }));
  assert.equal(cooldownResult, "account-deleting");
  assert.equal((await cooldownBusiness.get()).exists, false);

  await Promise.all([tombstone.delete(), aggregate.delete()]);
  assert.ok(projectId);
});

test("Storage emulator exercises sentinel generation, stale precondition, and deletion behavior", {
  skip: emulatorEnabled ? false : "requires the Firebase Emulator Suite"
}, async (context) => {
  const bucket = getStorage(emulatorApp()).bucket(emulatorProject().storageBucket);
  const objectPath = `recovery-backups/emulatorUser_${randomUUID().replaceAll("-", "")}/backup_12345678.bin`;
  const file = bucket.file(objectPath);
  await file.save(Buffer.alloc(0), {
    resumable: false,
    validation: false,
    contentType: "application/octet-stream",
    preconditionOpts: { ifGenerationMatch: 0 }
  });
  const [sentinelMetadata] = await file.getMetadata();
  const sentinelGeneration = String(sentinelMetadata.generation);
  const sentinelGenerationNumber = Number(sentinelGeneration);
  assert.equal(Number.isSafeInteger(sentinelGenerationNumber), true);
  const signedSpec = getSignedUrlSpec("write", 1_000, 10, sentinelGeneration);
  assert.equal(signedSpec.extensionHeaders["x-goog-if-generation-match"], sentinelGeneration);
  assert.equal("queryParams" in signedSpec, false);

  await file.save(Buffer.from("ciphertext"), {
    resumable: false,
    validation: false,
    contentType: "application/octet-stream",
    preconditionOpts: { ifGenerationMatch: sentinelGenerationNumber }
  });
  const [uploadedMetadata] = await file.getMetadata();
  assert.notEqual(String(uploadedMetadata.generation), sentinelGeneration);
  const replayRejected = await rejectsWithPrecondition(() => file.save(Buffer.from("replay-data"), {
      resumable: false,
      validation: false,
      contentType: "application/octet-stream",
      preconditionOpts: { ifGenerationMatch: sentinelGenerationNumber }
    }));
  if (!replayRejected) {
    const [replayedMetadata] = await file.getMetadata();
    assert.notEqual(String(replayedMetadata.generation), String(uploadedMetadata.generation));
    context.diagnostic("Firebase Storage emulator accepted a stale ifGenerationMatch; production GCS must be integration-verified.");
  }

  await file.delete({ ignoreNotFound: true });
  const deletionReplayRejected = await rejectsWithPrecondition(() => file.save(Buffer.from("after-delete"), {
    resumable: false,
    validation: false,
    contentType: "application/octet-stream",
    preconditionOpts: { ifGenerationMatch: sentinelGenerationNumber }
  }));
  if (!deletionReplayRejected) {
    const [recreatedMetadata] = await file.getMetadata();
    assert.notEqual(String(recreatedMetadata.generation), sentinelGeneration);
    context.diagnostic("Firebase Storage emulator also accepted stale generation after deletion; object was cleaned up by the test.");
    await file.delete({ ignoreNotFound: true });
  }
});

function emulatorApp() {
  const existing = getApps()[0];
  if (existing) return existing;
  const { projectId, storageBucket } = emulatorProject();
  return initializeApp({ projectId, storageBucket });
}

function emulatorProject(): { projectId: string; storageBucket: string } {
  const config = parseFirebaseConfig();
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? config.projectId ?? "freed-7d5ee";
  return {
    projectId,
    storageBucket: config.storageBucket ?? `${projectId}.firebasestorage.app`
  };
}

function parseFirebaseConfig(): { projectId?: string; storageBucket?: string } {
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG ?? "{}") as { projectId?: string; storageBucket?: string };
  } catch {
    return {};
  }
}

function isPreconditionFailure(error: unknown): boolean {
  const code = (error as { code?: number | string } | undefined)?.code;
  return code === 409 || code === "409" || code === 412 || code === "412";
}

async function rejectsWithPrecondition(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch (error) {
    if (!isPreconditionFailure(error)) throw error;
    return true;
  }
}
