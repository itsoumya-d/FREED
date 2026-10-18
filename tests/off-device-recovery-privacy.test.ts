import assert from 'node:assert/strict';
import * as privacy from '../src/lib/recovery-signal-privacy';
import { createDefaultRecoveryState, recordBlockingAttempt, recordDailyCheckIn, recordRelapse, recordChallengeCompletion, recordAppSessionStart, recordAppSessionEnd } from '../src/lib/recovery-state';
import { createPanicInterventionAttempt } from '../src/lib/blocking-engine';
import { createNativeInterventionAttempt } from '../src/lib/native-intervention';
import { buildPortableRecoveryState } from '../src/lib/recovery-backup';
import { buildCoachRequest } from '../src/lib/ai-coach';
import { buildChallengeGenerationRequest } from '../src/lib/challenge-generator';
import { buildAccountabilityMessage, buildSponsorReport, buildSupportCircleReportDeepLink } from '../src/lib/accountability';
import * as retentionModule from '../src/lib/retention-orchestrator';
import * as analyticsModule from '../src/lib/recovery-analytics';
const day = '2026-10-03T10:00:00.000Z';
let state = createDefaultRecoveryState();
state = recordDailyCheckIn(state, { mood: 'steady', urgeLevel: 2, sleepQuality: 3, reflection: 'My own note about Screen Time, ios-screen-time, and family-controls' } as any, day);
state = recordRelapse(state, { note: 'Own setback note', trigger: 'stress' }, day);
state = recordAppSessionEnd(recordAppSessionStart(state, '2026-10-03T09:58:00.000Z'), day);
const exercise = { id: 'own-reset', title: 'Own completed reset', category: 'breathing' as const, durationSec: 60, intensity: 'calm' as const, premium: false, icon: 'Waves', why: 'Own action', steps: ['Breathe'] };
state = recordChallengeCompletion(state, exercise, day, 'screen-time-shield.freed.local', 'helped', 'verified-own-session');
let authoredOnly = JSON.parse(JSON.stringify(state));
authoredOnly = recordBlockingAttempt(authoredOnly, createPanicInterventionAttempt(day));
authoredOnly.activityArchive.attemptTotals = { 'panic-button': 2 };
authoredOnly.activityArchive.attemptMinutes[String(Math.floor(Date.parse(day) / 60000) - 30)] = { 'panic-button': 2 };
const native = createNativeInterventionAttempt({ interventionId: '10101010-1010-4010-8010-101010101010', host: 'screen-time-shield.freed.local', url: 'https://screen-time-shield.freed.local', sourcePackage: 'ios-screen-time', matchedRule: 'ios-screen-time-shield', reason: 'SDK-protection-event', detectedAt: day });
state = recordBlockingAttempt(state, native);
state = recordBlockingAttempt(state, createPanicInterventionAttempt(day));
state.activityArchive.attemptTotals = { app: 40, 'panic-button': 2 };
state.activityArchive.attemptMinutes[String(Math.floor(Date.parse(day) / 60000) - 30)] = { app: 40, 'panic-button': 2 };
state.activityArchive.unlockTotals = { count: 9, seconds: 9999 };
state.coachMessages = [{ role: 'user', text: 'My own reflection', at: day }, { role: 'ai', text: 'SDK-ONLY-TAINT: 40 intercepted moments', at: day }];
state.lastProtectedAt = '2026-10-03T10:00:01.000Z';
const unchanged = JSON.stringify(state);
assert.equal(typeof privacy.projectRecoveryStateForOffDevice, 'function', 'One central off-device projection must remove framework data and its mixed derivatives.');
const own = privacy.projectRecoveryStateForOffDevice(state);
assert.equal(JSON.stringify(state), unchanged, 'Projection must not change local history or enforcement.');
assert.equal(own.attempts.some((a: any) => a.result.matchedRule === 'ios-screen-time-shield'), false);
assert.equal(own.activityArchive.attemptTotals.app, undefined);
assert.equal(own.activityArchive.unlockTotals.count, 0);
assert.equal(own.dailyCheckIns.length, 1);
assert.equal(own.dailyCheckIns[0].reflection, 'My own note about Screen Time, ios-screen-time, and family-controls');
assert.deepEqual(own.coachMessages.map(item => item.role), ['user'], 'Unclassified AI replies may derive from mixed local device context; own chat input stays portable.');
assert.equal(own.relapseRecords[0].note, 'Own setback note');
assert.equal(own.challengeHistory[0].sessionId, 'verified-own-session');
assert.equal(own.challengeHistory[0].sourceAttemptHost, undefined);
assert.equal(own.appSessions[0].durationSec, 120);
assert.equal(own.lastProtectedAt, day);
for (const signal of [{ scope: { kind: 'ios-token', token: 'not-exported' } }, { source: 'ios-screen-time-shield' }, { sourcePackage: 'another-source', source: 'ios-screen-time' }, { host: 'panic.freed.local', result: { host: 'screen-time-shield.freed.local' } }, { matchedRule: 'device-activity-threshold' }, { result: { host: 'screen-time-shield.freed.local' } }]) {
  assert.equal(privacy.isFamilyControlsDerivedSignal(signal), true);
}
const disguised = privacy.projectRecoveryStateForOffDevice({ ...state, attempts: [{ ...createPanicInterventionAttempt(day), sourcePackage: 'ios-screen-time' }] });
assert.equal(disguised.attempts.length, 0, 'Framework source metadata is classified before hydration can discard it.');
const portable = buildPortableRecoveryState(state, day);
assert.equal(portable.attempts.some(attempt => privacy.isFamilyControlsDerivedSignal(attempt)), false);
assert.equal(JSON.stringify(portable).includes('SDK-ONLY-TAINT'), false);
assert.equal(JSON.stringify(portable).includes('screen-time-shield'), false);
const coach = buildCoachRequest('My own question', { attempts: state.attempts, attemptsToday: 999, exportState: state, exportDay: day } as any);
assert.equal(coach.context.attemptsToday, 3, 'Remote count is actual exportable self-reports, not mixed device totals.');
assert.equal(coach.context.recentRules.includes('ios-screen-time-shield'), false);
const request = buildChallengeGenerationRequest({ streakDays: 0, premium: false, mood: 'steady', hour: 10, attemptsToday: 999, exportState: state, exportDay: day,
  interventionContext: { source: 'app', category: 'unknown', surface: 'unknown', matchedRule: 'ios-screen-time-shield', sessionDurationBucket: null },
  riskForecast: { level: 'high', score: 99, confidence: 'high', currentWindow: 'SDK-ONLY-TAINT', drivers: ['SDK-ONLY-TAINT'] } } as any);
