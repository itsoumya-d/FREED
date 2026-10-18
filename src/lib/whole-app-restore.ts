import { assertJournalOwner, createJournalRepository, type JournalRepository, type JournalLocalSnapshot, type JournalStorage } from './journal-repository';
import { importJournalArchive, type DecodedJournalArchive } from './journal-archive';
import type { JournalMediaStore } from './journal-media';
import type { RecoveryState } from './recovery-state';
import type { OwnerRecoveryStore } from './owner-recovery-store';

type Intent = { version: 1; ownerId: string; epoch?: number; recovery: RecoveryState; journal: JournalLocalSnapshot };
type Deletion = { version: 1; epoch: number; pending: boolean; kind: 'local' | 'account' };
export const wholeAppRestoreIntentKey = (owner: string) => `freed.restore.intent.v1.${encodeURIComponent(owner)}`;
export const wholeAppRestoreDeletionKey = (owner: string) => `freed.restore.deletion.v1.${encodeURIComponent(owner)}`;
function readDeletion(storage: Pick<JournalStorage, 'getItem'>, owner: string): Deletion | null {
  assertJournalOwner(owner); const raw = storage.getItem(wholeAppRestoreDeletionKey(owner)); if (!raw) return null;
  const value = JSON.parse(raw) as Deletion;
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.epoch) || value.epoch < 1 || typeof value.pending !== 'boolean' || !['local','account'].includes(value.kind)) throw new Error('Private data cleanup needs retry before this history can open.');
  return value;
}
export function ownerRestoreDeletionPending(storage: Pick<JournalStorage, 'getItem'>, owner: string): 'local' | 'account' | null {
  const value = readDeletion(storage, owner); return value?.pending ? value.kind : null;
}
/** Call only after native clear/server completion. Publish invalidation BEFORE removing any private snapshot or store. */
export function beginOwnerRestoreDeletion(storage: JournalStorage, owner: string, kind: Deletion['kind']): number {
  const old = readDeletion(storage, owner), epoch = old?.pending ? old.epoch : (old?.epoch ?? 0) + 1;
  if (!Number.isSafeInteger(epoch)) throw new Error('Private data cleanup needs retry before this history can open.');
  storage.setItem(wholeAppRestoreDeletionKey(owner), JSON.stringify({ version:1, epoch, pending:true, kind } satisfies Deletion));
  storage.removeItem(wholeAppRestoreIntentKey(owner));
  return epoch;
}
/** Retain the epoch permanently: a stale callback/snapshot cannot become valid after cleanup finishes. */
export function completeOwnerRestoreDeletion(storage: JournalStorage, owner: string, epoch: number): void {
  const current = readDeletion(storage, owner);
  if (!current?.pending || current.epoch !== epoch || storage.getItem(wholeAppRestoreIntentKey(owner))) throw new Error('Private data cleanup needs retry before this history can open.');
  storage.setItem(wholeAppRestoreDeletionKey(owner), JSON.stringify({ ...current, pending:false }));
}
function restoreEpochIsCurrent(storage: JournalStorage, owner: string, epoch: number): boolean {
  const deletion = readDeletion(storage, owner); return !deletion?.pending && (deletion?.epoch ?? 0) === epoch;
}
const refs = (snapshot: JournalLocalSnapshot): string[] => {
  const state = snapshot.state as { entries: { photos: { fileName: string; thumbnailFileName: string }[] }[]; drafts: { photos: { fileName: string; thumbnailFileName: string }[] }[] };
  return [...state.entries, ...state.drafts, ...(snapshot.draftBuffer ? [snapshot.draftBuffer] : [])].flatMap(e => e.photos.flatMap(p => [p.fileName, p.thumbnailFileName]));
};
/** Finish durable rollback before revealing an owner's stores after restart. The intent is never a success receipt. */
export function recoverInterruptedWholeAppRestore(storage: JournalStorage, ownerId: string, recovery: OwnerRecoveryStore): boolean {
  if (ownerRestoreDeletionPending(storage, ownerId)) throw new Error('Private data cleanup is pending. Retry deletion before opening this history.');
  const key = wholeAppRestoreIntentKey(ownerId), raw = storage.getItem(key); if (!raw) return false;
  const intent = JSON.parse(raw) as Intent;
  if (intent.version !== 1 || intent.ownerId !== ownerId || intent.journal?.ownerId !== ownerId || !intent.recovery) throw new Error('Backup rollback needs retry. Saved data was kept.');
  const epoch = intent.epoch ?? 0;
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw new Error('Backup rollback needs retry. Saved data was kept.');
  if (!restoreEpochIsCurrent(storage, ownerId, epoch)) { storage.removeItem(key); return false; }
  createJournalRepository({ storage, ownerId }).restoreLocalSnapshot(intent.journal);
  recovery.restoreOwner(ownerId, intent.recovery);
  storage.removeItem(key); return true;
}
/** Keep pre-restore media live until recovery and journal are durable. Every failure rolls back the captured owner. */
export async function restoreWholeAppArchive({ archive, storage, recovery, repository, media, isCurrentOwner, prepareRecovery = value => value }: {
  archive: DecodedJournalArchive; storage: JournalStorage; recovery: OwnerRecoveryStore; repository: JournalRepository;
  media: JournalMediaStore | null; isCurrentOwner: () => boolean; prepareRecovery?: (state: RecoveryState) => RecoveryState;
}) {
  const ownerId = repository.ownerId, key = wholeAppRestoreIntentKey(ownerId);
  if (ownerRestoreDeletionPending(storage, ownerId)) throw new Error('Private data cleanup is pending. Retry deletion before opening this history.');
  const epoch = readDeletion(storage, ownerId)?.epoch ?? 0;
  const epochCurrent = () => restoreEpochIsCurrent(storage, ownerId, epoch);
  const current = () => epochCurrent() && isCurrentOwner();
  if (!isCurrentOwner() || !repository.isActive()) throw new Error('The backup owner changed. Restore was stopped.');
  if (storage.getItem(key)) throw new Error('An interrupted backup restore needs rollback before another restore.');
  const intent: Intent = { version: 1, ownerId, epoch, recovery: recovery.readOwner(ownerId), journal: repository.exportLocalSnapshot() };
  storage.setItem(key, JSON.stringify(intent));
  try {
    const result = await importJournalArchive(archive, repository, media, current, refs(intent.journal), epochCurrent);
    if (!current() || !repository.isActive()) throw new Error('The backup owner changed. Restore was stopped.');
    const prepared = prepareRecovery(archive.recoveryState);
    if (!current()) throw new Error('The backup owner changed. Restore was stopped.');
    recovery.restoreOwner(ownerId, prepared);
    // Removing the intent is the durable commit boundary. Failure here also rolls back both stores.
    storage.removeItem(key);
    let cleanupPending = result.cleanupPending;
    if (media) {
      const committedReferences = () => epochCurrent() ? createJournalRepository({ storage, ownerId }).referencedFileNames() : [];
      media.bindOwnerReferences(ownerId, committedReferences);
      try { await media.reconcile(ownerId, committedReferences); } catch { cleanupPending = true; }
    }
    return { ...result, cleanupPending };
  } catch (error) {
    // Deletion owns the stores now. Never replay, rebind old retained references, or reconcile through the old snapshot.
    if (!epochCurrent()) throw error;
    try { recoverInterruptedWholeAppRestore(storage, ownerId, recovery); }
    catch { throw new Error('Backup restore did not complete. Durable rollback is pending; retry before opening this history.'); }
    if (media) { const restoredReferences = () => epochCurrent() ? createJournalRepository({ storage, ownerId }).referencedFileNames() : [];
      media.bindOwnerReferences(ownerId, restoredReferences);
      try { await media.reconcile(ownerId, restoredReferences); } catch { /* Data rollback is complete; unreferenced media cleanup remains retryable. */ } }
    throw error;
  }
}
