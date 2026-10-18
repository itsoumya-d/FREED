import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import fs from 'node:fs';
import ts from 'typescript';
import { appI18n } from '@/i18n/runtime';

// Execute the actual pending-save JSX and its production save callback. Native
// verification is outside this already-completed branch and is not simulated.
const source = fs.readFileSync('src/features/freed-app.tsx', 'utf8');
const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const challengeScreen = tree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'ChallengeScreen') as ts.FunctionDeclaration;
const statements = challengeScreen.body!.statements;
const submit = statements.find(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(tree) === 'submitChallengeOutcome'))!;
const pending = statements.find(statement => ts.isIfStatement(statement) && statement.expression.getText(tree) === 'challenge && sessionController.session?.phase === "completed" && !done')!;
const shell = ({ children }: any) => <View>{children}</View>;
const deps = { React, View, Text, ScrollView, AppBackground: shell, SafeAreaView: shell, appI18n,
  PillButton: ({ label, onPress }: any) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>,
  InlineNotice: ({ message }: any) => <Text>{message}</Text> };
const code = ts.transpileModule(`exports.Screen = props => {
  const { sessionController, onComplete, onBack, onRetryEarnedResume, breakNotice } = props;
  const challenge = sessionController.session.challenge, nativeVerification = { enabled: false }, earnedOffer = null, verification = { evidence: {} };
  const completionSubmittedRef = React.useRef(false);
  const [done, setDone] = React.useState(false), [sessionNotice, setSessionNotice] = React.useState(null), [completionSubmitting, setCompletionSubmitting] = React.useState(false);
  ${submit.getText(tree)}
  ${pending.getText(tree)}
  return <Text>Durable completion saved</Text>;
}`, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const out: any = {};
new Function(...Object.keys(deps), 'exports', code)(...Object.values(deps), out);
const Screen = out.Screen;

function fixture() {
  const session = { id: 'retained-session', phase: 'completed', challenge: { id: 'comfortable-breathe' }, completion: { outcome: 'helped', completedAtMs: 1791792000000 } };
  return { sessionController: { session, getSnapshot: () => ({ session }), claimCompletion: jest.fn(), claimNativeCompletion: jest.fn() },
    onComplete: jest.fn(() => false), onRetryEarnedResume: jest.fn(), onBack: jest.fn(), breakNotice: 'App-time check is unavailable. '.repeat(160) };
}

test('actual completed-save retry and leave actions share natural scrolling with long app-time notices', async () => {
  const f = fixture(), view = render(<Screen {...f} />);
  const scroll = view.UNSAFE_getByType(ScrollView);
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe('automatic');
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).flexGrow).toBe(1);
  for (const label of ['Retry app-time check', 'Save completed reset', 'Back to safety']) {
    expect(within(scroll).getAllByRole('button', { name: label })).toHaveLength(1);
  }
  fireEvent.press(view.getByRole('button', { name: 'Retry app-time check' }));
  expect(f.onRetryEarnedResume).toHaveBeenCalledTimes(1);
  await act(async () => fireEvent.press(view.getByRole('button', { name: 'Save completed reset' })));
  expect(view.getByText('Reset could not be saved. Try saving again; your completion receipt is kept.')).toBeOnTheScreen();
  expect(f.onComplete).toHaveBeenCalledWith(f.sessionController.session.challenge, 'helped', { id: 'retained-session', completedAtMs: 1791792000000 });
  expect(f.sessionController.claimCompletion).not.toHaveBeenCalled();
  expect(f.sessionController.claimNativeCompletion).not.toHaveBeenCalled();
  fireEvent.press(view.getByRole('button', { name: 'Back to safety' }));
  expect(f.onBack).toHaveBeenCalledTimes(1);
});

test('actual pending-save storage failure retains the same completion receipt for an explicit durable retry', async () => {
  const f = fixture(), view = render(<Screen {...f} onRetryEarnedResume={undefined} />);
  expect(view.queryByRole('button', { name: 'Retry app-time check' })).toBeNull();
  expect(f.onComplete).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(view.getByRole('button', { name: 'Save completed reset' })));
  expect(f.sessionController.session.phase).toBe('completed');
  f.onComplete.mockReturnValue(true);
  await act(async () => fireEvent.press(view.getByRole('button', { name: 'Save completed reset' })));
  expect(f.onComplete.mock.calls).toEqual([
    [f.sessionController.session.challenge, 'helped', { id: 'retained-session', completedAtMs: 1791792000000 }],
    [f.sessionController.session.challenge, 'helped', { id: 'retained-session', completedAtMs: 1791792000000 }],
  ]);
  expect(view.getByText('Durable completion saved')).toBeOnTheScreen();
  expect(f.onRetryEarnedResume).not.toHaveBeenCalled();
});
