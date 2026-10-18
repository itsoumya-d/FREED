import React from 'react';
import { View } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { StackActions, StackRouter } from '@react-navigation/routers';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { useFreedNavigation } from '@/features/use-freed-navigation';
import type { FreedScreen } from '@/lib/native-navigation';

// Only Expo's hook/IO boundary is supplied. Every dispatched action is reduced
// by the installed StackRouter, including old REPLACE's new-key behavior.
const mockStack = StackRouter({});
const mockOptions = { routeNames: ['(tabs)', 'flow/[destination]', 'support', 'onboarding/[destination]'], routeParamList: {}, routeGetIdList: {} };
let mockState: any;
let mockPath = '/flow/intercept';
let mockReady = true;
const mockActions: any[] = [];
const mockListeners: Record<string, () => void> = {};
function mockDispatch(action: any) {
  mockActions.push(action);
  if (action.target && action.target !== mockState.key) throw Error('Wrong navigator targeted');
  mockState = mockStack.getStateForAction(mockState, action, mockOptions) ?? mockState;
}
const mockRouter = {
  replace: (path: string) => mockDispatch(StackActions.replace('flow/[destination]', { destination: path.split('/').at(-1) })),
  push: (path: string) => mockDispatch(path === '/support' ? StackActions.push('support') : StackActions.push('flow/[destination]', { destination: path.split('/').at(-1) })),
  dismissTo: (path: string) => mockDispatch(StackActions.popTo(path === '/support' ? 'support' : 'flow/[destination]', { destination: path.split('/').at(-1) })),
  canGoBack: () => mockState.index > 0,
  back: () => mockDispatch(StackActions.pop()),
  navigate: () => {},
};
const mockContainer = {
  isReady: () => mockReady,
  getRootState: () => ({ key: 'expo-wrapper', index: 0, routes: [{ name: '__root', state: mockState }] }),
  dispatch: mockDispatch,
  addListener: (event: string, callback: () => void) => { mockListeners[event] = callback; return () => { delete mockListeners[event]; }; },
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, usePathname: () => mockPath, useNavigationContainerRef: () => mockContainer }));

