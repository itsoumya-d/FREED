import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as operations from '../src/lib/website-protection-operations';
import { getProtectionSetupReadiness } from '../src/lib/protection-readiness';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
const ios: ProtectionCapability = { platform:'ios',screenTime:true,managedSettings:true,accessibility:false,dnsFiltering:false,localVpnFallback:false,notes:[] };
const off: ProtectionStatus = {authorized:true,adultFilterActive:false,active:false,mode:'screen-time',message:''};
const create = (operations as any).createProtectionRefreshFence;
const outcome = (operations as any).getAdultPolicyOperationError;
function deferred<T>() { let resolve!: (value:T)=>void; const promise = new Promise<T>(yes => { resolve=yes; }); return {promise,resolve}; }
test('an older status request cannot publish after the newer configuration readback', async()=>{
 assert.equal(typeof create,'function');
 const gate=create(); const old=gate.begin(); const latest=gate.begin();
 assert.equal(old.isCurrent(),false); assert.equal(latest.isCurrent(),true);
 gate.invalidate(); assert.equal(latest.isCurrent(),false);
});
test('native lock rejection stays actionable even if an ordinary status later reads policy off',()=>{
 assert.equal(typeof outcome,'function');
 assert.match(outcome({nativeConfigurationOperationAccepted:false,nativeConfigurationError:'ios-native-configuration-lock-unavailable'}),/busy|retry/i);
 assert.match(outcome({...off,adultWebPolicyOperationAccepted:false,adultWebPolicyReason:'ios-adult-policy-persistence-failed'}),/saved|retry/i);
 assert.equal(outcome({...off,adultFilterActive:true,adultWebPolicyConfigured:true,adultWebPolicyOperationAccepted:true}),null);
});
test('observed policy false overrides a legacy active flag and produces a retry step',()=>{
 const ready=getProtectionSetupReadiness(ios,{...off,adultFilterActive:true,adultWebPolicyConfigured:false,adultFilterRequested:true} as ProtectionStatus,0,'websites');
 assert.equal(ready.websiteProtectionReady,false);
 assert.equal(ready.websiteProtection.status,'Needs attention');
 assert.equal(ready.permissionPlan.find(step=>step.id==='ios-adult-web-filter')?.status,'needed');
});
test('remounts share the native website writer and concurrent taps join one action',async()=>{
 const createWriter=(operations as any).createWebsiteSetupWriter;
 assert.equal(typeof createWriter,'function');
 const writer=createWriter(); const pending=deferred<number>(); let writes=0;
 const first=writer.run(async()=>{writes++;return pending.promise;});
 const remounted=writer.run(async()=>{writes++;return 2;});
 pending.resolve(1);
 assert.deepEqual(await Promise.all([first,remounted]),[1,1]); assert.equal(writes,1);
});

test('contradictory successful acknowledgement cannot override an absent observed policy',()=>{
 assert.match(outcome({...off,adultWebPolicyConfigured:false,adultWebPolicyOperationAccepted:true}),/did not confirm/i);
});

test('native status publication invalidates a pending read before any React state commit',async()=>{
 const createCoordinator=(operations as any).createProtectionRefreshCoordinator;
 assert.equal(typeof createCoordinator,'function');
 const coordinator=createCoordinator({capability:ios,status:off});
 const request=coordinator.begin(); const read=deferred<ProtectionStatus>();
 const pending=read.promise.then(status=>coordinator.publishRead(request,{capability:ios,status}));
 const native={...off,adultFilterActive:true,adultWebPolicyConfigured:true};
 coordinator.publishNative({capability:ios,status:native});
 assert.equal(coordinator.getSnapshot().status,native,'cache changes synchronously, before React can batch its setter');
 read.resolve(off);
 assert.equal(await pending,false); assert.equal(coordinator.getSnapshot().status,native);
 coordinator.invalidate();
 const newOwnerRead=coordinator.begin();
 const current={...off,authorized:false};
 assert.equal(coordinator.publishRead(newOwnerRead,{capability:ios,status:current}),true);
 assert.equal(coordinator.getSnapshot().status,current);
});


