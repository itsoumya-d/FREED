import {withNativeAccountFixture,acknowledgeNativeFixture,fixtureActionScope} from './helpers/acknowledged-native-fixture';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const {buildSync}=createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
async function bridge(native:unknown){
 const code=buildSync({entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['expo-modules-core','react-native']}).outputFiles[0].text;
 const sandbox={module:{exports:{} as any},setTimeout,clearTimeout,require:(name:string)=>name==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>withNativeAccountFixture(native)}};
 vm.runInNewContext(code,sandbox);return acknowledgeNativeFixture(sandbox.module.exports);
}
const request={version:1,id:'focus',expectedRevision:2,expectedStoreRevision:6},scope=fixtureActionScope;
const snapshot={version:1,supported:true,platform:'ios',revision:7,configurationGeneration:1,scopeEpoch:2,groups:[{id:'focus',revision:2,name:'Focus',enabled:true,rule:{kind:'before-use'},packages:[],applicationCount:1,draftApplicationCount:null,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:true,active:true,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null}],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const receipt={accepted:true,reason:null,operation:'discard-pending-selection',targetId:'focus',pendingSelectionDiscarded:true,snapshot,diagnostics:{stage:'complete',reason:null,configurationGeneration:null,errorCode:null,errorDomain:null}};
test('explicit discard forwards only its target request/scope and preserves the full structured native receipt',async()=>{
 const calls:unknown[][]=[];let effects=0;
 const api=await bridge({discardPendingAppGroupSelection:async(...args:unknown[])=>{calls.push(args);return receipt;},updateAppGroup:()=>{effects++;},removeAppGroup:()=>{effects++;},activateProtectionConfiguration:()=>{effects++;}});
 assert.equal(JSON.stringify(await api.discardPendingAppGroupSelection(request,scope)),JSON.stringify(receipt));
 assert.deepEqual(calls,[[request,scope]]);assert.equal(effects,0);
});
test('old/malformed/rejected native discard cannot clear the JS draft through update/remove/status fallbacks',async()=>{
 for(const native of [undefined,{accepted:true,reason:null,snapshot},{...receipt,targetId:'other'},{...receipt,snapshot:{...snapshot,groups:[{...snapshot.groups[0],draftApplicationCount:2}]}},{...receipt,accepted:false,reason:'state-read-failed',pendingSelectionDiscarded:false}]){
  let effects=0;
  const api=await bridge({...(native?{discardPendingAppGroupSelection:async()=>native}:{}),updateAppGroup:()=>{effects++;},removeAppGroup:()=>{effects++;},getAppGroups:()=>{effects++;}});
  const result=await api.discardPendingAppGroupSelection(request,scope);
  assert.equal(result.accepted,false);assert.equal(result.pendingSelectionDiscarded,false);assert.equal(effects,0);
  if(native?.reason==='state-read-failed')assert.equal(result.reason,'state-read-failed');
 }
});
test('thrown native errors and invalid target fences are explicit discard failures',async()=>{
 let calls=0;const api=await bridge({discardPendingAppGroupSelection:async()=>{calls++;throw new Error('private');}});
 assert.equal((await api.discardPendingAppGroupSelection(request,scope)).reason,'app-group-discard-native-failed');
 assert.equal(calls,1);
 for(const invalid of [{...request,expectedStoreRevision:NaN},{...request,expectedRevision:0},{...request,id:'bad/token'},null])assert.equal((await api.discardPendingAppGroupSelection(invalid,scope)).reason,'app-group-discard-request-invalid');
 assert.equal(calls,1);
});
