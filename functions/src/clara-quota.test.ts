import assert from 'node:assert/strict';
import test from 'node:test';
import {reserveClaraRequest,hasClaraReviewAccess} from './clara-quota.js';
import {Timestamp} from 'firebase-admin/firestore';
import type {TransactionalStore} from './transactional.js';
const NOW=Date.parse('2026-10-05T12:00:00Z');
function harness(){const docs=new Map<string,object>();let tail=Promise.resolve();return{docs,run(uid:string,id:string){let result:any;const operation=tail.then(async()=>{
 const writes=new Map<string,object>();const store:TransactionalStore={get:async<T extends object>(path:string)=>{assert.equal(writes.size,0,'All Firestore reads precede writes');return{value:docs.get(path) as T|undefined};},set:async(path,value)=>{writes.set(path,value);}};
 result=await reserveClaraRequest(store,{uid,eventId:id,now:NOW,readClaims:async()=>[]});for(const [path,value] of writes)docs.set(path,value);
 });tail=operation;return operation.then(()=>result);}};}
test('concurrent quota and budget reservations are atomic, duplicate and deleted calls spend no money',async()=>{
 const h=harness();const results=await Promise.all(Array.from({length:8},(_,i)=>h.run('owner',`clara_${i}`)));
 assert.equal(results.filter(x=>x.status==='allowed').length,3);assert.equal((h.docs.get('ai_budget_controls/clara-internal-v1') as any).reservedCents,6);
 assert.equal((await h.run('owner','clara_0')).status,'duplicate');assert.equal((h.docs.get('ai_budget_controls/clara-internal-v1') as any).reservedCents,6);
 h.docs.set('deletion_tombstones/deleting',{status:'deleting'});assert.equal((await h.run('deleting','clara_new')).status,'account-deleting');assert.equal((h.docs.get('ai_budget_controls/clara-internal-v1') as any).reservedCents,6);
});
test('budget cutoff prevents quota/idempotency writes and further calls across users',async()=>{
 const h=harness();h.docs.set('ai_budget_controls/clara-internal-v1',{month:'2026-10',reservedCents:2498,version:1});
 const results=await Promise.all([h.run('a','clara_a'),h.run('b','clara_b')]);assert.deepEqual(results.map(x=>x.status),['allowed','budget-exhausted']);
 assert.equal(h.docs.has('rate_limits/b_ai-clara-daily'),false);assert.equal((h.docs.get('ai_budget_controls/clara-internal-v1') as any).reservedCents,2500);
});
test('review allowance accepts genuine timestamp markers and rejects forged/expired/revoked owners',async()=>{
 const valid={uid:'reviewer',kind:'review-access-v1',status:'active',createdAt:Timestamp.fromMillis(NOW-1000),expiresAt:Timestamp.fromMillis(NOW+86400000)};
 assert.equal(hasClaraReviewAccess(valid,'reviewer',NOW),true);
 for(const marker of [{...valid,createdAt:NOW-1000,expiresAt:NOW+86400000},{...valid,uid:'other'},{...valid,status:'revoked'},{...valid,expiresAt:Timestamp.fromMillis(NOW)},{...valid,expiresAt:Timestamp.fromMillis(NOW+15*86400000)},{...valid,createdAt:Timestamp.fromMillis(NOW+1)}])assert.equal(hasClaraReviewAccess(marker,'reviewer',NOW),false);
 const documents=new Map<string,object>();const store:TransactionalStore={get:async<T extends object>(path:string)=>({value:documents.get(path) as T|undefined}),set:async(path,value)=>{documents.set(path,value);}};
 for(let index=0;index<21;index++){const now=NOW+(index===20?60000:0);const result=await reserveClaraRequest(store,{uid:'reviewer',eventId:`review_${index}`,now,reviewAccess:hasClaraReviewAccess(valid,'reviewer',now),readClaims:async()=>[]});assert.equal(result.limit,20);assert.equal(result.status,index<20?'allowed':'daily-quota-exhausted');}
});
