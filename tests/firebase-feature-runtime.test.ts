import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { configureFirebaseFeatureProviders } from "../src/lib/firebase-feature-runtime";
import { createFirebaseCallableContracts } from "../src/lib/firebase-client";
import { replyWithCoach, getCoachReadiness } from "../src/lib/ai-coach";
import { generateAdaptiveChallengeSet, getChallengeGenerationReadiness } from "../src/lib/challenge-generator";
import { generateRetentionPlan, getRetentionReadiness } from "../src/lib/retention-orchestrator";
import { resolveAdultDomainFeed } from "../src/lib/adult-domain-feed-sync";
import { createDefaultRecoveryState, recordDailyCheckIn, recordBlockingAttempt } from "../src/lib/recovery-state";
import { createBlockingAttempt, createPanicInterventionAttempt } from "../src/lib/blocking-engine";
import { buildInterventionContextFromAttempt } from "../src/lib/recovery-engine";
import {
  ANALYTICS_CONSENT_VERSION,
  createDefaultAnalyticsSharingControls,
  getConfiguredAnalyticsEndpoint,
  prepareAnalyticsSnapshotState,
  prepareAnalyticsPendingSnapshot,
  stageAnalyticsPendingSnapshot,
  sendGatedAnalyticsPayload
} from "../src/lib/recovery-analytics";
import {
  uploadEncryptedRecoveryBackup,
  downloadEncryptedRecoveryBackup,
  deleteHostedRecoveryBackup,
  getRecoveryBackupClientSyncReadiness
} from "../src/lib/recovery-backup-client-sync";

