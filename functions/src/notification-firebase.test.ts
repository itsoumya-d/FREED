import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("notification scheduler uses Firebase Admin Messaging for both platforms and is never client callable", () => {
  const source = readFileSync("src/notification-firebase.ts", "utf8");
  const index = readFileSync("src/index.ts", "utf8");
  assert.match(source, /getMessaging\(\)\.sendEachForMulticast/);
  assert.match(source, /export const dispatchReviewedNotifications = onSchedule/);
  assert.match(source, /schedule:\s*"every 5 minutes"/);
  assert.match(source, /timeZone:\s*"Asia\/Kolkata"/);
  assert.match(source, /dryRun:\s*false|sendEachForMulticast\([\s\S]*?,\s*false\s*\)/);
  assert.doesNotMatch(source, /api\.push\.apple\.com|api\.sandbox\.push\.apple\.com|createSign|APNS_PRIVATE_KEY|APNS_KEY_ID/);
  assert.doesNotMatch(index, /onCall[^;]*(?:enqueue|dispatch).*Notification/i);
});

test("production adapter persists Firestore timestamps and rechecks a deletion fence before provider invocation", () => {
  const source = readFileSync("src/notification-firebase.ts", "utf8");
  assert.match(source, /Timestamp\.fromMillis/);
  assert.match(source, /COLLECTIONS\.notificationJobs/);
  assert.match(source, /COLLECTIONS\.deletionTombstones/);
  assert.match(source, /prepareProviderInvocation/);
  assert.match(source, /db\.runTransaction/);
  assert.match(source, /deleteInvalidTokensTransactionally/);
  assert.match(source, /storedTokens/);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/);
});

test("ambiguous Firebase Admin promise outcomes become terminal instead of retryable", () => {
  const source = readFileSync("src/notification-firebase.ts", "utf8");
  assert.match(source, /NotificationProviderUnknownOutcomeError/);
  assert.match(source, /NotificationProviderNotSubmittedError/);
  assert.match(source, /withProviderTimeout/);
});

test("push registration remains Auth, App Check, rate, idempotency, deletion, and Timestamp fenced", () => {
  const source = readFileSync("src/index.ts", "utf8");
  const registration = source.slice(source.indexOf("export const registerPushToken"), source.indexOf("export const requestAccountDeletion"));
  assert.match(registration, /onCall\(\{ enforceAppCheck: true \}/);
  assert.match(registration, /requireUid\(request\.auth\?\.uid\)/);
  assert.match(registration, /parsePushTokenRegistration/);
  assert.match(registration, /mutate\(uid, "push-token", input\.clientEventId, 10/);
  assert.match(registration, /COLLECTIONS\.pushTokens/);
  assert.match(registration, /expiresAt:\s*Timestamp\.fromMillis/);
  assert.doesNotMatch(registration, /console\.(?:log|warn|error)/);
});
