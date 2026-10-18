import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST);
const options = { skip: enabled ? false : "requires isolated Auth, Firestore, and Storage emulators" };
const DAY = 86_400_000;
function isCode(code: string) { return (error: unknown) => (error as { code: string }).code === code; }

async function fixture() {
  const projectId = process.env.GCLOUD_PROJECT;
  assert.ok(projectId?.startsWith("demo-"), "This test may use only a Firebase demo project");
  if (!getApps().length) initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
  const f = createRequire(__filename)("./foundation.js") as Record<string, any>;
  const authSdk = getAuth();
  const db = getFirestore();
  const uid = `review_${randomUUID().replaceAll("-", "")}`;
  const email = `${uid}@example.test`;
  const password = "isolated-review-test-password";
  await authSdk.createUser({ uid, email, password });
  await authSdk.setCustomUserClaims(uid, { reviewFixture: true, premium: false });
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-test-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  assert.equal(response.status, 200);
  const result = await response.json() as { idToken: string };
  const token = await authSdk.verifyIdToken(result.idToken);
  assert.equal(token.uid, uid);
  assert.equal(token.firebase.sign_in_provider, "password");
  const auth = { uid: token.uid, token };
  const marker = db.doc(`backend_jobs/${uid}_review-access-v1`);
  const rate = db.doc(`rate_limits/${uid}_review-access-read`);
  const tombstone = db.doc(`deletion_tombstones/${uid}`);
  const claim = db.doc(`purchase_claims/review_claim_${uid}`);
  const now = Date.now();
  const record = { uid, kind: "review-access-v1", status: "active", createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + 14 * DAY) };
  return {
    f, authSdk, db, uid, auth, marker, rate, tombstone, claim, record,
    get: (data?: unknown) => f.getReviewAccess.run({ auth, data }),
    none: { reviewAccessVersion: 1, ownerUid: uid, access: "none", expiresAt: null, capabilities: [] },
    async cleanup() { await Promise.all([marker.delete(), rate.delete(), tombstone.delete(), claim.delete(), authSdk.deleteUser(uid).catch(() => undefined)]); }
  };
}

test("real Firestore review reads use verified demo Auth, remain immutable, derive fixed caps and never mutate claims or paid authority", options, async () => {
  const x = await fixture();
  try {
    assert.deepEqual(await x.get(null), x.none);
    assert.equal((await x.marker.get()).exists, false);
    for (const data of [{ ownerUid: x.uid }, { uid: "otherOwner" }, { capabilities: ["premium-features"] }, { expiresAt: new Date().toISOString() }]) {
      await assert.rejects(() => x.get(data), isCode("invalid-argument"));
    }
    assert.equal((await x.rate.get()).data()?.count, 1, "Malformed requests never reach database rate control");
    const claim = { uid: x.uid, status: "inactive", productId: "freed_premium_yearly" };
    await x.claim.set(claim);
    await x.marker.set(x.record);
    const beforeClaims = (await x.authSdk.getUser(x.uid)).customClaims;
    assert.deepEqual(await x.get(), { reviewAccessVersion: 1, ownerUid: x.uid, access: "review", expiresAt: x.record.expiresAt.toDate().toISOString(), capabilities: ["ad-free", "premium-features"] });
    assert.deepEqual((await x.marker.get()).data(), x.record);
    assert.deepEqual((await x.claim.get()).data(), claim);
    assert.deepEqual((await x.authSdk.getUser(x.uid)).customClaims, beforeClaims);
    const messaging = getMessaging();
    const original = messaging.sendEachForMulticast;
    let dispatches = 0;
    messaging.sendEachForMulticast = (async () => { dispatches += 1; throw new Error("Review metadata cannot dispatch notifications"); }) as typeof original;
    try { await x.f.dispatchReviewedNotifications.run({ scheduleTime: new Date().toISOString() }); }
    finally { messaging.sendEachForMulticast = original; }
    assert.equal(dispatches, 0);
    assert.deepEqual((await x.marker.get()).data(), x.record);
    assert.equal(typeof x.f.provisionReviewAccess, "undefined");
    assert.equal(typeof x.f.renewReviewAccess, "undefined");
  } finally { await x.cleanup(); }
});

