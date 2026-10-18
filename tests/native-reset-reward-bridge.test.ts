import {withNativeAccountFixture,acknowledgeNativeFixture,fixtureActionScope} from './helpers/acknowledged-native-fixture';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const {buildSync}=createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
async function bridge(native:unknown){
 const code=buildSync({...(process.env.FREED_REWARD_BRIDGE_BEFORE ? {stdin:{contents:readFileSync(process.env.FREED_REWARD_BRIDGE_BEFORE,'utf8'),loader:'ts' as const,resolveDir:resolve('modules/freed-protection/src')}} : {entryPoints:['modules/freed-protection/src/index.ts']}),bundle:true,platform:'node',format:'cjs',write:false,external:['expo-modules-core','react-native']}).outputFiles[0].text;
 const sandbox={module:{exports:{} as any},setTimeout,clearTimeout,require:(name:string)=>name==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>withNativeAccountFixture(native)}};
 vm.runInNewContext(code,sandbox);return acknowledgeNativeFixture(sandbox.module.exports);
}
const request={version:1,policyVersion:1,category:'breathe',completionSessionId:'session-1',templateId:'gentle',templateVersion:1,nativeInterventionId:'a2b4053a-a9e0-4209-9bba-6a6e0fb270ba',kind:'ios-app-group',tokenType:'application',groupId:'focus',groupRevision:2,configurationGeneration:1,scopeEpoch:2};
const receipt={...request,version:1,policyVersion:1,supported:true,accepted:true,reason:null,seconds:120,expiresAt:'2026-10-08T10:02:00Z',effective:true,remainingRestrictionCount:0,replayed:false};
test('new method sends exact versioned request and owner scope; native deadline is retained',async()=>{
 const calls:unknown[][]=[];const api=await bridge({grantResetAppGroupBreak:async(...args:unknown[])=>{calls.push(args);return receipt;}});
 assert.equal(api.isResetAppGroupRewardMethodAvailable(),true);
 assert.equal(JSON.stringify(await api.grantResetAppGroupBreak(request,fixtureActionScope)),JSON.stringify(receipt));assert.deepEqual(calls,[[request,fixtureActionScope]]);
});
test('older binary, native error and malformed acceptance never invoke generic grant or synthesize time',async()=>{
 for(const result of [undefined,{...receipt,seconds:300},{...receipt,groupRevision:3},{...receipt,expiresAt:'invalid'},{...receipt,effective:false}]){
  let fallback=0;const api=await bridge({...(result?{grantResetAppGroupBreak:async()=>result}:{}),applyEarnedUnlockWindow:()=>{fallback++;},getStatus:()=>{fallback++;}});
  assert.equal(api.isResetAppGroupRewardMethodAvailable(),!!result);
  assert.equal((await api.grantResetAppGroupBreak(request,fixtureActionScope)).accepted,false);assert.equal(fallback,0);
 }
 const api=await bridge({grantResetAppGroupBreak:async()=>{throw Error('private');}});assert.equal((await api.grantResetAppGroupBreak(request,fixtureActionScope)).reason,'reset-reward-native-failed');
});
test('duration/expiry override, invalid category/version/authority rejected before native call',async()=>{
 let calls=0;const api=await bridge({grantResetAppGroupBreak:async()=>{calls++;return receipt;}});
 for(const invalid of [{...request,seconds:7200},{...request,expiresAt:receipt.expiresAt},{...request,policyVersion:2},{...request,category:'journal'},{...request,groupRevision:0},{...request,completionSessionId:'../private'},null]) assert.equal((await api.grantResetAppGroupBreak(invalid,fixtureActionScope)).accepted,false);
 assert.equal(calls,0);
});
