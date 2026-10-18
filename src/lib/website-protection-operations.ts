import { validateSafariRecoveryObservation, type SafariObservationReceipt, type SafariRecoveryObservation } from '../../modules/freed-protection/src/safari-recovery-observation';
import type { ProtectionStatus } from 'freed-protection';

export type WebsiteHandoffReceipt = {version:1;operationId:string;kind:'https-test'|'settings';opened:boolean;bridgeErrorCode?:string;errorDomain?:string;errorCode?:number};
const nativeDomains = new Set(['NSURLErrorDomain','NSCocoaErrorDomain','NSPOSIXErrorDomain','NEDNSSettingsErrorDomain','NEConfigurationErrorDomain','RCTErrorDomain','kCFErrorDomainCFNetwork']);
const diagnosticId=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16);});
export function normalizeWebsiteHandoffReceipt(value:unknown):WebsiteHandoffReceipt|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;const r=value as Record<string,unknown>;
 if(r.version!==1||typeof r.operationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.operationId)||(r.kind!=='settings'&&r.kind!=='https-test')||typeof r.opened!=='boolean')return null;
 return {version:1,operationId:r.operationId,kind:r.kind,opened:r.opened,
  ...(typeof r.bridgeErrorCode==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(r.bridgeErrorCode)?{bridgeErrorCode:r.bridgeErrorCode}:{}),
  ...(typeof r.errorDomain==='string'&&nativeDomains.has(r.errorDomain)?{errorDomain:r.errorDomain,...(typeof r.errorCode==='number'&&Number.isSafeInteger(r.errorCode)?{errorCode:r.errorCode}:{})}:{} )};
}
/** The adapter stores an opening result, never a URL, browsing result or error message. */
export function createWebsiteHandoffController(options:{getScope:()=>string|null;open:(url:string)=>Promise<unknown>;operationId?:()=>string}) {
 let latest=0,snapshot:WebsiteHandoffReceipt|null=null;
 return {getSnapshot:()=>snapshot,async open(url:string):Promise<WebsiteHandoffReceipt|null>{
  const token=++latest,scope=options.getScope(),operationId=(options.operationId??diagnosticId)();
  const current=()=>token===latest&&scope===options.getScope();
  let receipt:WebsiteHandoffReceipt={version:1,operationId,kind:'https-test',opened:false};
  try { if(!/^https:\/\//i.test(url))throw new Error('unsupported test scheme');const result=await options.open(url);receipt.opened=result===true||result===undefined; }
  catch(error){
   if(error&&typeof error==='object'){
    const e=error as Record<string,unknown>;
    if(typeof e.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(e.code))receipt.bridgeErrorCode=e.code;
    const domain=e.nativeErrorDomain??e.domain,code=e.nativeErrorCode??(typeof e.code==='number'?e.code:undefined);
    if(typeof domain==='string'&&nativeDomains.has(domain)){receipt.errorDomain=domain;if(typeof code==='number'&&Number.isSafeInteger(code))receipt.errorCode=code;}
   }
  }
  if(!current())return null;snapshot=receipt;return receipt;
 }};
}
let latestWebsiteHandoff=0;
/** Each visible tap is distinct; only the newest handoff may reach its caller. */
export async function openWebsiteTestHandoff(options:{url:string;getScope:()=>string|null;open:(url:string)=>Promise<unknown>}) {
 const token=++latestWebsiteHandoff;
 const receipt=await createWebsiteHandoffController(options).open(options.url);
 return token===latestWebsiteHandoff?receipt:null;
}

export type ProtectionReadTicket = { revision: number; isCurrent: () => boolean };

/** Fence every read, including focus and Settings-return reads. */
export function createProtectionRefreshFence() {
  let generation = 0;
  return {
    getRevision: () => generation,
    begin() { const captured = ++generation; return { revision: captured, isCurrent: () => captured === generation }; },
    invalidate() { generation++; },
  };
}

/** One writer survives setup navigation; duplicate taps join its acknowledgement. */
export function createWebsiteSetupWriter() {
  let pending: Promise<unknown> | null = null;
  return {
    run<T>(action: () => Promise<T>): Promise<T> {
      if (pending) return pending as Promise<T>;
      const result = action();
      pending = result;
      void result.finally(() => { if (pending === result) pending = null; }).catch(() => undefined);
      return result;
    },
    /** Distinct requests queue; they cannot receive an earlier opposite action's acknowledgement. */
    enqueue<T>(action: () => Promise<T>): Promise<T> {
      if (!pending) {
        const result = action();
        pending = result;
        void result.finally(() => { if (pending === result) pending = null; }).catch(() => undefined);
        return result;
      }
      const prior = pending;
      const result = (async () => { try { await prior; } catch { /* Each request owns its failure. */ } return action(); })();
      pending = result;
      void result.finally(() => { if (pending === result) pending = null; }).catch(() => undefined);
      return result;
    },
    async whenIdle() { try { await pending; } catch { /* The action owns its failure. */ } },
  };
}
export const websiteSetupWriter = createWebsiteSetupWriter();

/** Keep the mutation receipt even when an ordinary status read has no reason. */
export function getAdultPolicyOperationError(status: Partial<ProtectionStatus> | null | undefined): string | null {
  if (!status) return 'The device did not confirm the policy request. Retry activation.';
  const reason = status.adultWebPolicyReason ?? status.nativeConfigurationError;
  if (reason === 'ios-native-configuration-lock-unavailable' || reason === 'ios-native-configuration-lock-timeout' || reason === 'ios-reset-configuration-in-progress')
    return 'Device protection is busy. Wait a moment, then retry activation.';
  if (reason === 'ios-native-app-group-container-unavailable')
    return 'Device protection storage is unavailable. Unlock your iPhone and retry activation.';
  if (reason === 'ios-adult-policy-persistence-failed')
    return 'The policy request could not be saved. Retry activation.';
  if (reason === 'ios-adult-policy-authorization-required')
    return 'Allow Screen Time, then retry activation.';
  if (reason === 'ios-adult-policy-unavailable')
    return 'The adult-web policy is unavailable in this installed build.';
  if (reason === 'ios-adult-policy-not-observed' || status.adultWebPolicyConfigured === false && typeof status.adultWebPolicyOperationAccepted === 'boolean')
    return 'iOS did not confirm the adult-web policy. Retry activation and check configuration again.';
  if (status.adultWebPolicyOperationAccepted === false || status.nativeConfigurationOperationAccepted === false)
    return 'The device did not accept the policy request. Retry activation.';
  return null;
}

/** Native writes update the shared readback synchronously before React batching. */
export function createProtectionRefreshCoordinator<Snapshot>(initial: Snapshot) {
  const fence = createProtectionRefreshFence();
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const changed = () => { for (const listener of listeners) listener(); };
  return {
    // Read freshness has its own subscription; owner/mutation authority stays separate.
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getReadRevision: fence.getRevision,
    begin(isValid: () => boolean = () => true): ProtectionReadTicket { const request = fence.begin(); changed(); return { revision: request.revision, isCurrent: () => request.isCurrent() && isValid() }; },
    invalidate() { fence.invalidate(); changed(); },
    getSnapshot: () => snapshot,
    publishNative(value: Snapshot) { fence.invalidate(); snapshot = value; changed(); },
    publishRead(request: ReturnType<typeof fence.begin>, value: Snapshot) {
      if (!request.isCurrent()) return false;
      snapshot = value;
      return true;
    },
  };
}

export type SafariConfigurationPresentation = {
  configuration: 'checked' | 'not-confirmed';
  action: 'settings' | 'refresh' | 'none';
  message: 'checked' | 'buildUnsupported' | 'unavailable' | 'disabled' | 'grantsNeeded' | 'checkInSafari' | 'expired' | 'stale' | 'pending' | 'checkFailed';
  enabled: boolean | null;
  enabledReason: SafariRecoveryObservation['enabled']['reason'] | null;
  enabledCheckedAt: string | null;
  packageVariant: SafariObservationReceipt['packageVariant'] | null;
  receipt: SafariObservationReceipt | null;
  freshness: SafariRecoveryObservation['freshness'] | 'unavailable';
  reason: SafariRecoveryObservation['reason'] | null;
  checkedAt: string | null;
};

/** Presentation only: a receipt records an earlier check, never live enforcement. */
export function getSafariConfigurationPresentation(value: unknown, { current, now = Date.now() }: { current: boolean; now?: number }): SafariConfigurationPresentation {
  const observation = current ? validateSafariRecoveryObservation(value) : null;
  const receipt = observation?.receipt ?? null;
  const result: SafariConfigurationPresentation = {
    configuration: 'not-confirmed', action: 'refresh', message: observation ? 'checkInSafari' : 'unavailable',
    enabled: observation?.enabled.value ?? null, enabledReason: observation?.enabled.reason ?? null,
    enabledCheckedAt: observation?.enabled.checkedAt ?? null, packageVariant: receipt?.packageVariant ?? null,
    receipt, freshness: observation?.freshness ?? 'unavailable', reason: observation?.reason ?? null, checkedAt: null,
  };
  if (!observation) return result;
  const facts = receipt?.facts;
  const withinReceipt = receipt && Number.isFinite(now) && now >= Date.parse(receipt.receivedAt) && now < Date.parse(receipt.expiresAt);
  const consistent = facts && facts.diagnostic === 'none' && facts.grants === 'complete' && facts.dynamicRules === 'zero' && facts.sessionRules === 'zero'
    && facts.staticRules === (receipt?.packageVariant === 'short-form-v1' ? 'not-configured' : 'expected-enabled');
  if (receipt && observation.freshness === 'fresh' && observation.reason === 'none' && observation.enabled.value !== false && withinReceipt && consistent) {
    result.configuration = 'checked'; result.checkedAt = receipt.receivedAt; result.message = 'checked'; result.action = 'none';
  } else if (observation.enabled.value === false) { result.message = 'disabled'; result.action = 'settings'; }
  else if (facts?.grants === 'partial' || facts?.grants === 'missing') { result.message = 'grantsNeeded'; result.action = 'settings'; }
  else if (observation.reason === 'expired' || receipt && !withinReceipt) result.message = 'expired';
  else if (observation.reason === 'pending') result.message = 'pending';
  else if (['stale-config', 'stale-presentation', 'reset', 'clock'].includes(observation.reason)) result.message = 'stale';
  else if (['package-unavailable', 'storage-unavailable'].includes(observation.reason)) result.message = 'unavailable';
  else if (facts && !consistent || observation.reason === 'malformed') result.message = 'checkFailed';
  // These packages cannot supply adult recovery. Repeating Check cannot add the
  // missing artifact; baseline filtering and the independent browsing test remain.
  if (receipt && receipt.packageVariant !== 'adult-recovery-internal-v1') {
    result.message = 'buildUnsupported'; result.action = 'none';
  }
  return result;
}
