import React from 'react';
import { AppState, Linking } from 'react-native';
import { GUIDED_RESET_SCHEME_LINK, createGuidedResetLinkInbox } from '@/lib/guided-reset-link';

/** A person-tapped manual opener. No block record, entitlement, ad or unlock. */
export function useGuidedResetLink({ ready, ownerKey, isCurrent, onOpen }: {
  ready: boolean;
  ownerKey: string | null;
  isCurrent: () => boolean;
  onOpen: () => void;
}) {
  const inbox = React.useRef(createGuidedResetLinkInbox());
  const latest = React.useRef({ ready, ownerKey, isCurrent, onOpen });
  latest.current = { ready, ownerKey, isCurrent, onOpen };
  const previousOwner = React.useRef(ownerKey);
  const ownerTransition = React.useRef(0);
  const flush = React.useCallback(() => {
    const current = latest.current;
    if (inbox.current.take(current.ready && current.ownerKey !== null && AppState.currentState === 'active' && current.isCurrent())) current.onOpen();
  }, []);

  React.useEffect(() => {
    // A hint waiting for initial sign-in is generic. An old signed-in owner's
    // queued hint must not spring open after an account switch or deletion.
    if (previousOwner.current !== null && previousOwner.current !== ownerKey) {
      ownerTransition.current += 1;
      inbox.current.clear();
    }
    previousOwner.current = ownerKey;
    flush();
  }, [ready, ownerKey, isCurrent, flush]);

  const enqueueNotification = React.useCallback(() => {
    const current = latest.current;
    // The notification adapter has already validated and deduplicated its
    // expiring owner-bound payload. Queue only the same inert recovery hint.
    if (current.ownerKey !== null && current.isCurrent() && inbox.current.offer(GUIDED_RESET_SCHEME_LINK, 'event')) flush();
  }, [flush]);

  React.useEffect(() => {
    let alive = true;
    const initialOwner = latest.current.ownerKey;
    const initialTransition = ownerTransition.current;
    Linking.getInitialURL().then(url => {
      const currentOwner = latest.current.ownerKey;
      if (alive && initialTransition === ownerTransition.current &&
        (initialOwner === null || initialOwner === currentOwner) && inbox.current.offer(url, 'initial')) flush();
    }).catch(() => undefined);
    const urlListener = Linking.addEventListener('url', ({ url }) => {
      if (alive && inbox.current.offer(url, 'event')) flush();
    });
    const stateListener = AppState.addEventListener('change', state => { if (alive && state === 'active') flush(); });
    return () => { alive = false; inbox.current.clear(); urlListener.remove(); stateListener.remove(); };
  }, [flush]);
  return enqueueNotification;
}
