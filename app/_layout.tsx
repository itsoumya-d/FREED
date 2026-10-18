import "@/lib/runtime-polyfills";
import React from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { configureNativeMonetizationBuild } from '@/lib/monetization';
import { Stack } from "expo-router/stack";
import { useRouter } from 'expo-router';
import { Pressable, Text } from '@/components/Localized';
import { translateSource } from '@/i18n/runtime';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FreedAppProvider } from "@/features/freed-app";
import { AppPreferencesProvider } from "@/hooks/use-app-preferences";
import { useAppTheme } from '@/design-system/use-app-theme';
import { useTranslation } from 'react-i18next';
import { getFreedFlowPresentation } from '@/lib/flow-presentation';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
// Expo Constants exports the native Xcode DEBUG flag on iOS. Android retains
// the existing JS guard until a native debuggable flag is available.
if (Platform.OS === 'ios') configureNativeMonetizationBuild(Constants.debugMode === true);
function ThemedStack() {
  const { colors, mode } = useAppTheme(); const { t } = useTranslation();
  const router = useRouter();
  const closePublicPage = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const publicPageOptions: NativeStackNavigationOptions = {
    headerShown: true,
    headerRight: ({ tintColor }) => <Pressable translate={false} accessibilityRole="button" accessibilityLabel={t('common.done')} onPress={closePublicPage} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text translate={false} style={{ color: tintColor, fontSize: 17, fontWeight: '600' }}>{t('common.done')}</Text></Pressable>,
  };
  const theme = React.useMemo(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: colors.accent, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, notification: colors.accent } };
  }, [mode, colors]);
  return <ThemeProvider value={theme}><Stack screenOptions={{ headerShown: false, animation: 'default', contentStyle: { backgroundColor: colors.bg }, headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }}>
    <Stack.Screen name="index" /><Stack.Screen name="(tabs)" />
    <Stack.Screen name="onboarding/[destination]" options={{ gestureEnabled: true }} />
    <Stack.Screen name="flow/[destination]" options={({ route }) => ({ presentation: getFreedFlowPresentation(route.params && 'destination' in route.params ? route.params.destination : undefined) })} />
    <Stack.Screen name="preferences" options={{ presentation: 'formSheet', headerShown: true, title: t('preferences.title'), sheetGrabberVisible: true, sheetAllowedDetents: [1] }} />
    <Stack.Screen name="privacy" options={{ ...publicPageOptions, title: translateSource('FREED Privacy Policy') }} />
    <Stack.Screen name="support" options={{ ...publicPageOptions, title: translateSource('FREED Support') }} />
    <Stack.Screen name="account-deletion" options={{ ...publicPageOptions, title: translateSource('FREED Account Deletion') }} />
  </Stack></ThemeProvider>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppPreferencesProvider>
      <FreedAppProvider>
        <ThemedStack />
      </FreedAppProvider>
      </AppPreferencesProvider>
    </SafeAreaProvider>
  );
}
