import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from '@/components/Localized';
import { PreferencesScreen } from '@/components/PreferencesScreen';

export default function PreferencesRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  return <>
    <Stack.Screen options={{ headerRight: ({ tintColor }) => <Pressable translate={false} testID="preferences-close" accessibilityRole="button" accessibilityLabel={t('common.done')} onPress={close} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text translate={false} style={{ color: tintColor, fontSize: 17, fontWeight: '600' }}>{t('common.done')}</Text></Pressable> }} />
    <PreferencesScreen nativeHeader />
  </>;
}
