import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import { appI18n } from '@/i18n/runtime';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import type { JournalEntry } from '@/lib/journal-repository';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: false }) }));
const now = new Date(2026, 9, 7, 12);
const privateText = 'SourceMeaningCase: saved photos 日本語';
function photoEntry(count: number): JournalEntry {
  return { id: 'photo-entry', ownerId: 'active-owner', revision: 1, dateKey: '2026-10-07', title: privateText, text: privateText,
    photos: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, fileName: `photo-p${index}.jpg`, thumbnailFileName: `thumb-p${index}.jpg`, width: 100, height: 100, bytes: 100, mime: 'image/jpeg' })),
    createdAt: now.toISOString(), updatedAt: now.toISOString(), savedDraftId: 'saved-photo-draft' };
}
beforeEach(async () => { jest.useFakeTimers({ now }); await appI18n.changeLanguage('en'); });
afterEach(async () => { jest.useRealTimers(); await appI18n.changeLanguage('en'); jest.restoreAllMocks(); });

test('Arabic two saved photos selects the real dual form while displaying the localized numeric count', async () => {
  // Real i18next resources distinguish dual from generic fallback; formatting the caller count first breaks this branch.
  appI18n.addResource('ar', 'translation', 'progressDaily.savedPhotos_two', 'صورتان محفوظتان · {{count}}');
  appI18n.addResource('ar', 'translation', 'progressDaily.savedPhotos_other', '{{count}} صور محفوظة');
  await appI18n.changeLanguage('ar');
  const state = createDefaultRecoveryState(), entry = photoEntry(2), before = JSON.stringify({ state, entry });
  const translate = jest.spyOn(appI18n, 't');
  const screen = render(<RecoveryHistory state={state} onCheckIn={jest.fn()} journalEntries={[entry]} showSummary />);
  fireEvent.press(screen.getByTestId('progress-activity-row-journal-photo-entry'));
  expect(within(screen.getByTestId('progress-activity-detail')).getByText('صورتان محفوظتان · ٢')).toBeOnTheScreen();
  expect(translate).toHaveBeenCalledWith('progressDaily.savedPhotos', expect.objectContaining({ count: 2 }));
  expect(screen.getByTestId('progress-journal-count')).toHaveTextContent('١');
  expect(screen.getByTestId('progress-checkin-count')).toHaveTextContent('٠');
  expect(screen.getByTestId('progress-reset-count')).toHaveTextContent('٠');
  expect(screen.getByTestId('history-journal-entry-photo-entry')).toHaveTextContent(privateText);
  expect(JSON.stringify({ state, entry })).toBe(before);
  translate.mockRestore();
});

test('SourceMeaningCase keeps a single saved photo singular and private journal text unchanged', () => {
  appI18n.addResource('en', 'translation', 'progressDaily.savedPhotos_one', '{{count}} saved photo');
  appI18n.addResource('en', 'translation', 'progressDaily.savedPhotos_other', '{{count}} saved photos');
  const screen = render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={jest.fn()} journalEntries={[photoEntry(1)]} showSummary />);
  fireEvent.press(screen.getByTestId('progress-activity-row-journal-photo-entry'));
  expect(within(screen.getByTestId('progress-activity-detail')).getByText('1 saved photo')).toBeOnTheScreen();
  expect(screen.getByTestId('history-journal-entry-photo-entry')).toHaveTextContent(privateText);
  expect(screen.getByTestId('progress-journal-count')).toHaveTextContent('1');
});
