import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { createAppGroupsController } from '../src/lib/app-groups-controller';
const {buildSync}=createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
function bridge(native:unknown){
 const code=buildSync({entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['expo-modules-core','react-native']}).outputFiles[0].text;
 const sandbox={module:{exports:{} as any},setTimeout,clearTimeout,require:(name:string)=>name==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>native}};
 vm.runInNewContext(code,sandbox);return sandbox.module.exports;
}
const snapshot:any={version:1,supported:true,platform:'ios',revision:7,configurationGeneration:1,scopeEpoch:2,groups:[{id:'focus',revision:2,name:'Focus',enabled:false,rule:{kind:'daily-limit',limitMinutes:30},packages:[],applicationCount:0,draftApplicationCount:2,categoryCount:0,webDomainCount:0,legacy:false,configured:true,ready:false,active:false,thresholdReached:false,unavailablePackages:[],usageMinutes:null,nextBoundaryAt:null,break:null}],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const request={version:2,expectedStoreRevision:7,id:'focus',expectedRevision:2,name:'Focus',enabled:true,rule:{kind:'daily-limit',limitMinutes:30},packages:[],extraTimeCapMinutes:20,preferredBreakSeconds:1200};
const scope='["owner",1]';
const diagnostics={version:1,operation:'update-earned',operationId:'11111111-1111-4111-8111-111111111111',stage:'monitor-registration',reason:'monitor-registration-failed',configurationGeneration:1,storeRevision:7,groupRevision:2,errorCode:5,errorDomain:'DeviceActivity.DeviceActivityCenter.MonitoringError'};
const binding={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:1,scopeEpoch:2,errorCode:null,errorDomain:null};
test('actual save adapter and controller retain a rejected monitor action receipt and pending native selection',async()=>{
 const api=bridge({updateAppGroupWithEarnedTime:async()=>({accepted:false,reason:'monitor-registration-failed',snapshot,diagnostics})});
 const controller=createAppGroupsController({getScope:()=>scope,bind:async()=>binding,suspend:async()=>true,read:async()=>snapshot,mutate:async(_,q,s)=>api.updateAppGroupWithEarnedTime(q,s)});
 await controller.refresh();const result:any=await controller.mutate('update-earned',request);
 assert.equal(result.accepted,false);assert.equal(JSON.stringify(result.diagnostics),JSON.stringify(diagnostics));
 assert.equal(JSON.stringify((controller.getSnapshot() as any).actionDiagnostics),JSON.stringify(diagnostics));
 assert.equal(controller.getSnapshot().status.groups[0].draftApplicationCount,2);
 await controller.refresh();assert.equal((controller.getSnapshot() as any).actionDiagnostics.stage,'monitor-registration');
 controller.acknowledge();assert.equal((controller.getSnapshot() as any).actionDiagnostics,null);
});
test('bridge diagnostics copy only safe fields and reject private payloads without accepting the save',async()=>{
 const api=bridge({updateAppGroupWithEarnedTime:async()=>({accepted:false,reason:'monitor-registration-failed',snapshot,diagnostics:{...diagnostics,owner:'private-owner',message:'private-token',errorDomain:'private-owner-domain'}})});
 const result=await api.updateAppGroupWithEarnedTime(request,scope);
 assert.equal(result.accepted,false);assert.equal(result.diagnostics.stage,'monitor-registration');
 assert.equal(result.diagnostics.errorDomain,null);assert.equal(JSON.stringify(result).includes('private'),false);
});
test('receipt validation failures identify bridge readback and never acknowledge activation',async()=>{
 const api=bridge({updateAppGroupWithEarnedTime:async()=>({accepted:true,reason:null,snapshot:{...snapshot,revision:8}})});
 const result=await api.updateAppGroupWithEarnedTime(request,scope);
 assert.equal(result.accepted,false);assert.equal(result.diagnostics.stage,'bridge-readback');assert.equal(result.diagnostics.operation,'update-earned');
});
test('invalid update input keeps a structured failure without reaching native',async()=>{
 let calls=0;const api=bridge({updateAppGroupWithEarnedTime:async()=>{calls++;}});
 for(const malformed of [null,undefined,{...request,preferredBreakSeconds:900}]){
  const result=await api.updateAppGroupWithEarnedTime(malformed,scope);
  assert.equal(result.accepted,false);assert.equal(result.diagnostics.stage,'request-validation');
 }
 assert.equal(calls,0);
});
for(const operation of ['update','update-earned'] as const){
 const method=operation==='update'?'updateAppGroup':'updateAppGroupWithEarnedTime';
 const ordinaryRequest={version:1,expectedStoreRevision:7,id:'focus',expectedRevision:2,name:'Focus',enabled:true,rule:{kind:'daily-limit',limitMinutes:30},packages:[]};
 const update=operation==='update'?ordinaryRequest:request;
 test(`${operation} preserves safe native failure context when the snapshot is invalid`,async()=>{
  const nativeDiagnostics={...diagnostics,operation,configurationGeneration:4,storeRevision:9,groupRevision:3,owner:'private-owner',message:'private-token'};
  const api=bridge({[method]:async()=>({accepted:false,reason:'monitor-registration-failed',snapshot:{...snapshot,revision:null,privateToken:'private-snapshot-token'},diagnostics:nativeDiagnostics})});
  const result=await api[method](update,scope);
  assert.equal(result.accepted,false);assert.equal(result.snapshot.supported,false);assert.equal(result.snapshot.groups.length,0);
  assert.equal(result.diagnostics.stage,'bridge-validation');assert.equal(result.diagnostics.operation,operation);
  assert.equal(result.diagnostics.operationId,'11111111-1111-4111-8111-111111111111');
  assert.equal(result.diagnostics.errorCode,5);assert.equal(result.diagnostics.errorDomain,'DeviceActivity.DeviceActivityCenter.MonitoringError');
  assert.equal(result.diagnostics.configurationGeneration,4);assert.equal(result.diagnostics.storeRevision,9);assert.equal(result.diagnostics.groupRevision,3);
  assert.equal(result.diagnostics.reason,result.reason);assert.equal(JSON.stringify(result).includes('private'),false);
 });
 test(`${operation} strips malformed and private diagnostic context from invalid snapshots`,async()=>{
  for(const nativeDiagnostics of [
   {...diagnostics,operation,errorDomain:'private-domain',configurationGeneration:-1,storeRevision:NaN,groupRevision:Infinity,errorCode:0.5,owner:'private-owner',message:'private-token'},
   {...diagnostics,operation,operationId:'private-token',message:'private-message'},
  ]){
   const api=bridge({[method]:async()=>({accepted:false,reason:'monitor-registration-failed',snapshot:{...snapshot,revision:null},diagnostics:nativeDiagnostics})});
   const result=await api[method](update,scope);
   assert.equal(result.accepted,false);assert.equal(result.snapshot.supported,false);assert.equal(JSON.stringify(result).includes('private'),false);
   if(nativeDiagnostics.operationId===diagnostics.operationId){
    assert.equal(result.diagnostics.errorDomain,null);assert.equal(result.diagnostics.errorCode,null);
    assert.equal(result.diagnostics.configurationGeneration,null);assert.equal(result.diagnostics.storeRevision,null);assert.equal(result.diagnostics.groupRevision,null);
   }
  }
 });
}
test('optional availability facts survive rejected actions and invalid snapshots without defaulting old receipts',async()=>{
 for(const method of ['updateAppGroup','updateAppGroupWithEarnedTime'])for(const invalidSnapshot of [false,true])for(const facts of [undefined,{protectedDataAvailable:false,containerAvailable:true},{protectedDataAvailable:null,containerAvailable:null},{protectedDataAvailable:'private-token',containerAvailable:1}]){
  const api=bridge({[method]:async()=>({accepted:false,reason:'monitor-registration-failed',snapshot:invalidSnapshot?{...snapshot,revision:null}:snapshot,diagnostics:{...diagnostics,...facts}})});
  const ordinary={version:1,expectedStoreRevision:7,id:'focus',expectedRevision:2,name:'Focus',enabled:true,rule:{kind:'daily-limit',limitMinutes:30},packages:[]};
  const result=await api[method](method==='updateAppGroup'?ordinary:request,scope);
  assert.equal(result.accepted,false);assert.equal(result.diagnostics.stage,invalidSnapshot?'bridge-validation':'monitor-registration');
  if(facts&&typeof facts.protectedDataAvailable!=='string'){
   assert.equal(result.diagnostics.protectedDataAvailable,facts.protectedDataAvailable);assert.equal(result.diagnostics.containerAvailable,facts.containerAvailable);
  }else{
   assert.equal(Object.hasOwn(result.diagnostics,'protectedDataAvailable'),false);assert.equal(Object.hasOwn(result.diagnostics,'containerAvailable'),false);
  }
  assert.equal(JSON.stringify(result).includes('private'),false);
 }
});
for(const reason of ['configuration-execution-unavailable','configuration-execution-expired']){
 test(`execution assertion ${reason} survives actual save bridge and controller without granting authority`,async()=>{
  const execution={...diagnostics,stage:'execution-assertion',reason,errorCode:null,errorDomain:null};
  const api=bridge({updateAppGroupWithEarnedTime:async()=>({accepted:false,reason,snapshot,diagnostics:{...execution,owner:'private-owner',message:'private-message'}})});
  const controller=createAppGroupsController({getScope:()=>scope,bind:async()=>binding,suspend:async()=>true,read:async()=>snapshot,mutate:async(_,q,s)=>api.updateAppGroupWithEarnedTime(q,s)});
  await controller.refresh();const result:any=await controller.mutate('update-earned',request);
  assert.equal(result.accepted,false);assert.equal(result.reason,reason);
  assert.equal(result.diagnostics?.stage,'execution-assertion');assert.equal(result.diagnostics.reason,reason);
  assert.equal(JSON.stringify(result).includes('private'),false);
  assert.equal((controller.getSnapshot() as any).actionDiagnostics.stage,'execution-assertion');
  assert.equal(controller.getSnapshot().status.groups[0].enabled,false);
  assert.equal(controller.getSnapshot().status.groups[0].draftApplicationCount,2);
  await controller.refresh();assert.equal((controller.getSnapshot() as any).actionDiagnostics.stage,'execution-assertion');
 });
}

test('clock failure components survive bridge/controller allowlists without private clock or authority values',async()=>{
 const fields={clockBootAvailable:false,clockBootSource:'unavailable',clockBootStage:'boottime-read',clockBootErrno:13,clockPrimaryStage:'uuid-size',clockPrimaryErrno:1,clockWallValid:true,clockUptimeValid:true,clockCalendarValid:true,clockBudgetPhase:'bootstrap'};
 const nativeDiagnostics={...diagnostics,stage:'clock-validation',reason:'earned-time-clock-unverified',...fields,bootIdentity:'private-boot',wall:1900022400,uptime:10000,ownerDigest:'private-owner'};
 const api=bridge({updateAppGroupWithEarnedTime:async()=>({accepted:false,reason:nativeDiagnostics.reason,snapshot,diagnostics:nativeDiagnostics})});
 const result=await api.updateAppGroupWithEarnedTime(request,scope);
 for(const [key,value] of Object.entries(fields))assert.equal(result.diagnostics[key],value,key);
 assert.equal(JSON.stringify(result.diagnostics).includes('private'),false);
 assert.equal(Object.hasOwn(result.diagnostics,'wall'),false);assert.equal(Object.hasOwn(result.diagnostics,'uptime'),false);
 const malformed={clockBootAvailable:'private',clockBootSource:'private-boot',clockBootStage:'private-stage',clockBootErrno:-1,clockPrimaryStage:'private-stage',clockPrimaryErrno:1.5,clockWallValid:1,clockUptimeValid:'private',clockCalendarValid:undefined,clockBudgetPhase:'private-budget'};
 const rejected=await bridge({updateAppGroupWithEarnedTime:async()=>({accepted:false,reason:nativeDiagnostics.reason,snapshot,diagnostics:{...diagnostics,...malformed}})}).updateAppGroupWithEarnedTime(request,scope);
 for(const key of Object.keys(malformed))assert.equal(Object.hasOwn(rejected.diagnostics,key),false,key);
});
