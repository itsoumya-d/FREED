import { assertJournalOwner, isJournalFileName, isJournalId, JOURNAL_LIMITS, JournalError, type JournalPhoto } from './journal-repository';

export type JournalPhotoAsset = { uri: string; width: number; height: number };
export type JournalPickResult = { status: 'selected'; asset: JournalPhotoAsset; limited: boolean } | { status: 'denied' | 'cancelled' | 'unsupported' };
/** Boundary contract: reencode decodes pixels into a NEW JPEG, without copying EXIF. */
export type JournalPhotoIO = {
  pick(source: 'camera' | 'library'): Promise<JournalPickResult>;
  reencode(asset: JournalPhotoAsset, edge: number, quality: number): Promise<JournalPhotoAsset & { metadataStripped: boolean }>;
  size(uri: string): Promise<number>;
  managedUri(ownerId: string, fileName: string): string;
  exists(uri: string): Promise<boolean>;
  copy(sourceUri: string, destinationUri: string): Promise<void>;
  remove(uri: string): Promise<void>;
  removeTemporary(uri: string): Promise<void>;
  list(ownerId: string): Promise<string[]>;
  readBase64(uri: string): Promise<string>;
  writeTemporaryBase64(base64: string): Promise<string>;
};
export type JournalMediaStatus = 'limit' | 'denied' | 'cancelled' | 'unsupported' | 'unavailable' | 'optimization' | 'storage' | 'stale';
export type JournalPhotoOutcome = ({ status: 'added'; photo: JournalPhoto; limited: boolean } | { status: JournalMediaStatus }) & { cleanupPending?: boolean };
class MediaFailure extends Error { constructor(public readonly status: JournalMediaStatus) { super(`journal-photo-${status}`); } }
type OwnedFile = { ownerId: string; epoch: number; state: 'importing' | 'staged' | 'rejecting'; peer: string };
export function createJournalFileOwnership() { return { files: new Map<string, OwnedFile>(), epochs: new Map<string, number>(), blocked: new Set<string>(), references: new Map<string, () => readonly string[]>(), operations: new Map<string, Set<Promise<unknown>>>() }; }
export type JournalFileOwnership = ReturnType<typeof createJournalFileOwnership>;

