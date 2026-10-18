import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { Text, View, Pressable } from '@/components/Localized';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import { FocusedFeatureContent } from '@/components/FeatureDirectory';
import { MomentumPageHeader, MomentumSection, MomentumMetricStrip } from '@/components/MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n, localeResources } from '@/i18n/runtime';
import { FEATURE_DEFINITIONS, FEATURE_DESTINATIONS } from '@/lib/feature-catalogue';
import { createBlockingAttempt } from '@/lib/blocking-engine';
import { calculateRecoveryScore, challengeLibrary } from '@/lib/recovery-engine';
import { buildRecoveryAnalyticsSnapshot } from '@/lib/recovery-analytics';
import { calculateRecoveryLevel, createDefaultRecoveryState, generateAchievementBadges, generateMonthlyGrowthReport, generateRecoveryInsight, generateWeeklyRecoveryReport, getLocalDateKey, recordBlockingAttempt, recordChallengeCompletion, recordDailyCheckIn, summarizeCheckIns, type RecoveryState } from '@/lib/recovery-state';
import { recordJournalForDate } from '@/lib/recovery-day-write';
import { buildRecoveryDaySnapshot } from '@/lib/recovery-day-snapshot';
import { buildLocalUrgeRiskForecast } from '@/lib/urge-risk-forecast';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
let mockMode: 'light' | 'dark' = 'light';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }), useOptionalAppPreferences: () => null }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: false }) }));
const now = new Date(2026, 9, 7, 12);
const reset = challengeLibrary.find(item => item.id === 'breathing-478')!;
const push = jest.fn();
function productionProgress() {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
  const start = source.indexOf('function AnalyticsScreen('), end = source.indexOf('\nfunction AnimatedHabitBar', start);
  const compiled = transpileModule(`${source.slice(start, end)}; return AnalyticsScreen;`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  const Icon = () => null;
  const deps = { React, View, Text, Pressable, ScrollView, useAppTheme, useTranslation, useMomentumBottomPadding: () => 96, appI18n, getLocalDateKey, buildRecoveryDaySnapshot, calculateRecoveryScore, MomentumPageHeader, FocusedFeatureContent, FEATURE_DEFINITIONS, FEATURE_DESTINATIONS, Card: MomentumSection, MomentumMetricStrip, RecoveryHistory, router: { push }, Metric: () => null, EmptyState: () => null, ProgressRing: () => null, AnimatedHabitBar: () => null, BarChart3: Icon, Check: Icon, Target: Icon, PillButton: ({ label, onPress, disabled }: any) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable> };
  return new Function(...Object.keys(deps), compiled)(...Object.values(deps));
}
function props(state: RecoveryState) {
  return { recoveryState: state, streakDays: state.streakDays, bestStreakDays: state.bestStreakDays, completedChallenges: state.completedChallenges, attemptsToday: state.attempts.length, premiumCapabilities: { relapsePrediction: true, deepRecoveryReports: true, advancedAnalytics: true }, recoveryLevel: calculateRecoveryLevel(state), achievements: generateAchievementBadges(state), checkInSummary: summarizeCheckIns(state, now), checkInInsight: generateRecoveryInsight(state, state.attempts.length, now), weeklyReport: generateWeeklyRecoveryReport(state, now), monthlyGrowthReport: generateMonthlyGrowthReport(state, now), analyticsSnapshot: buildRecoveryAnalyticsSnapshot(state, now), analyticsSharing: state.analyticsSharing, analyticsSharingReadiness: { ready: false, gaps: [] }, analyticsSendBusy: false, analyticsSendMessage: null, urgeRiskForecast: buildLocalUrgeRiskForecast(state, now), onCheckIn: jest.fn(), onEnableAnalyticsSharing: jest.fn(), onDisableAnalyticsSharing: jest.fn(), onSendAnalyticsSnapshot: jest.fn() };
}
function completed(state: RecoveryState, outcome: 'helped' | 'still-urging' | 'unknown', title = 'Comfortable breathing') {
  const id = `${outcome}-${state.challengeHistory.length}`;
  return recordChallengeCompletion(state, { ...reset, title }, new Date(2026, 9, 6, 12).toISOString(), undefined, outcome, id);
}
function deepFreeze(value: any): any { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); jest.clearAllMocks(); mockMode = 'light'; });
afterEach(async () => { jest.useRealTimers(); await appI18n.changeLanguage('en'); });

