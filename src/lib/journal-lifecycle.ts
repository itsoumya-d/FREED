import type { JournalRepository } from './journal-repository';
import type { JournalMediaStore } from './journal-media';

/** Explicit account/local-data deletion: durable records first, then retryable owner-only files. */
export async function purgeJournalOwner(repository: JournalRepository, media: JournalMediaStore | null): Promise<void> {
  repository.purgeOwner();
  if (media) { media.bindOwnerReferences(repository.ownerId, () => []); await media.cancelOwner(repository.ownerId); await media.reconcile(repository.ownerId, () => []); }
}
