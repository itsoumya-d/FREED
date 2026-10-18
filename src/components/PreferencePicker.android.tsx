import { LanguagePicker } from './LanguagePicker';
import { View } from 'react-native';
import { Host, RadioButton } from '@expo/ui/jetpack-compose';
import { testID as nativeTestID } from '@expo/ui/jetpack-compose/modifiers';
import { Text, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { PreferencePickerProps } from './PreferencePicker';
export function PreferencePicker({ value, options, onChange, label, testID }: PreferencePickerProps) {
  const { colors, mode } = useAppTheme();
  if (options.some(option => option.flag)) return <LanguagePicker value={value} options={options} onChange={onChange} label={label} testID={testID} />;
  return <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>{options.map((option, index) => <Pressable key={option.value} testID={`${testID}-${option.value}`} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.surface2 : colors.surface })}>
    <Host colorScheme={mode} style={{ width: 40, height: 40 }}><RadioButton selected={value === option.value} onClick={() => onChange(option.value)} modifiers={[nativeTestID(`${testID}-native-${option.value}`)]} /></Host>
    <Text style={{ color: colors.text, flex: 1, fontSize: 17, lineHeight: 24 }}>{option.label}</Text>
  </Pressable>)}</View>;
}
