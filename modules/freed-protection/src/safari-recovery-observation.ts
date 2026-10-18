/** Device-only historical configuration facts; never an intervention or native grant. */
export type SafariObservationFacts = {bundleArtifactDigest:string;scopeDigest:string;staticRules:'not-configured'|'expected-enabled'|'missing'|'unexpected'|'unavailable'|'error';dynamicRules:'zero'|'nonzero'|'unavailable'|'error';sessionRules:'zero'|'nonzero'|'unavailable'|'error';grants:'complete'|'partial'|'missing'|'unknown';requiredScopeCount:number;coveredScopeCount:number|null;diagnostic:'none'|'package-read'|'package-mismatch'|'api-unavailable'|'api-error'|'check-timeout'};
export type SafariObservationReceipt = {version:1;revision:number;packageVariant:'short-form-v1'|'safe-recovery-probe-v1'|'adult-recovery-internal-v1';bundleArtifactDigest:string;scopeDigest:string;generation:number;nativeEpoch:number;presentationEpoch:number;receivedAt:string;expiresAt:string;facts:SafariObservationFacts;context:'profile-and-private-unqualified'};
export type SafariRecoveryObservation = {version:1;receipt:SafariObservationReceipt|null;freshness:'fresh'|'historical'|'absent';reason:'none'|'pending'|'expired'|'stale-config'|'stale-presentation'|'reset'|'clock'|'package-unavailable'|'storage-unavailable'|'malformed'|'native-disabled';enabled:{value:boolean|null;checkedAt:string|null;reason:'observed'|'unsupported-os'|'api-unavailable'|'api-error'|'timeout'|'stale-config'}};
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<9_007_199_254_740_991;
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const member=(v:unknown,values:string[])=>typeof v==='string'&&values.includes(v);
const date=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export function unavailableSafariRecoveryObservation():SafariRecoveryObservation{return {version:1,receipt:null,freshness:'absent',reason:'storage-unavailable',enabled:{value:null,checkedAt:null,reason:'api-unavailable'}};}
export function validateSafariRecoveryObservation(value:unknown):SafariRecoveryObservation|null {
 if(!record(value)||!exact(value,['version','receipt','freshness','reason','enabled'])||value.version!==1||!member(value.freshness,['fresh','historical','absent'])||!member(value.reason,['none','pending','expired','stale-config','stale-presentation','reset','clock','package-unavailable','storage-unavailable','malformed','native-disabled']))return null;
 const enabled=value.enabled;
 if(!record(enabled)||!exact(enabled,['value','checkedAt','reason'])||!(enabled.value===null||typeof enabled.value==='boolean')||!(enabled.checkedAt===null||date(enabled.checkedAt))||!member(enabled.reason,['observed','unsupported-os','api-unavailable','api-error','timeout','stale-config'])||(enabled.reason==='observed'&&(typeof enabled.value!=='boolean'||!date(enabled.checkedAt)))||(enabled.reason!=='observed'&&enabled.value!==null))return null;
 const receipt=value.receipt;
 if(receipt!==null){
  if(!record(receipt)||!exact(receipt,['version','revision','packageVariant','bundleArtifactDigest','scopeDigest','generation','nativeEpoch','presentationEpoch','receivedAt','expiresAt','facts','context'])||receipt.version!==1||!['revision','generation','nativeEpoch','presentationEpoch'].every(k=>integer(receipt[k]))||!member(receipt.packageVariant,['short-form-v1','safe-recovery-probe-v1','adult-recovery-internal-v1'])||!hex(receipt.bundleArtifactDigest)||!hex(receipt.scopeDigest)||!date(receipt.receivedAt)||!date(receipt.expiresAt)||Date.parse(receipt.expiresAt)-Date.parse(receipt.receivedAt)!==300000||receipt.context!=='profile-and-private-unqualified')return null;
  const f=receipt.facts;
  if(!record(f)||!exact(f,['bundleArtifactDigest','scopeDigest','staticRules','dynamicRules','sessionRules','grants','requiredScopeCount','coveredScopeCount','diagnostic'])||f.bundleArtifactDigest!==receipt.bundleArtifactDigest||f.scopeDigest!==receipt.scopeDigest||!integer(f.requiredScopeCount)||f.requiredScopeCount<1||f.requiredScopeCount>4012||!member(f.staticRules,['not-configured','expected-enabled','missing','unexpected','unavailable','error'])||!['dynamicRules','sessionRules'].every(k=>member(f[k],['zero','nonzero','unavailable','error']))||!member(f.grants,['complete','partial','missing','unknown'])||!member(f.diagnostic,['none','package-read','package-mismatch','api-unavailable','api-error','check-timeout']))return null;
  if(f.grants==='unknown'?f.coveredScopeCount!==null:!integer(f.coveredScopeCount)||f.coveredScopeCount>f.requiredScopeCount|| (f.grants==='complete'?f.coveredScopeCount!==f.requiredScopeCount:f.grants==='missing'?f.coveredScopeCount!==0:f.coveredScopeCount<=0||f.coveredScopeCount>=f.requiredScopeCount))return null;
  if(receipt.packageVariant==='short-form-v1'?f.staticRules==='expected-enabled':f.staticRules==='not-configured')return null;
 }
 if(value.freshness==='fresh'&&(receipt===null||value.reason!=='none'||enabled.value===false))return null;
 if(value.freshness==='absent'&&receipt!==null)return null;
 if(value.freshness==='historical'&&(receipt===null||value.reason==='none'))return null;
 return JSON.parse(JSON.stringify(value)) as SafariRecoveryObservation;
}
