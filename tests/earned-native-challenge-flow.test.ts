import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEarnedResetChoices, captureEarnedResetTemplate, matchesEarnedResetTemplate } from '../src/lib/earned-reset-templates';
import { createChallengeSessionController } from '../src/lib/challenge-session';
import { prepareLiveEarnedAppTimeGrant } from '../src/lib/live-earned-app-time';
import { makeEarnedTimeReference, recoverEarnedTimeReference } from '../src/lib/earned-time-reference';

const offer: any = { offerId:'32345678-1234-4123-8123-123456789abc', nativeInterventionId:'12345678-1234-4123-8123-123456789abc', groupId:'20202020-2020-4020-8020-202020202020', groupRevision:2, configurationGeneration:3, scopeEpoch:4, kind:'ios-app-group', requestedSeconds:300, budgetDay:'2026-10-11', budgetRevision:0, validUntil:'2026-10-11T12:00:00Z', requiredActiveSeconds:60, requiredSteps:30, requiredDistinctPhotoTargets:1, availableMethods:['timer','steps'] };

test('native-capable offers expose an actual 30/60-step alternative alongside seated timers', () => {
  for (const seconds of [300,600]) {
    const native = {...offer, requestedSeconds:seconds, requiredActiveSeconds:seconds===300?60:120, requiredSteps:seconds===300?30:60, requiredDistinctPhotoTargets:seconds===300?1:2};
    const choices = getEarnedResetChoices(native);
    const steps = choices.find(value => value.challenge.verification?.kind === 'steps')?.challenge;
    assert.ok(steps, 'authored native step choice must exist');
    assert.equal(steps.id, `momentum-move-steps:earned-v2:${seconds}`);
    assert.equal((steps.verification as any).minSteps, native.requiredSteps);
    assert.ok(choices.some(value => value.challenge.id.includes('move-seated')));
    const binding = captureEarnedResetTemplate(steps)!;
    assert.ok(matchesEarnedResetTemplate(steps,binding,native));
    assert.equal(matchesEarnedResetTemplate(steps,binding,{...native,availableMethods:['timer']}),false);
    assert.equal(captureEarnedResetTemplate({...steps}),null);
  }
});

test('Find exposes only evaluated targets and two-target choices require distinct nonoverlapping targets', () => {
  assert.equal(getEarnedResetChoices({...offer,availableMethods:['timer','photo']}).some(value=>value.group==='find'),false);
  const single = {...offer,availableMethods:['timer','photo'],supportedPhotoTargetIds:['flower','chair']};
  const find = getEarnedResetChoices(single).find(value=>value.group==='find')?.challenge;
  assert.ok(find, 'evaluated photo target must become an authored choice');
  assert.ok(matchesEarnedResetTemplate(find,captureEarnedResetTemplate(find),single));
  const double = {...single,requestedSeconds:600,requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2};
  const pair = getEarnedResetChoices(double).find(value=>value.group==='find')?.challenge;
  assert.equal(pair?.id,'momentum-find-chair-flower:earned-v2:600');
  assert.equal(getEarnedResetChoices({...double,supportedPhotoTargetIds:['flower']}).some(value=>value.group==='find'),false);
  assert.equal(getEarnedResetChoices({...double,supportedPhotoTargetIds:['flower','plant']}).some(value=>value.group==='find'),false);
});

