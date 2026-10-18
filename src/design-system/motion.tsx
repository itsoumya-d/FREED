import React, { useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityState,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useAppTheme } from './use-app-theme';
import { clampMotionDuration, clampPressScale, clampProgress, getStaggerDelay, motionMayRun, MOTION_DURATIONS } from './motion-policy';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One bounded vocabulary. Native tab and stack navigation own their transitions. */
export const MOTION = {
  duration: {
    fast: MOTION_DURATIONS.feedback,
    base: MOTION_DURATIONS.state,
    slow: MOTION_DURATIONS.detail,
    screen: MOTION_DURATIONS.screen,
  },
  easing: Easing.bezier(0.23, 1, 0.32, 1),
} as const;

// Reanimated's spring duration is perceptual: 90 ms settles in about 135 ms.
export const PRESS_SPRING = { duration: 90, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
export const SPRINGS = {
  snap: { duration: 180, dampingRatio: 1, reduceMotion: ReduceMotion.System },
  pop: { duration: 180, dampingRatio: 0.85, reduceMotion: ReduceMotion.System },
} as const;
export const springs = {
  snappy: PRESS_SPRING,
  gentle: SPRINGS.snap,
  bouncy: SPRINGS.pop,
  smooth: SPRINGS.snap,
} as const;

/** Live accessibility changes and native focus/lifecycle gate all owned spatial motion. */
export function useMotionSettings(visible = true) {
  const navigation = useContext(NavigationContext);
  const initialReduceMotion = useReducedMotion();
  const [reduceMotion, setReduceMotion] = useState(initialReduceMotion);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const reduced = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      preferenceChanged = true;
      setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted && !preferenceChanged) setReduceMotion(value);
    }).catch(() => undefined);
    const lifecycle = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    setFocused(navigation?.isFocused() ?? true);
    const focus = navigation?.addListener('focus', () => setFocused(true));
    const blur = navigation?.addListener('blur', () => setFocused(false));
    return () => {
      mounted = false;
      reduced.remove();
      lifecycle.remove();
      focus?.();
      blur?.();
    };
  }, [navigation]);

  return {
    reduceMotion,
    foreground,
    focused,
    active: visible && focused && foreground,
    spatialMotion: motionMayRun({ visible, focused, foreground, reduceMotion }),
  };
}

export const haptics = {
  tap: () => {
    if (Platform.OS === 'android') void Haptics.selectionAsync().catch(() => undefined);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  selection: () => { void Haptics.selectionAsync().catch(() => undefined); },
  impactLight: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); },
  impactMedium: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); },
  success: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); },
  warning: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined); },
};

/** Compatibility builders; system Reduce Motion collapses their spatial component. */
export const motionLayout = {
  fadeDown: (delayMs = 0) => FadeInDown.delay(Math.max(0, Math.min(80, delayMs))).duration(MOTION.duration.base).easing(MOTION.easing).reduceMotion(ReduceMotion.System),
  fadeUp: (delayMs = 0) => FadeInUp.delay(Math.max(0, Math.min(80, delayMs))).duration(MOTION.duration.base).easing(MOTION.easing).reduceMotion(ReduceMotion.System),
  fade: (duration = MOTION.duration.screen) => FadeIn.duration(clampMotionDuration(duration)).easing(MOTION.easing).reduceMotion(ReduceMotion.System),
  fadeOut: (duration = MOTION_DURATIONS.exit) => FadeOut.duration(clampMotionDuration(duration)).easing(MOTION.easing).reduceMotion(ReduceMotion.System),
  smoothTransition: LinearTransition.duration(MOTION.duration.base).easing(MOTION.easing).reduceMotion(ReduceMotion.System),
};

/** Use for one changed in-screen state, never around system tab/push navigation. */
export function ScreenTransition({ children, style, visible = true }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  visible?: boolean;
}) {
  const { spatialMotion, active } = useMotionSettings(visible);
  return <Animated.View
    entering={active ? (spatialMotion
      ? FadeInDown.duration(MOTION.duration.screen).easing(MOTION.easing).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
      : FadeIn.duration(MOTION.duration.fast).reduceMotion(ReduceMotion.Never)) : undefined}
    exiting={active ? FadeOut.duration(MOTION_DURATIONS.exit).reduceMotion(ReduceMotion.Never) : undefined}
    style={style ?? styles.fill}
  >{children}</Animated.View>;
}

/** A short, bounded reveal for small first-time groups, not recycled list rows. */
export function StaggeredEntry({ children, index = 0, style, visible = true }: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  visible?: boolean;
}) {
  const { spatialMotion, active } = useMotionSettings(visible);
  return <Animated.View
    entering={active ? (spatialMotion
      ? FadeInDown.delay(getStaggerDelay(index)).duration(MOTION.duration.screen).easing(MOTION.easing).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })
      : FadeIn.duration(MOTION.duration.fast).reduceMotion(ReduceMotion.Never)) : undefined}
    style={style}
  >{children}</Animated.View>;
}

