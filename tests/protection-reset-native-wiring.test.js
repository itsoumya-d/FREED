const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const base = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
test('Android reset exposes strict acknowledgement and preserves OS settings', () => {
  const module = readFileSync(base + 'FreedProtectionModule.kt', 'utf8');
  assert.ok(module.includes('AsyncFunction("resetProtectionConfiguration")'));
  assert.ok(module.includes('"protectionConfigurationResetAccepted", result.accepted'));
  const helper = readFileSync(base + 'FreedProtectionConfiguration.kt', 'utf8');
  assert.ok(helper.includes('.clear().putBoolean(INTERCEPTION_DISABLED, true).putLong(CONFIGURATION_EPOCH, nextEpoch).commit()'));
  assert.ok(helper.includes('FreedEncryptedDnsConfig.clearOwnedConfiguration(context)'));
  assert.ok(helper.includes('FreedFocusShieldRollout.clearOwnedConfiguration(context)'));
  assert.ok(helper.includes('FreedVpnService.stopOwnedRuntimeForReset(context)'));
  assert.ok(helper.includes('FreedAccessibilityService.clearOwnedRuntimeForReset()'));
  assert.ok(!helper.includes('Settings.Secure.put'));
  assert.ok(!helper.includes('Settings.Global.put'));
  assert.ok(!helper.includes('disableSelf()'));
});
test('reset disables browser classification and empty settings sync cannot reactivate it', () => {
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  const event = service.slice(service.indexOf('override fun onAccessibilityEvent'), service.indexOf('override fun onInterrupt'));
  assert.ok(event.includes('!FreedProtectionConfiguration.interceptionEnabled(this)'));
  assert.ok(event.indexOf('interceptionEnabled(this)') < event.indexOf('trackForegroundUsage('));
  const schedules = readFileSync(base + 'FreedAppScheduleStore.kt', 'utf8');
  assert.ok(schedules.includes('!FreedProtectionConfiguration.interceptionEnabled(context)'));
  assert.ok(!schedules.includes('FreedProtectionConfiguration.activate(context)'));
  const module = readFileSync(base + 'FreedProtectionModule.kt', 'utf8');
  const manual = module.slice(module.indexOf('AsyncFunction("configureBlockedAppPackages")'), module.indexOf('AsyncFunction("configureAppSchedules")'));
  assert.ok(manual.includes('!FreedProtectionConfiguration.interceptionEnabled(context)'));
  assert.ok(!manual.includes('FreedProtectionConfiguration.activate(context)'));
  const helper = readFileSync(base + 'FreedProtectionConfiguration.kt', 'utf8');
  assert.ok(helper.includes('FreedNativeUnlockStore.clearAllAuthority(editor)'));
});
test('only explicit activation can release the persisted reset latch', () => {
  const module = readFileSync(base + 'FreedProtectionModule.kt', 'utf8');
  assert.ok(module.includes('AsyncFunction("activateProtectionConfiguration")'));
  assert.ok(module.includes('"protectionConfigurationActivationAccepted", accepted'));
  const status = module.slice(module.indexOf('private fun appScheduleStatusPayload'), module.indexOf('\n  private fun ', module.indexOf('private fun appScheduleStatusPayload') + 1));
  assert.ok(status.includes('val enabled = FreedProtectionConfiguration.interceptionEnabled(context)'));
  assert.ok(status.includes('"protectionConfigurationResetDisabled" to !enabled'));
  for (const filename of ['FreedAppScheduleStore.kt', 'FreedFocusShieldRules.kt', 'FreedFocusShieldRollout.kt']) {
    const source = readFileSync(base + filename, 'utf8');
    assert.ok(!source.includes('FreedProtectionConfiguration.activate(context)'), filename);
  }
  const encrypted = module.slice(module.indexOf('AsyncFunction("configureEncryptedDns")'), module.indexOf('AsyncFunction("getStatus")'));
  assert.ok(!encrypted.includes('FreedProtectionConfiguration.activate(context)'));
});
test('reset verifies closed VPN resources and cancels pending native runtime work', () => {
  const vpn = readFileSync(base + 'FreedVpnService.kt', 'utf8');
  assert.ok(vpn.includes('stopOwnedRuntimeForReset'));
  assert.ok(vpn.includes('runtimeCloseSucceeded'));
  assert.ok(vpn.includes('!isRunning && service.vpnInterface == null && service.output == null'));
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  assert.ok(service.includes('clearOwnedRuntimeForReset'));
  const reset = service.slice(service.indexOf('private fun clearOwnedProtectionRuntime'), service.indexOf('private fun trackForegroundUsage'));
  for (const call of ['cancelAppScheduleCheck()', 'cancelAnyAppLimitCheck()', 'clearShortFormSession()', 'cancelEarnedUnlockRelock()', 'disposeWithoutResult()']) assert.ok(reset.includes(call));
});
test('reset prevents pending DNS and usage callbacks from recreating deleted private state', () => {
  const vpn = readFileSync(base + 'FreedVpnService.kt', 'utf8');
  const dns = vpn.slice(vpn.indexOf('private fun recordAndLaunchDnsIntervention'), vpn.indexOf('private fun buildDnsInterventionIntent'));
  assert.ok(dns.includes('synchronized(FreedNativeUnlockStore.lock)'));
  assert.ok(dns.includes('!FreedProtectionConfiguration.interceptionEnabled(this)'));
  assert.ok(dns.includes('PENDING_INTERVENTION_ID, null) != interventionId'));
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  for (const method of ['trackForegroundUsage', 'finishForegroundUsageSegment', 'ensureDailyUsageWindow']) {
    const start = service.indexOf('private fun ' + method);
    const section = service.slice(start, service.indexOf('\n  private fun ', start + 1));
    assert.ok(section.includes('synchronized(FreedNativeUnlockStore.lock)'), method);
    assert.ok(section.includes('!FreedProtectionConfiguration.interceptionEnabled(this)'), method);
  }
});
test('queued encrypted requests cannot fall back to plaintext while reset is in progress', () => {
  const encrypted = readFileSync(base + 'FreedEncryptedDnsConfig.kt', 'utf8');
  const send = encrypted.slice(encrypted.indexOf('fun <T> withPlaintextPermission'));
  assert.ok(send.includes('!FreedProtectionConfiguration.interceptionEnabled(context) || isRequested(context)'));
});
test('reset dismisses only the captured FREED activity and blocks stale recovery redirects', () => {
  const activity = readFileSync(base + 'FreedInterventionActivity.kt', 'utf8');
  assert.ok(activity.includes('WeakReference<FreedInterventionActivity>'));
  assert.ok(activity.includes('activeActivity.get() !== captured'));
  assert.ok(activity.includes('activeActivity.get() === this'));
  assert.ok(activity.includes('setIntent(Intent())'));
  const eligibility = activity.slice(activity.indexOf('private fun canPresentCurrentIntervention'), activity.indexOf('private fun dismissForConfigurationReset'));
  assert.ok(eligibility.includes('FreedInterventionHandoffPolicy.mayOpen('));
  for (const key of ['INTERVENTION_ID_EXTRA', 'PENDING_INTERVENTION_ID', 'PENDING_SOURCE_PACKAGE', 'PENDING_RULE', 'PENDING_DETECTED_AT']) assert.ok(eligibility.includes(key), key);
  assert.ok(eligibility.includes('intent.getLongExtra(FreedProtectionConfiguration.INTENT_EPOCH, -1L), FreedProtectionConfiguration.epoch(this)'));
  const handoff = readFileSync(base + 'FreedInterventionHandoffPolicy.kt', 'utf8');
  for (const guard of ['!enabled', 'intentEpoch != currentEpoch', 'expectedId != pendingId', 'source != pendingSource', 'rule != pendingRule', 'parseDate(detectedAt)']) assert.ok(handoff.includes(guard), guard);
  const redirect = activity.slice(activity.indexOf('private fun openRecoveryApp'), activity.indexOf('private fun finishCleanly'));
  assert.ok(redirect.includes('!FreedProtectionConfiguration.interceptionEnabled(this)'));
  const helper = readFileSync(base + 'FreedProtectionConfiguration.kt', 'utf8');
  assert.ok(helper.includes('FreedInterventionActivity.clearOwnedRuntimeForReset()'));
});
test('every resolver racer/socket belongs to reset teardown and late metadata is epoch-fenced', () => {
  const vpn = readFileSync(base + 'FreedVpnService.kt', 'utf8');
  assert.ok(vpn.includes('ownership.startThread(epoch, "FreedDnsRace")'));
  assert.ok(vpn.includes('runtimeOwnership.registerUdpSocket(epoch, socket)'));
  assert.ok(vpn.includes('runtimeOwnership.releaseUdpSocket(socket)'));
  assert.ok(vpn.includes('owner.awaitStopped(remaining)'));
  assert.ok(vpn.includes('runtimeOwners.all { it.isStopped() }'));
  assert.ok(vpn.includes('runtimeOwnership.withEpoch(runtimeOwnership.threadEpoch())'));
  const forwarding = vpn.slice(vpn.indexOf('private fun forwardDns('), vpn.indexOf('private fun recordForwardLatency'));
  for (const line of forwarding.split('\n').filter(line => /lastForward(?:Resolver|Failure)\s*=/.test(line))) {
    assert.ok(line.includes('publishDnsMetadata'), line);
  }
});
