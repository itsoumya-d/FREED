import { LanguagePicker } from './LanguagePicker';
import { View } from 'react-native';
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { PreferencePickerProps } from './PreferencePicker';
export function PreferencePicker({ value, options, onChange, label, testID }: PreferencePickerProps) {
  const { colors, mode } = useAppTheme();
  if (options.some(option => option.flag)) return <LanguagePicker value={value} options={options} onChange={onChange} label={label} testID={testID} />;
  return <View testID={testID} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12 }}>
    <Host colorScheme={mode} style={{ width: '100%', height: options.length > 3 ? 216 : 40 }}>
      <Picker label={label} selection={value} onSelectionChange={onChange} modifiers={[pickerStyle(options.length > 3 ? 'wheel' : 'segmented'), tint(colors.mint)]}>
        {options.map(option => <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>)}
      </Picker>
    </Host>
  </View>;
}
