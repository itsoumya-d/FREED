import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from './Localized';
import { UrgeSupportButton } from './UrgeSupportButton';
import { BrandLogo } from './BrandLogo';
import { useAppTheme } from '@/design-system/use-app-theme';

function RootLanguageButton() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const code = i18n.language.split('-')[0].toUpperCase();
  return <Pressable testID="root-language" accessibilityRole="button" accessibilityLabel={t('preferences.language')} onPress={() => router.push('/preferences')} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .6 : 1 })}>
    <Text translate={false} style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{code}</Text>
  </Pressable>;
}

/** Separate native items keep iOS 26 from wrapping our brand/actions in a shared capsule. */
export function rootHeaderBrandItems(): NativeStackHeaderItem[] {
  return [{ type: 'custom', element: <BrandLogo compact />, hidesSharedBackground: true }];
}
export function rootHeaderActionItems(): NativeStackHeaderItem[] {
  return [
    { type: 'custom', element: <RootLanguageButton />, hidesSharedBackground: true },
    { type: 'custom', element: <UrgeSupportButton compact />, hidesSharedBackground: true },
  ];
}

/** Non-iOS fallback; root-level access leaves each tab's native back behavior intact. */
export function RootToolbarActions() {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <RootLanguageButton />
    <UrgeSupportButton />
  </View>;
}
