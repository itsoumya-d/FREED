import type {SupportedLanguage} from './app-preferences';
import {redactCoachText,replyWithCoach,type CoachContext,type CoachResponse} from './ai-coach';

export const CLARA_CLOUD_CONSENT='clara-cloud-v1' as const;
export type ClaraCloudPayload={clientEventId:string;consentVersion:typeof CLARA_CLOUD_CONSENT;locale:SupportedLanguage;input:string;conversation:Array<{role:'user'|'model';text:string}>};
export type ClaraCloudState='online'|'unavailable'|'basic-help'|'daily-quota-exhausted'|'budget-exhausted'|'duplicate'|'account-deleting'|'rate-limited';
export type ClaraCloudResult={text:string;provider:'remote'|'fallback';serviceState:ClaraCloudState;action:'breathe'|'journal'|'routine'|'none';quota:{remaining:number|null;limit:number|null;resetsAt:string|null}};
export type ClaraConversationReply=CoachResponse&Partial<Omit<ClaraCloudResult,'provider'|'text'>>;
export type CloudChatConsent={version:typeof CLARA_CLOUD_CONSENT;enabled:boolean;includeConversation:boolean};
type Storage={getItem(key:string):string|null;setItem(key:string,value:string):void};
export type ClaraDispatchGuard={ownerUid:string;isCurrent:()=>boolean};
let transport:((payload:ClaraCloudPayload,guard:ClaraDispatchGuard)=>Promise<ClaraCloudResult>)|null=null;
export function configureClaraConversationTransport(next:typeof transport){transport=next;}
export function hasClaraConversationTransport(){return transport!==null;}

function consentKey(owner:string){if(!/^[A-Za-z0-9_-]{1,128}$/.test(owner))throw new Error('No connected owner.');return`freed.clara-consent.v1.${owner}`;}
export function readCloudChatConsent(storage:Storage,owner:string):CloudChatConsent {
 const off:CloudChatConsent={version:CLARA_CLOUD_CONSENT,enabled:false,includeConversation:false};
 try{const value=JSON.parse(storage.getItem(consentKey(owner))??'null');return value?.version===CLARA_CLOUD_CONSENT&&typeof value.enabled==='boolean'&&typeof value.includeConversation==='boolean'?{version:CLARA_CLOUD_CONSENT,enabled:value.enabled,includeConversation:value.includeConversation}:off;}catch{return off;}
}
export function saveCloudChatConsent(storage:Storage,owner:string,value:CloudChatConsent){storage.setItem(consentKey(owner),JSON.stringify(value));}

export function buildClaraCloudPayload(input:string,options:{eventId:string;locale:SupportedLanguage;consent:CloudChatConsent;messages:Array<{role:'user'|'ai';text:string}>}):ClaraCloudPayload {
 if(!options.consent.enabled||options.consent.version!==CLARA_CLOUD_CONSENT||!/^clara_[a-f0-9]{32}$/.test(options.eventId))throw new Error('Cloud chat is not authorized.');
 // Older local assistant replies may derive from Screen Time signals. Only deliberately shared user-authored messages leave the device.
 const messages=options.consent.includeConversation?options.messages.filter(message=>message.role==='user').slice(-6):[];
 return{clientEventId:options.eventId,consentVersion:CLARA_CLOUD_CONSENT,locale:options.locale,input:redactCoachText(input),conversation:messages.map(message=>({role:'user' as const,text:redactCoachText(message.text)})).filter(message=>!!message.text)};
}

export function parseClaraCloudResult(value:unknown):ClaraCloudResult {
 const item=value as ClaraCloudResult;
 const exact=(x:any,keys:string[])=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&Object.keys(x).every(k=>keys.includes(k));
 if(!exact(item,['text','provider','serviceState','action','quota'])||typeof item.text!=='string'||item.text.length>1200||!['remote','fallback'].includes(item.provider)||
  !['online','unavailable','basic-help','daily-quota-exhausted','budget-exhausted','duplicate','account-deleting','rate-limited'].includes(item.serviceState)||!['breathe','journal','routine','none'].includes(item.action)||
  !exact(item.quota,['remaining','limit','resetsAt'])||!(item.quota.limit===null||item.quota.limit===3||item.quota.limit===20)||
  !(item.quota.remaining===null||Number.isInteger(item.quota.remaining)&&item.quota.remaining>=0&&item.quota.remaining<=(item.quota.limit??0))||
  !(item.quota.resetsAt===null||typeof item.quota.resetsAt==='string'&&Number.isFinite(Date.parse(item.quota.resetsAt)))||
  (item.provider==='remote')!==(item.serviceState==='online')||(item.provider==='remote'&&!item.text.trim())||(item.provider==='fallback'&&(item.text!==''||item.action!=='none')))throw new Error('Invalid cloud-chat response.');
 return item;
}

export async function replyWithClaraConversation(input:string,context:CoachContext,options:{consent:CloudChatConsent;messages:Array<{role:'user'|'ai';text:string}>;eventId:()=>Promise<string>;guard:ClaraDispatchGuard}):Promise<ClaraConversationReply> {
 const local=()=>replyWithCoach(input,context,{mode:'local'});
 if(!options.consent.enabled||!transport||!options.guard.isCurrent())return{...await local(),serviceState:'unavailable'};
 try{
  const payload=buildClaraCloudPayload(input,{...options,eventId:await options.eventId(),locale:context.locale??'en'});
  if(!options.guard.isCurrent())throw new Error('Chat request was cancelled.');
  const result=parseClaraCloudResult(await transport(payload,options.guard));
  if(!options.guard.isCurrent())throw new Error('Chat owner changed.');
  if(result.provider==='remote')return{...result,status:'ok'};
  const fallback=await local();return{...fallback,...result,text:fallback.text,provider:'fallback',status:'fallback'};
 }catch{return{...await local(),provider:'fallback',status:'fallback',serviceState:'unavailable'};}
}
