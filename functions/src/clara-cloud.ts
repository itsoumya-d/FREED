/** CLARA is the only cloud AI surface. Recovery/protection aggregates are not accepted. */
export const CLARA_CONSENT_VERSION='clara-cloud-v1';
export const CLARA_MODEL='gemini-3.5-flash-lite';
export const CLARA_MONTHLY_LIMIT_CENTS=2500;
export const CLARA_RESERVATION_CENTS=2;
// Recheck provider prices before extending the internal rollout. Failed-call reservations are never refunded.
export const CLARA_PRICE_REVIEW_EXPIRES=Date.parse('2026-11-05T00:00:00Z');
export const CLARA_LOCALES=['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'] as const;
export type ClaraCloudRequest={clientEventId:string;consentVersion:typeof CLARA_CONSENT_VERSION;locale:typeof CLARA_LOCALES[number];input:string;conversation:Array<{role:'user'|'model';text:string}>};
export type ClaraAction='breathe'|'journal'|'routine'|'none';
export type ClaraReservation={status:'allowed'|'daily-quota-exhausted'|'budget-exhausted'|'duplicate'|'account-deleting'|'rate-limited';remaining:number;limit:number;resetsAt?:string};
export type ClaraServiceState='online'|'unavailable'|'basic-help'|Exclude<ClaraReservation['status'],'allowed'>;
export type ClaraCloudResponse={text:string;provider:'remote'|'fallback';serviceState:ClaraServiceState;action:ClaraAction;quota:{remaining:number|null;limit:number|null;resetsAt:string|null}};
export class ClaraCloudInputError extends Error {}

function record(value:unknown):value is Record<string,unknown>{return typeof value==='object' && value!==null && !Array.isArray(value);}
function exact(value:unknown,keys:string[]):value is Record<string,unknown>{return record(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));}
export function parseClaraCloudRequest(value:unknown):ClaraCloudRequest {
 if(!exact(value,['clientEventId','consentVersion','locale','input','conversation']) ||
  typeof value.clientEventId!=='string'||!/^clara_[a-f0-9]{32}$/.test(value.clientEventId)||value.consentVersion!==CLARA_CONSENT_VERSION||
  !CLARA_LOCALES.includes(value.locale as any)||typeof value.input!=='string'||!value.input.trim()||value.input.length>1200||
  !Array.isArray(value.conversation)||value.conversation.length>6||Buffer.byteLength(JSON.stringify(value),'utf8')>12000)throw new ClaraCloudInputError('Invalid chat request.');
 const conversation=value.conversation.map(item=>{
  if(!exact(item,['role','text'])||!['user','model'].includes(String(item.role))||typeof item.text!=='string'||!item.text.trim()||item.text.length>1200)throw new ClaraCloudInputError('Invalid conversation.');
  return{role:item.role as 'user'|'model',text:item.text};
 });
 return{clientEventId:value.clientEventId,consentVersion:CLARA_CONSENT_VERSION,locale:value.locale as ClaraCloudRequest['locale'],input:value.input,conversation};
}

export type ClaraBudgetControl={month:string;reservedCents:number;version:1};
export function reserveClaraBudget(value:unknown,now:number):{allowed:boolean;next?:ClaraBudgetControl} {
 if(!Number.isFinite(now)||now>=CLARA_PRICE_REVIEW_EXPIRES)return{allowed:false};
 const month=new Date(now).toISOString().slice(0,7);let spent=0;
 if(value!==undefined){
  if(!exact(value,['month','reservedCents','version'])||value.version!==1||typeof value.month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)||value.month>month||
    typeof value.reservedCents!=='number'||!Number.isSafeInteger(value.reservedCents)||value.reservedCents<0||value.reservedCents>CLARA_MONTHLY_LIMIT_CENTS)return{allowed:false};
  if(value.month===month)spent=value.reservedCents;
 }
 if(spent+CLARA_RESERVATION_CENTS>CLARA_MONTHLY_LIMIT_CENTS)return{allowed:false};
 return{allowed:true,next:{month,reservedCents:spent+CLARA_RESERVATION_CENTS,version:1}};
}

export function createClaraCloudService(deps:{enabled:()=>Promise<boolean>;reserve:(uid:string,eventId:string)=>Promise<ClaraReservation>;reply:(input:ClaraCloudRequest)=>Promise<{text:string;action:ClaraAction}>}) {
 return{async reply(uid:string,value:unknown):Promise<ClaraCloudResponse>{
  const input=parseClaraCloudRequest(value);
  const fallback=(state:ClaraServiceState,quota?:ClaraReservation):ClaraCloudResponse=>({text:'',provider:'fallback',serviceState:state,action:'none',quota:{remaining:quota?.remaining??null,limit:quota?.limit??null,resetsAt:quota?.resetsAt??null}});
  if(/\b(?:kill myself|end my life|suicide|suicidal|hurt myself|self[- ]harm|want to die|can't stay safe|cannot stay safe)\b/i.test(input.input))return fallback('basic-help');
  let enabled=false;try{enabled=await deps.enabled();}catch{return fallback('unavailable');}
  if(!enabled)return fallback('unavailable');
  let reservation:ClaraReservation;try{reservation=await deps.reserve(uid,input.clientEventId);}catch{return fallback('unavailable');}
  if(reservation.status!=='allowed')return fallback(reservation.status,reservation);
  try{
   const reply=await deps.reply(input);
   if(typeof reply.text!=='string'||!reply.text.trim()||reply.text.length>1200||!['breathe','journal','routine','none'].includes(reply.action))return fallback('unavailable',reservation);
   return{text:reply.text,provider:'remote',serviceState:'online',action:reply.action,quota:{remaining:reservation.remaining,limit:reservation.limit,resetsAt:reservation.resetsAt??null}};
  }catch{return fallback('unavailable',reservation);}
 }};
}
