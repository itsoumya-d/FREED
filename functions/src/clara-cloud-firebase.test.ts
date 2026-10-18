import assert from 'node:assert/strict';
import test from 'node:test';
import {generateGoogleClaraReply} from './clara-cloud-firebase.js';
test('cloud endpoint rejects missing/anonymous/custom identity and consumed App Check before reading messages',async()=>{
 const endpoint=generateGoogleClaraReply as any;
 assert.equal(endpoint.__endpoint.serviceAccountEmail,'freed-clara-runtime@freed-7d5ee.iam.gserviceaccount.com');
 assert.equal(endpoint.__endpoint.maxInstances,3);assert.equal(endpoint.__endpoint.timeoutSeconds,30);assert.deepEqual(endpoint.__endpoint.secretEnvironmentVariables,undefined);
 await assert.rejects(()=>endpoint.run({data:{}}),(e:any)=>e.code==='unauthenticated');
 for(const provider of ['anonymous','custom',undefined])await assert.rejects(()=>endpoint.run({auth:{uid:'owner',token:{firebase:{sign_in_provider:provider}}},data:{}}),(e:any)=>e.code==='failed-precondition');
 await assert.rejects(()=>endpoint.run({auth:{uid:'owner',token:{firebase:{sign_in_provider:'google.com'}}},app:{alreadyConsumed:true},data:{}}),(e:any)=>e.code==='permission-denied');
});
