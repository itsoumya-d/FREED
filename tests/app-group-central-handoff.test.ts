import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeInterventionAttempt, createDeepLinkInterventionAttempt } from '../src/lib/native-intervention';
import { createPendingInterventionTracker, consumePendingInterventionOnce, getProtectionChallengeCompletionDecision } from '../src/lib/protection-capabilities';
import { confirmedAppGroupGrant } from '../src/lib/app-group-intervention';
import { recordBlockingAttempt, createDefaultRecoveryState, hydrateRecoveryState } from '../src/lib/recovery-state';
import { buildPortableRecoveryState } from '../src/lib/recovery-backup';
const id='432f2c60-9277-4e92-bd96-af68c4f8d375',groupId='9190cf33-1050-47b5-81b3-1b6d71380a93',time='2026-10-07T12:00:00.000Z',pkg='com.actual.installed.customapp';
const scope={kind:'android-app-group' as const,groupId,groupRevision:3,configurationGeneration:7,scopeEpoch:9,packageName:pkg};
const pending={interventionId:id,url:'',host:'',sourcePackage:pkg,reason:'Selected app group',matchedRule:`app-group:${groupId}:3`,detectedAt:time,scope};
test('installed app group exact package and native UUID/revision survive runtime normalization, while no stored/off-device grant authority survives',()=>{
 const attempt=createNativeInterventionAttempt(pending);assert.equal(attempt.source,'app');assert.equal(attempt.sourcePackage,pkg);assert.equal(attempt.nativeInterventionId,id);assert.deepEqual(attempt.scope,scope);assert.equal(attempt.result.category,'unknown');
 assert.equal(getProtectionChallengeCompletionDecision(attempt,'unknown').grantEarnedUnlock,true);
 const stored=recordBlockingAttempt(createDefaultRecoveryState(),attempt);assert.equal((hydrateRecoveryState(stored).attempts[0] as any).nativeInterventionId,undefined);assert.equal((hydrateRecoveryState(stored).attempts[0] as any).scope,undefined);
 assert.ok(!JSON.stringify(buildPortableRecoveryState(stored,time)).includes(pkg));assert.ok(!JSON.stringify(buildPortableRecoveryState(stored,time)).includes(groupId));
  assert.equal(createDeepLinkInterventionAttempt(`freed://intervention?source=app-group&groupId=${groupId}&package=${pkg}`),null);
  const adopted = createNativeInterventionAttempt({ ...pending, matchedRule:'app-group:legacy-default:3', scope:{ ...scope, groupId:'legacy-default' } });
  assert.equal(adopted.scope?.kind,'android-app-group'); assert.equal(adopted.nativeInterventionId,id);
});
test('actual pending tracker rejects mismatched/invalid scope and replay while a valid iOS opaque group needs no exported token bytes',async()=>{
 for(const bad of [{...pending,scope:{...scope,groupRevision:4}},{...pending,scope:{...scope,packageName:'com.other.app'}},{...pending,scope:{...scope,scopeEpoch:-1}}])assert.equal(await consumePendingInterventionOnce({tracker:createPendingInterventionTracker(),getPending:async()=>bad,clearPending:async()=>true,nowMs:Date.parse(time)}),null);
 const tracker=createPendingInterventionTracker();assert.ok(await consumePendingInterventionOnce({tracker,getPending:async()=>pending,clearPending:async()=>true,nowMs:Date.parse(time)}));assert.equal(await consumePendingInterventionOnce({tracker,getPending:async()=>pending,clearPending:async()=>true,nowMs:Date.parse(time)}),null);
 const ios=createNativeInterventionAttempt({...pending,sourcePackage:'ios-screen-time',scope:{kind:'ios-app-group',groupId,groupRevision:3,configurationGeneration:7,scopeEpoch:9,tokenType:'application'}});assert.equal(ios.scope?.kind,'ios-app-group');assert.equal(ios.host,'screen-time-shield.freed.local');assert.equal(getProtectionChallengeCompletionDecision(ios,'unknown').grantEarnedUnlock,true);assert.ok(!JSON.stringify(ios.scope).includes('token"'));
});
test('group-specific actual readback requires exact group/revision/event/package/expiry and never labels false-effective as app access',()=>{
 const expires='2026-10-07T12:10:00.000Z',base={nativeUnlockGrantAccepted:true,nativeUnlockGrantInterventionId:id,appGroupBreakGroupId:groupId,appGroupBreakRevision:3,appGroupBreakEffective:true,appGroupRemainingRestrictionCount:0,activeUnlockInterventionId:id,activeUnlockExpiresAt:expires,activeUnlockSourcePackage:pkg};
 assert.equal(confirmedAppGroupGrant(scope,id,expires,base),'effective');
 for(const bad of [{...base,appGroupBreakRevision:2},{...base,nativeUnlockGrantInterventionId:groupId},{...base,activeUnlockSourcePackage:'com.other.app'},{...base,activeUnlockExpiresAt:time}])assert.equal(confirmedAppGroupGrant(scope,id,expires,bad),null);
 assert.equal(confirmedAppGroupGrant(scope,id,expires,{...base,appGroupBreakEffective:false,appGroupRemainingRestrictionCount:2,activeUnlockExpiresAt:undefined}),'restricted');
});
