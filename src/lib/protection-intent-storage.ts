import type { ProtectionIntent } from './protection-permissions';
export const PROTECTION_INTENT_STORAGE_KEY='freed.protection.setup.intent.v1';
/** Setup intent survives an OS settings handoff; it is not authorization or activation. */
export function getStoredProtectionIntent(storage: {getItem(key:string):string|null}): ProtectionIntent {
  try { const value=storage.getItem(PROTECTION_INTENT_STORAGE_KEY); return value==='websites'||value==='apps'?value:'both'; } catch { return 'both'; }
}
export function storeProtectionIntent(storage: {setItem(key:string,value:string):void}, intent: ProtectionIntent): void {
  if (!['websites','apps','both'].includes(intent)) throw new RangeError('protection-intent-invalid');
  storage.setItem(PROTECTION_INTENT_STORAGE_KEY,intent);
}
