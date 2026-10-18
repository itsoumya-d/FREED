import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.STORAGE_EMULATOR_HOST);

test("real Firestore concurrent first acknowledgements are durable, survive expiry sweep, and follow existing UID deletion cleanup", {
  skip: enabled ? false : "requires isolated Auth, Firestore, and Storage emulators"
}, async () => {
  const projectId = process.env.GCLOUD_PROJECT;
  assert.ok(projectId?.startsWith("demo-"), "This test may use only a Firebase demo project");
  if (!getApps().length) initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` });
  const f = createRequire(__filename)("./foundation.js") as Record<string, any>;
  const db = getFirestore();
  const uid = `journey_${randomUUID().replaceAll("-", "")}`;
  const otherUid = `other_${randomUUID().replaceAll("-", "")}`;
  const marker = db.doc(`backend_jobs/${uid}_journey-offer-v1`);
  const otherMarker = db.doc(`backend_jobs/${otherUid}_journey-offer-v1`);
  const claim = db.doc(`purchase_claims/journey_claim_${uid}`);
  const tombstone = db.doc(`deletion_tombstones/${uid}`);
  const auth = { uid, token: { firebase: { sign_in_provider: "password" }, auth_time: Math.floor(Date.now() / 1000) } };
  await getAuth().createUser({ uid, email: `${uid}@example.test`, password: "isolated-journey-test-password" });
  const existingClaim = { uid, status: "inactive", productId: "freed_premium_yearly" };
  await claim.set(existingClaim);
  await otherMarker.set({ uid: otherUid, kind: "journey-offer-v1", status: "free", createdAt: Timestamp.now() });
  try {
    assert.deepEqual(await f.getJourneyOfferState.run({ auth, data: undefined }), { offerVersion: 1, acknowledged: false });
    const results = await Promise.all(["free", "purchased"].map((decision, index) => f.acknowledgeJourneyOffer.run({
      auth, data: { offerVersion: 1, decision, eventId: `journey_${String(index + 1).repeat(32)}` }
    })));
    assert.deepEqual(results, [{ offerVersion: 1, acknowledged: true }, { offerVersion: 1, acknowledged: true }]);
    const first = (await marker.get()).data()!;
    assert.deepEqual(Object.keys(first).sort(), ["createdAt", "kind", "status", "uid"]);
    assert.equal(first.uid, uid);
    assert.equal(first.kind, "journey-offer-v1");
    assert.ok(first.status === "free" || first.status === "purchased");
    assert.ok(first.createdAt instanceof Timestamp);
    assert.deepEqual((await claim.get()).data(), existingClaim, "A purchased label cannot verify or alter premium");
    assert.deepEqual(await f.getJourneyOfferState.run({ auth, data: null }), { offerVersion: 1, acknowledged: true });
    for (let retry = 0; retry < 5; retry += 1) {
      await f.acknowledgeJourneyOffer.run({ auth, data: { offerVersion: 1, decision: "purchased", eventId: `journey_${"a".repeat(32)}` } });
    }
    assert.deepEqual((await marker.get()).data(), first);
    const messaging = getMessaging();
    const originalSend = messaging.sendEachForMulticast;
    let notificationActions = 0;
    messaging.sendEachForMulticast = (async () => { notificationActions += 1; throw new Error("Offer metadata cannot dispatch notifications"); }) as typeof originalSend;
    try { await f.dispatchReviewedNotifications.run({ scheduleTime: new Date().toISOString() }); }
    finally { messaging.sendEachForMulticast = originalSend; }
    assert.equal(notificationActions, 0, "The existing dispatcher must not treat a backend_jobs offer marker as a notification job");
    assert.deepEqual((await marker.get()).data(), first);
    await f.cleanupExpiredServerRecords.run({ scheduleTime: new Date().toISOString() });
    assert.deepEqual((await marker.get()).data(), first, "The existing expiresAt sweep must not prune a permanent offer marker");
    assert.deepEqual(await f.requestAccountDeletion.run({ auth, data: { expectedAccountUid: uid, clientEventId: "delete_journey123" } }), { ok: true, status: "completed" });
    assert.equal((await marker.get()).exists, false, "Existing backend_jobs UID selection cleans the marker");
    assert.equal((await claim.get()).exists, false);
    assert.equal((await otherMarker.get()).exists, true, "Deletion is scoped to the verified account");
    for (const callback of [
      () => f.getJourneyOfferState.run({ auth, data: null }),
      () => f.acknowledgeJourneyOffer.run({ auth, data: { offerVersion: 1, decision: "free", eventId: `journey_${"b".repeat(32)}` } })
    ]) await assert.rejects(callback, (error: unknown) => (error as { code: string }).code === "failed-precondition");
    assert.equal((await marker.get()).exists, false, "A stale callback cannot recreate metadata after deletion");
  } finally {
    await Promise.all([marker.delete(), otherMarker.delete(), claim.delete(), tombstone.delete(), getAuth().deleteUser(uid).catch(() => undefined)]);
  }
});
