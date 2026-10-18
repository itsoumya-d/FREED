import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { SupportedLanguage } from '@/lib/app-preferences';
import type { PreferencePickerProps } from './PreferencePicker';

/** Flags are decorative; native names identify languages for every reader. */
export const LANGUAGE_FLAGS: Record<SupportedLanguage, number> = {
  en: require('../../assets/flags/en.png'), hi: require('../../assets/flags/hi.png'),
  es: require('../../assets/flags/es.png'), pt: require('../../assets/flags/pt.png'),
  fr: require('../../assets/flags/fr.png'), de: require('../../assets/flags/de.png'),
  ar: require('../../assets/flags/ar.png'), ja: require('../../assets/flags/ja.png'),
  ko: require('../../assets/flags/ko.png'), 'zh-Hans': require('../../assets/flags/zh-Hans.png'),
};
export function LanguagePicker({ value, options, onChange, label, testID }: PreferencePickerProps) {
  const { colors } = useAppTheme();
  return <View accessibilityLabel={label} style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
    {options.map((option, index) => <Pressable key={option.value} testID={`${testID}-${option.value}`} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} accessibilityLabel={option.label} onPress={() => onChange(option.value)} style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.surface2 : colors.surface })}>
      {option.flag ? <Image testID={`${testID}-flag-${option.value}`} source={option.flag} accessible={false} accessibilityElementsHidden importantForAccessibility="no" resizeMode="contain" style={{ width: 28, height: 20 }} /> : <View style={{ width: 28, height: 20 }} />}
      <Text style={{ color: colors.text, flex: 1, fontSize: 17, lineHeight: 24, writingDirection: option.value === 'ar' ? 'rtl' : 'ltr' }}>{option.label}</Text>
      {value === option.value ? <Check color={colors.mint} size={22} accessible={false} /> : null}
    </Pressable>)}
  </View>;
}
