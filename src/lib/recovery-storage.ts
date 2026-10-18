import "expo-sqlite/localStorage/install";

import React from "react";

import {
  RecoveryState,
  createDefaultRecoveryState,
  hydrateRecoveryState,
  recordAppSessionStart,
  touchRecoveryState
} from "@/lib/recovery-state";
import { safeUserFacingMessage } from "@/lib/user-facing-error";
import { createDurableStateCell } from "@/lib/durable-state-cell";
import { createOwnerRecoveryStore, type OwnerRecoveryLease } from './owner-recovery-store';
import { recoverInterruptedWholeAppRestore, wholeAppRestoreIntentKey, ownerRestoreDeletionPending } from './whole-app-restore';

export const RECOVERY_STORAGE_KEY = "freed.recovery.state.v1";

export function loadRecoveryState(): RecoveryState {
  const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
  if (!raw) return createDefaultRecoveryState();
  return hydrateRecoveryState(JSON.parse(raw));
}

export function saveRecoveryState(state: RecoveryState): void {
  localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(hydrateRecoveryState(state)));
}

export function usePersistentRecoveryState(options?: { ownerId: string | null; readOwner: () => string | null; authReady?: boolean; cleanupOwnerId?: string | null }) {
  const [state, setState] = React.useState<RecoveryState>(() => createDefaultRecoveryState());
  const [hydrated, setHydrated] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string | null>(null);
  const cell = React.useRef(createDurableStateCell(state, saveRecoveryState,
    value => touchRecoveryState(hydrateRecoveryState(value))));
  const ownerRead = React.useRef(options?.readOwner); ownerRead.current = options?.readOwner;
  const ownerStore = React.useRef<ReturnType<typeof createOwnerRecoveryStore> | null>(null);
  const ownerLease = React.useRef<OwnerRecoveryLease | null>(null);
  const ownerToken = React.useRef<string | null | undefined>(undefined);
  const [ownerRevision, refreshOwner] = React.useState(0);
  const readProof = React.useRef<{ lease: OwnerRecoveryLease | null; ready: boolean }>({ lease: null, ready: false });
  const [, notifyReadProof] = React.useReducer((value: number) => value + 1, 0);
  const publishReadProof = (ready: boolean, scope = ownerLease.current) => {
    if (readProof.current.ready === ready && readProof.current.lease === scope) return;
    readProof.current = { lease: scope, ready }; notifyReadProof();
  };
  if (options && !ownerStore.current) ownerStore.current = createOwnerRecoveryStore({ storage: localStorage, currentOwnerUid: () => ownerRead.current?.() ?? null });
  // Publish the next owner's data before children render; never expose the prior owner's frame.
  let shown = state;
  if (options && ownerToken.current !== options.ownerId) {
    ownerToken.current = options.ownerId;
    ownerLease.current = ownerStore.current!.activate(options.ownerId);
    publishReadProof(false);
    try { if (options.ownerId) recoverInterruptedWholeAppRestore(localStorage, options.ownerId, ownerStore.current!); shown = ownerLease.current.read(); publishReadProof(true); }
    catch { shown = createDefaultRecoveryState(); }
    cell.current = createDurableStateCell(shown, value => {
      if (options.ownerId && (ownerRestoreDeletionPending(localStorage, options.ownerId) || localStorage.getItem(wholeAppRestoreIntentKey(options.ownerId)))) throw new Error('An interrupted backup restore needs rollback before new writes.');
      return ownerLease.current!.save(value);
    }, value => touchRecoveryState(hydrateRecoveryState(value)));
    setState(shown);
  }
  const lease = ownerLease.current;
  const isCurrentReadScope = () => !options || (ownerLease.current === lease && lease?.isCurrent() === true);

  React.useEffect(() => {
    if (!isCurrentReadScope()) return;
    try {
      if (options?.ownerId) recoverInterruptedWholeAppRestore(localStorage, options.ownerId, ownerStore.current!);
      const stored = recordAppSessionStart(options ? lease!.read() : loadRecoveryState());
      if (!isCurrentReadScope()) return;
      publishReadProof(true, lease);
      cell.current.replaceInMemory(stored);
      setState(stored);
      try { if (options) ownerLease.current!.save(stored); else saveRecoveryState(stored); setStorageError(null); }
      catch (error) { if (isCurrentReadScope()) setStorageError(safeUserFacingMessage(error, "Recovery data could not be saved.")); }
    } catch (error) {
      if (!isCurrentReadScope()) return;
      publishReadProof(false, lease);
      const fallback = recordAppSessionStart(createDefaultRecoveryState());
      cell.current.replaceInMemory(fallback);
      setState(fallback);
      setStorageError(safeUserFacingMessage(error, "Recovery data could not be loaded."));
    } finally {
      if (isCurrentReadScope()) setHydrated(true);
    }
  }, [options?.ownerId, ownerRevision]);

  const setRecoveryState = React.useCallback((update: RecoveryState | ((current: RecoveryState) => RecoveryState)) => {
      if (lease && !lease.isCurrent()) return createDefaultRecoveryState();
      const current = cell.current.read();
      const nextValue = typeof update === "function" ? update(current) : update;
      let next = touchRecoveryState(hydrateRecoveryState(nextValue));

      try {
        next = cell.current.commit(next);
        setStorageError(null);
      } catch (error) {
        setStorageError(safeUserFacingMessage(error, "Recovery data could not be saved."));
        cell.current.replaceInMemory(next);
      }

      setState(next);
      return next;
  }, [lease]);

  const persistRecoveryState = React.useCallback((update: RecoveryState | ((current: RecoveryState) => RecoveryState)) => {
    try {
      lease?.assertCurrent();
      if (!isCurrentReadScope() || !readProof.current.ready || readProof.current.lease !== lease) throw new Error('Saved recovery data must be read again before new writes. Retry loading your saved choices.');
      const next = cell.current.commit(update);
      setState(next);
      setStorageError(null);
      return next;
    } catch (error) {
      setStorageError(safeUserFacingMessage(error, "Recovery data could not be saved."));
      throw error;
    }
  }, [lease]);

  const retryRecoveryStateRead = React.useCallback((): RecoveryState => {
    try {
      lease?.assertCurrent();
      if (!isCurrentReadScope()) throw new Error('The recovery owner changed. This read was stopped.');
      if (options?.ownerId && (ownerRestoreDeletionPending(localStorage, options.ownerId) || localStorage.getItem(wholeAppRestoreIntentKey(options.ownerId)))) throw new Error('An interrupted backup restore or cleanup needs recovery before saved choices can be read.');
      const loaded = options ? lease!.read() : loadRecoveryState();
      if (!isCurrentReadScope()) throw new Error('The recovery owner changed. This read was stopped.');
      // A successful retry reads the ledger into memory only; it never starts a session or saves defaults.
      cell.current.replaceInMemory(loaded);
      publishReadProof(true, lease); setState(loaded); setStorageError(null);
      return loaded;
    } catch (error) {
      if (isCurrentReadScope()) { publishReadProof(false, lease); setStorageError(safeUserFacingMessage(error, "Recovery data could not be loaded.")); }
      throw error;
    }
  }, [lease]);

  const suspendOwner = () => { ownerStore.current?.revoke(); ownerLease.current = null; publishReadProof(false); cell.current.replaceInMemory(createDefaultRecoveryState()); setState(createDefaultRecoveryState()); };
  const resumeOwner = () => { if (!options) return; publishReadProof(false); ownerToken.current = undefined; refreshOwner(value => value + 1); };
  const adoptLegacy = (confirmed: boolean) => { if (!ownerLease.current) throw new Error('Recovery account is unavailable.'); const next = ownerLease.current.adoptLegacy(confirmed); cell.current.replaceInMemory(next); setState(next); return next; };
  let unclaimedLegacy = false, ownsLegacy = false;
  try { unclaimedLegacy = lease?.hasUnclaimedLegacy() ?? false; ownsLegacy = lease?.ownsLegacy() ?? false; } catch { /* Storage errors are surfaced by hydration. */ }

  let rollbackPending = false;
  let ownerCleanupPending: 'local' | 'account' | null = null;
  const cleanupOwner = options?.cleanupOwnerId ?? options?.ownerId;
  try { ownerCleanupPending = cleanupOwner ? ownerRestoreDeletionPending(localStorage, cleanupOwner) : null;
    rollbackPending = Boolean(ownerCleanupPending || (options?.ownerId && localStorage.getItem(wholeAppRestoreIntentKey(options.ownerId)))); } catch { rollbackPending = Boolean(options?.ownerId); }
  const storageReady = readProof.current.ready && readProof.current.lease === lease && isCurrentReadScope();
  return { state: shown, setRecoveryState, persistRecoveryState, retryRecoveryStateRead, storageReady, hydrated: hydrated && (options?.authReady ?? true), storageError, rollbackPending, ownerCleanupPending,
    ownerStore: ownerStore.current, ownerLease: lease, unclaimedLegacy, ownsLegacy, adoptLegacy, suspendOwner, resumeOwner };
}
