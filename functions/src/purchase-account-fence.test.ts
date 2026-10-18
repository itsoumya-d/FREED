import assert from "node:assert/strict";
import test from "node:test";
import * as purchase from "./purchase-firebase.js";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { PurchaseClaimInput } from "./purchase.js";

test("purchase account fences only advance; failed linking remains fenced", async () => {
  let fence: Record<string, unknown> | undefined;
  const store = {
    readDeletionTombstone: async () => false,
    readAccountFence: async () => fence,
    writeAccountFence: async (next: Record<string, unknown>) => { fence = next; }
  };
  const commit = (purchase as any).commitPurchaseAccountFence;
  assert.equal(typeof commit, "function");
  await commit(store, { uid: "guestUid", status: "linking", now: 1000 });
  assert.equal(fence?.status, "linking");
  await commit(store, { uid: "guestUid", status: "linking", now: 2000 });
  assert.equal(fence?.createdAt, 1000);
  await commit(store, { uid: "guestUid", status: "permanent", now: 3000 });
  await commit(store, { uid: "guestUid", status: "linking", now: 4000 });
  assert.equal(fence?.status, "permanent");
  assert.equal(fence?.createdAt, 1000);
  assert.equal(Object.hasOwn(fence!, "expiresAt"), false);
});

test("account linking fence rejects untrusted payload and deletion before any write", async () => {
  const callable = (purchase as any).fencePurchaseAccountLink;
  assert.equal(typeof callable?.run, "function");
  await assert.rejects(() => callable.run({ data: { uid: "otherUid" }, auth: { uid: "guestUid", token: { firebase: { sign_in_provider: "anonymous" } } } }), (error: any) => error.code === "invalid-argument");
  await assert.rejects(() => callable.run({ data: null }), (error: any) => error.code === "unauthenticated");
  let written = false;
  await assert.rejects(() => (purchase as any).commitPurchaseAccountFence({
    readDeletionTombstone: async () => true, readAccountFence: async () => undefined,
    writeAccountFence: async () => { written = true; }
  }, { uid: "guestUid", status: "linking", now: 1000 }));
  assert.equal(written, false);
});

test("Google replacement cannot evade previous permanent ownership by presenting a new token", async () => {
  const originalHash = "a".repeat(64);
  const replacementHash = "b".repeat(64);
  let writes = 0;
  const claim: PurchaseClaimInput = {
    uid: "otherUid", provider: "google-play", productId: "freed_premium_yearly",
    storeReferenceHash: replacementHash, linkedStoreReferenceHash: originalHash,
    expiresAt: 4000, verifiedAt: 1000, initialOwnershipVerified: true, restoreWitnessVerified: true,
    restore: true, restoreContext: { expectedOwnerUid: "permanentOwner", ownerIsAnonymous: false, targetAuthenticated: true, targetIsAnonymous: true }
  };
  const result = await purchase.commitVerifiedPurchaseClaim({
    readDeletionTombstone: async () => false, readAccountFence: async () => undefined,
    readClaim: async hash => hash === originalHash ? { uid: "permanentOwner", provider: "google-play", productId: "freed_premium_monthly", storeReferenceHash: originalHash, status: "verified" } : undefined,
    writeClaimAndAudit: async () => { writes++; }
  }, claim);
  assert.equal(result, "conflict");
  assert.equal(writes, 0);
});

test("link fence callable accepts only empty payloads and replies with exactly ok true", async () => {
  const db = getFirestore();
  const original = db.runTransaction;
  const persisted = new Map<string, Record<string, unknown>>();
  const transaction = {
    get: async (ref: { path: string }) => ({ exists: persisted.has(ref.path), data: () => persisted.get(ref.path) }),
    set: (ref: { path: string }, value: Record<string, unknown>) => { persisted.set(ref.path, value); }
  };
  db.runTransaction = (async (callback: (value: unknown) => Promise<unknown>) => callback(transaction)) as typeof db.runTransaction;
  try {
    for (const data of [undefined, null]) {
      assert.deepEqual(await (purchase.fencePurchaseAccountLink as any).run({ data, auth: { uid: "guestUid", token: { firebase: { sign_in_provider: "anonymous" } } } }), { ok: true });
    }
    const fence = persisted.get("purchase_account_fences/guestUid");
    assert.equal(fence?.status, "linking");
    assert.equal(fence?.createdAt instanceof Timestamp, true);
    assert.deepEqual(Object.keys(fence!).sort(), ["createdAt", "status", "uid", "updatedAt"]);
  } finally { db.runTransaction = original; }
});

