import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import { challengeLibrary } from '@/lib/recovery-engine';
import { createDefaultRecoveryState, recordChallengeCompletion } from '@/lib/recovery-state';
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 8, 12)); });
afterEach(() => jest.useRealTimers());
test('unavailable historical resets offer a truthful choice instead of pretending to repeat another tool', () => {
  const state = recordChallengeCompletion(createDefaultRecoveryState(), challengeLibrary[0], new Date().toISOString(), undefined, 'helped', 'recorded_session');
  const repeat = jest.fn(), browse = jest.fn();
  const view = render(<RecoveryHistory state={state} onCheckIn={jest.fn()} showSummary onStartReset={repeat} canRepeatReset={() => false} onBrowseResets={browse} />);
  expect(view.queryByRole('button', { name: 'Repeat this reset' })).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Choose a reset' }));
  expect(browse).toHaveBeenCalledTimes(1); expect(repeat).not.toHaveBeenCalled();
});
test('a currently available template can repeat its exact saved identity', () => {
  const challenge = challengeLibrary[0];
  const state = recordChallengeCompletion(createDefaultRecoveryState(), challenge, new Date().toISOString(), undefined, 'helped', 'recorded_session');
  const repeat = jest.fn(), browse = jest.fn();
  const view = render(<RecoveryHistory state={state} onCheckIn={jest.fn()} showSummary onStartReset={repeat} canRepeatReset={reset => reset.id === challenge.id && !reset.toolId} onBrowseResets={browse} />);
  fireEvent.press(view.getByRole('button', { name: 'Repeat this reset' }));
  expect(repeat).toHaveBeenCalledWith(expect.objectContaining({ id: challenge.id }));
  expect(browse).not.toHaveBeenCalled();
});
