import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { useMotionSettings } from '@/design-system/motion';
import { useAppTheme } from '@/design-system/use-app-theme';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Web uses the same session progress without requiring a browser-only Lottie player. */
export function BreathingCadenceArtwork({ progress, diameter }: { progress: SharedValue<number>; diameter: number }) {
  const { colors } = useAppTheme();
  const { spatialMotion } = useMotionSettings();
  const animatedProps = useAnimatedProps(() => ({ r: diameter * (.31 + (spatialMotion ? Math.max(0, Math.min(1, progress.get())) * .13 : 0)) }));
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: diameter, height: diameter }}>
    <Svg width={diameter} height={diameter}>
      <Circle cx={diameter / 2} cy={diameter / 2} r={diameter * .48} fill={colors.calmSurface} opacity={.3} />
      <AnimatedCircle testID="breathing-cadence-artwork" cx={diameter / 2} cy={diameter / 2} animatedProps={animatedProps} fill={colors.calmSurface} opacity={.5} />
    </Svg>
  </View>;
}
