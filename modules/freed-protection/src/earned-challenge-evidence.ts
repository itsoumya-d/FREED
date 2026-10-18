import { isEarnedAppTimeOffer, isEarnedAppTimeTemplateBinding, type EarnedAppTimeOffer } from './earned-app-time';

export type EarnedChallengeEvidenceMethod = 'steps' | 'photo';
export type EarnedChallengeEvidenceBeginRequest = {
 version:1; offerId:string; completionSessionId:string; templateId:string; templateVersion:2; method:EarnedChallengeEvidenceMethod;
};
export type EarnedChallengeEvidenceReadRequest = {version:1;evidenceSessionId:string};
export type EarnedChallengeEvidencePhaseRequest = EarnedChallengeEvidenceReadRequest & {phase:'active'|'paused'|'cancelled'};
export type EarnedChallengePhotoRequest = EarnedChallengeEvidenceReadRequest & {targetId:string;captureOperationId:string;uri:string};
export type EarnedChallengePhotoCaptureRequest = Omit<EarnedChallengePhotoRequest,'uri'>;
export type EarnedChallengeEvidenceSession = {
 evidenceSessionId:string; offerId:string; completionSessionId:string; templateId:string; templateVersion:2;
 method:EarnedChallengeEvidenceMethod; phase:'active'|'paused'|'cancelled'|'completed'; observedSteps:number;
 requiredSteps:30|60; requiredPhotoTargets:1|2; supportedTargetIds:string[]; matchedTargetIds:string[];
 stepProofId:string|null; photoProofIds:string[];
};
export type EarnedChallengeEvidenceReceipt = {
 version:1;supported:boolean;accepted:boolean;reason:string|null;session:EarnedChallengeEvidenceSession|null;
 result?:'matched'|'uncertain'|'unavailable'|'cancelled'|null;targetId?:string|null;proofId?:string|null;
};
export const EARNED_PHOTO_TARGET_IDS = ['flower','plant','chair','cup','shoe','branch','clock','fruit'] as const;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const target=(v:unknown):v is string=>typeof v==='string'&&(EARNED_PHOTO_TARGET_IDS as readonly string[]).includes(v);
const unique=(v:unknown,check:(v:unknown)=>boolean,max:number):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(check)&&new Set(v).size===v.length;

