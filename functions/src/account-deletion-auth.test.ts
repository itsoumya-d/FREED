import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { CallableRequest } from "firebase-functions/v2/https";

import * as coreData from "./core-data.js";

// A missing/removed gate must fail these behavior tests, including the real callable boundary.
const deletionAuth = coreData as unknown as {
  assertRecentAccountDeletionAuthentication: (input: { signInProvider?: unknown; authTime?: unknown }, now: number) => void;
};
const now = 1_000_000;
const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);

function ensureTestApp() {
  if (!getApps().length) {
    const projectId = process.env.GCLOUD_PROJECT ?? "freed-unit-tests";
    initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
  }
}

test("permanent account deletion rejects old, missing, malformed, and future authentication times", () => {
  for (const authTime of [699, undefined, "999", Number.NaN, Number.POSITIVE_INFINITY, -1, 1_001]) {
    assert.throws(() => deletionAuth.assertRecentAccountDeletionAuthentication({ signInProvider: "apple.com", authTime }, now), /Sign in again/);
  }
});

test("permanent account deletion accepts authentication at the five-minute boundary", () => {
  for (const signInProvider of ["apple.com", "google.com", "password", undefined]) {
    assert.doesNotThrow(() => deletionAuth.assertRecentAccountDeletionAuthentication({ signInProvider, authTime: 700 }, now));
    assert.doesNotThrow(() => deletionAuth.assertRecentAccountDeletionAuthentication({ signInProvider, authTime: 1_000 }, now));
  }
});

test("anonymous account deletion retains the guest policy without a recent permanent sign-in", () => {
  assert.doesNotThrow(() => deletionAuth.assertRecentAccountDeletionAuthentication({ signInProvider: "anonymous", authTime: 1 }, now));
  assert.doesNotThrow(() => deletionAuth.assertRecentAccountDeletionAuthentication({ signInProvider: "anonymous" }, now));
});

test("the deletion callable rejects stale permanent authentication before parsing or mutating user records", async () => {
  ensureTestApp();
  const { requestAccountDeletion } = await import("./index.js");
  await assert.rejects(() => requestAccountDeletion.run({
    auth: { uid: "userDeletionTest123", token: { auth_time: 1, firebase: { sign_in_provider: "apple.com" } } },
    data: { clientEventId: "" }
  } as unknown as CallableRequest), (error: unknown) => {
    assert.equal((error as { code: string }).code, "failed-precondition");
    return true;
  });
});

test("the deletion callable rejects a captured account UID that differs from the verified caller", async () => {
  ensureTestApp();
  const { requestAccountDeletion } = await import("./index.js");
  await assert.rejects(() => requestAccountDeletion.run({
    auth: { uid: "ownerB_12345678", token: { auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: "password" } } },
    data: { clientEventId: "delete_12345678", expectedAccountUid: "ownerA_12345678" }
  } as unknown as CallableRequest), (error: unknown) => {
    assert.equal((error as { code: string }).code, "permission-denied");
    return true;
  });
});

test("emulators preserve both accounts when captured deletion identity or recent auth is rejected", {
  skip: emulatorEnabled ? false : "requires Auth, Firestore, and Storage emulators"
}, async () => {
  ensureTestApp();
  const { requestAccountDeletion } = await import("./index.js");
  const db = getFirestore();
  const uidA = `ownerA_${randomUUID().replaceAll("-", "")}`;
  const uidB = `ownerB_${randomUUID().replaceAll("-", "")}`;
  const recordA = db.collection("push_tokens").doc(`${uidA}_install123`);
  const recordB = db.collection("push_tokens").doc(`${uidB}_install123`);
  await Promise.all([getAuth().createUser({ uid: uidA }), getAuth().createUser({ uid: uidB }), recordA.set({ uid: uidA }), recordB.set({ uid: uidB })]);
  try {
    for (const request of [
      { auth: { uid: uidB, token: { auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: "password" } } }, data: { expectedAccountUid: uidA, clientEventId: "delete_12345678" } },
      { auth: { uid: uidA, token: { auth_time: 1, firebase: { sign_in_provider: "password" } } }, data: { expectedAccountUid: uidA, clientEventId: "delete_12345678" } }
    ]) await assert.rejects(() => requestAccountDeletion.run(request as unknown as CallableRequest));
    assert.equal((await recordA.get()).exists, true);
    assert.equal((await recordB.get()).exists, true);
    assert.equal((await db.collection("deletion_tombstones").doc(uidA).get()).exists, false);
    assert.equal((await db.collection("deletion_tombstones").doc(uidB).get()).exists, false);
    assert.equal((await getAuth().getUser(uidA)).uid, uidA);
    assert.equal((await getAuth().getUser(uidB)).uid, uidB);
  } finally {
    await Promise.all([getAuth().deleteUser(uidA), getAuth().deleteUser(uidB), recordA.delete(), recordB.delete()]);
  }
});

