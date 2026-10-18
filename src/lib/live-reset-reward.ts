import type { NativeInterventionAttempt } from './native-intervention';
import type { ChallengeSession } from './challenge-session';
import type { ChallengeCompletion } from './recovery-state';
import type { ResetAppGroupRewardRequest, ResetAppGroupRewardReceipt } from '../../modules/freed-protection/src/reset-app-group-reward';
import { isResetAppGroupRewardRequest } from '../../modules/freed-protection/src/reset-app-group-reward';
import { sanitizeAppGroupInterventionScope } from './app-group-intervention';
import { getResetRewardCapSeconds } from './reset-reward-policy';
import { getChallengeVerificationRequirement, isChallengeVerificationSatisfied } from './challenge-verification';
import { matchesMomentumRewardTemplate, type MomentumRewardTemplateBinding } from './momentum-reward-templates';
export type LiveResetRewardOwnerLease = { ownerUid:string|null;isCurrent:()=>boolean };
export type LiveResetBreakOrigin = {sessionId:string;ownerUid:string;attempt:NativeInterventionAttempt|null;nativeActionScope?:string;ownerLease:LiveResetRewardOwnerLease|null;templateBinding?:MomentumRewardTemplateBinding|null;saved?:boolean;breakRequested?:boolean;breakInFlight?:boolean;rewardRequest?:Readonly<ResetAppGroupRewardRequest>;rewardActionScope?:string;rewardReceipt?:Readonly<ResetAppGroupRewardReceipt>};
export function liveResetOwnerCurrent(origin:LiveResetBreakOrigin,owner:string|null,lease:LiveResetRewardOwnerLease|null,storageReady:boolean):boolean {
 try{return Boolean(owner && storageReady && origin.ownerUid===owner && origin.ownerLease && origin.ownerLease===lease && lease?.ownerUid===owner && lease.isCurrent());}catch{return false;}
}
/** Local completion provenance only. This is not the frozen atomic policy's
 * native-ledger preflight. Native alone checks consumption and active windows;
 * no invented empty ledger or inactive-window value is supplied here. */
export function prepareLiveResetGroupReward(input:{origin:LiveResetBreakOrigin;session:ChallengeSession|null;owner:string|null;ownerLease:LiveResetRewardOwnerLease|null;storageReady:boolean;currentAttempt:NativeInterventionAttempt|null;durableHistory:readonly ChallengeCompletion[];methodAvailable:boolean}):{eligible:true;request:Readonly<ResetAppGroupRewardRequest>;seconds:120|300}|{eligible:false;reason:string} {
 const {origin,session}=input;
 const deny=(reason:string)=>({eligible:false as const,reason});
 if(!input.methodAvailable)return deny('native-method-unavailable');
 if(!liveResetOwnerCurrent(origin,input.owner,input.ownerLease,input.storageReady))return deny('owner-changed');
 if(!origin.saved || !session || session.ownerId!==input.owner || session.id!==origin.sessionId || session.phase!=='completed' || !session.completion)return deny('completion-not-live-and-saved');
 if(!matchesMomentumRewardTemplate(session.challenge,origin.templateBinding))return deny('template-unversioned-or-changed');
 const category=origin.templateBinding!.category,seconds=getResetRewardCapSeconds(category,1);
 if(seconds===null)return deny('unsupported-category');
 // Current finding targets have no provider/model-bound held-out receipt in
 // this live flow. Timer-only grounding remains usable without an app reward.
 if(category==='find')return deny('finding-reward-unvalidated');
 if(!Number.isFinite(session.createdAtMs) || !Number.isFinite(session.completion.completedAtMs) || session.completion.completedAtMs<session.createdAtMs ||
   !['helped','still-urging','unknown'].includes(session.completion.outcome) || session.elapsedMs!==session.challenge.durationSec*1000 ||
   !isChallengeVerificationSatisfied(getChallengeVerificationRequirement(session.challenge),{...session.evidence,elapsedSec:session.elapsedMs/1000}))return deny('completion-evidence-invalid');
 const timestamp=new Date(session.completion.completedAtMs).toISOString();
 if(!input.durableHistory.some(record=>record.sessionId===session.id && record.id===session.challenge.id && record.completedAt===timestamp))return deny('completion-not-recorded');
 const target=sanitizeAppGroupInterventionScope(origin.attempt?.scope),current=sanitizeAppGroupInterventionScope(input.currentAttempt?.scope),nativeId=origin.attempt?.nativeInterventionId;
 if(origin.attempt?.source!=='app' || input.currentAttempt?.source!=='app' || !target || !current || JSON.stringify(target)!==JSON.stringify(current) || typeof nativeId!=='string' || nativeId!==input.currentAttempt?.nativeInterventionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nativeId))return deny('original-native-target-changed');
 const request={version:1 as const,policyVersion:1 as const,category,completionSessionId:session.id,templateId:origin.templateBinding!.templateId,templateVersion:origin.templateBinding!.templateVersion,nativeInterventionId:nativeId,...target};
 if(!isResetAppGroupRewardRequest(request))return deny('native-request-invalid');
 return {eligible:true,request:Object.freeze(request),seconds};
}
