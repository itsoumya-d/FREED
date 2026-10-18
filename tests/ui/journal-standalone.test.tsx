import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';
import { JournalScreen } from '@/components/JournalScreen';
import { createJournalRepository } from '@/lib/journal-repository';
import type { JournalMediaStore } from '@/lib/journal-media';
import { Alert as NativeAlert, AppState } from 'react-native';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/lib/journal-media-runtime', () => ({ createJournalMediaRuntime: () => null }));
jest.mock('@expo/ui/datetimepicker', () => ({ DateTimePicker: () => null }));
function fixture() {
  const values = new Map<string, string>(); let fail = false, id = 0;
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { if (fail) throw new Error('full'); values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const repo = createJournalRepository({ ownerId: 'alice', storage, newId: () => `id_${++id}` });
  const props = { ownerId: 'alice', repository: repo, onBack: jest.fn() };
  return { repo, storage, props, fail: (v: boolean) => { fail = v; } };
}
test('writing-first editor creates separate entries, then searches exact saved text', async () => {
  const f = fixture(); const view = render(<JournalScreen {...f.props} />);
  for (const text of ['First private words', 'Second private words']) {
    fireEvent.press(view.getByTestId('journal-new-entry')); fireEvent.changeText(view.getByTestId('journal-reflection'), text); fireEvent.press(view.getByTestId('journal-save'));
    await waitFor(() => expect(view.getByTestId('journal-new-entry')).toBeVisible());
  }
  expect(f.repo.list()).toHaveLength(2); fireEvent.changeText(view.getByTestId('journal-search'), 'Second');
  expect(view.queryByText('First private words')).toBeNull(); expect(view.getByText('Second private words')).toBeVisible();
});
test('back preserves durable draft and changing owner hides its contents', () => {
  const f = fixture(); const view = render(<JournalScreen {...f.props} />);
  fireEvent.press(view.getByTestId('journal-new-entry')); fireEvent.changeText(view.getByTestId('journal-reflection'), 'Unfinished 私の記録');
  fireEvent.press(view.getByTestId('journal-editor-back')); expect(f.repo.drafts()[0].text).toBe('Unfinished 私の記録');
  fireEvent.press(view.getByTestId(`journal-draft-${f.repo.drafts()[0].id}`)); expect(view.getByTestId('journal-reflection')).toHaveProp('defaultValue', 'Unfinished 私の記録');
  const bob = createJournalRepository({ ownerId: 'bob', storage: f.storage }); view.rerender(<JournalScreen ownerId="bob" repository={bob} onBack={jest.fn()} />);
  expect(view.queryByDisplayValue('Unfinished 私の記録')).toBeNull(); expect(bob.list()).toHaveLength(0);
});
test('photo-only save works, and save failure leaves the editor with retry', async () => {
  const f = fixture(); const photo = { id: 'p1', fileName: 'photo-p1.jpg', thumbnailFileName: 'thumb-p1.jpg', width: 400, height: 300, bytes: 1200, mime: 'image/jpeg' as const };
  const media = { pickAndImport: async () => ({ status: 'added', photo, limited: false }), uri: () => 'file:///private/photo.jpg', adoptPhoto: () => {}, reconcile: async () => {}, removePhoto: async () => {} } as unknown as JournalMediaStore;
  const view = render(<JournalScreen {...f.props} media={media} />); fireEvent.press(view.getByTestId('journal-new-entry'));
  await act(async () => { fireEvent.press(view.getByTestId('journal-add-photo')); }); expect(view.getByTestId('journal-save')).not.toBeDisabled();
  f.fail(true); fireEvent.press(view.getByTestId('journal-save')); expect(view.getByTestId('journal-reflection')).toBeVisible(); expect(f.repo.list()).toHaveLength(0);
  f.fail(false); fireEvent.press(view.getByTestId('journal-save')); await waitFor(() => expect(f.repo.list()).toHaveLength(1)); expect(f.repo.list()[0].text).toBe('');
});
test('delete requires explicit confirmation; disk failure retains the entry and confirmation can retry', async () => {
  const f = fixture(); const view = render(<JournalScreen {...f.props} />); fireEvent.press(view.getByTestId('journal-new-entry')); fireEvent.changeText(view.getByTestId('journal-reflection'), 'Keep until confirmed'); fireEvent.press(view.getByTestId('journal-save'));
  const entry = f.repo.list()[0]; fireEvent.press(view.getByTestId(`journal-entry-${entry.id}`)); fireEvent.press(view.getByTestId('journal-reader-edit'));
  const alert = jest.spyOn(NativeAlert, 'alert').mockImplementation(() => {}); fireEvent.press(view.getByTestId('journal-delete-entry')); expect(f.repo.list()).toHaveLength(1);
  const confirm = () => { const buttons = alert.mock.calls.at(-1)![2]!; buttons.find(button => button.style === 'destructive')!.onPress!(); };
  f.fail(true); act(confirm); expect(f.repo.list()).toHaveLength(1); expect(view.getByTestId('journal-error')).toBeVisible();
  f.fail(false); fireEvent.press(view.getByTestId('journal-delete-entry')); act(confirm); await waitFor(() => expect(f.repo.list()).toHaveLength(0)); alert.mockRestore();
});
test('saved entry opens a read-only reader before Edit and viewing creates no draft', () => {
  const f = fixture(); const draft = f.repo.newDraft('2026-10-06'); f.repo.saveDraft({ ...draft, title: 'A saved day', text: 'Private words 私の記録' }); const entry = f.repo.saveEntry(draft.id);
  const view = render(<JournalScreen {...f.props} />); fireEvent.press(view.getByTestId(`journal-entry-${entry.id}`));
  expect(view.getByTestId('journal-reader')).toBeVisible(); expect(view.getByTestId('journal-reader-text')).toHaveTextContent('Private words 私の記録');
  expect(view.queryByTestId('journal-reflection')).toBeNull(); expect(f.repo.drafts()).toHaveLength(0);
  fireEvent.press(view.getByTestId('journal-reader-edit')); expect(view.getByTestId('journal-reflection')).toHaveProp('defaultValue', 'Private words 私の記録');
  fireEvent.changeText(view.getByTestId('journal-reflection'), 'An unfinished change'); fireEvent.press(view.getByTestId('journal-editor-back'));
  expect(view.getByTestId('journal-reader-text')).toHaveTextContent('Private words 私の記録'); expect(f.repo.list()[0].text).toBe('Private words 私の記録');
  fireEvent.press(view.getByTestId('journal-reader-back')); expect(view.getByTestId('journal-entry-list')).toBeVisible();
});
test('Continue draft is separate from saved dated entries and never counts an unfinished note as history', () => {
  const f = fixture(); const saved = f.repo.newDraft('2026-10-06'); f.repo.saveDraft({ ...saved, text: 'Saved reflection' }); f.repo.saveEntry(saved.id);
  const unfinished = f.repo.newDraft('2026-10-07'); f.repo.saveDraft({ ...unfinished, text: 'Still writing' });
  const view = render(<JournalScreen {...f.props} />);
  expect(within(view.getByTestId('journal-continue-drafts')).getByTestId(`journal-draft-${unfinished.id}`)).toBeVisible();
  expect(view.getByTestId('journal-entry-list').props.data.map((entry: { id: string }) => entry.id)).toEqual(f.repo.list().map(entry => entry.id));
  expect(view.getByText('Continue draft')).toBeVisible(); fireEvent.press(view.getByTestId(`journal-draft-${unfinished.id}`));
  expect(view.getByTestId('journal-reflection')).toHaveProp('defaultValue', 'Still writing'); expect(f.repo.list()).toHaveLength(1);
});
test('an editor preparation failure stays visible in the reader and preserves the saved entry', () => {
  const f = fixture(); const draft = f.repo.newDraft('2026-10-06'); f.repo.saveDraft({ ...draft, text: 'Saved until an edit can start' }); const entry = f.repo.saveEntry(draft.id);
  const view = render(<JournalScreen {...f.props} />); fireEvent.press(view.getByTestId(`journal-entry-${entry.id}`)); f.fail(true); fireEvent.press(view.getByTestId('journal-reader-edit'));
  expect(view.getByTestId('journal-reader')).toBeVisible(); expect(view.getByTestId('journal-error')).toBeVisible(); expect(f.repo.list()[0].text).toBe('Saved until an edit can start');
  f.fail(false); fireEvent.press(view.getByTestId('journal-reader-edit')); expect(view.getByTestId('journal-reflection')).toHaveProp('defaultValue', 'Saved until an edit can start');
});
test('background flushes the last keystroke and attachment-draft failure cleans the new photo', async () => {
  const f = fixture(); const listeners: ((state: string) => void)[] = []; const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, callback) => { listeners.push(callback); return { remove: () => {} }; });
  const removePhoto = jest.fn(async () => {}), photo = { id: 'p1', fileName: 'photo-p1.jpg', thumbnailFileName: 'thumb-p1.jpg', width: 400, height: 300, bytes: 1200, mime: 'image/jpeg' as const };
  const media = { pickAndImport: async () => ({ status: 'added', photo, limited: false }), uri: () => 'file:///private/photo.jpg', reconcile: async () => {}, removePhoto } as unknown as JournalMediaStore;
  const view = render(<JournalScreen {...f.props} media={media} />); fireEvent.press(view.getByTestId('journal-new-entry')); fireEvent.changeText(view.getByTestId('journal-reflection'), 'Last keystroke');
  act(() => { listeners.forEach(listener => listener('background')); }); expect(f.repo.drafts()[0].text).toBe('Last keystroke');
  f.fail(true); await act(async () => { fireEvent.press(view.getByTestId('journal-add-photo')); }); expect(removePhoto).toHaveBeenCalledWith('alice', photo); expect(f.repo.drafts()[0].photos).toHaveLength(0); expect(view.queryByTestId('journal-remove-photo-p1')).toBeNull();
  f.fail(false); view.unmount(); subscription.mockRestore();
});
