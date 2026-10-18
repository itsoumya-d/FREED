import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { appI18n, localizedNumber } from '@/i18n/runtime';
import { SUPPORTED_LANGUAGES } from '@/lib/app-preferences';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import { createDefaultRecoveryState, recordDailyCheckIn, recordDailyHabitCompletion } from '@/lib/recovery-state';

jest.mock('expo-image', () => ({ Image: (props: object) => require('react').createElement(require('react-native').View, props) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined), notificationAsync: jest.fn().mockResolvedValue(undefined), impactAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@expo/ui/datetimepicker', () => ({ DateTimePicker: (props: object) => require('react').createElement(require('react-native').View, props) }));

let mockMode: 'light' | 'dark' = 'light';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026,9,3,12)); });
afterEach(async () => { jest.useRealTimers(); jest.restoreAllMocks(); mockMode = 'light'; await appI18n.changeLanguage('en'); });
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('lucide-react-native', () => ({ Check: () => null, Shield: () => null, ShieldCheck: () => null, NotebookPen: () => null, Dumbbell: () => null, Brain: () => null, Snowflake: () => null, BookOpen: () => null, Target: () => null, LifeBuoy: () => null, Info: () => null, Calendar: () => null, X: () => null, ChevronRight: () => null, ChevronLeft: () => null }));
jest.mock('@/components/BrandLogo', () => ({ BrandLogo: () => null }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@react-navigation/native', () => ({ NavigationContext: require('react').createContext(null) }));

const today=new Date(2026,9,3,12);
test('Progress browses previous weeks and disables future selection',()=>{
 const screen=render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={()=>undefined} />);
 expect(screen.getByTestId('history-day-2026-10-04')).toBeDisabled();
 fireEvent.press(screen.getByTestId('calendar-previous-week')); expect(screen.getByTestId('history-day-2026-09-21')).toBeTruthy();
 fireEvent.press(screen.getByTestId('calendar-next-week')); fireEvent.press(screen.getByTestId('history-day-2026-10-01'));
 expect(screen.getByText('Past days are read-only.')).toBeTruthy(); expect(screen.queryByTestId('habit-journal')).toBeNull();
});
test('historical private notes and explicit answers are readable without translation',async()=>{
 const state=recordDailyCheckIn(createDefaultRecoveryState(),{mood:'low',urgeLevel:4,sleepQuality:2,reflection:'Move your body 私の記録'},new Date(2026,9,1,12).toISOString());
 await appI18n.changeLanguage('fr'); const screen=render(<RecoveryHistory state={state} onCheckIn={()=>undefined} />);
 fireEvent.press(screen.getByTestId('history-day-2026-10-01')); expect(screen.getByTestId('history-journal-note')).toHaveTextContent('Move your body 私の記録');
});
test('a journal-only day shows no invented check-in answers',()=>{
 const {recordJournalForDate}=require('@/lib/recovery-day-write');
 const state=recordJournalForDate(createDefaultRecoveryState(),'Private note','2026-10-03',today);
 const screen=render(<RecoveryHistory state={state} onCheckIn={()=>undefined} />);
 expect(screen.getByText('No check-in answers recorded.')).toBeTruthy(); expect(screen.getByTestId('history-journal-note')).toHaveTextContent('Private note');
});
test('native history picker uses inline presentation and rejects future dates',()=>{
 const screen=render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={()=>undefined} />);
 fireEvent.press(screen.getByTestId('calendar-choose-date')); const picker=screen.getByTestId('calendar-native-date-picker');
 expect(picker.props.presentation).toBe('inline'); expect(picker.props.maximumDate).toEqual(today);
 fireEvent(picker,'onChange',{type:'set'},new Date(2026,9,4,12)); fireEvent.press(screen.getByTestId('calendar-confirm-date'));
 expect(screen.getByTestId('history-day-2026-10-03').props.accessibilityState.selected).toBe(true);
});
test.each(SUPPORTED_LANGUAGES.flatMap(language=>(['light','dark'] as const).map(mode=>[language,mode] as const)))('%s %s keeps native date navigation usable',async(language,mode)=>{
 mockMode=mode; await appI18n.changeLanguage(language); const screen=render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={()=>undefined} />);
 expect(screen.getByTestId('history-day-2026-10-03').props.accessibilityState.selected).toBe(true); expect(screen.getByTestId('history-day-2026-10-04')).toBeDisabled();
});
