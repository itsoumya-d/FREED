import assert from 'node:assert/strict';
import test from 'node:test';
import {sanitizeAppGroupInterventionScope} from '../src/lib/app-group-intervention';
import {createNativeInterventionAttempt,createDeepLinkInterventionAttempt} from '../src/lib/native-intervention';
import {consumePendingInterventionOnce,createPendingInterventionTracker} from '../src/lib/protection-capabilities';
import {isResetAppGroupRewardRequest,validateResetAppGroupRewardReceipt} from '../modules/freed-protection/src/reset-app-group-reward';
const scope={kind:'ios-app-group' as const,tokenType:'application' as const,groupId:'20202020-2020-4020-8020-202020202020',groupRevision:1,configurationGeneration:0,scopeEpoch:1};
const id='10101010-1010-4010-8010-101010101010',time='2026-10-08T10:00:00.000Z';
const pending={interventionId:id,url:'',host:'',sourcePackage:'ios-screen-time',reason:'Selected applications',matchedRule:`app-group:${scope.groupId}:1`,detectedAt:time,scope};
test('actual initial native generation0 remains zero through pending normalization and acknowledged consumption',async()=>{
 assert.deepEqual(sanitizeAppGroupInterventionScope(scope),scope);assert.equal(createNativeInterventionAttempt(pending).scope?.configurationGeneration,0);
 const attempt=await consumePendingInterventionOnce({tracker:createPendingInterventionTracker(),getPending:async()=>pending,clearPending:async()=>true,nowMs:Date.parse(time)});
 assert.equal(attempt?.scope?.kind,'ios-app-group');assert.equal(attempt?.scope?.configurationGeneration,0);
 assert.deepEqual(sanitizeAppGroupInterventionScope({...scope,scopeEpoch:0}),{...scope,scopeEpoch:0});
});
test('zero schema validity cannot supply bound owner, consumed claim, native grant or URL authority',async()=>{
 assert.equal(await consumePendingInterventionOnce({tracker:createPendingInterventionTracker(),getPending:async()=>null,clearPending:async()=>true,nowMs:Date.parse(time)}),null);
 assert.equal(await consumePendingInterventionOnce({tracker:createPendingInterventionTracker(),getPending:async()=>pending,clearPending:async()=>false,nowMs:Date.parse(time)}),null);
 assert.equal(createDeepLinkInterventionAttempt(`freed://intervention?source=app-group&groupId=${scope.groupId}&configurationGeneration=0&scopeEpoch=0`),null);
 const request={version:1 as const,policyVersion:1 as const,category:'breathe' as const,completionSessionId:'session',templateId:'momentum-breathe-soft',templateVersion:1,nativeInterventionId:id,...scope};
 assert.equal(isResetAppGroupRewardRequest(request),true);
 assert.equal(validateResetAppGroupRewardReceipt({version:1,policyVersion:1,supported:true,accepted:false,reason:'reset-reward-owner-or-state-unavailable',effective:false,replayed:false},request)?.accepted,false);
 assert.equal(validateResetAppGroupRewardReceipt({accepted:true,expiresAt:'2026-10-08T10:02:00Z'},request),null);
});
test('all malformed scope boundaries remain strict while only generation/epoch become nonnegative',()=>{
 for(const field of ['configurationGeneration','scopeEpoch'] as const)for(const bad of [-1,.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'0',false])assert.equal(sanitizeAppGroupInterventionScope({...scope,[field]:bad}),null);
 for(const groupRevision of [0,-1,.5,NaN,'1'])assert.equal(sanitizeAppGroupInterventionScope({...scope,groupRevision}),null);
 for(const groupId of ['wrong','../group',null])assert.equal(sanitizeAppGroupInterventionScope({...scope,groupId}),null);
 assert.equal(sanitizeAppGroupInterventionScope({...scope,tokenType:'category'}),null);
});
