import { useTranslation } from 'react-i18next';
import { translateSource } from '@/i18n/runtime';
import { Stack } from "expo-router";
import { useAppTheme } from "@/design-system/use-app-theme";
import { RootToolbarActions, rootHeaderActionItems, rootHeaderBrandItems } from "@/components/RootToolbarActions";
import { BrandLogo } from "@/components/BrandLogo";
export default function TabStack() { const { colors } = useAppTheme(); useTranslation(); return <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.bg }, freezeOnBlur: true }}><Stack.Screen name="index" options={{ title: translateSource('Progress'), headerTitle: '', headerLargeTitle: false, headerLeft: () => <BrandLogo compact />, unstable_headerLeftItems: rootHeaderBrandItems, headerRight: () => <RootToolbarActions />, unstable_headerRightItems: rootHeaderActionItems }} /></Stack>; }
