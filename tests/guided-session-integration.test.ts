import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuidedResetAccessController } from '../src/lib/guided-reset-access';
import { createChallengeSessionController } from '../src/lib/challenge-session';
import { canonicalAppBreakStartedAt, nativeGrantConfirmsUnlock } from '../src/lib/native-unlock-confirmation';
import { createDefaultRecoveryState, recordChallengeCompletion, recordEarnedUnlock } from '../src/lib/recovery-state';
import { getProtectionChallengeCompletionDecision } from '../src/lib/protection-capabilities';
const challenge = { id: 'slow', title: 'Breathe', category: 'breathing' as const, durationSec: 2, intensity: 'calm' as const, premium: false, icon: 'Waves', steps: ['Inhale.', 'Exhale.'], why: 'A pause.', verification: { version: 1 as const, kind: 'timer' as const } };
test('production access + activity controllers consume one paid session, restart paused, save neutral once and end access', () => {
    let time = 1800000000000, fail = false;
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { if (fail)
            throw Error(); values.set(k, v); }, removeItem: (k: string) => { if (fail)
            throw Error(); values.delete(k); } };
    const access = () => createGuidedResetAccessController({ ownerUid: 'real/user.uid', storage, currentOwner: () => 'real/user.uid', currentTier: () => 'paid', isForeground: () => true, now: () => time, createId: () => 'only-session', createReward: () => { throw Error('No ad'); }, completeReward: async () => { throw Error('No ad'); } });
    let grant = access();
    grant.hydrate();
    grant.startLicensed();
    const session = () => createChallengeSessionController({ ownerId: 'real/user.uid', storage, storageKey: 'session.real', wallNow: () => time, monotonicNow: () => time, createId: () => grant.read()?.sessionId ?? '', access: grant });
    let c = session();
    c.hydrate();
    fail = true;
    assert.throws(() => c.start(challenge));
    fail = false;
    c.start(challenge);
    assert.throws(() => c.start(challenge));
    time += 1000;
    c.tick();
    c.dispose();
    grant.dispose();
    grant = access();
    grant.hydrate();
    c = session();
    c.hydrate();
    assert.equal(c.read().elapsedSec, 1);
    assert.equal(c.read().running, false);
    assert.equal(c.resume(), true);
    time += 1000;
    c.tick();
    assert.equal(c.claimCompletion({}, 'unknown'), true);
    const receipt = c.read().session!;
    let state = createDefaultRecoveryState();
    state = recordChallengeCompletion(state, challenge, new Date(time).toISOString(), undefined, receipt.completion!.outcome, receipt.id, receipt.elapsedMs / 1000);
    assert.equal(state.challengeHistory[0].outcome, 'unknown');
    assert.equal(state.challengeHistory[0].observedActiveSec, 2);
    const once = state;
    state = recordChallengeCompletion(state, challenge, new Date(time).toISOString(), undefined, 'helped', receipt.id, 500);
    assert.equal(state, once);
    grant.end(receipt.id);
    assert.equal(grant.allows(receipt.id), false);
    assert.equal(c.resume(), false);
    c.abandon();
});
test('planned duration and measured active time remain distinct and legacy history stays unknown', () => {
    const state = recordChallengeCompletion(createDefaultRecoveryState(), { ...challenge, durationSec: 120 }, new Date().toISOString(), undefined, 'unknown', 'observed', 7);
    assert.equal(state.challengeHistory[0].durationSec, 120);
    assert.equal(state.challengeHistory[0].observedActiveSec, 7);
    assert.equal(state.completedChallenges, 1);
});
test('only exact app-scoped verified completion may request break; adult/category/domain never do', () => {
    const base: any = { source: 'app', nativeInterventionId: '11111111-1111-4111-8111-111111111111', result: { matchedRule: 'ios-screen-time-shield' } };
    for (const attempt of [null, { ...base, source: 'browser', scope: { kind: 'browser-domain', domain: 'adult.example' } }, { ...base, scope: { kind: 'ios-token', tokenType: 'category', token: 'x' } }, { ...base, scope: { kind: 'ios-token', tokenType: 'domain', token: 'x' } }, { ...base, nativeInterventionId: undefined, scope: { kind: 'ios-token', tokenType: 'application', token: 'x' } }])
        assert.equal(getProtectionChallengeCompletionDecision(attempt, 'unknown').grantEarnedUnlock, false);
    const app = { ...base, scope: { kind: 'ios-screen-time', tokenType: 'application' } };
    assert.equal(getProtectionChallengeCompletionDecision(app, 'unknown').grantEarnedUnlock, true);
    const start = canonicalAppBreakStartedAt('2026-10-05T10:00:00.789Z', 'ios');
    const state = recordEarnedUnlock(createDefaultRecoveryState(), challenge, { startedAt: start, durationMinutes: 10, sourceAttemptHost: 'screen-time-shield.freed.local', nativeInterventionId: base.nativeInterventionId });
    const unlock = state.earnedUnlocks[0];
    assert.equal(unlock.expiresAt, '2026-10-05T10:10:00.000Z');
    const evidence = { nativeUnlockGrantAccepted: true, nativeUnlockGrantInterventionId: base.nativeInterventionId, activeUnlockInterventionId: base.nativeInterventionId, activeUnlockExpiresAt: unlock.expiresAt };
    assert.equal(nativeGrantConfirmsUnlock(unlock, evidence, 'ios', Date.parse(start)), true);
    assert.equal(nativeGrantConfirmsUnlock(unlock, { ...evidence, activeUnlockExpiresAt: '2026-10-05T10:10:00.789Z' }, 'ios', Date.parse(start)), false);
});

test('a crash after access consumption but before activity persistence repairs only that same session ID',()=>{
 const values=new Map<string,string>(); let failSession=true;
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(key==='activity'&&failSession)throw Error('disk');values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}};
 const makeAccess=()=>createGuidedResetAccessController({ownerUid:'owner',storage,currentOwner:()=> 'owner',currentTier:()=> 'paid',isForeground:()=>true,now:()=>1800000000000,createId:()=> 'earned-session',createReward:()=>{throw Error()},completeReward:async()=>{throw Error()}});
 let access=makeAccess();access.hydrate();access.startLicensed();
 const makeSession=()=>createChallengeSessionController({ownerId:'owner',storage,storageKey:'activity',wallNow:()=>1800000000000,monotonicNow:()=>0,createId:()=>access.read()!.sessionId,access});
 const first=makeSession();first.hydrate();assert.throws(()=>first.start(challenge));assert.equal(access.read()?.state,'consumed');assert.equal(values.has('activity'),false);first.dispose();access.dispose();
 access=makeAccess();access.hydrate();const resumed=makeSession();resumed.hydrate();failSession=false;resumed.start(challenge);assert.equal(resumed.read().session?.id,'earned-session');assert.throws(()=>resumed.start({...challenge,id:'extra'}));
});
