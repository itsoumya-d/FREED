import React from 'react';
import { act, fireEvent, render, renderHook, within } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import { MomentumPageHeader, MomentumSection, useMomentumBottomPadding } from '@/components/MomentumPageHeader';
import { getAppPalette, getPracticePalette } from '@/design-system/app-palette';
import { appI18n } from '@/i18n/runtime';
import { createDefaultRecoveryState, recordChallengeCompletion, recordDailyCheckIn } from '@/lib/recovery-state';
import { challengeLibrary } from '@/lib/recovery-engine';
import type { JournalEntry } from '@/lib/journal-repository';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: false }) }));
let mockMode: 'light' | 'dark' = 'light';
let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
const now = new Date(2026, 9, 7, 12);
const saved: JournalEntry = { id: 'saved-private', ownerId: 'active-owner', revision: 1, dateKey: '2026-10-05', title: 'My private title 日本語', text: 'Full private text belongs in its reader.', photos: [], createdAt: new Date(2026, 9, 5, 18).toISOString(), updatedAt: new Date(2026, 9, 5, 18).toISOString(), savedDraftId: 'saved-draft' };
function recorded() {
  let state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, sleepQuality: 4 }, now.toISOString());
  return recordChallengeCompletion(state, challengeLibrary.find(item => item.id === 'breathing-478')!, new Date(2026, 9, 6, 12).toISOString(), undefined, 'helped', 'reset-private');
}
beforeEach(async () => { jest.useFakeTimers({ now }); mockMode = 'light'; mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 }; await appI18n.changeLanguage('en'); });
afterEach(async () => { jest.useRealTimers(); await appI18n.changeLanguage('en'); jest.restoreAllMocks(); });

test('one scoped summary shows real counts and newest-first rows without dumping private reader text', () => {
  const onJournal = jest.fn();
  const screen = render(<RecoveryHistory state={recorded()} onCheckIn={jest.fn()} journalEntries={[saved]} showSummary {...{ onOpenJournalEntry: onJournal } as any} />);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('1');
  expect(screen.getByTestId('progress-journal-count')).toHaveTextContent('1');
  expect(screen.queryByTestId('history-selected-day-details')).toBeNull();
  const rows = screen.getAllByTestId(/^progress-activity-row-/);
  expect(rows.map(row => row.props.testID)).toEqual(['progress-activity-row-checkin-2026-10-07', 'progress-activity-row-reset-reset-private', 'progress-activity-row-journal-saved-private']);
  expect(screen.queryByText(saved.text)).toBeNull();
  fireEvent.press(screen.getByTestId('progress-activity-row-journal-saved-private'));
  expect(onJournal).toHaveBeenCalledWith('saved-private');
  fireEvent.press(screen.getByTestId('progress-activity-row-checkin-2026-10-07'));
  expect(within(screen.getByTestId('progress-activity-detail')).getByText('steady')).toBeOnTheScreen();
  expect(within(screen.getByTestId('progress-activity-detail')).getByText('Urge level: 2 / 5')).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('progress-detail-close'));
  expect(screen.queryByTestId('progress-activity-detail')).toBeNull();
});

test('historical next step returns to today and never writes the selected historical day', () => {
  const onCheckIn = jest.fn(), state = Object.freeze(recorded());
  const screen = render(<RecoveryHistory state={state} onCheckIn={onCheckIn} showSummary />);
  fireEvent.press(screen.getByTestId('history-day-2026-10-06'));
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0');
  const next = within(screen.getByTestId('progress-next-adjustment')).getAllByRole('button');
  expect(next).toHaveLength(1);
  fireEvent.press(next[0]);
  expect(onCheckIn).not.toHaveBeenCalled();
  expect(screen.getByTestId('history-day-2026-10-07')).toHaveProp('accessibilityState', { selected: true, disabled: false });
});

test('week paging keeps a visible selected day and period aligned with the newly browsed week', () => {
  const screen = render(<RecoveryHistory state={recorded()} onCheckIn={jest.fn()} showSummary />);
  fireEvent(screen.getByTestId('history-week-pager'), 'layout', { nativeEvent: { layout: { width: 342 } } });
  fireEvent(screen.getByTestId('history-week-pager'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0 } } });
  expect(screen.getByTestId('history-day-2026-09-30')).toHaveProp('accessibilityState', { selected: true, disabled: false });
  expect(screen.getByTestId('progress-period-range')).toHaveTextContent(/Sep 30/);
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('0');
  fireEvent.press(screen.getByTestId('progress-period-day'));
  expect(screen.getByTestId('progress-period-range')).not.toHaveTextContent(/Sep 24/);
  expect(screen.getByTestId('history-week-pager').props.directionalLockEnabled).toBe(true);
  expect(screen.getByTestId('history-week-pager').props.nestedScrollEnabled).toBe(true);
});

test('empty summary has one action and suppresses zero feedback rows', () => {
  const screen = render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={jest.fn()} showSummary />);
  expect(screen.queryByTestId('progress-helpful-count')).toBeNull();
  expect(screen.queryByTestId('progress-still-urging-count')).toBeNull();
  expect(screen.queryByTestId('progress-unknown-count')).toBeNull();
  expect(screen.getAllByRole('button', { name: "Start today's check-in" })).toHaveLength(1);
});