assert.equal(request.profile.attemptsToday, 3);
assert.equal(request.profile.interventionContext, null);
assert.deepEqual(request.profile.riskForecast, buildChallengeGenerationRequest({ streakDays: 0, premium: false, mood: 'steady', hour: 10, attemptsToday: 3, exportState: authoredOnly, exportDay: day }).profile.riskForecast, 'Framework event and archive counts cannot alter the exported forecast.');
assert.equal(JSON.stringify(request).includes('SDK-ONLY-TAINT'), false);
assert.throws(() => buildChallengeGenerationRequest({ streakDays: 0, premium: false, mood: 'steady', hour: 10, attemptsToday: 999 }), /off.device|export/i);
const report = buildSponsorReport(state, day);
assert.equal(report.body.includes('Protected moments interrupted'), false);
assert.equal(report.body.includes('Self-reported urge moments: 3'), true);
const support = buildSupportCircleReportDeepLink({ id: 'member', name: 'Trusted friend', role: 'friend', method: 'email', contact: 'friend@example.test', enabled: true } as any, state, 'ios', day);
assert.ok(support);
assert.equal(decodeURIComponent(support).includes('Self-reported urge moments: 3'), true);
assert.equal(decodeURIComponent(support).includes('Protected moments interrupted'), false);
const retention = retentionModule.buildOffDeviceRetentionRequest(state, { day });
assert.equal(retention.profile.attemptsThisWeek, 3);
const analytics = analyticsModule.buildOffDeviceAnalyticsSnapshot(state, day);
assert.equal('blockedAttempts' in analytics.productionMetrics, false);
assert.equal('appInterceptions' in analytics.behavior, false);
assert.equal(analytics.behavior.selfReportedUrges, 3);
assert.equal(analytics.productionMetrics.appForegroundMinutes, 2);
assert.equal(analytics.interventions.completedChallenges, 1);
assert.equal(JSON.stringify(analytics).includes('screen-time'), false);
assert.deepEqual(analytics, analyticsModule.buildOffDeviceAnalyticsSnapshot(authoredOnly, day), 'Raw and archived automatic device counts cannot alter any outbound aggregate, hour, risk or score.');
console.log('Off-device own-action retention, framework derivative exclusion and local-state preservation passed');
const { sanitizeAnalyticsIngestionRequest } = require('../src/lib/recovery-analytics-ingestion');
const envelope = { consentVersion: 'analytics-consent-v1', userOptedInAt: day, dataRetentionDays: 14, snapshot: analytics };
assert.ok(sanitizeAnalyticsIngestionRequest(envelope), 'The existing HTTP ingestion must accept the explicit own-data schema.');
assert.equal(sanitizeAnalyticsIngestionRequest({ ...envelope, snapshot: { ...analytics, behavior: { ...analytics.behavior, appInterceptions: 40 } } }), null, 'A device counter cannot be smuggled under an own-data label.');

