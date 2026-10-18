import React from 'react';
import { AppState } from 'react-native';
import { getFirebaseAccountScope, getFirebaseCallableContracts } from '../lib/firebase-native';
import { hasReviewAccess, type ReviewAccessSnapshot } from '../lib/review-access';

/** In-memory only. Every foreground invalidates the old proof before a fresh owner fetch. */
export function useReviewAccess(ownerUid: string | null) {
  const [snapshot, setSnapshot] = React.useState<ReviewAccessSnapshot | null>(null);
  const refreshRef = React.useRef<() => Promise<ReviewAccessSnapshot | null>>(async () => null);
  const [revision, retry] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    let disposed = false, request = 0;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const refresh = async (): Promise<ReviewAccessSnapshot | null> => {
      const sequence = ++request;
      setSnapshot(null);
      if (expiry) clearTimeout(expiry);
      if (!ownerUid || getFirebaseAccountScope() !== ownerUid || AppState.currentState !== 'active') return null;
      try {
        const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
        const proof = await contracts?.getReviewAccess();
        if (disposed || sequence !== request || getFirebaseAccountScope() !== ownerUid || AppState.currentState !== 'active') return null;
        if (proof?.ownerUid !== ownerUid) return null;
        setSnapshot(proof);
        if (hasReviewAccess(proof, ownerUid)) expiry = setTimeout(() => setSnapshot(null), Math.max(1, Date.parse(proof.expiresAt!) - Date.now()));
        return proof;
      } catch {
        if (!disposed && sequence === request) setSnapshot(null);
        return null;
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
      else { request++; setSnapshot(null); }
    });
    return () => { refreshRef.current = async () => null; disposed = true; request++; listener.remove(); if (expiry) clearTimeout(expiry); };
  }, [ownerUid, revision]);
  return { snapshot: snapshot?.ownerUid === ownerUid ? snapshot : null, retry, refresh: () => refreshRef.current() };
}
