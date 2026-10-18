import React from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { act, fireEvent, render } from '@testing-library/react-native';
import fs from 'node:fs';
import ts from 'typescript';
import { appI18n, localeResources } from '@/i18n/runtime';
import { createBlockingAttempt, createPanicInterventionAttempt, type BlockingAttempt } from '@/lib/blocking-engine';
import { hasUsableAccountabilityPartner } from '@/lib/accountability';
import { getPracticePalette } from '@/design-system/app-palette';
import * as Haptics from 'expo-haptics';

// Exercise the production screen and its real diagnostic card so a synthetic
// SOS verdict cannot hide behind a test-only visual stub.
const source = fs.readFileSync('src/features/freed-app.tsx', 'utf8');
const body = source.slice(source.indexOf('function InterceptScreen('), source.indexOf('async function openAppSettingsForPermission'));
const verdict = source.slice(source.indexOf('function VerdictCard('), source.indexOf('function SettingToggle('));
const button = source.slice(source.indexOf('function PillButton('), source.indexOf('function Card('));
const card = source.slice(source.indexOf('function Card('), source.indexOf('function Metric('));
const headerSource = fs.readFileSync('src/components/MomentumPageHeader.tsx', 'utf8');
const section = headerSource.slice(headerSource.indexOf('export function MomentumSection('), headerSource.indexOf('export function MomentumMetricStrip('));
const js = ts.transpileModule(section + button + card + verdict + body + '\nexports.Screen = InterceptScreen;', { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const shell = ({ children, ...props }: any) => <View {...props}>{children}</View>;
const icon = () => null;
let safeInsets = { top: 62, bottom: 34, left: 0, right: 0 };
const dependencies = {
  React, KeyboardAvoidingView, Pressable, SafeAreaView, ScrollView, Text, View, Animated, useAnimatedStyle, useSharedValue, withTiming,
  AppBackground: shell, MomentumVisibility: shell, Visibility: React.createContext(true), getPracticePalette, useSafeAreaInsets: () => safeInsets,
  MomentumPageHeader: ({ title, description, ...props }: any) => <View {...props} testID="intercept-hero"><Text>{title}</Text><Text>{description}</Text></View>,
  Metric: ({ label, value }: any) => <Text>{label}: {value}</Text>,
  ShieldCheck: icon, X: icon, Brain: icon, Sparkles: icon, ChevronRight: icon, Play: icon, MessageCircleHeart: icon, Lock: icon,
  useAppTheme: () => ({ mode: 'light', colors: { surface: '#fff', surface2: '#fafafa', border: '#ccc', text: '#111', text2: '#333', text3: '#555', mint: '#443ddd', accent: '#443ddd', accentTint: '#eeeeff', bg: '#fff', onAccent: '#fff' }, gradients: {}, typography: {} }),
  useMotionSettings: () => ({ active: true, spatialMotion: false }), tap: () => undefined, shadow: { card: {} },
  hasUsableAccountabilityPartner, appI18n, Haptics,
};
const exported: any = {};
new Function(...Object.keys(dependencies), 'exports', js)(...Object.values(dependencies), exported);
const Screen = exported.Screen;
const propsFor = (attempt = createPanicInterventionAttempt()) => ({ attempt, premium: false, membershipPlanLabel: 'Premium', streakDays: 0, accountability: {}, onContinue: jest.fn(), onSponsoredReset: jest.fn(), onClose: jest.fn(), onMessagePartner: jest.fn(), onReportWrongBlock: jest.fn() });
function hasScrollAncestor(node: any) { let parent = node.parent; while (parent) { if (parent.type === ScrollView) return true; parent = parent.parent; } return false; }

beforeEach(() => { jest.useFakeTimers(); safeInsets = { top: 62, bottom: 34, left: 0, right: 0 }; void appI18n.changeLanguage('en'); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); void appI18n.changeLanguage('en'); });

test.each([
  { top: 62, bottom: 34, left: 0, right: 0 },
  { top: 0, bottom: 21, left: 59, right: 59 },
  { top: 0, bottom: 0, left: 0, right: 0 },
])('header and persistent actions honor measured native safe-area insets: %p', insets => {
  safeInsets = insets;
  const screen = render(<Screen {...propsFor()} />);
  const frame = StyleSheet.flatten(screen.getByTestId('intercept-safe-area').props.style);
  const actions = StyleSheet.flatten(screen.getByTestId('intercept-actions').props.style);
  expect(frame.paddingTop).toBe(insets.top);
  expect(frame.paddingLeft).toBe(insets.left);
  expect(frame.paddingRight).toBe(insets.right);
  expect(actions.paddingBottom).toBeGreaterThanOrEqual(insets.bottom);
  expect(actions.paddingBottom).toBeGreaterThanOrEqual(12);
  expect(hasScrollAncestor(screen.getByRole('button', { name: 'Start free reset' }))).toBe(false);
  expect(hasScrollAncestor(screen.getByRole('button', { name: 'Close and return' }))).toBe(false);
});

test('optional pause and local guide do not inherit untitled colored category strips', () => {
  const screen = render(<Screen {...propsFor()} />);
  const coloredStrip = screen.UNSAFE_getAllByType(View).filter(node => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.height === 8 && style?.backgroundColor === getPracticePalette('calm', 'light').surface;
  });
  expect(coloredStrip).toHaveLength(0);
});

