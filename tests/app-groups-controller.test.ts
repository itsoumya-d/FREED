import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as controllerModule from '../src/lib/app-groups-controller';
import type { AppGroupsSnapshot } from '../src/lib/app-groups-contract';
const snapshot:AppGroupsSnapshot={version:1,supported:true,platform:'ios',revision:1,configurationGeneration:2,scopeEpoch:1,groups:[],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const confirmedBinding={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:2,scopeEpoch:1,errorCode:null,errorDomain:null};
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};};
test('group controller keeps native rejection and serializes edits from separate groups',async()=>{
 const create=(controllerModule as any).createAppGroupsController;assert.equal(typeof create,'function');
 let scope='["owner",1]';const calls:string[]=[];const first=deferred<any>();
 const c=create({getScope:()=>scope,bind:async()=>confirmedBinding,suspend:async()=>true,read:async()=>snapshot,mutate:async(method:string,request:any)=>{calls.push(request.id);return request.id==='a'?first.promise:{accepted:true,reason:null,snapshot:{...snapshot,revision:3}};}});
 await c.refresh();const a=c.mutate('update',{id:'a'}),b=c.mutate('update',{id:'b'});
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(calls,['a']);first.resolve({accepted:false,reason:'monitor-capacity',snapshot:{...snapshot,revision:2}});await a;await b;
 assert.deepEqual(calls,['a','b']);assert.equal(c.getSnapshot().status.revision,3);
});
test('old-owner native read and mutation are cancelled without cross-owner publication',async()=>{
 const create=(controllerModule as any).createAppGroupsController;assert.equal(typeof create,'function');
 let scope:string|null='["A",1]';const old=deferred<AppGroupsSnapshot>(),started=deferred<void>();let reads=0;
 const c=create({getScope:()=>scope,bind:async()=>confirmedBinding,suspend:async()=>true,read:async()=>{if(++reads===1){started.resolve();return old.promise;}return {...snapshot,revision:4};},mutate:async()=>({accepted:false,reason:'stale',snapshot})});
 const pending=c.refresh();await started.promise;scope='["B",2]';await c.refresh();old.resolve({...snapshot,revision:2});await pending;
 assert.equal(c.getSnapshot().status.revision,4);scope=null;await c.refresh();assert.equal(c.getSnapshot().status.groups.length,0);assert.equal(c.getSnapshot().waitingForOwner,true);
});
test('a queued ordinary refresh cannot erase the current native mutation rejection',async()=>{
 const create=(controllerModule as any).createAppGroupsController;const write=deferred<any>(),started=deferred<void>();
 const c=create({getScope:()=> '["owner",1]',bind:async()=>confirmedBinding,suspend:async()=>true,read:async()=>snapshot,mutate:async()=>{started.resolve();return write.promise;}});
 await c.refresh();const mutation=c.mutate('update',{expectedStoreRevision:1,id:'a'});await started.promise;const returned=c.refresh();write.resolve({accepted:false,reason:'monitor-capacity',snapshot});await mutation;await returned;
 assert.equal(c.getSnapshot().error,'monitor-capacity');c.acknowledge();assert.equal(c.getSnapshot().error,null);
});
test('an old-owner mutation receipt cannot publish after a new owner native read',async()=>{
 const create=(controllerModule as any).createAppGroupsController;let scope='["A",1]';const write=deferred<any>(),started=deferred<void>();
 const c=create({getScope:()=>scope,bind:async()=>confirmedBinding,suspend:async()=>true,read:async()=>scope.includes('B')?{...snapshot,revision:8}:snapshot,mutate:async()=>{started.resolve();return write.promise;}});
 await c.refresh();const mutation=c.mutate('update',{id:'a'});await started.promise;scope='["B",2]';const current=c.refresh();write.resolve({accepted:false,reason:'old failure',snapshot:{...snapshot,revision:3}});assert.equal(await mutation,null);await current;assert.equal(c.getSnapshot().status.revision,8);assert.equal(c.getSnapshot().error,null);
});

test('real controller requests one central admission repair and never rebinds a stale opaque scope',async()=>{
 let scope='opaque-A',repairs=0,binds=0;const c=controllerModule.createAppGroupsController({getScope:()=>scope,bind:async()=>{binds++;return confirmedBinding;},suspend:async()=>true,read:async s=>s==='opaque-A'?{...snapshot,supported:false,reason:'owner-scope-unbound-or-stale'}:snapshot,repair:async()=>{repairs++;scope='opaque-fresh-A';c.invalidate();},mutate:async()=>({accepted:true,reason:null,snapshot})});
 assert.equal(await c.refresh(),null);assert.equal(repairs,1);assert.equal(binds,1);assert.equal(c.getSnapshot().waitingForOwner,true);assert.deepEqual(await c.refresh(),snapshot);assert.equal(repairs,1);assert.equal(binds,2);
});