function fixture() {
  let api: ReturnType<typeof useFreedNavigation>;
  function Probe() { api = useFreedNavigation(); return <View />; }
  const view = render(<Probe />);
  return {
    get: () => api!,
    path: (path: string) => { mockPath = path; view.rerender(<Probe />); },
    sync: () => { const route = mockState.routes[mockState.index]; mockPath = route.name === 'flow/[destination]' ? `/flow/${route.params.destination}` : route.name === 'support' ? '/support' : '/today'; view.rerender(<Probe />); },
  };
}
const source = readFileSync('src/features/freed-app.tsx', 'utf8');
const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualExpression(expression: string, dependencies: Record<string, unknown>) {
  const js = ts.transpileModule(`return (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  return new Function(...Object.keys(dependencies), js)(...Object.values(dependencies));
}
function startFromSponsored(f: ReturnType<typeof fixture>, session: any = null) {
  let startExpression = '', sponsoredExpression = '';
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'startChallenge') startExpression = node.initializer!.getText(tree);
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === 'onSponsoredReset') sponsoredExpression = (node.initializer as ts.JsxExpression).expression!.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  expect(startExpression).not.toBe(''); expect(sponsoredExpression).not.toBe('');
  const selected: unknown[] = [], notices: unknown[] = [], syncMessages: unknown[] = [];
  const startChallenge = actualExpression(startExpression, {
    React: { useCallback: (callback: unknown) => callback }, challengeSession: { getSnapshot: () => ({ session }) },
    setSelectedChallenge: (value: unknown) => selected.push(value), setChallengeBreakNotice: (value: unknown) => notices.push(value),
    setProtectionSyncMessage: (value: unknown) => syncMessages.push(value), setScreen: f.get().setScreen,
  });
  const sponsored = actualExpression(sponsoredExpression, { startChallenge });
  return { sponsored, selected, notices, syncMessages };
}
beforeEach(() => {
  mockReady = true; mockPath = '/flow/intercept'; mockActions.length = 0;
  mockState = { ...mockStack.getInitialState(mockOptions), key: 'app-stack', index: 1, routes: [
    { name: '(tabs)', key: 'tabs-origin', state: { index: 0, routes: [{ name: 'today', key: 'today-origin' }] } },
    { name: 'flow/[destination]', key: 'recovery-modal', params: { destination: 'intercept', origin: 'opaque-existing-origin' } },
  ] };
});
test.each([null, { phase: 'paused', challenge: { id: 'paused-activity' } }])('actual sponsored entry keeps its native modal key and origin, retaining session %p', session => {
  const f = fixture(), entry = startFromSponsored(f, session);
  act(() => entry.sponsored());
  expect(mockState.routes).toHaveLength(2);
  expect(mockState.routes[1]).toMatchObject({ key: 'recovery-modal', name: 'flow/[destination]', params: { destination: 'ad', origin: 'opaque-existing-origin' } });
  expect(mockState.routes[0].key).toBe('tabs-origin');
  expect(mockActions).toEqual([{ ...CommonActions.setParams({ destination: 'ad' }), source: 'recovery-modal', target: 'app-stack' }]);
  expect(entry.selected).toEqual([session?.challenge ?? null]); expect(entry.notices).toEqual([null]); expect(entry.syncMessages).toEqual([]);
  // Only destination is delivered: navigation conveys no earned/completion,
  // membership, interception scope or native unlock authority.
  expect(mockState.routes[1].params).toEqual({ destination: 'ad', origin: 'opaque-existing-origin' });
  act(() => f.sync()); expect(f.get().screen).toBe('ad');
});
test('completed session blocks actual sponsored callback without navigation or discard', () => {
  const f = fixture(), entry = startFromSponsored(f, { phase: 'completed', challenge: { id: 'done' } });
  act(() => entry.sponsored());
  expect(mockActions).toEqual([]); expect(entry.selected).toEqual([]); expect(entry.notices).toEqual([]);
  expect(entry.syncMessages).toEqual(['Save the completed reset before starting another.']);
});
test('rapid chooser, replacement and return use the live destination before pathname catches up', () => {
  const f = fixture();
  act(() => { f.get().setScreen('ad'); f.get().setScreen('challenge'); f.get().setScreen('ad'); f.get().setScreen('intercept'); });
  expect(mockState.routes[1]).toMatchObject({ key: 'recovery-modal', params: { destination: 'intercept', origin: 'opaque-existing-origin' } });
  expect(mockActions.map(action => action.payload.params.destination)).toEqual(['ad', 'challenge', 'ad', 'intercept']);
  act(() => f.get().setScreen('intercept')); expect(mockActions).toHaveLength(4);
});
test('a newly opened recovery modal is reused even before its originating tab pathname updates', () => {
  mockState.index = 0; mockState.routes = [mockState.routes[0]]; mockPath = '/today';
  const f = fixture(); act(() => f.get().setScreen('intercept'));
  const modalKey = mockState.routes[1].key;
  act(() => { f.get().setScreen('ad'); f.get().setScreen('challenge'); });
  expect(mockState.routes).toHaveLength(2);
  expect(mockState.routes[1]).toMatchObject({ key: modalKey, params: { destination: 'challenge' } });
  expect(mockActions.map(action => action.type)).toEqual(['PUSH', 'SET_PARAMS', 'SET_PARAMS']);
});
test('terminal safety/completion reset removes recovery history and retains the original tab', () => {
  const f = fixture(); act(() => f.get().setScreen('ad')); act(() => f.sync());
  act(() => f.get().setScreen('main'));
  expect(mockState.routes).toHaveLength(1); expect(mockState.routes[0].key).toBe('tabs-origin');
  expect(mockActions.at(-1).type).toBe('RESET');
});
test.each(['main', 'account', 'coach'] as FreedScreen[])('successful latest %s departure supersedes a recovery request queued against stale pathname/live tabs', destination => {
  const f = fixture(); mockState.index = 0; mockState.routes = [mockState.routes[0]];
  act(() => f.get().setScreen('ad')); expect(mockActions).toEqual([]);
  act(() => f.get().setScreen(destination));
  const delivered = [...mockActions];
  // A state notification can arrive while pathname still names interception.
  act(() => mockListeners.state()); act(() => f.path('/flow/intercept'));
  // Pathname then catches up to the successful latest destination.
  act(() => f.sync()); act(() => mockListeners.state());
  expect(mockActions).toEqual(delivered);
  if (destination === 'main') {
    expect(mockState.routes).toHaveLength(1); expect(mockState.routes[0].key).toBe('tabs-origin');
    expect(f.get().screen).toBe('main');
  } else expect(mockState.routes[mockState.index].params.destination).toBe(destination);
});
test.each(['main', 'intercept'] as FreedScreen[])('successful same-destination %s request cancels older not-ready recovery intent', destination => {
  if (destination === 'main') { mockState.index = 0; mockState.routes = [mockState.routes[0]]; mockPath = '/today'; }
  mockReady = false; const f = fixture();
  act(() => f.get().setScreen('ad')); expect(mockActions).toEqual([]);
  mockReady = true; act(() => f.get().setScreen(destination));
  act(() => { mockListeners.ready(); mockListeners.state(); }); act(() => f.sync());
  expect(mockActions).toEqual([]);
  expect(f.get().screen).toBe(destination);
});
test('not-ready queue delivers the latest recovery request once ready', () => {
  mockReady = false; const f = fixture();
  act(() => { f.get().setScreen('ad'); f.get().setScreen('challenge'); }); expect(mockActions).toEqual([]);
  act(() => { mockReady = true; mockListeners.ready(); });
  expect(mockState.routes[1]).toMatchObject({ key: 'recovery-modal', params: { destination: 'challenge', origin: 'opaque-existing-origin' } });
  expect(mockActions).toHaveLength(1);
});
test('public auxiliary presentation defers recovery until it is dismissed', () => {
  const f = fixture(); mockDispatch(StackActions.push('support')); act(() => f.sync()); mockActions.length = 0;
  act(() => f.get().setScreen('ad')); expect(mockActions).toEqual([]); expect(f.get().screen).toBe('intercept');
  mockDispatch(StackActions.pop()); act(() => f.sync());
  expect(mockState.routes[1]).toMatchObject({ key: 'recovery-modal', params: { destination: 'ad', origin: 'opaque-existing-origin' } });
});
test.each(['support', '(tabs)', 'missing-source', 'account'])('stale recovery pathname cannot merge params into %s; state retry checks the actual focused flow', name => {
  const f = fixture(); const original = mockState.routes[1];
  mockState.routes[1] = name === 'missing-source' ? { ...original, key: undefined } : name === 'account' ? { ...original, params: { destination: 'account' } } : { name, key: 'competing-route' };
  act(() => f.get().setScreen('ad')); expect(mockActions).toEqual([]);
  mockState.routes[1] = original; act(() => mockListeners.state());
  expect(mockState.routes[1]).toMatchObject({ key: 'recovery-modal', params: { destination: 'ad' } });
});
test.each(['breathing', 'paywall', 'account', 'coach', 'features', 'journal'] as FreedScreen[])('recovery departure to %s keeps the existing cross-presentation replacement', destination => {
  const f = fixture(); act(() => f.get().setScreen(destination));
  expect(mockActions.at(-1).type).toBe('REPLACE');
  expect(mockState.routes[1].params.destination).toBe(destination); expect(mockState.routes[1].key).not.toBe('recovery-modal');
});