test('an empty account shows zero recorded check-ins and resets with a useful check-in action', () => {
  const Progress = productionProgress(), p = props(createDefaultRecoveryState());
  const screen = render(<Progress {...p} />);
  expect(screen.getByTestId('progress-history')).toBeOnTheScreen();
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0');
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('0');
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent("Start with a check-in. Add reset feedback after a reset.");
  fireEvent.press(within(screen.getByTestId('progress-next-adjustment')).getByRole('button', { name: "Start today's check-in" }));
  expect(p.onCheckIn).toHaveBeenCalledTimes(1);
  for (const label of ['Activity estimate', 'Activity Estimates', 'Clarity', 'Energy', 'Urge Control', 'Sleep Guard', 'Monthly growth']) expect(screen.queryByText(label)).toBeNull();
  expect(screen.queryAllByText(/%/)).toHaveLength(0);
});

test('an already completed check-in offers review without creating another record', () => {
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, sleepQuality: 4 }, now.toISOString());
  const Progress = productionProgress(), p = props(state), screen = render(<Progress {...p} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('1');
  fireEvent.press(within(screen.getByTestId('progress-next-adjustment')).getByRole('button', { name: "Review today's check-in" }));
  expect(p.onCheckIn).toHaveBeenCalledTimes(1);
  expect(state.dailyCheckIns).toHaveLength(1);
});

test('journal-only writing still offers a first check-in rather than review of missing answers', () => {
  const state = recordJournalForDate(createDefaultRecoveryState(), 'Only a private note', '2026-10-07', now);
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0');
  expect(within(screen.getByTestId('progress-next-adjustment')).getByRole('button', { name: "Start today's check-in" })).toBeOnTheScreen();
});

test('undated legacy totals are not assigned to the recorded week', () => {
  const state = createDefaultRecoveryState(); state.completedChallenges = 500; state.streakDays = 100; state.bestStreakDays = 200;
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0');
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('0');
  expect(screen.queryByTestId('progress-helpful-count')).toBeNull();
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent("Start with a check-in. Add reset feedback after a reset.");
});

test('the recorded week excludes journal-only and older check-ins and does not manufacture seven days of answers', () => {
  let state = createDefaultRecoveryState();
  state = recordDailyCheckIn(state, { mood: 'steady', urgeLevel: 2, sleepQuality: 4 }, new Date(2026, 9, 5, 12).toISOString());
  state = recordDailyCheckIn(state, { mood: 'low', urgeLevel: 4, sleepQuality: null }, new Date(2026, 9, 6, 12).toISOString());
  state = recordDailyCheckIn(state, { mood: 'steady', urgeLevel: 1, sleepQuality: 5 }, new Date(2026, 8, 30, 12).toISOString());
  state = recordJournalForDate(state, 'Private writing without check-in answers', '2026-10-07', now);
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('2');
  expect(screen.getByTestId('progress-self-report-note')).toHaveTextContent('Check-in answers and reset feedback are self-reported. Missing feedback stays unknown.');
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent("Check in again when you're ready.");
  fireEvent.press(screen.getByTestId(`progress-activity-row-note-${state.dailyCheckIns.find(item => item.dateKey === '2026-10-07')!.id}`));
  expect(screen.getByTestId('history-journal-note')).toHaveTextContent('Private writing without check-in answers');
});

test('completed resets keep explicit helpful, still-urging, and unknown feedback separate', () => {
  let state = completed(createDefaultRecoveryState(), 'helped', 'My private reset 日本語');
  state = completed(state, 'still-urging'); state = completed(state, 'unknown');
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('3');
  expect(screen.getByTestId('progress-helpful-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-still-urging-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-unknown-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-helpful-reset')).toHaveTextContent('Last reset you marked helpful: My private reset 日本語');
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent('Try this reset again and record how it feels.');
});

test.each([
  ['still-urging', 'Try another comfortable reset, or contact someone you trust.'],
  ['unknown', 'Record whether your next reset helped.'],
] as const)('%s feedback gives one matching adjustment without calling completion helpful', (outcome, message) => {
  const Progress = productionProgress(), screen = render(<Progress {...props(completed(createDefaultRecoveryState(), outcome))} />);
  expect(screen.queryByTestId('progress-helpful-count')).toBeNull();
  expect(screen.queryByTestId('progress-helpful-reset')).toBeNull();
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent(message);
  expect(screen.getAllByTestId('progress-next-adjustment')).toHaveLength(1);
});