assert.equal(buildAccountabilityMessage({ messageTemplate: '{host}' } as any, { streakDays: 0, host: 'screen-time-shield.freed.local' }), 'a risk moment');

import { test } from 'node:test';
import { createEncryptedRecoveryBackup, restoreEncryptedRecoveryBackup } from '../src/lib/recovery-backup';
import { decryptBackupPayload, encryptBackupPayload } from '../src/lib/backup-crypto';
import { configureRemoteCoachProvider, replyWithCoach } from '../src/lib/ai-coach';
import { configureChallengeGenerationProvider, generateAdaptiveChallengeSet } from '../src/lib/challenge-generator';
import { generateChallengeSet } from '../src/lib/recovery-engine';
import { getLocalDateKey } from '../src/lib/recovery-state';
import { recordToolCompletion } from '../src/lib/tool-completion';

const profile = { streakDays: 0, premium: false, mood: 'steady', hour: 10, attemptsToday: 999, exportState: state, exportDay: day } as const;
test('remote challenge mood uses only the selected own check-in and never caller device inference', async () => {
  for (const mood of ['low', 'steady', 'energized', 'stressed'] as const) {
    const checked = recordDailyCheckIn(recordBlockingAttempt(createDefaultRecoveryState(), native), { mood, urgeLevel: 2, sleepQuality: null }, day);
    const request = buildChallengeGenerationRequest({ ...profile, mood: mood === 'low' ? 'energized' : 'low', exportState: checked });
    assert.equal(request.profile.mood, mood);
    assert.equal(request.profile.attemptsToday, 0);
    assert.equal(checked.dailyCheckIns[0].sleepQuality, null);
  }
  const deviceOnly = recordBlockingAttempt(createDefaultRecoveryState(), native);
  assert.equal(buildChallengeGenerationRequest({ ...profile, mood: 'stressed', exportState: deviceOnly }).profile.mood, 'steady');
  const journalOnly = recordDailyCheckIn(deviceOnly, { mood: null, urgeLevel: null, sleepQuality: null, reflection: 'My own journal' }, day);
  assert.equal(buildChallengeGenerationRequest({ ...profile, mood: 'stressed', exportState: journalOnly }).profile.mood, 'steady');
  assert.equal(buildChallengeGenerationRequest({ ...profile, mood: 'stressed', exportDay: '2026-10-04T10:00:00Z' }).profile.mood, 'steady', 'A prior-day answer cannot stand in for the export day.');
  const localProfile = { ...profile, mood: 'stressed' as const };
  assert.deepEqual(await generateAdaptiveChallengeSet(localProfile, { mode: 'local' }), generateChallengeSet(localProfile), 'Local ranking retains caller inference.');
  assert.equal(localProfile.mood, 'stressed');
});

