import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PURCHASE_SECRET_NAMES,
  commitVerifiedPurchaseClaim,
  type PurchaseClaimTransactionStore
} from "./purchase-firebase.js";
import type { PurchaseClaimInput } from "./purchase.js";

const claim: PurchaseClaimInput = {
  uid: "firebaseUid123",
  provider: "apple",
  productId: "freed_premium_monthly",
  storeReferenceHash: "a".repeat(64),
  orderReferenceHash: "b".repeat(64),
  verifiedAt: Date.parse("2026-07-22T12:00:00.000Z"),
  expiresAt: Date.parse("2026-08-22T12:00:00.000Z")
};

test("purchase callable binds region, Auth, App Check limited-use tokens, and every server secret", () => {
  assert.deepEqual(PURCHASE_SECRET_NAMES, [
    "APPLE_STORE_ISSUER_ID",
    "APPLE_STORE_KEY_ID",
    "APPLE_STORE_PRIVATE_KEY",
    "APPLE_STORE_APP_ID",
    "APPLE_STORE_ROOT_CAS_BASE64",
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
  ]);
  const source = readFileSync("src/purchase-firebase.ts", "utf8");
  assert.match(source, /export const verifyStorePurchase = onCall/);
  assert.match(source, /region:\s*REGION/);
  assert.match(source, /enforceAppCheck:\s*true/);
  assert.match(source, /consumeAppCheckToken:\s*true/);
  assert.match(source, /secrets:\s*PURCHASE_SECRETS/);
  assert.match(source, /request\.app\?\.alreadyConsumed/);
  assert.match(source, /requirePurchaseUid\(request\.auth\?\.uid\)/);
  assert.match(source, /createAppleStoreProvider/);
  assert.match(source, /createGooglePlayProvider/);
  assert.match(source, /runProtectedMutation/);
  assert.match(source, /limit:\s*12/);
  assert.match(source, /db\.runTransaction/);
  assert.match(source, /COLLECTIONS\.purchaseClaims/);
  assert.match(source, /COLLECTIONS\.purchaseAudits/);
  assert.doesNotMatch(source, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(source, /signedTransactionInfo|purchaseToken\s*:/);
});

test("claim transaction rechecks deletion, permits the owner, and rejects replay without raw references", async () => {
  const writes: PurchaseClaimInput[] = [];
  const store: PurchaseClaimTransactionStore = {
    readDeletionTombstone: async () => false,
    readClaim: async () => undefined,
    writeClaimAndAudit: async (input) => { writes.push(input); }
  };
  assert.equal(await commitVerifiedPurchaseClaim(store, claim), "claimed");
  assert.deepEqual(writes, [claim]);
  assert.equal(JSON.stringify(writes).includes("200000"), false);

  store.readClaim = async () => ({
    uid: claim.uid,
    provider: claim.provider,
    productId: claim.productId,
    storeReferenceHash: claim.storeReferenceHash,
    status: "verified"
  });
  assert.equal(await commitVerifiedPurchaseClaim(store, claim), "owned");

  store.readClaim = async () => ({
    uid: "anotherFirebaseUid",
    provider: claim.provider,
    productId: claim.productId,
    storeReferenceHash: claim.storeReferenceHash,
    status: "verified"
  });
  assert.equal(await commitVerifiedPurchaseClaim(store, claim), "conflict");

  store.readDeletionTombstone = async () => true;
  store.readClaim = async () => undefined;
  assert.equal(await commitVerifiedPurchaseClaim(store, claim), "account-deleting");
});

test("claim persistence failure returns unavailable and cannot produce an active entitlement", async () => {
  const store: PurchaseClaimTransactionStore = {
    readDeletionTombstone: async () => false,
    readClaim: async () => undefined,
    writeClaimAndAudit: async () => { throw new Error("temporary Firestore failure"); }
  };
  await assert.rejects(() => commitVerifiedPurchaseClaim(store, claim), /Firestore failure/);
});
