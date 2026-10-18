import { LanguagePicker } from './LanguagePicker';
import { View } from '@/components/Localized';

import { Check } from 'lucide-react-native';
import { Pressable, Text } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
export type PreferenceOption = { value: string; label: string; flag?: number };
export type PreferencePickerProps = { value: string; options: PreferenceOption[]; onChange: (value: string) => void; label: string; testID: string };
export function PreferencePicker({ value, options, onChange, label, testID }: PreferencePickerProps) {
  const { colors } = useAppTheme();
  if (options.some(option => option.flag)) return <LanguagePicker value={value} options={options} onChange={onChange} label={label} testID={testID} />;
  return <View style={{ backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
    {options.map((option, index) => <Pressable key={option.value} testID={`${testID}-${option.value}`} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} accessibilityLabel={option.label} onPress={() => onChange(option.value)} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border, backgroundColor: pressed ? colors.surface2 : colors.surface })}>
      <Text style={{ color: colors.text, flex: 1, fontSize: 17, lineHeight: 24 }}>{option.label}</Text>
      {value === option.value ? <Check color={colors.mint} size={22} /> : null}
    </Pressable>)}
  </View>;
}
