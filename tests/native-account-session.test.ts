import assert from 'node:assert/strict';
import { test } from 'node:test';
import {actualAdapter} from './helpers/native-account-adapter-fixture';
test('actual adapter refuses raw owner binds: missing v2 cannot invoke legacy authority',async()=>{
 const f=actualAdapter();delete f.native.FreedAccountBindingSession;
 const r=await f.api.setAppGroupActionScope('["A",1]');assert.equal(r.accepted,false);assert.deepEqual(f.events,[]);
});

import {createNativeAccountSessionCoordinator} from '../src/lib/native-account-session';
import {INITIAL_JOURNEY_AUTH} from '../src/lib/user-journey';
const ready=(ownerUid:string)=>({...INITIAL_JOURNEY_AUTH,status:'ready' as const,signedIn:true,ownerUid});
const deferred=<T>()=>{let resolve!:(v:T)=>void;let reject!:(e:Error)=>void;return{promise:new Promise<T>((r,j)=>{resolve=r;reject=j;}),resolve,reject};};
function coordinatorFixture(){
 const f=actualAdapter('android');let auth=ready('A'),sdk:string|null='A';
 const c=createNativeAccountSessionCoordinator({create:f.api.createNativeAccountSession,sdkOwner:()=>sdk,observed:()=>auth,uuid:()=> '33333333-3333-4333-8333-333333333333',timeoutMs:30});
 return {...f,c,set:(next:any,uid:string|null)=>{auth=next;sdk=uid;},getAuth:()=>auth};
}
test('one native-created session and validated acknowledgement transport all reads without raw rebind; SDK change immediately denies',async()=>{
 const f=coordinatorFixture();const a=await f.c.observe(f.getAuth());assert.ok(a);assert.notEqual(a.actionScope,JSON.stringify(['A',1]));
 await f.api.setAppGroupActionScope(a.actionScope);await f.api.setAppGroupActionScope(a.actionScope);assert.equal(f.events.filter(e=>e==='commit').length,1);assert.equal(f.events.includes('RAW-BIND'),false);
 f.set(ready('B'),'B');assert.equal((await f.api.setAppGroupActionScope(a.actionScope)).accepted,false);assert.equal(f.c.getAdmission(),null);assert.ok(f.events.includes('release:1'));
});
test('unknown to same UID retires queued prepare before late callback can commit or publish',async()=>{
 const f=coordinatorFixture(),wait=deferred<any>();f.native.prepareAccountBindingV2=()=>wait.promise;
 const old=f.c.observe(f.getAuth());await Promise.resolve();f.set(INITIAL_JOURNEY_AUTH,'A');await f.c.observe(INITIAL_JOURNEY_AUTH);f.set(ready('A'),'A');
 wait.resolve({ticket:'11111111-1111-4111-8111-111111111111',admissionRevision:0});assert.equal(await old,null);assert.equal(f.events.includes('commit'),false);assert.equal(f.c.getAdmission(),null);
});
test('lost commit reply retries exactly original ticket; malformed/unavailable v2 receipts do not fall back',async()=>{
 const f=coordinatorFixture();let calls=0;const commit=f.native.commitAccountBindingV2;f.native.commitAccountBindingV2=(session:any,ticket:string)=>{if(++calls===1)throw Error('reply lost');return commit(session,ticket);};
 assert.ok(await f.c.observe(f.getAuth()));assert.equal(calls,2);f.c.invalidate();f.native.commitAccountBindingV2=()=>({accepted:true});assert.equal(await f.c.retry(),null);assert.equal(f.events.includes('RAW-BIND'),false);
});
test('retiring runtime denies old scoped pending and exact clear; unsupported native stays unavailable with update reason',async()=>{
 const f=coordinatorFixture();const a=await f.c.observe(f.getAuth());assert.ok(a);f.c.invalidate('runtime-retired');await f.api.getPendingIntervention(a.actionScope);assert.equal(await f.api.clearPendingIntervention('44444444-4444-4444-8444-444444444444',a.actionScope),false);assert.equal(f.events.some(e=>e.startsWith('pending:')||e==='clear'),false);
 delete f.native.FreedAccountBindingSession;assert.equal(await f.c.retry(),null);assert.equal(f.c.getSnapshot().reason,'native-account-update-required');
});
test('bounded native preparation cannot leave account admission loading forever',async()=>{
 const f=coordinatorFixture();f.native.prepareAccountBindingV2=()=>new Promise(()=>{});assert.equal(await f.c.observe(f.getAuth()),null);assert.equal(f.c.getSnapshot().status,'unavailable');assert.ok(f.events.includes('release:1'));
});