test('dated archived feedback contributes truthful totals without inventing a missing reset title', () => {
  const state = createDefaultRecoveryState();
  const minute = String(Math.floor(new Date(2026, 9, 6, 12).getTime() / 60000));
  state.activityArchive.completionMinutes[minute] = { breathing: { helped: 2, 'still-urging': 1, unknown: 3 } };
  state.activityArchive.completionTotals = { breathing: { helped: 2, 'still-urging': 1, unknown: 3 } };
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('6');
  expect(screen.getByTestId('progress-helpful-count')).toHaveTextContent('2');
  expect(screen.getByTestId('progress-still-urging-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-unknown-count')).toHaveTextContent('3');
  expect(screen.queryByTestId('progress-helpful-reset')).toBeNull();
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent('Try a familiar reset and record how it feels.');
});

test('repeated blocked events and app opens never become recorded resets, helpful outcomes, or the next adjustment', () => {
  let state = createDefaultRecoveryState();
  for (let index = 0; index < 12; index += 1) state = recordBlockingAttempt(state, { ...createBlockingAttempt('https://pornhub.com', 'browser'), id: `blocked-${index}`, detectedAt: now.toISOString() });
  state.appSessions = [{ id: 'open', openedAt: now.toISOString(), closedAt: null, durationSec: 0 }];
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0');
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('0');
  expect(screen.queryByTestId('progress-helpful-count')).toBeNull();
  expect(screen.getByTestId('progress-next-adjustment-copy')).toHaveTextContent("Start with a check-in. Add reset feedback after a reset.");
  expect(screen.queryByText('Unlocked')).toBeNull();
  expect(screen.queryByText('Risks')).toBeNull();
});

test('Progress reads frozen records and calendar navigation without writes or sending analytics', () => {
  const state = deepFreeze(completed(createDefaultRecoveryState(), 'unknown')), before = JSON.stringify(state);
  const storageWrite = jest.spyOn(globalThis.localStorage, 'setItem');
  const Progress = productionProgress(), p = props(state), screen = render(<Progress {...p} />);
  fireEvent.press(screen.getByTestId('history-day-2026-10-06'));
  expect(screen.getByText('Past days are read-only.')).toBeOnTheScreen();
  expect(JSON.stringify(state)).toBe(before); expect(storageWrite).not.toHaveBeenCalled();
  expect(p.onSendAnalyticsSnapshot).not.toHaveBeenCalled(); expect(p.onEnableAnalyticsSharing).not.toHaveBeenCalled();
  storageWrite.mockRestore();
});

test('public Progress has no routes to scores, forecasts, or XP presentations', () => {
  const Progress = productionProgress(), screen = render(<Progress {...props(createDefaultRecoveryState())} />);
  for (const feature of FEATURE_DEFINITIONS.filter(feature => feature.group === 'Progress')) expect(screen.queryByTestId(`progress-detail-${feature.id}`)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Supporting details' })).toBeNull();
  expect(push).not.toHaveBeenCalled();
});

test('selecting a date updates the period summary and day/week controls without assigning later records to it', () => {
  let state = completed(createDefaultRecoveryState(), 'helped', 'A helpful recorded reset');
  state = recordDailyCheckIn(state, { mood: 'steady', urgeLevel: 2, sleepQuality: 4 }, new Date(2026, 9, 7, 12).toISOString());
  const Progress = productionProgress(), screen = render(<Progress {...props(state)} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('1');
  fireEvent.press(screen.getByTestId('history-day-2026-10-06'));
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0'); expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-period-range')).toHaveTextContent(/Oct 6/);
  expect(within(screen.getByTestId('progress-recorded-summary')).queryByRole('button', { name: "Start today's check-in" })).toBeNull();
  fireEvent.press(screen.getByTestId('progress-period-day')); expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('1');
  fireEvent.press(screen.getByTestId('history-day-2026-10-05')); expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('0');
  fireEvent.press(screen.getByTestId('calendar-return-today')); expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('1');
});