test('tool receipts, authored dates, nullable journal-only records and own tool archives remain portable', () => {
  const dateKey = getLocalDateKey(day);
  let recorded = recordDailyCheckIn(createDefaultRecoveryState(), { mood: null, urgeLevel: null, sleepQuality: null, reflection: 'My own Screen Time journal' }, day);
  recorded = recordToolCompletion(recorded, { sessionId: 'own-tool-session', toolId: 'breathing', title: 'Guided breathing', category: 'breathing', startedAt: '2026-10-03T09:59:00Z', activeDurationSec: 60, dateKey }, new Date(day));
  recorded = recordBlockingAttempt(recorded, native);
  const minute = String(Math.floor(Date.parse(day) / 60_000) - 10);
  recorded.activityArchive.toolCompletionMinutes[minute] = { [dateKey]: { breathing: { unknown: 3 } } };
  recorded.activityArchive.attemptTotals = { app: 50 };
  recorded.activityArchive.unlockTotals = { count: 9, seconds: 9999 };
  const before = JSON.stringify(recorded);
  const portable = buildPortableRecoveryState(recorded, day);
  assert.deepEqual(portable.toolCompletions, recorded.toolCompletions);
  assert.deepEqual(portable.toolCompletionSessionIds, recorded.toolCompletionSessionIds);
  assert.equal(portable.challengeHistory[0].source, 'tool');
  assert.equal(portable.challengeHistory[0].toolId, 'breathing');
  assert.equal(portable.challengeHistory[0].dateKey, dateKey);
  assert.deepEqual(portable.activityArchive.toolCompletionMinutes, recorded.activityArchive.toolCompletionMinutes);
  assert.deepEqual(portable.dailyCheckIns, recorded.dailyCheckIns);
  assert.equal(portable.dailyCheckIns[0].checkInCompleted, false);
  assert.equal(portable.dailyCheckIns[0].journalSaved, true);
  assert.equal(portable.attempts.length, 0);
  assert.equal(portable.activityArchive.attemptTotals.app, undefined);
  assert.equal(portable.activityArchive.unlockTotals.count, 0);
  assert.equal(JSON.stringify(recorded), before);
});
test('actual provider boundaries use recomputed own context without serializing the local state', async () => {
  let coachSent = false, challengeSent = false, retentionSent = false;
  configureRemoteCoachProvider(async request => {
    coachSent = true;
    assert.equal(request.context.attemptsToday, 3);
    assert.equal(JSON.stringify(request).includes('screen-time-shield'), false);
    assert.equal('exportState' in request.context, false);
    return { text: 'Take a breath and pause.', provider: 'remote', status: 'ok' };
  });
  configureChallengeGenerationProvider(async request => {
    challengeSent = true;
    assert.equal(request.profile.attemptsToday, 3);
    assert.equal('exportState' in request.profile, false);
    return [];
  });
  retentionModule.configureRemoteRetentionProvider(async request => {
    retentionSent = true;
    assert.equal(request.profile.attemptsThisWeek, 3);
    assert.equal(JSON.stringify(request).includes('screen-time-shield'), false);
    return retentionModule.createLocalRetentionPlan(request);
  });
  try {
    await replyWithCoach('Help me reset', { attempts: state.attempts, attemptsToday: 999, exportState: state, exportDay: day }, { mode: 'remote' });
    await generateAdaptiveChallengeSet(profile, { mode: 'remote' });
    await retentionModule.generateRetentionPlan(state, { mode: 'remote', day });
    assert.ok(coachSent && challengeSent && retentionSent, 'Exercise each actual provider dispatch, not only builder functions.');
    challengeSent = false;
    await generateAdaptiveChallengeSet({ ...profile, exportState: undefined }, { mode: 'remote' });
    assert.equal(challengeSent, false, 'Missing trusted context must use local challenges before contacting a provider.');
  } finally {
    configureRemoteCoachProvider(null); configureChallengeGenerationProvider(null); retentionModule.configureRemoteRetentionProvider(null);
  }
});

