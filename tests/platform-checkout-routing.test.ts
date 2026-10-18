import assert from 'node:assert/strict';
import test from 'node:test';
import {createFirebaseCallableContracts} from '../src/lib/firebase-client';
test('iOS readiness uses only the Apple endpoint while Android keeps its own verification requirement',async()=>{
 const calls:{name:string;data:unknown}[]=[];
 const contracts=createFirebaseCallableContracts({call:async(name:string,data:unknown)=>{calls.push({name,data});return{appAccountToken:'12345678-1234-5234-8234-123456789abc',obfuscatedAccountId:'1'.repeat(64)};}});
 await (contracts.getCheckoutContext as any)({platform:'ios'});await (contracts.getCheckoutContext as any)({platform:'android'});
 assert.deepEqual(calls,[{name:'getApplePurchaseCheckoutContext',data:undefined},{name:'getPurchaseCheckoutContext',data:undefined}]);
});
