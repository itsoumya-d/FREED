import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAppGroupsController } from '../src/lib/app-groups-controller';
import * as discard from '../src/lib/app-group-selection-discard';
import type { AppGroup, AppGroupsSnapshot } from '../src/lib/app-groups-contract';

const group:AppGroup={id:'focus',revision:4,name:'Focus',enabled:true,rule:{kind:'before-use'},packages:[],applicationCount:1,draftApplicationCount:null,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:true,active:true,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:{interventionId:'break',expiresAt:'2026-10-08T12:00:00Z',effective:true,remainingRestrictionCount:0}};
const snapshot:AppGroupsSnapshot={version:1,supported:true,platform:'ios',revision:9,configurationGeneration:2,scopeEpoch:1,groups:[group],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:1,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const request={version:1 as const,id:'focus',expectedRevision:4,expectedStoreRevision:8};
const receipt={accepted:true,reason:null,operation:'discard-pending-selection',targetId:'focus',pendingSelectionDiscarded:true,snapshot};
const binding={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:2,scopeEpoch:1,errorCode:null,errorDomain:null};
test('discard receipt confirms only the requested native draft and preserves committed revision',()=>{
 const validate=(discard as any).validateAppGroupSelectionDiscardReceipt;
 assert.equal(typeof validate,'function');
 assert.deepEqual(validate(receipt,request),receipt);
 for(const invalid of [
  {...receipt,operation:'update'}, {...receipt,targetId:'other'}, {...receipt,pendingSelectionDiscarded:false},
  {...receipt,snapshot:{...snapshot,revision:10}}, {...receipt,snapshot:{...snapshot,groups:[{...group,revision:5}]}},
  {...receipt,snapshot:{...snapshot,groups:[{...group,draftApplicationCount:0}]}}, {...receipt,snapshot:{...snapshot,groups:[]}},
 ]) assert.equal(validate(invalid,request),null);
});
test('Android JS-only discard confirms with exact unchanged native revision and native monitor budget',()=>{
 const validate=(discard as any).validateAppGroupSelectionDiscardReceipt;
 assert.equal(typeof validate,'function');
 const android={...receipt,snapshot:{...snapshot,platform:'android',revision:8,monitorBudget:{used:1,limit:6},groups:[{...group,packages:['org.reader'],draftApplicationCount:undefined}]}};
 assert.deepEqual(validate(android,request),android);
 assert.equal(validate({...android,snapshot:{...android.snapshot,revision:9}},request),null);
});
test('discard request retains its captured store fence after queued native picker completes',async()=>{
 let release!:(value:any)=>void;const picker=new Promise<any>(resolve=>{release=resolve;});const calls:any[]=[];
 const c=createAppGroupsController({getScope:()=> '["owner",1]',bind:async()=>binding,suspend:async()=>true,read:async()=>({...snapshot,revision:8}),mutate:async(method,req)=>{calls.push({method,request:req});return method==='picker'?picker:{...receipt,accepted:false,pendingSelectionDiscarded:false,reason:'group-revision-stale'};}});
 await c.refresh();const first=c.mutate('picker',request);const pending=c.mutate('discard' as any,request);
 await new Promise(resolve=>setTimeout(resolve,0));
 release({...receipt,snapshot:{...snapshot,groups:[{...group,draftApplicationCount:2}]}});await first;
 assert.equal((await pending)?.accepted,false);
 assert.equal(calls[1].method,'discard');assert.equal(calls[1].request.expectedStoreRevision,8);
 assert.equal(c.getSnapshot().error,'group-revision-stale');
});
