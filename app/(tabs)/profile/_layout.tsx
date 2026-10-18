import { useTranslation } from 'react-i18next';
import { translateSource } from '@/i18n/runtime';
import { Stack } from 'expo-router';
import { useAppTheme } from '@/design-system/use-app-theme';
import { RootToolbarActions, rootHeaderActionItems } from '@/components/RootToolbarActions';
import { freedProfileSectionTitle, parseFreedProfileSection } from '@/lib/native-navigation';

export const unstable_settings = { initialRouteName: 'index' };

export default function TabStack() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', headerRight: () => <RootToolbarActions />, unstable_headerRightItems: rootHeaderActionItems, contentStyle: { backgroundColor: colors.bg }, freezeOnBlur: true }}>
    <Stack.Screen name="index" options={{ title: translateSource('Profile'), headerLargeTitle: true }} />
    <Stack.Screen name="[section]" options={({ route }) => {
      const section = parseFreedProfileSection(route.params && 'section' in route.params ? route.params.section : undefined);
      return { title: section ? t(`momentum.profileSettings.sections.${section}`, { defaultValue: freedProfileSectionTitle(section) }) : translateSource('Profile'), headerLargeTitle: false };
    }} />
  </Stack>;
}