test("real review adapter rejects malformed timestamps, excessive lifetime and revocation while transaction retries enforce ten-per-minute", options, async () => {
  const x = await fixture();
  try {
    const now = Date.now();
    for (const record of [
      { ...x.record, expiresAt: Timestamp.fromMillis(x.record.createdAt.toMillis() + 14 * DAY + 1) },
      { ...x.record, createdAt: now }, { ...x.record, expiresAt: now + DAY },
      { ...x.record, createdAt: Timestamp.fromMillis(now + 10_000) },
      { ...x.record, status: "revoked" }, { ...x.record, uid: "otherOwner" },
      { ...x.record, reviewAccessVersion: 2 }, { ...x.record, capabilities: ["premium-features"] }
    ]) {
      await x.marker.set(record);
      assert.deepEqual(await x.get(), x.none);
      assert.deepEqual((await x.marker.get()).data(), record);
    }
    await x.rate.delete();
    await x.marker.set(x.record);
    const results = await Promise.allSettled(Array.from({ length: 11 }, () => x.get()));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 10);
    const rejected = results.filter(result => result.status === "rejected") as PromiseRejectedResult[];
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, "resource-exhausted");
    const rate = (await x.rate.get()).data()!;
    assert.equal(rate.count, 10);
    assert.ok(rate.expiresAt instanceof Timestamp, "Rate control remains TTL-compatible");
    assert.deepEqual((await x.marker.get()).data(), x.record);
    await x.rate.set({ count: 10, windowStartedAt: Date.now() - 60_001, expiresAt: Timestamp.fromMillis(Date.now() - 1) });
    assert.equal((await x.get()).access, "review");
    assert.equal((await x.rate.get()).data()?.count, 1);
  } finally { await x.cleanup(); }
});

test("existing expiry sweep and verified UID deletion clean review markers while deletion cooldown blocks stale getters", options, async () => {
  const x = await fixture();
  const otherUid = `other_${randomUUID().replaceAll("-", "")}`;
  const other = x.db.doc(`backend_jobs/${otherUid}_review-access-v1`);
  try {
    await x.marker.set({ ...x.record, createdAt: Timestamp.fromMillis(Date.now() - DAY), expiresAt: Timestamp.fromMillis(Date.now() - 1) });
    assert.deepEqual(await x.get(), x.none);
    await x.f.cleanupExpiredServerRecords.run({ scheduleTime: new Date().toISOString() });
    assert.equal((await x.marker.get()).exists, false, "The existing expiresAt query removes expired review metadata");
    await x.marker.set(x.record);
    await other.set({ ...x.record, uid: otherUid });
    for (const status of ["deleting", "cooldown"]) {
      await x.tombstone.set({ uid: x.uid, status, requestedAt: Timestamp.now(), ...(status === "cooldown" ? { expiresAt: Timestamp.fromMillis(Date.now() + DAY) } : {}) });
      await assert.rejects(() => x.get(), isCode("failed-precondition"));
    }
    await x.tombstone.delete();
    await x.f.requestAccountDeletion.run({ auth: x.auth, data: { expectedAccountUid: x.uid, clientEventId: "delete_review123" } });
    assert.equal((await x.marker.get()).exists, false);
    assert.equal((await other.get()).exists, true, "Existing deletion cleanup remains UID-scoped");
    await assert.rejects(() => x.get(), isCode("failed-precondition"));
    assert.equal((await x.marker.get()).exists, false);
    await assert.rejects(() => x.authSdk.getUser(x.uid), (error: unknown) => (error as { code: string }).code === "auth/user-not-found");
  } finally { await other.delete(); await x.cleanup(); }
});
