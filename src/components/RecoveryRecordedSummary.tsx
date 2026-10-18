import React from 'react';
import { BookOpen, CheckCircle2, RotateCcw, Heart, Flag, CircleDot } from 'lucide-react-native';
import { SpringPressable } from '@/design-system/motion';
import { Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Pressable } from './Localized';
import { ChevronRight } from './DirectionalIcons';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n, localizedNumber, translateSource } from '@/i18n/runtime';
import { getLocalDateKey, getRecoveryChallengeCounts, isCheckInCompleted, hasSavedJournal, type RecoveryState, type ChallengeCompletion } from '@/lib/recovery-state';
import type { JournalEntry } from '@/lib/journal-repository';
import { buildRecoveryDaySnapshot } from '@/lib/recovery-day-snapshot';

export type ProgressResetDestination = Pick<ChallengeCompletion, 'id' | 'title' | 'toolId'>;
export type ProgressRecordActions = {
  onOpenJournalEntry?: (entryId: string) => void;
  onStartReset?: (reset: ProgressResetDestination) => void;
  canRepeatReset?: (reset: ProgressResetDestination) => boolean;
  onBrowseResets?: () => void;
};
type Activity = { key: string; dateKey: string; at: string; title: string; subtitle?: string; detail: React.ReactNode; journalId?: string };
const copy = (key: string, fallback: string, values?: Record<string, unknown>) => appI18n.t(`progressDaily.${key}`, { defaultValue: fallback, ...values });

