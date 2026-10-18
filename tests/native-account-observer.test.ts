import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAuthSnapshotObserver,INITIAL_JOURNEY_AUTH} from '../src/lib/user-journey';
test('actual Auth observer retires admission before ready, retry hydration and final unsubscribe publication',()=>{
 const calls:string[]=[];let deliver:any;
 const o=createAuthSnapshotObserver(fn=>{deliver=fn;return()=>calls.push('stop');},8000,(next:any)=>calls.push('retire:'+next.status));
 const off=o.subscribe(()=>calls.push('publish:'+o.getSnapshot().status));
 assert.deepEqual(calls.slice(0,2),['retire:hydrating','publish:hydrating']);
 deliver({...INITIAL_JOURNEY_AUTH,status:'ready',signedIn:true,ownerUid:'A'});
 assert.deepEqual(calls.slice(-2),['retire:ready','publish:ready']);o.retry();off();assert.equal(calls.at(-1),'retire:hydrating');
});