export function earnedPhotoTemplateTargets(templateId:string,seconds:300|600|1200):string[] {
 const suffix=`:earned-v2:${seconds}`;
 if(!templateId.startsWith('momentum-find-')||!templateId.endsWith(suffix))return [];
 const parts=templateId.slice('momentum-find-'.length,-suffix.length).split('-');
 if(parts.length!==(seconds===300?1:2)||!parts.every(target)||new Set(parts).size!==parts.length)return [];
 if(seconds!==300&&(parts.join('-')!==[...parts].sort().join('-')||parts.every(p=>['flower','plant','branch','fruit'].includes(p))))return [];
 return parts;
}
export function isEarnedChallengeEvidenceBeginRequest(value:unknown,offer:EarnedAppTimeOffer):value is EarnedChallengeEvidenceBeginRequest {
 if(!isEarnedAppTimeOffer(offer)||!record(value)||!keys(value,['version','offerId','completionSessionId','templateId','templateVersion','method'])||value.version!==1||value.offerId!==offer.offerId||!id(value.completionSessionId)||!id(value.templateId)||value.templateVersion!==2||!['steps','photo'].includes(value.method as string)||!offer.availableMethods.includes(value.method as EarnedChallengeEvidenceMethod))return false;
 if(value.method==='steps')return isEarnedAppTimeTemplateBinding(value.templateId,2,'move','steps',offer.requestedSeconds);
 const targets=earnedPhotoTemplateTargets(value.templateId,offer.requestedSeconds);
 return targets.length===offer.requiredDistinctPhotoTargets&&targets.every(t=>offer.supportedPhotoTargetIds?.includes(t));
}
export function isEarnedChallengeEvidenceReadRequest(value:unknown):value is EarnedChallengeEvidenceReadRequest {
 return record(value)&&keys(value,['version','evidenceSessionId'])&&value.version===1&&uuid(value.evidenceSessionId);
}
export function isEarnedChallengeEvidencePhaseRequest(value:unknown):value is EarnedChallengeEvidencePhaseRequest {
 return record(value)&&keys(value,['version','evidenceSessionId','phase'])&&value.version===1&&uuid(value.evidenceSessionId)&&['active','paused','cancelled'].includes(value.phase as string);
}
export function isEarnedChallengePhotoCaptureRequest(value:unknown):value is EarnedChallengePhotoCaptureRequest {
 return record(value)&&keys(value,['version','evidenceSessionId','targetId','captureOperationId'])&&value.version===1&&uuid(value.evidenceSessionId)&&target(value.targetId)&&uuid(value.captureOperationId);
}
export function isEarnedChallengeEvidenceSession(value:unknown,offer:EarnedAppTimeOffer,begin:EarnedChallengeEvidenceBeginRequest):value is EarnedChallengeEvidenceSession {
 if(!isEarnedChallengeEvidenceBeginRequest(begin,offer)||!record(value)||!keys(value,['evidenceSessionId','offerId','completionSessionId','templateId','templateVersion','method','phase','observedSteps','requiredSteps','requiredPhotoTargets','supportedTargetIds','matchedTargetIds','stepProofId','photoProofIds'])||!uuid(value.evidenceSessionId)||value.offerId!==begin.offerId||value.completionSessionId!==begin.completionSessionId||value.templateId!==begin.templateId||value.templateVersion!==2||value.method!==begin.method||!['active','paused','cancelled','completed'].includes(value.phase as string)||!integer(value.observedSteps)||value.requiredSteps!==offer.requiredSteps||value.requiredPhotoTargets!==offer.requiredDistinctPhotoTargets||!unique(value.supportedTargetIds,target,8)||!unique(value.matchedTargetIds,target,2)||!unique(value.photoProofIds,uuid,2)||(value.stepProofId!==null&&!uuid(value.stepProofId)))return false;
 if(value.phase==='cancelled'&&(value.stepProofId!==null||value.photoProofIds.length||value.matchedTargetIds.length))return false;
 if(begin.method==='steps'){
  if(value.supportedTargetIds.length||value.matchedTargetIds.length||value.photoProofIds.length)return false;
  return value.phase==='completed'?uuid(value.stepProofId)&&(value.observedSteps as number)>=offer.requiredSteps:value.stepProofId===null;
 }
 const expected=earnedPhotoTemplateTargets(begin.templateId,offer.requestedSeconds);
 const supported=value.supportedTargetIds;
 if(value.observedSteps!==0||value.stepProofId!==null||!supported.every(t=>offer.supportedPhotoTargetIds?.includes(t))||!expected.every(t=>supported.includes(t))||!value.matchedTargetIds.every(t=>expected.includes(t))||value.matchedTargetIds.length!==value.photoProofIds.length)return false;
 return value.phase!=='completed'||value.matchedTargetIds.length===offer.requiredDistinctPhotoTargets;
}
export function earnedEvidenceBeginFromSession(session:EarnedChallengeEvidenceSession):EarnedChallengeEvidenceBeginRequest {
 return {version:1,offerId:session.offerId,completionSessionId:session.completionSessionId,templateId:session.templateId,templateVersion:2,method:session.method};
}
export function unavailableEarnedChallengeEvidence(reason:string,supported=false):EarnedChallengeEvidenceReceipt {
 return {version:1,supported,accepted:false,reason,session:null};
}
export function validateEarnedChallengeEvidenceReceipt(value:unknown,offer:EarnedAppTimeOffer,begin:EarnedChallengeEvidenceBeginRequest,original?:EarnedChallengeEvidenceSession):EarnedChallengeEvidenceReceipt|null {
 if(!isEarnedChallengeEvidenceBeginRequest(begin,offer)||!record(value)||!keys(value,['version','supported','accepted','reason','session'],['result','targetId','proofId'])||value.version!==1||typeof value.supported!=='boolean'||typeof value.accepted!=='boolean')return null;
 if(value.accepted ? !value.supported||value.reason!==null : typeof value.reason!=='string'||!/^[a-z0-9-]{1,160}$/.test(value.reason))return null;
 if(value.session===null){if(value.accepted)return null;}
 else if(!isEarnedChallengeEvidenceSession(value.session,offer,begin)||original&&value.session.evidenceSessionId!==original.evidenceSessionId)return null;
 const extra=['result','targetId','proofId'].filter(k=>Object.hasOwn(value,k));
 if(extra.length){
  if(extra.length!==3||value.result!==null&&!['matched','uncertain','unavailable','cancelled'].includes(value.result as string)||value.targetId!==null&&!target(value.targetId)||value.proofId!==null&&!uuid(value.proofId))return null;
  if(value.result==='matched'){
   if(!value.accepted||!value.session||!value.proofId||!value.targetId||!value.session.photoProofIds.includes(value.proofId as string)||!value.session.matchedTargetIds.includes(value.targetId as string))return null;
  }else if(value.proofId!==null)return null;
 }
 return value as EarnedChallengeEvidenceReceipt;
}
