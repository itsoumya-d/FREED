import React from 'react';
import { Modal, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DateTimePicker } from '@expo/ui/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Check, X } from 'lucide-react-native';
import { Text, View, Pressable } from './Localized';
import { ChevronLeft, ChevronRight } from './DirectionalIcons';
import { RecoveryMonthPicker } from './RecoveryMonthPicker';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n, localizedNumber } from '@/i18n/runtime';
import { useMotionSettings } from '@/design-system/motion';
import { useTodayClock } from './use-today-clock';
import { buildRecoveryDaySnapshot, recoveryDateSelection, resolveRecoveryDateSelection, type RecoveryDateSelection } from '@/lib/recovery-day-snapshot';
import { getLocalDateKey, type RecoveryState } from '@/lib/recovery-state';
import type { JournalEntry } from '@/lib/journal-repository';
import { recoveryWeekStart, shiftRecoveryWeek, recoveryWeekDates, recoveryWeekPages, recoveryWeekAtOffset } from './recovery-week-pager';
import { RecoveryRecordedSummary, type ProgressRecordActions } from './RecoveryRecordedSummary';

/** Dates reveal records. This component never offers a write for a historical day. */
export function RecoveryHistory({ state, onCheckIn, journalEntries = [], journalLegacySourceIds = [], showSummary = false, onOpenJournalEntry, onStartReset, canRepeatReset, onBrowseResets }: {
  state: RecoveryState; onCheckIn: () => void;
  showSummary?: boolean;
  /** The caller supplies only saved entries for the active owner, never drafts. */
  journalEntries?: readonly Readonly<JournalEntry>[];
  /** Retained migration IDs also suppress deleted legacy notes instead of resurrecting them. */
  journalLegacySourceIds?: readonly string[];
} & ProgressRecordActions) {
  const { colors } = useAppTheme();
  const { i18n } = useTranslation(); const rtl = i18n.dir() === 'rtl';
  const { width, fontScale } = useWindowDimensions();
  const now = useTodayClock(useMotionSettings().active); const today = new Date(now); const todayKey = getLocalDateKey(today);
  const [selection, setSelection] = React.useState<RecoveryDateSelection>({ mode: 'today' });
  const [period, setPeriod] = React.useState<'day' | 'week'>('week');
  const selected = resolveRecoveryDateSelection(selection, now), selectedKey = getLocalDateKey(selected);
  const [week, setWeek] = React.useState(today); const [picker, setPicker] = React.useState(false); const [pickerDate, setPickerDate] = React.useState(today);
  const latestMonday = recoveryWeekStart(today), requestedMonday = recoveryWeekStart(week);
  const todayWeekKey = getLocalDateKey(latestMonday);
  const monday = getLocalDateKey(requestedMonday) > todayWeekKey ? latestMonday : requestedMonday;
  const dates = recoveryWeekDates(monday), weekKey = getLocalDateKey(monday);
  const lastTodayWeek = React.useRef(todayWeekKey);
  React.useEffect(() => {
    const previous = lastTodayWeek.current; lastTodayWeek.current = todayWeekKey;
    if (previous !== todayWeekKey && selection.mode === 'today' && weekKey === previous) setWeek(new Date(now));
  }, [todayWeekKey, weekKey, selection.mode]);
  const next = shiftRecoveryWeek(monday, 1);
  const pager = React.useRef<ScrollView>(null);
  const [measuredWidth, setMeasuredWidth] = React.useState<number | null>(null);
  const pageWidth = measuredWidth ?? width;
  const pages = recoveryWeekPages(monday, today, rtl), currentPage = pages.findIndex(date => getLocalDateKey(date) === weekKey);
  React.useLayoutEffect(() => { pager.current?.scrollTo({ x: Math.max(0, currentPage) * pageWidth, animated: false }); }, [weekKey, pageWidth, rtl, currentPage]);
  const columns = pageWidth < 7 * 44 || fontScale > 1.3 ? 4 : 7;
  const gap = columns === 7 ? Math.min(4, Math.max(0, (pageWidth - 7 * 44) / 6)) : 4;
  const dayWidth = Math.max(44, (pageWidth - gap * (columns - 1)) / columns);
  const day = buildRecoveryDaySnapshot(state, selected, now);
  const journalDays = new Set(journalEntries.map(entry => entry.dateKey));
  const dayEntries = journalEntries.filter(entry => entry.dateKey === selectedKey);
  const migratedSources = new Set([...journalLegacySourceIds, ...journalEntries.flatMap(entry => entry.legacySourceId ? [entry.legacySourceId] : [])]);
  const migratedNote = Boolean(day.checkIn && migratedSources.has(`${day.checkIn.dateKey}:${day.checkIn.id}`));
  const resets = day.resetRecords;
  const browseWeek = (date: Date) => {
    const target = recoveryWeekStart(date), offset = (selected.getDay() + 6) % 7;
    const candidate = new Date(target.getFullYear(), target.getMonth(), target.getDate() + offset, 12);
    setWeek(target); if (showSummary) setSelection(recoveryDateSelection(getLocalDateKey(candidate) > todayKey ? today : candidate, now));
  };
  const select = (date: Date) => { if (Number.isFinite(date.getTime()) && getLocalDateKey(date) <= todayKey) { setSelection(recoveryDateSelection(date, now)); setWeek(date); } };
  const dateLabel = selected.toLocaleDateString(appI18n.language, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  const body = { color: colors.text2, fontSize: 15, lineHeight: 24 } as const;
  return <View testID="progress-history" style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '800' }}>Your recorded days</Text><Pressable testID="calendar-choose-date" accessibilityRole="button" accessibilityLabel="Choose a date" onPress={() => { setPickerDate(selected); setPicker(true); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Calendar color={colors.accent} size={24} /></Pressable></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pressable testID="calendar-previous-week" accessibilityRole="button" accessibilityLabel="Previous week" onPress={() => browseWeek(shiftRecoveryWeek(monday, -1))} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronLeft color={colors.accent} size={22} /></Pressable><Text translate={false} style={{ flex: 1, textAlign: 'center', ...body }}>{monday.toLocaleDateString(appI18n.language, { month: 'short', day: 'numeric' })} – {dates[6].toLocaleDateString(appI18n.language, { month: 'short', day: 'numeric' })}</Text><Pressable testID="calendar-next-week" accessibilityRole="button" accessibilityLabel="Next week" accessibilityState={{ disabled: getLocalDateKey(next) > todayKey }} disabled={getLocalDateKey(next) > todayKey} onPress={() => browseWeek(next)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: getLocalDateKey(next) > todayKey ? .4 : 1 }}><ChevronRight color={colors.accent} size={22} /></Pressable></View>
    <ScrollView ref={pager} testID="history-week-pager" horizontal pagingEnabled directionalLockEnabled nestedScrollEnabled
      bounces={false} showsHorizontalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
      contentOffset={{ x: Math.max(0, currentPage) * pageWidth, y: 0 }}
      onLayout={event => { const value = event.nativeEvent.layout.width; if (Number.isFinite(value) && value > 0) setMeasuredWidth(value); }}
      onMomentumScrollEnd={event => { const date = recoveryWeekAtOffset(pages, event.nativeEvent.contentOffset.x, pageWidth); if (date) browseWeek(date); }}
      accessibilityHint="Swipe left or right to browse weeks."
      style={{ flexGrow: 0, flexShrink: 0, direction: 'ltr' }} contentContainerStyle={{ direction: 'ltr' }}>
      {pages.map(page => <View key={getLocalDateKey(page)} testID={`history-week-${getLocalDateKey(page)}`}
        accessibilityElementsHidden={getLocalDateKey(page) !== weekKey} importantForAccessibility={getLocalDateKey(page) === weekKey ? 'auto' : 'no-hide-descendants'}
        style={{ width: pageWidth, flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap }}>{recoveryWeekDates(page).map(date => {
      const key = getLocalDateKey(date), active = key === selectedKey, future = key > todayKey;
      const recorded = !future && (journalDays.has(key) || buildRecoveryDaySnapshot(state, date, now).hasRecordedActivity);
      const formatted = date.toLocaleDateString(appI18n.language, { weekday: 'long', month: 'long', day: 'numeric' });
      const label = recorded ? appI18n.t('source.{{date}}. Recorded activity', { date: formatted }) : formatted;
      return <Pressable key={key} testID={`history-day-${key}`} translate={false} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled: future }} disabled={future} onPress={() => select(date)} style={{ width: dayWidth, minWidth: 44, minHeight: 80, borderRadius: 16, padding: 8, gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.accentTint : colors.surface2, opacity: future ? .4 : 1 }}><Text translate={false} style={{ color: active ? colors.accent : colors.text2, fontSize: 12 }}>{date.toLocaleDateString(appI18n.language, { weekday: 'short' })}</Text><Text translate={false} style={{ color: colors.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{localizedNumber(date.getDate())}</Text><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: recorded ? colors.accent : 'transparent' }} /></Pressable>;
    })}</View>)}
    </ScrollView>
    {selectedKey !== todayKey || weekKey !== todayWeekKey ? <Pressable testID="calendar-return-today" accessibilityRole="button" onPress={() => select(today)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Return to today</Text></Pressable> : null}
    {showSummary ? <RecoveryRecordedSummary state={state} date={selected} now={now} period={period} onPeriodChange={setPeriod} onCheckIn={onCheckIn} journalEntries={journalEntries} journalLegacySourceIds={journalLegacySourceIds} onReturnToday={() => select(today)} onOpenJournalEntry={onOpenJournalEntry} onStartReset={onStartReset} canRepeatReset={canRepeatReset} onBrowseResets={onBrowseResets} /> : null}
    {!showSummary ? <View testID="history-selected-day-details" style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 16, gap: 12 }}>
      <Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800' }}>{dateLabel}</Text>
      {day.readOnly ? <Text style={body}>Past days are read-only.</Text> : null}
      {!day.hasRecordedActivity && !day.plan && !dayEntries.length ? <><Text style={body}>No records are available for this date. Missing a task does not log a setback.</Text>{day.isToday ? <Pressable accessibilityRole="button" onPress={onCheckIn} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Start today's check-in</Text></Pressable> : null}</> : <>
        {dayEntries.length ? <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>Journal entries</Text>
          {dayEntries.map(entry => <View key={entry.id} style={{ gap: 4 }}>
            {entry.title ? <Text translate={false} selectable style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>{entry.title}</Text> : null}
            {entry.text ? <Text testID={`history-journal-entry-${entry.id}`} translate={false} selectable style={{ color: colors.text, fontSize: 17, lineHeight: 26 }}>{entry.text}</Text> : null}
            {entry.photos.length ? <View style={{ flexDirection: 'row', gap: 8 }}><Text style={body}>Saved photos</Text><Text translate={false} style={body}>{localizedNumber(entry.photos.length)}</Text></View> : null}
          </View>)}
        </View> : null}
        {day.checkIn ? <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>Check-in and journal</Text>{day.checkIn.mood !== null && day.checkIn.urgeLevel !== null ? <><Text style={body}>{day.checkIn.mood}</Text><Text translate={false} style={body}>{appI18n.t('purpose.urgeValue', { value: day.checkIn.urgeLevel })}</Text>{day.checkIn.sleepQuality !== null ? <Text translate={false} style={body}>{appI18n.t('purpose.sleepValue', { value: day.checkIn.sleepQuality })}</Text> : null}</> : <Text style={body}>No check-in answers recorded.</Text>}{day.checkIn.reflection && !migratedNote ? <Text testID="history-journal-note" translate={false} selectable style={{ color: colors.text, fontSize: 17, lineHeight: 26 }}>{day.checkIn.reflection}</Text> : null}</View> : null}
        <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>Practices</Text>{day.plan ? <Text translate={false} style={body}>{localizedNumber(day.completedPlannedTasks ?? 0)} / {localizedNumber(day.plannedTaskCount ?? 0)}</Text> : <Text style={body}>The plan for this date was not retained. Available practice records are shown below.</Text>}{day.practices.filter(item => item.recorded || day.plan?.practiceKeys.includes(item.key)).map(item => <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{item.done ? <Check color={colors.accent} size={18} /> : null}<Text translate={false} style={body}>{appI18n.t(`companion.practices.${item.key}.title`)} · {item.done ? appI18n.t('purpose.recorded') : appI18n.t('purpose.notRecorded')}</Text></View>)}{day.pledged ? <Text style={body}>Daily pledge recorded</Text> : null}</View>
        {day.resets > 0 ? <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>Completed resets</Text><Text translate={false} style={body}>{localizedNumber(day.resets)}</Text>{resets.length < day.resets ? <Text style={body}>Older reset details are no longer retained. Their recorded totals are preserved.</Text> : null}{resets.map(item => <View key={item.sessionId ?? item.id} style={{ gap: 4 }}><Text translate={false} style={{ color: colors.text, fontSize: 17 }}>{item.title}</Text><Text style={body}>{item.outcome === 'helped' ? 'It helped' : item.outcome === 'still-urging' ? 'Still needed support' : 'No helpfulness feedback recorded'}</Text></View>)}<Text style={body}>Completion and helpfulness are your recorded experience.</Text></View> : null}
        {day.slips.length ? <View style={{ gap: 8 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>Setbacks recorded</Text>{day.slips.map(item => <Text key={item.id} translate={false} selectable style={body}>{item.note || item.trigger || '—'}</Text>)}</View> : null}
        {day.protectedAttempts > 0 ? <Text translate={false} style={body}>{appI18n.t('purpose.protectedEvents', { count: day.protectedAttempts, defaultValue: '{{count}} recorded protection events' })}</Text> : null}
      </>}
    </View> : null}
    <Modal visible={picker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicker(false)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><View style={{ padding: 24, gap: 16 }}><Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setPicker(false)} style={{ alignSelf: 'flex-end', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><X color={colors.text} size={24} /></Pressable>{Platform.OS === 'web' ? <RecoveryMonthPicker value={pickerDate} maximumDate={today} onChange={setPickerDate} /> : <DateTimePicker value={pickerDate} mode="date" display="inline" presentation="inline" testID="calendar-native-date-picker" locale={appI18n.language} maximumDate={today} onChange={(_event, date) => { if (date) setPickerDate(date); }} />}<Pressable testID="calendar-confirm-date" accessibilityRole="button" onPress={() => { select(pickerDate); setPicker(false); }} style={{ minHeight: 56, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>View this day</Text></Pressable></View></SafeAreaView></Modal>
  </View>;
}
