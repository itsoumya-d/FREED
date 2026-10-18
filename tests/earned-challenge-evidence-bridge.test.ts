import {withNativeAccountFixture,acknowledgeNativeFixture,fixtureActionScope} from './helpers/acknowledged-native-fixture';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const {buildSync}=createRequire(resolve('package.json'))('esbuild');
async function bridge(native:unknown){
 const code=buildSync({entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['expo-modules-core','react-native']}).outputFiles[0].text;
 const sandbox={module:{exports:{} as any},setTimeout,clearTimeout,require:(name:string)=>name==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>withNativeAccountFixture(native)}};
 vm.runInNewContext(code,sandbox);return acknowledgeNativeFixture(sandbox.module.exports);
}
const scope=fixtureActionScope;
const ids={offer:'b2b4053a-a9e0-4209-9bba-6a6e0fb270ba',evidence:'c2b4053a-a9e0-4209-9bba-6a6e0fb270ba',proof:'d2b4053a-a9e0-4209-9bba-6a6e0fb270ba',capture:'e2b4053a-a9e0-4209-9bba-6a6e0fb270ba'};
const offer={offerId:ids.offer,nativeInterventionId:'a2b4053a-a9e0-4209-9bba-6a6e0fb270ba',groupId:'focus',groupRevision:2,configurationGeneration:1,scopeEpoch:2,kind:'ios-app-group',requestedSeconds:300,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T10:20:00Z',availableMethods:['timer','steps'],requiredActiveSeconds:60,requiredSteps:30,requiredDistinctPhotoTargets:1};
const begin={version:1,offerId:ids.offer,completionSessionId:'session-1',templateId:'momentum-move-steps:earned-v2:300',templateVersion:2,method:'steps'};
const session={evidenceSessionId:ids.evidence,offerId:ids.offer,completionSessionId:'session-1',templateId:begin.templateId,templateVersion:2,method:'steps',phase:'active',observedSteps:0,requiredSteps:30,requiredPhotoTargets:1,supportedTargetIds:[],matchedTargetIds:[],stepProofId:null,photoProofIds:[]};
const receipt={version:1,supported:true,accepted:true,reason:null,session};
const read={version:1,evidenceSessionId:ids.evidence};
const methods=['beginEarnedChallengeEvidence','setEarnedChallengeEvidencePhase','getEarnedChallengeEvidence','verifyEarnedChallengePhoto','captureEarnedChallengePhoto','finishEarnedChallengeEvidence'];
const moduleWith=(overrides:Record<string,unknown>={})=>Object.fromEntries([...methods.map(name=>[name,async()=>receipt]),...Object.entries(overrides)]);
test('old binaries reject evidence without calling legacy classification, counters, or grants',async()=>{
 let unsafe=0;const api=await bridge({classifyChallengePhoto:()=>unsafe++,grantEarnedAppTimeBreak:()=>unsafe++});
 assert.equal(typeof api.beginEarnedChallengeEvidence,'function');
 assert.equal(api.isEarnedChallengeEvidenceAvailable(),false);
 assert.equal((await api.beginEarnedChallengeEvidence(begin,scope,offer)).accepted,false);
 assert.equal(unsafe,0);
});
test('native evidence method availability requires the complete evidence boundary and acknowledged v2 fixture',async()=>{
 assert.equal((await bridge(moduleWith())).isEarnedChallengeEvidenceAvailable(),true);
 for(const missing of methods){const native=moduleWith();delete native[missing];assert.equal((await bridge(native)).isEarnedChallengeEvidenceAvailable(),false);}
});
test('begin forwards exact owner and authored native offer binding',async()=>{
 const calls:unknown[][]=[];const api=await bridge(moduleWith({beginEarnedChallengeEvidence:async(...a:unknown[])=>{calls.push(a);return receipt;}}));
 assert.equal(JSON.stringify(await api.beginEarnedChallengeEvidence(begin,scope,offer)),JSON.stringify(receipt));
 assert.deepEqual(calls,[[begin,scope]]);
});
test('client counts, stale offers, wrong templates and extra fields never start evidence',async()=>{
 let calls=0;const api=await bridge(moduleWith({beginEarnedChallengeEvidence:async()=>{calls++;return receipt;}}));
 for(const bad of [{...begin,observedSteps:999},{...begin,offerId:ids.evidence},{...begin,templateId:'momentum-move-seated:earned-v2:300'},{...begin,templateVersion:1},{...begin,completionSessionId:''},{...begin,method:'timer'}]) assert.equal((await api.beginEarnedChallengeEvidence(bad,scope,offer)).accepted,false);
 assert.equal((await api.beginEarnedChallengeEvidence(begin,scope,{...offer,availableMethods:['timer']})).accepted,false);
 assert.equal((await api.beginEarnedChallengeEvidence(begin,'',offer)).accepted,false);assert.equal(calls,0);
});
test('read is read-only and rejects another evidence session before native dispatch',async()=>{
 const calls:unknown[][]=[];let mutation=0;const api=await bridge(moduleWith({getEarnedChallengeEvidence:async(...a:unknown[])=>{calls.push(a);return receipt;},beginEarnedChallengeEvidence:()=>mutation++,finishEarnedChallengeEvidence:()=>mutation++}));
 assert.equal((await api.getEarnedChallengeEvidence(read,scope,session,offer)).accepted,true);
 assert.equal((await api.getEarnedChallengeEvidence({...read,evidenceSessionId:ids.proof},scope,session,offer)).accepted,false);
 assert.deepEqual(calls,[[read,scope]]);assert.equal(mutation,0);
});
test('native receipts cannot replace session, goal, template, method or introduce private fields',async()=>{
 for(const bad of [{...session,completionSessionId:'other'},{...session,offerId:ids.evidence},{...session,requiredSteps:1},{...session,templateId:'other'},{...session,method:'photo'},{...session,ownerDigest:'private'},{...session,observedSteps:-1},{...session,stepProofId:ids.proof}]){
  const api=await bridge(moduleWith({getEarnedChallengeEvidence:async()=>({...receipt,session:bad})}));
  assert.equal((await api.getEarnedChallengeEvidence(read,scope,session,offer)).accepted,false);
 }
});
test('completed native steps require an actual proof identifier and the native goal',async()=>{
 for(const bad of [{...session,phase:'completed',observedSteps:999,stepProofId:null},{...session,phase:'completed',observedSteps:29,stepProofId:ids.proof}]){
  const api=await bridge(moduleWith({finishEarnedChallengeEvidence:async()=>({...receipt,session:bad})}));assert.equal((await api.finishEarnedChallengeEvidence(read,scope,session,offer)).accepted,false);
 }
 const completed={...session,phase:'completed',observedSteps:30,stepProofId:ids.proof};
 const completedApi=await bridge(moduleWith({finishEarnedChallengeEvidence:async()=>({...receipt,session:completed})}));assert.equal((await completedApi.finishEarnedChallengeEvidence(read,scope,session,offer)).accepted,true);
});
test('phase changes cannot manufacture completion',async()=>{
 let calls=0;const api=await bridge(moduleWith({setEarnedChallengeEvidencePhase:async()=>{calls++;return receipt;}}));
 assert.equal((await api.setEarnedChallengeEvidencePhase({...read,phase:'completed'},scope,session,offer)).accepted,false);assert.equal(calls,0);
});
const photoOffer={...offer,availableMethods:['timer','photo'],supportedPhotoTargetIds:['chair','flower']};
const photoSession={...session,method:'photo',templateId:'momentum-find-flower:earned-v2:300',supportedTargetIds:['chair','flower']};
const photoCapture={...read,targetId:'flower',captureOperationId:ids.capture};
test('earned camera dispatch has no URI and only asks for its authored supported target',async()=>{
 const calls:unknown[][]=[];const matched={version:1,supported:true,accepted:true,reason:null,session:{...photoSession,matchedTargetIds:['flower'],photoProofIds:[ids.proof]},result:'matched',targetId:'flower',proofId:ids.proof};
 const api=await bridge(moduleWith({captureEarnedChallengePhoto:async(...a:unknown[])=>{calls.push(a);return matched;}}));
 assert.equal((await api.captureEarnedChallengePhoto(photoCapture,scope,photoSession,photoOffer)).accepted,true);
 for(const bad of [{...photoCapture,uri:'file:///tmp/photo.jpg'},{...photoCapture,targetId:'chair'},{...photoCapture,targetId:'salt'},{...photoCapture,captureOperationId:'invalid'}])assert.equal((await api.captureEarnedChallengePhoto(bad,scope,photoSession,photoOffer)).accepted,false);
 assert.deepEqual(calls,[[photoCapture,scope]]);
});
test('a caller URI alone cannot mint earned photo authority',async()=>{
 let calls=0;const api=await bridge(moduleWith({verifyEarnedChallengePhoto:async()=>{calls++;return {...receipt,session:photoSession,result:'matched',targetId:'flower',proofId:ids.proof};}}));
 assert.equal((await api.verifyEarnedChallengePhoto({...photoCapture,uri:'file:///tmp/capture.jpg'},scope,photoSession,photoOffer)).accepted,false);assert.equal(calls,0);
});
test('matched photo receipts must contain the proof and target in the same native session',async()=>{
 for(const extra of [{result:'matched',targetId:'flower',proofId:ids.proof},{result:'matched',targetId:'salt',proofId:ids.proof},{result:'uncertain',targetId:'flower',proofId:ids.proof}]){
  const api=await bridge(moduleWith({captureEarnedChallengePhoto:async()=>({...receipt,session:photoSession,...extra})}));assert.equal((await api.captureEarnedChallengePhoto(photoCapture,scope,photoSession,photoOffer)).accepted,false);
 }
});
test('exceptions return bounded opaque failures without private SDK text',async()=>{
 const api=await bridge(moduleWith({beginEarnedChallengeEvidence:async()=>{throw Error('private token credential');}}));
 const r=await api.beginEarnedChallengeEvidence(begin,scope,offer);assert.equal(r.accepted,false);assert.equal(JSON.stringify(r).includes('private token'),false);
});
