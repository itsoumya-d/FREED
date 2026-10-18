import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

/** Retained stack routes must never restart initialization while another screen is active. */
export function useInitialRoute(ready: boolean, onAdvance: () => void) {
  const focused = useIsFocused();
  const advanced = useRef(false);
  useEffect(() => {
    if (!ready || !focused) { advanced.current = false; return; }
    if (advanced.current) return;
    advanced.current = true;
    onAdvance();
  }, [ready, focused, onAdvance]);
}
