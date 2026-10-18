import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAppGroupsController } from '../src/lib/app-groups-controller';
import type { AppGroupsSnapshot } from '../src/lib/app-groups-contract';

const snapshot: AppGroupsSnapshot = {version:1,supported:true,platform:'ios',revision:1,configurationGeneration:2,scopeEpoch:1,groups:[],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const receipt = (update: Record<string,unknown> = {}) => ({version:1,supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:2,scopeEpoch:1,errorCode:null,errorDomain:null,operationId:'11111111-1111-4111-8111-111111111111',...update});
const deferred = <T>() => {let resolve!: (value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
function harness(bind:()=>Promise<unknown>) {
 let reads=0,writes=0;
 const controller=createAppGroupsController({getScope:()=> '["owner",1]',bind:bind as any,suspend:async()=>true,read:async()=>{reads++;return snapshot;},mutate:async()=>{writes++;return {accepted:true,reason:null,snapshot};}});
 return {controller,counts:()=>({reads,writes})};
}
test('rejected native binding ends waiting and publishes its storage failure without reading private groups',async()=>{
 const h=harness(async()=>receipt({accepted:false,bindingCurrent:false,ownerVerified:false,stage:'state-commit',reason:'group-persistence-failed'}));
 assert.equal(await h.controller.refresh(),null);
 assert.equal(h.controller.getSnapshot().waitingForOwner,false);
 assert.equal(h.controller.getSnapshot().error,'group-persistence-failed');
 assert.deepEqual(h.counts(),{reads:0,writes:0});
});
test('truthy malformed or old Boolean binding cannot permit native reads or writes',async()=>{
 for(const value of [true,receipt({bindingCurrent:false}),receipt({ownerVerified:false}),receipt({generation:null}),receipt({stage:'state-commit'}),{}]) {
  const h=harness(async()=>value);
  await h.controller.refresh();await h.controller.mutate('create',{version:1,expectedStoreRevision:0,name:'Focus'});
  assert.deepEqual(h.counts(),{reads:0,writes:0});
  assert.equal(h.controller.getSnapshot().waitingForOwner,false);
  assert.equal(h.controller.getSnapshot().pending,false);
  assert.ok(h.controller.getSnapshot().error);
 }
});
test('confirmed current binding permits real snapshot read',async()=>{
 const h=harness(async()=>receipt());
 assert.equal(await h.controller.refresh(),snapshot);
 assert.deepEqual(h.counts(),{reads:1,writes:0});
 assert.equal(h.controller.getSnapshot().waitingForOwner,false);
});
test('late rejected binding cannot replace the new owner snapshot or error',async()=>{
 let scope='["A",1]',reads=0;const pending=deferred<unknown>();
 const controller=createAppGroupsController({getScope:()=>scope,bind:async(s:string)=>s.includes('A')?pending.promise:receipt() as any,suspend:async()=>true,read:async()=>{reads++;return snapshot;},mutate:async()=>({accepted:true,reason:null,snapshot})} as any);
 const old=controller.refresh();scope='["B",2]';await controller.refresh();
 pending.resolve(receipt({accepted:false,bindingCurrent:false,stage:'state-commit',reason:'old failure'}));await old;
 assert.equal(reads,1);assert.equal(controller.getSnapshot().status,snapshot);assert.equal(controller.getSnapshot().error,null);
});
test('same-scope native suspension invalidates cached binding and recovers once before publishing groups',async()=>{
 let nativeBound=false,binds=0;
 const hidden={...snapshot,reason:'sign-in-required'};
 const controller=createAppGroupsController({getScope:()=> '["owner",1]',bind:async()=>{binds++;nativeBound=true;return receipt();},suspend:async()=>true,read:async()=>nativeBound?snapshot:hidden,mutate:async()=>({accepted:true,reason:null,snapshot})});
 await controller.refresh();nativeBound=false;
 const seen:string[]=[];controller.subscribe(()=>{if(controller.getSnapshot().error)seen.push(controller.getSnapshot().error!);});
 assert.equal(await controller.refresh(),snapshot);
 assert.equal(binds,2);assert.ok(seen.includes('sign-in-required'));
 assert.equal(controller.getSnapshot().error,null);
});
test('failed same-scope recovery shows binding failure and never treats hidden groups as successful empty state',async()=>{
 let binds=0,reads=0;
 const controller=createAppGroupsController({getScope:()=> '["owner",1]',bind:async()=>++binds===1?receipt():receipt({accepted:false,bindingCurrent:false,ownerVerified:false,stage:'state-commit',reason:'enforcement-state-commit-failed'}),suspend:async()=>true,read:async()=>++reads===1?snapshot:{...snapshot,reason:'sign-in-required'},mutate:async()=>({accepted:true,reason:null,snapshot})});
 await controller.refresh();assert.equal(await controller.refresh(),null);
 assert.equal(controller.getSnapshot().error,'enforcement-state-commit-failed');
 assert.equal(controller.getSnapshot().status.supported,false);assert.equal(reads,2);
});
test('repeated hidden snapshot stops after one rebind and keeps a visible owner error',async()=>{
 let binds=0,reads=0;
 const controller=createAppGroupsController({getScope:()=> '["owner",1]',bind:async()=>{binds++;return receipt();},suspend:async()=>true,read:async()=>{reads++;return {...snapshot,reason:'sign-in-required'};},mutate:async()=>({accepted:true,reason:null,snapshot})});
 await controller.refresh();assert.equal(binds,2);assert.equal(reads,2);
 assert.equal(controller.getSnapshot().error,'sign-in-required');assert.equal(controller.getSnapshot().bindingReceipt,null);
});
test('late same-scope recovery is fenced when another owner takes over',async()=>{
 let scope='["A",1]',hidden=false,aBinds=0;const rebound=deferred<unknown>();
 const controller=createAppGroupsController({getScope:()=>scope,bind:async(s)=>{if(s.includes('A')&&++aBinds===2)return rebound.promise;return receipt();},suspend:async()=>true,read:async(s)=>s.includes('A')&&hidden?{...snapshot,reason:'owner-scope-unbound-or-stale'}:{...snapshot,revision:s.includes('B')?9:1},mutate:async()=>({accepted:true,reason:null,snapshot})});
 await controller.refresh();hidden=true;const old=controller.refresh();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(aBinds,2);
 scope='["B",2]';await controller.refresh();rebound.resolve(receipt());await old;
 assert.equal(controller.getSnapshot().status.revision,9);assert.equal(controller.getSnapshot().error,null);
});
test('supported snapshot with native reconciliation failure remains visibly failed',async()=>{
 const controller=createAppGroupsController({getScope:()=> '["owner",1]',bind:async()=>receipt(),suspend:async()=>true,read:async()=>({...snapshot,reason:'monitor-readback-failed'}),mutate:async()=>({accepted:true,reason:null,snapshot})});
 await controller.refresh();assert.equal(controller.getSnapshot().error,'monitor-readback-failed');
});
