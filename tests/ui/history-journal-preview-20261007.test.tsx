import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import type { JournalEntry } from '@/lib/journal-repository';
import { createDefaultRecoveryState, recordDailyCheckIn } from '@/lib/recovery-state';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: true }) }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null }));
jest.mock('lucide-react-native', () => ({ Calendar: () => null, X: () => null, Check: () => null }));
beforeEach(() => { jest.useFakeTimers({ now: new Date(2026, 9, 7, 12) }); });
afterEach(() => { jest.useRealTimers(); });
function entry(text: string, legacySourceId?: string): JournalEntry {
  return { id: 'private-entry', ownerId: 'owner-a', revision: 1, dateKey: '2026-09-29', title: 'Private title', text, photos: [],
    createdAt: '2026-09-29T12:00:00.000Z', updatedAt: '2026-09-29T12:00:00.000Z', savedDraftId: 'private-draft', legacySourceId };
}
test('independent journal entries appear as recorded read-only days without inventing check-in or practice events', () => {
  const state = createDefaultRecoveryState(), before = JSON.parse(JSON.stringify(state)), checkIn = jest.fn();
  const view = render(<RecoveryHistory {...{ journalEntries: [entry('My untranslated 私の記録')] } as any} state={state} onCheckIn={checkIn} />);
  fireEvent.press(view.getByTestId('calendar-previous-week'));
  expect(view.getByTestId('history-day-2026-09-29').props.accessibilityLabel).toContain('Recorded activity');
  fireEvent.press(view.getByTestId('history-day-2026-09-29'));
  expect(view.getByTestId('history-journal-entry-private-entry')).toHaveTextContent('My untranslated 私の記録');
  expect(view.queryByText('No records are available for this date. Missing a task does not log a setback.')).toBeNull();
  expect(view.getByText('Past days are read-only.')).toBeOnTheScreen();
  expect(state).toEqual(before); expect(checkIn).not.toHaveBeenCalled();
});
test('migrated source IDs suppress only their matching legacy note, including a deleted migration tombstone', () => {
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'low', urgeLevel: 3, reflection: 'Legacy private words' }, '2026-09-29T12:00:00.000Z');
  const sourceId = `2026-09-29:${state.dailyCheckIns[0].id}`;
  const view = render(<RecoveryHistory {...{ journalEntries: [entry('Updated private words', sourceId)] } as any} state={state} onCheckIn={jest.fn()} />);
  fireEvent.press(view.getByTestId('calendar-previous-week')); fireEvent.press(view.getByTestId('history-day-2026-09-29'));
  expect(view.getByTestId('history-journal-entry-private-entry')).toHaveTextContent('Updated private words');
  expect(view.queryByTestId('history-journal-note')).toBeNull();
  expect(view.getByText('low')).toBeOnTheScreen();
  view.rerender(<RecoveryHistory {...{ journalEntries: [], journalLegacySourceIds: [sourceId] } as any} state={state} onCheckIn={jest.fn()} />);
  expect(view.queryByText('Legacy private words')).toBeNull();
  expect(view.queryByTestId('history-journal-entry-private-entry')).toBeNull();
});
