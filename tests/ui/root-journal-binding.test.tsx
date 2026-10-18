import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { JournalScreen } from '@/components/JournalScreen';
import { createJournalRepository } from '@/lib/journal-repository';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-sqlite/localStorage/install', () => ({}));
test('the actual root journal branch binds the trusted owner and stable repository instead of writing a legacy check-in', () => {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const start = source.indexOf('    if (screen === "journal")'), end = source.indexOf('    if (screen === "coach")', start);
  const body = transpileModule(`return (() => { ${source.slice(start, end)} })();`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const journalRepository = createJournalRepository({ storage, ownerId: 'trusted-owner', newId: () => 'entry_one' });
  const recoveryState = createDefaultRecoveryState(), persistRecoveryState = jest.fn();
  const deps = { React, JournalScreen, screen: 'journal', journeyOwner: 'trusted-owner', privateViewLocked: false, journalRepository, journalMedia: null,
    journalOwnerError: null, journalLegacyDraft: undefined, journalChanged: jest.fn(), legacyJournalNotes: [],
    journalReaderRequest: null, getFirebaseAccountScope: () => 'trusted-owner', setJournalReaderRequest: jest.fn(),
    todayCheckIn: null, recoveryState, persistRecoveryState, backFromTool: jest.fn(), openJournalBackup: jest.fn() };
  const ui = new Function(...Object.keys(deps), body)(...Object.values(deps));
  const view = render(ui);
  fireEvent.press(view.getByTestId('journal-new-entry'));
  fireEvent.changeText(view.getByTestId('journal-reflection'), 'A standalone private entry');
  fireEvent.press(view.getByTestId('journal-save'));
  expect(journalRepository.list()).toHaveLength(1);
  expect(journalRepository.list()[0].text).toBe('A standalone private entry');
  expect(persistRecoveryState).not.toHaveBeenCalled();
  expect(recoveryState.dailyCheckIns).toHaveLength(0);
});
