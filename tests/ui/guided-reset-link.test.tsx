import React from 'react';
import { AppState, Linking, View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { useGuidedResetLink } from '@/hooks/use-guided-reset-link';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRecoveryEntryPresentation } from '@/lib/recovery-entry-presentation';

let url: (event: { url: string }) => void;
let state: (value: string) => void;
let foreground = 'active';
let open: jest.Mock;
let current = true;
let initial: string | null;
const removed = jest.fn();
const APP_LINK = 'https://freed-7d5ee.firebaseapp.com/intervention';

function Host({ ready = true, owner = 'owner-a:1' }: { ready?: boolean; owner?: string | null }) {
  useGuidedResetLink({ ready, ownerKey: owner, isCurrent: () => current, onOpen: open });
  return <View />;
}
beforeEach(() => {
  initial = null; foreground = 'active'; current = true; open = jest.fn(); removed.mockClear();
  jest.spyOn(Linking, 'getInitialURL').mockImplementation(async () => initial);
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_event, listener) => { url = listener as typeof url; return { remove: removed }; });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { state = listener as typeof state; return { remove: removed }; });
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => foreground });
});
afterEach(() => jest.restoreAllMocks());

test('initial and warm manual links open the normal membership-gated reset without payload authority', async () => {
  initial = 'freed://guided-reset';
  render(<Host />); await act(async () => {});
  expect(open).toHaveBeenCalledTimes(1);
  act(() => url({ url: 'freed://guided-reset' })); expect(open).toHaveBeenCalledTimes(2);
  for (const link of ['freed://guided-reset?premium=true', 'freed://guided-reset#app=selected', 'freed://intervention', 'https://adult.example/']) act(() => url({ url: link }));
  expect(open).toHaveBeenCalledTimes(2);
  expect(open.mock.calls).toEqual([[], []]);
});

test('exact HTTPS cold and warm app links use the same payload-free foreground entry', async () => {
  initial = APP_LINK;
  render(<Host />); await act(async () => {});
  expect(open).toHaveBeenCalledTimes(1);
  act(() => url({ url: APP_LINK })); expect(open).toHaveBeenCalledTimes(2);
  for (const suffix of ['/', '?premium=true', '#nativeInterventionId=forged']) {
    act(() => url({ url: APP_LINK + suffix }));
  }
  expect(open.mock.calls).toEqual([[], []]);
});

test('a cold-start hint waits for readiness and active foreground', async () => {
  initial = APP_LINK; foreground = 'inactive';
  const view = render(<Host ready={false} owner={null} />); await act(async () => {});
  expect(open).not.toHaveBeenCalled();
  view.rerender(<Host />); expect(open).not.toHaveBeenCalled();
  act(() => { foreground = 'active'; state('active'); }); expect(open).toHaveBeenCalledTimes(1);
  act(() => state('active')); expect(open).toHaveBeenCalledTimes(1);
});

test('owner change clears a queued opener and current ownership is checked at delivery', async () => {
  const view = render(<Host />); await act(async () => {});
  foreground = 'background'; act(() => url({ url: APP_LINK }));
  view.rerender(<Host owner="owner-b:2" />);
  act(() => { foreground = 'active'; state('active'); }); expect(open).not.toHaveBeenCalled();
  current = false; act(() => url({ url: APP_LINK })); expect(open).not.toHaveBeenCalled();
  current = true; view.rerender(<Host owner="owner-b:2" />); expect(open).toHaveBeenCalledTimes(1);
});

test('late initial resolution and listeners cannot reopen an unmounted host', async () => {
  let resolve!: (value: string) => void;
  jest.spyOn(Linking, 'getInitialURL').mockImplementation(() => new Promise(value => { resolve = value; }));
  const view = render(<Host />); view.unmount();
  await act(async () => resolve(APP_LINK));
  expect(open).not.toHaveBeenCalled(); expect(removed).toHaveBeenCalledTimes(2);
});