async function main() {
  let requests = 0;
  const calls: Array<{ name: string; data: any }> = [];
  const now = new Date().toISOString();
  const domains = ["a.example.xxx", "b.example.xxx"];
  const feedHash = createHash("sha256").update(`${domains.join("\n")}\n`).digest("hex");
  let feed = { version: `oisd-nsfw-small-${feedHash.slice(0, 16)}`, generatedAt: now, publishedAt: now, checksum: feedHash,
    source: { id: "oisd-nsfw-small", label: "OISD NSFW Small", url: "https://nsfw-small.oisd.nl/" }, domains };
  let rejectFinalize = false;
  let storedBody = "";
  let storedMetadata: Record<string, any> = {};
  const seenAnalyticsEvents = new Set<string>();
  let acceptedCheckIns = 0;
  const signedUrl = "https://storage.googleapis.com/freed-test/backup?signature=test";
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  const contracts = createFirebaseCallableContracts({ call: async (name, data) => {
    calls.push({ name, data });
    switch (name as string) {
      case "generateClaraReply":
      case "generateChallenges":
      case "generateRetentionPlan": throw new Error("Sensitive AI callable must remain unregistered.");
      case "getReviewedAdultDomainFeed": return feed;
      case "ingestAggregateAnalytics": {
        const payload = data as { schemaVersion: string; snapshotId: string; lineageId: string; baseRevision: number; days: Array<{ checkIns: number }> };
        const duplicate = seenAnalyticsEvents.has(payload.snapshotId);
        if (!duplicate) acceptedCheckIns = payload.days.reduce((sum, day) => sum + day.checkIns, 0);
        seenAnalyticsEvents.add(payload.snapshotId);
        return { ok: true, schemaVersion: payload.schemaVersion, snapshotId: payload.snapshotId, lineageId: payload.lineageId,
          acceptedRevision: payload.baseRevision + 1, duplicate };
      }
      case "startEncryptedBackupUpload":
        storedMetadata = data as Record<string, any>;
        return { ok: true, status: "uploading", signedUrl, expiresAt, objectKey: "encrypted-backups/uid/test.bin", requiredHeaders: { "content-type": "application/octet-stream", "content-length": String(storedMetadata.encryptedBytes), "x-goog-if-generation-match": "123" } };
      case "finalizeEncryptedBackupUpload": return { ok: !rejectFinalize, status: rejectFinalize ? "invalid" : "verified", verifiedBytes: storedMetadata.encryptedBytes };
      case "getLatestEncryptedBackupDownload":
      case "getEncryptedBackupDownload": return { ok: true, status: "verified", signedUrl, expiresAt, objectKey: "encrypted-backups/uid/test.bin", backupId: storedMetadata.backupId, encryptedBytes: storedMetadata.encryptedBytes, ciphertextSha256: storedMetadata.ciphertextSha256 };
      case "deleteEncryptedBackup": return { ok: true, status: "deleted", duplicate: false };
      default: throw new Error(`Unexpected callable ${name}`);
    }
  } });
  const stop = configureFirebaseFeatureProviders(async () => { requests += 1; return contracts; });
  assert.equal(requests, 0, "Installing providers must not start an Auth or remote request.");
  try {
    const priorEndpoints = [process.env.EXPO_PUBLIC_AI_COACH_ENDPOINT, process.env.EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT, process.env.EXPO_PUBLIC_RETENTION_ENDPOINT];
    try {
      process.env.EXPO_PUBLIC_AI_COACH_ENDPOINT = "http://localhost:3000/legacy";
      process.env.EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT = "http://localhost:3000/legacy";
      process.env.EXPO_PUBLIC_RETENTION_ENDPOINT = "http://localhost:3000/legacy";
      assert.equal(getCoachReadiness().status, "local", "Native foundation startup does not enable online AI.");
      assert.equal(getChallengeGenerationReadiness().status, "local");
      assert.equal(getRetentionReadiness().status, "local");
    } finally {
      ["EXPO_PUBLIC_AI_COACH_ENDPOINT", "EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT", "EXPO_PUBLIC_RETENTION_ENDPOINT"].forEach((key, index) => {
        if (priorEndpoints[index] === undefined) delete process.env[key];
        else process.env[key] = priorEndpoints[index];
      });
    }
    const exportDay = "2026-10-03T12:00:00.000Z";
    const ownState = recordDailyCheckIn(
      recordBlockingAttempt(createDefaultRecoveryState(), createPanicInterventionAttempt(exportDay)),
      { mood: "steady", urgeLevel: 2, sleepQuality: 4, reflection: "private-note https://pornhub.com" },
      exportDay
    );
    const deviceAttempt = { ...createBlockingAttempt("https://pornhub.com/private?note=secret", "browser"), detectedAt: exportDay };
    const mixedState = recordBlockingAttempt(ownState, deviceAttempt);
    mixedState.activityArchive.attemptTotals = { browser: 50 };
    mixedState.activityArchive.attemptMinutes[String(Math.floor(Date.parse(exportDay) / 60000))] = { browser: 50 };
    mixedState.activityArchive.unlockTotals = { count: 77, seconds: 7_777 };
    const context = { attempts: mixedState.attempts, exportState: mixedState, exportDay, premium: false, streakDays: 2,
      attemptsToday: 999, slipsThisWeek: 1, slipWindow: "Late night", slipTrigger: "Stress about private-note" };
    const challengeProfile = { exportState: mixedState, exportDay, streakDays: 2, premium: false, attemptsToday: 999,
      mood: "stressed" as const, hour: 23, slipsThisWeek: 1, slipWindow: "Late night", slipTrigger: "Scrolling private-note",
      interventionContext: buildInterventionContextFromAttempt(deviceAttempt),
      riskForecast: { level: "high" as const, score: 99, confidence: "high" as const,
        currentWindow: "DEVICE-ONLY-TAINT", drivers: ["DEVICE-ONLY-TAINT"] } };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayState = recordDailyCheckIn(createDefaultRecoveryState(), { mood: "steady", urgeLevel: 1, sleepQuality: 3, reflection: "older private reflection" }, yesterday.toISOString());
    const state = recordDailyCheckIn(yesterdayState, { mood: "steady", urgeLevel: 2, sleepQuality: 4, reflection: "private-note https://pornhub.com" });
    const beforeAiCalls = calls.length;
    const beforeAiContracts = requests;
    assert.equal((await replyWithCoach("Help me choose a reset", context)).provider, "local");
    assert.equal((await generateAdaptiveChallengeSet(challengeProfile)).length, 3);
    assert.equal((await generateRetentionPlan(state)).provider, "local");
    // Explicit mode selection is not native cloud-service or user-consent authorization.
    await replyWithCoach("Help me choose a reset", context, { mode: "remote" });
    await generateAdaptiveChallengeSet(challengeProfile, { mode: "remote" });
    await generateRetentionPlan(state, { mode: "remote" });
    assert.equal(calls.length, beforeAiCalls, "Native startup must not attach any sensitive AI callable, even to an explicit remote-mode request.");
    assert.equal(requests, beforeAiContracts, "Local support must not acquire Auth/contracts for undeployed AI.");

    const resolved = await resolveAdultDomainFeed();
    assert.equal(resolved.provider, "remote");
    assert.deepEqual(resolved.feed?.domains, domains);
    const cached = await resolveAdultDomainFeed(undefined, undefined, resolved.feed?.checksum);
    assert.equal(cached.provider, "remote-cache");
    feed = { ...feed, checksum: "a".repeat(64), version: `oisd-nsfw-small-${"a".repeat(16)}` };
    const tampered = await resolveAdultDomainFeed();
    assert.equal(tampered.provider, "embedded");
    assert.match(tampered.warning ?? "", /checksum|integrity/i);
    feed = { ...feed, checksum: feedHash, version: `oisd-nsfw-small-${feedHash.slice(0, 16)}`, generatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString() };
    assert.equal((await resolveAdultDomainFeed()).provider, "embedded");
    const overCapacityDomains = Array.from({ length: 50_001 }, (_unused, index) => `a${String(index).padStart(5, "0")}.example.xxx`);
    const overCapacityHash = createHash("sha256").update(`${overCapacityDomains.join("\n")}\n`).digest("hex");
    feed = { ...feed, generatedAt: now, checksum: overCapacityHash, version: `oisd-nsfw-small-${overCapacityHash.slice(0, 16)}`, domains: overCapacityDomains };
    const overCapacity = await resolveAdultDomainFeed();
    assert.equal(overCapacity.provider, "embedded", "A reviewed feed must not be silently truncated while retaining its server version.");
    assert.match(overCapacity.warning ?? "", /capacity|trunc/i);

    const beforeBlocked = calls.length;
    const blocked = await sendGatedAnalyticsPayload(state);
    assert.equal(blocked.status, "blocked");
    assert.equal(calls.length, beforeBlocked, "Analytics without consent must not call Firebase.");
    const controls = { ...createDefaultAnalyticsSharingControls(), enabled: true, userOptedInAt: now, consentVersion: ANALYTICS_CONSENT_VERSION, endpointUrl: getConfiguredAnalyticsEndpoint(), dataRetentionDays: 14 };
    const analyticsIdentityState = prepareAnalyticsSnapshotState(state);
    const pending = await prepareAnalyticsPendingSnapshot(analyticsIdentityState, controls);
    const analyticsState = stageAnalyticsPendingSnapshot(analyticsIdentityState, analyticsIdentityState, pending);
    const sent = await sendGatedAnalyticsPayload(analyticsState, controls);
    assert.equal(sent.accepted, true);
    assert.equal(sent.provider, "firebase");
    const analytics = calls.find(call => call.name === "ingestAggregateAnalytics")?.data;
    assert.deepEqual(Object.keys(analytics).sort(), ["baseRevision", "consentVersion", "dataRetentionDays", "days", "lineageId", "schemaVersion", "snapshotId", "userOptedInAt"]);
    assert.equal(analytics.days.reduce((sum: number, day: {checkIns: number}) => sum + day.checkIns, 0), 2);
    assert.equal(analytics.days.reduce((sum: number, day: {completedChallenges: number}) => sum + day.completedChallenges, 0), 0);
    assert.equal((await sendGatedAnalyticsPayload(analyticsState, controls)).accepted, true);
    assert.equal(acceptedCheckIns, 2, "Repeating absolute day counters must not increment the same recorded check-ins twice.");
    const deniedConsent = await sendGatedAnalyticsPayload(state, { ...controls, privateNotesAllowed: true });
    assert.equal(deniedConsent.status, "blocked");
    assert.equal(calls.filter(call => call.name === "ingestAggregateAnalytics").length, 2);

    const fetcher: typeof fetch = async (_input, init) => {
      assert.equal("Authorization" in (init?.headers ?? {}), false);
      if (init?.method === "PUT") {
        storedBody = String(init.body);
        assert.equal(storedBody.includes("private-note"), false);
        assert.equal(storedBody.includes("long-encryption-passphrase"), false);
        assert.equal(createHash("sha256").update(storedBody).digest("hex"), storedMetadata.ciphertextSha256);
        assert.equal(Buffer.byteLength(storedBody), storedMetadata.encryptedBytes);
        return new Response("", { status: 200 });
      }
      return new Response(storedBody, { status: 200, headers: { "content-type": "application/octet-stream" } });
    };
    const backupConfig = { getAuthToken: async () => "signed-in-native-token", fetcher };
    const beforeUnauthorized = requests;
    assert.equal((await deleteHostedRecoveryBackup({ getAuthToken: async () => null, fetcher })).status, "unauthorized");
    assert.equal(requests, beforeUnauthorized, "A backup with no account token must not acquire remote contracts.");
    assert.equal(getRecoveryBackupClientSyncReadiness(backupConfig).ready, true);
    const uploaded = await uploadEncryptedRecoveryBackup(state, "long-encryption-passphrase", backupConfig);
    assert.equal(uploaded.ok, true);
    assert.match(storedMetadata.backupId, /^bkp_[a-f0-9]{64}$/);
    const restored = await downloadEncryptedRecoveryBackup("long-encryption-passphrase", backupConfig);
    assert.equal(restored.ok, true);
    assert.equal(restored.restoredState?.dailyCheckIns[0].reflection, "private-note https://pornhub.com");
    rejectFinalize = true;
    assert.equal((await uploadEncryptedRecoveryBackup(state, "long-encryption-passphrase", backupConfig)).ok, false);
    assert.equal(calls.filter(call => call.name === "deleteEncryptedBackup").length, 0, "A failed upload must preserve previous backups.");
    rejectFinalize = false;
    const corruptConfig = { ...backupConfig, fetcher: async () => new Response(`${storedBody} `, { status: 200 }) };
    assert.equal((await downloadEncryptedRecoveryBackup("long-encryption-passphrase", corruptConfig)).ok, false);
    assert.equal((await deleteHostedRecoveryBackup({ ...backupConfig, backupId: storedMetadata.backupId })).ok, true);
  } finally { stop(); }
  const unavailableStop = configureFirebaseFeatureProviders(async () => null);
  try {
    assert.equal((await replyWithCoach("I need a reset", { attempts: [] })).provider, "local");
  } finally { unavailableStop(); }
  console.log("Firebase feature runtime tests passed");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
