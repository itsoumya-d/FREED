import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeInterventionAttempt, createDeepLinkInterventionAttempt, unlockSourceForAttempt } from '../src/lib/native-intervention';
import { getProtectionChallengeCompletionDecision, consumePendingInterventionOnce, createPendingInterventionTracker } from '../src/lib/protection-capabilities';
import { focusShieldScopesMatch } from '../src/lib/focus-shield';
import { createDefaultRecoveryState, recordBlockingAttempt, hydrateRecoveryState } from '../src/lib/recovery-state';
import { buildPortableRecoveryState } from '../src/lib/recovery-backup';
import { requiresNativeUnlockConfirmation } from '../src/lib/native-unlock-confirmation';
import { isFamilyControlsDerivedSignal } from '../src/lib/recovery-signal-privacy';
const id='432f2c60-9277-4e92-bd96-af68c4f8d375',time='2026-10-07T12:00:00.000Z';
const pending={interventionId:id,url:'https://screen-time-shield.freed.local',host:'screen-time-shield.freed.local',sourcePackage:'ios-screen-time',reason:'Screen Time requested recovery',matchedRule:'ios-screen-time-shield',detectedAt:time};
test('new live iOS public scope keeps only token kind and genuine native ID; no generic kind matching or portable target authority',async()=>{
 const payload={...pending,scope:{kind:'ios-screen-time' as const,tokenType:'application' as const}},attempt=createNativeInterventionAttempt(payload);
 assert.deepEqual(attempt.scope,payload.scope);assert.equal(attempt.nativeInterventionId,id);assert.equal(getProtectionChallengeCompletionDecision(attempt,'unknown').grantEarnedUnlock,true);
 assert.equal(unlockSourceForAttempt(attempt),'screen-time-shield.freed.local');assert.equal(requiresNativeUnlockConfirmation({id:'live',startedAt:time,expiresAt:'2026-10-07T12:10:00.000Z',durationMinutes:10,sourceChallengeId:'reset',nativeInterventionId:id,sourceAttemptHost:unlockSourceForAttempt(attempt)},'ios'),true);assert.equal(isFamilyControlsDerivedSignal({scope:payload.scope}),true);
 assert.equal(focusShieldScopesMatch(payload.scope,payload.scope),false);
 const stored=recordBlockingAttempt(createDefaultRecoveryState(),attempt),hydrated=hydrateRecoveryState(stored);assert.equal((hydrated.attempts[0] as any).scope,undefined);assert.equal((hydrated.attempts[0] as any).nativeInterventionId,undefined);assert.ok(!JSON.stringify(buildPortableRecoveryState(stored,time)).includes('ios-screen-time'));
 const tracker=createPendingInterventionTracker();assert.ok(await consumePendingInterventionOnce({tracker,getPending:async()=>payload,clearPending:async()=>true,nowMs:Date.parse(time)}));assert.equal(await consumePendingInterventionOnce({tracker,getPending:async()=>payload,clearPending:async()=>true,nowMs:Date.parse(time)}),null);
});
test('category/domain, missing/counterfeit native ID, old token scopes, and deeplinks cannot mint fresh legacy app authority',()=>{
 for(const tokenType of ['category','domain'] as const){const attempt=createNativeInterventionAttempt({...pending,scope:{kind:'ios-screen-time',tokenType}});assert.equal(getProtectionChallengeCompletionDecision(attempt,'unknown').grantEarnedUnlock,false);}
 const old=createNativeInterventionAttempt({...pending,scope:{kind:'ios-token',tokenType:'application',token:'historical-private-token'}});assert.equal(getProtectionChallengeCompletionDecision(old,'unknown').grantEarnedUnlock,false);
 for(const interventionId of ['', 'counterfeit'])assert.equal(getProtectionChallengeCompletionDecision(createNativeInterventionAttempt({...pending,interventionId,scope:{kind:'ios-screen-time',tokenType:'application'}}),'unknown').grantEarnedUnlock,false);
 assert.equal(createDeepLinkInterventionAttempt('freed://intervention?source=ios-screen-time&tokenType=application&id='+id),null);
});
test('a valid-looking counterfeit UUID still needs a real native claim and public DTO rejects hidden token fields',async()=>{
 const payload={...pending,scope:{kind:'ios-screen-time' as const,tokenType:'application' as const}};
 assert.equal(await consumePendingInterventionOnce({tracker:createPendingInterventionTracker(),getPending:async()=>payload,clearPending:async()=>false,nowMs:Date.parse(time)}),null);
 assert.equal(createNativeInterventionAttempt({...payload,scope:{...payload.scope,token:'must-stay-native'} as any}).scope,undefined);
});
