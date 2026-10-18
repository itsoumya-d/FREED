import { loadAccountDeletionReceipt, type AccountDeletionReceipt } from './account-deletion-receipt';
import { getJourneyOwner, type JourneyAuthSnapshot } from './user-journey';
import { assertJournalOwner } from './journal-repository';
/** Reads receipt metadata only. A cleanup target never becomes a private-history/auth owner. */
export function readConfirmedAccountCleanupReceipt(storage: Pick<Storage,'getItem'|'setItem'>, auth: JourneyAuthSnapshot, sdkUid: string | null,
  cached: AccountDeletionReceipt | null = null): AccountDeletionReceipt | null {
  if (auth.status === 'hydrating') return null;
  let owner: string | null = null;
  if (sdkUid !== null) {
    if (getJourneyOwner(auth) !== sdkUid) return null;
    owner = sdkUid;
  } else {
    // Never fall back to another account while an SDK/snapshot transition still identifies an owner.
    if (auth.signedIn || auth.ownerUid !== null) return null;
    try { owner = storage.getItem('freed.account.deletion.latest.v1') ?? cached?.ownerUid ?? null; } catch { owner = cached?.ownerUid ?? null; }
  }
  if (!owner) return null;
  try { assertJournalOwner(owner); } catch { return null; }
  try {
    const receipt = loadAccountDeletionReceipt(storage, owner);
    if (receipt) return receipt.cloud === 'completed' ? receipt : null;
  } catch { /* The original confirmed in-memory receipt can expose retry without exposing private data. */ }
  return cached?.ownerUid === owner && cached.cloud === 'completed' ? cached : null;
}

import {nativeAccountUUID, type NativeAccountAdmission, type NativeCleanupReceipt} from '../../modules/freed-protection/src/native-account-contract';
export type NativeCleanupOperation=Readonly<{version:2;operationId:string;ownerUid:string;reason:'sign-out'|'local'|'account';approved:boolean;state:'pending'|'completed'|'unavailable'}>;
type CleanupStorage=Pick<Storage,'getItem'|'setItem'>;
const nativeKey=(id:string,reason:NativeCleanupOperation['reason'])=>'freed.account.native-cleanup.v2.'+reason+'.'+id;
const latestKey=(owner:string,reason:NativeCleanupOperation['reason'])=>'freed.account.native-cleanup.latest.v2.'+reason+'.'+encodeURIComponent(owner);
export function readNativeCleanupOperation(storage:CleanupStorage,owner:string,reason:NativeCleanupOperation['reason'],id?:string):NativeCleanupOperation|null {
 const identifier=id??storage.getItem(latestKey(owner,reason));if(!identifier)return null;if(!nativeAccountUUID(identifier))throw Error('Native cleanup reference unavailable.');
 const raw=storage.getItem(nativeKey(identifier,reason));if(!raw)throw Error('Native cleanup reference unavailable.');const r=JSON.parse(raw) as NativeCleanupOperation;
 if(!r||r.version!==2||r.operationId!==identifier||r.ownerUid!==owner||r.reason!==reason||typeof r.approved!=='boolean'||!['pending','completed','unavailable'].includes(r.state)||Object.keys(r).length!==6)throw Error('Native cleanup reference unavailable.');
 return Object.freeze(r);
}
export function saveNativeCleanupOperation(storage:CleanupStorage,value:NativeCleanupOperation):void {
 if(!nativeAccountUUID(value.operationId))throw Error('Native cleanup reference unavailable.');
 storage.setItem(nativeKey(value.operationId,value.reason),JSON.stringify(value));storage.setItem(latestKey(value.ownerUid,value.reason),value.operationId);
}
/** Preparation only reserves. Its minimal native ID must be durable before Auth/provider/cloud removal. */
export async function reserveNativeCleanup(input:{storage:CleanupStorage;ownerUid:string;reason:NativeCleanupOperation['reason'];admission:NativeAccountAdmission|null;isCurrent:()=>boolean;prepare:(scope:string,handle:string)=>Promise<NativeCleanupReceipt|null>}):Promise<NativeCleanupOperation|null>{
 const {admission}=input;
 if(!admission||admission.ownerUid!==input.ownerUid||!input.isCurrent())return null;
 const receipt=await input.prepare(admission.actionScope,admission.bindingHandle);
 if(!receipt||!input.isCurrent())return null;
 const operation:NativeCleanupOperation=Object.freeze({version:2,operationId:receipt.operationId,ownerUid:input.ownerUid,reason:input.reason,approved:false,state:'pending'});
 saveNativeCleanupOperation(input.storage,operation);return input.isCurrent()?operation:null;
}
/** Positive local intent/cloud confirmation is durable independently of pending native/Core work. */
export async function executeStoredNativeCleanup(input:{storage:CleanupStorage;operation:NativeCleanupOperation;execute:(id:string)=>Promise<NativeCleanupReceipt|null>}):Promise<NativeCleanupOperation>{
 let operation=readNativeCleanupOperation(input.storage,input.operation.ownerUid,input.operation.reason,input.operation.operationId);
 if(!operation)throw Error('Native cleanup reference unavailable.');if(operation.state==='completed')return operation;
 operation={...operation,approved:true};saveNativeCleanupOperation(input.storage,operation);
 const receipt=await input.execute(operation.operationId);
 operation={...operation,state:receipt?.completed?'completed':receipt&&!receipt.phase.startsWith('superseded')?'pending':'unavailable'};saveNativeCleanupOperation(input.storage,operation);return operation;
}
