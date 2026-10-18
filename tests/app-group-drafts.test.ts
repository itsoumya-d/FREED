import assert from 'node:assert/strict';import {test} from 'node:test';import {appGroupDraftKey,draftFromGroup,restoreAppGroupDraft} from '../src/lib/app-group-drafts';
const group:any={id:'native-group',revision:2,name:'Work',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[]};
test('device draft is scoped to native configuration/owner epoch/base revision and cannot activate native policy',()=>{
 assert.notEqual(appGroupDraftKey({configurationGeneration:1,scopeEpoch:3} as any,group),appGroupDraftKey({configurationGeneration:1,scopeEpoch:4} as any,group));
 assert.notEqual(appGroupDraftKey({configurationGeneration:1,scopeEpoch:3} as any,group),appGroupDraftKey({configurationGeneration:2,scopeEpoch:3} as any,group));
 const draft={name:'Quiet time',enabled:false,rule:{kind:'before-use'},packages:[]};assert.deepEqual(restoreAppGroupDraft(JSON.stringify(draft),group,'ios'),draft);assert.deepEqual(restoreAppGroupDraft(JSON.stringify({...draft,packages:['com.actual.app']}),group,'ios'),draftFromGroup(group));assert.deepEqual(restoreAppGroupDraft('bad',group,'ios'),draftFromGroup(group));
});
test('earned-time cap drafts retain the native budget revision and reject invalid cap metadata',()=>{
 const current={...group,extraTimeBudget:{configuredCapMinutes:20,revision:4}};
 const draft={name:'Work',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[],extraTimeCapMinutes:10,extraTimeBudgetRevision:4};
 assert.deepEqual(restoreAppGroupDraft(JSON.stringify(draft),current,'ios'),{...draft,extraTimeCapBaseMinutes:20});
 for(const invalid of [{...draft,extraTimeCapMinutes:999},{...draft,extraTimeBudgetRevision:true},{...draft,extraTimeBudgetRevision:-1}])assert.deepEqual(restoreAppGroupDraft(JSON.stringify(invalid),current,'ios'),draftFromGroup(current));
});
test('opening an unchanged cap draft after native spending rebases metadata instead of trapping Save',()=>{
 const initial={...group,extraTimeBudget:{configuredCapMinutes:20,revision:4}};
 const opened=draftFromGroup(initial);
 const current={...initial,extraTimeBudget:{configuredCapMinutes:20,revision:5}};
 const restored=restoreAppGroupDraft(JSON.stringify(opened),current,'ios');
 assert.equal(restored.extraTimeCapMinutes,20);assert.equal(restored.extraTimeBudgetRevision,5);
});
test('clean cap follows new native settings while unrelated writing stays intact',()=>{
 const initial={...group,extraTimeBudget:{configuredCapMinutes:20,revision:4}};
 const draft={...draftFromGroup(initial),name:'Keep this name'};
 const current={...initial,extraTimeBudget:{configuredCapMinutes:5,revision:5}};
 const restored=restoreAppGroupDraft(JSON.stringify(draft),current,'ios');
 assert.equal(restored.name,'Keep this name');assert.equal(restored.extraTimeCapMinutes,5);assert.equal(restored.extraTimeBudgetRevision,5);
});
test('a changed cap survives spend-only revisions but does not silently overwrite another cap edit',()=>{
 const initial={...group,extraTimeBudget:{configuredCapMinutes:20,revision:4}};
 const draft={...draftFromGroup(initial),extraTimeCapMinutes:10};
 const spent={...initial,extraTimeBudget:{configuredCapMinutes:20,revision:5}};
 const restored=restoreAppGroupDraft(JSON.stringify(draft),spent,'ios');assert.equal(restored.extraTimeCapMinutes,10);assert.equal(restored.extraTimeBudgetRevision,5);
 const concurrent={...initial,extraTimeBudget:{configuredCapMinutes:5,revision:5}};
 const conflicted=restoreAppGroupDraft(JSON.stringify(draft),concurrent,'ios');assert.equal(conflicted.extraTimeCapMinutes,10);assert.equal(conflicted.extraTimeBudgetRevision,4);
});