test('fresh same-owner admission after unknown uses a new opaque scope and cannot revive old queue tickets',async()=>{
 const f=coordinatorFixture(),a=await f.c.observe(f.getAuth());assert.ok(a);f.set(INITIAL_JOURNEY_AUTH,'A');await f.c.observe(INITIAL_JOURNEY_AUTH);f.set(ready('A'),'A');const b=await f.c.observe(f.getAuth());assert.ok(b);assert.notEqual(b.actionScope,a.actionScope);assert.equal(f.c.isCurrent(a),false);assert.equal((await f.api.setAppGroupActionScope(a.actionScope)).accepted,false);assert.equal((await f.api.setAppGroupActionScope(b.actionScope)).accepted,true);
});
test('late actual adapter private read is redacted after SDK identity changes',async()=>{
 const f=coordinatorFixture(),a=await f.c.observe(f.getAuth());assert.ok(a);const wait=deferred<any>();f.native.getAppGroups=()=>wait.promise;const read=f.api.getAppGroups(a.actionScope);f.set(ready('B'),'B');wait.resolve({private:'A'});const result=await read;assert.equal(result.supported,false);assert.equal(JSON.stringify(result).includes('private'),false);
});
test('retirement dispatches cancellation only for the captured native-issued handle and never certifies OS dismissal',async()=>{
 const f=coordinatorFixture();const a=await f.c.observe(f.getAuth());assert.ok(a);const calls:any[]=[];f.native.cancelAccountSessionResources=async(handle:string,evidence:string)=>{calls.push([handle,evidence]);return {version:2,bindingHandle:handle,state:'pending',osDismissalConfirmed:false};};f.c.invalidate();await Promise.resolve();assert.deepEqual(calls,[[a.bindingHandle,'']]);assert.deepEqual(await f.api.cancelNativeAccountResources(a.actionScope,'evidence-A'),{state:'pending',osDismissalConfirmed:false});assert.deepEqual(calls[1],[a.bindingHandle,'evidence-A']);assert.equal((await f.api.cancelNativeAccountResources('["B",9]')).state,'unavailable');
});

test('cleanup-only v2 admission after account-entry retirement stays private to cleanup closure and always retires',async()=>{
 const f=coordinatorFixture();const ordinary=await f.c.observe(f.getAuth());assert.ok(ordinary);f.c.invalidate('account-entry');let work=0;
 const result=await f.c.withCleanupAdmission('A',()=>true,async(admission,current)=>{work++;assert.equal(f.c.getAdmission(),null);assert.notEqual(admission.actionScope,ordinary.actionScope);assert.equal(current(),true);return 'persisted-id';});
 assert.equal(result,'persisted-id');assert.equal(work,1);assert.equal(f.c.getAdmission(),null);assert.ok(f.events.includes('release:2'));assert.equal(f.events.includes('RAW-BIND'),false);
});
test('cleanup-only queued A prepare after B or unknown never commits, publishes, or invokes cleanup work',async()=>{
 for(const unknown of [false,true]){const f=coordinatorFixture(),wait=deferred<any>();f.native.prepareAccountBindingV2=()=>wait.promise;let work=0;const pending=f.c.withCleanupAdmission('A',()=>true,async()=>{work++;return 'id';});await Promise.resolve();f.set(unknown?INITIAL_JOURNEY_AUTH:ready('B'),unknown?'A':'B');void f.c.observe(unknown?INITIAL_JOURNEY_AUTH:ready('B'));f.c.invalidate('test-cleanup');wait.resolve({ticket:'11111111-1111-4111-8111-111111111111',admissionRevision:0});assert.equal(await pending,null);assert.equal(work,0);assert.equal(f.events.includes('commit'),false);assert.ok(f.events.includes('release:1'));}
});

test('cleanup-only commit reply after an unknown transition cannot publish or enter durable preparation',async()=>{
 const f=coordinatorFixture(),wait=deferred<any>();f.native.commitAccountBindingV2=()=>wait.promise;let stored=0;const work=f.c.withCleanupAdmission('A',()=>true,async()=>{stored++;return 'id';});await new Promise(r=>setImmediate(r));f.set(INITIAL_JOURNEY_AUTH,'A');await f.c.observe(INITIAL_JOURNEY_AUTH);wait.resolve({version:2,accepted:true,bindingHandle:'22222222-2222-4222-8222-222222222222',actionScope:'["A",1,"22222222-2222-4222-8222-222222222222"]',generation:7,scopeEpoch:3,admissionRevision:0});assert.equal(await work,null);assert.equal(stored,0);assert.equal(f.c.getAdmission(),null);assert.ok(f.events.includes('release:1'));
});

test('actual cleanup-only adapter never publishes its scope to generic private wrappers while captured cleanup preparation works',async()=>{
 const f=coordinatorFixture();let preparations=0,observed:any;f.native.prepareAccountProtectionCleanup=()=>{preparations++;return{version:2,accepted:true,operationId:'77777777-7777-4777-8777-777777777777',phase:'prepared',privateCleanupAccepted:false,runtimeScrubComplete:false,adultPolicyRetained:true,coreState:'pending',processState:'pending'};};
 const id=await f.c.withCleanupAdmission('A',()=>true,async(a,current,prepare)=>{observed={current:current(),published:f.c.getAdmission(),genericCurrent:f.api.isNativeAccountActionScopeCurrent(a.actionScope),ack:(await f.api.setAppGroupActionScope(a.actionScope)).accepted,read:(await f.api.getAppGroups(a.actionScope)).supported,publicCleanup:await f.api.prepareNativeAccountCleanup(a.actionScope,a.bindingHandle)};return(await prepare(a.actionScope,a.bindingHandle))?.operationId;});
 assert.equal(observed.genericCurrent,false);assert.equal(observed.current,true);assert.equal(observed.published,null);assert.equal(observed.ack,false);assert.equal(observed.read,false);assert.equal(observed.publicCleanup,null);assert.equal(f.events.includes('read'),false);assert.equal(id,'77777777-7777-4777-8777-777777777777');assert.equal(preparations,1);assert.equal(f.c.getAdmission(),null);assert.ok(f.events.includes('release:1'));
});
