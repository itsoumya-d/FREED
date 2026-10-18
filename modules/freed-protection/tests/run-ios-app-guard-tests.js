const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const evidence = process.argv.find(x => x.startsWith('--evidence-dir='))?.slice(15);
const workspace = mkdtempSync(join(tmpdir(), 'freed-ios-app-guard-'));
const commandRecords=[];
function run(command, args) {
  const started=Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 180_000 });
  commandRecords.push({command,args,timeoutMs:180_000,status:result.status,signal:result.signal,error:result.error?{code:result.error.code,message:result.error.message}:null,elapsedMs:Date.now()-started,stdout:result.stdout,stderr:result.stderr});
  writeFileSync(join(workspace,'command-results.json'),JSON.stringify(commandRecords,null,2)+'\n');
  assert.equal(result.status, 0, `${command}: ${result.error?.message || ''}${result.stdout}${result.stderr}`);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}
function block(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `Missing production seam: ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 1, end = open + 1;
  for (; depth && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  return source.slice(start, end);
}
try {
  const moduleSource = readFileSync(join(root, 'modules/freed-protection/ios/FreedProtectionModule.swift'), 'utf8');
  const monitorSource = readFileSync(join(root, 'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift'), 'utf8');
  assert.ok(moduleSource.includes('AsyncFunction("configureAppGuardMode")'), 'The callable must exist in the actual Expo module.');
  const moduleMethods = ['configuredAppGuardMode', 'configureAppGuardMode', 'installConfiguredAppGuard',
    'configureAppSchedules', 'configuredAppSchedules', 'installAppScheduleRegistrations', 'saveFamilyActivitySelection',
    'areAppScheduleRegistrationsReady', 'activeAppScheduleIDs', 'isIndependentAppGuardActive', 'isStrictAppGuardConfiguredForSelection', 'isStrictAppGuardActive', 'shouldShieldLegacyTargets',
    'makeSelectedAppLimitEvent', 'scheduleSelectedAppLimitMonitoring', 'stopSelectedAppLimitMonitoring', 'applySelectedShieldsForCurrentState',
    'isSelectedScreenTimeScope', 'applySelectedShieldsExcludingEarnedUnlockScope', 'isAppGuardReady'];
  const extracted = moduleMethods.map(name => block(moduleSource, `  private func ${name}(`)).join('\n')
    .replace(/^(\s*)#if canImport\((?:ManagedSettings|FamilyControls|DeviceActivity)\).*$/gm, '$1#if true');
  const input = join(workspace, 'ProductionAppGuard.swift');
  const monitor = monitorSource.replace(/^import (?:DeviceActivity|FamilyControls|ManagedSettings)\n/gm, '')
    .replaceAll('private ', '').replace('@objc(DeviceActivityMonitorExtension)', '').replace('"group.app.freed.recovery"', 'guardTestDomain');
  writeFileSync(input, 'import Foundation\nenum FreedAppGroupsPolicy { static let prefix = "freed.group." }\nfinal class FreedAppGroupsRuntime { static let shared = FreedAppGroupsRuntime(); static func legacyAppsAdopted(_ defaults: UserDefaults) -> Bool { false }; func callback(activity: String, event: String? = nil) {} }\n' + 'final class AppGuardHarness {\n'
    + block(moduleSource, '  private struct InterventionScope').replaceAll('private ', '')
    + '\n' + extracted.replaceAll('private ', '')
    + '\n' + readFileSync(join(__dirname, 'AppGuardHarnessMembers.swift'), 'utf8') + '\n}\n' + monitor
    + '\nfinal class RelockHarness {\n'
    + ['earnedUnlockRelockSchedule', 'isEarnedUnlockMonitoringReady', 'scheduleEarnedUnlockMonitoring']
      .map(name => block(moduleSource, `  private func ${name}(`)).join('\n')
      .replaceAll('private ', '').replace(/^(\s*)#if canImport\(DeviceActivity\).*$/gm, '$1#if true')
    + '\nlet earnedUnlockActivityName = "freed.earnedUnlockWindow"\n'
    + 'func sharedDefaults() -> UserDefaults { UserDefaults(suiteName: guardTestDomain)! }\n'
    + 'func makeFreedError(_ message: String) -> Error { NSError(domain: "isolated.relock", code: 1) }\n}\n'
    + '\nfinal class LeaseAuthorityHarness {\n'
    + block(moduleSource, '  private struct InterventionScope').replaceAll('private ', '') + '\n'
    + block(moduleSource, '  private struct EarnedUnlockMonitoringSnapshot').replaceAll('private ', '') + '\n'
    + ['captureEarnedUnlockMonitoringSnapshot', 'invalidateActiveEarnedUnlockLease', 'activeEarnedUnlockExpiresAt', 'isEarnedUnlockActive', 'clearActiveEarnedUnlockState', 'clearEarnedUnlockState',
      'refreshEarnedUnlockWindow', 'restoreEarnedUnlockMonitoring', 'scheduleEarnedUnlockMonitoring',
      'isEarnedUnlockMonitoringReady', 'earnedUnlockRelockSchedule', 'stopEarnedUnlockMonitoring',
      'parseIsoDate', 'formatIsoDate', 'boundedEarnedUnlockExpiry', 'isScreenTimeUnlockSource',
      'sanitizedPendingInterventionId', 'sanitizeHostForStorage', 'isValidHostLabel', 'activeEarnedUnlockScope', 'scopeStored',
      'decodedScopeTokenData', 'isSelectedScreenTimeScope', 'configuredAppGuardMode',
      'applySelectedShieldsForCurrentState', 'applySelectedShieldsIfAvailable', 'clearSelectedShields', 'applySelectedShieldsExcludingEarnedUnlockScope']
      .map(name => block(moduleSource, `  private func ${name}(`)).join('\n')
      .replaceAll('private ', '').replace(/^(\s*)#if canImport\((?:ManagedSettings|FamilyControls|DeviceActivity)\).*$/gm, '$1#if true')
    + '\n' + readFileSync(join(__dirname, 'LeaseAuthorityHarnessMembers.swift'), 'utf8') + '\n}\n');
  const executable = join(workspace, 'app-guard-cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', input,
    'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedAppGuardPolicy.swift', 'modules/freed-protection/tests/AppGuardCases.swift', '-o', executable]);
  run(executable, []);
  // The extension uses the same persisted mode and application-only authority.
  for (const source of [moduleSource, monitorSource]) {
    const scope = block(source, '  private func isSelectedScreenTimeScope(');
    assert.ok(scope.includes('scope.tokenType == "application"'));
    assert.ok(!scope.includes('case "domain"') && !scope.includes('case "category"'));
    const exclusions = block(source, '  private func applySelectedShieldsExcludingEarnedUnlockScope(');
    assert.ok(!exclusions.includes('decode(WebDomainToken.self') && !exclusions.includes('decode(ActivityCategoryToken.self'));
    assert.ok(exclusions.includes('isIndependentAppGuardActive()'));
  }
  if (!process.argv.includes('--runtime-only')) {
  run('xcrun', ['swiftc', '-frontend', '-parse', 'modules/freed-protection/ios/FreedProtectionModule.swift']);
  run('xcrun', ['swiftc', '-frontend', '-parse', 'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift', 'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift', 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift']);
  const sdk = spawnSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { encoding: 'utf8' }).stdout.trim();
  const sdkInput = join(workspace, 'AppGuardSDKTypecheck.swift');
  const sdkMethods = [...new Set([...moduleMethods, 'applySelectedShieldsIfAvailable', 'decodedScopeTokenData', 'clearSelectedShields',
    'earnedUnlockRelockSchedule', 'isEarnedUnlockMonitoringReady', 'scheduleEarnedUnlockMonitoring',
    'restoreEarnedUnlockMonitoring', 'captureEarnedUnlockMonitoringSnapshot', 'invalidateActiveEarnedUnlockLease', 'clearActiveEarnedUnlockState', 'activeEarnedUnlockExpiresAt', 'parseIsoDate',
    'boundedEarnedUnlockExpiry', 'sanitizedPendingInterventionId', 'isScreenTimeUnlockSource', 'sanitizeHostForStorage', 'isValidHostLabel'])];
  writeFileSync(sdkInput, 'import Foundation\nimport FamilyControls\nimport ManagedSettings\nimport DeviceActivity\n'
    + block(moduleSource, 'struct FreedProtectionResetPolicy') + '\n@available(iOS 16.0, *) final class AppGuardSDKTypecheck {\n'
    + block(moduleSource, '  private struct InterventionScope') + '\n'
    + block(moduleSource, '  private struct EarnedUnlockMonitoringSnapshot') + '\n'
    + sdkMethods.map(name => block(moduleSource, `  private func ${name}(`)).join('\n')
    + `\nprivate let store = ManagedSettingsStore()
      private let appGuardModeKey = "freed.appGuard.mode", appLimitActivityName = "freed.selectedAppDailyLimit"
      private let appLimitEventName = "freed.selectedAppDailyLimitReached", earnedUnlockActivityName = "freed.earnedUnlockWindow"
      private let earnedUnlockSourceKey = "freed.earnedUnlock.source", earnedUnlockScopeKey = "freed.earnedUnlock.scope"
      private let earnedUnlockInterventionIdKey = "freed.earnedUnlock.interventionId"
      private let screenTimeShieldHost = "screen-time-shield.freed.local", screenTimeShieldSource = "ios-screen-time"
      private let maxEarnedUnlockMinutes = 120
      private let earnedUnlockExpiresAtKey = "freed.earnedUnlock.expiresAt", riskWindowCurrentlyActiveKey = "freed.riskWindow.currentlyActive"
      private let familyActivitySelectionKey = "freed.familyActivitySelection", selectionAppCountKey = "freed.selection.appCount"
      private let selectionCategoryCountKey = "freed.selection.categoryCount", selectionWebDomainCountKey = "freed.selection.webDomainCount"
      private func sharedDefaults() -> UserDefaults { .standard }
      private func loadFamilyActivitySelection() -> FamilyActivitySelection { FamilyActivitySelection() }
      private func isAuthorized() -> Bool { true }
      private func hasAppGuardModes() -> Bool { true }
      private func isAdultFilterActive() -> Bool { true }
      private func isRiskWindowMonitoringActive() -> Bool { false }
      private func isAppLimitMonitoringActive() -> Bool { false }
      private func isAppLimitReachedToday() -> Bool { false }
      private func setAppLimitMonitoringActive(_ active: Bool) {}
      private func isEarnedUnlockActive() -> Bool { false }
      private func activeEarnedUnlockScope() -> InterventionScope? { nil }
      private func configuredDailyLimitMinutes() -> Int { 20 }
      private func sanitizeDailyLimitMinutes(_ value: Int?) -> Int { min(240, max(5, value ?? 20)) }
      private func stopEarnedUnlockMonitoring() {}
      private func makeFreedError(_ message: String) -> Error { NSError(domain: "isolated.typecheck", code: 1) }
      private func statusPayload(authorized: Bool, active: Bool, scheduled: Bool, message: String) -> [String: Any] { [:] }
    }\n`);
  run('xcrun', ['swiftc', '-typecheck', '-sdk', sdk, '-target', 'arm64-apple-ios15.1',
    'modules/freed-protection/ios/FreedAppGuardPolicy.swift', 'modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift', 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift', 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift', 'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedFriendLockCore.swift', 'modules/freed-protection/ios/FreedFriendLockRecordStore.swift', 'modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift', 'modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift', 'modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift', 'modules/freed-protection/ios/FreedFriendLockKeychain.swift', sdkInput]);
  run('xcrun', ['swiftc', '-typecheck', '-sdk', sdk, '-target', 'arm64-apple-ios15.1',
    'modules/freed-protection/ios/FreedAppGuardPolicy.swift', 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift',
    'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift', 'modules/freed-protection/ios/FreedRetainedAdultProtection.swift', 'modules/freed-protection/ios/FreedAppGroupsPolicy.swift','modules/freed-protection/ios/FreedEarnedAppTimePolicy.swift','modules/freed-protection/ios/FreedChallengeEvidencePolicy.swift','modules/freed-protection/ios/FreedChallengeStepObserver.swift','modules/freed-protection/ios/FreedEarnedAppTimeTrustedClock.swift', 'modules/freed-protection/ios/FreedAppGroupsRuntime.swift']);
  }
} finally { if (evidence) { mkdirSync(evidence, {recursive:true}); cpSync(workspace, join(evidence, "fixture-artifacts"), {recursive:true}); } rmSync(workspace, { recursive: true, force: true }); }
