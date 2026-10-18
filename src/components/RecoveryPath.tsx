import { Text, View } from '@/components/Localized';
import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Image as SvgImage, Line, Path } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { MOTION, useMotionSettings, useSmoothedValue } from '@/design-system/motion';
import { normalizeRecoveryPathState } from '@/design-system/motion-policy';
import { useAppTheme } from '@/design-system/use-app-theme';
import { useTranslation } from 'react-i18next';
import { translateSource } from '@/i18n/runtime';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// An original open route; the endpoint uses FREED's passage/F artwork.
const ROUTE = 'M 28 140 C 66 156 96 144 116 119 C 134 95 145 73 168 83 C 201 97 229 94 247 65 C 258 47 271 37 286 38';
const ROUTE_LENGTH = 307.37;
const STAGES = [
  { x: 36, y: 143 },
  { x: 168, y: 83 },
  { x: 286, y: 38 },
] as const;
const DEFAULT_STAGES = ['Pause', 'Protect', 'Practice'] as const;

export interface RecoveryPathProps {
  /** Actual workflow progress, 0..1. This is never a health/recovery score. */
  progress: number;
  activeStage: 0 | 1 | 2;
  stages?: readonly [string, string, string];
  compact?: boolean;
  showStageLabels?: boolean;
  caption?: string;
  /** Set false if a parent hides the illustration without unmounting it. */
  visible?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A single response to explicit progress changes; there is no decorative loop. */
export function RecoveryPath({
  progress,
  activeStage,
  stages = DEFAULT_STAGES,
  compact = false,
  showStageLabels = true,
  caption,
  visible = true,
  accessibilityLabel,
  testID,
  style,
}: RecoveryPathProps) {
  const { colors } = useAppTheme();
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'source' });
  const numbers = new Intl.NumberFormat(i18n.language, i18n.language === 'ar' ? { numberingSystem: 'arab' } : {});
  const ordinals = new Intl.NumberFormat(i18n.language, { minimumIntegerDigits: 2, useGrouping: false, ...(i18n.language === 'ar' ? { numberingSystem: 'arab' } : {}) });
  const stageLabels = stages.map(stage => translateSource(stage, i18n.language as never));
  const state = normalizeRecoveryPathState(progress, activeStage);
  const drawProgress = useSmoothedValue(state.progress, MOTION.duration.slow, visible);
  const routeProps = useAnimatedProps(() => ({ strokeDashoffset: ROUTE_LENGTH * (1 - drawProgress.get()) }));
  const description = accessibilityLabel ?? [
    translateSource('Recovery path.', i18n.language as never),
    stageLabels.join(', ') + '.',
    t('Current step {{value1}} of 3: {{value2}}.', { value1: numbers.format(state.activeStage + 1), value2: stageLabels[state.activeStage] }),
    t('Plan progress {{value1}} percent.', { value1: numbers.format(Math.round(state.progress * 100)) }),
    caption ? translateSource(caption, i18n.language as never) : undefined,
  ].filter(Boolean).join(' ');

  return <View accessible accessibilityRole="image" accessibilityLabel={description} testID={testID} style={[styles.root, style]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: compact ? 96 : 176, width: '100%' }}>
      <Svg width="100%" height="100%" viewBox="0 0 320 176" preserveAspectRatio="xMidYMid meet" accessible={false}>
        <G opacity={0.55}>
          <Line x1="202" y1="38" x2="243" y2="38" stroke={colors.border} strokeWidth="1" />
          <Line x1="311" y1="38" x2="319" y2="38" stroke={colors.border} strokeWidth="1" />
          <Path d="M 242 54 A 47 47 0 0 1 319 7" fill="none" stroke={colors.mint} strokeWidth="1" />
          <Path d="M 231 63 A 59 59 0 0 1 320 1" fill="none" stroke={colors.border} strokeWidth="1" />
        </G>
        <Path d={ROUTE} fill="none" stroke={colors.surface3} strokeWidth="24" strokeLinecap="round" />
        <Path d={ROUTE} fill="none" stroke={colors.border} strokeWidth="1.5" strokeLinecap="round" />
        <AnimatedPath
          d={ROUTE}
          fill="none"
          stroke={colors.mint}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={[ROUTE_LENGTH, ROUTE_LENGTH]}
          animatedProps={routeProps}
        />
        {STAGES.map((point, index) => <StageMarker
          key={index}
          x={point.x}
          y={point.y}
          current={index === state.activeStage}
          completed={index < state.activeStage}
          endpoint={index === 2}
          visible={visible}
          color={colors.mint}
          background={colors.bg}
          border={colors.border}
        />)}
        <Circle cx="286" cy="38" r="23" fill={colors.bg} stroke={state.activeStage === 2 ? colors.mint : colors.border} strokeWidth="1" />
        <SvgImage href={require('../../assets/brand/freed-symbol.png')} x="266" y="18" width="40" height="40" preserveAspectRatio="xMidYMid meet" />
      </Svg>
    </View>
    {showStageLabels && <View style={styles.labels} accessible={false}>
      {stages.map((label, index) => <View key={index} style={styles.labelCell}>
        <Text translate={false} style={{ color: index === state.activeStage ? colors.mint : colors.text2, fontSize: 12, fontWeight: '600', marginBottom: 4, fontVariant: ['tabular-nums'] }}>{ordinals.format(index + 1)}</Text>
        <Text style={{ color: index === state.activeStage ? colors.text : colors.text2, fontSize: 17, lineHeight: 24, fontWeight: index === state.activeStage ? '600' : '400' }}>{label}</Text>
      </View>)}
    </View>}
    {caption ? <Text style={[styles.caption, { color: colors.text2 }]}>{caption}</Text> : null}
  </View>;
}

function StageMarker({ x, y, current, completed, endpoint, visible, color, background, border }: {
  x: number;
  y: number;
  current: boolean;
  completed: boolean;
  endpoint: boolean;
  visible: boolean;
  color: string;
  background: string;
  border: string;
}) {
  const { spatialMotion } = useMotionSettings(visible);
  const emphasis = useSharedValue(current ? 1 : 0);
  useEffect(() => {
    cancelAnimation(emphasis);
    emphasis.set(spatialMotion ? withTiming(current ? 1 : 0, { duration: MOTION.duration.base, easing: MOTION.easing }) : current ? 1 : 0);
    return () => cancelAnimation(emphasis);
  }, [current, spatialMotion, emphasis]);
  const ringProps = useAnimatedProps(() => ({ opacity: emphasis.get() }));
  return <G>
    <AnimatedCircle cx={x} cy={y} r={endpoint ? 28 : 15} fill="none" stroke={color} strokeWidth="1.5" animatedProps={ringProps} />
    {!endpoint && <>
      <Circle cx={x} cy={y} r="7" fill={completed || current ? color : background} stroke={completed || current ? color : border} strokeWidth="2" />
      <Circle cx={x} cy={y} r="2" fill={completed || current ? background : border} />
    </>}
  </G>;
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 12 },
  labels: { flexDirection: 'row', gap: 12 },
  labelCell: { flex: 1, minWidth: 0 },
  caption: { fontSize: 15, lineHeight: 24 },
});
