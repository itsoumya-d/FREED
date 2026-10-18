import React from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { appI18n } from '@/i18n/runtime';
import * as Native from 'freed-protection';

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
// Exercise the installed navigation focus hook, with a retained route emitting
// the same blur/focus events as a push and Back. No component remount occurs.
jest.mock('expo-router', () => ({ useFocusEffect: require('@react-navigation/native').useFocusEffect }));
jest.mock('freed-protection', () => ({
  applyAdultContentFilter: jest.fn(), requestProtectionAuthorization: jest.fn(), presentFamilyActivityPicker: jest.fn(),
  openUsageAccessSettings: jest.fn(), openProtectionSettings: jest.fn(), openPrivateDnsSettings: jest.fn(),
  openVpnSettings: jest.fn(), openSafariExtensionSettings: jest.fn(),
}));
const capability: any = { platform: 'ios', screenTime: true, managedSettings: true, appGuardModes: true, appGroups: true, notes: [] };
const status: any = { authorized: true, active: false, mode: 'screen-time', message: '', selectedApplications: 0, appGuardMode: 'daily-limit', appGuardReady: false };
function retainedRoute() {
  let focused = true;
  const listeners = { focus: new Set<() => void>(), blur: new Set<() => void>() };
  const navigation: any = { isFocused: () => focused, addListener: (event: 'focus' | 'blur', listener: () => void) => { listeners[event].add(listener); return () => listeners[event].delete(listener); } };
  return { navigation, emit(event: 'focus' | 'blur') { focused = event === 'focus'; listeners[event].forEach(listener => listener()); } };
}
beforeEach(async () => { (AppState as any).currentState = 'active'; await appI18n.changeLanguage('en'); });
test('retained focused app setup can cancel, return, refresh and re-enter shared rules without a remount or legacy save', async () => {
  const route = retainedRoute(), choose = jest.fn(), close = jest.fn(), sync = jest.fn(), save = jest.fn(), limit = jest.fn(), refresh = jest.fn(async () => ({ capability, status }));
  const present = (providedStatus = status) => <NavigationContext.Provider value={route.navigation}><ProtectionFeatureSetup intent="apps" capability={capability} status={providedStatus} appCount={0} onRefresh={refresh} onChooseApps={choose} onSyncApps={sync} onAppGuardSave={save} onDailyLimitChange={limit} onClose={close} vpnDisclosureAcknowledged onAcknowledgeVpnDisclosure={jest.fn()} /></NavigationContext.Provider>;
  const view = render(present());
  await act(async () => {});
  const initialReads = refresh.mock.calls.length;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); fireEvent.press(view.getByTestId('feature-setup-continue')); });
    expect(choose).toHaveBeenCalledTimes(attempt); expect(view.getByTestId('feature-setup-continue')).toBeDisabled();
    await act(async () => { route.emit('focus'); }); // Duplicate initial focus is not a return.
    expect(view.getByTestId('feature-setup-continue')).toBeDisabled();
    await act(async () => { route.emit('blur'); });
    // Parent status updates while the setup route remains under the editor must
    // not release the push latch or pretend the edit was saved.
    view.rerender(present({ ...status, selectedApplications: 2, appGuardReady: true }));
    expect(view.getByTestId('feature-setup-continue')).toBeDisabled();
    expect(view.queryByRole('button', { name: 'Done' })).toBeNull(); expect(close).not.toHaveBeenCalled();
    await act(async () => { route.emit('focus'); });
    expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled(); expect(view.getByTestId('feature-setup-refresh')).not.toBeDisabled();
    expect(choose).toHaveBeenCalledTimes(attempt);
    await act(async () => { fireEvent.press(view.getByTestId('feature-setup-refresh')); });
  }
  expect(refresh.mock.calls.length).toBe(initialReads + 2); expect(sync).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled(); expect(limit).not.toHaveBeenCalled();
  expect(Native.presentFamilyActivityPicker).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
});
function combinedProbe(choose: () => void) {
  const source = readFileSync(process.env.TASK149_ROOT_SOURCE ?? 'src/features/freed-app.tsx', 'utf8');
  const refsStart = source.indexOf('  const setupActionRunningRef ='), refsEnd = source.indexOf('  const [setupActionError', refsStart);
  const actionsStart = source.indexOf('  const runAppPackageSync ='), actionsEnd = source.indexOf('  // Capped, rate-limited auto-start', actionsStart);
  const onSyncAppPackages = jest.fn(), onRefresh = jest.fn(), onContinue = jest.fn(), runAction = jest.fn();
  const deps: any = { React, View, Text, Pressable, AppState, Platform, useFocusEffect, protectionCapability: capability, protectionStatus: status,
    onChooseApps: choose, onSyncAppPackages, onRefresh, onContinue, runAction, setNotice: jest.fn(), setBusy: jest.fn(), setActivationTest: jest.fn(),
    safeUserFacingMessage: (value: any, fallback: string) => value ?? fallback, setupAutoAdvanceRef: { current: null }, permissionPlan: [], prepareSetupAutoAdvance: jest.fn(),
    safariSetupAction: () => 'settings', runFeedSync: jest.fn(), hasVpnSetupConflict: () => false, hasPrivateDnsSetupConflict: () => false, privateDnsStep: null, selectedAppPackageCount: 0, vpnDisclosureAcknowledged: true };
  const code = `return function Probe(){${source.slice(refsStart, refsEnd)}${source.slice(actionsStart, actionsEnd)} return <View><Pressable testID="combined-choose" onPress={()=>runStepAction({id:'apps',action:'choose-ios-targets',status:'needed',required:true})}><Text>Choose apps</Text></Pressable></View>;}`;
  const Probe = new Function(...Object.keys(deps), transpileModule(code, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText)(...Object.values(deps));
  return { Probe, onSyncAppPackages, onRefresh, onContinue, runAction };
}
test('retained combined setup releases only its navigation latch on focus return, allowing another edit after cancel', async () => {
  const route = retainedRoute(), choose = jest.fn(), f = combinedProbe(choose);
  const view = render(<NavigationContext.Provider value={route.navigation}><f.Probe /></NavigationContext.Provider>);
  for (let attempt = 1; attempt <= 2; attempt++) {
    await act(async () => { fireEvent.press(view.getByTestId('combined-choose')); fireEvent.press(view.getByTestId('combined-choose')); });
    expect(choose).toHaveBeenCalledTimes(attempt);
    await act(async () => { route.emit('blur'); });
    fireEvent.press(view.getByTestId('combined-choose')); expect(choose).toHaveBeenCalledTimes(attempt);
    await act(async () => { route.emit('focus'); });
    expect(choose).toHaveBeenCalledTimes(attempt);
  }
  expect(f.onSyncAppPackages).not.toHaveBeenCalled(); expect(f.onRefresh).not.toHaveBeenCalled(); expect(f.onContinue).not.toHaveBeenCalled(); expect(f.runAction).not.toHaveBeenCalled();
});

test('route return cannot release an outstanding native permission action or issue a duplicate request', async () => {
  let finish!: (value: any) => void;
  (Native.requestProtectionAuthorization as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const route = retainedRoute(), choose = jest.fn(), refresh = jest.fn(async () => ({ capability, status: { ...status, authorized: false } }));
  const view = render(<NavigationContext.Provider value={route.navigation}><ProtectionFeatureSetup intent="apps" capability={capability} status={{ ...status, authorized: false }} appCount={0} onRefresh={refresh} onChooseApps={choose} onSyncApps={jest.fn()} onClose={jest.fn()} vpnDisclosureAcknowledged onAcknowledgeVpnDisclosure={jest.fn()} /></NavigationContext.Provider>);
  await act(async () => {});
  fireEvent.press(view.getByTestId('feature-setup-continue'));
  await act(async () => { route.emit('blur'); route.emit('focus'); });
  expect(view.getByTestId('feature-setup-continue')).toBeDisabled();
  fireEvent.press(view.getByTestId('feature-setup-continue'));
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(1);
  await act(async () => { finish({ authorizationOutcome: 'denied', authorized: false }); });
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled(); expect(view.getByRole('alert')).toHaveTextContent(/not allowed/i); expect(choose).not.toHaveBeenCalled();
});
