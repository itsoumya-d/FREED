import {nativeAccountUUID} from '../../modules/freed-protection/src/native-account-contract';
import type { FirebaseAccountDeletionResult } from './firebase-client';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type AccountDeletionReceipt = { version: 1; ownerUid: string; eventId: string; requestedAt: string;
  cloud: 'unknown' | 'processing' | 'completed'; local: 'pending' | 'failed' | 'completed'; nativeCleanupId?:string };
const key = (owner: string) => `freed.account.deletion.receipt.v1.${encodeURIComponent(owner)}`;
export function loadAccountDeletionReceipt(storage: StorageLike, owner: string): AccountDeletionReceipt | null {
  const raw = storage.getItem(key(owner)); if (!raw) return null;
  const value = JSON.parse(raw) as AccountDeletionReceipt;
  if (!value || value.version !== 1 || value.ownerUid !== owner || typeof value.eventId !== 'string' || !value.eventId || typeof value.requestedAt !== 'string' || !Number.isFinite(Date.parse(value.requestedAt)) ||
    (value.nativeCleanupId!==undefined&&!nativeAccountUUID(value.nativeCleanupId)) || !['unknown', 'processing', 'completed'].includes(value.cloud) || !['pending', 'failed', 'completed'].includes(value.local)) throw new Error('Account deletion receipt could not be read.');
  return value;
}
export function saveAccountDeletionReceipt(storage: StorageLike, receipt: AccountDeletionReceipt): void {
  storage.setItem(key(receipt.ownerUid), JSON.stringify(receipt));
}
/** A lost response remains unknown; Auth disappearance is never promoted to completion. */
export async function executeAccountDeletion({ storage, ownerUid, eventId, request, cleanup, nativeCleanupId }: {
  storage: StorageLike; ownerUid: string; eventId: string; nativeCleanupId?:string;
  request: (eventId: string) => Promise<FirebaseAccountDeletionResult>; cleanup: (owner: string) => Promise<void>;
}): Promise<AccountDeletionReceipt> {
  const old = loadAccountDeletionReceipt(storage, ownerUid);
  let receipt: AccountDeletionReceipt = old ?? { version: 1, ownerUid, eventId, requestedAt: new Date().toISOString(), cloud: 'unknown', local: 'pending' };
  if(nativeCleanupId){if(!nativeAccountUUID(nativeCleanupId)||receipt.nativeCleanupId&&receipt.nativeCleanupId!==nativeCleanupId)throw Error('Native cleanup reference changed.');receipt={...receipt,nativeCleanupId};}
  saveAccountDeletionReceipt(storage, receipt);
  if (receipt.cloud !== 'completed') {
    const result = await request(receipt.eventId);
    if (result.ok !== true || !['completed', 'deleting', 'processing'].includes(result.status)) throw new Error('Account deletion was not acknowledged.');
    receipt = { ...receipt, cloud: result.status === 'completed' ? 'completed' : 'processing' };
    saveAccountDeletionReceipt(storage, receipt);
  }
  if (receipt.cloud === 'completed' && receipt.local !== 'completed') {
    try { await cleanup(ownerUid); receipt = { ...receipt, local: 'completed' }; }
    catch (error) { saveAccountDeletionReceipt(storage, { ...receipt, local: 'failed' }); throw error; }
    saveAccountDeletionReceipt(storage, receipt);
  }
  return receipt;
}
