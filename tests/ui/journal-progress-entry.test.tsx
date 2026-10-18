import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { JournalScreen } from '@/components/JournalScreen';
import { createJournalRepository } from '@/lib/journal-repository';

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/lib/journal-media-runtime', () => ({ createJournalMediaRuntime: () => null }));
jest.mock('@expo/ui/datetimepicker', () => ({ DateTimePicker: () => null }));

function fixture(ownerId = 'alice') {
  const values = new Map<string, string>();
  let id = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  const repository = createJournalRepository({ ownerId, storage, newId: () => `${ownerId}_${++id}` });
  const draft = repository.newDraft('2026-10-08');
  repository.saveDraft({ ...draft, title: 'Recorded reflection', text: 'Private selected entry' });
  const entry = repository.saveEntry(draft.id);
  return { ownerId, repository, entry };
}

test('a Progress entry request opens its exact saved reader without creating or editing a draft', async () => {
  const f = fixture();
  const view = render(<JournalScreen ownerId={f.ownerId} repository={f.repository} initialEntryId={f.entry.id} onBack={jest.fn()} />);
  await waitFor(() => expect(view.getByTestId('journal-reader')).toBeVisible());
  expect(view.getByTestId('journal-reader-text')).toHaveTextContent('Private selected entry');
  expect(view.queryByTestId('journal-reflection')).toBeNull();
  expect(f.repository.drafts()).toHaveLength(0);
  expect(f.repository.list()).toHaveLength(1);
});

test('a missing or foreign Progress entry request keeps current-owner history readable', async () => {
  const f = fixture('bob');
  const view = render(<JournalScreen ownerId={f.ownerId} repository={f.repository} initialEntryId="alice_2" onBack={jest.fn()} />);
  await waitFor(() => expect(view.getByTestId('journal-entry-list')).toBeVisible());
  expect(view.queryByTestId('journal-reader')).toBeNull();
  expect(f.repository.drafts()).toHaveLength(0);
  expect(f.repository.list()).toHaveLength(1);
});

test('a reader request is consumed once, including a missing entry, and does not replay on a rerender', async () => {
  const f = fixture();
  const handled = jest.fn();
  const props = { ownerId: f.ownerId, repository: f.repository, initialEntryId: 'missing_entry', onInitialEntryHandled: handled, onBack: jest.fn() };
  const view = render(<JournalScreen {...props} />);
  await waitFor(() => expect(handled).toHaveBeenCalledWith('missing_entry'));
  view.rerender(<JournalScreen {...props} />);
  expect(handled).toHaveBeenCalledTimes(1);
  expect(view.getByTestId('journal-entry-list')).toBeVisible();
  expect(f.repository.drafts()).toHaveLength(0);
});
