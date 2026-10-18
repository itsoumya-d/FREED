import { Directory, File, Paths } from 'expo-file-system';
import { createChallengePhotoOwnedStore, isFreshChallengeCameraUri } from './challenge-photo-owned-store';

let store: ReturnType<typeof createChallengePhotoOwnedStore> | undefined;
// Directory/manifest creation can fail before the store exists. These entries
// originate only from proven fresh camera returns, never directory enumeration.
const initializationRetries = new Set<string>();
const MAX_INITIALIZATION_RETRIES = 128;
let retryCapacityExceeded = false;

function removeProvenFreshOriginal(uri: string): boolean {
  if (!isFreshChallengeCameraUri(Paths.cache.uri, uri)) return false;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
    initializationRetries.delete(uri);
    return true;
  } catch {
    if (initializationRetries.has(uri) || initializationRetries.size < MAX_INITIALIZATION_RETRIES) initializationRetries.add(uri);
    else retryCapacityExceeded = true;
    return false;
  }
}

function ownedStore() {
  if (store) return store;
  const dir = new Directory(Paths.cache, 'freed-challenge-photos-v1');
  dir.create({ idempotent: true, intermediates: true });
  const manifest = new File(dir, 'owned.json');
  store = createChallengePhotoOwnedStore(Paths.cache.uri, {
    read: () => manifest.exists ? manifest.textSync() : null,
    write: value => manifest.write(value),
    listOwned: () => dir.list().filter((file): file is File => file instanceof File).map(file => file.uri),
    copy: (source, destination) => new File(source).copy(new File(destination)),
    remove: uri => {
      const file = new File(uri);
      if (file.exists) file.delete();
      initializationRetries.delete(uri);
    }
  });
  return store;
}

export async function adoptTemporaryChallengePhoto(uri: string): Promise<string> {
  if (!isFreshChallengeCameraUri(Paths.cache.uri, uri)) throw Error('Camera returned a file outside the app-owned camera cache.');
  try {
    const currentStore = ownedStore();
    // A normal capture provides a recovery opportunity after transient storage
    // failure. Never retry-delete the source of this new live adoption.
    retryInitializationCleanup(currentStore, uri);
    return await currentStore.adopt(uri);
  } catch (error) {
    if (!removeProvenFreshOriginal(uri)) {
      throw Error(retryCapacityExceeded ? 'Fresh photo cleanup failed; retry metadata capacity was exceeded.' : 'Fresh photo cleanup failed; deletion will retry.');
    }
    throw error;
  }
}

export const deleteTemporaryChallengePhoto = (uri: string) => {
  const currentStore = ownedStore();
  retryInitializationCleanup(currentStore);
  return currentStore.release(uri);
};

export function prepareTemporaryChallengePhotoCapture(): boolean {
  const cleanup = cleanupAbandonedChallengePhotos();
  // Unknown overflow ownership cannot safely admit further native captures.
  if (retryCapacityExceeded || initializationRetries.size || cleanup.metadataUnavailable) return false;
  try { return ownedStore().prepareForCapture(); }
  catch { return false; }
}

function retryInitializationCleanup(currentStore?: ReturnType<typeof createChallengePhotoOwnedStore>, protectedOriginal?: string) {
  let attempted = 0;
  for (const uri of [...initializationRetries]) {
    if (uri === protectedOriginal) continue;
    attempted++;
    if (!removeProvenFreshOriginal(uri) && currentStore) {
      // Once storage returns, migrate only the previously proven fresh original
      // into durable metadata before releasing its in-process retry entry.
      try {
        currentStore.trackFreshOriginalForCleanup(uri);
        initializationRetries.delete(uri);
      } catch { /* Keep the bounded in-process retry while metadata is unavailable. */ }
    }
  }
  return { attempted, remaining: initializationRetries.size + Number(retryCapacityExceeded) };
}

export function cleanupAbandonedChallengePhotos() {
  let currentStore: ReturnType<typeof createChallengePhotoOwnedStore> | undefined;
  try { currentStore = ownedStore(); } catch { /* Fresh-original deletion does not require namespace creation. */ }
  const { attempted, remaining: fallbackRemaining } = retryInitializationCleanup(currentStore);
  if (!currentStore) return { attempted, remaining: Math.max(1, fallbackRemaining), metadataUnavailable: true };
  try {
    const owned = currentStore.cleanup();
    // A manifest write failure can leave an original in both stores. Count its
    // unresolved ownership once, while retaining both actual retry attempts.
    const overlap = currentStore.countCleanupOverlap([...initializationRetries]);
    const remaining = initializationRetries.size + Number(retryCapacityExceeded) + owned.remaining - overlap;
    return { attempted: attempted + owned.attempted, remaining, metadataUnavailable: owned.metadataUnavailable };
  } catch {
    // Store reading/writing is still unavailable: never report successful cleanup.
    return { attempted, remaining: Math.max(1, fallbackRemaining), metadataUnavailable: true };
  }
}
