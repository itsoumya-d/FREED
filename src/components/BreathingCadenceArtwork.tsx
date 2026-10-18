import LottieView from 'lottie-react-native';
import { View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
const AnimatedLottie = Animated.createAnimatedComponent(LottieView);
const source = require('../../assets/animations/breathing-cadence.json');

/** Illustration seeks from the exercise clock; it owns no timer or completion state. */
export function BreathingCadenceArtwork({ progress, diameter }: { progress: SharedValue<number>; diameter: number }) {
  const animatedProps = useAnimatedProps(() => ({ progress: Math.max(0, Math.min(1, progress.get())) }));
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: diameter, height: diameter }}>
    <AnimatedLottie testID="breathing-cadence-artwork" source={source} autoPlay={false} loop={false} animatedProps={animatedProps} style={{ width: diameter, height: diameter, opacity: .5 }} />
  </View>;
}
