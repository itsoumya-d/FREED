import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createChallengeSessionController} from '../src/lib/challenge-session';
import {createLiveEarnedOfferCoordinator,prepareLiveEarnedAppTimeGrant,isEarnedOfferAdFeasible} from '../src/lib/live-earned-app-time';
import {getEarnedResetChoices,captureEarnedResetTemplate,matchesEarnedResetTemplate} from '../src/lib/earned-reset-templates';
import {captureMomentumRewardTemplate} from '../src/lib/momentum-reward-templates';
const nativeId='12345678-1234-4123-8123-123456789abc',groupId='20202020-2020-4020-8020-202020202020';
const ownerLease={ownerUid:'owner',isCurrent:()=>true};
const attempt:any={source:'app',nativeInterventionId:nativeId,scope:{kind:'ios-app-group',tokenType:'application',groupId,groupRevision:2,configurationGeneration:3,scopeEpoch:4}};
const budget:any={version:2,configuredCapMinutes:20,effectiveCapMinutes:20,spentSeconds:0,remainingSeconds:1200,dayKey:'2026-10-08',nextResetAt:'2026-10-09T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:0,clockState:'verified'};
const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:nativeId,groupId,groupRevision:2,configurationGeneration:3,scopeEpoch:4,kind:'ios-app-group',requestedSeconds:600,budgetDay:budget.dayKey,budgetRevision:0,validUntil:'2026-10-08T12:00:00Z',requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2,availableMethods:['timer']};
const receipt:any={version:2,policyVersion:2,supported:true,accepted:true,reason:null,offer,budget};
const context=()=>({ownerUid:'owner',ownerLease,actionScope:'["owner",1]',attempt,storageReady:true});
const binding=()=>({version:1,operationId:nativeId,supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:3,scopeEpoch:4,errorCode:null,errorDomain:null});
test('v2 factory creates authored120-second timer choices without changing v1 or trusting copied metadata',()=>{
 const choices=getEarnedResetChoices(offer);assert.deepEqual(choices.map(x=>x.group),['breathe','move']);
 for(const {challenge} of choices){assert.equal(challenge.durationSec,120);assert.match(challenge.id,/:earned-v2:600$/);assert.equal(Object.isFrozen(challenge),true);assert.equal(Object.isFrozen(challenge.steps),true);assert.equal(captureMomentumRewardTemplate(challenge),null);const original=captureEarnedResetTemplate(challenge)!;assert.equal(original.templateVersion,2);assert.equal(captureEarnedResetTemplate({...challenge}),null);assert.equal(matchesEarnedResetTemplate({...challenge,title:'translated',why:'private',steps:['a','b']},original,offer),true);assert.equal(matchesEarnedResetTemplate({...challenge,durationSec:60},original,offer),false);}
 assert.equal(getEarnedResetChoices({...offer,availableMethods:['photo']}).length,0);
 const short=getEarnedResetChoices({...offer,requestedSeconds:300,requiredActiveSeconds:60,requiredSteps:30,requiredDistinctPhotoTargets:1});assert.equal(short[0].challenge.durationSec,60);
});
test('actual session controller captures v2 authored revision and replacement does not consume access twice',()=>{
 let mono=0,consumed=0;const memory=new Map<string,string>();const c=createChallengeSessionController({ownerId:'owner',storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},monotonicNow:()=>mono,wallNow:()=>Date.parse('2026-10-08T10:00:00Z')+mono,createId:()=> 'session',access:{consume:()=>{consumed++;return true},allows:()=>true}});
 c.hydrate();const choices=getEarnedResetChoices(offer);c.start(choices[0].challenge);assert.equal(c.read().session?.templateRevision?.revision,2);c.replace(choices[1].challenge,'session');assert.equal(consumed,1);assert.equal(c.read().session?.templateRevision?.id,choices[1].challenge.id);for(let i=0;i<24;i++){mono+=5000;c.tick();}assert.equal(c.claimCompletion({},'unknown','session'),true);assert.equal(c.read().session?.completion?.provenance?.template?.revision,2);
});
test('offer coordinator obtains native owner binding before offer and denies old binary without native calls',async()=>{
 const calls:string[]=[];const coordinator=createLiveEarnedOfferCoordinator({getContext:context,isAvailable:()=>true,bind:async()=>{calls.push('bind');return binding() as any},prepare:async q=>{calls.push(`offer:${q.requestedSeconds}`);return receipt},now:()=>Date.parse('2026-10-08T10:00:00Z')});
 assert.equal(coordinator.read().status,'idle');await coordinator.select(600);assert.deepEqual(calls,['bind','offer:600']);assert.equal(coordinator.read().status,'ready');assert.ok(coordinator.current());
 const old=createLiveEarnedOfferCoordinator({getContext:context,isAvailable:()=>false,bind:async()=>{throw Error('must not bind')},prepare:async()=>{throw Error('must not prepare')},now:Date.now});await old.select(300);assert.equal(old.read().reason,'earned-time-unavailable');
});
test('owner and claim changes discard an in-flight native offer; malformed or expired offers cannot authorize an ad',async()=>{
 let current=context();let resolve:(r:any)=>void=()=>{};const c=createLiveEarnedOfferCoordinator({getContext:()=>current,isAvailable:()=>true,bind:async()=>binding() as any,prepare:()=>new Promise(r=>resolve=r),now:()=>Date.parse('2026-10-08T10:00:00Z')});
 const pending=c.select(600);await new Promise(r=>setImmediate(r));current={...current,attempt:{...attempt,scope:{...attempt.scope,groupRevision:3}}};resolve(receipt);await pending;assert.equal(c.current(),null);assert.notEqual(c.read().status,'ready');
 for(const bad of [{...receipt,offer:{...offer,requestedSeconds:300}}, {...receipt,offer:{...offer,validUntil:'2026-10-08T09:00:00Z'}}, {...receipt,accepted:false,offer:null,reason:'cap-exhausted'}]){const x=createLiveEarnedOfferCoordinator({getContext:context,isAvailable:()=>true,bind:async()=>binding() as any,prepare:async()=>bad,now:()=>Date.parse('2026-10-08T10:00:00Z')});await x.select(600);assert.equal(x.current(),null);}
});
test('live grant proposal requires durable live completion, original owner/claim/offer/template and exact foreground evidence',()=>{
 const challenge=getEarnedResetChoices(offer)[0].challenge;const templateBinding=captureEarnedResetTemplate(challenge)!;
 const session:any={id:'session',ownerId:'owner',challenge:{...challenge},phase:'completed',elapsedMs:120000,createdAtMs:Date.parse('2026-10-08T10:00:00Z'),evidence:{motionSamples:0,steps:0,distanceMeters:0,locationSamples:0},templateRevision:{id:challenge.id,revision:2},completion:{outcome:'unknown',completedAtMs:Date.parse('2026-10-08T10:02:00Z')}};
 const origin:any={sessionId:'session',ownerUid:'owner',ownerLease,attempt,saved:true,earnedTime:{receipt,templateBinding}};
 const input:any={origin,session,owner:'owner',ownerLease,storageReady:true,currentAttempt:attempt,durableHistory:[{sessionId:'session',id:challenge.id,completedAt:'2026-10-08T10:02:00.000Z'}],methodAvailable:true};
 const proposal=prepareLiveEarnedAppTimeGrant(input);assert.equal(proposal.eligible,true);if(proposal.eligible){assert.equal(proposal.request.templateVersion,2);assert.equal(proposal.request.offerId,offer.offerId);assert.equal(proposal.request.evidence.activeDurationSec,120);assert.equal(Object.isFrozen(proposal.request),true);assert.equal('seconds'in proposal.request,false);}
 for(const changed of [{storageReady:false},{methodAvailable:false},{durableHistory:[]},{ownerLease:{...ownerLease}},{session:{...session,elapsedMs:119999}},{origin:{...origin,saved:false}},{origin:{...origin,earnedTime:{receipt,templateBinding:null}}},{origin:{...origin,earnedTime:{receipt:{...receipt,policyVersion:1},templateBinding}}},{currentAttempt:{...attempt,scope:{...attempt.scope,scopeEpoch:5}}}])assert.equal(prepareLiveEarnedAppTimeGrant({...input,...changed}).eligible,false);
});

