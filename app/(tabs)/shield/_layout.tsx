import { useTranslation } from 'react-i18next';
import { translateSource } from '@/i18n/runtime';
import { Stack } from "expo-router";
import { useAppTheme } from "@/design-system/use-app-theme";
import { RootToolbarActions, rootHeaderActionItems, rootHeaderBrandItems } from "@/components/RootToolbarActions";
import { BrandLogo } from "@/components/BrandLogo";
import { freedShieldSectionTitle, parseFreedShieldSection } from '@/lib/native-navigation';

export const unstable_settings = { initialRouteName: 'index' };

export default function TabStack() {
  const { colors } = useAppTheme();
  useTranslation();
  return <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', headerRight: () => <RootToolbarActions />, unstable_headerRightItems: rootHeaderActionItems, contentStyle: { backgroundColor: colors.bg }, freezeOnBlur: true }}>
    <Stack.Screen name="index" options={{ title: translateSource('Protect'), headerTitle: '', headerLargeTitle: false, headerLeft: () => <BrandLogo compact />, unstable_headerLeftItems: rootHeaderBrandItems }} />
    <Stack.Screen name="[section]" options={({ route }) => {
      const section = parseFreedShieldSection(route.params && 'section' in route.params ? route.params.section : undefined);
      return { title: translateSource(section ? freedShieldSectionTitle(section) : 'Protect'), headerLargeTitle: false };
    }} />
  </Stack>;
}
