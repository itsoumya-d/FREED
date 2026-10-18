import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import type { AppGroupUpdateRequest, WritableAppGroupRule } from './app-groups-contract';
import { normalizeEncryptedDnsStatus } from './encrypted-dns';
import { isEarnedAppTimeSeconds, validateEarnedAppTimeBudget } from '../../modules/freed-protection/src/earned-app-time';

export function newAppGroupDraft(name: string) {
 return {name,enabled:false,rule:{kind:'daily-limit' as const,limitMinutes:30},packages:[] as string[]};
}
const integer=(n:unknown,min:number,max:number):n is number=>typeof n==='number' && Number.isInteger(n) && n>=min && n<=max;
export function validateAppGroupRule(value:unknown,enabled:boolean,platform:'ios'|'android'):WritableAppGroupRule|null {
 if(!value || typeof value!=='object')return null;const r=value as Record<string,unknown>;
 if(r.kind==='before-use' && Object.keys(r).length===1)return{kind:'before-use'};
 if(r.kind==='daily-limit' && Object.keys(r).length===2 && integer(r.limitMinutes,5,240))return{kind:'daily-limit',limitMinutes:r.limitMinutes};
 if(r.kind==='scheduled' && Object.keys(r).length===4 && integer(r.startMinute,0,1439) && integer(r.endMinute,0,1439) && Array.isArray(r.days) && r.days.length<=7 && r.days.every(d=>integer(d,0,6)) && new Set(r.days).size===r.days.length){
  if(enabled && (!r.days.length || (r.endMinute-r.startMinute+1440)%1440<(platform==='ios'?15:1)))return null;
  return{kind:'scheduled',startMinute:r.startMinute,endMinute:r.endMinute,days:[...r.days]};
 }return null;
}
export function validateAppGroupUpdate(value:unknown,platform:'ios'|'android'):AppGroupUpdateRequest|null {
 if(!value || typeof value!=='object')return null;const v=value as Record<string,unknown>;
 if(v.version!==1 || !integer(v.expectedStoreRevision,0,Number.MAX_SAFE_INTEGER) || !integer(v.expectedRevision,1,Number.MAX_SAFE_INTEGER) || typeof v.id!=='string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v.id) || typeof v.name!=='string' || v.name.trim().length>80 || typeof v.enabled!=='boolean' || !Array.isArray(v.packages) || v.packages.length>200 || !v.packages.every(p=>typeof p==='string' && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(p)) || new Set(v.packages).size!==v.packages.length || platform==='ios' && v.packages.length>0)return null;
 const rule=validateAppGroupRule(v.rule,v.enabled,platform);if(!rule)return null;
 // iOS selection authority is native; a client cannot enable an empty local draft.
 if(v.enabled && platform==='android' && v.packages.length===0)return null;
 return{version:1,expectedStoreRevision:v.expectedStoreRevision,id:v.id,expectedRevision:v.expectedRevision,name:v.name.trim(),enabled:v.enabled,rule,packages:[...v.packages]};
}
export function describeAdultProtectionConfiguration(capability:Partial<ProtectionCapability>|null,status:Partial<ProtectionStatus>|null,dnsValue:unknown) {
 const dns=normalizeEncryptedDnsStatus(dnsValue);
 const appleSupported=capability?.platform==='ios' && capability.screenTime===true && capability.managedSettings===true;
 const appleConfigured=appleSupported && status?.authorized===true && status.adultFilterActive===true && status.adultWebPolicyConfigured!==false;
 const dnsSupported=dns.supported && dns.releaseEnabled;
 const dnsSelected=dnsSupported && dns.configured && dns.enabled;
 const nativeAndroidConfigured=capability?.platform==='android' && status?.adultFilterActive===true && status.dnsGuardCoverageReady===true;
 const configured=appleConfigured || dnsSelected || nativeAndroidConfigured;
 const attention=dnsSelected && dns.healthy===false || configured && appleSupported && !appleConfigured;
 return{status:attention?'Needs attention':configured?'On':appleSupported || dnsSupported || capability?.platform==='android'?'Off':'Unavailable',appleConfigured,dnsSelected,configured,browsingVerified:false as const};
}

/** Native readback is untrusted at the bridge, including older/incomplete binaries. */
export function validateAppGroupsSnapshot(value:unknown):import('./app-groups-contract').AppGroupsSnapshot|null {
 if(!value||typeof value!=='object')return null;const v=value as Record<string,any>;
 const count=(n:unknown)=>integer(n,0,Number.MAX_SAFE_INTEGER),boolean=(n:unknown)=>typeof n==='boolean';
 const monitorCapacity=v.platform==='android'?6:20;
 if(v.version!==1||!boolean(v.supported)||!['ios','android','unsupported'].includes(v.platform)||!count(v.revision)||!count(v.configurationGeneration)||!count(v.scopeEpoch)||!Array.isArray(v.groups)||v.groups.length>6||v.maxGroups!==6||v.reason!==null&&typeof v.reason!=='string'||!v.permissions||![v.permissions.authorized,v.permissions.usageAccess,v.permissions.runtimeConnected].every(boolean)||!v.monitorBudget||!integer(v.monitorBudget.used,0,monitorCapacity)||v.monitorBudget.limit!==monitorCapacity||!v.legacyCompatibility||!boolean(v.legacyCompatibility.retained)||![v.legacyCompatibility.applicationCount,v.legacyCompatibility.categoryCount,v.legacyCompatibility.webDomainCount].every(count)||v.configuredGroupCount!==undefined&&!integer(v.configuredGroupCount,0,6))return null;
 const ids=new Set<string>();
 if(v.supportedBreakSeconds!==undefined&&(!Array.isArray(v.supportedBreakSeconds)||v.supportedBreakSeconds.length>3||v.supported&&!v.supportedBreakSeconds.length||!v.supportedBreakSeconds.every(isEarnedAppTimeSeconds)||new Set(v.supportedBreakSeconds).size!==v.supportedBreakSeconds.length))return null;
 const supportedBreakSeconds=v.supportedBreakSeconds??[300,600];
 for(const g of v.groups){
  if(!g||typeof g!=='object'||typeof g.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(g.id)||ids.has(g.id)||!integer(g.revision,1,Number.MAX_SAFE_INTEGER)||typeof g.name!=='string'||g.name.length>160||![g.enabled,g.legacy,g.configured,g.ready,g.active,g.thresholdReached].every(boolean)||!Array.isArray(g.packages)||!Array.isArray(g.unavailablePackages)||![...g.packages,...g.unavailablePackages].every(p=>typeof p==='string'&&/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(p))||g.packages.length>200||new Set(g.packages).size!==g.packages.length||v.platform==='ios'&&g.packages.length!==0||![g.applicationCount,g.categoryCount,g.webDomainCount].every(count)||g.draftApplicationCount!=null&&!count(g.draftApplicationCount)||g.usageMinutes!==null&&!count(g.usageMinutes)||g.nextBoundaryAt!==null&&(typeof g.nextBoundaryAt!=='string'||!Number.isFinite(Date.parse(g.nextBoundaryAt))))return null;
  ids.add(g.id);
  if(g.extraTimeBudget!==undefined&&!validateEarnedAppTimeBudget(g.extraTimeBudget))return null;
  if(g.preferredBreakSeconds!==undefined&&(!isEarnedAppTimeSeconds(g.preferredBreakSeconds)||!supportedBreakSeconds.includes(g.preferredBreakSeconds)))return null;
  if(g.rule?.kind==='legacy'){if(!g.legacy||g.id!=='legacy-default')return null;}else if(!validateAppGroupRule(g.rule,g.enabled,v.platform==='ios'?'ios':'android'))return null;
  if(g.break!==null&&(!g.break||typeof g.break.interventionId!=='string'||typeof g.break.expiresAt!=='string'||!Number.isFinite(Date.parse(g.break.expiresAt))||!boolean(g.break.effective)||!count(g.break.remainingRestrictionCount)))return null;
 }
 return v as import('./app-groups-contract').AppGroupsSnapshot;
}
/** Copy an allowlist only: native error descriptions can contain private app data. */
export function validateAppGroupActionDiagnostics(value:unknown):import('./app-groups-contract').AppGroupActionDiagnostics|null {
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>;
 const stages=['unavailable','owner-binding','app-group-container','lock-open','lock-acquire','execution-assertion','nested-transaction','state-read','state-commit','request-validation','clock-validation','monitor-registration','monitor-readback','policy-readback','bridge-validation','bridge-readback','native-operation','complete'];
 if(v.version!==1||!['create','update','update-earned','remove','picker'].includes(v.operation as string)||typeof v.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.operationId)||!stages.includes(v.stage as string))return null;
 const count=(n:unknown)=>integer(n,0,Number.MAX_SAFE_INTEGER)?n:null;
 const reason=typeof v.reason==='string'&&/^[a-z][a-z0-9-]{0,127}$/.test(v.reason)?v.reason:null;
 const errorDomain=typeof v.errorDomain==='string'&&/^(?:NS|NE|Freed|DeviceActivity)[A-Za-z0-9_.-]{0,120}$/.test(v.errorDomain)?v.errorDomain:null;
 const clock:Record<string,boolean|string|number|null>={};
 for(const key of ['clockBootAvailable','clockWallValid','clockUptimeValid','clockCalendarValid'])if(typeof v[key]==='boolean')clock[key]=v[key] as boolean;
 const enums={clockBootSource:['kernel-uuid','kernel-boottime','unavailable','injected'],clockBootStage:['uuid-size','uuid-read','uuid-value','boottime-read','boottime-size','boottime-value','complete','unsupported','injected'],clockPrimaryStage:['uuid-size','uuid-read','uuid-value','complete','injected'],clockBudgetPhase:['bootstrap','rollover']};
 for(const [key,values] of Object.entries(enums))if(typeof v[key]==='string'&&values.includes(v[key] as string))clock[key]=v[key] as string;
 for(const key of ['clockBootErrno','clockPrimaryErrno'])if(v[key]===null||integer(v[key],0,2147483647))clock[key]=v[key] as number|null;
 const fact=(key:'protectedDataAvailable'|'containerAvailable')=>typeof v[key]==='boolean'||v[key]===null?{[key]:v[key] as boolean|null}:{};
 return {version:1,operation:v.operation as import('./app-groups-contract').AppGroupActionDiagnostics['operation'],operationId:v.operationId,stage:v.stage as import('./app-groups-contract').AppGroupActionDiagnostics['stage'],reason,configurationGeneration:count(v.configurationGeneration),storeRevision:count(v.storeRevision),groupRevision:count(v.groupRevision),errorCode:typeof v.errorCode==='number'&&Number.isSafeInteger(v.errorCode)?v.errorCode:null,errorDomain,...fact('protectedDataAvailable'),...fact('containerAvailable'),...clock} as import('./app-groups-contract').AppGroupActionDiagnostics;
}
export function validateAppGroupReceipt(value:unknown):import('./app-groups-contract').AppGroupReceipt|null {
 if(!value||typeof value!=='object')return null;const v=value as Record<string,unknown>,snapshot=validateAppGroupsSnapshot(v.snapshot);
 if(typeof v.accepted!=='boolean'||v.reason!==null&&typeof v.reason!=='string'||v.cancelled!==undefined&&typeof v.cancelled!=='boolean'||!snapshot||v.accepted&&(!snapshot.supported||v.reason!==null||v.cancelled===true))return null;
 const diagnostics=validateAppGroupActionDiagnostics(v.diagnostics);
 return{accepted:v.accepted,reason:v.reason as string|null,...(typeof v.cancelled==='boolean'?{cancelled:v.cancelled}:{}),snapshot,...(diagnostics?{diagnostics}:{})};
}
export function isAppGroupMutationConfirmed(method:'createAppGroup'|'updateAppGroup'|'removeAppGroup'|'presentAppGroupPicker',request:import('./app-groups-contract').AppGroupCreateRequest|import('./app-groups-contract').AppGroupUpdateRequest|import('./app-groups-contract').AppGroupTargetRequest,receipt:import('./app-groups-contract').AppGroupReceipt):boolean {
 if(!receipt.accepted)return true;
 const s=receipt.snapshot;if(s.reason!==null||s.revision<=request.expectedStoreRevision)return false;
 if(method==='createAppGroup')return s.groups.some(g=>g.configured&&g.revision===1&&g.name===(request as import('./app-groups-contract').AppGroupCreateRequest).name&&!g.enabled&&g.rule.kind==='daily-limit'&&g.rule.limitMinutes===30&&g.applicationCount===0);
 const target=request as import('./app-groups-contract').AppGroupTargetRequest,g=s.groups.find(g=>g.id===target.id);
 if(method==='removeAppGroup')return !g;
 if(method==='presentAppGroupPicker')return !!g&&g.revision===target.expectedRevision&&typeof g.draftApplicationCount==='number'&&g.draftApplicationCount>=0;
 const update=request as AppGroupUpdateRequest;if(!g||!g.configured||g.revision<=update.expectedRevision||g.name!==update.name||g.enabled!==update.enabled||g.enabled&&!g.ready||g.rule.kind!==update.rule.kind||g.packages.length!==update.packages.length||!g.packages.every(p=>update.packages.includes(p)))return false;
 if(update.rule.kind==='before-use')return true;
 if(update.rule.kind==='daily-limit')return g.rule.kind==='daily-limit'&&g.rule.limitMinutes===update.rule.limitMinutes;
 return g.rule.kind==='scheduled'&&g.rule.startMinute===update.rule.startMinute&&g.rule.endMinute===update.rule.endMinute&&g.rule.days.length===update.rule.days.length&&g.rule.days.every(day=>update.rule.kind==='scheduled'&&update.rule.days.includes(day));
}