test.each(['urge-risk', 'achievements', 'weekly-report', 'monthly-growth', 'analytics'])('legacy focused %s opens honest recorded history', focus => {
  const Progress = productionProgress(), screen = render(<Progress {...props(completed(createDefaultRecoveryState(), 'unknown'))} focus={focus} />);
  expect(screen.getByTestId('progress-unavailable-view')).toBeOnTheScreen(); expect(screen.getByTestId('progress-recorded-summary')).toBeOnTheScreen();
  expect(screen.queryByText('Activity estimate')).toBeNull(); expect(screen.queryByText(/XP$/)).toBeNull(); expect(screen.queryByText('URGE ESTIMATE')).toBeNull();
});

test('changing the active language refreshes semantic Progress copy and counts on the mounted screen', async () => {
  const Progress = productionProgress(), screen = render(<Progress {...props(completed(createDefaultRecoveryState(), 'unknown'))} />);
  await act(async () => { await appI18n.changeLanguage('es'); });
  expect(screen.getByTestId('progress-summary-title')).toHaveTextContent('Tu semana registrada');
  expect(screen.getByTestId('progress-self-report-note')).toHaveTextContent('Las respuestas y opiniones reflejan tu propia experiencia. La falta de opinión no cuenta como un resultado conocido.');
  await act(async () => { await appI18n.changeLanguage('ar'); });
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('١');
});

const compactCategories: Record<string, readonly string[]> = {
  en: ['Check-ins', 'Resets', 'Journal'], hi: ['चेक-इन', 'अभ्यास', 'जर्नल'], es: ['Registros', 'Pausas', 'Diario'],
  pt: ['Check-ins', 'Pausas', 'Diário'], fr: ['Bilans', 'Pauses', 'Journal'], de: ['Check-ins', 'Pausen', 'Journal'],
  ar: ['تسجيلات', 'تمارين', 'يوميات'], ja: ['チェックイン', 'リセット', '日記'], ko: ['체크인', '리셋', '일기'], 'zh-Hans': ['签到', '重置', '日记'],
};

test.each(Object.keys(localeResources).flatMap(language => (['light', 'dark'] as const).map(mode => [language, mode] as const)))('%s %s keeps recorded counts localized and new copy readable', async (language, mode) => {
  mockMode = mode; await appI18n.changeLanguage(language);
  const Progress = productionProgress(), screen = render(<Progress {...props(completed(createDefaultRecoveryState(), 'unknown'))} />);
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent(language === 'ar' ? '١' : '1');
  expect(screen.getByTestId('progress-summary-title')).toHaveTextContent(appI18n.t('progressPurpose.recordedWeek'));
  const counts = within(screen.getByTestId('progress-count-strip'));
  for (const label of compactCategories[language]) expect(counts.getByText(label, { exact: true })).toBeOnTheScreen();
  expect(counts.getByLabelText(`${language === 'ar' ? '١' : '1'}. ${appI18n.t('progressPurpose.resets')}`)).toBeOnTheScreen();
  expect(counts.getByLabelText(`${language === 'ar' ? '٠' : '0'}. ${appI18n.t('progressPurpose.checkins')}`)).toBeOnTheScreen();
  expect(counts.getByLabelText(`${language === 'ar' ? '٠' : '0'}. ${appI18n.t('progressCompact.savedJournal')}`)).toBeOnTheScreen();
  expect(StyleSheet.flatten(screen.getByTestId('progress-self-report-note').props.style).fontSize).toBeGreaterThanOrEqual(17);
  expect(StyleSheet.flatten(screen.getByTestId('progress-next-adjustment-copy').props.style).fontSize).toBeGreaterThanOrEqual(17);
  expect(within(screen.getByTestId('progress-next-adjustment')).getByRole('button')).toBeOnTheScreen();
});

test('membership capability labels retain real benefits without unsupported report promises',()=>{
 const source=readFileSync('src/features/freed-app.tsx','utf8'),start=source.indexOf('function getMembershipCapabilityLabels('),end=source.indexOf('\nfunction LegacyProfileScreen',start);
 const fn=new Function(transpileModule(source.slice(start,end)+';return getMembershipCapabilityLabels;',{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)();
 const labels=fn({noAds:true,premiumChallenges:true,advancedAiCoach:true,sponsorAccountability:true,familySupport:true,advancedAnalytics:true,relapsePrediction:true,deepRecoveryReports:true});
 expect(labels).toEqual(['No ads','Premium resets','CLARA+','Sponsor','Family']);
});
