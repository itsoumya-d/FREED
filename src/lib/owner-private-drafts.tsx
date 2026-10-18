import React from 'react';
import type { RecoveryDraftStorage } from './recovery-drafts';

export function createOwnerPrivateDraftStorage(storage: RecoveryDraftStorage, ownerId: string | null, isCurrent: () => boolean): RecoveryDraftStorage {
  const prefix = ownerId ? `freed.private.owner.${encodeURIComponent(ownerId)}.` : null;
  const key = (value: string) => { if (!prefix || !isCurrent()) throw new Error('The private draft owner changed.'); return prefix + value; };
  return { getItem: value => prefix && isCurrent() ? storage.getItem(key(value)) : null,
    setItem: (value, data) => storage.setItem(key(value), data), removeItem: value => storage.removeItem(key(value)) };
}
export type OwnerPrivateDraftContextValue = { ownerId: string | null; storage: RecoveryDraftStorage };
export const OwnerPrivateDraftContext = React.createContext<OwnerPrivateDraftContextValue | null>(null);
export function useOwnerPrivateDraftStorage() { return React.useContext(OwnerPrivateDraftContext); }