test.each([['owner-b:2'], ['owner-b:2', 'owner-a:1'], [null, 'owner-b:2']])('a delayed initial URL is rejected after an established owner transition: %j', async (...owners) => {
  let resolve!: (value: string) => void;
  jest.spyOn(Linking, 'getInitialURL').mockImplementation(() => new Promise(value => { resolve = value; }));
  const view = render(<Host owner="owner-a:1" />);
  for (const owner of owners) view.rerender(<Host owner={owner} />);
  await act(async () => resolve(APP_LINK));
  expect(open).not.toHaveBeenCalled();
});

test('the actual controller callback resumes an owned receipt without clearing earned origin; fresh links start manual access', () => {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useGuidedResetLink') {
      const argument = node.arguments[0] as ts.ObjectLiteralExpression;
      const open = argument.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(tree) === 'onOpen') as ts.PropertyAssignment;
      expression = open.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); expect(expression).not.toBe('');
  const js = ts.transpileModule(`return (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const session of [null, { ownerId: 'current-owner', phase: 'active' }, { ownerId: 'current-owner', phase: 'completed' }, { ownerId: 'other-owner', phase: 'active' }]) {
    const setScreen = jest.fn(), setActiveAttempt = jest.fn(), setSelectedChallenge = jest.fn(), startChallenge = jest.fn();
    const callback = new Function('challengeSession', 'journeyOwner', 'setScreen', 'setActiveAttempt', 'setSelectedChallenge', 'startChallenge', 'recoveryEntryPresentation', 'guidedAccess', js)(
      { getSnapshot: () => ({ session }) }, 'current-owner', setScreen, setActiveAttempt, setSelectedChallenge, startChallenge,
      { current: createRecoveryEntryPresentation() }, { canEnter: () => false });
    callback();
    if (session?.ownerId === 'current-owner') {
      expect(setScreen).toHaveBeenCalledWith('challenge'); expect(setActiveAttempt).not.toHaveBeenCalled(); expect(startChallenge).not.toHaveBeenCalled();
    } else {
      expect(setActiveAttempt).toHaveBeenCalledWith(null); expect(setSelectedChallenge).toHaveBeenCalledWith(null); expect(startChallenge).toHaveBeenCalledWith();
    }
  }
});

test('the actual controller waits for settled journey membership and current account/private readiness', () => {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useGuidedResetLink') {
      const argument = node.arguments[0] as ts.ObjectLiteralExpression;
      const property = argument.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(tree) === 'isCurrent') as ts.PropertyAssignment;
      expression = property.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); expect(expression).not.toBe('');
  const js = ts.transpileModule(`return (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const destination of ['splash', 'welcome', 'account', 'paywall', 'main']) {
    let owner: string | null = 'owner', locked = false, account = false;
    const guard = new Function('journeyOwner', 'getFirebaseAccountScope', 'getJourneyOwner', 'getFirebaseAuthSnapshot', 'privateLockedRef', 'accountFlowFence', 'getJourneyDestination', 'getJourneyPolicy', js)(
      'owner', () => owner, () => owner, () => ({}), { get current() { return locked; } }, { current: { isActive: () => account } }, () => destination, () => ({}));
    expect(guard()).toBe(destination === 'main');
    if (destination === 'main') {
      locked = true; expect(guard()).toBe(false); locked = false;
      account = true; expect(guard()).toBe(false); account = false;
      owner = 'other'; expect(guard()).toBe(false);
    }
  }
});

test('the actual readiness expression retains the hint until account/onboarding routing settles', () => {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useGuidedResetLink') {
      const property = (node.arguments[0] as ts.ObjectLiteralExpression).properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(tree) === 'ready') as ts.PropertyAssignment;
      expression = property.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); expect(expression).not.toBe('');
  const ready = new Function('hydrated', 'storageReady', 'journeyOwner', 'screen', 'auxiliaryRoute', 'deferredAuxiliaryRoute', 'return '+expression);
  for (const screen of ['splash', 'welcome', 'quiz', 'planCalculation', 'appSelection', 'account', 'paywall']) expect(ready(true, true, 'owner', screen, null, null)).toBe(false);
  for (const screen of ['main', 'intercept', 'ad', 'challenge', 'journal', 'coach']) expect(ready(true, true, 'owner', screen, null, null)).toBe(true);
  expect(ready(true, true, 'owner', 'main', 'privacy', null)).toBe(false);
  expect(ready(true, true, 'owner', 'main', null, 'support')).toBe(false);
});