test("emulators delete guest data and identity and keep repeated deletion safely fenced", {
  skip: emulatorEnabled ? false : "requires Auth, Firestore, and Storage emulators"
}, async () => {
  ensureTestApp();
  const { requestAccountDeletion } = await import("./index.js");
  const db = getFirestore();
  const uid = `guest_${randomUUID().replaceAll("-", "")}`;
  const record = db.collection("push_tokens").doc(`${uid}_install123`);
  const tombstone = db.collection("deletion_tombstones").doc(uid);
  const file = getStorage().bucket().file(`recovery-backups/${uid}/backup_12345678.bin`);
  await Promise.all([getAuth().createUser({ uid }), record.set({ uid }), file.save(Buffer.from("synthetic ciphertext"), { resumable: false })]);
  const request = { auth: { uid, token: { auth_time: 1, firebase: { sign_in_provider: "anonymous" } } }, data: { expectedAccountUid: uid, clientEventId: "delete_12345678" } } as unknown as CallableRequest;
  try {
    assert.deepEqual(await requestAccountDeletion.run(request), { ok: true, status: "completed" });
    assert.equal((await record.get()).exists, false);
    assert.equal((await file.exists())[0], false);
    await assert.rejects(() => getAuth().getUser(uid), (error: unknown) => (error as { code: string }).code === "auth/user-not-found");
    const marker = (await tombstone.get()).data();
    assert.equal(marker?.status, "cooldown");
    assert.equal(marker?.expiresAt instanceof Timestamp, true);
    assert.ok(marker!.expiresAt.toMillis() > Date.now());
    assert.deepEqual(await requestAccountDeletion.run(request), { ok: true, status: "completed" });
    assert.equal((await tombstone.get()).data()?.status, "cooldown");
    assert.equal((await record.get()).exists, false);
    assert.equal((await file.exists())[0], false);
  } finally {
    await Promise.all([tombstone.delete(), file.delete({ ignoreNotFound: true }), record.delete()]);
  }
});

test("emulators reject a stale anonymous token after its UID has been linked to a permanent identity", {
  skip: emulatorEnabled ? false : "requires Auth, Firestore, and Storage emulators"
}, async () => {
  ensureTestApp();
  const { requestAccountDeletion } = await import("./index.js");
  const uid = `linked_${randomUUID().replaceAll("-", "")}`;
  const record = getFirestore().collection("push_tokens").doc(`${uid}_install123`);
  const tombstone = getFirestore().collection("deletion_tombstones").doc(uid);
  await Promise.all([getAuth().createUser({ uid, email: `${uid}@example.invalid` }), record.set({ uid })]);
  try {
    await assert.rejects(() => requestAccountDeletion.run({
      auth: { uid, token: { auth_time: 1, firebase: { sign_in_provider: "anonymous" } } },
      data: { expectedAccountUid: uid, clientEventId: "delete_12345678" }
    } as unknown as CallableRequest), (error: unknown) => (error as { code: string }).code === "failed-precondition");
    assert.equal((await record.get()).exists, true);
    assert.equal((await getAuth().getUser(uid)).uid, uid);
    assert.equal((await tombstone.get()).exists, false);
  } finally {
    await Promise.all([getAuth().deleteUser(uid).catch(() => undefined), record.delete(), tombstone.delete()]);
  }
});
