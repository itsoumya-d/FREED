import { MOMENTUM_RESET_TEMPLATES } from '../data/momentum-resets';
import type { RecoveryChallenge } from './recovery-engine';
import { LOCAL_PHOTO_TARGETS, normalizeChallengeRule, type ChallengeChoiceGroup, type LocalPhotoTargetId } from './challenge-rules';
import { getEarnedChallengeRequirements, isEarnedAppTimeOffer, isEarnedAppTimeTemplateBinding, type EarnedAppTimeOffer, type EarnedAppTimeSeconds } from '../../modules/freed-protection/src/earned-app-time';
export type EarnedResetTemplateBinding = Readonly<{templateId:string;templateVersion:2;category:ChallengeChoiceGroup;method:'timer'|'steps'|'photo';seconds:EarnedAppTimeSeconds;fingerprint:string}>;
const issued = new WeakMap<RecoveryChallenge,EarnedResetTemplateBinding>();
const bindings = new WeakSet<EarnedResetTemplateBinding>();
const registry = new Map<string,RecoveryChallenge>();
const fingerprint=(challenge:RecoveryChallenge)=>JSON.stringify([challenge.id,challenge.category,challenge.choiceGroup,challenge.durationSec,challenge.environment,challenge.seatedAlternative,normalizeChallengeRule(challenge.verification)]);
function register(challenge:RecoveryChallenge,seconds:EarnedAppTimeSeconds){
 Object.freeze(challenge.steps);Object.freeze(challenge.verification);Object.freeze(challenge);
 const binding=Object.freeze({templateId:challenge.id,templateVersion:2 as const,category:challenge.choiceGroup!,method:challenge.verification!.kind as 'timer'|'steps'|'photo',seconds,fingerprint:fingerprint(challenge)});
 issued.set(challenge,binding);bindings.add(binding);registry.set(challenge.id,challenge);
}
const targets=Object.keys(LOCAL_PHOTO_TARGETS).sort() as LocalPhotoTargetId[];
const plantTargets=new Set<LocalPhotoTargetId>(['flower','plant','branch','fruit']);
const distinctPair=(first:LocalPhotoTargetId,second:LocalPhotoTargetId)=>first!==second&&!(plantTargets.has(first)&&plantTargets.has(second));
for(const seconds of [300,600,1200] as const){for(const id of ['momentum-breathe-soft','momentum-breathe-exhale','momentum-move-seated','momentum-move-stretch']){
 const base=MOMENTUM_RESET_TEMPLATES.find(t=>t.id===id)!;
 const challenge:RecoveryChallenge={...base,id:`${id}:earned-v2:${seconds}`,durationSec:getEarnedChallengeRequirements(seconds)!.requiredActiveSeconds,steps:[...base.steps],verification:{version:1,kind:'timer'}};
 register(challenge,seconds);
}
 const stepBase=MOMENTUM_RESET_TEMPLATES.find(t=>t.id==='momentum-move-steps')!;
 register({...stepBase,id:`momentum-move-steps:earned-v2:${seconds}`,steps:[...stepBase.steps],durationSec:getEarnedChallengeRequirements(seconds)!.requiredActiveSeconds,verification:{version:1,kind:'steps',minSteps:getEarnedChallengeRequirements(seconds)!.requiredSteps}},seconds);
 for(const first of targets){
  const base=MOMENTUM_RESET_TEMPLATES.find(t=>t.id===`momentum-find-${first}`)!;
  if(seconds===300)register({...base,id:`${base.id}:earned-v2:300`,steps:[...base.steps],verification:{version:1,kind:'photo',targetId:first}},seconds);
  else for(const second of targets.filter(t=>t>first&&distinctPair(first,t))){
   register({...base,id:`momentum-find-${first}-${second}:earned-v2:${seconds}`,title:'Find two nearby objects',steps:['Find each requested object nearby.','Center each object in a separate fresh camera photo.','The photos are checked on this device, then deleted.'],durationSec:120,verification:{version:1,kind:'photo',targetId:first,targetIds:Object.freeze([first,second]) as unknown as LocalPhotoTargetId[]}},seconds);
  }
 }
}
/** Only these exact factory objects can establish fresh authored selection provenance. */
export function captureEarnedResetTemplate(challenge:RecoveryChallenge):EarnedResetTemplateBinding|null{return issued.get(challenge)??null;}
export function matchesEarnedResetTemplate(challenge:RecoveryChallenge,binding:EarnedResetTemplateBinding|null|undefined,offer:EarnedAppTimeOffer):boolean{
 const requirement=getEarnedResetNativeRequirement(challenge);
 return Boolean(binding&&bindings.has(binding)&&isEarnedAppTimeOffer(offer)&&offer.availableMethods.includes(binding.method)&&binding.seconds===offer.requestedSeconds&&binding.fingerprint===fingerprint(challenge)&&isEarnedAppTimeTemplateBinding(challenge.id,binding.templateVersion,binding.category,binding.method,offer.requestedSeconds)&&
  (binding.method!=='photo'||requirement?.targetIds.length===offer.requiredDistinctPhotoTargets&&requirement.targetIds.every(id=>offer.supportedPhotoTargetIds?.includes(id))));
}
/** Native capability is mandatory. Unsupported Find stays unavailable before any ad promise. */
export function getEarnedResetChoices(offer:EarnedAppTimeOffer,excludeId?:string):readonly {group:ChallengeChoiceGroup;challenge:RecoveryChallenge}[]{
 if(!isEarnedAppTimeOffer(offer))return [];
 const choices:{group:ChallengeChoiceGroup;challenge:RecoveryChallenge}[]=offer.availableMethods.includes('timer')?(['breathe','move'] as const).map(group=>{
  const bases=group==='breathe'?['momentum-breathe-soft','momentum-breathe-exhale']:['momentum-move-seated','momentum-move-stretch'];
  const choices=bases.map(base=>registry.get(`${base}:earned-v2:${offer.requestedSeconds}`)!);
  return {group,challenge:choices.find(challenge=>challenge.id!==excludeId)??choices[0]};
 }):[];
 if(offer.availableMethods.includes('steps'))choices.push({group:'move',challenge:registry.get(`momentum-move-steps:earned-v2:${offer.requestedSeconds}`)!});
 const photos=[...registry.values()].filter(challenge=>challenge.choiceGroup==='find'&&matchesEarnedResetTemplate(challenge,issued.get(challenge),offer));
 const photo=photos.find(challenge=>challenge.id!==excludeId)??photos[0];if(photo)choices.push({group:'find',challenge:photo});
 return choices;
}

export function getEarnedResetNativeRequirement(challenge:RecoveryChallenge):{method:'steps'|'photo';targetIds:LocalPhotoTargetId[]}|null{
 const canonical=registry.get(challenge.id),binding=canonical?issued.get(canonical):null;
 if(!binding||binding.fingerprint!==fingerprint(challenge)||binding.method==='timer')return null;
 const rule=normalizeChallengeRule(challenge.verification);
 return rule?.kind==='steps'?{method:'steps',targetIds:[]}:rule?.kind==='photo'?{method:'photo',targetIds:[...(rule.targetIds??[rule.targetId])]}:null;
}

/** Use only AFTER the native owner/offer has been freshly revalidated. Stored text cannot bind a template. */
export function rebindNativeValidatedEarnedTemplate(challenge:RecoveryChallenge,offer:EarnedAppTimeOffer):EarnedResetTemplateBinding|null{
 const canonical=registry.get(challenge.id),binding=canonical?issued.get(canonical):null;
 return binding&&matchesEarnedResetTemplate(challenge,binding,offer)?binding:null;
}
