import React from 'react';
import { BackHandler } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FreedRoute, useFreedAppController } from '@/features/freed-app';
import { parseFreedRoute } from '@/lib/native-navigation';
export default function RecoveryFlowRoute() {
  const { destination, feature } = useLocalSearchParams<{ destination: string; feature?: string }>();
  const controller = useFreedAppController();
  const protectionFlow = ['intercept', 'ad', 'challenge'].includes(destination);
  useFocusEffect(React.useCallback(() => {
    if (!protectionFlow) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { controller.abandonActiveProtectionFlow(); return true; });
    return () => listener.remove();
  }, [protectionFlow, controller.abandonActiveProtectionFlow]));
  return <><Stack.Screen options={{ gestureEnabled: !protectionFlow }} /><FreedRoute screen={parseFreedRoute(`/flow/${destination}`).screen === 'splash' ? 'features' : parseFreedRoute(`/flow/${destination}`).screen} featureId={feature} /></>;
}
