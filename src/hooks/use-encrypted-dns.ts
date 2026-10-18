import React from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { addNetworkStateListener } from 'expo-network';
import { configureEncryptedDns, getEncryptedDnsStatus } from 'freed-protection';
import { createEncryptedDnsController } from '@/lib/encrypted-dns';

// One device-level writer survives navigation/remounts; React subscriptions own
// presentation only. A settings return cannot invalidate an in-flight mutation.
const controller = createEncryptedDnsController({
  readStatus: getEncryptedDnsStatus,
  configure: configureEncryptedDns,
  now: Date.now,
});

export function useEncryptedDns() {
  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useFocusEffect(React.useCallback(() => {
    void controller.refresh();
    const app = AppState.addEventListener('change', state => { if (state === 'active') void controller.refresh(); });
    const network = addNetworkStateListener(() => { if (AppState.currentState === 'active') void controller.refresh(); });
    return () => { app.remove(); network.remove(); };
  }, []));
  return { ...snapshot, refresh: controller.refresh, configure: controller.configure, acknowledgeOperation: controller.acknowledgeOperation };
}
