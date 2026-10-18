import type { AppGroup, AppGroupsSnapshot, WritableAppGroupRule } from './app-groups-contract';
import { validateAppGroupRule } from './protection-groups';
import { isEarnedAppTimeCapMinutes, isEarnedAppTimeSeconds, type EarnedAppTimeCapMinutes, type EarnedAppTimeSeconds } from '../../modules/freed-protection/src/earned-app-time';
export type AppGroupDraft={name:string;enabled:boolean;rule:WritableAppGroupRule;packages:string[];adoptLegacy?:boolean;preferredBreakSeconds?:EarnedAppTimeSeconds;preferredBreakBaseSeconds?:EarnedAppTimeSeconds;extraTimeCapMinutes?:EarnedAppTimeCapMinutes;extraTimeBudgetRevision?:number;extraTimeCapBaseMinutes?:EarnedAppTimeCapMinutes};
export function appGroupDraftKey(snapshot:AppGroupsSnapshot,group:AppGroup){return `freed.app-group.draft.v1.${snapshot.configurationGeneration}.${snapshot.scopeEpoch}.${group.id}.${group.revision}`;}
export function draftFromGroup(group:AppGroup):AppGroupDraft{return{name:group.name,enabled:group.enabled,rule:group.rule.kind==='legacy'?{kind:'daily-limit',limitMinutes:30}:group.rule,packages:[...group.packages],...(group.preferredBreakSeconds!==undefined?{preferredBreakSeconds:group.preferredBreakSeconds,preferredBreakBaseSeconds:group.preferredBreakSeconds}:{}),...(group.extraTimeBudget?{extraTimeCapMinutes:group.extraTimeBudget.configuredCapMinutes,extraTimeBudgetRevision:group.extraTimeBudget.revision,extraTimeCapBaseMinutes:group.extraTimeBudget.configuredCapMinutes}:{}),...(group.rule.kind==='legacy'?{adoptLegacy:false}:{})};}
export function reconcileAppGroupPreferredDraft(draft:AppGroupDraft,group:AppGroup):{draft:AppGroupDraft;conflict:boolean}{
 const current=group.preferredBreakSeconds??300,choice=draft.preferredBreakSeconds,base=draft.preferredBreakBaseSeconds;
 if(choice===undefined)return{draft:group.preferredBreakSeconds===undefined?draft:{...draft,preferredBreakSeconds:current,preferredBreakBaseSeconds:current},conflict:false};
 if(choice===current||base!==undefined&&choice===base)return{draft:{...draft,preferredBreakSeconds:current,preferredBreakBaseSeconds:current},conflict:false};
 if(base===undefined||base===current)return{draft:{...draft,preferredBreakBaseSeconds:current},conflict:false};
 return{draft,conflict:true};
}
/** Spending and day changes are not preference edits. Rebase those revisions;
 * require an explicit choice only when both the native cap and draft cap changed. */
export function reconcileAppGroupBudgetDraft(draft:AppGroupDraft,group:AppGroup):{draft:AppGroupDraft;conflict:boolean}{
 if(!group.extraTimeBudget&&draft.extraTimeCapMinutes===undefined)return{draft,conflict:false};
 const cap=group.extraTimeBudget?.configuredCapMinutes??20,revision=group.extraTimeBudget?.revision??0;
 const choice=draft.extraTimeCapMinutes,base=draft.extraTimeCapBaseMinutes;
 const set=(value:EarnedAppTimeCapMinutes)=>({...draft,extraTimeCapMinutes:value,extraTimeCapBaseMinutes:cap,extraTimeBudgetRevision:revision});
 if(choice===undefined||choice===cap||base!==undefined&&choice===base)return{draft:set(cap),conflict:false};
 if(base===cap||draft.extraTimeBudgetRevision===revision)return{draft:set(choice),conflict:false};
 return{draft,conflict:true};
}
export function restoreAppGroupDraft(value:string|null,group:AppGroup,platform:'ios'|'android'):AppGroupDraft {
 try{
  const draft=JSON.parse(value??'null');const rule=validateAppGroupRule(draft?.rule,draft?.enabled,platform);
  if(draft&&(draft.preferredBreakSeconds!==undefined&&!isEarnedAppTimeSeconds(draft.preferredBreakSeconds)||draft.preferredBreakBaseSeconds!==undefined&&!isEarnedAppTimeSeconds(draft.preferredBreakBaseSeconds)))return draftFromGroup(group);
  if(draft&&('extraTimeCapMinutes' in draft||'extraTimeBudgetRevision' in draft)&&(!isEarnedAppTimeCapMinutes(draft.extraTimeCapMinutes)||!Number.isSafeInteger(draft.extraTimeBudgetRevision)||draft.extraTimeBudgetRevision<0||draft.extraTimeCapBaseMinutes!==undefined&&!isEarnedAppTimeCapMinutes(draft.extraTimeCapBaseMinutes)))return draftFromGroup(group);
  if(rule&&typeof draft?.name==='string'&&draft.name.length<=80&&typeof draft.enabled==='boolean'&&Array.isArray(draft.packages)&&draft.packages.length<=200&&draft.packages.every((p:unknown)=>typeof p==='string'&&/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(p))&&new Set(draft.packages).size===draft.packages.length&&(platform!=='ios'||draft.packages.length===0)){
   const restored={name:draft.name,enabled:draft.enabled,rule,packages:draft.packages,...(isEarnedAppTimeSeconds(draft.preferredBreakSeconds)?{preferredBreakSeconds:draft.preferredBreakSeconds,...(isEarnedAppTimeSeconds(draft.preferredBreakBaseSeconds)?{preferredBreakBaseSeconds:draft.preferredBreakBaseSeconds}:{})}:{}),...(isEarnedAppTimeCapMinutes(draft.extraTimeCapMinutes)?{extraTimeCapMinutes:draft.extraTimeCapMinutes,extraTimeBudgetRevision:draft.extraTimeBudgetRevision,...(isEarnedAppTimeCapMinutes(draft.extraTimeCapBaseMinutes)?{extraTimeCapBaseMinutes:draft.extraTimeCapBaseMinutes}:{})}:{}),...(group.rule.kind==='legacy'?{adoptLegacy:draft.adoptLegacy===true}:{})};
   return reconcileAppGroupPreferredDraft(reconcileAppGroupBudgetDraft(restored,group).draft,group).draft;
  }
 }catch{}
 return draftFromGroup(group);
}