test('SOS offers free recovery and safe close outside scrolling content on the first viewport', () => {
  const props = propsFor(); const screen = render(<Screen {...props} />);
  const reset = screen.getByRole('button', { name: 'Start free reset' });
  const close = screen.getByRole('button', { name: 'Close and return' });
  expect(hasScrollAncestor(reset)).toBe(false);
  expect(hasScrollAncestor(close)).toBe(false);
  const actions = screen.getByTestId('intercept-actions');
  expect(StyleSheet.flatten(actions.props.style).flexShrink).toBe(0);
  // Dynamic Type may increase the real shared button's height: its label can
  // wrap, and neither the button nor persistent action area has a fixed height.
  expect(StyleSheet.flatten(reset.props.style).height).toBeUndefined();
  expect(StyleSheet.flatten(reset.props.style).minHeight).toBeGreaterThanOrEqual(44);
  expect(StyleSheet.flatten(actions.props.style).height).toBeUndefined();
  expect(screen.getByText('Start free reset').props.numberOfLines).toBeUndefined();
  expect(screen.UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
  fireEvent.press(reset); expect(props.onContinue).toHaveBeenCalledTimes(1);
  fireEvent.press(close); expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('a self-reported SOS never presents blocked, classifier, AI or completed-reset evidence', () => {
  const screen = render(<Screen {...propsFor()} />);
  expect(screen.queryByText('Blocked: adult intent')).toBeNull();
  expect(screen.queryByText(/self-urge\.freed\.local|self-reported-urge|100%/)).toBeNull();
  expect(screen.queryByText('Clara AI Urge Script')).toBeNull();
  expect(screen.queryByText('Pause complete')).toBeNull();
  expect(screen.queryByText(/Reset complete/)).toBeNull();
  expect(screen.getByTestId('intercept-hero').props.restrained).toBe(true);
});

test('the local guide opens immediately and says where its offline copy comes from', () => {
  const props = propsFor(); const screen = render(<Screen {...props} />);
  const guide = screen.getByRole('button', { name: 'Local grounding guide' });
  expect(guide.props.accessibilityState.expanded).toBe(false);
  fireEvent.press(guide);
  expect(screen.getByText('Written for FREED · available offline.')).toBeTruthy();
  expect(screen.getByText('Notice the urge without judging yourself.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Local grounding guide' }).props.accessibilityState.expanded).toBe(true);
  fireEvent.press(screen.getByRole('button', { name: 'Start free reset' }));
  expect(props.onContinue).toHaveBeenCalledTimes(1);
  expect(props.onSponsoredReset).not.toHaveBeenCalled();
});

test('the short hold is optional and its elapsed time never completes a recovery session', () => {
  const props = propsFor(); const screen = render(<Screen {...props} />);
  act(() => jest.advanceTimersByTime(5_000));
  expect(screen.queryByText('Pause complete')).toBeNull();
  expect(props.onContinue).not.toHaveBeenCalled();
  const hold = screen.getByRole('button', { name: 'Optional pause' });
  fireEvent(hold, 'pressIn'); act(() => jest.advanceTimersByTime(3_000)); fireEvent(hold, 'pressOut');
  expect(screen.getByText('Pause complete')).toBeTruthy();
  expect(screen.queryByText(/Reset complete/)).toBeNull();
  expect(props.onContinue).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Back to Safety' })); expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('a manual filter check does not claim a native site block', () => {
  const screen = render(<Screen {...propsFor(createBlockingAttempt('https://pornhub.com', 'manual-check'))} />);
  expect(screen.getByText('This check found a site covered by your filter. Choose a reset if it would help.')).toBeTruthy();
  expect(screen.queryByText('PROTECTION ENGAGED')).toBeNull();
  expect(screen.queryByText('FREED blocked an explicit site before the page loaded.')).toBeNull();
  expect(screen.queryByText('Blocked: adult intent')).toBeNull();
});

test('a native DNS block keeps honest protection copy and the existing one-shot mistake report', () => {
  const attempt: BlockingAttempt = { ...createBlockingAttempt('https://pornhub.com', 'browser'), sourcePackage: 'android-dns' };
  const props = propsFor(attempt); const screen = render(<Screen {...props} />);
  expect(screen.getByText('PROTECTION ENGAGED')).toBeTruthy();
  expect(screen.getByText('FREED blocked an explicit site before the page loaded.')).toBeTruthy();
  expect(screen.queryByText(/pornhub\.com|100%|embedded-seed/)).toBeNull();
  const report = screen.getByRole('button', { name: 'Report this block as a mistake' });
  fireEvent.press(report);
  expect(props.onReportWrongBlock).toHaveBeenCalledWith(attempt.host, attempt.result.matchedRule, 'android-dns');
  expect(screen.getByText('Thanks — noted on this device')).toBeTruthy();
  const sentReport = screen.getByRole('button', { name: 'Report this block as a mistake' });
  expect(sentReport).toBeDisabled();
  fireEvent.press(sentReport);
  expect(props.onReportWrongBlock).toHaveBeenCalledTimes(1);
});

test.each(Object.keys(localeResources))('%s local guide and support text have authored semantic translations', language => {
  const locale: any = localeResources[language as keyof typeof localeResources];
  for (const key of ['supportRequested', 'manualCheck', 'optionalPause', 'pauseHint', 'localGuide', 'localAttribution', 'notice', 'breathe', 'nextStep']) {
    expect(typeof locale.intercept?.[key]).toBe('string');
    expect(locale.intercept[key].trim()).not.toBe('');
    if (language !== 'en') expect(locale.intercept[key]).not.toBe((localeResources.en as any).intercept[key]);
  }
});
