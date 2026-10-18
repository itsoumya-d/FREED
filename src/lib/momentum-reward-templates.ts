import { MOMENTUM_RESET_TEMPLATES } from '../data/momentum-resets';
import { normalizeChallengeRule, type ChallengeChoiceGroup, type ChallengeVerificationRule, type LocalPhotoTargetId } from './challenge-rules';
import type { RecoveryChallenge } from './recovery-engine';
export type MomentumRewardTemplateBinding = Readonly<{ templateId: string; templateVersion: number; category: ChallengeChoiceGroup; fingerprint: string }>;
type Definition = { version: 1; category: RecoveryChallenge['category']; group: ChallengeChoiceGroup; duration: 60; environment: 'indoors'|'either'|'outdoors'; seated: boolean; rule: ChallengeVerificationRule };
const timed=(category:Definition['category'],group:ChallengeChoiceGroup):Definition=>({version:1,category,group,duration:60,environment:'indoors',seated:true,rule:{version:1,kind:'timer'}});
/** Authored template revisions, independent of verification rule versions. Update
 * a revision whenever enforcement metadata changes. User/translated copy is excluded. */
const definitions:Readonly<Record<string,Definition>>=Object.freeze({
 'momentum-breathe-soft':timed('breathing','breathe'),
 'momentum-breathe-exhale':timed('breathing','breathe'),
 'momentum-find-five':timed('reset','find'),
 'momentum-find-shape':timed('reset','find'),
 'momentum-move-seated':timed('physical','move'),
 'momentum-move-stretch':timed('physical','move'),
 'momentum-move-steps':{...timed('physical','move'),environment:'either',seated:false,rule:{version:1,kind:'steps',minSteps:12}},
 ...Object.fromEntries((['flower','plant','chair','cup','shoe','branch','clock','fruit'] as LocalPhotoTargetId[]).map(target=>[
  `momentum-find-${target}`,{...timed('reset','find'),environment:target==='branch'?'outdoors':'either',rule:{version:1,kind:'photo',targetId:target}} as Definition,
 ])),
});
function fingerprint(challenge:RecoveryChallenge):string|null {
 const rule=normalizeChallengeRule(challenge.verification);
 if(!rule)return null;
 return JSON.stringify([challenge.id,challenge.category,challenge.choiceGroup,challenge.durationSec,challenge.environment,challenge.seatedAlternative,rule]);
}
export function currentMomentumRewardTemplate(challenge:RecoveryChallenge):MomentumRewardTemplateBinding|null {
 const definition=definitions[challenge.id];if(!definition)return null;
 const expected=JSON.stringify([challenge.id,definition.category,definition.group,definition.duration,definition.environment,definition.seated,definition.rule]);
 return fingerprint(challenge)===expected?Object.freeze({templateId:challenge.id,templateVersion:definition.version,category:definition.group,fingerprint:expected}):null;
}
/** Called only on fresh selection. Matching metadata in restored/custom content
 * cannot manufacture the original authored selection provenance. */
export function captureMomentumRewardTemplate(challenge:RecoveryChallenge):MomentumRewardTemplateBinding|null {
 return MOMENTUM_RESET_TEMPLATES.includes(challenge)?currentMomentumRewardTemplate(challenge):null;
}
export function matchesMomentumRewardTemplate(challenge:RecoveryChallenge,binding:MomentumRewardTemplateBinding|null|undefined):boolean {
 const current=currentMomentumRewardTemplate(challenge);
 return Boolean(current && binding && current.templateId===binding.templateId && current.templateVersion===binding.templateVersion && current.category===binding.category && current.fingerprint===binding.fingerprint);
}
