/** Device authority only. Callers must keep PIN/key values in ephemeral presentation state. */
export const deviceAdultActions = ['continuousOff','dnsOff','adultOff','adultReset','dnsStop','encryptedDisable','encryptedClear','feed','exceptions','dnsReplace','recoveryModeActivate'] as const;
export type DeviceAdultAction = typeof deviceAdultActions[number];
export type DeviceAdultError = {schema:1;kind:'error';code:string};
export type DeviceAdultStatus = {schema:1;kind:'status';platform:'ios'|'android';bridgeAvailable:true;mutationAvailability:'unknown'|'unavailable';mutationReason:'baselineUnobserved'|'notEnrolled'|'protectedRecordUnavailable'|'operationStateUnavailable';credential:'notEnrolled'|'enrolled'|'missingEnrolled'|'corrupt'|'unavailable'|'unknown';enrollmentAvailable:boolean;enrollmentReason:'integrationDisabled'|'nativeReady'|'nativeReadinessUnavailable'|'alreadyEnrolled';actions:DeviceAdultAction[];pendingKnown:boolean;pendingOperationIDs:string[];observations:Record<string,'unknown'>};
export type DeviceAdultOperation = {schema:1;kind:'operation';operationID:string;action:DeviceAdultAction;phase:string;authorization:string;generation:string;lockRevision:string;authorizationGeneration:string;accepted:boolean|null;observation:'pending'|'settled'|'unknown';historicalReceipt:true;currentStatus:'unknown'|'readable';historicalResultStale:boolean|null;layers:Record<string,string>};
export type DeviceAdultEnrollment = {schema:1;kind:'enrollment';credential:'enrolled';keyPresentation:'required';lockRevision:string;recoveryKey:string};
export type DeviceAdultRotation = {schema:1;kind:'rotation';lockRevision:string;recoveryKey:string};
export type DeviceAdultPrepare = {action:DeviceAdultAction;domains?:string[];version?:string;checksum?:string;generatedAt?:string};
export type DeviceAdultNative = {deviceAdultBridge?:(command:string,request:Record<string,unknown>)=>Promise<unknown>};
const error=(code:string):DeviceAdultError=>({schema:1,kind:'error',code});
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const integer=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(v)&&Number.isSafeInteger(Number(v));
const phases=['prepared','authorized','claimReserved','claimed','dispatchReserved','outcomeRecorded','completed','cancelling','cancelled','superseded'];
const authStates=['awaitingSecret','authorized','inFlight','completed','cancelled'];
const layerNames=['dns','safari','risk','continuous','dns-intent','dns-runtime','encrypted-request','encrypted-clear','accessibility-adult','feed','exceptions','dns-profile','recovery-mode'];
const layerStates=['untouched','dispatchReserved','observedApplied','observedUnchanged','failed','uncertain'];
const codes=['invalidInput','unsupportedAction','integrationDisabled','unavailable','unknownOperation','busy','outcomeUnknown','cancelNotProven','staleConfiguration','invalidPIN','pinMismatch','invalidScope','baselineUnavailable','alreadyEnrolled','notEnrolled','missingEnrolled','corrupt','storageUnavailable','commitOutcomeUnknown','storageConflict','incorrectSecret','throttled','scopeMismatch','cancelled','authorizationCapacity','invalidTransition','cryptoUnavailable','authorizationRequired','operationInProgress','interruptedOperation','invalidReadback'];
function validate(v:unknown,kind:string,operationID?:string):DeviceAdultStatus|DeviceAdultOperation|DeviceAdultRotation|DeviceAdultEnrollment|DeviceAdultError {
 if(!record(v)||v.schema!==1)return error('malformedReceipt');
 if(v.kind==='error')return error(typeof v.code==='string'&&codes.includes(v.code)?v.code:'unavailable');
 if(v.kind!==kind)return error('malformedReceipt');
 if(kind==='status'){
  if(v.bridgeAvailable!==true||!['unknown','unavailable'].includes(String(v.mutationAvailability))||!['baselineUnobserved','notEnrolled','protectedRecordUnavailable','operationStateUnavailable'].includes(String(v.mutationReason)))return error('malformedReceipt');
  if((v.mutationAvailability==='unknown'&&(v.credential!=='enrolled'||v.mutationReason!=='baselineUnobserved'))||(v.credential!=='enrolled'&&(v.mutationAvailability!=='unavailable'||v.mutationReason!==(v.credential==='notEnrolled'?'notEnrolled':'protectedRecordUnavailable')))||(v.mutationAvailability==='unavailable'&&v.credential==='enrolled'&&v.mutationReason!=='operationStateUnavailable'))return error('malformedReceipt');
  if(!['ios','android'].includes(String(v.platform))||!['notEnrolled','enrolled','missingEnrolled','corrupt','unavailable','unknown'].includes(String(v.credential))||typeof v.enrollmentAvailable!=='boolean'||!['integrationDisabled','nativeReady','nativeReadinessUnavailable','alreadyEnrolled'].includes(String(v.enrollmentReason))||(v.enrollmentAvailable&&(v.enrollmentReason!=='nativeReady'||v.credential!=='notEnrolled'))||(!v.enrollmentAvailable&&v.enrollmentReason==='nativeReady')||(v.enrollmentReason==='alreadyEnrolled'&&v.credential!=='enrolled')||!Array.isArray(v.actions)||v.actions.some(a=>!deviceAdultActions.includes(a))||new Set(v.actions).size!==v.actions.length||typeof v.pendingKnown!=='boolean'||!Array.isArray(v.pendingOperationIDs)||v.pendingOperationIDs.length>32||v.pendingOperationIDs.some(a=>!id(a))||new Set(v.pendingOperationIDs).size!==v.pendingOperationIDs.length||(!v.pendingKnown&&v.pendingOperationIDs.length)||!record(v.observations)||Object.keys(v.observations).length>11||Object.entries(v.observations).some(([k,s])=>!layerNames.includes(k)||s!=='unknown'))return error('malformedReceipt');
  const allowed=v.platform==='ios'?['continuousOff','dnsOff','adultOff','adultReset']:['adultOff','dnsStop','encryptedDisable','encryptedClear','feed','exceptions','dns-profile','recovery-mode'];
  if(v.actions.some(a=>!allowed.includes(a)))return error('malformedReceipt');
  return {schema:1,kind:'status',platform:v.platform as DeviceAdultStatus['platform'],bridgeAvailable:true,mutationAvailability:v.mutationAvailability as DeviceAdultStatus['mutationAvailability'],mutationReason:v.mutationReason as DeviceAdultStatus['mutationReason'],credential:v.credential as DeviceAdultStatus['credential'],enrollmentAvailable:v.enrollmentAvailable,enrollmentReason:v.enrollmentReason as DeviceAdultStatus['enrollmentReason'],actions:[...v.actions],pendingKnown:v.pendingKnown,pendingOperationIDs:[...v.pendingOperationIDs],observations:Object.fromEntries(Object.keys(v.observations).map(k=>[k,'unknown']))};
 }
 if(kind==='enrollment'){
  if(v.credential!=='enrolled'||v.keyPresentation!=='required'||!integer(v.lockRevision)||Number(v.lockRevision)<1||typeof v.recoveryKey!=='string'||!/^[a-f0-9]{64}$/.test(v.recoveryKey))return error('malformedReceipt');
  return {schema:1,kind:'enrollment',credential:'enrolled',keyPresentation:'required',lockRevision:v.lockRevision,recoveryKey:v.recoveryKey};
 }
 if(kind==='rotation'){
  if(!integer(v.lockRevision)||Number(v.lockRevision)<1||typeof v.recoveryKey!=='string'||!/^[a-f0-9]{64}$/.test(v.recoveryKey))return error('malformedReceipt');
  return {schema:1,kind:'rotation',lockRevision:v.lockRevision,recoveryKey:v.recoveryKey};
 }
 if(!id(v.operationID)||(operationID&&v.operationID!==operationID)||!deviceAdultActions.includes(v.action as DeviceAdultAction)||!phases.includes(String(v.phase))||!authStates.includes(String(v.authorization))||!integer(v.generation)||!integer(v.lockRevision)||!integer(v.authorizationGeneration)||!(v.accepted===null||typeof v.accepted==='boolean')||!['pending','settled','unknown'].includes(String(v.observation))||v.historicalReceipt!==true||!['unknown','readable'].includes(String(v.currentStatus))||!(v.historicalResultStale===null||typeof v.historicalResultStale==='boolean')||!record(v.layers)||Object.keys(v.layers).length>layerNames.length||Object.entries(v.layers).some(([k,s])=>!layerNames.includes(k)||!layerStates.includes(String(s))))return error('malformedReceipt');
 const expectedAuthorization:Record<string,string>={prepared:'awaitingSecret',authorized:'authorized',claimReserved:'authorized',claimed:'inFlight',dispatchReserved:'inFlight',outcomeRecorded:'inFlight',completed:'completed',cancelled:'cancelled'};
 if(expectedAuthorization[String(v.phase)]&&v.authorization!==expectedAuthorization[String(v.phase)])return error('malformedReceipt');
 if((v.observation==='settled'&&v.phase!=='completed')||(v.accepted!==null&&v.phase!=='completed')||(v.phase==='completed'&&v.authorization!=='completed')||(v.accepted===true&&(v.observation!=='settled'||v.phase!=='completed'))||(v.currentStatus==='unknown'&&v.historicalResultStale!==null))return error('malformedReceipt');
 return {schema:1,kind:'operation',operationID:v.operationID,action:v.action as DeviceAdultAction,phase:v.phase as string,authorization:v.authorization as string,generation:v.generation,lockRevision:v.lockRevision,authorizationGeneration:v.authorizationGeneration,accepted:v.accepted as boolean|null,observation:v.observation as DeviceAdultOperation['observation'],historicalReceipt:true,currentStatus:v.currentStatus as DeviceAdultOperation['currentStatus'],historicalResultStale:v.historicalResultStale as boolean|null,layers:Object.fromEntries(Object.entries(v.layers).map(([k,s])=>[k,String(s)]))};
}
export function parseDeviceAdultOperation(value:unknown):DeviceAdultOperation|DeviceAdultError { return validate(value,'operation') as DeviceAdultOperation|DeviceAdultError; }
export function createDeviceAdultAdapter(native:()=>DeviceAdultNative|null, timeoutMs=10_000){
 async function call(command:string,request:Record<string,unknown>,kind:string,operationID?:string){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
   const module=native();if(typeof module?.deviceAdultBridge!=='function')return error('unavailable');
   const result=await Promise.race([module.deviceAdultBridge(command,request),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)})]);
   if(result===null)return error('outcomeUnknown');
   return validate(result,kind,operationID);
  }catch{return error('unavailable')}finally{if(timer)clearTimeout(timer)}
 }
 const operation=(command:string,operationID:string)=>id(operationID)?call(command,{operationID},'operation',operationID):Promise.resolve(error('invalidInput'));
 return {
  status:()=>call('status',{},'status') as Promise<DeviceAdultStatus|DeviceAdultError>,
  async enroll(request:{pin:string;confirmation:string}):Promise<DeviceAdultEnrollment|DeviceAdultError>{
   if(!request||Object.keys(request).sort().join(',')!=='confirmation,pin'||typeof request.pin!=='string'||typeof request.confirmation!=='string'||request.pin.length>64||request.confirmation.length>64)return error('invalidInput');
   if(!/^[0-9]{6}$/.test(request.pin)||!/^[0-9]{6}$/.test(request.confirmation))return error('invalidPIN');
   if(request.pin!==request.confirmation)return error('pinMismatch');
   const status=await call('status',{},'status');if(status.kind!=='status')return status as DeviceAdultError;
   if(!status.enrollmentAvailable)return error(status.enrollmentReason==='integrationDisabled'?'integrationDisabled':status.credential==='enrolled'?'alreadyEnrolled':'baselineUnavailable');
   return call('enroll',{pin:request.pin,confirmation:request.confirmation},'enrollment') as Promise<DeviceAdultEnrollment|DeviceAdultError>;
  },
  async prepare(request:DeviceAdultPrepare){
   if(!request||!deviceAdultActions.includes(request.action))return error('invalidInput');
   const status=await call('status',{},'status');if(status.kind!=='status')return status as DeviceAdultError;
   if(!status.actions.includes(request.action))return error('unsupportedAction');
   // Whitelist fields; no account binding, baseline, digest, proof or private data crosses this bridge.
   const clean:Record<string,unknown>={action:request.action};
   if(request.action==='feed'||request.action==='exceptions'){
    if(!Array.isArray(request.domains)||request.domains.length>256||request.domains.some(d=>typeof d!=='string'||d.length<1||d.length>253))return error('invalidInput');clean.domains=[...request.domains];
   }
   if(request.action==='feed')for(const k of ['version','checksum','generatedAt'] as const){const v=request[k];if(typeof v!=='string'||v.length<1||v.length>128)return error('invalidInput');clean[k]=v}
   const result=await call('prepare',clean,'operation');return result.kind==='operation'&&result.action!==request.action?error('malformedReceipt'):result as DeviceAdultOperation|DeviceAdultError;
  },
  authorize:(operationID:string,pin:string)=>id(operationID)&&typeof pin==='string'&&pin.length<=64?call('authorize',{operationID,pin},'operation',operationID) as Promise<DeviceAdultOperation|DeviceAdultError>:Promise.resolve(error('invalidInput')),
  execute:(operationID:string)=>operation('execute',operationID) as Promise<DeviceAdultOperation|DeviceAdultError>,
  read:(operationID:string)=>operation('read',operationID) as Promise<DeviceAdultOperation|DeviceAdultError>,
  cancel:(operationID:string)=>operation('cancel',operationID) as Promise<DeviceAdultOperation|DeviceAdultError>,
  rotate:(secretType:'pin'|'recovery',secret:string,pin:string,confirmation:string)=>['pin','recovery'].includes(secretType)&&[secret,pin,confirmation].every(v=>typeof v==='string'&&v.length<=128)?call('rotate',{secretType,secret,pin,confirmation},'rotation') as Promise<DeviceAdultRotation|DeviceAdultError>:Promise.resolve(error('invalidInput'))
 };
}
