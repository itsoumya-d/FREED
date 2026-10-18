import assert from 'node:assert/strict';
import test from 'node:test';
import {MOMENTUM_RESET_TEMPLATES} from '../src/data/momentum-resets';
import {captureMomentumRewardTemplate,currentMomentumRewardTemplate,matchesMomentumRewardTemplate} from '../src/lib/momentum-reward-templates';
import {prepareLiveResetGroupReward} from '../src/lib/live-reset-reward';
const id='10101010-1010-4010-8010-101010101010',groupId='20202020-2020-4020-8020-202020202020',ownerLease={ownerUid:'owner',isCurrent:()=>true};
function input(templateId='momentum-breathe-soft') {
 const challenge=MOMENTUM_RESET_TEMPLATES.find(t=>t.id===templateId)!;
 const attempt:any={source:'app',nativeInterventionId:id,scope:{kind:'ios-app-group',tokenType:'application',groupId,groupRevision:1,configurationGeneration:0,scopeEpoch:1}};
 const session:any={id:'session',ownerId:'owner',challenge:{...challenge,steps:[...challenge.steps]},phase:'completed',elapsedMs:60000,createdAtMs:100000,evidence:{motionSamples:0,steps:0,distanceMeters:0,locationSamples:0},completion:{completedAtMs:160000,outcome:'unknown'}};
 return {origin:{sessionId:'session',ownerUid:'owner',attempt,ownerLease,saved:true,templateBinding:captureMomentumRewardTemplate(challenge)},session,owner:'owner',ownerLease,storageReady:true,currentAttempt:attempt,durableHistory:[{id:challenge.id,sessionId:'session',title:challenge.title,category:challenge.category,durationSec:60,premium:false,completedAt:new Date(160000).toISOString(),outcome:'unknown' as const}],methodAvailable:true};
}
test('actual authored revision uses explicit template registry, not rule version or English/private copy',()=>{
 for(const template of MOMENTUM_RESET_TEMPLATES){const binding=currentMomentumRewardTemplate(template)!;assert.equal(binding.templateVersion,1);assert.ok(binding.fingerprint);assert.equal(captureMomentumRewardTemplate({...template}),null);assert.equal(matchesMomentumRewardTemplate({...template,title:'私的な言葉',why:'private writing',steps:['one','two']},binding),true);assert.ok(!binding.fingerprint.includes(template.title));}
 const original=MOMENTUM_RESET_TEMPLATES[0];for(const changed of [{...original,durationSec:61},{...original,verification:{version:1 as const,kind:'steps' as const,minSteps:12}},{...original,choiceGroup:'move' as const},{...original,id:'custom-template'}])assert.equal(currentMomentumRewardTemplate(changed),null);
});
test('local completion is a request proposal only, with native consumption/window checks deliberately absent',()=>{
 for(const [template,seconds] of [['momentum-breathe-soft',120],['momentum-move-seated',300]] as const){const value=input(template);const result=prepareLiveResetGroupReward(value);assert.equal(result.eligible,true);if(result.eligible){assert.equal(result.seconds,seconds);assert.equal(result.request.configurationGeneration,0);assert.equal(Object.isFrozen(result.request),true);assert.equal('seconds'in result.request,false);assert.equal('expiresAt'in result.request,false);assert.equal('consumedCompletionSessionIds'in value,false);assert.equal('hasActiveWindow'in value,false);}}
});
test('actual foreground time and supported evidence are required; no self-report invention',()=>{
 for(const patch of [{elapsedMs:59999},{phase:'paused'},{completion:undefined},{ownerId:'other'}]){const value=input();Object.assign(value.session,patch);assert.equal(prepareLiveResetGroupReward(value).eligible,false);}
 const value=input('momentum-move-steps');assert.equal(prepareLiveResetGroupReward(value).eligible,false);value.session.evidence.steps=12;assert.equal(prepareLiveResetGroupReward(value).eligible,true);
});
test('unreadable storage, revoked/replaced lease, unavailable method, missing durable completion and changed scope deny',()=>{
 for(const mutate of [(v:any)=>v.storageReady=false,(v:any)=>v.origin.ownerLease={...ownerLease},(v:any)=>v.ownerLease={ownerUid:'owner',isCurrent:()=>false},(v:any)=>v.methodAvailable=false,(v:any)=>v.durableHistory=[],(v:any)=>v.origin.saved=false,(v:any)=>v.origin.templateBinding=null,(v:any)=>v.currentAttempt={...v.currentAttempt,scope:{...v.currentAttempt.scope,scopeEpoch:2}}]){const value=input();mutate(value);assert.equal(prepareLiveResetGroupReward(value).eligible,false);}
});
test('all finding activities remain no-reward until actual provider-bound proof is integrated',()=>{
 for(const template of MOMENTUM_RESET_TEMPLATES.filter(t=>t.choiceGroup==='find'))assert.equal(prepareLiveResetGroupReward(input(template.id)).eligible,false);
});