test('HTTP analytics body and custom-provider state exclude device derivatives', async () => {
  const endpoint = 'https://privacy-fixture.freedapp.com/api/analytics';
  const previous = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT;
  process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT = endpoint;
  const controls = { ...analyticsModule.createDefaultAnalyticsSharingControls(), enabled: true, userOptedInAt: new Date(Date.now() - 60_000).toISOString(), consentVersion: 'analytics-consent-v1', dataRetentionDays: 14, endpointUrl: endpoint };
  let sentBody: any;
  try {
    const result = await analyticsModule.sendGatedAnalyticsPayload(state, controls, { day, fetcher: async (_url, init) => {
      sentBody = JSON.parse(String(init?.body));
      return { ok: true, status: 200, json: async () => ({ accepted: true, status: 'ok', provider: 'custom' }) };
    } });
    assert.equal(result.sent, true, result.reason);
    assert.ok(sanitizeAnalyticsIngestionRequest(sentBody));
    assert.equal(sentBody.snapshot.behavior.selfReportedUrges, 3);
    assert.equal('blockedAttempts' in sentBody.snapshot.productionMetrics, false);
    assert.equal(JSON.stringify(sentBody).includes('SDK-ONLY-TAINT'), false);
    let called = false;
    analyticsModule.configureRemoteAnalyticsProvider({ endpointUrl: endpoint, send: async (snapshot, projected) => {
      called = true;
      assert.equal(snapshot.behavior.selfReportedUrges, 3);
      assert.equal(projected.attempts.some(attempt => privacy.isFamilyControlsDerivedSignal(attempt)), false);
      assert.equal(projected.activityArchive.attemptTotals.app, undefined);
      return { accepted: true, status: 'ok', provider: 'custom' };
    } });
    assert.equal((await analyticsModule.sendGatedAnalyticsPayload(state, controls, { day })).accepted, true);
    assert.ok(called);
  } finally {
    analyticsModule.configureRemoteAnalyticsProvider(null);
    if (previous === undefined) delete process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT; else process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT = previous;
  }
});

test('encrypted portable output strips device data while legacy inbound history and source local state remain intact', async () => {
  const passphrase = 'privacy fixture passphrase';
  const envelope = JSON.parse(await createEncryptedRecoveryBackup(state, passphrase, day));
  const decoded = JSON.parse(await decryptBackupPayload(passphrase, envelope.kdf.salt, envelope.cipher.iv, envelope.payload));
  assert.equal(decoded.state.attempts.some((attempt: unknown) => privacy.isFamilyControlsDerivedSignal(attempt)), false);
  assert.equal(decoded.state.activityArchive.attemptTotals.app, undefined);
  assert.equal(decoded.state.activityArchive.unlockTotals.count, 0);
  assert.equal(decoded.state.challengeHistory[0].sourceAttemptHost, undefined);
  assert.deepEqual(decoded.state.coachMessages.map((entry: any) => entry.role), ['user']);
  assert.equal(decoded.state.dailyCheckIns[0].reflection, state.dailyCheckIns[0].reflection);
  assert.equal(decoded.state.lastProtectedAt, day);
  const restored = await restoreEncryptedRecoveryBackup(JSON.stringify(envelope), passphrase);
  assert.equal(restored.relapseRecords[0].note, 'Own setback note');
  assert.equal(restored.challengeHistory[0].sessionId, 'verified-own-session');
  const legacyPayload = JSON.stringify({ app: 'FREED', version: 1, exportedAt: day, state });
  const legacyEnvelope = { ...envelope, payload: await encryptBackupPayload(passphrase, envelope.kdf.salt, envelope.cipher.iv, legacyPayload) };
  const legacy = await restoreEncryptedRecoveryBackup(JSON.stringify(legacyEnvelope), passphrase);
  assert.equal(legacy.attempts.some(attempt => privacy.isFamilyControlsDerivedSignal(attempt)), true, 'Inbound legacy history remains on-device; projection is outbound only.');
  assert.equal(legacy.activityArchive.attemptTotals.app, 40);
  assert.equal(JSON.stringify(state), unchanged);
});
