import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { RecoveryHero } from '@/components/RecoveryHero';
import { MomentumToday, type MomentumTodayProps } from '@/components/MomentumToday';
import { useTodayClock } from '@/components/use-today-clock';
import { appI18n, translateSource } from '@/i18n/runtime';

jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@react-navigation/native', () => ({ NavigationContext: require('react').createContext(null) }));
jest.mock('lucide-react-native', () => Object.fromEntries(['Check','Shield','ShieldCheck','NotebookPen','Dumbbell','Brain','Snowflake','BookOpen','Target','LifeBuoy','ChevronRight','ChevronLeft'].map(key => [key, () => null])));
const yesterday = new Date(2026, 9, 3, 23, 59, 59);
const nextDay = new Date(2026, 9, 4, 0, 0, 0, 100);
beforeEach(async () => { jest.spyOn(Date, 'now').mockReturnValue(yesterday.getTime()); await appI18n.changeLanguage('en'); });
afterEach(() => jest.restoreAllMocks());
const props = (): MomentumTodayProps => ({ today: yesterday, selectedDate: yesterday, onSelectDate: jest.fn(), days: 1, elapsed: '1 day', milestone: '14 days', milestoneProgress: 1/14, onProgress: jest.fn(), protectionLabel: 'Protection ready', protectionDetail: 'Review coverage', protectionReady: true, onProtection: jest.fn(), actionLabel: 'Take today’s pledge', onAction: jest.fn(), onPanic: jest.fn(), plannedKeys: ['journal'], habits: [{ key: 'journal', label: 'Journal', done: true, category: 'reflection', detail: 'Be honest with yourself' }], onHabitToggle: jest.fn(), pledged: false, onPledge: jest.fn(), tools: [] });

test('a pre-tick midnight press cannot use yesterday’s checkbox or next action', () => {
  const value = props(); const screen = render(<MomentumToday {...value} />);
  jest.mocked(Date.now).mockReturnValue(nextDay.getTime());
  fireEvent.press(screen.getByTestId('habit-journal'));
  expect(value.onHabitToggle).not.toHaveBeenCalled(); expect(value.onPledge).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('home-primary-action'));
  expect(value.onAction).not.toHaveBeenCalled();
});
test('foreground refreshes the clock immediately before the periodic tick', () => {
  let foreground: (state: string) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { foreground = callback; return { remove: () => undefined }; });
  const hook = renderHook(() => useTodayClock(true));
  jest.mocked(Date.now).mockReturnValue(nextDay.getTime());
  act(() => foreground('active'));
  expect(hook.result.current).toBe(nextDay.getTime());
});
test('no recorded start is a standalone localized prompt', async () => {
  await appI18n.changeLanguage('fr');
  const screen = render(<RecoveryHero days={0} elapsed="" milestone="14 days" onProgress={() => undefined} />);
  expect(screen.getByTestId('home-recorded-start')).toHaveTextContent(translateSource('Start today'));
  expect(screen.getByTestId('home-recorded-start')).not.toHaveTextContent(/depuis|redémarrage/);
});

test('the write boundary uses the live day’s completion and rejects a queued historical toggle', () => {
  const { recordPracticeToggle } = require('@/components/record-practice-toggle');
  const { createDefaultRecoveryState, recordDailyHabitCompletion, getLocalDateKey, getDailyHabitCompletionsForDay } = require('@/lib/recovery-state');
  const state = recordDailyHabitCompletion(createDefaultRecoveryState(), { key: 'journal', label: 'Journal', completed: true }, yesterday.toISOString());
  expect(recordPracticeToggle(state, { key: 'journal', label: 'Journal', dateKey: getLocalDateKey(yesterday) }, nextDay.getTime())).toBe(state);
  const updated = recordPracticeToggle(state, { key: 'journal', label: 'Journal', dateKey: getLocalDateKey(nextDay) }, nextDay.getTime());
  expect(getDailyHabitCompletionsForDay(updated, nextDay)[0]?.completed).toBe(true);
  expect(getDailyHabitCompletionsForDay(updated, yesterday)[0]?.completed).toBe(true);
});
