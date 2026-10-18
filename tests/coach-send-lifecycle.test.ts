import assert from 'node:assert/strict';
import test from 'node:test';
import * as coach from '../src/lib/ai-coach';
const create=(coach as any).createCoachSendController;
function deferred<T>(){let resolve!:(v:T)=>void;let reject!:(e:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
test('rapid sends create one user message and one in-flight request before React can render busy state',async()=>{
 assert.equal(typeof create,'function');const pending=deferred<coach.CoachResponse>();const users:string[]=[],replies:string[]=[];let calls=0;
 const c=create({reply:()=>{calls++;return pending.promise;},onUser:(text:string)=>users.push(text),onReply:(r:coach.CoachResponse)=>replies.push(r.text),onPending:()=>{},onError:()=>{},isCurrent:()=>true});
 const first=c.send('My words');await c.send('Second tap');assert.deepEqual(users,['My words']);assert.equal(calls,1);
 pending.resolve({text:'A reply',provider:'remote',status:'ok'});await first;assert.deepEqual(replies,['A reply']);
});
test('retry after a failed service call never appends the same user message twice',async()=>{
 const users:string[]=[],replies:string[]=[];let calls=0;
 const c=create({reply:async()=>{if(++calls===1)throw Error('offline');return{text:'Reply',provider:'remote',status:'ok'};},onUser:(text:string)=>users.push(text),onReply:(r:coach.CoachResponse)=>replies.push(r.text),onPending:()=>{},onError:()=>{},isCurrent:()=>true});
 await c.send('Keep this message');await c.retry();assert.deepEqual(users,['Keep this message']);assert.deepEqual(replies,['Reply']);
});
test('a failed durable user-message save prevents transmission and retries that save first',async()=>{
 let save=0,calls=0;const errors:string[]=[];
 const c=create({reply:async()=>{calls++;return{text:'Reply',provider:'remote',status:'ok'};},onUser:()=>{if(++save===1)throw Error('disk');},onReply:()=>{},onPending:()=>{},onError:(code:string|null)=>{if(code)errors.push(code);},isCurrent:()=>true});
 await c.send('Private words');assert.equal(calls,0);assert.deepEqual(errors,['save-failed']);await c.retry();assert.equal(calls,1);assert.equal(save,2);
});
test('owner changes or unmounts suppress a late reply and its history write',async()=>{
 for(const dispose of [false,true]){
 const p=deferred<coach.CoachResponse>();let current=true, replies=0;
 const c=create({reply:()=>p.promise,onUser:()=>{},onReply:()=>{replies++;},onPending:()=>{},onError:()=>{},isCurrent:()=>current});
 const request=c.send('Words');if(dispose)c.dispose();else current=false;
 p.resolve({text:'Late',provider:'remote',status:'ok'});await request;assert.equal(replies,0);
 }
});
test('a failed reply save can be repaired without another network request',async()=>{
 let calls=0,saves=0;
 const c=create({reply:async()=>{calls++;return{text:'Known reply',provider:'remote',status:'ok'};},onUser:()=>{},onReply:()=>{if(++saves===1)throw Error('disk');},onPending:()=>{},onError:()=>{},isCurrent:()=>true});
 await c.send('Words');await c.retry();assert.equal(calls,1);assert.equal(saves,2);
});
test('cancel drops the old reply and never clears the pending state of a newer request',async()=>{
 const first=deferred<coach.CoachResponse>(),second=deferred<coach.CoachResponse>();let count=0;const replies:string[]=[],busy:boolean[]=[];
 const c=create({reply:()=>++count===1?first.promise:second.promise,onUser:()=>{},onReply:(reply:coach.CoachResponse)=>replies.push(reply.text),onPending:(value:boolean)=>busy.push(value),onError:()=>{},isCurrent:()=>true});
 const old=c.send('Old');assert.equal(typeof c.cancel,'function');c.cancel();const next=c.send('New');
 first.resolve({text:'Stale',provider:'remote',status:'ok'});await old;assert.deepEqual(replies,[]);assert.equal(busy.at(-1),true);
 second.resolve({text:'Current',provider:'remote',status:'ok'});await next;assert.deepEqual(replies,['Current']);assert.equal(busy.at(-1),false);
});
