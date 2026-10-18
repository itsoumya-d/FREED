import React from 'react';
import { readFileSync } from 'node:fs';
import { JsxEmit, ModuleKind, transpileModule } from 'typescript';
import { AppState, Platform } from 'react-native';
const source = () => readFileSync(process.env.TASK149_ROOT_SOURCE ?? 'src/features/freed-app.tsx', 'utf8');
const compile = (text: string, deps: Record<string, any>) => new Function(...Object.keys(deps), transpileModule(text, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.React } }).outputText)(...Object.values(deps));
function fixture(groupCapable = true) {
  const onChooseApps = jest.fn(), onSyncAppPackages = jest.fn(async () => ({ message: 'read only' })), onRefresh = jest.fn(), prepareSetupAutoAdvance = jest.fn(), runAction = jest.fn(), setNotice = jest.fn();
  const deps: any = { React: { useCallback: (fn: any) => fn }, AppState, Platform, protectionCapability: { appGroups: groupCapable }, protectionStatus: {},
    requestProtectionAuthorization: jest.fn(), onChooseApps, onSyncAppPackages, onRefresh, setNotice, setBusy: jest.fn(), setActivationTest: jest.fn(), safeUserFacingMessage: (v: any, fallback: string) => v ?? fallback,
    setupActionRunningRef: { current: false }, appRulesNavigationPending: { current: false }, setupAutoAdvanceRef: { current: { fromStepId: 'old' } },
    permissionPlan: [], prepareSetupAutoAdvance, safariSetupAction: () => 'settings', runAction, runFeedSync: jest.fn(),
    hasVpnSetupConflict: () => false, hasPrivateDnsSetupConflict: () => false, privateDnsStep: null, selectedAppPackageCount: 3, vpnDisclosureAcknowledged: true };
  const s = source(), start = s.indexOf('  const runAppPackageSync ='), end = s.indexOf('  // Capped, rate-limited auto-start', start);
  const fns = compile(s.slice(start, end) + '; return {runAppPackageSync,runStepAction};', deps);
  return { ...fns, ...deps };
}
beforeEach(() => { (AppState as any).currentState = 'active'; });
test.each(['configure-app-guard', 'choose-ios-targets', 'choose-android-apps'])('combined group setup routes %s to the shared rule editor without global sync, picker, or auto-completion', action => {
  const f = fixture(); f.runStepAction({ id: 'apps', action, status: 'needed', required: true });
  expect(f.onChooseApps).toHaveBeenCalledTimes(1); expect(f.onSyncAppPackages).not.toHaveBeenCalled(); expect(f.runAction).not.toHaveBeenCalled();
  expect(f.prepareSetupAutoAdvance).not.toHaveBeenCalled(); expect(f.setupAutoAdvanceRef.current).toBeNull();
});
test('direct combined app sync opens the rule editor rather than treating status readback as a save', () => {
  const f = fixture(); f.runAppPackageSync(); expect(f.onChooseApps).toHaveBeenCalledTimes(1); expect(f.onSyncAppPackages).not.toHaveBeenCalled(); expect(f.setNotice).not.toHaveBeenCalled();
});
test('required permission order is preserved before modern app navigation', () => {
  const f = fixture(); f.permissionPlan.push({ id: 'permission', action: 'request-authorization', required: true, status: 'needed' });
  f.runAction.mockImplementation(() => undefined);
  // Function reference is passed to runAction, so no native request executes in this routing test.
  f.runStepAction({ id: 'apps', action: 'choose-ios-targets', status: 'needed', required: true });
  expect(f.onChooseApps).not.toHaveBeenCalled(); expect(f.runAction).toHaveBeenCalledTimes(1); expect(f.prepareSetupAutoAdvance).toHaveBeenCalledTimes(1);
});
test('legacy combined setup retains its app timer sync and picker routes', async () => {
  const f = fixture(false); f.runAppPackageSync(); await Promise.resolve(); await Promise.resolve();
  expect(f.onSyncAppPackages).toHaveBeenCalledTimes(1); expect(f.onChooseApps).not.toHaveBeenCalled();
});
test('Root both-intent choose action opens the existing group destination and preserves the legacy selection return flag', () => {
  const s = source(), start = s.indexOf('        <ProtectionSetupScreen'), end = s.indexOf('\n      );', start);
  for (const groups of [true, false]) {
    const deps: any = { React, ProtectionSetupScreen: () => null, openAdvancedProtection: jest.fn(), protectionCapability: { appGroups: groups }, protectionStatus: {}, protectionSyncMessage: null,
      disciplineSettings: { blockedAppPackages: [] }, recoveryState: {}, appSelectionReturnToProtectionSetup: false, hasProtectionSetupFallback: () => false, getRuntimeProtectionActivationPlatform: () => 'ios',
      setRecoveryState: jest.fn(), markVpnDisclosureAcknowledged: jest.fn(), markProtectionSetupFallback: jest.fn(), setProtectionSyncMessage: jest.fn(), refreshProtectionStatus: jest.fn(), saveAppGuardMode: jest.fn(), syncAppProtection: jest.fn(),
      setScreen: jest.fn(), setAppSelectionReturnToProtectionSetup: jest.fn(), openAppGroups: jest.fn() };
    const element = compile('return (' + s.slice(start, end) + ');', deps); element.props.onChooseApps();
    expect(deps.openAppGroups).toHaveBeenCalledTimes(groups ? 1 : 0);
    expect(deps.setAppSelectionReturnToProtectionSetup).toHaveBeenCalledTimes(groups ? 0 : 1);
    expect(deps.setScreen.mock.calls).toEqual(groups ? [] : [['appSelection']]);
  }
});
test('group editor cancellation/return clears a stale legacy return request without reopening, syncing, or completing setup', () => {
  const s = source(), start = s.indexOf('  React.useEffect(() => {\n    if (!appSelectionReturnPending'), end = s.indexOf('\n  React.useEffect(() => {', start + 1);
  const deps: any = { React: { useEffect: (fn: any) => fn() }, protectionCapability: { appGroups: true }, appSelectionReturnPending: true, busy: null,
    setupAutoAdvanceRef: { current: { fromStepId: 'legacy' } }, onAppSelectionReturnHandled: jest.fn(), permissionPlan: [], runAppPackageSync: jest.fn(), selectedAppPackageCount: 0, setNotice: jest.fn() };
  compile(s.slice(start, end), deps);
  expect(deps.onAppSelectionReturnHandled).toHaveBeenCalledTimes(1); expect(deps.setupAutoAdvanceRef.current).toBeNull();
  expect(deps.runAppPackageSync).not.toHaveBeenCalled(); expect(deps.setNotice).not.toHaveBeenCalled();
});
test('combined modern navigation is latched once and cannot start in the background', () => {
  const f = fixture(); f.runAppPackageSync(); f.runAppPackageSync(); expect(f.onChooseApps).toHaveBeenCalledTimes(1);
  const background = fixture(); (AppState as any).currentState = 'background'; background.runAppPackageSync();
  expect(background.onChooseApps).not.toHaveBeenCalled(); expect(background.onSyncAppPackages).not.toHaveBeenCalled();
});
