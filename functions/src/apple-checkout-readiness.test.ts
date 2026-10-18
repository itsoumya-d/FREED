import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getFirestore} from 'firebase-admin/firestore';
import * as endpoints from './purchase-firebase.js';

test('Apple checkout validates Apple credentials independently without granting Android readiness',async()=>{
 const endpoint=(endpoints as any).getApplePurchaseCheckoutContext;
 assert.equal(typeof endpoint,'function');
 const db=getFirestore(),oldCollection=db.collection,oldTransaction=db.runTransaction;
 const names=['APPLE_STORE_ISSUER_ID','APPLE_STORE_KEY_ID','APPLE_STORE_PRIVATE_KEY','APPLE_STORE_APP_ID','APPLE_STORE_ROOT_CAS_BASE64','GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'];
 const previous=names.map(name=>process.env[name]);
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'pem',type:'pkcs8'}).toString();
 const values=['dc3488ba-d22b-4c80-bd5c-bc07163431ef','KEYID12345',key,'1234567890',JSON.stringify([readFileSync('src/test-fixtures/apple-root-ca-g3.cer').toString('base64')])];
 db.collection=(()=>({doc:()=>({get:async()=>({exists:false})})})) as any;
 db.runTransaction=(async (run:any)=>run({get:async()=>({exists:false}),set:()=>{}} as any)) as any;
 const request={data:undefined,auth:{uid:'connectedOwner',token:{firebase:{sign_in_provider:'password'}}}};
 try {
  names.slice(0,5).forEach((name,index)=>{process.env[name]=values[index];});delete process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const result=await endpoint.run(request);assert.match(result.appAccountToken,/^[0-9a-f-]{36}$/);
  assert.deepEqual(Object.keys(result).sort(),['appAccountToken','obfuscatedAccountId']);
  assert.equal(endpoint.__endpoint.secretEnvironmentVariables.some((entry:{key:string})=>entry.key==='GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),false);
  process.env.APPLE_STORE_PRIVATE_KEY='invalid';await assert.rejects(()=>endpoint.run(request),(error:any)=>error.code==='unavailable');
 } finally {
  db.collection=oldCollection;db.runTransaction=oldTransaction;
  names.forEach((name,index)=>{if(previous[index]===undefined)delete process.env[name];else process.env[name]=previous[index];});
 }
});
test('Apple checkout cannot accept caller identity or an anonymous new checkout',async()=>{
 const endpoint=(endpoints as any).getApplePurchaseCheckoutContext;
 assert.equal(typeof endpoint,'function');
 await assert.rejects(()=>endpoint.run({data:{uid:'other'},auth:{uid:'connectedOwner',token:{firebase:{sign_in_provider:'password'}}}}),(error:any)=>error.code==='invalid-argument');
 await assert.rejects(()=>endpoint.run({data:undefined,auth:{uid:'guest',token:{firebase:{sign_in_provider:'anonymous'}}}}),(error:any)=>error.code==='failed-precondition');
});

test('Apple verification rejects missing identity, guest providers, Android and replay before contacting a store',async()=>{
 const endpoint=(endpoints as any).verifyAppleStorePurchase;
 const auth={uid:'connectedOwner',token:{firebase:{sign_in_provider:'apple.com'}}};
 assert.equal(endpoint.__endpoint.secretEnvironmentVariables.length,5);
 assert.equal(endpoint.__endpoint.secretEnvironmentVariables.some((entry:{key:string})=>entry.key==='GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),false);
 await assert.rejects(()=>endpoint.run({data:{platform:'ios'}}),(error:any)=>error.code==='unauthenticated');
 await assert.rejects(()=>endpoint.run({auth:{uid:'guest',token:{firebase:{sign_in_provider:'anonymous'}}},data:{platform:'ios'}}),(error:any)=>error.code==='failed-precondition');
 await assert.rejects(()=>endpoint.run({auth,data:{platform:'android'}}),(error:any)=>error.code==='invalid-argument');
 const previous=process.env.FUNCTIONS_EMULATOR;delete process.env.FUNCTIONS_EMULATOR;
 try {await assert.rejects(()=>endpoint.run({auth,app:{alreadyConsumed:true},data:{platform:'ios'}}),(error:any)=>error.code==='permission-denied');}
 finally {if(previous===undefined)delete process.env.FUNCTIONS_EMULATOR;else process.env.FUNCTIONS_EMULATOR=previous;}
});