test('read ticket remains live after resolution and revision subscriptions notify at newer begin before changed facts',()=>{
 const coordinator=operations.createProtectionRefreshCoordinator({capability:ios,status:off});const revisions:number[]=[];const unsubscribe=coordinator.subscribe(()=>revisions.push(coordinator.getReadRevision()));
 const readA=coordinator.begin();assert.equal(coordinator.publishRead(readA,{capability:ios,status:off}),true);assert.equal(readA.isCurrent(),true);
 const before=coordinator.getSnapshot(),readB=coordinator.begin();assert.equal(coordinator.getSnapshot(),before);assert.equal(readA.isCurrent(),false);assert.equal(readB.isCurrent(),true);assert.equal(readB.revision,coordinator.getReadRevision());assert.deepEqual(revisions,[1,2]);
 coordinator.publishNative({capability:ios,status:off});assert.equal(readB.isCurrent(),false);assert.deepEqual(revisions,[1,2,3]);coordinator.invalidate();assert.deepEqual(revisions,[1,2,3,4]);unsubscribe();coordinator.begin();assert.deepEqual(revisions,[1,2,3,4]);
});

// A fresh native receipt is a historical configuration fact, never protection authority.
const observationNow = Date.parse('2026-10-16T12:00:00.000Z');
function safariObservation() { return { version:1, freshness:'fresh', reason:'none', enabled:{value:true,reason:'observed',checkedAt:'2026-10-16T12:00:00.000Z'}, receipt:{version:1,revision:1,packageVariant:'adult-recovery-internal-v1',bundleArtifactDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),generation:2,nativeEpoch:3,presentationEpoch:4,receivedAt:'2026-10-16T12:00:00.000Z',expiresAt:'2026-10-16T12:05:00.000Z',context:'profile-and-private-unqualified',facts:{bundleArtifactDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),staticRules:'expected-enabled',dynamicRules:'zero',sessionRules:'zero',grants:'complete',requiredScopeCount:20,coveredScopeCount:20,diagnostic:'none'}} }; }
test('Safari presentation requires actual consistent fresh facts and keeps enabled/package separate',()=>{
 const select=(operations as any).getSafariConfigurationPresentation; assert.equal(typeof select,'function');
 const positive=safariObservation(),checked=select(positive,{current:true,now:observationNow});
 assert.equal(checked.configuration,'checked'); assert.equal(checked.action,'none'); assert.equal(checked.checkedAt,positive.receipt.receivedAt); assert.equal(checked.enabled,true);
 for(const enabled of [null,false]) {const input=safariObservation(); Object.assign(input.enabled,{value:enabled,reason:enabled===null?'unsupported-os':'observed',checkedAt:enabled===null?null:input.receipt.receivedAt}); if(enabled===false)Object.assign(input,{freshness:'historical',reason:'native-disabled'});const r=select(input,{current:true,now:observationNow}); assert.equal(r.configuration,enabled===null?'checked':'not-confirmed');assert.equal(r.enabled,enabled);assert.equal(r.action,enabled===false?'settings':'none');}
 for(const variant of ['short-form-v1','safe-recovery-probe-v1']){const input=safariObservation();input.receipt.packageVariant=variant;if(variant==='short-form-v1')input.receipt.facts.staticRules='not-configured';const r=select(input,{current:true,now:observationNow});assert.equal(r.message,'buildUnsupported');assert.equal(r.action,'none');assert.equal(r.packageVariant,variant);}
});
test('Safari missing, malformed, stale, expired and unknown facts never become configuration checked',()=>{
 const select=(operations as any).getSafariConfigurationPresentation; assert.equal(typeof select,'function');
 const cases:any[]=[undefined,{}, {...safariObservation(),extra:'private'}, {...safariObservation(),freshness:'historical',reason:'reset'}, {...safariObservation(),freshness:'historical',reason:'expired'}];
 for(const field of ['dynamicRules','sessionRules','staticRules','grants','diagnostic']) {const input=safariObservation();(input.receipt.facts as any)[field]=field==='grants'?'unknown':field==='diagnostic'?'api-error':field==='staticRules'?'unexpected':'nonzero';if(field==='grants')(input.receipt.facts as any).coveredScopeCount=null;cases.push(input);}
 for(const input of cases)assert.equal(select(input,{current:true,now:observationNow}).configuration,'not-confirmed');
 assert.equal(select(safariObservation(),{current:false,now:observationNow}).configuration,'not-confirmed');
 assert.equal(select(safariObservation(),{current:true,now:observationNow+300000}).configuration,'not-confirmed');
 assert.equal(select(safariObservation(),{current:true,now:observationNow-1}).configuration,'not-confirmed');
 for(const grants of ['partial','missing']){const input=safariObservation();input.receipt.facts.grants=grants;input.receipt.facts.coveredScopeCount=grants==='partial'?1:0;assert.equal(select(input,{current:true,now:observationNow}).action,'settings');}
});
