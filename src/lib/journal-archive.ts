import { assertBackupCryptoAvailable, generateBackupRandomBase64, encryptBackupPayload, decryptBackupPayload } from './backup-crypto';
import { BACKUP_KDF_ITERATIONS, BACKUP_SALT_BYTES, BACKUP_IV_BYTES, backupBase64ByteLength, validateBackupSaltAndIv, validateBackupCiphertext, MAX_BACKUP_PLAINTEXT_BYTES } from './backup-crypto-format';
import { buildPortableRecoveryState, restoreEncryptedRecoveryBackupContent } from './recovery-backup';
import { hydrateRecoveryState, type RecoveryState } from './recovery-state';
import { assertJournalOwner, validateJournalEntry, validateJournalPhoto, validateJournalMigrationState, JOURNAL_LIMITS, JournalError, type JournalEntry, type JournalPhoto, type JournalRepository, type JournalMigrationState } from './journal-repository';
import type { JournalMediaStore } from './journal-media';
import type { JournalTextBackup } from './journal-text-backup';

/** Serialized encrypted file, INCLUDING base64/envelope overhead. Never a 64MiB raw-photo allowance. */
export const JOURNAL_ARCHIVE_MAX_BYTES = 64 * 1024 * 1024;
const CHUNK_CHARS = 512 * 1024, MAX_CHUNKS = 128;
type PortableEntry = Omit<JournalEntry, 'ownerId'>;
export type JournalArchivePhoto = JournalPhoto & { base64: string };
export type DecodedJournalArchive = JournalMigrationState & { version: 1 | 2; exportedAt: string; recoveryState: RecoveryState; entries: PortableEntry[]; photos: JournalArchivePhoto[]; omittedPhotoCount?: number };
type ArchivePayload = JournalMigrationState & { app: 'FREED'; kind: 'journal-media'; version: 2; exportedAt: string; recoveryState: unknown; entries: PortableEntry[]; photos: JournalArchivePhoto[] };
type ArchiveEnvelope = { app: 'FREED'; kind: 'journal-media'; version: 2; createdAt: string; archiveId: string; kdf: { name: 'PBKDF2-SHA256'; iterations: number; salt: string }; cipher: { name: 'AES-GCM' }; chunks: { index: number; iv: string; payload: string }[] };
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const validTime = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const invalid = () => new Error('journal-archive-invalid');
function passphraseCheck(passphrase: string) { if (passphrase.trim().length < 8) throw new Error('journal-archive-passphrase'); }
/** Hermes-safe UTF-8 size accounting; no browser encoding globals are required by the native path. */
export function journalUtf8Bytes(value: string): number {
  let size = 0; for (let i = 0; i < value.length; i++) { const c = value.charCodeAt(i); if (c < 128) size++; else if (c < 2048) size += 2; else if (c >= 0xd800 && c <= 0xdbff && i + 1 < value.length && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) { size += 4; i++; } else size += 3; } return size;
}
function bounded(value: string) { if (value.length > JOURNAL_ARCHIVE_MAX_BYTES || journalUtf8Bytes(value) > JOURNAL_ARCHIVE_MAX_BYTES) throw new Error('journal-archive-limit'); }
function portableEntry(entry: JournalEntry): PortableEntry {
  return { id: entry.id, revision: entry.revision, dateKey: entry.dateKey, title: entry.title, text: entry.text,
    photos: entry.photos.map(p => ({ id: p.id, fileName: p.fileName, thumbnailFileName: p.thumbnailFileName, width: p.width, height: p.height, bytes: p.bytes, mime: p.mime })),
    createdAt: entry.createdAt, updatedAt: entry.updatedAt, savedDraftId: entry.savedDraftId, ...(entry.legacySourceId ? { legacySourceId: entry.legacySourceId } : {}) };
}

/** Root must add this explicit projection to automatic backups; photos and private paths are excluded. */
export { buildJournalTextBackup } from './journal-text-backup';
export function decodedRecoveryTextArchive(recoveryState: RecoveryState, journal: JournalTextBackup | undefined, exportedAt: string): DecodedJournalArchive {
  const entries = journal?.entries.filter(e => e.text.trim()).map(({ omittedPhotoCount: _omitted, ...e }) => ({ ...e, photos: [] })) ?? [];
  const activeSources = new Set(entries.flatMap(e => e.legacySourceId ? [e.legacySourceId] : [])), deletedLegacySources = journal?.deletedLegacySources ?? [];
  const processedSources = journal?.processedSources.filter(s => s.startsWith('draft:') || activeSources.has(s) || deletedLegacySources.includes(s)) ?? [];
  return { version: 1, exportedAt, recoveryState, entries, photos: [], processedSources, deletedLegacySources, omittedPhotoCount: journal?.entries.reduce((n, e) => n + e.omittedPhotoCount, 0) ?? 0 };
}

