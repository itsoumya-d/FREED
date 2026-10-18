import React from 'react';
import { Text, View, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import { MomentumCompanion, type CompanionPose, type CompanionHelp, type CompanionCue } from './MomentumCompanion';
import { useWindowDimensions } from 'react-native';
import { translateSource } from '@/i18n/runtime';
import { useTranslation } from 'react-i18next';

import type { RecoveryDaySnapshot } from '@/lib/recovery-day-snapshot';

export type RecoveryHeroProps = { days: number; elapsed: string; milestone: string; progress?: number; onProgress: () => void; snapshot?: RecoveryDaySnapshot; companionPose?: CompanionPose; companionContext?: string; companionHelp?: CompanionHelp; companionCue?: CompanionCue; companionVisible?: boolean };

/** Recorded duration only. Milestone fill is supplied by the recovery state. */
export function RecoveryHero({ days, elapsed, milestone, progress = 0, onProgress, snapshot, companionPose, companionContext, companionHelp, companionCue, companionVisible = true }: RecoveryHeroProps) {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale > 1.3;
  const historical = snapshot?.readOnly ?? false;
  const recordedDays = snapshot ? snapshot.streak.days : days;
  const recordedStart = historical ? snapshot?.streak.startedAt ? t('companion.recordedStart', { date: new Date(snapshot.streak.startedAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' }) }) : t('companion.unavailableStreak') : elapsed || translateSource('Start today');
  const fill = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return <View style={{ backgroundColor: colors.heroSurface, borderRadius: 16, borderCurve: 'continuous', padding: 12, gap: 4 }}>
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: 8 }}>
      <Pressable testID="recovery-hero" onPress={onProgress} accessibilityRole="button" accessibilityLabel="View milestones and recovery history" accessibilityHint={recordedStart} style={({ pressed }) => ({ flex: stacked ? undefined : 1, alignSelf: 'stretch', justifyContent: 'center', gap: 4, minHeight: 44, opacity: pressed ? .75 : 1 })}>
        <Text translate={false} selectable testID="home-streak-days" style={{ color: colors.text, fontSize: 32, lineHeight: 36, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -.8 }}>{recordedDays === null ? t('companion.unavailableStreak') : t('momentum.recordedDays', { count: recordedDays, defaultValue: recordedDays === 1 ? '{{count}} day' : '{{count}} days' })}</Text>
        <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{t(historical ? 'companion.historicalStreak' : 'momentum.recordedStreak')}</Text>
        {!historical ? <View testID="home-milestones" style={{ paddingTop: 4, gap: 4 }}>
          <Text style={{ color: colors.accent, fontSize: 13, lineHeight: 16 }}>{milestone}</Text>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={milestone} accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }} style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}><View style={{ width: `${fill * 100}%`, height: 8, backgroundColor: colors.accent, borderRadius: 4 }} /></View>
        </View> : null}
      </Pressable>
      <View><MomentumCompanion visible={companionVisible} pose={companionPose ?? (historical ? 'read' : undefined)} context={companionContext ?? (historical ? 'history' : 'today')} help={companionHelp} cue={companionCue} variant="progress" width={stacked ? 112 : 88} height={88} interactive /></View>
    </View>
    <Text testID="home-recorded-start" translate={false} selectable style={{ color: colors.text2, fontSize: 12, lineHeight: 16 }}>{recordedStart}</Text>
  </View>;
}
