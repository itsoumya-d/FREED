import { Pressable, Text } from '@/components/Localized';
import { LifeBuoy } from 'lucide-react-native';

import { useFreedAppController } from '@/features/freed-app';
import { useAppTheme } from '@/design-system/use-app-theme';
export function UrgeSupportButton({ compact = false }: { compact?: boolean }) {
  const { startPanicIntervention } = useFreedAppController();
  const { colors } = useAppTheme();
  return <Pressable onPress={startPanicIntervention} accessibilityRole="button" accessibilityLabel="Help now: open urge support" accessibilityHint="Opens immediate recovery support without an ad." style={({ pressed }) => ({ minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .55 : 1 })}>{compact ? <LifeBuoy size={22} color={colors.mint} accessible={false} /> : <Text style={{ color: colors.mint, fontSize: 17, fontWeight: '600' }}>Help now</Text>}</Pressable>;
}
