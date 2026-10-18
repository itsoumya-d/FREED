import React from 'react';
import { Switch } from 'react-native';
import { MomentumPageHeader } from './MomentumPageHeader';
import { Text, View } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import { translateSource } from '@/i18n/runtime';
import type { PracticeCategory } from '@/design-system/app-palette';
import type { CompanionPose } from './MomentumCompanion';
export function MomentumSettingHeader({ title, description, category, pose = 'plan', context = 'settings', enabled, busy = false, onChange }: {
  title: string; description?: string; category: PracticeCategory; pose?: CompanionPose; context?: string; enabled: boolean; busy?: boolean; onChange: (enabled: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return <MomentumPageHeader title={title} description={description} category={category} pose={busy ? 'waiting' : pose} context={context} variant="progress" compact>
    <View style={{ minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <Text style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>{busy ? 'Sync' : enabled ? 'On' : 'Off'}</Text>
      <Switch accessible accessibilityRole="switch" accessibilityLabel={translateSource(title)} accessibilityState={{ checked: enabled, disabled: busy }} value={enabled} disabled={busy} onValueChange={value => { if (!busy) onChange(value); }} trackColor={{ false: colors.border, true: colors.accent }} />
    </View>
  </MomentumPageHeader>;
}
