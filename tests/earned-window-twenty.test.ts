import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEarnedChallengeRequirements, isEarnedAppTimeOfferRequest, isEarnedAppTimeTemplateBinding,
  isAppGroupEarnedTimeUpdateRequest, validateEarnedAppTimeOfferReceipt } from '../modules/freed-protection/src/earned-app-time';
import { createEarnedAppTimeReferenceState, grantEarnedAppTimeReference } from '../src/lib/earned-app-time';
import { validateAppGroupsSnapshot } from '../src/lib/protection-groups';

const claim = { version:2 as const,policyVersion:2 as const,nativeInterventionId:'a2b4053a-a9e0-4209-9bba-6a6e0fb270ba',groupId:'focus',groupRevision:2,configurationGeneration:1,scopeEpoch:2,kind:'ios-app-group' as const,tokenType:'application' as const,requestedSeconds:1200 as const };
const budget = {version:2 as const,configuredCapMinutes:20 as const,effectiveCapMinutes:20 as const,spentSeconds:0,remainingSeconds:1200,dayKey:'2026-10-11',nextResetAt:'2026-10-12T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:0,clockState:'verified' as const};
const offer = {offerId:'b2b4053a-a9e0-4209-9bba-6a6e0fb270ba',nativeInterventionId:claim.nativeInterventionId,groupId:'focus',groupRevision:2,configurationGeneration:1,scopeEpoch:2,kind:'ios-app-group' as const,requestedSeconds:1200 as const,budgetDay:budget.dayKey,budgetRevision:0,validUntil:'2026-10-11T10:20:00Z',availableMethods:['timer' as const],requiredActiveSeconds:120 as const,requiredSteps:60 as const,requiredDistinctPhotoTargets:2 as const};
test('twenty-minute windows have explicit bounded requirements and authored templates',()=>{
  assert.deepEqual(getEarnedChallengeRequirements(1200),{requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2});
  assert.equal(isEarnedAppTimeOfferRequest(claim),true);
  assert.ok(validateEarnedAppTimeOfferReceipt({version:2,policyVersion:2,supported:true,accepted:true,reason:null,offer,budget},claim));
  assert.equal(isEarnedAppTimeTemplateBinding('momentum-breathe-soft:earned-v2:1200',2,'breathe','timer',1200),true);
  assert.equal(isEarnedAppTimeTemplateBinding('momentum-find-chair-flower:earned-v2:1200',2,'find','photo',1200),true);
  assert.equal(isEarnedAppTimeTemplateBinding('momentum-find-flower-plant:earned-v2:1200',2,'find','photo',1200),false);
  for(const seconds of [120,900,1800,1200.5,'1200']) assert.equal(isEarnedAppTimeOfferRequest({...claim,requestedSeconds:seconds}),false);
});
test('reference projection spends twenty minutes once and preserves the original deadline',()=>{
  // This projection does not attest a real native commit or phone enforcement.
  const state=createEarnedAppTimeReferenceState({ownerScope:'["owner",1]',groupId:'focus',now:'2026-10-11T10:00:00Z',dayKey:budget.dayKey,nextResetAt:budget.nextResetAt});
  const input={request:{version:2 as const,policyVersion:2 as const,offerId:offer.offerId,completionSessionId:'session-20',category:'breathe' as const,templateId:'momentum-breathe-soft:earned-v2:1200',templateVersion:2,evidence:{method:'timer' as const,activeDurationSec:120,observedSteps:0,photoProofIds:[]}},offer,ownerScope:'["owner",1]',currentClaim:claim,now:'2026-10-11T10:00:00Z',clockVerified:true,nativeV2Available:true,durableLiveCompletionSessionId:'session-20',explicitStart:true,independentRestrictionCount:0,nativeCommitSucceeded:true};
  const result=grantEarnedAppTimeReference(state,input);
  assert.equal(result.receipt.accepted,true);
  assert.equal(result.receipt.seconds,1200);assert.equal(result.receipt.expiresAt,'2026-10-11T10:20:00.000Z');
  assert.equal(result.receipt.budget?.spentSeconds,1200);assert.equal(result.receipt.budget?.remainingSeconds,0);
  const replay=grantEarnedAppTimeReference(result.state,{...input,now:'2026-10-11T10:01:00Z'});
  assert.equal(replay.receipt.replayed,true);assert.equal(replay.receipt.expiresAt,result.receipt.expiresAt);assert.equal(replay.receipt.budget?.spentSeconds,1200);
});
test('preferred window update is optional, bounded and separate from authority',()=>{
  const update={version:2,expectedStoreRevision:1,id:'focus',expectedRevision:2,name:'My apps',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[],extraTimeCapMinutes:20};
  assert.equal(isAppGroupEarnedTimeUpdateRequest(update,'ios'),true);
  assert.equal(isAppGroupEarnedTimeUpdateRequest({...update,preferredBreakSeconds:1200},'ios'),true);
  for(const preferredBreakSeconds of [null,900,'1200',Infinity])assert.equal(isAppGroupEarnedTimeUpdateRequest({...update,preferredBreakSeconds},'ios'),false);
  assert.equal(isAppGroupEarnedTimeUpdateRequest({...update,preferredBreakSeconds:1200,unlock:true},'ios'),false);
});
test('group readback cannot advertise a twenty-minute default without native support',()=>{
  const group={id:'focus',revision:2,name:'Apps',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[],applicationCount:1,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:false,active:false,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null,preferredBreakSeconds:1200};
  const snapshot={version:1,supported:true,platform:'ios',revision:1,configurationGeneration:1,scopeEpoch:2,groups:[group],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
  assert.equal(validateAppGroupsSnapshot(snapshot),null);
  assert.ok(validateAppGroupsSnapshot({...snapshot,supportedBreakSeconds:[300,600,1200]}));
  for(const supportedBreakSeconds of [[300,600,1200,1200],[300,900],[1200,'300']])assert.equal(validateAppGroupsSnapshot({...snapshot,supportedBreakSeconds}),null);
});