test("same-owner Play replacement retires the previous claim in the same transaction", async () => {
  const currentHash = "b".repeat(64);
  const previousHash = "a".repeat(64);
  const records = new Map<string, purchase.PurchaseClaimDocument>([[previousHash, {
    uid: "ownerUid", provider: "google-play", productId: "freed_premium_monthly", storeReferenceHash: previousHash, status: "verified"
  }]]);
  const result = await purchase.commitVerifiedPurchaseClaim({
    readDeletionTombstone: async () => false,
    readAccountFence: async () => "permanent",
    readClaim: async hash => records.get(hash),
    retireLinkedClaim: async previous => { records.set(previous.storeReferenceHash, { ...previous, status: "inactive" }); },
    writeClaimAndAudit: async next => { records.set(next.storeReferenceHash, { ...next, status: "verified" }); }
  }, { uid: "ownerUid", provider: "google-play", productId: "freed_premium_yearly", storeReferenceHash: currentHash, linkedStoreReferenceHash: previousHash, initialOwnershipVerified: true, verifiedAt: 1000, expiresAt: 4000 });
  assert.equal(result, "owned");
  assert.equal(records.get(previousHash)?.status, "inactive");
  assert.equal(records.get(currentHash)?.productId, "freed_premium_yearly");
});

test("linked credentials and unreadable identity signals cannot count as an anonymous source", () => {
  const guest = { providerData: [], disabled: false };
  assert.equal(purchase.isUnlinkedAnonymousPurchaseOwner(guest), true);
  for (const modified of [{ ...guest, disabled: true }, { ...guest, email: "person@example.com" }, { ...guest, phoneNumber: "+15555555555" }, { ...guest, customClaims: { permanent: true } }, { ...guest, providerData: [{ providerId: "apple.com" } as any] }]) {
    assert.equal(purchase.isUnlinkedAnonymousPurchaseOwner(modified), false);
  }
});

test("guest Play replacement transfer moves the whole lineage so later same-UID restore remains allowed", async () => {
  const currentHash = "b".repeat(64);
  const previousHash = "a".repeat(64);
  const records = new Map<string, purchase.PurchaseClaimDocument>([[previousHash, {
    uid: "oldGuest", provider: "google-play", productId: "freed_premium_monthly", storeReferenceHash: previousHash, status: "verified"
  }]]);
  const store: purchase.PurchaseClaimTransactionStore = {
    readDeletionTombstone: async () => false, readAccountFence: async () => undefined,
    readClaim: async hash => records.get(hash),
    retireLinkedClaim: async previous => { records.set(previous.storeReferenceHash, { ...previous, status: "inactive" }); },
    writeClaimAndAudit: async next => { records.set(next.storeReferenceHash, { ...next, status: "verified" }); }
  };
  const input: PurchaseClaimInput = {
    uid: "newGuest", provider: "google-play", productId: "freed_premium_yearly", storeReferenceHash: currentHash, linkedStoreReferenceHash: previousHash,
    restore: true, restoreWitnessVerified: true, initialOwnershipVerified: true, verifiedAt: 1000, expiresAt: 4000,
    restoreContext: { expectedOwnerUid: "oldGuest", ownerIsAnonymous: true, targetAuthenticated: true, targetIsAnonymous: true }
  };
  assert.equal(await purchase.commitVerifiedPurchaseClaim(store, input), "transferred");
  assert.equal(records.get(previousHash)?.uid, "newGuest");
  assert.equal(await purchase.commitVerifiedPurchaseClaim(store, { ...input, restoreContext: undefined }), "owned");
});

test("the trusted Apple store-account hash stays immutable when ownership moves", async () => {
  const hash = "a".repeat(64);
  const storeHash = "c".repeat(64);
  let persisted: purchase.PurchaseClaimDocument = { uid: "guestUid", provider: "apple", productId: "freed_premium_monthly", storeReferenceHash: hash, storeAccountTokenHash: storeHash, status: "verified" };
  const store: purchase.PurchaseClaimTransactionStore = {
    readDeletionTombstone: async () => false, readAccountFence: async () => undefined,
    readClaim: async () => persisted, writeClaimAndAudit: async claim => { persisted = { ...claim, status: "verified" }; }
  };
  const claim: PurchaseClaimInput = { uid: "signedInUid", provider: "apple", productId: "freed_premium_monthly", storeReferenceHash: hash,
    storeAccountTokenHash: storeHash, verifiedAt: 1000, expiresAt: 4000, restore: true, restoreWitnessVerified: true,
    restoreContext: { expectedOwnerUid: "guestUid", ownerIsAnonymous: true, targetAuthenticated: true, targetIsAnonymous: false } };
  assert.equal(await purchase.commitVerifiedPurchaseClaim(store, claim), "transferred");
  assert.equal(persisted.storeAccountTokenHash, storeHash);
  assert.equal(await purchase.commitVerifiedPurchaseClaim(store, { ...claim, storeAccountTokenHash: "d".repeat(64) }), "conflict");
  assert.equal(persisted.storeAccountTokenHash, storeHash);
});