/** No uploads or content analysis. File and picker adapters are the only external boundaries. */
export function createJournalMediaStore({ io, newId = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`, ownership = createJournalFileOwnership() }: { io: JournalPhotoIO; newId?: () => string; ownership?: JournalFileOwnership }) {
  const epoch = (ownerId: string) => ownership.epochs.get(ownerId) ?? 0;
  const uri = (ownerId: string, name: string) => { assertJournalOwner(ownerId); if (!isJournalFileName(name)) throw new JournalError('invalid'); return io.managedUri(ownerId, name); };
  const keepNames = (values: readonly string[]) => { if (!Array.isArray(values) || !values.every(isJournalFileName)) throw new JournalError('invalid'); return new Set(values); };
  const forget = (paths: readonly string[]) => paths.forEach(path => ownership.files.delete(path));
  const bindOwnerReferences = (ownerId: string, references: () => readonly string[]) => { assertJournalOwner(ownerId); if (typeof references !== 'function') throw new JournalError('invalid'); ownership.references.set(ownerId, references); };
  function track<T>(ownerId: string, task: Promise<T>): Promise<T> {
    const jobs = ownership.operations.get(ownerId) ?? new Set<Promise<unknown>>(); ownership.operations.set(ownerId, jobs);
    const tracked = task.finally(() => { jobs.delete(tracked); if (!jobs.size) ownership.operations.delete(ownerId); }); jobs.add(tracked); return tracked;
  }
  async function removeUris(values: readonly string[]): Promise<boolean> { let failed = false; for (const value of new Set(values)) { try { await io.remove(value); } catch { failed = true; } } return failed; }
  async function removeTemporaryUris(values: readonly string[]): Promise<boolean> { let failed = false; for (const value of new Set(values)) { try { await io.removeTemporary(value); } catch { failed = true; } } return failed; }
  async function importAsset(ownerId: string, asset: JournalPhotoAsset, current: () => boolean, limited = false): Promise<JournalPhotoOutcome> {
    assertJournalOwner(ownerId); const temporary = [asset.uri], destinations: string[] = []; let outcome: JournalPhotoOutcome = { status: 'unavailable' };
    const check = () => { if (!current()) throw new MediaFailure('stale'); };
    try {
      check(); if (!asset.uri || !Number.isFinite(asset.width) || !Number.isFinite(asset.height) || asset.width < 1 || asset.height < 1) throw new MediaFailure('unavailable');
      let image: Awaited<ReturnType<JournalPhotoIO['reencode']>> | null = null; let bytes = 0;
      for (const quality of [.82, .65, .45, .28]) {
        try { image = await io.reencode(asset, JOURNAL_LIMITS.edge, quality); } catch (error) { throw error instanceof MediaFailure ? error : new MediaFailure('optimization'); }
        temporary.push(image.uri); check();
        if (!image.metadataStripped || Math.max(image.width, image.height) > JOURNAL_LIMITS.edge || image.width < 1 || image.height < 1 || !Number.isInteger(image.width) || !Number.isInteger(image.height)) throw new MediaFailure('optimization');
        bytes = await io.size(image.uri); check(); if (Number.isInteger(bytes) && bytes > 0 && bytes <= JOURNAL_LIMITS.photoBytes) break; image = null;
      }
      if (!image) throw new MediaFailure('optimization');
      const thumbnail = await io.reencode(image, 320, .65); temporary.push(thumbnail.uri); check();
      if (!thumbnail.metadataStripped || Math.max(thumbnail.width, thumbnail.height) > 320 || thumbnail.width < 1 || thumbnail.height < 1) throw new MediaFailure('optimization');
      const thumbBytes = await io.size(thumbnail.uri); check(); if (!(thumbBytes > 0 && thumbBytes <= JOURNAL_LIMITS.photoBytes)) throw new MediaFailure('optimization');
      const id = newId(); if (!isJournalId(id)) throw new MediaFailure('storage');
      const photo: JournalPhoto = { id, fileName: `photo-${id}.jpg`, thumbnailFileName: `thumb-${id}.jpg`, width: image.width, height: image.height, bytes, mime: 'image/jpeg' };
      const candidates = [uri(ownerId, photo.fileName), uri(ownerId, photo.thumbnailFileName)];
      if (candidates.some(path => ownership.files.has(path))) throw new MediaFailure('storage');
      for (const path of candidates) { if (await io.exists(path)) throw new MediaFailure('storage'); check(); }
      destinations.push(...candidates); destinations.forEach((value, index) => ownership.files.set(value, { ownerId, epoch: epoch(ownerId), state: 'importing', peer: candidates[1 - index] }));
      try { await io.copy(image.uri, destinations[0]); check(); await io.copy(thumbnail.uri, destinations[1]); check(); } catch (error) { throw error instanceof MediaFailure ? error : new MediaFailure('storage'); }
      // Check private copies as well. A truncated write never becomes a referenced attachment.
      if (await io.size(destinations[0]) !== bytes || await io.size(destinations[1]) !== thumbBytes) throw new MediaFailure('storage'); check();
      outcome = { status: 'added', photo, limited };
    } catch (error) { outcome = { status: error instanceof MediaFailure ? error.status : 'unavailable' }; }
    const temporaryCleanup = await removeTemporaryUris(temporary);
    const cleanupPending = (outcome.status === 'added' ? false : await removeUris(destinations)) || temporaryCleanup;
    // Owner may change while temporary cleanup is awaited.
    if (outcome.status === 'added' && !current()) { const rollbackFailed = await removeUris(destinations); outcome = { status: 'stale', cleanupPending: cleanupPending || rollbackFailed }; }
    else if (cleanupPending) outcome.cleanupPending = true;
    if (outcome.status === 'added') destinations.forEach(path => { const file = ownership.files.get(path); if (file) file.state = 'staged'; });
    else forget(destinations);
    return outcome;
  }
  return {
    uri,
    /** Bind before publication so shared cancellation can consult authoritative storage even if adoption fails. */
    bindOwnerReferences,
    async pickAndImport(ownerId: string, source: 'camera' | 'library', attachedCount: number, callerCurrent: () => boolean): Promise<JournalPhotoOutcome> {
      const generation = epoch(ownerId), current = () => callerCurrent() && generation === epoch(ownerId) && !ownership.blocked.has(ownerId);
      assertJournalOwner(ownerId); if (attachedCount >= JOURNAL_LIMITS.photos) return { status: 'limit' }; if (!current()) return { status: 'stale' };
      return track(ownerId, (async (): Promise<JournalPhotoOutcome> => {
      let result: JournalPickResult; try { result = await io.pick(source); } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code).toUpperCase() : '';
        return { status: /PERMISSION|USER_REJECTED/.test(code) ? 'denied' : /NO_CAMERA|CAMERA_UNAVAILABLE|UNSUPPORTED/.test(code) ? 'unsupported' : 'unavailable' };
      }
      if (result.status !== 'selected') return result;
      return importAsset(ownerId, result.asset, current, result.limited);
      })());
    },
    async importBase64(ownerId: string, base64: string, dimensions: { width: number; height: number }, callerCurrent: () => boolean): Promise<JournalPhotoOutcome> {
      const generation = epoch(ownerId), current = () => callerCurrent() && generation === epoch(ownerId) && !ownership.blocked.has(ownerId);
      assertJournalOwner(ownerId); if (!current()) return { status: 'stale' };
      return track(ownerId, (async (): Promise<JournalPhotoOutcome> => {
      let temporary: string; try { temporary = await io.writeTemporaryBase64(base64); } catch { return { status: 'storage' }; }
      return importAsset(ownerId, { uri: temporary, ...dimensions }, current);
      })());
    },
    /** Release the staging lease only after both private filenames are durably referenced. */
    adoptPhoto(ownerId: string, photo: Pick<JournalPhoto, 'fileName' | 'thumbnailFileName'>, references: () => readonly string[]): void {
      bindOwnerReferences(ownerId, references); if (ownership.blocked.has(ownerId)) throw new JournalError('owner'); const names = keepNames(references());
      const paths = [uri(ownerId, photo.fileName), uri(ownerId, photo.thumbnailFileName)];
      if (![photo.fileName, photo.thumbnailFileName].every(name => names.has(name))) throw new JournalError('invalid');
      for (const path of paths) { const file = ownership.files.get(path); if (file && (file.ownerId !== ownerId || file.epoch !== epoch(ownerId) || file.state !== 'staged')) throw new JournalError('owner'); }
      forget(paths);
    },
    async readPhoto(ownerId: string, photo: JournalPhoto): Promise<string> { const path = uri(ownerId, photo.fileName); if (await io.size(path) !== photo.bytes) throw new Error('journal-photo-missing'); return io.readBase64(path); },
    async removePhoto(ownerId: string, photo: Pick<JournalPhoto, 'fileName' | 'thumbnailFileName'>): Promise<void> {
      const paths = [uri(ownerId, photo.fileName), uri(ownerId, photo.thumbnailFileName)];
      const reader = ownership.references.get(ownerId); if (reader && [photo.fileName, photo.thumbnailFileName].some(name => keepNames(reader()).has(name))) throw new Error('journal-photo-in-use');
      paths.forEach(path => { const file = ownership.files.get(path); if (file) file.state = 'rejecting'; });
      const failed = await removeUris(paths); forget(paths); if (failed) throw new Error('journal-photo-cleanup');
    },
    async cancelOwner(ownerId: string): Promise<{ cleanupPending: boolean }> {
      assertJournalOwner(ownerId); ownership.epochs.set(ownerId, epoch(ownerId) + 1); ownership.blocked.add(ownerId);
      try {
        await Promise.allSettled([...(ownership.operations.get(ownerId) ?? [])]);
        const paths = [...ownership.files].filter(([, file]) => file.ownerId === ownerId).map(([path]) => path);
        let failed = false, cleanupPending = false;
        for (const path of paths) {
          // A committed file may retain a staging lease after a failed adoption. Cancellation is not history deletion.
          const reader = ownership.references.get(ownerId);
          if (reader) {
            try { if (keepNames(reader()).has(path.slice(path.lastIndexOf('/') + 1))) { forget([path]); continue; } }
            catch { cleanupPending = true; forget([path]); continue; } // Unknown storage cannot authorize erasure.
          }
          try { await io.remove(path); } catch { failed = true; } forget([path]);
        }
        if (failed) throw new Error('journal-photo-cleanup'); return { cleanupPending };
      } finally { ownership.blocked.delete(ownerId); }
    },
    async reconcile(ownerId: string, referencedFileNames: readonly string[] | (() => readonly string[])): Promise<void> {
      assertJournalOwner(ownerId);
      if (typeof referencedFileNames === 'function') { keepNames(referencedFileNames()); ownership.references.set(ownerId, referencedFileNames); }
      else keepNames(referencedFileNames);
      const readKeep = () => keepNames(ownership.references.get(ownerId)?.() ?? (typeof referencedFileNames === 'function' ? referencedFileNames() : referencedFileNames));
      const files = await io.list(ownerId); let failed = false;
      for (const name of files) {
        if (!isJournalFileName(name)) continue;
        // Refresh after list AND after each asynchronous deletion. Adoption can happen while either is pending.
        const keep = readKeep(), path = uri(ownerId, name), held = ownership.files.get(path);
        if (keep.has(name)) {
          if (held?.state === 'staged' && keep.has(held.peer.slice(held.peer.lastIndexOf('/') + 1))) forget([path, held.peer]);
          continue;
        }
        if (held) continue; try { await io.remove(path); } catch { failed = true; }
      }
      if (failed) throw new Error('journal-photo-cleanup');
    }
  };
}
export type JournalMediaStore = ReturnType<typeof createJournalMediaStore>;
