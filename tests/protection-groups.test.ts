import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as groups from '../src/lib/protection-groups';
// Literal bridge shape from FreedAppGroupStore.snapshotInternal; no Android SDK or device capture.
const androidSnapshot=JSON.parse(readFileSync(join(__dirname,'fixtures/native-android-app-groups-snapshot.json'),'utf8'));
const validate=(groups as any).validateAppGroupUpdate;
const id='a75e9358-a73c-4b30-a729-f3dc05941d76';
const update={version:1,expectedStoreRevision:2,id,expectedRevision:1,name:'Work',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[]};
test('new groups are disabled thirty-minute drafts with no invented selections',()=>{
 assert.equal(typeof (groups as any).newAppGroupDraft,'function');
 assert.deepEqual((groups as any).newAppGroupDraft('Work'),{name:'Work',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[]});
});
test('validated writes reject malformed revisions, unsafe schedules and client-created legacy rules',()=>{
 assert.equal(typeof validate,'function');assert.deepEqual(validate(update,'ios'),update);
 for(const candidate of [{...update,expectedRevision:true},{...update,enabled:true,packages:["com.example.app"]},{...update,rule:{kind:'legacy'}},{...update,rule:{kind:'scheduled',startMinute:100,endMinute:110,days:[5]},enabled:true}]) assert.equal(validate(candidate,'ios'),null);
 assert.equal(validate({...update,rule:{kind:'scheduled',startMinute:1320,endMinute:480,days:[5]},enabled:false},'ios')?.rule.kind,'scheduled');
});
test('adult root configuration aggregates independently selected DNS and Apple policy',()=>{
 const describe=(groups as any).describeAdultProtectionConfiguration;assert.equal(typeof describe,'function');
 const dns={supported:true,releaseEnabled:true,configured:true,enabled:true,healthy:null,reason:null,provider:'cloudflare-families',requiresSettings:false};
 const result=describe({platform:'ios',screenTime:true,managedSettings:true},{authorized:true,adultFilterActive:false,adultWebPolicyConfigured:false},dns);
 assert.notEqual(result.status,'Off');assert.notEqual(result.status,'Unavailable');assert.equal(result.dnsSelected,true);assert.equal(result.browsingVerified,false);
});
test('group bridge rejects an incomplete acknowledgement or private snapshot with invalid authority fields',()=>{
 const validate=(groups as any).validateAppGroupsSnapshot;assert.equal(typeof validate,'function');
 const snapshot={version:1,supported:true,platform:'ios',revision:1,configurationGeneration:0,scopeEpoch:1,groups:[],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
 assert.ok(validate(snapshot));assert.equal(validate({...snapshot,revision:true}),null);assert.equal(validate({...snapshot,permissions:{authorized:true}}),null);assert.equal(validate({...snapshot,groups:[{id:'made-up'}]}),null);
 const receipt=(groups as any).validateAppGroupReceipt;assert.equal(typeof receipt,'function');assert.equal(receipt({accepted:true,snapshot:{version:1}}),null);assert.equal(receipt({accepted:true,reason:null,snapshot:{...snapshot,supported:false}}),null);assert.ok(receipt({accepted:false,reason:'monitor-capacity',snapshot}));
});
test('group bridge accepts the native Android six-slot snapshot and receipt',()=>{
 assert.deepEqual(groups.validateAppGroupsSnapshot(androidSnapshot),androidSnapshot);
 assert.deepEqual(groups.validateAppGroupReceipt({accepted:true,reason:null,snapshot:androidSnapshot}),{accepted:true,reason:null,snapshot:androidSnapshot});
});
test('group bridge accepts only the native capacity for each platform',()=>{
 const iosSnapshot={...androidSnapshot,platform:'ios',groups:[],configuredGroupCount:0,monitorBudget:{used:0,limit:20}};
 assert.ok(groups.validateAppGroupsSnapshot(iosSnapshot));
 assert.equal(groups.validateAppGroupsSnapshot({...iosSnapshot,monitorBudget:{used:0,limit:6}}),null);
 for(const limit of [0,1,5,7,19,20,21,Number.MAX_SAFE_INTEGER,NaN,Infinity,'6',true,null,undefined]) {
  assert.equal(groups.validateAppGroupsSnapshot({...androidSnapshot,monitorBudget:{used:1,limit}}),null,`Android capacity ${String(limit)}`);
 }
 assert.equal(groups.validateAppGroupsSnapshot({...androidSnapshot,platform:'unknown'}),null);
 const unsupported={...iosSnapshot,supported:false,platform:'unsupported',revision:0,configurationGeneration:0,scopeEpoch:0,permissions:{authorized:false,usageAccess:false,runtimeConnected:false},reason:'unavailable'};
 assert.ok(groups.validateAppGroupsSnapshot(unsupported));
 assert.equal(groups.validateAppGroupsSnapshot({...unsupported,monitorBudget:{used:0,limit:6}}),null);
});
test('group bridge bounds Android usage by native six-slot capacity',()=>{
 const sixGroups=Array.from({length:6},(_,i)=>({...androidSnapshot.groups[0],id:`native-${i}`}));
 assert.ok(groups.validateAppGroupsSnapshot({...androidSnapshot,groups:sixGroups,configuredGroupCount:6,monitorBudget:{used:6,limit:6}}));
 assert.equal(groups.validateAppGroupsSnapshot({...androidSnapshot,monitorBudget:{used:7,limit:6}}),null);
 assert.equal(groups.validateAppGroupReceipt({accepted:true,reason:null,snapshot:{...androidSnapshot,monitorBudget:{used:7,limit:6}}}),null);
});
test('group bridge bounds iOS usage by native twenty-slot capacity',()=>{
 const iosSnapshot={...androidSnapshot,platform:'ios',groups:[],configuredGroupCount:0,monitorBudget:{used:20,limit:20}};
 assert.ok(groups.validateAppGroupsSnapshot(iosSnapshot));
 assert.equal(groups.validateAppGroupsSnapshot({...iosSnapshot,monitorBudget:{used:21,limit:20}}),null);
});
test('group bridge rejects malformed budget counts',()=>{
 for(const used of [-1,1.5,true,'1',NaN,Infinity,null,undefined]) {
  assert.equal(groups.validateAppGroupsSnapshot({...androidSnapshot,monitorBudget:{used,limit:6}}),null);
 }
});
test('accepting native Android capacity retains snapshot authority and group validation',()=>{
 const group=androidSnapshot.groups[0];
 const malformed=[
  {...androidSnapshot,revision:true},
  {...androidSnapshot,configurationGeneration:-1},
  {...androidSnapshot,scopeEpoch:false},
  {...androidSnapshot,maxGroups:20},
  {...androidSnapshot,configuredGroupCount:7},
  {...androidSnapshot,permissions:{authorized:true}},
  {...androidSnapshot,legacyCompatibility:{...androidSnapshot.legacyCompatibility,applicationCount:-1}},
  {...androidSnapshot,groups:[{id:'made-up'}]},
  {...androidSnapshot,groups:[group,group]},
  {...androidSnapshot,groups:Array.from({length:7},(_,i)=>({...group,id:`native-${i}`}))},
  {...androidSnapshot,groups:[{...group,revision:0}]},
  {...androidSnapshot,groups:[{...group,rule:{kind:'before-use',extra:true}}]},
  {...androidSnapshot,groups:[{...group,rule:{kind:'legacy'}}]},
  {...androidSnapshot,groups:[{...group,packages:['invalid-package']}]},
  {...androidSnapshot,groups:[{...group,break:{interventionId:'break',expiresAt:'invalid',effective:true,remainingRestrictionCount:0}}]},
  {...androidSnapshot,platform:'ios',monitorBudget:{used:1,limit:20}},
 ];
 for(const snapshot of malformed)assert.equal(groups.validateAppGroupsSnapshot(snapshot),null);
});
test('an accepted group write still requires a newer matching requested native configuration',()=>{
 const confirmed=(groups as any).isAppGroupMutationConfirmed;assert.equal(typeof confirmed,'function');
 const g={id,revision:2,name:'Work',enabled:true,configured:true,ready:true,rule:{kind:'before-use'},packages:[],applicationCount:1};
 const request={...update,expectedStoreRevision:2,expectedRevision:1,enabled:true,rule:{kind:'before-use'}};
 const receipt={accepted:true,snapshot:{revision:3,reason:null,groups:[g]}};
 assert.equal(confirmed('updateAppGroup',request,receipt),true);assert.equal(confirmed('updateAppGroup',request,{...receipt,snapshot:{...receipt.snapshot,revision:2}}),false);
 assert.equal(confirmed('updateAppGroup',request,{...receipt,snapshot:{...receipt.snapshot,groups:[{...g,rule:{kind:'daily-limit',limitMinutes:30}}]}}),false);
 assert.equal(confirmed('updateAppGroup',request,{...receipt,snapshot:{...receipt.snapshot,groups:[{...g,ready:false}]}}),false);
});
test('optional earned-time budget cannot inject invented allowance into native group snapshots',()=>{
 const budget={version:2,configuredCapMinutes:20,effectiveCapMinutes:20,spentSeconds:300,remainingSeconds:900,dayKey:'2026-10-08:UTC',nextResetAt:'2026-10-09T00:00:00Z',pendingCapMinutes:null,pendingEffectiveAt:null,revision:1,clockState:'verified'};
 const snapshot={...androidSnapshot,groups:androidSnapshot.groups.map((g:any)=>({...g,extraTimeBudget:budget}))};
 assert.ok(groups.validateAppGroupsSnapshot(snapshot));
 for(const extraTimeBudget of [null,{...budget,remainingSeconds:9999},{...budget,effectiveCapMinutes:999},{...budget,revision:true}]) assert.equal(groups.validateAppGroupsSnapshot({...snapshot,groups:[{...snapshot.groups[0],extraTimeBudget}]}),null);
});
