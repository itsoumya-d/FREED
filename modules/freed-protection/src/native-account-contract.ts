/** Validated native acknowledgements. A native session proves runtime origin, never Firebase identity. */
export type NativeAccountBinding = Readonly<{version:2;accepted:true;bindingHandle:string;actionScope:string;generation:number;scopeEpoch:number;admissionRevision:number}>;
export type NativeAccountSessionDriver = {prepare:(owner:string,transition:string,sequence:number)=>Promise<unknown>;commit:(ticket:string)=>Promise<unknown>;retire:()=>void;prepareCleanup?:()=>Promise<NativeCleanupReceipt|null>};
export type NativeAccountAdmission = Readonly<NativeAccountBinding & {ownerUid:string;transition:string;sequence:number}>;
export type NativeCleanupReceipt = Readonly<{version:2;operationId:string;phase:string;completed:boolean;privateErased:boolean;runtimeComplete:boolean;executionAdmitted:boolean;retainedProtection:true}>;
export const nativeAccountUUID=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
export function validateNativeAccountPreparation(value:unknown):{ticket:string;admissionRevision:number|null}|null {
 const r=record(value);if(!r||!nativeAccountUUID(r.ticket)||r.accepted===false||r.version!==undefined&&r.version!==2||r.admissionRevision!==undefined&&!integer(r.admissionRevision)||r.admissionRevision===undefined&&!(r.version===2&&r.accepted===true))return null;
 // Android exact prepared-ticket replay historically omits revision; commit always validates it.
 return {ticket:r.ticket,admissionRevision:integer(r.admissionRevision)?r.admissionRevision:null};
}
export function validateNativeAccountBinding(value:unknown,owner:string,sequence:number,revision:number|null):NativeAccountBinding|null {
 const r=record(value);if(!r||r.version!==2||r.accepted!==true||!nativeAccountUUID(r.bindingHandle)||typeof r.actionScope!=='string'||!integer(r.generation)||!integer(r.scopeEpoch)||!integer(r.admissionRevision)||revision!==null&&revision!==r.admissionRevision)return null;
 try {const p=JSON.parse(r.actionScope);if(!Array.isArray(p)||p.length!==3||p[0]!==owner||p[1]!==sequence||p[2]!==r.bindingHandle)return null;}catch{return null;}
 return Object.freeze({version:2,accepted:true,bindingHandle:r.bindingHandle,actionScope:r.actionScope,generation:r.generation,scopeEpoch:r.scopeEpoch,admissionRevision:r.admissionRevision});
}
export function validateNativeCleanupReceipt(value:unknown,expectedId?:string):NativeCleanupReceipt|null {
 const r=record(value);if(!r||r.version!==2)return null;
 const id=r.operationID??r.operationId;if(!nativeAccountUUID(id)||expectedId!==undefined&&id!==expectedId||typeof r.phase!=='string'||typeof r.runtimeScrubComplete!=='boolean'||typeof r.privateCleanupAccepted!=='boolean')return null;
 if('operationID' in r){
  if(!['prepared','fenced','privateErased','runtimePending','completed','supersededRuntime'].includes(r.phase)||typeof r.executionAdmitted!=='boolean'||typeof r.privateStoreErased!=='boolean'||typeof r.coreInvalidationPending!=='boolean'||typeof r.nativeAuthorityRevoked!=='boolean'||typeof r.retainedPolicyState!=='string')return null;
  const completed=r.phase==='completed'&&r.privateStoreErased&&r.runtimeScrubComplete&&!r.coreInvalidationPending;
  if(r.phase==='completed'&&!completed)return null;
  return Object.freeze({version:2,operationId:id,phase:r.phase,completed,privateErased:r.privateStoreErased,runtimeComplete:r.runtimeScrubComplete,executionAdmitted:r.executionAdmitted,retainedProtection:true});
 }
 if(r.accepted!==true||r.adultPolicyRetained!==true||!['prepared','committed','fenced','privateErased','runtimePending','terminal','superseded'].includes(r.phase)||!['pending','complete','superseded'].includes(String(r.coreState))||!['pending','complete'].includes(String(r.processState)))return null;
 const completed=r.phase==='terminal'&&r.privateCleanupAccepted&&r.runtimeScrubComplete&&r.coreState==='complete'&&r.processState==='complete';
 if(r.phase==='terminal'&&!completed)return null;
 return Object.freeze({version:2,operationId:id,phase:r.phase,completed,privateErased:r.privateCleanupAccepted,runtimeComplete:r.runtimeScrubComplete,executionAdmitted:r.phase!=='prepared',retainedProtection:true});
}

export type NativeResourceCancellation={state:'cancelled'|'pending'|'notApplicable'|'unavailable';osDismissalConfirmed:false};
