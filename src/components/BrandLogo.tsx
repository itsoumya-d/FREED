import { Text, View } from '@/components/Localized';
import { Image } from 'react-native';
import { useAppTheme } from '@/design-system/use-app-theme';

/** FREED's original kite/open-path mark, paired with a native wordmark. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const { colors } = useAppTheme();
  return <View accessible accessibilityLabel="FREED" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Image source={require('../../assets/brand/freed-symbol.png')} accessible={false} resizeMode="contain" style={{ width: compact ? 32 : 44, height: compact ? 32 : 44, tintColor: colors.mint }} />
    <Text style={{ color: colors.text, fontSize: compact ? 20 : 28, fontWeight: '800', letterSpacing: .5 }}>FREED</Text>
  </View>;
}
