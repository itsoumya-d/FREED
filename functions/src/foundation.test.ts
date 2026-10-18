import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";

test("foundation discovery exports only bounded services without registering secret parameters", () => {
  if (!getApps().length) initializeApp({ projectId: "freed-foundation-test", storageBucket: "freed-foundation-test.firebasestorage.app" });
  const foundation = createRequire(__filename)("./foundation.js") as Record<string, { __endpoint: { maxInstances: number; secretEnvironmentVariables?: unknown[] } }>;
  assert.deepEqual(Object.keys(foundation).sort(), [
    "backendReadiness", "ingestAggregateAnalytics", "startEncryptedBackupUpload", "finalizeEncryptedBackupUpload",
    "getEncryptedBackupDownload", "getLatestEncryptedBackupDownload", "deleteEncryptedBackup", "registerPushToken",
    "requestAccountDeletion", "retryPendingAccountDeletions", "cleanupExpiredServerRecords", "getReviewedAdultDomainFeed",
    "refreshReviewedAdultDomainFeed", "fencePurchaseAccountLink", "getPremiumEntitlement", "dispatchReviewedNotifications",
    "getJourneyOfferState", "acknowledgeJourneyOffer", "getReviewAccess"
  ].sort());
  for (const callable of Object.values(foundation)) {
    assert.ok(callable.__endpoint.maxInstances >= 1 && callable.__endpoint.maxInstances <= 5);
    assert.equal(callable.__endpoint.secretEnvironmentVariables?.length ?? 0, 0);
  }
  const declaredParams = (createRequire(__filename)("firebase-functions/params") as { declaredParams: { type: string }[] }).declaredParams;
  assert.equal(declaredParams.filter(param => param.type === "secret").length, 0);
});
