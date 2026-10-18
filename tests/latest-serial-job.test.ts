import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createLatestSerialJob} from '../src/lib/latest-serial-job';
const deferred=()=>{let resolve!:()=>void;return{promise:new Promise<void>(done=>resolve=done),resolve:()=>resolve()}};
test('a newer rule pair skips old schedules after an in-flight manual write',async()=>{
 const gate=deferred(),events:string[]=[];
 const queue=createLatestSerialJob<number,number>(async(input,current)=>{events.push(`manual${input}`);if(input===1)await gate.promise;if(!current())return null;events.push(`schedule${input}`);return input});
 const old=queue.submit(1);await Promise.resolve();const latest=queue.submit(2);gate.resolve();
 assert.equal(await old.result,null);assert.equal(await latest.result,2);assert.deepEqual(events,['manual1','manual2','schedule2']);
});
test('queued stale work never begins and deletion can drain current work before clearing',async()=>{
 const gate=deferred(),entered=deferred(),events:string[]=[];const queue=createLatestSerialJob<number,number>(async(input,current)=>{events.push(`manual${input}`);entered.resolve();await gate.promise;if(current())events.push(`schedule${input}`);return current()?input:null});
 const first=queue.submit(1);const second=queue.submit(2);await entered.promise;queue.invalidate();gate.resolve();await queue.whenIdle();events.push('clear');
 assert.equal(await first.result,null);assert.equal(await second.result,null);assert.deepEqual(events,['manual2','clear']);
});
