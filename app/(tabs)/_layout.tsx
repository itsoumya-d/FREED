import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme } from '@/design-system/use-app-theme';
import { useTranslation } from 'react-i18next';
import { translateSource } from '@/i18n/runtime';
import { Platform } from 'react-native';
export default function MainTabs() {
  const { colors, mode } = useAppTheme();
  useTranslation();
  return <NativeTabs tintColor={colors.accent} backgroundColor={Platform.OS === 'ios' ? (mode === 'dark' ? 'rgba(16,19,25,0.65)' : 'rgba(250,250,251,0.65)') : colors.bg} blurEffect="systemChromeMaterial" disableTransparentOnScrollEdge>
    <NativeTabs.Trigger name="today"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" /><NativeTabs.Trigger.Label>{translateSource('Today')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="shield"><NativeTabs.Trigger.Icon sf="shield.lefthalf.filled" md="shield" /><NativeTabs.Trigger.Label>{translateSource('Protect')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="progress"><NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="monitoring" /><NativeTabs.Trigger.Label>{translateSource('Progress')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" /><NativeTabs.Trigger.Label>{translateSource('Profile')}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
