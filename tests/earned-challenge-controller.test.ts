import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEarnedChallengeEvidenceController } from '../src/lib/earned-challenge-controller';
import { getEarnedResetChoices } from '../src/lib/earned-reset-templates';
const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:300,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:60,requiredSteps:30,requiredDistinctPhotoTargets:1,availableMethods:['timer','steps']};
function fixture(){
 const challenge=getEarnedResetChoices(offer).find(value=>value.challenge.verification?.kind==='steps')!.challenge;
 let current=true,active=true,phase='active',count=0,proof:string|null=null,blocked=false,deferred=false,release=()=>{},evidenceId='42345678-1234-4123-8123-123456789abc',begins=0,readFailure:any=null;
 const calls:string[]=[],session:any={id:'session',challenge,templateRevision:{id:challenge.id,revision:2}};
 const receipt=():any=>({version:1,supported:true,accepted:true,reason:null,session:{evidenceSessionId:evidenceId,offerId:offer.offerId,completionSessionId:'session',templateId:challenge.id,templateVersion:2,method:'steps',phase,observedSteps:count,requiredSteps:30,requiredPhotoTargets:1,supportedTargetIds:[],matchedTargetIds:[],stepProofId:proof,photoProofIds:[]}});
 const controller=createEarnedChallengeEvidenceController({session,offer,ownerScope:'owner-scope',isCurrent:()=>current,isAuthorityCurrent:()=>current,isActive:()=>active,isAvailable:()=>true,createCaptureId:()=> '62345678-1234-4123-8123-123456789abc',
  begin:async()=>{calls.push('begin');begins++;if(begins>1&&!proof){phase='active';count=0;evidenceId='82345678-1234-4123-8123-123456789abc';readFailure=null;}if(deferred)await new Promise<void>(resolve=>{release=resolve});return blocked?{version:1,supported:false,accepted:false,reason:'unavailable',session:null}:receipt()},
  read:async()=>{calls.push('read');return readFailure??receipt()},phase:async request=>{calls.push(request.phase);phase=request.phase;return receipt()},
  finish:async()=>{calls.push('finish');if(count===30){phase='completed';proof='52345678-1234-4123-8123-123456789abc'}return receipt()},capture:async()=>receipt()});
 return {controller,calls,steps:()=>{count=30},pause:()=>{active=false},resume:()=>{active=true},changeOwner:()=>{current=false},block:()=>{blocked=true},unblock:()=>{blocked=false},defer:()=>{deferred=true},release:()=>release(),sensorFailure:()=>{phase='cancelled';readFailure={...receipt(),accepted:false,reason:'steps-observation-failed'}},readFailure:(reason:string)=>{readFailure={version:1,supported:true,accepted:false,reason,session:null}},recoverRead:()=>{readFailure=null}};
}
test('native evidence coordinator resumes exact evidence and finishes only after observed requirements',async()=>{
 const f=fixture();await f.controller.refresh();assert.equal(f.controller.read().status,'active');
 assert.equal(await f.controller.finish(),null,'caller cannot finish below native count');
 f.pause();await f.controller.refresh();assert.equal(f.controller.read().receipt?.session?.phase,'paused');
 f.resume();f.steps();await f.controller.refresh();assert.equal(f.controller.read().satisfied,true);
 const completed=await f.controller.finish();assert.equal(completed?.session?.stepProofId,'52345678-1234-4123-8123-123456789abc');
 assert.equal(f.controller.read().status,'ready');assert.equal(f.calls.filter(call=>call==='begin').length,1);
});
test('late native callbacks after an owner change cannot publish authority',async()=>{
 const f=fixture();f.changeOwner();await f.controller.refresh();assert.equal(f.controller.read().receipt,null);assert.equal(await f.controller.finish(),null);assert.deepEqual(f.calls,[]);
});
test('native unavailability permits verification retry within the same guided session',async()=>{
 const f=fixture();f.block();await f.controller.refresh();assert.equal(f.controller.read().status,'unavailable');
 f.unblock();await f.controller.refresh();assert.equal(f.controller.read().status,'active');assert.equal(f.controller.read().receipt?.session?.completionSessionId,'session');
});
test('an in-flight native response cannot revive activity authority after owner change',async()=>{
 const f=fixture();f.defer();const pending=f.controller.refresh();await new Promise(resolve=>setImmediate(resolve));f.changeOwner();f.release();await pending;
 assert.equal(f.controller.read().receipt,null);assert.equal(f.controller.read().satisfied,false);
});
test('accepted cancellation closes the old activity controller so replacement cannot restart old evidence',async()=>{
 const f=fixture();await f.controller.refresh();assert.equal(await f.controller.cancel(),true);const before=f.calls.length;await f.controller.refresh();assert.equal(f.calls.length,before);assert.equal(f.controller.read().receipt,null);
});
test('explicit verification retry retires cancelled native observation and obtains fresh evidence without replacing guided completion',async()=>{
 const f=fixture();await f.controller.refresh();f.sensorFailure();await f.controller.refresh();assert.equal(f.controller.read().status,'unavailable');
 await f.controller.refresh();assert.equal(f.calls.filter(call=>call==='begin').length,1,'polling must not silently restart cancelled sensor proof');
 await (f.controller as any).retry?.();assert.equal(f.controller.read().status,'active');assert.equal(f.controller.read().receipt?.session?.evidenceSessionId,'82345678-1234-4123-8123-123456789abc');assert.equal(f.controller.read().receipt?.session?.completionSessionId,'session');assert.equal(f.calls.filter(call=>call==='begin').length,2);
});
test('restart-required evidence is re-begun only on explicit retry while stale authority is never re-begun',async()=>{
 const f=fixture();await f.controller.refresh();f.readFailure('challenge-evidence-restart-required');await f.controller.refresh();await (f.controller as any).retry?.();assert.equal(f.controller.read().status,'active');assert.equal(f.calls.filter(call=>call==='begin').length,2);
 for(const reason of ['challenge-evidence-authority-stale','challenge-evidence-budget-stale','earned-challenge-authority-stale']){
  const stale=fixture();await stale.controller.refresh();stale.readFailure(reason);await stale.controller.refresh();await (stale.controller as any).retry?.();assert.equal(stale.calls.filter(call=>call==='begin').length,1);
 }
});
test('transient readback failure preserves completed proof instead of restarting observation',async()=>{
 const f=fixture();await f.controller.refresh();f.steps();await f.controller.refresh();await f.controller.finish();const proof=f.controller.read().receipt?.session?.stepProofId;
 f.readFailure('earned-evidence-native-failed');await f.controller.refresh();await (f.controller as any).retry?.();assert.equal(f.controller.read().receipt?.session?.stepProofId,proof);assert.equal(f.calls.filter(call=>call==='begin').length,1);
 f.recoverRead();await (f.controller as any).retry?.();assert.equal(f.controller.read().status,'ready');
});
test('late native begin acknowledgement after leaving the screen pauses its actual original observation',async()=>{
 const f=fixture();f.defer();const pending=f.controller.refresh();await new Promise(resolve=>setImmediate(resolve));f.controller.dispose();f.release();await pending;
 assert.equal(f.controller.read().receipt,null);assert.deepEqual(f.calls,['begin','paused']);
});