/** Counts and activity share one selected civil-date interval. Drafts and undated totals stay outside it. */
export function RecoveryRecordedSummary({ state, date, now, period, onPeriodChange, onCheckIn, onReturnToday, journalEntries, journalLegacySourceIds, onOpenJournalEntry, onStartReset, canRepeatReset, onBrowseResets }: {
  state: RecoveryState; date: Date; now: number; period: 'day' | 'week'; onPeriodChange: (period: 'day' | 'week') => void;
  onCheckIn: () => void; onReturnToday: () => void; journalEntries: readonly Readonly<JournalEntry>[]; journalLegacySourceIds: readonly string[];
} & ProgressRecordActions) {
  const { colors, typography } = useAppTheme();
  const { width, fontScale } = useWindowDimensions(); const stacked = width < 360 || fontScale > 1.3;
  const endKey = getLocalDateKey(date), start = new Date(date); if (period === 'week') start.setDate(start.getDate() - 6);
  const startKey = getLocalDateKey(start), inRange = (key: string) => key >= startKey && key <= endKey;
  const checkins = state.dailyCheckIns.filter(item => inRange(item.dateKey) && isCheckInCompleted(item));
  const resets = getRecoveryChallengeCounts(state, startKey, endKey);
  const migrated = new Set([...journalLegacySourceIds, ...journalEntries.flatMap(entry => entry.legacySourceId ? [entry.legacySourceId] : [])]);
  const legacyNotes = state.dailyCheckIns.filter(item => inRange(item.dateKey) && hasSavedJournal(item) && !migrated.has(`${item.dateKey}:${item.id}`));
  const entries = journalEntries.filter(entry => inRange(entry.dateKey));
  const retainedResets = state.challengeHistory.filter(item => inRange(item.source === 'tool' && item.dateKey ? item.dateKey : getLocalDateKey(item.completedAt)));
  const helpful = retainedResets.filter(item => item.outcome === 'helped').sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  const nextAction = helpful ? copy('nextHelpful', 'Try this reset again and record how it feels.')
    : resets.helpful > 0 ? copy('nextHelpfulArchive', 'Try a familiar reset and record how it feels.')
      : resets.stillUrging > 0 ? copy('nextStillUrging', 'Try another comfortable reset, or contact someone you trust.')
        : resets.unknown > 0 ? copy('nextUnknown', 'Record whether your next reset helped.')
          : checkins.length > 0 ? copy('nextCheckins', "Check in again when you're ready.") : copy('nextEmpty', 'Start with a check-in. Add reset feedback after a reset.');
  const day = buildRecoveryDaySnapshot(state, date, now);
  const [detailKey, setDetailKey] = React.useState<string | null>(null);
  const body = { color: colors.text2, fontSize: 17, lineHeight: 26 } as const;
  const dateLabel = (value: Date) => value.toLocaleDateString(appI18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
  const outcomeLabel = (outcome: ChallengeCompletion['outcome']) => outcome === 'helped' ? copy('helped', 'It helped') : outcome === 'still-urging' ? copy('stillUrging', 'Still needed support') : copy('unknown', 'No helpfulness feedback recorded');
  const privateText = (text: string, testID?: string) => <Text testID={testID} translate={false} selectable style={{ color: colors.text, fontSize: 19, lineHeight: 28 }}>{text}</Text>;
  const activities: Activity[] = [
    ...checkins.map(item => ({ key: `checkin-${item.dateKey}`, dateKey: item.dateKey, at: item.createdAt, title: copy('checkIn', 'Check-in'), detail: <>{privateText(translateSource(item.mood ?? ''))}<Text translate={false} style={body}>{appI18n.t('purpose.urgeValue', { value: item.urgeLevel })}</Text>{item.sleepQuality !== null ? <Text translate={false} style={body}>{appI18n.t('purpose.sleepValue', { value: item.sleepQuality })}</Text> : null}</> })),
    ...entries.map(entry => ({ key: `journal-${entry.id}`, journalId: entry.id, dateKey: entry.dateKey, at: entry.createdAt, title: entry.title || copy('journalEntry', 'Journal entry'), subtitle: copy('journalEntry', 'Journal entry'), detail: <>{entry.text ? privateText(entry.text, `history-journal-entry-${entry.id}`) : null}{entry.photos.length ? <Text translate={false} style={body}>{copy('savedPhotos', '{{count}} saved photos', { count: entry.photos.length })}</Text> : null}</> })),
    ...legacyNotes.map(item => ({ key: `note-${item.id}`, dateKey: item.dateKey, at: item.updatedAt, title: copy('journalEntry', 'Journal entry'), detail: privateText(item.reflection, 'history-journal-note') })),
    ...retainedResets.map(item => ({ key: `reset-${item.sessionId ?? `${item.id}-${item.completedAt}`}`, dateKey: item.source === 'tool' && item.dateKey ? item.dateKey : getLocalDateKey(item.completedAt), at: item.completedAt, title: item.title, subtitle: outcomeLabel(item.outcome), detail: <Text translate={false} style={body}>{outcomeLabel(item.outcome)}</Text> })),
    ...state.dailyHabits.filter(item => inRange(item.dateKey) && item.completed).map(item => ({ key: `practice-${item.dateKey}-${item.key}`, dateKey: item.dateKey, at: item.updatedAt, title: appI18n.t(`companion.practices.${item.key}.title`, { defaultValue: item.label }), subtitle: copy('practiceRecorded', 'Practice recorded'), detail: <Text translate={false} style={body}>{copy('practiceRecorded', 'Practice recorded')}</Text> })),
    ...state.pledges.filter(item => inRange(item.dateKey)).map(item => ({ key: `pledge-${item.dateKey}`, dateKey: item.dateKey, at: item.createdAt, title: copy('pledgeRecorded', 'Daily pledge recorded'), detail: <Text translate={false} style={body}>{copy('pledgeRecorded', 'Daily pledge recorded')}</Text> })),
    ...state.relapseRecords.filter(item => inRange(getLocalDateKey(item.occurredAt))).map(item => ({ key: `setback-${item.id}`, dateKey: getLocalDateKey(item.occurredAt), at: item.occurredAt, title: copy('setbackRecorded', 'Setback recorded'), detail: privateText(item.note || item.trigger || '—') })),
  ].sort((a, b) => b.dateKey.localeCompare(a.dateKey) || Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
  const activityIcon = (key: string) => key.startsWith('journal-') || key.startsWith('note-') ? BookOpen : key.startsWith('reset-') ? RotateCcw : key.startsWith('checkin-') ? CheckCircle2 : key.startsWith('setback-') ? Heart : key.startsWith('pledge-') ? Flag : CircleDot;
  const detail = activities.find(item => item.key === detailKey);
  const open = (activity: Activity) => { if (activity.journalId && onOpenJournalEntry) onOpenJournalEntry(activity.journalId); else setDetailKey(activity.key); };
  const feedback = [
    { id: 'progress-helpful-count', label: appI18n.t('progressPurpose.helpful'), count: resets.helpful },
    { id: 'progress-still-urging-count', label: appI18n.t('progressPurpose.stillUrging'), count: resets.stillUrging },
    { id: 'progress-unknown-count', label: appI18n.t('progressPurpose.unknown'), count: resets.unknown },
  ].filter(item => item.count > 0);
  // A historical selection never directs a write to that day. Today has exactly one working action.
  const repeatable = helpful && onStartReset && (!canRepeatReset || canRepeatReset(helpful));
  const nextPress = !day.isToday ? onReturnToday : repeatable ? () => onStartReset!(helpful!) : resets.completed > 0 && onBrowseResets ? onBrowseResets : onCheckIn;
  const nextLabel = !day.isToday ? copy('returnToday', 'Return to today') : repeatable ? copy('repeatReset', 'Repeat this reset') : resets.completed > 0 && onBrowseResets ? copy('chooseReset', 'Choose a reset') : day.checkInCompleted ? appI18n.t('progressPurpose.reviewCheckin') : copy('startCheckIn', "Start today's check-in");
  return <>
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: colors.surface2, borderRadius: 14, borderCurve: 'continuous' }}>
      {(['day', 'week'] as const).map(value => <Pressable key={value} testID={`progress-period-${value}`} accessibilityRole="button" accessibilityState={{ selected: period === value }} onPress={() => onPeriodChange(value)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 12, borderCurve: 'continuous', backgroundColor: period === value ? colors.surface : 'transparent' }}><Text translate={false} style={{ color: period === value ? colors.accent : colors.text2, fontSize: 17, fontWeight: '700' }}>{value === 'day' ? copy('day', 'Day') : copy('week', 'Week')}</Text></Pressable>)}
    </View>
    <View testID="progress-recorded-summary" style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, padding: 16, gap: 16 }}>
      <View style={{ gap: 4 }}><Text testID="progress-summary-title" translate={period === 'day'} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: typography.heavy }}>{period === 'week' ? appI18n.t('progressPurpose.recordedWeek') : 'Your recorded day'}</Text><Text testID="progress-period-range" translate={false} style={body}>{period === 'day' ? dateLabel(date) : appI18n.t('progressPurpose.weekRange', { start: dateLabel(start), end: dateLabel(date) })}</Text></View>
      <View testID="progress-count-strip" style={{ flexDirection: stacked ? 'column' : 'row', gap: 8 }}>
        {[
          { id: 'progress-checkin-count', label: appI18n.t('progressCompact.checkins'), recordedLabel: appI18n.t('progressPurpose.checkins'), count: checkins.length },
          { id: 'progress-reset-count', label: appI18n.t('progressCompact.resets'), recordedLabel: appI18n.t('progressPurpose.resets'), count: resets.completed },
          { id: 'progress-journal-count', label: appI18n.t('progressCompact.journal'), recordedLabel: appI18n.t('progressCompact.savedJournal'), count: entries.length + legacyNotes.length },
        ].map(item => <View key={item.id} accessible accessibilityRole="text" accessibilityLabel={`${localizedNumber(item.count)}. ${item.recordedLabel}`} style={{ flex: stacked ? undefined : 1, minWidth: 0, flexDirection: stacked ? 'row' : 'column', alignItems: stacked ? 'center' : 'stretch', borderStartWidth: stacked ? 0 : 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 4, gap: 4 }}><Text testID={item.id} translate={false} selectable style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: typography.heavy, fontVariant: ['tabular-nums'] }}>{localizedNumber(item.count)}</Text><Text translate={false} style={{ flex: stacked ? 1 : undefined, minWidth: 0, flexShrink: 1, color: colors.text2, fontSize: 15, lineHeight: 22 }}>{item.label}</Text></View>)}
      </View>
      {feedback.length ? <View style={{ gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 }}><Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.bold }}>{appI18n.t('progressPurpose.feedbackTitle')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{feedback.map(item => <View key={item.id} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}><Text testID={item.id} translate={false} selectable style={{ color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: typography.bold }}>{localizedNumber(item.count)}</Text><Text translate={false} style={body}>{item.label}</Text></View>)}</View>{helpful ? <Text testID="progress-helpful-reset" translate={false} style={body}>{appI18n.t('progressPurpose.helpfulReset', { title: helpful.title })}</Text> : null}</View> : null}
    </View>
    <View testID="progress-recorded-activity" style={{ gap: 8 }}>
      <Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: typography.heavy }}>{copy('activity', 'Recorded activity')}</Text>
      {!day.isToday ? <Text style={body}>Past days are read-only.</Text> : null}
      {activities.length ? activities.map(activity => { const Icon = activityIcon(activity.key); return <Pressable key={activity.key} testID={`progress-activity-row-${activity.key}`} translate={false} accessibilityRole="button" accessibilityLabel={`${dateLabel(new Date(`${activity.dateKey}T12:00:00`))}. ${activity.title}${activity.subtitle ? `. ${activity.subtitle}` : ''}`} accessibilityHint={copy('openRecord', 'Open recorded details')} onPress={() => open(activity)} style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surface2 : 'transparent' })}><View accessible={false} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={colors.text2} /></View><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text translate={false} style={{ color: colors.text2, fontSize: 15, lineHeight: 22 }}>{dateLabel(new Date(`${activity.dateKey}T12:00:00`))}</Text><Text translate={false} numberOfLines={fontScale > 1.3 ? undefined : 2} style={{ color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: typography.bold }}>{activity.title}</Text>{activity.subtitle && activity.subtitle !== activity.title ? <Text translate={false} style={body}>{activity.subtitle}</Text> : null}</View><ChevronRight color={colors.text2} size={20} /></Pressable>; }) : <Text translate={false} style={body}>{appI18n.t('progressPurpose.noRecords')}</Text>}
      {retainedResets.length < resets.completed ? <Text translate={false} style={body}>{copy('archivedDetails', 'Older reset details are no longer retained. Their recorded totals are preserved.')}</Text> : null}
      <Text testID="progress-self-report-note" translate={false} style={body}>{appI18n.t('progressPurpose.selfReportNote')}</Text>
    </View>
    <View testID="progress-next-adjustment" style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 }}><Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: typography.heavy }}>{copy('nextStep', 'Next step')}</Text><Text testID="progress-next-adjustment-copy" translate={false} style={body}>{!day.isToday ? copy('pastNextStep', 'Return to today to record your next check-in or reset.') : nextAction}</Text><SpringPressable testID="progress-next-action" accessibilityRole="button" accessibilityLabel={nextLabel} onPress={nextPress} style={{ minHeight: 48, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.accent, padding: 12, alignItems: 'center', justifyContent: 'center' }}><Text translate={false} style={{ color: colors.onAccent, fontSize: 17, lineHeight: 24, fontWeight: '700' }}>{nextLabel}</Text></SpringPressable></View>
    <Modal visible={Boolean(detail)} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailKey(null)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>{detail ? <><View style={{ paddingHorizontal: 24, alignItems: 'flex-end' }}><Pressable testID="progress-detail-close" accessibilityRole="button" onPress={() => setDetailKey(null)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Done</Text></Pressable></View><ScrollView testID="progress-activity-detail" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}><Text translate={false} style={body}>{dateLabel(new Date(`${detail.dateKey}T12:00:00`))}</Text><Text translate={false} accessibilityRole="header" selectable style={{ color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: typography.heavy }}>{detail.title}</Text>{detail.detail}<Text translate={false} style={body}>{copy('readOnlyDetail', 'This is a saved record. Viewing it does not change it.')}</Text></ScrollView></> : null}</SafeAreaView></Modal>
  </>;
}
