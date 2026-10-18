import type {ChallengeSession} from './challenge-session';
import type {RecoveryChallenge} from './recovery-engine';
import {createNativeInterventionAttempt} from './native-intervention';
import {sanitizeAppGroupInterventionScope} from './app-group-intervention';
import {captureEarnedResetTemplate,rebindNativeValidatedEarnedTemplate} from './earned-reset-templates';
import type {LiveEarnedBreakOrigin} from './live-earned-app-time';
import type {LiveResetRewardOwnerLease} from './live-reset-reward';
import {isAppGroupBindingConfirmed,type AppGroupBindingReceipt} from '../../modules/freed-protection/src/app-group-binding';
import {isEarnedAppTimeOfferRequest,isEarnedAppTimeGrantRequest,validateEarnedAppTimeOfferReceipt,validateEarnedAppTimeGrantReceipt,type EarnedAppTimeOfferRequest,type EarnedAppTimeOfferReceipt,type EarnedAppTimeGrantRequest,type EarnedAppTimeGrantReceipt} from '../../modules/freed-protection/src/earned-app-time';
/** Local-only, non-authoritative recovery pointer. Never place this in RecoveryState or a backup. */
export const EARNED_TIME_REFERENCE_PREFIX='freed.earned-time.reference.v2.';
type ReferenceStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type EarnedTimeReference={version:2;ownerUid:string;sessionId:string;offerId:string;offerRequest:EarnedAppTimeOfferRequest;offerReceipt:EarnedAppTimeOfferReceipt;templateId:string|null;templateVersion:2|null;templateFingerprint:string|null;previousTemplate:{id:string;version:2;fingerprint:string}|null;grantRequest:EarnedAppTimeGrantRequest|null};
const key=(owner:string)=>{if(!owner||owner.length>160)throw Error('Earned time owner unavailable');return EARNED_TIME_REFERENCE_PREFIX+encodeURIComponent(owner);};
function valid(value:unknown,owner:string):value is EarnedTimeReference{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as EarnedTimeReference;
 const fields=['version','ownerUid','sessionId','offerId','offerRequest','offerReceipt','templateId','templateVersion','templateFingerprint','previousTemplate','grantRequest'];
 if(Object.keys(v).length!==fields.length||!Object.keys(v).every(k=>fields.includes(k))||v.version!==2||v.ownerUid!==owner||typeof v.sessionId!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(v.sessionId)||!isEarnedAppTimeOfferRequest(v.offerRequest))return false;
 const receipt=validateEarnedAppTimeOfferReceipt(v.offerReceipt,v.offerRequest);if(!receipt?.accepted||!receipt.offer||v.offerId!==receipt.offer.offerId)return false;
 if(v.templateId===null){if(v.templateVersion!==null||v.templateFingerprint!==null)return false;}
 else if(typeof v.templateId!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(v.templateId)||v.templateVersion!==2||typeof v.templateFingerprint!=='string'||v.templateFingerprint.length>1200)return false;
 if(v.previousTemplate!==null&&(!v.previousTemplate||typeof v.previousTemplate!=='object'||Object.keys(v.previousTemplate).sort().join(',')!=='fingerprint,id,version'||typeof v.previousTemplate.id!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(v.previousTemplate.id)||v.previousTemplate.version!==2||typeof v.previousTemplate.fingerprint!=='string'||v.previousTemplate.fingerprint.length>1200))return false;
 return v.grantRequest===null||isEarnedAppTimeGrantRequest(v.grantRequest)&&v.grantRequest.offerId===v.offerId&&v.grantRequest.completionSessionId===v.sessionId&&v.grantRequest.templateId===v.templateId&&v.grantRequest.templateVersion===v.templateVersion;
}
export function readEarnedTimeReference(storage:ReferenceStorage,owner:string):EarnedTimeReference|null{
 const raw=storage.getItem(key(owner));if(raw===null)return null;if(raw.length>12000)throw Error('Earned time reference unreadable');let ref:unknown;try{ref=JSON.parse(raw);}catch{throw Error('Earned time reference unreadable');}if(!valid(ref,owner))throw Error('Earned time reference invalid');return ref;
}
export function writeEarnedTimeReference(storage:ReferenceStorage,owner:string,reference:EarnedTimeReference):void{if(!valid(reference,owner))throw Error('Earned time reference invalid');storage.setItem(key(owner),JSON.stringify(reference));}
export function clearEarnedTimeReference(storage:ReferenceStorage,owner:string):void{storage.removeItem(key(owner));}
export function makeEarnedTimeReference(origin:LiveEarnedBreakOrigin,chosen?:RecoveryChallenge):EarnedTimeReference{
 const target=sanitizeAppGroupInterventionScope(origin.attempt?.scope),earned=origin.earnedTime,offer=earned?.receipt.offer;
 const offerRequest={version:2 as const,policyVersion:2 as const,nativeInterventionId:origin.attempt?.nativeInterventionId,...target,requestedSeconds:offer?.requestedSeconds};
 if(!earned||!offer||!isEarnedAppTimeOfferRequest(offerRequest))throw Error('Original earned time offer unavailable');
 const binding=chosen?captureEarnedResetTemplate(chosen):earned.templateBinding;
 const reference:EarnedTimeReference={version:2,ownerUid:origin.ownerUid,sessionId:origin.sessionId,offerId:offer.offerId,offerRequest,offerReceipt:earned.receipt,templateId:binding?.templateId??null,templateVersion:binding?.templateVersion??null,templateFingerprint:binding?.fingerprint??null,previousTemplate:chosen&&earned.templateBinding&&chosen.id!==earned.templateBinding.templateId?{id:earned.templateBinding.templateId,version:2,fingerprint:earned.templateBinding.fingerprint}:null,grantRequest:earned.request??null};
 if(!valid(reference,origin.ownerUid))throw Error('Earned time reference invalid');return reference;
}
export type EarnedTimeRecoveryResult={status:'ready'|'committed';origin:LiveEarnedBreakOrigin}|{status:'unavailable'|'retry';reason:string};
/** Fresh owner binding plus native validation is mandatory. This helper has NO grant function. */
export async function recoverEarnedTimeReference(input:{reference:EarnedTimeReference;session:ChallengeSession|null;ownerUid:string;ownerLease:LiveResetRewardOwnerLease;actionScope:string;now:()=>number;isCurrent:()=>boolean;bind:(scope:string)=>Promise<AppGroupBindingReceipt>;prepare:(request:EarnedAppTimeOfferRequest,scope:string)=>Promise<EarnedAppTimeOfferReceipt>;lookup:(request:EarnedAppTimeGrantRequest,scope:string,offer:NonNullable<EarnedAppTimeOfferReceipt['offer']>)=>Promise<EarnedAppTimeGrantReceipt>}):Promise<EarnedTimeRecoveryResult>{
 const fail=(reason:string,status:'unavailable'|'retry'='unavailable'):EarnedTimeRecoveryResult=>({status,reason});const ref=input.reference;
 const current=()=>{try{return input.isCurrent()&&input.ownerUid===ref.ownerUid&&input.ownerLease.ownerUid===input.ownerUid&&input.ownerLease.isCurrent();}catch{return false;}};
 if(!valid(ref,input.ownerUid)||!current())return fail('earned-time-owner-changed');
 const session=input.session;
 const previous=!!session&&!ref.grantRequest&&ref.previousTemplate&&session.templateRevision?.id===ref.previousTemplate.id&&session.templateRevision.revision===ref.previousTemplate.version;
 if(session&&(session.ownerId!==ref.ownerUid||session.id!==ref.sessionId||!previous&&(session.templateRevision?.id!==ref.templateId||session.templateRevision?.revision!==ref.templateVersion)))return fail('earned-time-session-changed');
 const originalOffer=ref.offerReceipt.offer!;
 if(ref.grantRequest&&session){
  const request=ref.grantRequest,evidence=request.evidence,proof=session.nativeEvidence;
  if(session.phase!=='completed'||!session.completion||request.category!==session.challenge.choiceGroup||evidence.activeDurationSec!==(evidence.method==='timer'?session.elapsedMs/1000:0))return fail('earned-time-completion-changed');
  if(evidence.method==='timer'?(session.elapsedMs!==originalOffer.requiredActiveSeconds*1000||evidence.observedSteps!==0||evidence.photoProofIds.length!==0):
    (!proof||proof.phase!=='completed'||proof.offerId!==originalOffer.offerId||proof.completionSessionId!==session.id||proof.templateId!==request.templateId||proof.templateVersion!==2||proof.method!==evidence.method||evidence.observedSteps!==proof.observedSteps||JSON.stringify(evidence.photoProofIds)!==JSON.stringify(proof.photoProofIds)||(evidence.method==='steps'&&evidence.stepProofId!==proof.stepProofId)))return fail('earned-time-completion-changed');
 }
 const origin=(receipt:EarnedAppTimeOfferReceipt,grantReceipt?:EarnedAppTimeGrantReceipt):LiveEarnedBreakOrigin=>{
  const templateBinding=session?rebindNativeValidatedEarnedTemplate(session.challenge,receipt.offer!):null;
  if(session&&(!templateBinding||templateBinding.fingerprint!==(previous?ref.previousTemplate!.fingerprint:ref.templateFingerprint)))throw Error('earned-time-template-changed');
  return ({sessionId:ref.sessionId,ownerUid:ref.ownerUid,nativeActionScope:input.actionScope,ownerLease:input.ownerLease,
  attempt:createNativeInterventionAttempt({interventionId:ref.offerRequest.nativeInterventionId,url:'',host:'',sourcePackage:ref.offerRequest.kind==='ios-app-group'?'ios-screen-time':ref.offerRequest.packageName,reason:'Selected app boundary',matchedRule:`app-group:${ref.offerRequest.groupId}:${ref.offerRequest.groupRevision}`,detectedAt:new Date(input.now()).toISOString(),scope:ref.offerRequest.kind==='ios-app-group'?{kind:'ios-app-group',tokenType:'application',groupId:ref.offerRequest.groupId,groupRevision:ref.offerRequest.groupRevision,configurationGeneration:ref.offerRequest.configurationGeneration,scopeEpoch:ref.offerRequest.scopeEpoch}:{kind:'android-app-group',packageName:ref.offerRequest.packageName,groupId:ref.offerRequest.groupId,groupRevision:ref.offerRequest.groupRevision,configurationGeneration:ref.offerRequest.configurationGeneration,scopeEpoch:ref.offerRequest.scopeEpoch}}),
  earnedTime:{receipt,templateBinding,...(ref.grantRequest?{request:Object.freeze({...ref.grantRequest,evidence:Object.freeze({...ref.grantRequest.evidence,photoProofIds:Object.freeze([...ref.grantRequest.evidence.photoProofIds]) as unknown as string[]})}),actionScope:input.actionScope}:{}),...(grantReceipt?{grantReceipt:Object.freeze(grantReceipt)}:{})},...(grantReceipt?{breakRequested:true}:{})});};
 try{
  const binding=await input.bind(input.actionScope);if(!current())return fail('earned-time-owner-changed');
  if(!isAppGroupBindingConfirmed(binding)||binding.generation!==ref.offerRequest.configurationGeneration||binding.scopeEpoch!==ref.offerRequest.scopeEpoch)return fail('earned-time-binding-changed');
  if(ref.grantRequest){
   const result=await input.lookup(ref.grantRequest,input.actionScope,originalOffer);if(!current())return fail('earned-time-owner-changed');
   const checked=validateEarnedAppTimeGrantReceipt(result,ref.grantRequest,originalOffer);
   if(checked?.accepted){if(Date.parse(checked.expiresAt!)<=input.now())return fail('earned-time-expired');return{status:'committed',origin:origin(ref.offerReceipt,checked)};}
   if(checked?.reason!=='earned-time-grant-not-found')return fail(checked?.reason??'earned-time-readback-unavailable',checked?.reason?.includes('expired')?'unavailable':'retry');
  }
  const receipt=validateEarnedAppTimeOfferReceipt(await input.prepare(ref.offerRequest,input.actionScope),ref.offerRequest);if(!current())return fail('earned-time-owner-changed');
  if(!receipt?.accepted||!receipt.offer||receipt.offer.offerId!==ref.offerId||receipt.offer.budgetDay!==originalOffer.budgetDay||receipt.offer.budgetRevision!==originalOffer.budgetRevision||Date.parse(receipt.offer.validUntil)!==Date.parse(originalOffer.validUntil)||Date.parse(receipt.offer.validUntil)<=input.now()||Date.parse(receipt.budget!.nextResetAt)<=input.now())return fail(receipt?.reason??'earned-time-original-offer-unavailable');
  return{status:'ready',origin:origin(receipt)};
 }catch{return fail('earned-time-recovery-retry','retry');}
}
