const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const base = 'modules/freed-protection/android/src/main/java/app/freed/protection/';

test('schedule storage is a confirmed independent transaction', () => {
  const store = readFileSync(base + 'FreedAppScheduleStore.kt', 'utf8');
  assert.ok(store.includes('app_schedule_configuration_v1'));
  assert.ok(store.includes('.commit()'), 'Disk persistence must be confirmed before acceptance.');
  assert.ok(store.includes('rollback'), 'Failed SharedPreferences commits must restore the prior memory value.');
  assert.ok(!store.includes('BLOCKED_APP_PACKAGES'), 'Schedule writes must not replace manual daily-limit selections.');
});

test('native schedule API reports live connection and does not require new alarm permissions', () => {
  const module = readFileSync(base + 'FreedProtectionModule.kt', 'utf8');
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  assert.ok(module.includes('AsyncFunction("configureAppSchedules")'));
  assert.ok(module.includes('"appSchedules" to true'));
  const status = module.slice(module.indexOf('private fun appScheduleStatusPayload'), module.indexOf('\n  private fun ', module.indexOf('private fun appScheduleStatusPayload') + 1));
  assert.ok(status.includes('val connected = FreedAccessibilityService.appSchedulesServiceConnected'));
  assert.ok(status.includes('"appSchedulesServiceConnected" to connected'), 'The reported connection must use the captured native runtime fact.');
  for (const action of ['ACTION_TIME_CHANGED', 'ACTION_DATE_CHANGED', 'ACTION_TIMEZONE_CHANGED', 'ACTION_SCREEN_ON', 'ACTION_SCREEN_OFF']) {
    assert.ok(service.includes(action), action);
  }
  assert.ok(service.includes('unregisterReceiver(scheduleClockReceiver)'));
  assert.ok(service.includes('unregisterOnSharedPreferenceChangeListener(schedulePreferencesListener)'));
  assert.ok(service.includes('connectedService === this'));
  assert.ok(!service.includes('AlarmManager'));
  assert.ok(!service.includes('startForeground('));
  const unbind = service.slice(service.indexOf('override fun onUnbind'), service.indexOf('override fun onDestroy'));
  assert.ok(unbind.includes('disconnectAppScheduleRuntime()'));
  const destroy = service.slice(service.indexOf('override fun onDestroy'), service.indexOf('internal fun updateFocusShieldCalibrationOwner'));
  assert.ok(destroy.includes('disconnectAppScheduleRuntime()'));
});

test('an interrupted but connected service resumes epoch-owned schedule checks', () => {
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  const interrupt = service.slice(service.indexOf('override fun onInterrupt'), service.indexOf('override fun onUnbind'));
  assert.ok(interrupt.includes('postAppScheduleRecheck()'), 'A still-connected quiet foreground app must get a new check after interruption.');
  assert.ok(!interrupt.includes('disconnectAppScheduleRuntime()'), 'A feedback interruption is not permission revocation.');
  const post = service.slice(service.indexOf('private fun postAppScheduleRecheck'), service.indexOf('private fun recheckAppSchedules'));
  assert.ok(post.includes('ownsConnectedRuntime() && ownerEpoch == scheduleConnectionEpoch'));
});

test('all earned relocks require current foreground evidence even for manual schedule overlap', () => {
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  const callback = service.slice(service.indexOf('private val earnedUnlockRelockRunnable'), service.indexOf('override fun onServiceConnected'));
  const expiry = service.slice(service.indexOf('private fun scheduleEarnedUnlockRelock'), service.indexOf('private fun cancelEarnedUnlockRelock'));
  assert.ok(callback.includes('FreedAppSchedulePolicy.shouldRelock('));
  assert.ok(expiry.includes('FreedAppSchedulePolicy.shouldRelock('));
  assert.ok(callback.includes('liveScheduleForegroundPackage()'));
  assert.ok(expiry.includes('liveScheduleForegroundPackage()'));
  assert.ok(!callback.includes('isManuallyBlockedApp(packageName) ||'));
  assert.ok(!expiry.includes('isManuallyBlockedApp(normalizedPackage) ||'));
  const live = service.slice(service.indexOf('private fun liveScheduleForegroundPackage'), service.indexOf('private fun postAppScheduleRecheck'));
  assert.ok(live.includes('!isScreenInteractiveAndUnlocked()'));
  assert.ok(live.includes('rootInActiveWindow'));
  assert.ok(!live.includes('LAST_FOREGROUND_PACKAGE'));
});

test('screen-on and reconnect restore both manual timers and schedule targets', () => {
  const service = readFileSync(base + 'FreedAccessibilityService.kt', 'utf8');
  const recheck = service.slice(service.indexOf('private fun recheckAppSchedules'), service.indexOf('private fun armAppScheduleCheck'));
  assert.ok(recheck.includes('manual + configuration.potentialPackages'));
  assert.ok(recheck.includes('scheduleAppLimitCheck(foreground)'));
  assert.ok(recheck.includes('scheduleEarnedUnlockRelock(foreground)'));
  const screenOff = service.slice(service.indexOf('private val scheduleClockReceiver'), service.indexOf('private var scheduledLimitPackage'));
  assert.ok(screenOff.includes('finishForegroundUsageSegment()'), 'Sleeping time must not become a foreground manual-usage segment.');
});

test('schedule/manual membership and grant fulfillment share one native transaction lock', () => {
  const store = readFileSync(base + 'FreedAppScheduleStore.kt', 'utf8');
  const module = readFileSync(base + 'FreedProtectionModule.kt', 'utf8');
  assert.ok(store.includes('synchronized(FreedNativeUnlockStore.lock)'));
  const manual = module.slice(module.indexOf('AsyncFunction("configureBlockedAppPackages")'), module.indexOf('AsyncFunction("configureAppSchedules")'));
  assert.ok(manual.includes('synchronized(FreedNativeUnlockStore.lock)'));
  const grant = module.slice(module.indexOf('AsyncFunction("applyEarnedUnlockWindow")'), module.indexOf('AsyncFunction("clearEarnedUnlockWindow")'));
  assert.match(grant, /val authority = synchronized\(FreedNativeUnlockStore\.lock\)\s*\{\s*if \(isAccessibilityServiceEnabled\(context\) && sourcePackage in configuredBlockedPackages\(context\)\)/);
  assert.ok(grant.includes('FreedNativeUnlockStore.fulfill(context,'));
});
