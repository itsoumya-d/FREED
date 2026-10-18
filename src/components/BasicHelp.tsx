import React from 'react';
import { AppState, Keyboard, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pressable, Text, View } from './Localized';
import { MomentumCompanion } from './MomentumCompanion';
import { getPracticePalette } from '@/design-system/app-palette';
import { BreathingCadenceArtwork } from './BreathingCadenceArtwork';
import { createBreathingClock } from './momentum-breathing-clock';
import { getBreathingPhase } from '@/lib/breathing-cadence';
import { getBreathingArtworkProgress, getBreathingArtworkTiming } from '@/lib/breathing-artwork';
import { useMotionSettings } from '@/design-system/motion';
import { useAppTheme } from '@/design-system/use-app-theme';
import { radii, spacing } from '@/constants/design';

/** Public support is an ephemeral presentation, never a journey/private exercise route. */
export function BasicHelpPresentation({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  React.useEffect(() => { if (visible) Keyboard.dismiss(); }, [visible]);
  return visible ? <Modal visible animationType="fade" presentationStyle="fullScreen" allowSwipeDismissal={false} onRequestClose={onClose}>
    <SafeAreaProvider><BasicHelp onClose={onClose} /></SafeAreaProvider>
  </Modal> : null;
}

/** Reuse observed foreground cadence; no storage, rewards, protection authority or SDK access. */
export function BasicHelp({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors, typography, mode } = useAppTheme();
  const calm = getPracticePalette("calm", mode);
  const motion = useMotionSettings();
  const { width } = useWindowDimensions();
  const clock = React.useRef(createBreathingClock()).current;
  const [running, setRunning] = React.useState(false);
  const [phase, setPhase] = React.useState(() => getBreathingPhase([4, 6], 0));
  const artworkProgress = useSharedValue(0);
  const artworkRef = React.useRef(artworkProgress); artworkRef.current = artworkProgress;
  const pause = React.useCallback(() => { clock.pause(performance.now()); setPhase(getBreathingPhase([4, 6], clock.elapsed(performance.now()))); setRunning(false); }, [clock]);
  // Pause on the lifecycle event itself, rather than counting until a later render.
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    return () => { subscription.remove(); clock.pause(performance.now()); cancelAnimation(artworkRef.current); };
  }, [clock, pause]);
  React.useEffect(() => { if (!motion.active) pause(); }, [motion.active, pause]);
  React.useEffect(() => {
    if (!running || !motion.active) return;
    const tick = () => setPhase(getBreathingPhase([4, 6], clock.elapsed(performance.now())));
    tick(); const timer = setInterval(tick, 250);
    return () => { clearInterval(timer); clock.pause(performance.now()); };
  }, [running, motion.active, clock]);
  React.useEffect(() => {
    cancelAnimation(artworkProgress);
    if (!motion.spatialMotion) { artworkProgress.set(200 / 950); return; }
    const label = phase.phaseIndex === 0 ? 'Inhale' : 'Exhale';
    const timing = getBreathingArtworkTiming([4, 6], phase.phaseIndex, clock.elapsed(performance.now()));
    artworkProgress.set(getBreathingArtworkProgress(label, timing.elapsedRatio));
    if (running && motion.active) artworkProgress.set(withTiming(getBreathingArtworkProgress(label, 1), { duration: timing.remainingMs, easing: Easing.linear }));
    return () => cancelAnimation(artworkProgress);
  }, [running, phase.phaseIndex, motion.active, motion.spatialMotion, clock, artworkProgress]);
  const close = () => { pause(); onClose(); };
  const actionStyle = (pressed: boolean, primary = false) => ({ minHeight: 52, padding: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous' as const, backgroundColor: primary ? colors.mint : colors.surface2, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: pressed ? .72 : 1 });
  return <SafeAreaView testID="public-basic-help" style={{ flex: 1, backgroundColor: colors.bg, direction: i18n.dir() }} accessibilityViewIsModal onAccessibilityEscape={close}>
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, width: '100%', maxWidth: 528, alignSelf: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('publicHelp.close')} onPress={close} style={({ pressed }) => actionStyle(pressed)}><Text translate={false} style={{ color: colors.text, fontSize: 17, fontWeight: typography.semibold, textAlign: 'center' }}>{t('publicHelp.close')}</Text></Pressable>
    </View>
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, gap: spacing.md }}>
      <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: spacing.md }}>

        <View style={{ backgroundColor: calm.surface, padding: spacing.md, borderRadius: radii.lg, borderCurve: 'continuous', gap: spacing.sm }}>
          <MomentumCompanion pose="reassure" context="public-basic-help" category="calm" variant="calm" width={56} height={56} interactive={false} idle={false} />
          <Text translate={false} accessibilityRole="header" style={{ color: calm.ink, fontSize: 24, lineHeight: 32, fontWeight: typography.bold }}>{t('publicHelp.title')}</Text>
          <Text translate={false} style={{ color: calm.ink, fontSize: 17, lineHeight: 24 }}>{t('publicHelp.description')}</Text>
        </View>
        <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('publicHelp.pace')}</Text>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: Math.min(220, Math.max(140, width - 80)), height: Math.min(220, Math.max(140, width - 80)) }}><BreathingCadenceArtwork diameter={Math.min(220, Math.max(140, width - 80))} progress={artworkProgress} /></View>
          <Text translate={false} accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: typography.bold }}>{running ? t(phase.phaseIndex === 0 ? 'publicHelp.inhale' : 'publicHelp.exhale') : t('publicHelp.paused')}</Text>
          <Text testID="public-help-count" translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, fontVariant: ['tabular-nums'] }}>{t('momentum.breathingSeconds', { count: phase.secondsRemaining })}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t(running ? 'publicHelp.pause' : 'publicHelp.begin')} onPress={() => {
          if (running) pause();
          else if (motion.active && AppState.currentState === 'active') { clock.resume(performance.now()); setRunning(true); }
        }} style={({ pressed }) => actionStyle(pressed, true)}><Text translate={false} style={{ color: colors.onAccent, fontSize: 17, fontWeight: typography.semibold, textAlign: 'center' }}>{t(running ? 'publicHelp.pause' : 'publicHelp.begin')}</Text></Pressable>
        <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t('publicHelp.grounding')}</Text>
        <Text translate={false} style={{ color: colors.text2, fontSize: 15, lineHeight: 22 }}>{t('publicHelp.exit')}</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
