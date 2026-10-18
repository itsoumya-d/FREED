/** Only this capture namespace is enumerated. Fresh camera returns may register an
 * original ImagePicker path; all other cache/user files remain outside ownership. */
export type PhotoFileStore = {
  read: () => string | null;
  write: (value: string) => void;
  listOwned: () => string[];
  copy: (source: string, destination: string) => void;
  remove: (uri: string) => void;
};

function isDirectPhotoChild(uri: string, prefix: string): boolean {
  return uri.startsWith(prefix) && /^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|heic)$/i.test(uri.slice(prefix.length));
}

/** Called only for fresh camera returns, before any directory/manifest creation. */
export function isFreshChallengeCameraUri(cacheUri: string, uri: string): boolean {
  return isDirectPhotoChild(uri, cacheUri.replace(/\/$/, '') + '/ImagePicker/');
}

export function createChallengePhotoOwnedStore(cacheUri: string, files: PhotoFileStore) {
  const root = cacheUri.replace(/\/$/, '') + '/freed-challenge-photos-v1/';
  const live = new Set<string>();
  const pending = new Set<string>();
  let sequence = 0;
  const maxRetained = 128;
  const valid = (uri: string) => isDirectPhotoChild(uri, root) || isFreshChallengeCameraUri(cacheUri, uri);

  function load(): string[] {
    const stored = JSON.parse(files.read() ?? '[]');
    if (!Array.isArray(stored)) throw Error('Owned photo metadata is unreadable.');
    const registered = stored.filter(uri => typeof uri === 'string' && valid(uri));
    return [...new Set([...pending, ...registered])];
  }

  function save(uris: string[]) {
    const retained = [...new Set(uris)];
    const previous = load();
    // Preserve legacy oversized ownership in place. It may shrink through
    // cleanup, but no new ownership can grow it beyond the current bound.
    if (retained.length > maxRetained && retained.some(uri => !previous.includes(uri))) {
      throw Error('Owned photo metadata capacity was exceeded.');
    }
    if (retained.length <= maxRetained) {
      pending.clear();
      for (const uri of retained) pending.add(uri);
    }
    files.write(JSON.stringify(retained));
    pending.clear();
  }

  function remove(uri: string): boolean {
    try {
      files.remove(uri);
      pending.delete(uri);
      save(load().filter(registered => registered !== uri));
      return true;
    } catch {
      return false;
    }
  }

  return {
    countCleanupOverlap(uris: readonly string[]) {
      let registered: string[];
      try { registered = load(); } catch { registered = [...pending]; }
      const retained = new Set(registered);
      return uris.filter(uri => retained.has(uri) && !live.has(uri)).length;
    },

    prepareForCapture() {
      try {
        const retained = [...new Set([...load(), ...files.listOwned().filter(uri => isDirectPhotoChild(uri, root))])];
        if (retained.length > maxRetained - 2) return false;
        // Probe writable ownership storage before any new native camera opens.
        save(load());
        return true;
      } catch {
        return false;
      }
    },

    async adopt(uri: string) {
      if (!isFreshChallengeCameraUri(cacheUri, uri)) throw Error('Camera returned a file outside the app-owned camera cache.');
      const owned = root + `capture-${Date.now()}-${++sequence}.jpg`;
      // Register before copy, so either failure or restart can recover both files.
      live.add(uri);
      live.add(owned);
      try {
        save([...load(), uri, owned]);
        files.copy(uri, owned);
        remove(uri);
        return owned;
      } catch (error) {
        remove(uri);
        remove(owned);
        live.delete(owned);
        throw error;
      } finally {
        live.delete(uri);
      }
    },

    trackFreshOriginalForCleanup(uri: string) {
      if (!isFreshChallengeCameraUri(cacheUri, uri)) throw Error('Camera returned a file outside the app-owned camera cache.');
      save([...load(), uri]);
    },

    async release(uri: string) {
      live.delete(uri);
      if (valid(uri) && load().includes(uri) && !remove(uri)) throw Error('Owned capture cleanup will retry.');
    },

    cleanup() {
      // A failed/torn manifest cannot lose namespace-owned captures. Original picker
      // captures are removed ONLY when previously registered after a fresh return.
      const outstanding = () => {
        let registered: string[];
        let metadataUnavailable = false;
        try { registered = load(); }
        catch { registered = [...pending]; metadataUnavailable = true; }
        let namespaceFiles: string[] = [];
        try { namespaceFiles = files.listOwned().filter(uri => isDirectPhotoChild(uri, root)); }
        catch { metadataUnavailable = true; }
        return { uris: [...new Set([...registered, ...namespaceFiles])].filter(uri => !live.has(uri)), metadataUnavailable };
      };
      const candidates = outstanding().uris.slice(0, 128);
      for (const uri of candidates) remove(uri);
      const remaining = outstanding();
      return {
        attempted: candidates.length,
        remaining: Math.max(Number(remaining.metadataUnavailable), remaining.uris.length),
        metadataUnavailable: remaining.metadataUnavailable
      };
    }
  };
}
