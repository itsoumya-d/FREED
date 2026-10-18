import React from 'react';
import type { ViewStyle } from 'react-native';
import { Text, View } from '@/components/Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
export interface MetricProps { label: string; value: string | number; color?: string; sublabel?: string; style?: ViewStyle | ViewStyle[] }
export function Metric({ label, value, color, sublabel, style }: MetricProps) {
  const { colors } = useAppTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous', padding: 16, gap: 4 }, style]}>
    <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>{label}</Text>
    <Text selectable style={{ color: color ?? colors.mint, fontSize: 28, lineHeight: 34, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    {sublabel ? <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 18 }}>{sublabel}</Text> : null}
  </View>;
}
export default Metric;
