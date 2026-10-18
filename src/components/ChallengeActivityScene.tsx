import React from 'react';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text, View } from './Localized';
import { KiteCompanionRig } from './KiteCompanionRig';
import { useAppTheme } from '@/design-system/use-app-theme';
import { getCategoryPanelPalette, type PracticeCategory } from '@/design-system/app-palette';
import { useMotionSettings } from '@/design-system/motion';
import { useOptionalAppPreferences } from '@/hooks/use-app-preferences';
import { useCompanionViewport } from '@/hooks/use-companion-viewport';
import { getBreathingPhase } from '@/lib/breathing-cadence';
import type { CompanionPose } from '@/lib/companion-policy';
import { challengeCategory } from './ChallengeCategoryArt';
import type { RecoveryChallenge } from '@/lib/recovery-engine';

/** Display-only scene. It reads active session seconds; it owns no clock or completion authority. */
export function ChallengeActivityScene({ challenge, elapsedSec, running, progress, status, rewardLabel }: {
  challenge: RecoveryChallenge; elapsedSec: number; running: boolean; progress: string; status: string; rewardLabel?: string | null;
}) {
  const { mode, colors } = useAppTheme();
  const { t } = useTranslation();
  const preferences = useOptionalAppPreferences();
  const viewport = useCompanionViewport();
  const motion = useMotionSettings(viewport.visible);
  const comfortable = /^momentum-breathe-(soft|exhale)(:earned-v2:(300|600|1200))?$/.test(challenge.id) && challenge.verification?.kind === 'timer';
  const phase = getBreathingPhase([4, 6], elapsedSec * 1000);
  const category: PracticeCategory = challenge.category === 'breathing' ? 'calm' : challenge.category === 'reflection' ? 'reflection' : challengeCategory(challenge.choiceGroup ?? 'move');
  const palette = getCategoryPanelPalette(category, mode);
  const pose: CompanionPose = challenge.category === 'breathing' ? 'breathe' : challenge.category === 'reflection' ? 'write' : challenge.category === 'connection' ? 'connect' : challenge.choiceGroup === 'find' ? 'focus' : 'move';
  const phaseProgress = useSharedValue(0), still = useSharedValue(0);
  const animated = motion.spatialMotion && preferences?.preferences.companionMotion !== 'off';
  React.useEffect(() => {
    cancelAnimation(phaseProgress);
    if (comfortable && running && animated) {
      const duration = phase.phaseIndex === 0 ? 4 : 6;
      const fraction = 1 - phase.secondsRemaining / duration;
      // Smooth only the last observed state. Never extrapolate toward the next second.
      phaseProgress.value = withTiming(phase.phaseIndex === 0 ? fraction : 1 - fraction, { duration: 240, easing: Easing.out(Easing.quad) });
    }
    return () => cancelAnimation(phaseProgress);
  }, [comfortable, running, animated, phase.phaseIndex, phase.secondsRemaining, phaseProgress]);
  return <View ref={viewport.ref} onLayout={viewport.onLayout} collapsable={false} testID="challenge-activity-scene" style={{ padding: 20, gap: 16, borderRadius: 24, borderCurve: 'continuous', backgroundColor: palette.surface }}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center', width: 168, height: 168 }}>
      <KiteCompanionRig pose={pose} category={category} width={168} height={168} animated={animated} drift={still} gesture={still} blink={still} phaseProgress={phaseProgress} scene dark={mode === 'dark'} />
    </View>
    {comfortable ? <View style={{ gap: 8 }}><Text translate={false} testID="challenge-breathing-phase" style={{ color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '700', textAlign: 'center' }}>{!running ? t('resetChoices.paused') : t(phase.phaseIndex === 0 ? 'resetChoices.inhale' : 'resetChoices.exhale')}</Text><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: 'center' }}>{t('resetChoices.easyBreathing')}</Text></View> : null}
    <Text testID="challenge-actual-progress" style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] }}>{challenge.verification?.kind === 'timer' ? t('resetChoices.activeSeconds', { elapsed: Math.min(Math.max(0, elapsedSec), challenge.durationSec), required: challenge.durationSec }) : progress || status}</Text>
    {rewardLabel ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: 'center' }}>{rewardLabel}</Text> : null}
  </View>;
}
