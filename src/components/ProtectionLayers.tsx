import { MomentumSection } from './MomentumPageHeader';
import { ShieldCheck, Shield } from 'lucide-react-native';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import { describeProtectionLayers } from '@/lib/protection-layers';
import { useAppTheme } from '@/design-system/use-app-theme';
import { Text, View } from './Localized';
const labels = { active: 'Active', off: 'Off', limited: 'Needs attention', paused: 'Paused', unavailable: 'Unavailable' };
export function ProtectionLayers({ capability, status }: { capability: ProtectionCapability | null; status: ProtectionStatus | null }) {
  const { colors } = useAppTheme();
  return <MomentumSection testID="protection-layers" title="Protection health" category="commitment" style={{ padding: 0 }}>{describeProtectionLayers(capability, status).map((layer, index) => <View key={layer.id} testID={`protection-layer-${layer.id}`} style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', borderTopWidth: index ? 1 : 0, borderTopColor: colors.border }}>
    <View accessible={false} pointerEvents="none" style={{ flexShrink: 0 }}>{layer.state === 'active' ? <ShieldCheck color={colors.mint} size={21} /> : <Shield color={colors.text2} size={21} />}</View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{layer.title}</Text><Text style={{ color: layer.state === 'active' ? colors.mint : colors.text2, fontSize: 13, lineHeight: 20 }}>{labels[layer.state]}</Text></View>
  </View>)}</MomentumSection>;
}
