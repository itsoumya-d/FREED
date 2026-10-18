import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { useRecoveryDraft } from '@/hooks/use-recovery-draft';
import { OwnerPrivateDraftContext, createOwnerPrivateDraftStorage } from '@/lib/owner-private-drafts';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
test('the real draft hook retains per-owner scratch and rejects a captured previous-owner edit after switching', () => {
  const values = new Map<string, string>(); let owner = 'owner-a', stale!: (text: string) => void;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  function Probe({ ownerId }: { ownerId: string }) {
    const draft = useRecoveryDraft('journal', { reflection: '' }, { dateKey: '2026-10-07' });
    const edit = (text: string) => draft.update({ reflection: text }); if (ownerId === 'owner-a') stale = edit;
    return <TextInput testID="private-draft" value={draft.value.reflection} onChangeText={edit} />;
  }
  const page = (ownerId: string) => <OwnerPrivateDraftContext.Provider value={{ ownerId, storage: createOwnerPrivateDraftStorage(storage, ownerId, () => owner === ownerId) }}><Probe ownerId={ownerId} /></OwnerPrivateDraftContext.Provider>;
  const view = render(page(owner)); fireEvent.changeText(view.getByTestId('private-draft'), 'A exact 私の記録');
  const old = stale; owner = 'owner-b'; view.rerender(page(owner)); old('A late edit');
  expect(view.getByTestId('private-draft').props.value).toBe('');
  fireEvent.changeText(view.getByTestId('private-draft'), 'B scratch'); owner = 'owner-a'; view.rerender(page(owner));
  expect(view.getByTestId('private-draft').props.value).toBe('A exact 私の記録');
});
