import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createFirebaseCallableContracts,
  getFirebaseMessagingRegistrationContract,
  parseFirebaseChallengeResult,
  parseFirebaseClaraResult,
  parseFirebaseReviewedAdultDomainFeed,
  parseFirebaseRetentionResult,
  parseFirebaseVerifyStorePurchaseResult,
  type FirebaseChallengeRequest,
  type FirebaseClaraRequest,
  type FirebaseReviewedAdultDomainFeed,
  type FirebaseRetentionRequest,
  type FirebaseVerifyStorePurchaseRequest,
  type FirebaseCallableTransport
} from "../src/lib/firebase-client";

async function run() {
  const calls: Array<{ name: string; data: unknown }> = [];
  const transport: FirebaseCallableTransport = {
    call: async (name, data) => {
      calls.push({ name, data });
      if (name === "getReviewedAdultDomainFeed") return {
        version: "oisd-nsfw-small-0000000000000000",
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
      if (name === "verifyStorePurchase") return {
        active: true,
        entitlementId: "premium",
        productId: "freed_premium_monthly",
        platform: "ios",
        status: "verified",
        expiresAt: "2099-07-22T12:01:00.000Z"
      };
      if (name === "generateClaraReply") return {
        text: "Put the phone down and take three slow breaths. A brief pause gives you room to choose the next action.",
        provider: "remote",
        status: "ok"
      };
      if (name === "generateChallenges") return {
        challenges: validChallenges(), provider: "remote", status: "ok"
      };
      if (name === "generateRetentionPlan") return {
        headline: "Protect today's progress and the next clean day.",
        nextBestAction: "Set the guard reminder, then keep the phone outside the highest-risk room tonight.",
        checkInPrompt: "What is the smallest change that would make the next hour easier?",
        suggestedGuardTime: "21:45",
        focusTags: ["guard time", "phone boundary"],
        provider: "remote",
        status: "ok"
      };
      return { ok: true };
    }
  };
  const callables = createFirebaseCallableContracts(transport);

  const realFcmToken = "fcmRegistrationPrefix123:APA91bG9uZ19yZWFsX3NoYXBlZF90b2tlbi0xMjM0NTY3ODkw";
  assert.deepEqual(getFirebaseMessagingRegistrationContract({
    installationId: "firebase-installation-id",
    token: realFcmToken
  }), { installationId: "firebase-installation-id", token: realFcmToken, recoveryContentIncluded: false });
  for (const invalid of ["short", "your-fcm-token-placeholder", `prefix:${"x".repeat(4_096)}`]) {
    assert.equal(getFirebaseMessagingRegistrationContract({ installationId: "firebase-installation-id", token: invalid }), null);
  }
  assert.equal(getFirebaseMessagingRegistrationContract({
    installationId: "firebase-installation-id",
    token: realFcmToken,
    body: "arbitrary"
  } as never), null);

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
  const purchasePayload: FirebaseVerifyStorePurchaseRequest = {
    platform: "ios",
    productId: "freed_premium_monthly",
    transactionId: "2000001234567890",
    clientEventId: "purchase_event_123",
    restore: false
  };
  assert.deepEqual(await callables.verifyStorePurchase(purchasePayload), {
    active: true,
    entitlementId: "premium",
    productId: "freed_premium_monthly",
    platform: "ios",
    status: "verified",
    expiresAt: "2099-07-22T12:01:00.000Z"
  });
  assert.deepEqual(calls[6], { name: "verifyStorePurchase", data: purchasePayload });
  await assert.rejects(
    () => callables.verifyStorePurchase({ ...purchasePayload, receipt: "unsigned" } as never),
    /not permitted/i
  );
  const exactFeed: FirebaseReviewedAdultDomainFeed = await callables.getReviewedAdultDomainFeed();
  type ExactFeedHasObjectKey = "objectKey" extends keyof typeof exactFeed ? true : false;
  const exactFeedHasObjectKey: ExactFeedHasObjectKey = false;
  assert.equal(exactFeedHasObjectKey, false);
  assert.deepEqual(exactFeed, {
    version: "oisd-nsfw-small-0000000000000000",
    generatedAt: "2026-07-22T06:30:00.000Z",
    publishedAt: "2026-07-22T06:30:00.000Z",
    checksum: "0".repeat(64),
    source: { id: "oisd-nsfw-small", label: "OISD NSFW Small", url: "https://nsfw-small.oisd.nl/" },
    domains: ["example.xxx"]
  });
  assert.deepEqual(calls[7], { name: "getReviewedAdultDomainFeed", data: undefined });

  const claraPayload: FirebaseClaraRequest = {
    clientEventId: "evt_clara123",
    input: "Help me reset.",
    context: { streakDays: 4, attemptsToday: 2, premium: false, slipsThisWeek: 0, slipWindow: null, slipTrigger: null }
  };
  assert.deepEqual(await callables.generateClaraReply(claraPayload), {
    text: "Put the phone down and take three slow breaths. A brief pause gives you room to choose the next action.",
    provider: "remote",
    status: "ok"
  });
  assert.equal(calls.at(-1)?.name, "generateClaraReply");

  const challengePayload = validChallengeRequest();
  assert.equal((await callables.generateChallenges(challengePayload)).challenges.length, 3);
  assert.equal(calls.at(-1)?.name, "generateChallenges");

  const retentionPayload = validRetentionRequest();
  assert.equal((await callables.generateRetentionPlan(retentionPayload)).provider, "remote");
  assert.equal(calls.at(-1)?.name, "generateRetentionPlan");

  await assert.rejects(
    () => callables.generateClaraReply({ ...claraPayload, recentRiskHosts: ["private.example"] } as never),
    /not permitted/i
  );
  await assert.rejects(
    () => callables.generateChallenges({
      ...challengePayload,
      profile: { ...challengePayload.profile, riskForecast: { level: "high", score: 90, confidence: "high", currentWindow: "evening", drivers: ["private transcript"] } }
    } as never),
    /not permitted/i
  );
  await assert.rejects(
    () => callables.generateRetentionPlan({ ...retentionPayload, profile: { ...retentionPayload.profile, momentum: "private relapse note" } } as never),
    /not permitted/i
  );

  const validFeed = {
    version: "oisd-nsfw-small-0000000000000000",
    generatedAt: "2026-07-22T06:30:00.000Z",
    publishedAt: "2026-07-22T06:30:00.000Z",
    checksum: "0".repeat(64),
    source: { id: "oisd-nsfw-small", label: "OISD NSFW Small", url: "https://nsfw-small.oisd.nl/" },
    domains: ["example.xxx"]
  };
  for (const invalid of [
    { ...validFeed, checksum: "not-a-checksum" },
    { ...validFeed, generatedAt: "not-a-timestamp" },
    { ...validFeed, publishedAt: "2026-07-22T06:29:59.999Z" },
    { ...validFeed, source: { ...validFeed.source, url: "https://attacker.example/" } },
    { ...validFeed, domains: ["Example.xxx"] },
    { ...validFeed, domains: ["example.xxx/path"] },
    { ...validFeed, domains: ["b.example.xxx", "a.example.xxx"] },
    { ...validFeed, objectKey: "adult-domain-feeds/internal.json" },
    { ...validFeed, source: { ...validFeed.source, objectKey: "internal" } },
    { ...validFeed, domains: Array.from({ length: 100_001 }, (_, index) => `d${String(index).padStart(6, "0")}.example.xxx`) }
  ]) {
    assert.throws(() => parseFirebaseReviewedAdultDomainFeed(invalid), /invalid reviewed adult-domain feed/i);
  }
  const { domains: _missingDomains, ...missingDomains } = validFeed;
  assert.throws(() => parseFirebaseReviewedAdultDomainFeed(missingDomains), /invalid reviewed adult-domain feed/i);

  const validPurchase = {
    active: true,
    entitlementId: "premium",
    productId: "freed_premium_yearly",
    platform: "android",
    status: "verified",
    expiresAt: "2099-07-22T12:01:00.000Z"
  };
  assert.deepEqual(parseFirebaseVerifyStorePurchaseResult(validPurchase), validPurchase);
  assert.deepEqual(parseFirebaseVerifyStorePurchaseResult({
    ...validPurchase,
    productId: "freed_premium_lifetime",
    expiresAt: null
  }), { ...validPurchase, productId: "freed_premium_lifetime", expiresAt: null });
  for (const invalid of [
    { ...validPurchase, active: false },
    { ...validPurchase, entitlementId: "attacker" },
    { ...validPurchase, productId: "attacker_product" },
    { ...validPurchase, platform: "web" },
    { ...validPurchase, status: "inactive" },
    { ...validPurchase, expiresAt: "2020-01-01T00:00:00.000Z" },
    { ...validPurchase, transactionId: "2000001234567890" },
    { ...validPurchase, purchaseToken: "play-token-private" },
    { ...validPurchase, orderId: "GPA.private" },
    { ...validPurchase, provider: "apple" },
    { ...validPurchase, rawError: "private" },
    { ...validPurchase, productId: "freed_premium_lifetime", expiresAt: "2099-07-22T12:01:00.000Z" },
    { ...validPurchase, active: false, status: "rejected", expiresAt: "2099-07-22T12:01:00.000Z" }
  ]) {
    assert.throws(() => parseFirebaseVerifyStorePurchaseResult(invalid), /invalid firebase purchase/i);
  }

  const indexSource = readFileSync("functions/src/index.ts", "utf8");
  const aiFunctionSource = readFileSync("functions/src/ai-firebase.ts", "utf8");
  const feedFunctionSource = readFileSync("functions/src/adult-feed-firebase.ts", "utf8");
  assert.match(indexSource, /getReviewedAdultDomainFeed/);
  assert.match(indexSource, /refreshReviewedAdultDomainFeed/);
  assert.match(feedFunctionSource, /onCall\(\{[^}]*enforceAppCheck:\s*true[^}]*\}/);
  assert.match(feedFunctionSource, /requireAuthenticatedUid\(request\.auth\?\.uid\)/);
  assert.match(feedFunctionSource, /onSchedule\(\{[\s\S]*schedule:\s*"every 24 hours"[\s\S]*timeZone:\s*"Asia\/Kolkata"/);
  assert.equal(feedFunctionSource.match(/region:\s*"asia-south1"/g)?.length, 2);
  for (const callable of ["generateClaraReply", "generateChallenges", "generateRetentionPlan"]) {
    assert.match(indexSource, new RegExp(callable));
    assert.match(aiFunctionSource, new RegExp(`export const ${callable}`));
  }
  assert.equal(aiFunctionSource.match(/enforceAppCheck:\s*true/g)?.length, 3);
  assert.equal(aiFunctionSource.match(/secrets:\s*\[OPENAI_API_KEY\]/g)?.length, 3);

  const notificationFunctionSource = readFileSync("functions/src/notification-firebase.ts", "utf8");
  assert.match(indexSource, /dispatchReviewedNotifications/);
  assert.doesNotMatch(indexSource, /export const (?:enqueue|dispatch)Notification\w*\s*=\s*onCall/i);
  assert.match(notificationFunctionSource, /getMessaging/);

  for (const ruleFile of ["firestore.rules", "storage.rules"]) {
    const rules = readFileSync(ruleFile, "utf8");
    assert.match(rules, /allow read, write: if false;/, `${ruleFile} must keep direct mobile access denied`);
    assert.doesNotMatch(rules, /allow\s+(?:read|write)(?:,\s*(?:read|write))?\s*:\s*if\s+(?!false\b)/);
  }
  console.log("firebase callable contract tests passed");
}

const validRemotePlan = {
  headline: "Protect today's progress and the next clean day.",
  nextBestAction: "Set the guard reminder, then keep the phone outside the highest-risk room tonight.",
  checkInPrompt: "What is the smallest change that would make the next hour easier?",
  suggestedGuardTime: "21:45",
  focusTags: ["guard time", "phone boundary"],
  provider: "remote" as const,
  status: "ok" as const
};

for (const invalid of [
  { text: "Safe reply", provider: "remote", status: "ok", model: "gpt-5.6-terra" },
  { text: "Punishing reset", provider: "remote", status: "ok" },
  { text: "https://private.example", provider: "remote", status: "ok" },
  { text: "Sprint until you vomit.", provider: "remote", status: "ok" },
  { text: "x".repeat(1_001), provider: "remote", status: "ok" }
]) {
  assert.throws(() => parseFirebaseClaraResult(invalid), /invalid firebase ai/i);
}
for (const invalid of [
  { challenges: validChallenges().slice(0, 2), provider: "remote", status: "ok" },
  {
    challenges: validChallenges().map((item, index) => index === 0
      ? { ...item, title: "Punishing reset", steps: ["Do 99 burpees without stopping.", "Then return."] }
      : item),
    provider: "remote",
    status: "ok"
  },
  { challenges: validChallenges().map((item, index) => index === 0 ? { ...item, premium: true } : item), provider: "remote", status: "ok" },
  { challenges: validChallenges().map((item, index) => index === 0 ? { ...item, steps: ["Hold a plank for 20 minutes.", "Come back."] } : item), provider: "remote", status: "ok" },
  { challenges: validChallenges(), provider: "remote", status: "ok", providerBody: {} }
]) {
  assert.throws(() => parseFirebaseChallengeResult(invalid), /invalid firebase ai/i);
}
for (const invalid of [
  { ...validRemotePlan, focusTags: [] },
  {
    ...validRemotePlan,
    headline: "Punishing reset",
    nextBestAction: "Do 99 burpees without stopping.",
    checkInPrompt: "Did you obey?",
    focusTags: ["punishing"]
  },
  { ...validRemotePlan, suggestedGuardTime: "25:00" },
  { ...validRemotePlan, nextBestAction: "Double your medication dose tonight." },
  { ...validRemotePlan, objectKey: "internal" }
]) {
  assert.throws(() => parseFirebaseRetentionResult(invalid), /invalid firebase ai/i);
}

function validChallenges() {
  return [
    {
      id: "breathing-reset", title: "Take three slow breaths", category: "breathing" as const, durationSec: 60,
      intensity: "calm" as const, premium: false as const, icon: "Waves",
      steps: ["Put the phone down.", "Breathe in slowly, then exhale longer."],
      why: "Slower breathing creates a short pause before the next action."
    },
    {
      id: "change-room", title: "Change your environment", category: "reset" as const, durationSec: 120,
      intensity: "medium" as const, premium: false as const, icon: "Footprints",
      steps: ["Stand up and leave the current room.", "Keep the phone out of reach for two minutes."],
      why: "Changing place interrupts the cue and gives the urge time to settle."
    },
    {
      id: "next-safe-step", title: "Name the next safe step", category: "reflection" as const, durationSec: 90,
      intensity: "calm" as const, premium: false as const, icon: "Notebook",
      steps: ["Name what you need for the next ten minutes.", "Choose one small action that supports it."],
      why: "A specific next step makes the automatic loop less powerful."
    }
  ];
}

function validChallengeRequest(): FirebaseChallengeRequest {
  return {
    clientEventId: "evt_challenge123",
    profile: {
      streakDays: 4, premium: false, attemptsToday: 2, mood: "stressed", hour: 21, dayPart: "evening",
      isWeekend: false, timezoneOffsetMinutes: -330, slipsThisWeek: 0, slipWindow: null, slipTrigger: null,
      interventionContext: null, disciplinePreferences: null, contextSignals: null, riskForecast: null,
      recentFailureCount: 0, preferredCategories: ["breathing", "reset"]
    },
    recentChallengeHistory: []
  };
}

function validRetentionRequest(): FirebaseRetentionRequest {
  return {
    clientEventId: "evt_retention123",
    profile: {
      premium: false, streakDays: 4, bestStreakDays: 9, attemptsThisWeek: 7, slipsThisWeek: 0,
      checkInsThisWeek: 4, completedChallengesThisWeek: 3, averageUrge: 2.5, averageSleep: 3.5, steadyDays: 3,
      riskWindow: "evening", slipWindow: null, slipTrigger: null, bestIntervention: "breathing", momentum: "stable",
      urgeRiskForecast: { level: "low", score: 20, confidence: "medium", currentWindow: "evening", drivers: ["low-sleep"] },
      enabledReminderKeys: ["morning", "guard"], smartGuardTime: "21:45", smartGuardSource: "risk-window",
      localDateKey: "2026-07-22", timezoneOffsetMinutes: -330
    }
  };
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