function sessionFixture(){
  let now=0, fail=false; const memory=new Map<string,string>();
  const options={ownerId:'owner',storage:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('disk');memory.set(key,value)},removeItem:(key:string)=>memory.delete(key)},monotonicNow:()=>now,wallNow:()=>Date.parse('2026-10-11T10:00:00Z')+now,createId:()=> 'session'};
  const controller=createChallengeSessionController(options); controller.hydrate();
  return {controller,options,advance:()=>{now+=5000;controller.tick()},fail:()=>{fail=true}};
}
const stepReceipt=(templateId:string):any=>({version:1,supported:true,accepted:true,reason:null,session:{evidenceSessionId:'42345678-1234-4123-8123-123456789abc',offerId:offer.offerId,completionSessionId:'session',templateId,templateVersion:2,method:'steps',phase:'completed',observedSteps:30,requiredSteps:30,requiredPhotoTargets:1,supportedTargetIds:[],matchedTargetIds:[],stepProofId:'52345678-1234-4123-8123-123456789abc',photoProofIds:[]}});
test('native step completion rejects caller counts and accepts bound native proof without invented timer elapsed',()=>{
  const f=sessionFixture();const challenge=getEarnedResetChoices(offer).find(value=>value.challenge.verification?.kind==='steps')?.challenge;
  assert.ok(challenge,'authored steps required');f.controller.start(challenge);
  for(let i=0;i<12;i++)f.advance();
  assert.equal(f.controller.claimCompletion({steps:30},'unknown','session'),false,'caller count is not native earned proof');
  const fresh=sessionFixture();fresh.controller.start(challenge);
  const native=stepReceipt(challenge.id);
  for(const changed of [{...native,accepted:false},{...native,session:{...native.session,completionSessionId:'other'}},{...native,session:{...native.session,observedSteps:29}},{...native,session:{...native.session,stepProofId:null}},{...native,session:{...native.session,phase:'active'}}]){
    assert.equal((fresh.controller as any).claimNativeCompletion?.(changed,offer,'unknown','session')??false,false);
  }
  assert.equal((fresh.controller as any).claimNativeCompletion?.(native,offer,'unknown','session'),true);
  assert.equal(fresh.controller.read().session?.elapsedMs,0,'native steps do not create foreground seconds');
  assert.equal((fresh.controller.read().session as any).nativeEvidence.stepProofId,'52345678-1234-4123-8123-123456789abc');
  assert.equal(fresh.controller.read().session?.completion?.provenance?.method,'steps');
});
test('native proof persistence failure retains resumable progress and never publishes completion',()=>{
  const f=sessionFixture(),challenge=getEarnedResetChoices(offer).find(value=>value.challenge.verification?.kind==='steps')?.challenge;
  assert.ok(challenge);f.controller.start(challenge);f.fail();
  assert.throws(()=>(f.controller as any).claimNativeCompletion(stepReceipt(challenge.id),offer,'unknown','session'),/disk/);
  assert.equal(f.controller.read().session?.phase,'paused');
});
test('a saved native proof earns only its originating offer and does not reuse restored or raw-count authority',()=>{
  const f=sessionFixture(),challenge=getEarnedResetChoices(offer).find(value=>value.challenge.verification?.kind==='steps')?.challenge;
  assert.ok(challenge);f.controller.start(challenge);f.advance();const native=stepReceipt(challenge.id);native.session.observedSteps=37;
  assert.equal((f.controller as any).claimNativeCompletion?.(native,offer,'unknown','session'),true);
  const ownerLease={ownerUid:'owner',isCurrent:()=>true};
  const attempt:any={source:'app',nativeInterventionId:offer.nativeInterventionId,scope:{kind:'ios-app-group',tokenType:'application',groupId:'20202020-2020-4020-8020-202020202020',groupRevision:2,configurationGeneration:3,scopeEpoch:4}};
  const budget:any={version:2,configuredCapMinutes:20,effectiveCapMinutes:20,spentSeconds:0,remainingSeconds:1200,dayKey:'2026-10-11',nextResetAt:'2026-10-12T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:0,clockState:'verified'};
  const session=f.controller.read().session!,origin:any={sessionId:'session',ownerUid:'owner',ownerLease,attempt,saved:true,earnedTime:{receipt:{version:2,policyVersion:2,supported:true,accepted:true,reason:null,offer,budget},templateBinding:captureEarnedResetTemplate(challenge),nativeEvidence:native}};
  const input:any={origin,session,owner:'owner',ownerLease,storageReady:true,currentAttempt:attempt,durableHistory:[{sessionId:'session',id:challenge.id,completedAt:new Date(session.completion!.completedAtMs).toISOString()}],methodAvailable:true};
  const grant=prepareLiveEarnedAppTimeGrant(input);assert.equal(grant.eligible,true);
  if(grant.eligible)assert.deepEqual(grant.request.evidence,{method:'steps',activeDurationSec:0,observedSteps:37,photoProofIds:[],stepProofId:'52345678-1234-4123-8123-123456789abc'});
  assert.equal(session.elapsedMs,5000,'native payload normalization must retain actual foreground time');
  assert.equal(prepareLiveEarnedAppTimeGrant({...input,origin:{...origin,earnedTime:{...origin.earnedTime,nativeEvidence:undefined}}}).eligible,false);
  assert.equal(prepareLiveEarnedAppTimeGrant({...input,origin:{...origin,earnedTime:{...origin.earnedTime,nativeEvidence:{...native,session:{...native.session,offerId:'other'}}}}}).eligible,false);
});
test('native completed recovery compares proof references before read-only grant lookup and never restores grant authority from history',async()=>{
 const f=sessionFixture(),challenge=getEarnedResetChoices(offer).find(value=>value.challenge.verification?.kind==='steps')!.challenge;f.controller.start(challenge);f.advance();
 const native=stepReceipt(challenge.id);assert.equal((f.controller as any).claimNativeCompletion(native,offer,'unknown','session'),true);
 const ownerLease={ownerUid:'owner',isCurrent:()=>true},attempt:any={source:'app',nativeInterventionId:offer.nativeInterventionId,scope:{kind:'ios-app-group',tokenType:'application',groupId:'20202020-2020-4020-8020-202020202020',groupRevision:2,configurationGeneration:3,scopeEpoch:4}};
 const budget:any={version:2,configuredCapMinutes:20,effectiveCapMinutes:20,spentSeconds:0,remainingSeconds:1200,dayKey:'2026-10-11',nextResetAt:'2026-10-12T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:0,clockState:'verified'};
 const receipt:any={version:2,policyVersion:2,supported:true,accepted:true,reason:null,offer,budget};
 const request:any={version:2,policyVersion:2,offerId:offer.offerId,completionSessionId:'session',category:'move',templateId:challenge.id,templateVersion:2,evidence:{method:'steps',activeDurationSec:0,observedSteps:30,photoProofIds:[],stepProofId:'52345678-1234-4123-8123-123456789abc'}};
 const origin:any={sessionId:'session',ownerUid:'owner',ownerLease,attempt,earnedTime:{receipt,templateBinding:captureEarnedResetTemplate(challenge),request}};
 const reference=makeEarnedTimeReference(origin),restarted=createChallengeSessionController(f.options);restarted.hydrate();
 let lookups=0;
 const options:any={reference,session:restarted.read().session,ownerUid:'owner',ownerLease,actionScope:'owner-scope',now:()=>Date.parse('2026-10-11T10:00:00Z'),isCurrent:()=>true,bind:async()=>({version:1,operationId:offer.nativeInterventionId,supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:3,scopeEpoch:4,errorCode:null,errorDomain:null}),prepare:async()=>receipt,lookup:async()=>{lookups++;return{version:2,policyVersion:2,supported:true,accepted:false,reason:'earned-time-grant-not-found',offerId:null,completionSessionId:null,groupId:null,nativeInterventionId:null,seconds:null,expiresAt:null,effective:false,remainingRestrictionCount:null,replayed:false,budget}}};
 const result=await recoverEarnedTimeReference(options);assert.equal(result.status,'ready');assert.equal(lookups,1);
 if(result.status==='ready')assert.equal(result.origin.earnedTime?.nativeEvidence,undefined,'stored proof reference is not a live native receipt');
 const changed={...request,evidence:{...request.evidence,stepProofId:'forged-proof'}};
 const denied=await recoverEarnedTimeReference({...options,reference:{...reference,grantRequest:changed}});assert.equal(denied.status,'unavailable');assert.equal(lookups,1);
});
test('two-object Find consumes two distinct native target proofs and caller labels never complete it',()=>{
 const nativeOffer={...offer,requestedSeconds:600,requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2,availableMethods:['timer','photo'],supportedPhotoTargetIds:['chair','cup']};
 const challenge=getEarnedResetChoices(nativeOffer).find(value=>value.group==='find')!.challenge,f=sessionFixture();f.controller.start(challenge);
 for(let i=0;i<24;i++)f.advance();
 assert.equal(f.controller.claimCompletion({photoMatched:true,photoLabels:['chair','cup'],photoConfidence:1},'unknown','session'),false);
 const fresh=sessionFixture();fresh.controller.start(challenge);fresh.advance();
 const native:any={version:1,supported:true,accepted:true,reason:null,session:{evidenceSessionId:'42345678-1234-4123-8123-123456789abc',offerId:offer.offerId,completionSessionId:'session',templateId:challenge.id,templateVersion:2,method:'photo',phase:'completed',observedSteps:0,requiredSteps:60,requiredPhotoTargets:2,supportedTargetIds:['chair','cup'],matchedTargetIds:['chair','cup'],stepProofId:null,photoProofIds:['62345678-1234-4123-8123-123456789abc','72345678-1234-4123-8123-123456789abc']}};
 for(const session of [{...native.session,matchedTargetIds:['chair','chair']},{...native.session,photoProofIds:[native.session.photoProofIds[0],native.session.photoProofIds[0]]},{...native.session,matchedTargetIds:['chair']},{...native.session,observedSteps:60},{...native.session,supportedTargetIds:['chair']}])assert.equal(fresh.controller.claimNativeCompletion({...native,session},nativeOffer as any,'unknown','session'),false);
 assert.equal(fresh.controller.claimNativeCompletion(native,nativeOffer as any,'unknown','session'),true);
 const saved=fresh.controller.read().session!;assert.equal(saved.elapsedMs,5000);assert.equal(saved.completion?.provenance?.method,'photo');
 const ownerLease={ownerUid:'owner',isCurrent:()=>true},attempt:any={source:'app',nativeInterventionId:offer.nativeInterventionId,scope:{kind:'ios-app-group',tokenType:'application',groupId:offer.groupId,groupRevision:2,configurationGeneration:3,scopeEpoch:4}};
 const budget:any={version:2,configuredCapMinutes:20,effectiveCapMinutes:20,spentSeconds:0,remainingSeconds:1200,dayKey:'2026-10-11',nextResetAt:'2026-10-12T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:0,clockState:'verified'};
 const origin:any={sessionId:'session',ownerUid:'owner',ownerLease,attempt,saved:true,earnedTime:{receipt:{version:2,policyVersion:2,supported:true,accepted:true,reason:null,offer:nativeOffer,budget},templateBinding:captureEarnedResetTemplate(challenge),nativeEvidence:native}};
 const proposal=prepareLiveEarnedAppTimeGrant({origin,session:saved,owner:'owner',ownerLease,storageReady:true,currentAttempt:attempt,durableHistory:[{sessionId:'session',id:challenge.id,completedAt:new Date(saved.completion!.completedAtMs).toISOString()}] as any,methodAvailable:true});assert.equal(proposal.eligible,true);
 if(proposal.eligible){assert.equal(proposal.request.evidence.activeDurationSec,0);assert.equal(proposal.request.evidence.observedSteps,0);assert.deepEqual(proposal.request.evidence.photoProofIds,['62345678-1234-4123-8123-123456789abc','72345678-1234-4123-8123-123456789abc']);}
});
