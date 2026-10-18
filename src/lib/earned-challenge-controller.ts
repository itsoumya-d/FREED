import { nativeEarnedEvidenceMatches, type ChallengeSession } from './challenge-session';
import { getEarnedResetNativeRequirement } from './earned-reset-templates';
import type { EarnedAppTimeOffer } from '../../modules/freed-protection/src/earned-app-time';
import { validateEarnedChallengeEvidenceReceipt, type EarnedChallengeEvidenceBeginRequest, type EarnedChallengeEvidencePhaseRequest, type EarnedChallengeEvidenceReadRequest, type EarnedChallengeEvidenceSession, type EarnedChallengeEvidenceReceipt } from '../../modules/freed-protection/src/earned-challenge-evidence';

type BoundSession=Pick<ChallengeSession,'id'|'challenge'|'templateRevision'>;
type NativeContext={session:BoundSession;offer:EarnedAppTimeOffer;ownerScope:string};
export type EarnedChallengeEvidenceSnapshot={status:'idle'|'loading'|'active'|'ready'|'unavailable';receipt:EarnedChallengeEvidenceReceipt|null;satisfied:boolean;busy:boolean;reason?:string|null};
type ReadAdapter=(request:EarnedChallengeEvidenceReadRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>Promise<EarnedChallengeEvidenceReceipt>;
/** Native receipts are read and finished independently from durable JS completion. No ad/grant API. */
export function createEarnedChallengeEvidenceController(options:NativeContext&{
 isCurrent:()=>boolean;isActive:()=>boolean;isAvailable:()=>boolean;onChange?:()=>void;
 cancelResource?:(scope:string,evidenceSessionId:string,captureOperationId?:string)=>Promise<unknown>;isAuthorityCurrent?:()=>boolean;
 createCaptureId:()=>string;
 beforeBegin?:()=>Promise<boolean>;
 begin:(request:EarnedChallengeEvidenceBeginRequest,scope:string,offer:EarnedAppTimeOffer)=>Promise<EarnedChallengeEvidenceReceipt>;
 read:ReadAdapter;finish:ReadAdapter;
 phase:(request:EarnedChallengeEvidencePhaseRequest,scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>Promise<EarnedChallengeEvidenceReceipt>;
 capture:(request:{version:1;evidenceSessionId:string;targetId:string;captureOperationId:string},scope:string,session:EarnedChallengeEvidenceSession,offer:EarnedAppTimeOffer)=>Promise<EarnedChallengeEvidenceReceipt>;
}){
 let snapshot:EarnedChallengeEvidenceSnapshot={status:'idle',receipt:null,satisfied:false,busy:false};
 let ownedCaptureOperationId:string|null=null;
 let disposed=false,pending:Promise<unknown>|null=null;
 let restartRequired=false;
 const requirement=getEarnedResetNativeRequirement(options.session.challenge);
 const current=()=>!disposed&&options.isCurrent()&&!!requirement&&options.isAvailable();
 const set=(value:EarnedChallengeEvidenceSnapshot)=>{snapshot=value;options.onChange?.();};
 const ready=(receipt:EarnedChallengeEvidenceReceipt)=>nativeEarnedEvidenceMatches(receipt,options.offer,options.session);
 const enough=(receipt:EarnedChallengeEvidenceReceipt)=>{
  const session=receipt.session!;
  return requirement?.method==='steps'?session.observedSteps>=options.offer.requiredSteps:
   requirement?.targetIds.every(id=>session.matchedTargetIds.includes(id))===true;
 };
 const publish=(receipt:EarnedChallengeEvidenceReceipt)=>{
  if(!current())return false;
  if(!nativeEarnedEvidenceMatches(receipt,options.offer,options.session,false)){
   const checked=validateEarnedChallengeEvidenceReceipt(receipt,options.offer,beginRequest,snapshot.receipt?.session??undefined);
   if(checked?.supported&&(checked.session?.phase==='cancelled'||checked.reason==='challenge-evidence-restart-required')&&snapshot.receipt?.session?.phase!=='completed'){
    restartRequired=true;set({status:'unavailable',receipt:null,satisfied:false,busy:false});return false;
   }
   set({...snapshot,...(checked?.session?.phase==='paused'&&checked.reason?.includes('permission')&&snapshot.receipt?.session?.phase!=='completed'?{receipt:checked}:{}),status:'unavailable',satisfied:false,busy:false,reason:checked?.reason??null});return false;
  }
  set({status:ready(receipt)?'ready':'active',receipt,satisfied:ready(receipt)||receipt.session?.phase==='active'&&enough(receipt),busy:false,reason:null});return true;
 };
 const beginRequest:EarnedChallengeEvidenceBeginRequest={version:1,offerId:options.offer.offerId,completionSessionId:options.session.id,templateId:options.session.challenge.id,templateVersion:2,method:requirement?.method??'steps'};
 const operation=async<T>(work:()=>Promise<T>,fallback:T):Promise<T>=>{
  while(pending)await pending;
  if(!current())return fallback;
  let resolve:()=>void=()=>{};pending=new Promise<void>(r=>{resolve=r});
  try{return await work();}catch{if(current())set({status:'unavailable',receipt:snapshot.receipt,satisfied:false,busy:false});return fallback;}
  finally{resolve();pending=null;}
 };
 const refreshWork=async()=>{
  const previous=snapshot.receipt?.session;
  set({...snapshot,status:previous?snapshot.status:'loading',busy:true});
  if(!previous&&options.beforeBegin&&(!await options.beforeBegin()||!current())){if(current())set({...snapshot,status:'unavailable',satisfied:false,busy:false});return;}
  let receipt=previous?await options.read({version:1,evidenceSessionId:previous.evidenceSessionId},options.ownerScope,previous,options.offer):await options.begin(beginRequest,options.ownerScope,options.offer);
  if(disposed&&nativeEarnedEvidenceMatches(receipt,options.offer,options.session,false)&&receipt.session?.phase==='active'){
   if(!options.isAuthorityCurrent?.()){if(options.cancelResource)await options.cancelResource(options.ownerScope,receipt.session.evidenceSessionId);return;}
   await options.phase({version:1,evidenceSessionId:receipt.session.evidenceSessionId,phase:'paused'},options.ownerScope,receipt.session,options.offer);return;
  }
  if(!publish(receipt))return;
  const native=receipt.session!;
  const desired=options.isActive()?'active':'paused';
  if(native.phase!=='completed'&&native.phase!==desired){
   if(desired==='active'&&options.beforeBegin&&(!await options.beforeBegin()||!current())){if(current())set({...snapshot,status:'unavailable',satisfied:false,busy:false});return;}
   receipt=await options.phase({version:1,evidenceSessionId:native.evidenceSessionId,phase:desired},options.ownerScope,native,options.offer);publish(receipt);
  }
 };
 const refresh=()=>operation(async()=>{if(!restartRequired)await refreshWork();},undefined);
 return {
  read:()=>current()?snapshot:{status:'unavailable' as const,receipt:null,satisfied:false,busy:false},refresh,
  retry:()=>operation(async()=>{restartRequired=false;await refreshWork();},undefined),
  async finish(){return operation(async()=>{
   const native=snapshot.receipt?.session;if(!native||!snapshot.satisfied)return null;
   if(snapshot.status==='ready')return snapshot.receipt;
   set({...snapshot,busy:true});
   const receipt=await options.finish({version:1,evidenceSessionId:native.evidenceSessionId},options.ownerScope,native,options.offer);
   return publish(receipt)&&ready(receipt)?receipt:null;
  },null);},
  async capture(targetId:string){return operation(async()=>{
   const native=snapshot.receipt?.session;
   if(!native||native.phase!=='active'||requirement?.method!=='photo'||!requirement.targetIds.includes(targetId as never)||native.matchedTargetIds.includes(targetId))return null;
   set({...snapshot,busy:true});
   const captureOperationId=options.createCaptureId();ownedCaptureOperationId=captureOperationId;
   try{const receipt=await options.capture({version:1,evidenceSessionId:native.evidenceSessionId,targetId,captureOperationId},options.ownerScope,native,options.offer);return publish(receipt)?receipt:null;}
   finally{if(ownedCaptureOperationId===captureOperationId)ownedCaptureOperationId=null;}
  },null);},
  async cancel(){return operation(async()=>{
   const native=snapshot.receipt?.session;if(!native)return true;
   const receipt=await options.phase({version:1,evidenceSessionId:native.evidenceSessionId,phase:'cancelled'},options.ownerScope,native,options.offer);
   if(!current())return false;
   const accepted=receipt.accepted&&receipt.session?.evidenceSessionId===native.evidenceSessionId&&receipt.session.phase==='cancelled';
   if(accepted){disposed=true;set({status:'unavailable',receipt:null,satisfied:false,busy:false});}return accepted;
  },false);},
  dispose(){
   if(disposed)return;const native=snapshot.receipt?.session;
   if(native&&native.phase==='active'){
    const captureOperationId=ownedCaptureOperationId??undefined;
    const cancelOwned=()=>options.cancelResource?.(options.ownerScope,native.evidenceSessionId,captureOperationId).catch(()=>{});
    if(options.isCurrent())void options.phase({version:1,evidenceSessionId:native.evidenceSessionId,phase:'paused'},options.ownerScope,native,options.offer).then(receipt=>{if(!receipt.accepted)return cancelOwned();}).catch(()=>{void cancelOwned();});
    else void cancelOwned()?.catch(()=>{});
   }
   disposed=true;snapshot={status:'unavailable',receipt:null,satisfied:false,busy:false};
  }
 };
}
