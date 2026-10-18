import React from 'react';
import type { ClaraCloudState } from '@/lib/clara-conversation';
import { Settings } from 'lucide-react-native';
import { ArrowLeft } from './DirectionalIcons';
import { MomentumCompanion } from './MomentumCompanion';
import { Text, View, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
export type ClaraCompactHeaderProps = { onBack: () => void; onOpenSettings: () => void; cloudEnabled: boolean; state?: ClaraCloudState; error?: boolean };
const states: Record<ClaraCloudState, string> = {
  online: 'Cloud reply received', unavailable: 'Cloud unavailable', 'basic-help': 'Built-in guidance',
  'daily-quota-exhausted': 'Daily allowance used', 'budget-exhausted': 'Testing allowance used', duplicate: 'Send a new message',
  'account-deleting': 'Cloud chat off', 'rate-limited': 'Please wait'
};
/** Consent alone never means a working service. Only the caller's observed result names a reply. */
export function ClaraCompactHeader({ onBack, onOpenSettings, cloudEnabled, state, error }: ClaraCompactHeaderProps) {
  const { colors } = useAppTheme();
  const status = error ? 'Cloud preference not saved' : !cloudEnabled ? 'Built-in guidance' : state ? states[state] : 'Cloud permission on';
  return <View testID="clara-compact-header" style={{ flexShrink: 0, paddingHorizontal: 12, paddingVertical: 8, gap: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft color={colors.text} size={22} /></Pressable>
      <MomentumCompanion pose="listen" variant="calm" context="coach" width={28} height={28} idle={false} interactive={false} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>CLARA</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View accessible={false} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: error ? colors.warning : colors.text3 }} /><Text accessibilityLiveRegion="polite" style={{ flexShrink: 1, color: colors.text2, fontSize: 12, lineHeight: 18 }}>{status}</Text></View>
      </View>
      <Pressable testID="clara-open-settings" accessibilityRole="button" accessibilityLabel="Cloud chat settings" onPress={onOpenSettings}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Settings color={colors.text2} size={22} /></Pressable>
    </View>
    <Text style={{ color: colors.text3, fontSize: 12, lineHeight: 18 }}>Automated guidance · not therapy or emergency care</Text>
  </View>;
}
