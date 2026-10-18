import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { GuidedResetOffer } from '@/components/GuidedResetOffer';
import { ResetChoicePicker } from '@/components/ResetChoicePicker';
import { MOMENTUM_RESET_TEMPLATES } from '@/data/momentum-resets';

jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
const breathe = MOMENTUM_RESET_TEMPLATES.find(item => item.id === 'momentum-breathe-soft')!;
const move = MOMENTUM_RESET_TEMPLATES.find(item => item.id === 'momentum-move-seated')!;
const find = MOMENTUM_RESET_TEMPLATES.find(item => item.id === 'momentum-find-five')!;
const wrapper = (child: React.ReactNode) => <I18nextProvider i18n={appI18n}>{child}</I18nextProvider>;
const offerProps = () => ({ tier: 'free' as const, protectionOrigin: false, challenge: { ...breathe, title: 'One 4-7-8 breath', durationSec: 180 }, busy: false, notice: null, repairNeeded: false, resumable: false, onStart: jest.fn(), onWatch: jest.fn(), onRepair: jest.fn(), onRetry: jest.fn(), onPro: jest.fn(), onSafety: jest.fn(), onHelp: jest.fn() });
beforeEach(async () => { await appI18n.changeLanguage('en'); });
afterEach(async () => { await appI18n.changeLanguage('en'); });

test('unselected access previews available kinds of reset without advertising an arbitrary method or photo qualification', () => {
  const props = offerProps();
  const view = render(wrapper(<GuidedResetOffer {...props} previewMode="choices" />));
  expect(view.queryByText('One 4-7-8 breath')).toBeNull();
  expect(view.queryByText(/180/)).toBeNull();
  expect(view.getByText('Breathe')).toBeTruthy();
  expect(view.getByText('Move')).toBeTruthy();
  expect(view.getByText('Find something')).toBeTruthy();
  expect(view.getByText('Notice nearby objects; no photo check.')).toBeTruthy();
  fireEvent.press(view.getByRole('button', { name: 'Watch a video and choose a reset' }));
  expect(props.onWatch).toHaveBeenCalledTimes(1);
  expect(props.onStart).not.toHaveBeenCalled();
});

test('an existing session keeps its actual selected method and requirement', () => {
  const props = offerProps();
  const view = render(wrapper(<GuidedResetOffer {...props} previewMode="resume" resumable />));
  expect(view.getByText('One 4-7-8 breath')).toBeTruthy();
  expect(view.getByTestId('guided-activity-requirement')).toHaveTextContent(/180 active seconds/);
  fireEvent.press(view.getByRole('button', { name: 'Resume guided reset' }));
  expect(props.onStart).toHaveBeenCalledTimes(1);
  expect(props.onWatch).not.toHaveBeenCalled();
});

test('a selected legacy reflection timer does not acquire movement evidence from the artwork fallback', () => {
  const props = offerProps();
  const challenge = { ...breathe, id: 'legacy-reflection', choiceGroup: undefined, category: 'reflection' as const, title: 'A quiet reflection', durationSec: 90 };
  const view = render(wrapper(<GuidedResetOffer {...props} challenge={challenge} previewMode="resume" />));
  expect(view.getByTestId('guided-activity-requirement')).toHaveTextContent('90 active seconds · confirm when finished.');
  expect(view.queryByText(/movement self-reported/)).toBeNull();
});

test('choice access retains paid, unknown and blocked access actions', () => {
  const props = offerProps();
  const view = render(wrapper(<GuidedResetOffer {...props} previewMode="choices" tier="paid" />));
  fireEvent.press(view.getByRole('button', { name: 'Choose a reset' }));
  expect(props.onStart).toHaveBeenCalledTimes(1);
  view.rerender(wrapper(<GuidedResetOffer {...props} previewMode="choices" tier="unknown" />));
  expect(view.queryByRole('button', { name: /Watch a video/ })).toBeNull();
  fireEvent.press(view.getByRole('button', { name: 'Retry access check' }));
  fireEvent.press(view.getByRole('button', { name: 'Help now' }));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
  expect(props.onHelp).toHaveBeenCalledTimes(1);
  view.rerender(wrapper(<GuidedResetOffer {...props} previewMode="choices" accessBlocked />));
  expect(view.queryByRole('button', { name: /Watch a video/ })).toBeNull();
  expect(props.onWatch).not.toHaveBeenCalled();
});

test('timer choices disclose their actual evidence category and preserve the chosen object and reward', () => {
  const choose = jest.fn();
  const view = render(wrapper(<ResetChoicePicker choices={[{ group: 'breathe', challenge: breathe }, { group: 'move', challenge: move }, { group: 'find', challenge: find }]} onChoose={choose} rewardLabel={item => item === move ? '5 min app break on request' : null} />));
  expect(view.getByText('60 active seconds · confirm when finished.')).toBeTruthy();
  expect(view.getByText('60 active seconds · movement self-reported.')).toBeTruthy();
  expect(view.getByText('60 active seconds · grounding self-reported.')).toBeTruthy();
  expect(view.queryByText(/A timer cannot prove physical activity/)).toBeNull();
  expect(view.getByTestId('reset-choice-find').props.accessibilityLabel).not.toMatch(/photo|target match/i);
  fireEvent.press(view.getByRole('button', { name: /Move.*movement self-reported.*5 min app break/ }));
  expect(choose).toHaveBeenLastCalledWith(move);
  fireEvent.press(view.getByTestId('reset-choice-find'));
  expect(choose).toHaveBeenLastCalledWith(find);
});

test('Arabic essential evidence remains readable, scalable and actionable', async () => {
  await act(async () => { await appI18n.changeLanguage('ar'); });
  const choose = jest.fn();
  const view = render(wrapper(<ResetChoicePicker choices={[{ group: 'find', challenge: find }]} onChoose={choose} />));
  const evidence = view.getByText('٦٠ ثانية نشطة · تأريض بتأكيدك الشخصي.');
  expect(evidence.props.numberOfLines).toBeUndefined();
  expect(StyleSheet.flatten(evidence.props.style).textAlign).toBe('right');
  const button = view.getByRole('button');
  expect(button.props.accessibilityLabel).toContain('٦٠ ثانية نشطة · تأريض بتأكيدك الشخصي.');
  expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
  fireEvent.press(button);
  expect(choose).toHaveBeenCalledWith(find);
});

test('requested unavailable Find remains visible even when no method is eligible', () => {
  const choose = jest.fn();
  const view = render(wrapper(<ResetChoicePicker choices={[]} showUnavailableFind onChoose={choose} />));
  expect(view.getByTestId('reset-find-unavailable')).toHaveTextContent(/Photo matching is unavailable.*guided access is kept/);
  expect(view.queryAllByRole('button')).toHaveLength(0);
  expect(choose).not.toHaveBeenCalled();
});
