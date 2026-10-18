import React from 'react';
import { useWindowDimensions } from 'react-native';
import 'expo-sqlite/localStorage/install';
import { useAppTheme } from '@/design-system/use-app-theme';
import { translateSource } from '@/i18n/runtime';
import { DNS_GUIDE_STORAGE_KEY, restoreDnsGuideStage, type DnsGuideStage } from '@/lib/dns-settings-guide';
import { View, Text, Pressable } from './Localized';

/** In-app diagram. The public iOS link opens FREED's app settings only. */
export function IOSDnsSettingsGuide({ configurationLabel, disabled, onOpenSettings }: {
  configurationLabel: string; disabled: boolean; onOpenSettings: () => void;
}) {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [stage, setStage] = React.useState<DnsGuideStage>(0);
  React.useEffect(() => {
    try { setStage(restoreDnsGuideStage(localStorage.getItem(DNS_GUIDE_STORAGE_KEY), configurationLabel)); } catch { setStage(0); }
  }, [configurationLabel]);
  const move = (next: DnsGuideStage) => {
    setStage(next);
    try { localStorage.setItem(DNS_GUIDE_STORAGE_KEY, JSON.stringify({ version: 1, label: configurationLabel, stage: next })); } catch {}
  };
  const rows = [
    ['Settings', 'General', 'VPN & Device Management'],
    ['VPN & Device Management', 'DNS'],
    ['DNS', configurationLabel],
  ];
  const controls = (id: string, label: string, action: () => void, unavailable = false) => <Pressable testID={id} accessibilityRole="button" accessibilityLabel={translateSource(label)} accessibilityState={{ disabled: disabled || unavailable }} disabled={disabled || unavailable} onPress={action} style={{ minHeight: 44, minWidth: 0, flex: fontScale > 1.4 ? undefined : 1, flexShrink: 1, width: fontScale > 1.4 ? '100%' : undefined, justifyContent: 'center', alignItems: 'center', borderRadius: 12, padding: 10, backgroundColor: colors.surface2, opacity: disabled || unavailable ? .55 : 1 }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700', flexShrink: 1, textAlign: 'center' }}>{label}</Text></Pressable>;
  const row = rows[stage];
  return <View testID="dns-settings-guide" style={{ gap: 12 }}>
    <Text testID="dns-guide-position" style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{`Step ${stage + 1} of 3`}</Text>
    <View testID={`dns-guide-step-${stage + 1}`} style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 16, borderCurve: 'continuous', padding: 12, backgroundColor: colors.surface2 }}>
      {row.map((label, item) => <React.Fragment key={item}>
        {item ? <Text translate={false} testID="dns-guide-arrow" accessibilityElementsHidden importantForAccessibility="no" style={{ textAlign: 'center', color: colors.accent, fontSize: 21 }}>↓</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, padding: 8, backgroundColor: item === row.length - 1 ? colors.surface : colors.surface2, borderRadius: 10 }}><Text translate={item !== row.length - 1 || stage !== 2} style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: item === row.length - 1 ? '700' : '400' }}>{label}</Text><Text translate={false} accessibilityElementsHidden style={{ color: colors.accent, fontSize: 21 }}>{stage === 2 && item === row.length - 1 ? '○' : '›'}</Text></View>
      </React.Fragment>)}
    </View>
    <Text style={{ color: colors.text2, fontSize: 15, lineHeight: 22 }}>{stage === 0 ? 'This opens FREED’s app settings. Tap Back to reach Settings, through Apps on iOS 18 or later. Then open General.' : stage === 1 ? 'Open DNS in VPN & Device Management.' : 'Select the FREED configuration shown above. Return here to check whether iOS enabled it.'}</Text>
    <View testID="dns-guide-controls" style={{ flexDirection: fontScale > 1.4 ? 'column' : 'row', gap: 12, justifyContent: 'space-between', minWidth: 0 }}>
      {controls('dns-guide-back', 'Back', () => move((stage - 1) as DnsGuideStage), stage === 0)}
      {stage < 2 ? controls('dns-guide-next', 'Next', () => move((stage + 1) as DnsGuideStage)) : null}
    </View>
    <Pressable testID="dns-settings" accessibilityRole="button" accessibilityLabel={translateSource('Open app settings')} accessibilityState={{ disabled }} disabled={disabled} onPress={onOpenSettings} style={{ minHeight: 48, padding: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: disabled ? .55 : 1 }}><Text style={{ color: colors.onAccent, fontSize: 17, fontWeight: '700' }}>Open app settings</Text></Pressable>
  </View>;
}