export async function createEncryptedJournalArchive({ recoveryState, entries, processedSources, deletedLegacySources, ownerId, media, passphrase, exportedAt = new Date().toISOString(), isCurrentOwner = () => true }: JournalMigrationState & { recoveryState: RecoveryState; entries: readonly JournalEntry[]; ownerId: string; media: JournalMediaStore | null; passphrase: string; exportedAt?: string; isCurrentOwner?: () => boolean }): Promise<string> {
  passphraseCheck(passphrase); assertJournalOwner(ownerId); if (!validTime(exportedAt)) throw invalid();
  const check = () => { if (!isCurrentOwner()) throw new JournalError('owner'); }; check();
  if (entries.length > JOURNAL_LIMITS.entries) throw new Error('journal-archive-limit');
  const snapshot = entries.map(entry => { if (entry.ownerId !== ownerId) throw new JournalError('owner'); validateJournalEntry(entry, ownerId); return portableEntry(entry); });
  validateJournalMigrationState({ processedSources, deletedLegacySources }, snapshot);
  if (new Set(snapshot.map(e => e.id)).size !== snapshot.length) throw invalid();
  const photos: JournalArchivePhoto[] = []; const seen = new Map<string, JournalPhoto>();
  // Reject obviously impossible files before loading media or deriving keys. Ciphertext/base64 overhead is 16/9 of raw photo bytes.
  const unique = new Map(snapshot.flatMap(e => e.photos).map(p => [p.id, p]));
  if ([...unique.values()].reduce((sum, p) => sum + Math.ceil(p.bytes / 3) * 4, 0) * 4 / 3 > JOURNAL_ARCHIVE_MAX_BYTES) throw new Error('journal-archive-limit');
  for (const entry of snapshot) for (const photo of entry.photos) {
    const previous = seen.get(photo.id); if (previous) { if (JSON.stringify(previous) !== JSON.stringify(photo)) throw invalid(); continue; }
    if (!media) throw new Error('journal-archive-media-unavailable'); check();
    const base64 = await media.readPhoto(ownerId, photo); check();
    if (backupBase64ByteLength(base64, 1, JOURNAL_LIMITS.photoBytes) !== photo.bytes) throw invalid();
    photos.push({ ...photo, base64 }); seen.set(photo.id, photo);
  }
  const payload: ArchivePayload = { app: 'FREED', kind: 'journal-media', version: 2, exportedAt, recoveryState: buildPortableRecoveryState(recoveryState, exportedAt), entries: snapshot, photos, processedSources: [...processedSources], deletedLegacySources: [...deletedLegacySources] };
  const serialized = JSON.stringify(payload); bounded(serialized);
  const pieces: string[] = []; for (let start = 0; start < serialized.length;) { let end = Math.min(start + CHUNK_CHARS, serialized.length); const c = serialized.charCodeAt(end - 1); if (end < serialized.length && c >= 0xd800 && c <= 0xdbff) end--; pieces.push(serialized.slice(start, end)); start = end; }
  if (pieces.length > MAX_CHUNKS) throw new Error('journal-archive-limit');
  assertBackupCryptoAvailable(); const salt = await generateBackupRandomBase64(BACKUP_SALT_BYTES); check();
  const envelope: ArchiveEnvelope = { app: 'FREED', kind: 'journal-media', version: 2, createdAt: exportedAt, archiveId: salt, kdf: { name: 'PBKDF2-SHA256', iterations: BACKUP_KDF_ITERATIONS, salt }, cipher: { name: 'AES-GCM' }, chunks: [] };
  let encryptedBytes = journalUtf8Bytes(JSON.stringify(envelope)); const ivs = new Set<string>();
  for (let index = 0; index < pieces.length; index++) {
    check(); const iv = await generateBackupRandomBase64(BACKUP_IV_BYTES); if (ivs.has(iv)) throw invalid(); ivs.add(iv);
    // The encrypted wrapper binds ordering, total count, archive identity and date. Mixing valid chunks across archives fails.
    const plaintext = JSON.stringify({ archiveId: salt, exportedAt, index, count: pieces.length, data: pieces[index] });
    const plainBytes = journalUtf8Bytes(plaintext); if (plainBytes > MAX_BACKUP_PLAINTEXT_BYTES) throw new Error('journal-archive-limit');
    encryptedBytes += Math.ceil((plainBytes + 16) / 3) * 4 + 128; if (encryptedBytes > JOURNAL_ARCHIVE_MAX_BYTES) throw new Error('journal-archive-limit');
    const ciphertext = await encryptBackupPayload(passphrase, salt, iv, plaintext); check(); envelope.chunks.push({ index, iv, payload: ciphertext });
  }
  const result = JSON.stringify(envelope); bounded(result); check(); return result;
}
function validatePayload(value: unknown, exportedAt: string): ArchivePayload {
  if (!object(value) || value.app !== 'FREED' || value.kind !== 'journal-media' || value.version !== 2 || value.exportedAt !== exportedAt
    || !object(value.recoveryState) || !Array.isArray(value.entries) || value.entries.length > JOURNAL_LIMITS.entries || !Array.isArray(value.photos) || value.photos.length > JOURNAL_LIMITS.entries * JOURNAL_LIMITS.photos) throw invalid();
  const definitions = new Map<string, JournalArchivePhoto>();
  for (const photo of value.photos) {
    if (!object(photo) || typeof photo.base64 !== 'string') throw invalid(); const base64 = photo.base64;
    validateJournalPhoto(photo); if (backupBase64ByteLength(base64, 1, JOURNAL_LIMITS.photoBytes) !== photo.bytes || definitions.has(photo.id)) throw invalid(); definitions.set(photo.id, { ...photo, base64 });
  }
  const referenced = new Set<string>(), entries = new Set<string>();
  for (const entry of value.entries) {
    if (!object(entry) || 'ownerId' in entry) throw invalid(); validateJournalEntry({ ...entry, ownerId: 'archive' }, 'archive');
    if (entries.has(String(entry.id))) throw invalid(); entries.add(String(entry.id));
    for (const photo of entry.photos as JournalPhoto[]) {
      const definition = definitions.get(photo.id); if (!definition || ['fileName', 'thumbnailFileName', 'width', 'height', 'bytes', 'mime'].some(key => definition[key as keyof JournalPhoto] !== photo[key as keyof JournalPhoto])) throw invalid(); referenced.add(photo.id);
    }
  }
  if (referenced.size !== definitions.size) throw invalid(); validateJournalMigrationState(value, value.entries as PortableEntry[]); return value as unknown as ArchivePayload;
}

