import React from 'react';
import { AppState } from 'react-native';
/** Refresh on focus/foreground, even if a background timer never fired. */
export function useTodayClock(active: boolean) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (!active) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = setInterval(refresh, 1000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [active]);
  return now;
}