import {presentNativeAppBreak} from '../src/lib/live-earned-app-time';
import {readFileSync} from 'node:fs';
test('Home projection uses only current-owner effective native window deadline, never a local duration or history',()=>{
 const snapshot=JSON.parse(readFileSync('tests/fixtures/native-android-app-groups-snapshot.json','utf8'));snapshot.groups[0].break={interventionId:nativeId,expiresAt:'2026-10-08T10:05:00Z',effective:true,remainingRestrictionCount:0};
 const input={snapshot,snapshotScope:'owner-scope',currentScope:'owner-scope',ownerUid:'owner',sdkOwnerUid:'owner',ownerLease,now:Date.parse('2026-10-08T10:00:00Z')};
 assert.deepEqual(presentNativeAppBreak(input),{groupId:snapshot.groups[0].id,nativeInterventionId:nativeId,expiresAt:'2026-10-08T10:05:00Z'});
 for(const changed of [{sdkOwnerUid:'other'},{snapshotScope:'old-scope'},{ownerUid:null},{now:Date.parse('2026-10-08T10:05:00Z')},{ownerLease:{ownerUid:'owner',isCurrent:()=>false}},{snapshot:{...snapshot,groups:[{...snapshot.groups[0],break:{...snapshot.groups[0].break,effective:false,remainingRestrictionCount:1}}]}}])assert.equal(presentNativeAppBreak({...input,...changed}),null);
});

test('pre-ad feasibility reserves exercise plusSDK time and rejects the day boundary without changing the offer',()=>{
 const time=Date.parse('2026-10-08T10:00:00Z');
 assert.equal(isEarnedOfferAdFeasible({...receipt,offer:{...offer,validUntil:'2026-10-08T10:04:30Z'}},time),false);
 assert.equal(isEarnedOfferAdFeasible({...receipt,offer:{...offer,validUntil:'2026-10-08T10:04:31Z'}},time),true);
 assert.equal(isEarnedOfferAdFeasible({...receipt,budget:{...budget,nextResetAt:'2026-10-08T10:04:30Z'}},time),false);
 assert.equal(isEarnedOfferAdFeasible({...receipt,offer:{...offer,validUntil:'2026-10-08T10:02:01Z'}},time,0),true);
});
