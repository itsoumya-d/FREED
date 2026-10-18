import {isAppGroupBindingConfirmed} from '../modules/freed-protection/src/app-group-binding';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { createAccountOperationGate } from '../src/lib/account-operation';
import { createPendingInterventionTracker, consumePendingInterventionOnce } from '../src/lib/protection-capabilities';
const id='432f2c60-9277-4e92-bd96-af68c4f8d375';
function actual(ack:'false'|'throw'|'true',group=false) {
 const source=readFileSync(process.env.TASK2_FIX_SCOPE_SOURCE??'src/features/freed-app.tsx','utf8'),start=source.indexOf('  const consumePendingIntervention ='),end=source.indexOf('  const consumeDeepLinkIntervention =',start),ticketStart=source.indexOf('  const captureProtectionActionTicket =');
 const ticket=ticketStart<0?'':source.slice(ticketStart,source.indexOf('  const appGroups =',ticketStart));
 const calls={read:0,clear:0,handoff:0,message:0};let epoch=0,scope='["owner",4]',resolve:any;
 const tracker=createPendingInterventionTracker();const payload:any={interventionId:id,url:'https://screen-time-shield.freed.local',host:'screen-time-shield.freed.local',sourcePackage:'ios-screen-time',matchedRule:group?'app-group:9190cf33-1050-47b5-81b3-1b6d71380a93:1':'ios-screen-time-shield',reason:'Native recovery',detectedAt:new Date().toISOString(),scope:group?{kind:'ios-app-group',groupId:'9190cf33-1050-47b5-81b3-1b6d71380a93',groupRevision:1,configurationGeneration:1,scopeEpoch:1,tokenType:'application'}:{kind:'ios-screen-time',tokenType:'application'}};
 const confirmed={version:1,operationId:id,supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:"complete",reason:null,generation:1,scopeEpoch:1,errorCode:null,errorDomain:null};
 const deps:any={isAppGroupBindingConfirmed,recoveryEntryPresentation:{current:{capture:()=>({}),canPresent:()=>true}},guidedRecoveryInProgress:{current:()=>false},React:{useCallback:(fn:any)=>fn},hydrated:true,Platform:{OS:'ios'},getProtectionActionScope:()=>scope,protectionHostAlive:{current:true},appGroupsSuspensionEpoch:{get current(){return epoch;}},getFirebaseAccountScope:()=> 'owner',getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:true,anonymous:false,ownerUid:'owner',email:null}),getJourneyOwner:(a:any)=>a.ownerUid,
  accountOperationGate:{current:createAccountOperationGate(()=> 'owner')},pendingInterventionTracker:{current:tracker},setAppGroupActionScope:async()=>{if(ack==='throw')throw new Error('native rejection');return ack==='true'?confirmed:false;},consumePendingInterventionOnce,getPendingIntervention:async()=>{calls.read++;return payload;},clearPendingIntervention:async()=>{calls.clear++;return true;},setRecoveryState:()=>{},recordBlockingAttempt:(v:any)=>v,setActiveAttempt:()=>{calls.handoff++;},setScreen:()=>{},setProtectionSyncMessage:()=>{calls.message++;}};
 const run=()=>new Function(...Object.keys(deps),transpileModule(ticket+source.slice(start,end)+';return consumePendingIntervention;',{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)(...Object.values(deps))();
 return {run,calls,tracker,deps,payload,changeEpoch:()=>{epoch++;},deferAck:()=>{deps.setAppGroupActionScope=()=>new Promise(r=>{resolve=r;});},release:()=>resolve(confirmed)};
}
const flush=()=>new Promise<void>(r=>setImmediate(r));
test('actual false/rejected setter consumes neither legacy nor group pending authority and keeps it retryable',async()=>{
 for(const ack of ['false','throw'] as const)for(const group of [false,true]){const f=actual(ack,group);f.run();await flush();assert.equal(f.calls.read,0);assert.equal(f.calls.clear,0);assert.equal(f.calls.handoff,0);assert.equal(f.tracker.consumedKeys.size,0);}
});
test('old same-scope acknowledged consumption cannot read/clear after suspension epoch, but a fresh acknowledgement consumes once',async()=>{
 const f=actual('true');f.deferAck();f.run();f.changeEpoch();f.release();await flush();assert.equal(f.calls.read,0);assert.equal(f.calls.clear,0);assert.equal(f.calls.handoff,0);
 f.deps.setAppGroupActionScope=async()=>({version:1,operationId:id,supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:"complete",reason:null,generation:1,scopeEpoch:1,errorCode:null,errorDomain:null});f.run();await flush();assert.equal(f.calls.read,1);assert.equal(f.calls.clear,1);assert.equal(f.calls.handoff,1);
});
test('suspension during native pending read cannot clear or publish its authority',async()=>{
 const f=actual('true',true);let resolve:any;f.deps.getPendingIntervention=()=>{f.calls.read++;return new Promise(r=>{resolve=r;});};f.run();await flush();assert.equal(f.calls.read,1);f.changeEpoch();resolve(f.payload);await flush();assert.equal(f.calls.clear,0);assert.equal(f.calls.handoff,0);assert.equal(f.tracker.consumedKeys.size,0);
});
test('unmounted Root cannot read pending after an acknowledgement',async()=>{
 const f=actual('true');f.deferAck();f.run();f.deps.protectionHostAlive.current=false;f.release();await flush();assert.equal(f.calls.read,0);assert.equal(f.calls.clear,0);assert.equal(f.calls.handoff,0);
});
