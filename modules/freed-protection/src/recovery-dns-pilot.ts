import { parseDeviceAdultOperation, type DeviceAdultOperation, type DeviceAdultError } from './device-adult';

export type RecoveryDnsPilotInput = { rawSecret: string; credentialHash: string; audience: string; ownerGeneration: string; installationId: string; actionScope: string };
export type RecoveryDnsPilotReceipt = {
  schema: 1; kind: 'candidate'|'status'|'routeCheck'|'error'; supported: boolean; staged: boolean;
  reference: string|null; credentialHash: string|null; audience: string|null; ownerGeneration: string|null;
  nativeConfigurationGeneration: string|number|null; profileHash: string|null;
  profileSaved: boolean; systemEnabled: boolean; routeVerified: boolean; denyVerified: boolean;
  modeActivationSupported: boolean; hostedModeRetained: boolean; modeActive: boolean; browserRecoveryVerified: false;
  reason: string; accepted: boolean; networkEpoch: string|null; activeProvider: string|null;
};
export type RecoveryDnsPilotNative = {
  stageRecoveryDnsPilot?(input: RecoveryDnsPilotInput): Promise<unknown>;
  getRecoveryDnsPilotStatus?(scope: string): Promise<unknown>;
  checkRecoveryDnsPilot?(reference: string, scope: string): Promise<unknown>;
  prepareRecoveryDnsReplacement?(reference: string, scope: string): Promise<unknown>;
  prepareRecoveryDnsModeActivation?(reference: string, scope: string): Promise<unknown>;
};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const audience=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const reference=(v:unknown):v is string=>audience(v)||uuid(v);
const generation=(v:unknown):v is string|number=>uuid(v)||typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const reason=(v:unknown)=>typeof v==='string'&&/^(recovery-dns-|pilot-)[a-z0-9-]{1,100}$/.test(v)?v:'recovery-dns-unavailable';
export const unavailableRecoveryDns=(code='recovery-dns-unavailable'):RecoveryDnsPilotReceipt=>({schema:1,kind:'error',supported:false,staged:false,reference:null,credentialHash:null,audience:null,ownerGeneration:null,nativeConfigurationGeneration:null,profileHash:null,profileSaved:false,systemEnabled:false,routeVerified:false,denyVerified:false,modeActivationSupported:false,hostedModeRetained:false,modeActive:false,browserRecoveryVerified:false,reason:code,accepted:false,networkEpoch:null,activeProvider:null});
export function parseRecoveryDnsPilotReceipt(raw:unknown):RecoveryDnsPilotReceipt {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return unavailableRecoveryDns();
  const v=raw as Record<string,unknown>;
  const nested = v.kind === 'status' && v.candidate && typeof v.candidate === 'object' && !Array.isArray(v.candidate) ? parseRecoveryDnsPilotReceipt(v.candidate) : null;
  const identity: Record<string,unknown> = nested?.kind === 'candidate' && nested.supported && nested.staged ? nested : v;
  if(v.schema!==1||!['candidate','status','routeCheck','error'].includes(String(v.kind)))return unavailableRecoveryDns();
  if(v.kind==='status' && (typeof v.supported !== 'boolean' || typeof v.staged !== 'boolean' || typeof v.modeActivationSupported !== 'boolean'))return unavailableRecoveryDns('recovery-dns-malformed-receipt');
  if(v.kind==='error')return unavailableRecoveryDns(reason(v.code??v.reason));
  if(v.kind==='candidate'&&(!reference(v.reference)||!hash(v.credentialHash)||!audience(v.audience)||!uuid(v.ownerGeneration)||!generation(v.nativeConfigurationGeneration)||v.staged!==true||v.supported!==true))return unavailableRecoveryDns('recovery-dns-malformed-receipt');
  // Deliberately copy only presentation fields. No raw URL/secret, owner ID or
  // native authority can escape in diagnostics, storage, or downstream props.
  return {schema:1,kind:v.kind as RecoveryDnsPilotReceipt['kind'],supported:v.supported===true||v.kind==='routeCheck',staged:v.staged===true && (v.kind!=='status' || nested===null || nested.staged),reference:reference(identity.reference)?identity.reference:null,credentialHash:hash(identity.credentialHash)?identity.credentialHash:null,audience:audience(identity.audience)?identity.audience:null,ownerGeneration:uuid(identity.ownerGeneration)?identity.ownerGeneration:null,nativeConfigurationGeneration:generation(identity.nativeConfigurationGeneration)?identity.nativeConfigurationGeneration:null,profileHash:hash(identity.profileHash)?identity.profileHash:null,profileSaved:v.profileSaved===true,systemEnabled:v.systemEnabled===true,routeVerified:v.routeVerified===true,denyVerified:v.denyVerified===true,modeActivationSupported:v.modeActivationSupported===true,hostedModeRetained:v.hostedModeRetained===true,modeActive:v.modeActive===true&&v.systemEnabled===true&&v.profileSaved===true,browserRecoveryVerified:false,reason:reason(v.reason??v.code),accepted:v.accepted===true,networkEpoch:typeof v.networkEpoch==='string'&&/^[a-zA-Z0-9:-]{1,96}$/.test(v.networkEpoch)?v.networkEpoch:null,activeProvider:['cloudflare-families','freed-recovery-pilot'].includes(String(v.activeProvider))?String(v.activeProvider):null};
}
export function createRecoveryDnsPilotAdapter(native:()=>RecoveryDnsPilotNative|null,isCurrent:(scope:string)=>boolean,timeoutMs=12000){
  async function call(scope:string,work:(module:RecoveryDnsPilotNative)=>Promise<unknown>|undefined){
    if(!scope||!isCurrent(scope))return null;let timer:ReturnType<typeof setTimeout>|undefined;
    try{const module=native();if(!module)return null;const pending=work(module);if(!pending)return null;const result=await Promise.race([pending,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);})]);return isCurrent(scope)?result:null;}catch{return null;}finally{if(timer)clearTimeout(timer);}
  }
  return {
    async stage(input:RecoveryDnsPilotInput){
      if(!input||Object.keys(input).sort().join(',')!=='actionScope,audience,credentialHash,installationId,ownerGeneration,rawSecret'||!hash(input.rawSecret)||!hash(input.credentialHash)||!audience(input.audience)||!uuid(input.ownerGeneration)||!/^[cdef][A-Za-z0-9_-]{21}$/.test(input.installationId))return unavailableRecoveryDns('recovery-dns-invalid-input');
      return parseRecoveryDnsPilotReceipt(await call(input.actionScope,module=>module.stageRecoveryDnsPilot?.({...input})));
    },
    async status(scope:string){if(scope && isCurrent(scope) && native() && typeof native()?.getRecoveryDnsPilotStatus !== 'function')return unavailableRecoveryDns('recovery-dns-native-method-unavailable');return parseRecoveryDnsPilotReceipt(await call(scope,module=>module.getRecoveryDnsPilotStatus?.(scope)));},
    async check(ref:string,scope:string){return reference(ref)?parseRecoveryDnsPilotReceipt(await call(scope,module=>module.checkRecoveryDnsPilot?.(ref,scope))):unavailableRecoveryDns('recovery-dns-invalid-input');},
    async prepareReplacement(ref:string,scope:string):Promise<DeviceAdultOperation|DeviceAdultError>{if(!reference(ref))return{schema:1,kind:'error',code:'invalidInput'};return parseDeviceAdultOperation(await call(scope,module=>module.prepareRecoveryDnsReplacement?.(ref,scope)));},
    async prepareMode(ref:string,scope:string):Promise<DeviceAdultOperation|DeviceAdultError>{if(!reference(ref))return{schema:1,kind:'error',code:'invalidInput'};return parseDeviceAdultOperation(await call(scope,module=>module.prepareRecoveryDnsModeActivation?.(ref,scope)));}
  };
}
