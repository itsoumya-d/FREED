import type { NativeInterventionAttempt } from './native-intervention';
import { nativeEarnedEvidenceMatches, type ChallengeSession } from './challenge-session';
import type { EarnedChallengeEvidenceReceipt } from '../../modules/freed-protection/src/earned-challenge-evidence';
import type { ChallengeCompletion } from './recovery-state';
import { sanitizeAppGroupInterventionScope } from './app-group-intervention';
import { isAppGroupBindingConfirmed, type AppGroupBindingReceipt } from '../../modules/freed-protection/src/app-group-binding';
import { liveResetOwnerCurrent, type LiveResetBreakOrigin, type LiveResetRewardOwnerLease } from './live-reset-reward';
import { getEarnedResetChoices, matchesEarnedResetTemplate, type EarnedResetTemplateBinding } from './earned-reset-templates';
import { isEarnedAppTimeGrantRequest, isEarnedAppTimeOfferRequest, validateEarnedAppTimeOfferReceipt,
 type EarnedAppTimeOfferRequest,type EarnedAppTimeOfferReceipt,type EarnedAppTimeGrantRequest,type EarnedAppTimeGrantReceipt,type EarnedAppTimeSeconds } from '../../modules/freed-protection/src/earned-app-time';
export type LiveEarnedBreakOrigin=LiveResetBreakOrigin&{earnedTime?:{receipt:EarnedAppTimeOfferReceipt;templateBinding:EarnedResetTemplateBinding|null;nativeEvidence?:EarnedChallengeEvidenceReceipt;request?:Readonly<EarnedAppTimeGrantRequest>;actionScope?:string;grantReceipt?:Readonly<EarnedAppTimeGrantReceipt>}};
export type LiveEarnedOfferContext={ownerUid:string;ownerLease:LiveResetRewardOwnerLease;actionScope:string;attempt:NativeInterventionAttempt;storageReady:boolean};
export type LiveEarnedOfferSelection={context:LiveEarnedOfferContext;receipt:EarnedAppTimeOfferReceipt};
export type LiveEarnedOfferSnapshot={status:'idle'|'loading'|'ready'|'unavailable';seconds:EarnedAppTimeSeconds|null;reason:string|null;selection:LiveEarnedOfferSelection|null};
function currentContext(value:LiveEarnedOfferContext|null):value is LiveEarnedOfferContext{try{return !!value&&!!value.ownerUid&&value.ownerLease.ownerUid===value.ownerUid&&value.ownerLease.isCurrent()&&value.storageReady&&!!value.actionScope&&value.attempt.source==='app'&&!!sanitizeAppGroupInterventionScope(value.attempt.scope);}catch{return false;}}
function requestFor(context:LiveEarnedOfferContext,seconds:EarnedAppTimeSeconds):EarnedAppTimeOfferRequest|null{
 const target=sanitizeAppGroupInterventionScope(context.attempt.scope);const request={version:2,policyVersion:2,nativeInterventionId:context.attempt.nativeInterventionId,...target,requestedSeconds:seconds};return isEarnedAppTimeOfferRequest(request)?request:null;
}
const sameContext=(a:LiveEarnedOfferContext,b:LiveEarnedOfferContext|null)=>currentContext(b)&&a.ownerUid===b.ownerUid&&a.ownerLease===b.ownerLease&&a.actionScope===b.actionScope&&JSON.stringify(requestFor(a,300))===JSON.stringify(requestFor(b,300));
/** Serial native offer preparation. Never requests an ad or grants app time. */
export function createLiveEarnedOfferCoordinator(options:{getContext:()=>LiveEarnedOfferContext|null;isAvailable:()=>boolean;bind:(scope:string)=>Promise<AppGroupBindingReceipt>;prepare:(request:EarnedAppTimeOfferRequest,scope:string)=>Promise<EarnedAppTimeOfferReceipt>;now:()=>number;onChange?:()=>void}){
 let state:LiveEarnedOfferSnapshot={status:'idle',seconds:null,reason:null,selection:null};let epoch=0;let queue=Promise.resolve();
 const set=(value:LiveEarnedOfferSnapshot)=>{state=value;options.onChange?.();};
 const current=():LiveEarnedOfferSelection|null=>{const selection=state.selection;return selection&&state.status==='ready'&&options.isAvailable()&&sameContext(selection.context,options.getContext())&&selection.receipt.offer&&Date.parse(selection.receipt.offer.validUntil)>options.now()&&selection.receipt.budget&&Date.parse(selection.receipt.budget.nextResetAt)>options.now()?selection:null;};
 return {
  read:():LiveEarnedOfferSnapshot=>state.status==='ready'&&!current()?{...state,status:'unavailable',reason:'earned-time-offer-stale',selection:null}:state,
  current,
  isBound:(selection:LiveEarnedOfferSelection)=>state.selection===selection&&sameContext(selection.context,options.getContext()),
  invalidate(){epoch++;set({status:'idle',seconds:null,reason:null,selection:null});},
  select(seconds:EarnedAppTimeSeconds):Promise<void>{
   const generation=++epoch;const context=options.getContext();
   if(!options.isAvailable()||!currentContext(context)){set({status:'unavailable',seconds,reason:options.isAvailable()?'earned-time-owner-unavailable':'earned-time-unavailable',selection:null});return Promise.resolve();}
   const captured={...context,attempt:{...context.attempt,scope:{...context.attempt.scope!}}};const request=requestFor(captured,seconds);
   if(!request){set({status:'unavailable',seconds,reason:'earned-time-request-invalid',selection:null});return Promise.resolve();}
   set({status:'loading',seconds,reason:null,selection:null});
   const stillCurrent=()=>epoch===generation&&sameContext(captured,options.getContext());
   queue=queue.catch(()=>{}).then(async()=>{
    if(!stillCurrent())return;
    try{
     const binding=await options.bind(captured.actionScope);if(!stillCurrent())return;
     if(!isAppGroupBindingConfirmed(binding)||binding.generation!==request.configurationGeneration||binding.scopeEpoch!==request.scopeEpoch){set({status:'unavailable',seconds,reason:'earned-time-binding-changed',selection:null});return;}
     const receipt=validateEarnedAppTimeOfferReceipt(await options.prepare(request,captured.actionScope),request);if(!stillCurrent())return;
     if(!receipt?.accepted||!receipt.offer||!getEarnedResetChoices(receipt.offer).length||Date.parse(receipt.offer.validUntil)<=options.now()||Date.parse(receipt.budget!.nextResetAt)<=options.now()){set({status:'unavailable',seconds,reason:receipt?.reason??'earned-time-offer-unavailable',selection:null});return;}
     const immutable=Object.freeze({...receipt,offer:Object.freeze({...receipt.offer,availableMethods:Object.freeze([...receipt.offer.availableMethods]) as unknown as typeof receipt.offer.availableMethods}),budget:Object.freeze({...receipt.budget!})});
     set({status:'ready',seconds,reason:null,selection:{context:captured,receipt:immutable}});
    }catch{if(stillCurrent())set({status:'unavailable',seconds,reason:'earned-time-native-failed',selection:null});}
    finally{if(epoch===generation&&!sameContext(captured,options.getContext()))set({status:'unavailable',seconds,reason:'earned-time-offer-stale',selection:null});}
   });return queue;
  }
 };
}
export function prepareLiveEarnedAppTimeGrant(input:{origin:LiveEarnedBreakOrigin;session:ChallengeSession|null;owner:string|null;ownerLease:LiveResetRewardOwnerLease|null;storageReady:boolean;currentAttempt:NativeInterventionAttempt|null;durableHistory:readonly ChallengeCompletion[];methodAvailable:boolean}):{eligible:true;request:Readonly<EarnedAppTimeGrantRequest>;seconds:EarnedAppTimeSeconds}|{eligible:false;reason:string}{
 const deny=(reason:string)=>({eligible:false as const,reason});const {origin,session}=input;const earned=origin.earnedTime,offer=earned?.receipt.offer;
 if(!input.methodAvailable)return deny('earned-time-unavailable');
 if(!liveResetOwnerCurrent(origin,input.owner,input.ownerLease,input.storageReady))return deny('owner-changed');
 if(!origin.saved||!session||session.ownerId!==input.owner||session.id!==origin.sessionId||session.phase!=='completed'||!session.completion)return deny('completion-not-live-and-saved');
 if(!offer||!earned?.receipt.accepted||!matchesEarnedResetTemplate(session.challenge,earned.templateBinding,offer)||session.templateRevision?.id!==session.challenge.id||session.templateRevision.revision!==2)return deny('authored-offer-binding-invalid');
 const target=sanitizeAppGroupInterventionScope(origin.attempt?.scope),current=sanitizeAppGroupInterventionScope(input.currentAttempt?.scope);
 if(origin.attempt?.source!=='app'||input.currentAttempt?.source!=='app'||!target||!current||JSON.stringify(target)!==JSON.stringify(current)||origin.attempt.nativeInterventionId!==input.currentAttempt.nativeInterventionId||offer.nativeInterventionId!==origin.attempt.nativeInterventionId||offer.groupId!==target.groupId||offer.groupRevision!==target.groupRevision||offer.configurationGeneration!==target.configurationGeneration||offer.scopeEpoch!==target.scopeEpoch||offer.kind!==target.kind)return deny('original-native-target-changed');
 const originalRequest={version:2 as const,policyVersion:2 as const,nativeInterventionId:origin.attempt.nativeInterventionId,...target,requestedSeconds:offer.requestedSeconds};
 if(!isEarnedAppTimeOfferRequest(originalRequest)||!validateEarnedAppTimeOfferReceipt(earned.receipt,originalRequest))return deny('original-offer-invalid');
 const method=earned.templateBinding!.method;
 if((method==='timer'&&(session.elapsedMs!==offer.requiredActiveSeconds*1000||session.challenge.durationSec!==offer.requiredActiveSeconds))||!Number.isFinite(session.createdAtMs)||!Number.isFinite(session.completion.completedAtMs)||session.completion.completedAtMs<session.createdAtMs||!['helped','still-urging','unknown'].includes(session.completion.outcome))return deny('completion-evidence-invalid');
 if(method!=='timer'&&(!earned.nativeEvidence||!nativeEarnedEvidenceMatches(earned.nativeEvidence,offer,session)||!session.nativeEvidence||JSON.stringify(session.nativeEvidence)!==JSON.stringify(earned.nativeEvidence.session)))return deny('native-completion-evidence-unavailable');
 if(!input.durableHistory.some(record=>record.sessionId===session.id&&record.id===session.challenge.id&&record.completedAt===new Date(session.completion!.completedAtMs).toISOString()))return deny('completion-not-recorded');
 const proof=earned.nativeEvidence?.session;
 const evidence:EarnedAppTimeGrantRequest['evidence']=method==='timer'?{method:'timer',activeDurationSec:session.elapsedMs/1000,observedSteps:0,photoProofIds:[]}:
  {method,activeDurationSec:0,observedSteps:proof!.observedSteps,photoProofIds:[...proof!.photoProofIds],...(method==='steps'?{stepProofId:proof!.stepProofId!}:{})};
 const request={version:2 as const,policyVersion:2 as const,offerId:offer.offerId,completionSessionId:session.id,category:earned.templateBinding!.category,templateId:earned.templateBinding!.templateId,templateVersion:2,evidence};
 if(!isEarnedAppTimeGrantRequest(request))return deny('native-request-invalid');Object.freeze(request.evidence.photoProofIds);Object.freeze(request.evidence);
 return {eligible:true,request:Object.freeze(request),seconds:offer.requestedSeconds};
}

