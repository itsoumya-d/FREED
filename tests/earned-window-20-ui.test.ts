import assert from 'node:assert/strict';import {test} from 'node:test';
import {getEarnedResetChoices,captureEarnedResetTemplate,matchesEarnedResetTemplate} from '../src/lib/earned-reset-templates';
import {draftFromGroup,restoreAppGroupDraft} from '../src/lib/app-group-drafts';
const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:1200,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2,availableMethods:['timer','steps','photo'],supportedPhotoTargetIds:['chair','cup']};
test('20-minute authored activities keep comfortable120-second/60-step/two-target requirements',()=>{
 const choices=getEarnedResetChoices(offer);assert.ok(choices.every(choice=>choice.challenge),'all20choices must be actual activities');
 for(const choice of choices){assert.match(choice.challenge.id,/:earned-v2:1200$/);assert.equal(choice.challenge.durationSec,120);assert.equal(matchesEarnedResetTemplate(choice.challenge,captureEarnedResetTemplate(choice.challenge),offer),true);}
 assert.equal(choices.find(choice=>choice.challenge.verification?.kind==='steps')?.challenge.verification?.kind,'steps');
 assert.equal(choices.find(choice=>choice.group==='find')?.challenge.id,'momentum-find-chair-cup:earned-v2:1200');
 assert.equal(getEarnedResetChoices({...offer,supportedPhotoTargetIds:['flower','plant']}).some(choice=>choice.group==='find'),false);
});
test('saved preferred break round-trips in an inert owner-scoped draft without changing Before-use',()=>{
 const group:any={id:'group',revision:3,name:'Existing apps',enabled:true,rule:{kind:'before-use'},packages:[],preferredBreakSeconds:600};
 const initial=draftFromGroup(group);assert.equal(initial.preferredBreakSeconds,600);const changed={...initial,preferredBreakSeconds:1200};
 const restored=restoreAppGroupDraft(JSON.stringify(changed),group,'ios');assert.equal(restored.preferredBreakSeconds,1200);assert.deepEqual(restored.rule,{kind:'before-use'});assert.equal(group.preferredBreakSeconds,600);
 assert.equal(restoreAppGroupDraft(JSON.stringify({...changed,preferredBreakSeconds:900}),group,'ios').preferredBreakSeconds,600);
});