/** Parsing/decryption/validation performs no writes. v1 uses the existing recovery importer unchanged. */
export async function restoreJournalOrRecoveryBackup(serialized: string, passphrase: string): Promise<DecodedJournalArchive> {
  passphraseCheck(passphrase); bounded(serialized); let parsed: unknown; try { parsed = JSON.parse(serialized); } catch { throw invalid(); }
  if (object(parsed) && parsed.version === 1 && !('kind' in parsed)) {
    const content = await restoreEncryptedRecoveryBackupContent(serialized, passphrase);
    // Photo-only entries cannot be restored as invented attachments or empty saved notes. Keep the omission count visible.
    return decodedRecoveryTextArchive(content.state, content.journal, String(parsed.createdAt));
  }
  if (!object(parsed) || parsed.app !== 'FREED' || parsed.kind !== 'journal-media' || parsed.version !== 2 || !validTime(parsed.createdAt) || typeof parsed.archiveId !== 'string'
    || !object(parsed.kdf) || parsed.kdf.name !== 'PBKDF2-SHA256' || parsed.kdf.iterations !== BACKUP_KDF_ITERATIONS || parsed.archiveId !== parsed.kdf.salt
    || typeof parsed.kdf.salt !== 'string' || !object(parsed.cipher) || parsed.cipher.name !== 'AES-GCM' || !Array.isArray(parsed.chunks) || parsed.chunks.length < 1 || parsed.chunks.length > MAX_CHUNKS) throw invalid();
  const ivs = new Set<string>();
  for (let index = 0; index < parsed.chunks.length; index++) {
    const chunk = parsed.chunks[index]; if (!object(chunk) || chunk.index !== index || typeof chunk.iv !== 'string' || typeof chunk.payload !== 'string' || ivs.has(chunk.iv)) throw invalid();
    try { validateBackupSaltAndIv(parsed.kdf.salt, chunk.iv); validateBackupCiphertext(chunk.payload); } catch { throw invalid(); } ivs.add(chunk.iv);
  }
  assertBackupCryptoAvailable(); const envelope = parsed as unknown as ArchiveEnvelope; const pieces: string[] = []; let decodedBytes = 0;
  for (const chunk of envelope.chunks) {
    let text: string; try { text = await decryptBackupPayload(passphrase, envelope.kdf.salt, chunk.iv, chunk.payload); } catch { throw new Error('journal-archive-decrypt'); }
    let decoded: unknown; try { decoded = JSON.parse(text); } catch { throw invalid(); }
    if (!object(decoded) || decoded.archiveId !== envelope.archiveId || decoded.exportedAt !== envelope.createdAt || decoded.index !== chunk.index || decoded.count !== envelope.chunks.length || typeof decoded.data !== 'string' || decoded.data.length > CHUNK_CHARS) throw invalid();
    decodedBytes += journalUtf8Bytes(decoded.data); if (decodedBytes > JOURNAL_ARCHIVE_MAX_BYTES) throw new Error('journal-archive-limit'); pieces.push(decoded.data);
  }
  let payload: unknown; try { payload = JSON.parse(pieces.join('')); } catch { throw invalid(); }
  const safe = validatePayload(payload, envelope.createdAt);
  return { version: 2, exportedAt: safe.exportedAt, recoveryState: hydrateRecoveryState(buildPortableRecoveryState(safe.recoveryState, safe.exportedAt)), entries: safe.entries, photos: safe.photos, processedSources: [...safe.processedSources], deletedLegacySources: [...safe.deletedLegacySources] };
}

