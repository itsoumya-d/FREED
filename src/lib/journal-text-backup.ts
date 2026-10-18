import { assertJournalOwner, validateJournalEntry, validateJournalMigrationState, JOURNAL_LIMITS, type JournalEntry, type JournalMigrationState } from './journal-repository';
export type JournalTextBackup = JournalMigrationState & { version: 1; photoPolicy: 'excluded'; entries: (Omit<JournalEntry, 'ownerId' | 'photos'> & { omittedPhotoCount: number })[] };
export function buildJournalTextBackup(ownerId: string, entries: readonly JournalEntry[], migration?: JournalMigrationState): JournalTextBackup {
  assertJournalOwner(ownerId);
  const projected = entries.map(entry => { validateJournalEntry(entry, ownerId); const { ownerId: _owner, photos, ...safe } = entry; return { ...safe, omittedPhotoCount: photos.length }; });
  const markers = migration ?? { processedSources: entries.flatMap(e => e.legacySourceId ? [e.legacySourceId] : []), deletedLegacySources: [] };
  validateJournalMigrationState(markers, entries);
  return { version: 1, photoPolicy: 'excluded', entries: projected, processedSources: [...markers.processedSources], deletedLegacySources: [...markers.deletedLegacySources] };
}
/** Exact allowlist: automatic backup never contains photo metadata/bytes, owner IDs or private paths. */
export function validateJournalTextBackup(value: unknown): JournalTextBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Journal text backup is invalid.');
  const v = value as JournalTextBackup;
  if (Object.keys(v).some(k => !['version', 'photoPolicy', 'entries', 'processedSources', 'deletedLegacySources'].includes(k)) || v.version !== 1 || v.photoPolicy !== 'excluded' || !Array.isArray(v.entries) || v.entries.length > JOURNAL_LIMITS.entries) throw new Error('Journal text backup is invalid.');
  const allowed = ['id', 'revision', 'dateKey', 'title', 'text', 'createdAt', 'updatedAt', 'savedDraftId', 'legacySourceId', 'omittedPhotoCount'];
  const ids = new Set<string>();
  for (const e of v.entries) {
    if (!e || typeof e !== 'object' || Object.keys(e).some(k => !allowed.includes(k)) || !Number.isSafeInteger(e.omittedPhotoCount) || e.omittedPhotoCount < 0 || e.omittedPhotoCount > JOURNAL_LIMITS.photos || ids.has(e.id)) throw new Error('Journal text backup is invalid.');
    ids.add(e.id);
    // A photo-only entry has intentionally empty text; validate its remaining metadata with a sentinel then retain the exact text.
    validateJournalEntry({ ...e, text: e.text?.trim() ? e.text : '[Photo omitted from automatic backup]', ownerId: 'archive', photos: [] }, 'archive');
    if (typeof e.text !== 'string' || e.text.length > JOURNAL_LIMITS.text || (!e.text.trim() && e.omittedPhotoCount === 0)) throw new Error('Journal text backup is invalid.');
  }
  validateJournalMigrationState(v, v.entries); return JSON.parse(JSON.stringify(v)) as JournalTextBackup;
}
