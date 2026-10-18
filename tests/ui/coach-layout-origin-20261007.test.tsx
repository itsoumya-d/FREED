import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, KeyboardAvoidingView, Platform, Text } from 'react-native';
import { CoachConversationLayout } from '@/components/CoachConversationLayout';
let mockOrigin = 91;
let mockDeferredMeasurements: Function[] | null = null;
jest.mock('react-native/Libraries/Components/View/View', () => {
  const React = require('react');
  return { __esModule: true, default: React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ measureInWindow: (callback: Function) => {
      if (mockDeferredMeasurements) mockDeferredMeasurements.push(callback); else callback(0, mockOrigin, 375, 500);
    } }));
    return React.createElement('View', props, props.children);
  }) };
});
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
const originalPlatform = Platform.OS;
beforeEach(() => { mockOrigin = 91; mockDeferredMeasurements = null; Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' }); });
afterEach(() => { jest.restoreAllMocks(); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }); });
test('modal keyboard avoidance uses the measured container origin and refreshes it without repeated feedback', () => {
  const listeners = new Map<string, Function>(), removed = jest.fn(), observed = jest.fn();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, listener: Function) => {
    listeners.set(name, listener); return { remove: () => { listeners.delete(name); removed(); } };
  }) as never);
  const view = render(<CoachConversationLayout {...{ onMeasuredOrigin: observed } as any} composer={<Text>Composer and Send</Text>}><Text>Transcript</Text></CoachConversationLayout>);
  fireEvent(view.getByTestId('coach-layout'), 'layout', { nativeEvent: { layout: { x: 0, y: 91, width: 375, height: 500 } } });
  expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(91);
  expect(observed).toHaveBeenCalledWith(91);
  act(() => { mockOrigin = 133; listeners.get('keyboardWillChangeFrame')!({ endCoordinates: { screenY: 360 } }); });
  expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(133);
  expect(observed).toHaveBeenCalledTimes(2);
  act(() => { listeners.get('keyboardWillChangeFrame')!({ endCoordinates: { screenY: 340 } }); });
  expect(observed).toHaveBeenCalledTimes(2);
  view.unmount(); expect(listeners.size).toBe(0);
  expect(removed).toHaveBeenCalled();
});
test('a caller supplied measured offset overrides the internal origin without enabling transcript keyboard insets', () => {
  const view = render(<CoachConversationLayout {...{ keyboardVerticalOffset: 42 } as any} composer={<Text>Composer</Text>}><Text>Transcript</Text></CoachConversationLayout>);
  fireEvent(view.getByTestId('coach-layout'), 'layout', { nativeEvent: { layout: { x: 0, y: 91, width: 375, height: 500 } } });
  expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(42);
  expect(view.getByTestId('coach-transcript').props.automaticallyAdjustKeyboardInsets).toBe(false);
});
test('a late origin callback cannot undo the current keyboard-frame measurement', () => {
  mockDeferredMeasurements = [];
  const listeners = new Map<string, Function>();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, listener: Function) => {
    listeners.set(name, listener); return { remove: () => listeners.delete(name) };
  }) as never);
  const observed = jest.fn();
  const view = render(<CoachConversationLayout onMeasuredOrigin={observed} composer={<Text>Composer</Text>}><Text>Transcript</Text></CoachConversationLayout>);
  fireEvent(view.getByTestId('coach-layout'), 'layout', { nativeEvent: { layout: { x: 0, y: 91, width: 375, height: 500 } } });
  act(() => { listeners.get('keyboardWillChangeFrame')!({ endCoordinates: { screenY: 360 } }); });
  const [old, current] = mockDeferredMeasurements;
  act(() => { current(0, 133, 375, 500); old(0, 91, 375, 500); });
  expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(133);
  expect(observed).toHaveBeenCalledTimes(1);
});