/** Reencode all inbound media into fresh private names, then commit entries once. Failed imports remove every staged file. */
export async function importJournalArchive(archive: DecodedJournalArchive, repository: JournalRepository, media: JournalMediaStore | null, isCurrentOwner: () => boolean, retainedReferences: readonly string[] = [], retainedReferencesValid: () => boolean = () => true) {
  const ownerId = repository.ownerId, staged: JournalPhoto[] = []; let committed = false;
  const check = () => { if (!isCurrentOwner() || !repository.isActive()) throw new JournalError('owner'); }; check();
  // Callers may pass a decoded object directly; validate again before allocating files.
  if (archive.version === 2) validatePayload({ ...archive, app: 'FREED', kind: 'journal-media' }, archive.exportedAt);
  else { if (archive.photos.length || archive.entries.some(e => e.photos.length)) throw invalid(); archive.entries.forEach(e => validateJournalEntry({ ...e, ownerId }, ownerId)); validateJournalMigrationState(archive, archive.entries); }
  try {
    const liveReferences = () => retainedReferencesValid() ? [...new Set([...retainedReferences, ...repository.referencedFileNames()])] : [];
    media?.bindOwnerReferences(ownerId, liveReferences);
    const mapping = new Map<string, JournalPhoto>();
    for (const photo of archive.photos) {
      check(); if (!media) throw new Error('journal-archive-media-unavailable');
      const outcome = await media.importBase64(ownerId, photo.base64, photo, isCurrentOwner);
      if (outcome.status !== 'added') throw new Error(`journal-archive-photo-${outcome.status}`);
      staged.push(outcome.photo); check(); mapping.set(photo.id, outcome.photo);
    }
    check(); const imported = repository.importEntries(archive.entries.map(entry => ({ ...entry, ownerId, photos: entry.photos.map(photo => mapping.get(photo.id)!) })), archive); committed = true;
    let cleanupPending = false;
    if (media) {
      const referenced = new Set(repository.referencedFileNames());
      const rejected: JournalPhoto[] = [];
      // Finish adoption of ALL durable references in this synchronous turn before any cleanup can yield.
      for (const photo of staged) {
        if (referenced.has(photo.fileName) && referenced.has(photo.thumbnailFileName)) { try { media.adoptPhoto(ownerId, photo, liveReferences); } catch { cleanupPending = true; } }
        else rejected.push(photo);
      }
      for (const photo of rejected) { try { await media.removePhoto(ownerId, photo); } catch { cleanupPending = true; } }
      try { await media.reconcile(ownerId, liveReferences); } catch { cleanupPending = true; }
    }
    return { ...imported, cleanupPending, recoveryState: archive.recoveryState };
  } catch (error) {
    let rollbackFailed = false; if (!committed && media) for (const photo of staged) { try { await media.removePhoto(ownerId, photo); } catch { rollbackFailed = true; } }
    if (rollbackFailed) throw new Error('journal-archive-rollback-cleanup-pending'); throw error;
  }
}
