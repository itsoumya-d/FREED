import assert from 'node:assert/strict';
import {test} from 'node:test';
import {afterConfirmedCleanup} from '../src/lib/confirmed-cleanup';
test('rejected or unacknowledged native cleanup never erases recovery records',async()=>{
 for(const clear of [async()=>false,async()=>{throw Error('native unavailable')}]){let erased=false;await assert.rejects(afterConfirmedCleanup(clear,async()=>{erased=true}));assert.equal(erased,false)}
});
test('confirmed native cleanup precedes local erasure and local failure remains a failure',async()=>{
 const steps:string[]=[];assert.equal(await afterConfirmedCleanup(async()=>{steps.push('native');return true},async()=>{steps.push('records');return'saved'}),'saved');assert.deepEqual(steps,['native','records']);await assert.rejects(afterConfirmedCleanup(async()=>true,async()=>{throw Error('localdisk')}),/localdisk/);
});