export type PresentedNativeAppBreak={groupId:string;nativeInterventionId:string;expiresAt:string};
/** Native snapshot projection only. No history writes, inferred start time or invented duration. */
export function presentNativeAppBreak(input:{snapshot:import('./app-groups-contract').AppGroupsSnapshot|null;snapshotScope:string|null;currentScope:string|null;ownerUid:string|null;sdkOwnerUid:string|null;ownerLease:LiveResetRewardOwnerLease|null;now:number}):PresentedNativeAppBreak|null{
 try{
  if(!input.ownerUid||input.sdkOwnerUid!==input.ownerUid||!input.currentScope||input.snapshotScope!==input.currentScope||input.ownerLease?.ownerUid!==input.ownerUid||!input.ownerLease.isCurrent()||!Number.isFinite(input.now))return null;
  const snapshot=input.snapshot;if(!snapshot?.supported||!snapshot.permissions.authorized||!snapshot.permissions.runtimeConnected)return null;
  const group=snapshot.groups.find(value=>value.enabled&&value.ready&&value.configured&&value.break?.effective===true&&value.break.remainingRestrictionCount===0&&typeof value.break.interventionId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.break.interventionId)&&Number.isFinite(Date.parse(value.break.expiresAt))&&Date.parse(value.break.expiresAt)>input.now);
  return group?.break?{groupId:group.id,nativeInterventionId:group.break.interventionId,expiresAt:group.break.expiresAt}:null;
 }catch{return null;}
}

/** Conservative display/ad preflight: 8s membership,10s load,120s SDK timeout and retry slack.
 * Native still owns time; a JS rollback never creates authority. */
export const EARNED_TIME_AD_HEADROOM_MS=150_000;
export function isEarnedOfferAdFeasible(receipt:EarnedAppTimeOfferReceipt,now:number,headroomMs=EARNED_TIME_AD_HEADROOM_MS):boolean{
 const offer=receipt.offer,budget=receipt.budget;
 return Boolean(receipt.accepted&&receipt.supported&&offer&&budget&&budget.clockState==='verified'&&budget.dayKey===offer.budgetDay&&budget.remainingSeconds>=offer.requestedSeconds&&Number.isFinite(now)&&Number.isFinite(headroomMs)&&headroomMs>=0&&Math.min(Date.parse(offer.validUntil),Date.parse(budget.nextResetAt))-now>offer.requiredActiveSeconds*1000+headroomMs);
}