test('dark large panels use neutral roles while compact practice surfaces preserve the approved colors', () => {
  mockMode = 'dark'; const tile = getPracticePalette('reflection', 'dark');
  const screen = render(<><MomentumPageHeader title="Progress" category="reflection" compact /><MomentumSection title="History" category="reflection"><></></MomentumSection></>);
  const header = screen.getByTestId('momentum-page-header');
  expect(StyleSheet.flatten(header.props.style).backgroundColor).not.toBe(tile.surface);
  const sectionHeading = screen.getByText('History').parent!;
  expect(StyleSheet.flatten(sectionHeading.props.style).backgroundColor).not.toBe(tile.surface);
  expect(tile.surface).toBe('#BFC1F2');
  expect(StyleSheet.flatten(screen.getByText('Progress').props.style).color).toBe(getAppPalette('dark').text);
});

test('large Arabic text stacks metrics without fixed text height or reversed gesture coordinates', async () => {
  mockDimensions = { width: 320, height: 640, scale: 3, fontScale: 1.8 }; await act(async () => { await appI18n.changeLanguage('ar'); });
  const screen = render(<RecoveryHistory state={recorded()} onCheckIn={jest.fn()} showSummary />);
  const strip = screen.getByTestId('progress-count-strip');
  expect(StyleSheet.flatten(strip.props.style).flexDirection).toBe('column');
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('١');
  expect(StyleSheet.flatten(screen.getByTestId('history-week-pager').props.style).direction).toBe('ltr');
});

test('bottom content padding follows measured insets and optional measured bar height instead of a fixed buffer', () => {
  const safeArea = require('react-native-safe-area-context');
  jest.spyOn(safeArea, 'useSafeAreaInsets').mockReturnValue({ top: 47, right: 0, bottom: 34, left: 0 });
  const padding = renderHook(() => useMomentumBottomPadding());
  expect(padding.result.current).toBe(58);
  const measured = renderHook(() => (useMomentumBottomPadding as any)(80));
  expect(measured.result.current).toBe(104);
});


test('one next action opens a retained helpful reset and otherwise opens the reset library', () => {
  const onReset = jest.fn(), onBrowse = jest.fn(), onCheckIn = jest.fn(); const state = recorded(), before = JSON.stringify(state);
  const screen = render(<RecoveryHistory state={state} onCheckIn={onCheckIn} onStartReset={onReset} onBrowseResets={onBrowse} showSummary />);
  fireEvent.press(screen.getByTestId('progress-next-action'));
  expect(onReset).toHaveBeenCalledWith(expect.objectContaining({ id: 'breathing-478', sessionId: 'reset-private' }));
  expect(onBrowse).not.toHaveBeenCalled(); expect(onCheckIn).not.toHaveBeenCalled(); expect(JSON.stringify(state)).toBe(before);
  const unknown = recordChallengeCompletion(createDefaultRecoveryState(), challengeLibrary.find(item => item.id === 'breathing-478')!, now.toISOString(), undefined, 'unknown', 'unknown-private');
  screen.rerender(<RecoveryHistory state={unknown} onCheckIn={onCheckIn} onStartReset={onReset} onBrowseResets={onBrowse} showSummary />);
  fireEvent.press(screen.getByTestId('progress-next-action')); expect(onBrowse).toHaveBeenCalledTimes(1); expect(onCheckIn).not.toHaveBeenCalled();
});

test('iOS automatic native tab insets receive content spacing without adding the safe area again', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.spyOn(require('react-native-safe-area-context'), 'useSafeAreaInsets').mockReturnValue({ top: 47, right: 0, bottom: 34, left: 0 });
  const padding = renderHook(() => useMomentumBottomPadding()); expect(padding.result.current).toBe(24);
});

test('saved journal migrations and deletion tombstones keep scoped counts and activity from resurrecting legacy text', () => {
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'low', urgeLevel: 3, reflection: 'Old private words' }, now.toISOString());
  const sourceId = `2026-10-07:${state.dailyCheckIns[0].id}`;
  const migrated = { ...saved, dateKey: '2026-10-07', legacySourceId: sourceId, title: 'Updated private title', text: 'Updated private words' };
  const screen = render(<RecoveryHistory state={state} onCheckIn={jest.fn()} journalEntries={[migrated]} showSummary />);
  expect(screen.getByTestId('progress-journal-count')).toHaveTextContent('1');
  expect(screen.queryByText('Old private words')).toBeNull();
  expect(screen.queryByTestId(`progress-activity-row-note-${state.dailyCheckIns[0].id}`)).toBeNull();
  screen.rerender(<RecoveryHistory state={state} onCheckIn={jest.fn()} journalEntries={[]} journalLegacySourceIds={[sourceId]} showSummary />);
  expect(screen.getByTestId('progress-journal-count')).toHaveTextContent('0');
  expect(screen.queryByTestId('progress-activity-row-journal-saved-private')).toBeNull();
  expect(screen.queryByText('Old private words')).toBeNull();
});
