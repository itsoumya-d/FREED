import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { getFocusShieldCapabilityModel, summarizeFocusShieldRules } from '@/lib/protection-capabilities';
import { FOCUS_SHIELD_PRESETS, createFocusShieldPresetRule } from '@/lib/focus-shield';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
const source = readFileSync('src/features/freed-app.tsx', 'utf8');
const start = source.indexOf('function FocusShieldSection('), end = source.indexOf('\nfunction AccountScreen(', start);
const compiled = transpileModule(source.slice(start, end) + '\nexports.Section = FocusShieldSection;', { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
const configureFocusShieldRule = jest.fn(), startFocusShieldCalibration = jest.fn(), openSafariExtensionSettings = jest.fn(async () => undefined);
const listFocusShieldRules = jest.fn(async () => [] as unknown[]);
const icon = () => null;
const dependencies = { React, View, Text, Pressable, Card: View, ShieldCheck: icon, Check: icon, Trash2: icon,
  PillButton: ({ label, disabled, onPress, testID }: any) => <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>,
  useAppTheme: () => ({ colors: {}, gradients: {}, typography: {} }), getFocusShieldCapabilityModel, summarizeFocusShieldRules,
  FOCUS_SHIELD_PRESETS, createFocusShieldPresetRule, configureFocusShieldRule, startFocusShieldCalibration, openSafariExtensionSettings,
  listFocusShieldRules, getFocusShieldCalibration: async () => ({ state: 'idle' }), removeFocusShieldRule: jest.fn(), cancelFocusShieldCalibration: jest.fn(),
};
const exportsForTest: any = {};
new Function('exports', ...Object.keys(dependencies), compiled)(exportsForTest, ...Object.values(dependencies));
const Section = exportsForTest.Section;
const android: ProtectionCapability = { platform: 'android', accessibility: true, usageStats: true, screenTime: false, managedSettings: false, localVpnFallback: true, dnsFiltering: true, focusShieldSurfaceInspection: true, notes: [] };
const status: ProtectionStatus = { authorized: true, active: false, mode: 'accessibility', message: 'Ready', appInterventionAuthorized: true, focusShieldSurfaceEnabled: false, focusShieldSurfaceReason: 'release-gated' };
beforeEach(() => { configureFocusShieldRule.mockReset(); listFocusShieldRules.mockResolvedValue([]); });
test.each([{ focusShieldSurfaceEnabled: false }, { focusShieldSurfaceEnabled: true, appInterventionAuthorized: false }, { focusShieldSurfaceEnabled: true, focusShieldRuleStoreHealth: 'degraded' as const }])('gated, unauthorized and degraded states cannot invoke enforcement actions: %p', async patch => {
  const screen = render(<Section protectionCapability={android} protectionStatus={{ ...status, ...patch }} onRefresh={jest.fn()} />);
  await act(async () => {});
  for (const button of screen.getAllByRole('button', { name: 'Enable' })) {
    expect(button).toBeDisabled(); fireEvent.press(button);
  }
  expect(configureFocusShieldRule).not.toHaveBeenCalled();
  expect(startFocusShieldCalibration).not.toHaveBeenCalled();
});
test('a saved preset in a gated binary says saved instead of On', async () => {
  listFocusShieldRules.mockResolvedValue([createFocusShieldPresetRule('youtube-shorts', 'preset-youtube-shorts')]);
  const screen = render(<Section protectionCapability={android} protectionStatus={status} onRefresh={jest.fn()} />);
  await act(async () => {});
  expect(screen.getByText('Preset saved')).toBeOnTheScreen();
  expect(screen.queryByText('Preset On')).toBeNull();
});
test('iOS Safari action targets Focus Shield and does not promise a temporary browser grant', async () => {
  const ios = { ...android, platform: 'ios', screenTime: true, managedSettings: true, safariContentBlocker: true };
  const screen = render(<Section protectionCapability={ios} protectionStatus={{ ...status, mode: 'screen-time' }} onRefresh={jest.fn()} />);
  await act(async () => {});
  expect(openSafariExtensionSettings).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByTestId('focus-shield-safari-settings')); });
  expect(openSafariExtensionSettings).toHaveBeenCalledWith('focus-shield');
  expect(screen.getByText(/browser pause stays paused until/)).toBeOnTheScreen();
});
