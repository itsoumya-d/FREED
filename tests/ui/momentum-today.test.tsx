import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { appI18n, localizedNumber } from '@/i18n/runtime';
import { SUPPORTED_LANGUAGES } from '@/lib/app-preferences';
import { MomentumToday, type MomentumTodayProps } from '@/components/MomentumToday';

let mockMode: 'light' | 'dark' = 'light';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 3, 12)); });
afterEach(async () => { jest.useRealTimers(); jest.restoreAllMocks(); mockMode = 'light'; await appI18n.changeLanguage('en'); });
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('lucide-react-native', () => ({ Check: () => null, Shield: () => null, ShieldCheck: () => null, NotebookPen: () => null, Dumbbell: () => null, Brain: () => null, Snowflake: () => null, BookOpen: () => null, Target: () => null, LifeBuoy: () => null, Info: () => null, X: () => null, ChevronRight: () => null, ChevronLeft: () => null }));
jest.mock('@/components/BrandLogo', () => ({ BrandLogo: () => null }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@react-navigation/native', () => ({ NavigationContext: require('react').createContext(null) }));

const today = new Date(2026, 9, 3, 12);
const base: MomentumTodayProps = {
  today, selectedDate: today, onSelectDate: jest.fn(), days: 12, elapsed: '12d 0h', milestone: '12 of 14 days', milestoneProgress: 12 / 14,
  onProgress: jest.fn(), protectionLabel: 'Finish protection setup', protectionDetail: 'Add your devices and preferences', protectionReady: false, onProtection: jest.fn(),
  actionLabel: "Start today's check-in", onAction: jest.fn(), onPanic: jest.fn(), pledged: false, onPledge: jest.fn(),
  habits: ['adult-content-boundary', 'exercise', 'journal', 'meditation', 'cold-shower', 'social-media-boundary'].map((key, index) => ({ key, label: key, done: index < 2, category: 'calm' as const, detail: 'A daily practice' })),
  onHabitToggle: jest.fn(), tools: []
};

test('Today exposes help, next step and history without a calendar', () => {
 const onProgress=jest.fn(), onPanic=jest.fn(); const screen=render(<MomentumToday {...base} onProgress={onProgress} onPanic={onPanic} />);
 expect(screen.queryByTestId('calendar-choose-date')).toBeNull();
 fireEvent.press(screen.getByTestId('today-history')); expect(onProgress).toHaveBeenCalledTimes(1);
 fireEvent.press(screen.getByTestId('home-help-now')); expect(onPanic).toHaveBeenCalledTimes(1);
});
test('counts only check-in and chosen tasks while all practices remain reachable', () => {
 const screen=render(<MomentumToday {...base} plannedKeys={['exercise','journal']} checkInCompleted />);
 expect(screen.getByTestId('home-practice-count')).toHaveTextContent('2 / 3');
 expect(screen.queryByTestId('habit-cold-shower')).toBeNull();
 fireEvent.press(screen.getByTestId('home-all-practices'));
 expect(screen.getByText('cold-shower')).toBeTruthy();
});
test('the plan picker limits selection to two and permits check-in-only days', async () => {
 const onPlanChange=jest.fn(); const screen=render(<MomentumToday {...base} plannedKeys={['exercise','journal']} onPlanChange={onPlanChange} />);
 fireEvent.press(screen.getByTestId('plan-edit'));
 expect(screen.getByTestId('plan-choice-meditation')).toBeDisabled();
 fireEvent.press(screen.getByTestId('plan-choice-exercise')); fireEvent.press(screen.getByTestId('plan-choice-journal'));
 fireEvent.press(screen.getByTestId('plan-save')); expect(onPlanChange).toHaveBeenCalledWith([]);
});
test('stale plan selections cannot silently cross midnight', () => {
 const onPlanChange=jest.fn(); const screen=render(<MomentumToday {...base} onPlanChange={onPlanChange} />);
 fireEvent.press(screen.getByTestId('plan-edit')); jest.setSystemTime(new Date(2026,9,4,0,0,1));
 screen.rerender(<MomentumToday {...base} today={new Date(2026,9,4,0,0,1)} onPlanChange={onPlanChange} />);
 fireEvent.press(screen.getByTestId('plan-save')); expect(onPlanChange).not.toHaveBeenCalled();
});
test('practice instructions and self-report completion are separate actions', () => {
 const toggle=jest.fn(); const screen=render(<MomentumToday {...base} plannedKeys={['journal']} onHabitToggle={toggle} />);
 fireEvent.press(screen.getByTestId('practice-detail-journal')); expect(toggle).not.toHaveBeenCalled();
 fireEvent.press(screen.getByTestId('practice-mark-done')); expect(toggle).toHaveBeenCalledWith(base.habits[2]);
});
test.each(SUPPORTED_LANGUAGES.flatMap(language=>(['light','dark'] as const).map(mode=>[language,mode] as const)))('%s %s preserves actual chosen task counts', async(language,mode)=>{
 mockMode=mode; await appI18n.changeLanguage(language); const screen=render(<MomentumToday {...base} plannedKeys={['exercise','journal']} checkInCompleted />);
 expect(screen.getByTestId('home-practice-count')).toHaveTextContent(`${localizedNumber(2)} / ${localizedNumber(3)}`);
 expect(screen.getByTestId('today-recorded-streak')).toHaveTextContent(`${appI18n.t('momentum.recordedStreak')} · ${localizedNumber(12)}`);
});
