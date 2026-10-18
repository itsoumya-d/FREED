import { View } from 'react-native';
import { router } from 'expo-router';
import { Globe2, SunMoon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/design-system/use-app-theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { LANGUAGE_NAMES } from '@/lib/app-preferences';
import { Pressable, Text } from './Localized';
export function OnboardingPreferences({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme(); const { language } = useAppPreferences(); const { t } = useTranslation();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Pressable testID="onboarding-language" accessibilityRole="button" accessibilityLabel={t('preferences.language')} onPress={() => router.push('/preferences')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8, opacity: pressed ? .6 : 1 })}><Globe2 size={18} color={colors.text2} />{!compact ? <Text translate={false} style={{ color: colors.text2, fontSize: 13 }}>{LANGUAGE_NAMES[language]}</Text> : null}</Pressable>
    <Pressable testID="onboarding-appearance" accessibilityRole="button" accessibilityLabel={t('preferences.appearance')} onPress={() => router.push('/preferences')} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .6 : 1 })}><SunMoon size={19} color={colors.text2} /></Pressable>
  </View>;
}