export type SpringPressableProps = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  scaleTo?: number;
  /** Rows highlight instead of shrinking. Bar buttons fade. */
  feedback?: 'scale' | 'highlight' | 'opacity';
  haptic?: boolean;
  visible?: boolean;
  accessibilityState?: AccessibilityState;
};

/** The whole control responds to press-in, retaining its native layout and hit target. */
export function SpringPressable({
  children, style, pressedScale, scaleTo, feedback = 'scale', haptic = true, visible = true,
  disabled, onPress, onPressIn, onPressOut, accessibilityRole = 'button', accessibilityState, ...props
}: SpringPressableProps) {
  const { colors } = useAppTheme();
  const { spatialMotion, active } = useMotionSettings(visible);
  const pressed = useSharedValue(0);
  const targetScale = clampPressScale(pressedScale ?? scaleTo ?? 0.97);
  useEffect(() => {
    if (!active || disabled) {
      cancelAnimation(pressed);
      pressed.set(0);
    }
    return () => cancelAnimation(pressed);
  }, [active, disabled, pressed]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: feedback === 'opacity' || !spatialMotion ? 1 - pressed.get() * 0.14 : 1,
    transform: [{ scale: feedback === 'scale' && spatialMotion ? 1 - pressed.get() * (1 - targetScale) : 1 }],
    ...(feedback === 'highlight' ? { backgroundColor: pressed.get() > 0.05 ? colors.surface2 : 'transparent' } : {}),
  }));
  return <AnimatedPressable
    {...props}
    style={[style, animatedStyle]}
    disabled={disabled}
    accessibilityRole={accessibilityRole}
    accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled || accessibilityState?.disabled) }}
    onPress={(event) => {
      if (disabled) return;
      if (haptic) haptics.tap();
      onPress?.(event);
    }}
    onPressIn={(event) => {
      if (!disabled && active) pressed.set(spatialMotion ? withSpring(1, PRESS_SPRING) : withTiming(1, { duration: MOTION.duration.fast, reduceMotion: ReduceMotion.Never }));
      onPressIn?.(event);
    }}
    onPressOut={(event) => {
      pressed.set(spatialMotion ? withSpring(0, PRESS_SPRING) : withTiming(0, { duration: MOTION_DURATIONS.exit, reduceMotion: ReduceMotion.Never }));
      onPressOut?.(event);
    }}
  >{children}</AnimatedPressable>;
}

/** A value follows a new state once; it never schedules recurring JS work. */
export function useSmoothedValue(target: number, durationMs: number = MOTION.duration.slow, visible = true): SharedValue<number> {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const value = useSharedValue(safeTarget);
  const { spatialMotion } = useMotionSettings(visible);
  useEffect(() => {
    cancelAnimation(value);
    value.set(spatialMotion ? withTiming(safeTarget, { duration: clampMotionDuration(durationMs), easing: MOTION.easing }) : safeTarget);
    return () => cancelAnimation(value);
  }, [safeTarget, durationMs, spatialMotion, value]);
  return value;
}

/** Only for an explicitly active live state. UI-thread repetition stops on blur/background. */
export function usePulse(active: boolean, peak = 1.05, periodMs = 2400): SharedValue<number> {
  const scale = useSharedValue(1);
  const { spatialMotion } = useMotionSettings(active);
  useEffect(() => {
    cancelAnimation(scale);
    if (spatialMotion) {
      const safePeak = Number.isFinite(peak) ? Math.max(1, Math.min(1.08, peak)) : 1;
      const halfPeriod = Number.isFinite(periodMs) ? Math.max(200, Math.min(3000, periodMs / 2)) : 1200;
      scale.set(withRepeat(withTiming(safePeak, { duration: halfPeriod, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else scale.set(1);
    return () => {
      cancelAnimation(scale);
      scale.set(1);
    };
  }, [spatialMotion, peak, periodMs, scale]);
  return scale;
}

export function PulsingView({ children, active, peak, periodMs, style }: {
  children: React.ReactNode;
  active: boolean;
  peak?: number;
  periodMs?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = usePulse(active, peak, periodMs);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export function AnimatedSmoothProgress({ progressPercent, color, height = 7, style }: {
  progressPercent: number;
  color: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const progress = clampProgress(progressPercent / 100);
  const smoothed = useSmoothedValue(progress, MOTION.duration.base);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: smoothed.get() }] }));
  return <View
    accessibilityRole="progressbar"
    accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    style={[{ height, borderRadius: 999, borderCurve: 'continuous', backgroundColor: colors.surface3, overflow: 'hidden' }, style]}
  ><Animated.View style={[{ width: '100%', height: '100%', borderRadius: 999, backgroundColor: color, transformOrigin: 'left center' }, barStyle]} /></View>;
}

export const styles = StyleSheet.create({ fill: { flex: 1 } });
