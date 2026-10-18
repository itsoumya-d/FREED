package app.freed.protection

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.AppOpsManager
import android.app.KeyguardManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.PowerManager
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import app.freed.protection.FreedDoomscrollApps.INSTAGRAM_PACKAGE
import app.freed.protection.FreedDoomscrollApps.INSTAGRAM_REELS_RULE
import app.freed.protection.FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
import app.freed.protection.FreedDoomscrollApps.TIKTOK_FEED_RULE
import app.freed.protection.FreedDoomscrollApps.TIKTOK_PACKAGES
import app.freed.protection.FreedDoomscrollApps.YOUTUBE_PACKAGE
import app.freed.protection.FreedDoomscrollApps.YOUTUBE_SHORTS_RULE
import java.util.Calendar
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class FreedAccessibilityService : AccessibilityService() {
  companion object {
    const val PREFS_NAME = "freed_protection"
    const val PENDING_INTERVENTION_ID = "pending_intervention_id"
    const val PENDING_URL = "pending_url"
    const val PENDING_HOST = "pending_host"
    const val PENDING_SOURCE_PACKAGE = "pending_source_package"
    const val PENDING_REASON = "pending_reason"
    const val PENDING_RULE = "pending_rule"
    const val PENDING_FOCUS_SHIELD_RULE_ID = "pending_focus_shield_rule_id"
    const val PENDING_DETECTED_AT = "pending_detected_at"
    const val PENDING_SESSION_DURATION_SECONDS = "pending_session_duration_seconds"
    const val EARNED_UNLOCK_EXPIRES_AT = "earned_unlock_expires_at"
    const val EARNED_UNLOCK_SOURCE_PACKAGE = "earned_unlock_source_package"
    const val MAX_EARNED_UNLOCK_MINUTES = 120
    const val BLOCKED_APP_PACKAGES = "blocked_app_packages"
    const val DAILY_LIMIT_MINUTES = "daily_limit_minutes"
    const val DEFAULT_DAILY_LIMIT_MINUTES = 30
    const val SHORT_FORM_THRESHOLD_SECONDS = "short_form_threshold_seconds"
    const val DEFAULT_SHORT_FORM_THRESHOLD_SECONDS = 90
    const val APP_USAGE_DATE_KEY = "app_usage_date_key"
    const val APP_USAGE_PREFIX = "app_usage_ms_"
    const val LAST_FOREGROUND_PACKAGE = "last_foreground_package"
    const val LAST_FOREGROUND_ELAPSED_MS = "last_foreground_elapsed_ms"

    private const val MAX_FOREGROUND_SEGMENT_MS = 4 * 60 * 60 * 1000L
    private const val MIN_SHORT_FORM_SCROLL_EVENTS = 4
    private const val SHORT_FORM_SCROLL_WINDOW_MS = 30_000L
    private const val INTERVENTION_NOTIFICATION_ID = 9404
    private const val INTERVENTION_NOTIFICATION_CHANNEL_ID = "freed_accessibility_interventions"
    @Volatile
    private var connectedService: FreedAccessibilityService? = null
    /** Exact existing system connection only; no binding, service start, or inferred DNS target app. */
    fun captureWebsiteRecoveryRequest(id: String, configurationEpoch: Long, vpnCurrent: () -> Boolean): (() -> Unit)? {
      val service = connectedService?.takeIf { it.ownsConnectedRuntime() && FreedWebsiteRecoveryHandoff.previewEnabled(it) }
        ?: return null
      val connectionEpoch = service.scheduleConnectionEpoch
      return { service.handler.post {
        service.requestWebsiteRecovery(id, configurationEpoch, connectionEpoch, vpnCurrent)
      }; Unit }
    }
    fun requestAppGroupRecheck() {
      connectedService?.let { service -> service.handler.post { if (service.ownsConnectedRuntime()) service.recheckAppGroups() } }
    }
    fun observedAppGroupUsage(context: Context, packages: Set<String>): Map<String, Long> {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
      val service = connectedService?.takeIf { it.ownsConnectedRuntime() }
      return packages.associateWith { target ->
        val stored = if (prefs.getString(APP_USAGE_DATE_KEY, null) == today) prefs.getLong(APP_USAGE_PREFIX + target, 0L) else 0L
        val live = service?.takeIf { it.liveScheduleForegroundPackage() == target }?.currentForegroundSessionMs(target) ?: 0L
        (stored + live).coerceIn(0L, 86_400_000L)
      }
    }
    val appSchedulesServiceConnected: Boolean
      get() = connectedService?.ownsConnectedRuntime() == true

    fun clearOwnedRuntimeForCleanup(valid: () -> Boolean): Boolean = FreedProtectionConfiguration.runOnMainForReset {
      synchronized(FreedNativeUnlockStore.lock) {
        if (!valid()) return@synchronized false
        connectedService?.clearOwnedProtectionRuntime() ?: true
      }
    }

    fun clearOwnedRuntimeForReset(): Boolean = FreedProtectionConfiguration.runOnMainForReset {
      FreedFocusShieldCalibrationBridge.resetConfigurationResult()
      connectedService?.clearOwnedProtectionRuntime() ?: true
    }
  }

  private var eligibleWebHandlers: FreedBrowserHandlers? = null

  private val browserUrlViewIds = mapOf(
    "com.android.chrome" to chromiumUrlFields("com.android.chrome"),
    "com.chrome.beta" to chromiumUrlFields("com.chrome.beta"),
    "com.chrome.dev" to chromiumUrlFields("com.chrome.dev"),
    "com.chrome.canary" to chromiumUrlFields("com.chrome.canary"),
    "com.brave.browser" to chromiumUrlFields("com.brave.browser"),
    "com.microsoft.emmx" to chromiumUrlFields("com.microsoft.emmx"),
    "com.microsoft.emmx.beta" to chromiumUrlFields("com.microsoft.emmx.beta"),
    "com.microsoft.emmx.dev" to chromiumUrlFields("com.microsoft.emmx.dev"),
    "com.microsoft.emmx.canary" to chromiumUrlFields("com.microsoft.emmx.canary"),
    "com.opera.browser" to listOf("com.opera.browser:id/url_field", "com.opera.browser:id/search_src_text"),
    "org.mozilla.firefox" to firefoxUrlFields("org.mozilla.firefox"),
    "org.mozilla.firefox_beta" to firefoxUrlFields("org.mozilla.firefox_beta"),
    "org.mozilla.fenix" to firefoxUrlFields("org.mozilla.fenix"),
    "org.mozilla.focus" to firefoxUrlFields("org.mozilla.focus"),
    "com.sec.android.app.sbrowser" to samsungUrlFields("com.sec.android.app.sbrowser"),
    "com.sec.android.app.sbrowser.beta" to samsungUrlFields("com.sec.android.app.sbrowser.beta"),
    "com.duckduckgo.mobile.android" to listOf(
      "com.duckduckgo.mobile.android:id/omnibarTextInput",
      "com.duckduckgo.mobile.android:id/browserTextInput",
      "com.duckduckgo.mobile.android:id/toolbarText"
    ),
    "com.vivaldi.browser" to chromiumUrlFields("com.vivaldi.browser"),
    "com.kiwibrowser.browser" to chromiumUrlFields("com.kiwibrowser.browser")
  )

  private fun chromiumUrlFields(packageName: String): List<String> {
    return listOf("$packageName:id/url_bar", "$packageName:id/search_box_text")
  }

  private fun firefoxUrlFields(packageName: String): List<String> {
    return listOf(
      "$packageName:id/mozac_browser_toolbar_url_view",
      "$packageName:id/mozac_browser_toolbar_edit_url_view",
      "$packageName:id/awesome_bar_edit_text"
    )
  }

  private fun samsungUrlFields(packageName: String): List<String> {
    return listOf(
      "$packageName:id/location_bar_edit_text",
      "$packageName:id/location_bar_url_view",
      "$packageName:id/location_bar_text"
    )
  }

  private var lastLaunchElapsedMs = 0L
  private var lastBlockedKey = ""
  private val handler = Handler(Looper.getMainLooper())
  @Volatile
  private var serviceConnected = false
  @Volatile
  private var scheduleConnectionEpoch = 0L
  private var appScheduleCheckRunnable: Runnable? = null
  private var lastScheduleForegroundPackage: String? = null
  private var scheduleReceiverRegistered = false
  private var schedulePreferencesRegistered = false
  private val schedulePreferencesListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
    if (key == FreedAppGroupStore.CONFIGURATION_KEY) {
      requestAppGroupRecheck()
    }
    if (key == FreedAppScheduleStore.CONFIGURATION_KEY || key == BLOCKED_APP_PACKAGES || key == DAILY_LIMIT_MINUTES || key == FreedAppGuardModeStore.MODE_KEY) {
      postAppScheduleRecheck()
    }
  }
  private val scheduleClockReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (!ownsConnectedRuntime()) return
      if (intent?.action == Intent.ACTION_SCREEN_OFF) {
        finishForegroundUsageSegment()
        lastScheduleForegroundPackage = null
        cancelAppScheduleCheck()
        cancelAppGroupCheck()
        cancelAnyAppLimitCheck()
        clearShortFormSession()
        cancelEarnedUnlockRelock()
      } else {
        if (intent?.action == Intent.ACTION_TIMEZONE_CHANGED) TimeZone.setDefault(null)
        recheckAppSchedules()
        recheckAppGroups()
      }
    }
  }
  private var scheduledLimitPackage: String? = null
  private var shortFormPackage: String? = null
  private var shortFormRule: String? = null
  private var shortFormStartedElapsedMs = 0L
  private var shortFormScrollPackage: String? = null
  private var shortFormScrollRule: String? = null
  private var shortFormScrollWindowStartedElapsedMs = 0L
  private var shortFormScrollCount = 0
  private var scheduledEarnedUnlockRelockPackage: String? = null
  @Volatile
  private var focusShieldCalibrationSession: FreedFocusShieldCalibrationSession? = null
  @Volatile
  private var focusShieldCalibrationOwnerEpoch = 0L
  private var focusShieldCalibrationSessionOwnerEpoch = 0L
  private val focusShieldCalibrationTransitionLock = Any()
  private var focusShieldCalibrationRequestedGeneration = 0L
  private val appLimitRunnable = Runnable {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this)) {
      cancelAnyAppLimitCheck()
      return@Runnable
    }
    val packageName = scheduledLimitPackage ?: return@Runnable
    if (FreedAppGuardModeStore.read(this) != FreedAppGuardModePolicy.DAILY_LIMIT) {
      cancelAnyAppLimitCheck()
      postAppScheduleRecheck()
      return@Runnable
    }
    if (liveScheduleForegroundPackage() == packageName && appGuardShouldInterrupt(packageName)) {
      launchAppIntervention(packageName)
    } else {
      scheduleAppLimitCheck(packageName)
    }
  }
  private val shortFormRunnable = Runnable {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this)) return@Runnable
    val packageName = shortFormPackage ?: return@Runnable
    val rule = shortFormRule ?: return@Runnable
    val elapsedMs = SystemClock.elapsedRealtime() - shortFormStartedElapsedMs
    if (
      FreedFocusShieldRollout.enabled(this) &&
      FreedFocusShieldRules.hasEnabledPresetRulesForPackage(this, packageName) &&
      isConfiguredBlockedApp(packageName) &&
      !isEarnedUnlockActiveForPackage(packageName) &&
      currentForegroundPackage() == packageName &&
      elapsedMs >= shortFormThresholdMs() &&
      isCurrentShortFormSurface(packageName, rule)
    ) {
      launchShortFormIntervention(packageName, rule)
    } else {
      clearShortFormSession()
    }
  }
  private val earnedUnlockRelockRunnable = Runnable {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this)) return@Runnable
    val packageName = scheduledEarnedUnlockRelockPackage ?: return@Runnable
    scheduledEarnedUnlockRelockPackage = null

    if (FreedAppSchedulePolicy.shouldRelock(
      packageName,
      currentBlockingPackagesFor(packageName),
      liveScheduleForegroundPackage(),
      isEarnedUnlockActiveForPackage(packageName)
    )) {
      launchAppIntervention(
        packageName,
        reason = "Earned unlock expired. FREED is relocking the selected app."
      )
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    connectedService?.takeIf { it !== this }?.disconnectAppScheduleRuntime()
    if (serviceConnected) disconnectAppScheduleRuntime()
    serviceConnected = true
    scheduleConnectionEpoch += 1
    connectedService = this
    eligibleWebHandlers = FreedBrowserHandlers(this).also { it.connect() }
    // A prior process/boot's elapsed marker is not live foreground evidence.
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
      .remove(LAST_FOREGROUND_PACKAGE).remove(LAST_FOREGROUND_ELAPSED_MS).apply()
    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).registerOnSharedPreferenceChangeListener(schedulePreferencesListener)
    schedulePreferencesRegistered = true
    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_TIME_CHANGED)
      addAction(Intent.ACTION_DATE_CHANGED)
      addAction(Intent.ACTION_TIMEZONE_CHANGED)
      addAction(Intent.ACTION_SCREEN_ON)
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_USER_PRESENT)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(scheduleClockReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      registerReceiver(scheduleClockReceiver, filter)
    }
    scheduleReceiverRegistered = true
    recheckAppSchedules()
    recheckAppGroups()
    FreedFocusShieldCalibrationBridge.attach(this)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this)) return
    val previousUsageScope = privateUsageCallbackScope.get()
    privateUsageCallbackScope.set(PrivateUsageScope(FreedAppGroupStore.capturePolicyScope(this)))
    try {
    val accessibilityEvent = event ?: return
    val normalizedPackage = accessibilityEvent.packageName
      ?.toString()
      ?.trim()
      ?.lowercase(Locale.US)
      ?.takeIf(String::isNotBlank)
    val surfaceInspectionEnabled = FreedFocusShieldRollout.enabled(this)
    if (surfaceInspectionEnabled) focusShieldCalibrationSession?.onAccessibilityEvent(accessibilityEvent, normalizedPackage)
    if (normalizedPackage == null) return
    trackForegroundUsage(normalizedPackage)
    val freshForegroundEvent = accessibilityEvent.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
    val liveSchedulePackage = liveScheduleForegroundPackage()
    if (liveSchedulePackage == normalizedPackage || (liveSchedulePackage == null && freshForegroundEvent)) {
      lastScheduleForegroundPackage = normalizedPackage
    }
    armAppScheduleCheck()
    if (isScreenInteractiveAndUnlocked() && (liveSchedulePackage == normalizedPackage || (liveSchedulePackage == null && freshForegroundEvent))) {
      recheckAppGroups(normalizedPackage)
    }
    val configuredApp = isConfiguredBlockedApp(normalizedPackage)
    val configuration = FreedAppScheduleStore.read(this)
    val scheduledApp = FreedAppSchedulePolicy.evaluate(configuration, System.currentTimeMillis()).activePackages.contains(normalizedPackage)
    val currentAppEvent = isScreenInteractiveAndUnlocked() &&
      (liveSchedulePackage == normalizedPackage || (liveSchedulePackage == null && freshForegroundEvent))
    val hasFocusShieldPresetRules = surfaceInspectionEnabled && FreedFocusShieldRules.hasEnabledPresetRulesForPackage(this, normalizedPackage)
    val detectedShortFormRule = if (hasFocusShieldPresetRules) {
      shortFormRuleForEvent(normalizedPackage, accessibilityEvent)
    } else {
      null
    }

    if (configuredApp) {
      if (currentAppEvent && appGuardShouldInterrupt(normalizedPackage)) {
        launchAppIntervention(normalizedPackage, reason = when {
          configuration.strictGuard || FreedAppGuardModeStore.read(this) == FreedAppGuardModePolicy.BEFORE_USE ->
            FreedNativeCopy.text(this, R.string.freed_start_recovery)
          scheduledApp -> "Configured app schedule is active."
          else -> "Configured app limit reached."
        })
        return
      } else if (isEarnedUnlockActiveForPackage(normalizedPackage)) {
        cancelAppLimitCheck(normalizedPackage)
        clearShortFormSession()
        scheduleEarnedUnlockRelock(normalizedPackage)
      } else {
        val matchingFocusShieldRules = detectedShortFormRule
          ?.let { rule -> FreedFocusShieldRules.matchingPresetRules(this, normalizedPackage, rule) }
          .orEmpty()
        val matchingFocusShieldRule = matchingFocusShieldRules
          .firstOrNull { rule -> !FreedFocusShieldRules.isSurfaceUnlockActiveForRule(this, rule) }
        if (matchingFocusShieldRule != null && detectedShortFormRule != null) {
          launchFocusShieldIntervention(normalizedPackage, detectedShortFormRule, matchingFocusShieldRule)
          return
        }

        if (detectedShortFormRule != null) {
          if (matchingFocusShieldRules.isEmpty()) {
            beginOrContinueShortFormSession(normalizedPackage, detectedShortFormRule)
          } else {
            clearShortFormSession()
          }
          scheduleAppLimitCheck(normalizedPackage)
          if (matchingFocusShieldRules.isEmpty()) return
        } else {
          if (shortFormPackage == normalizedPackage) {
            val activeShortFormRule = shortFormRule
            if (activeShortFormRule == null || !isCurrentShortFormSurface(normalizedPackage, activeShortFormRule)) {
              cancelShortFormSession(normalizedPackage)
            }
          } else if (shortFormPackage != null) {
            clearShortFormSession()
          }
          scheduleAppLimitCheck(normalizedPackage)
        }
      }
    } else {
      cancelAnyAppLimitCheck()
      clearShortFormSession()
      cancelEarnedUnlockRelock()

      val matchingFocusShieldRules = detectedShortFormRule
        ?.let { rule -> FreedFocusShieldRules.matchingPresetRules(this, normalizedPackage, rule) }
        .orEmpty()
      val matchingFocusShieldRule = matchingFocusShieldRules
        .firstOrNull { rule -> !FreedFocusShieldRules.isSurfaceUnlockActiveForRule(this, rule) }
      if (matchingFocusShieldRule != null && detectedShortFormRule != null) {
        launchFocusShieldIntervention(normalizedPackage, detectedShortFormRule, matchingFocusShieldRule)
        return
      }
    }

    if (eligibleWebHandlers?.contains(normalizedPackage) != true && !isWebViewContext(accessibilityEvent)) return

    val adultGeneration = FreedAdultProtectionState.callbackEpoch(this)
    if (!FreedAdultProtectionState.permitsClassification(this, adultGeneration)) return
    val candidates = extractUrlCandidates(normalizedPackage, accessibilityEvent)
    val adultDomainFeed = FreedAdultDomainFeed.domains(this)

    for (candidate in candidates) {
      if (!FreedAdultProtectionState.permitsClassification(this, adultGeneration)) return
      val result = FreedUrlClassifier.classifyFocusedInput(
        candidate,
        adultDomainFeed,
        FreedAdultDomainFeed.userAllowedDomains(this)
      )
      if (result.shouldBlock) {
        launchIntervention(candidate, normalizedPackage, result, adultGeneration)
        return
      }
    }
    } finally {
      if (previousUsageScope == null) privateUsageCallbackScope.remove()
      else privateUsageCallbackScope.set(previousUsageScope)
    }
  }

  override fun onInterrupt() {
    stopFocusShieldCalibration(
      state = "service-interrupted",
      message = "Accessibility service was interrupted, so calibration stopped and no selector was stored."
    )
    handler.removeCallbacks(appLimitRunnable)
    handler.removeCallbacks(shortFormRunnable)
    handler.removeCallbacks(earnedUnlockRelockRunnable)
    cancelAppScheduleCheck()
    postAppScheduleRecheck()
  }

  override fun onUnbind(intent: Intent?): Boolean {
    disconnectAppScheduleRuntime()
    FreedFocusShieldCalibrationBridge.detach(
      service = this,
      state = "revoked-permission",
      message = "Accessibility permission was revoked, so calibration stopped and no selector was stored."
    )
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    disconnectAppScheduleRuntime()
    stopFocusShieldCalibration(
      state = "service-interrupted",
      message = "Accessibility service stopped, so calibration ended and no selector was stored."
    )
    FreedFocusShieldCalibrationBridge.detach(
      service = this,
      state = "service-interrupted",
      message = "Accessibility service stopped, so calibration ended and no selector was stored."
    )
    handler.removeCallbacks(appLimitRunnable)
    handler.removeCallbacks(shortFormRunnable)
    handler.removeCallbacks(earnedUnlockRelockRunnable)
    super.onDestroy()
  }

  internal fun updateFocusShieldCalibrationOwner(ownerEpoch: Long) {
    focusShieldCalibrationOwnerEpoch = ownerEpoch
  }

  internal fun invalidateFocusShieldCalibrationOwner(ownerEpoch: Long) {
    if (focusShieldCalibrationOwnerEpoch == ownerEpoch) {
      focusShieldCalibrationOwnerEpoch = 0L
      enqueueFocusShieldCalibrationTransition {
        disposeFocusShieldCalibrationSessionForOwner(ownerEpoch)
      }
      return
    }
    handler.post {
      synchronized(focusShieldCalibrationTransitionLock) {
        disposeFocusShieldCalibrationSessionForOwner(ownerEpoch)
      }
    }
  }

  internal fun beginFocusShieldCalibration(
    request: FreedFocusShieldCalibrationRequest,
    ownerEpoch: Long
  ) {
    if (!FreedFocusShieldRollout.enabled(this)) return
    val initial = FreedFocusShieldCalibrationResult(
      state = "calibrating",
      message = "Open the selected app, then tap the temporary FREED edge handle."
    )
    enqueueFocusShieldCalibrationTransition(ownerEpoch) { generation ->
      if (!FreedFocusShieldCalibrationBridge.isCurrentOwner(this, ownerEpoch)) {
        if (
          focusShieldCalibrationOwnerEpoch == 0L ||
          focusShieldCalibrationSessionOwnerEpoch == ownerEpoch
        ) {
          focusShieldCalibrationSession?.disposeWithoutResult()
          focusShieldCalibrationSession = null
          focusShieldCalibrationSessionOwnerEpoch = 0L
        }
      } else {
        focusShieldCalibrationSession?.disposeWithoutResult()
        val session = FreedFocusShieldCalibrationSession(this, request) { finishedSession, result ->
          onFocusShieldCalibrationResult(finishedSession, generation, ownerEpoch, result)
        }
        focusShieldCalibrationSession = session
        focusShieldCalibrationSessionOwnerEpoch = ownerEpoch
        FreedFocusShieldCalibrationBridge.publish(this, ownerEpoch, initial)
        session.start()
      }
    }
  }

  internal fun stopFocusShieldCalibration(
    state: String,
    message: String,
    ownerEpoch: Long = focusShieldCalibrationOwnerEpoch
  ) {
    val terminalResult = FreedFocusShieldCalibrationResult(state, message)
    enqueueFocusShieldCalibrationTransition(ownerEpoch) {
      if (
        focusShieldCalibrationOwnerEpoch == 0L ||
        focusShieldCalibrationSessionOwnerEpoch == ownerEpoch
      ) {
        val activeSession = focusShieldCalibrationSession
        activeSession?.disposeWithoutResult()
        focusShieldCalibrationSession = null
        focusShieldCalibrationSessionOwnerEpoch = 0L
      }
      FreedFocusShieldCalibrationBridge.publish(this, ownerEpoch, terminalResult)
    }
  }

  private fun onFocusShieldCalibrationResult(
    session: FreedFocusShieldCalibrationSession,
    generation: Long,
    ownerEpoch: Long,
    result: FreedFocusShieldCalibrationResult
  ) {
    handler.post result@{
      synchronized(focusShieldCalibrationTransitionLock) {
        if (generation != focusShieldCalibrationRequestedGeneration) return@result
        if (focusShieldCalibrationSession !== session) return@result
        FreedFocusShieldCalibrationBridge.publish(this, ownerEpoch, result)
        if (result.state != "calibrating" && result.state != "ready") {
          focusShieldCalibrationSession = null
          focusShieldCalibrationSessionOwnerEpoch = 0L
        }
      }
    }
  }

  private fun enqueueFocusShieldCalibrationTransition(
    operation: (Long) -> Unit
  ) {
    synchronized(focusShieldCalibrationTransitionLock) {
      focusShieldCalibrationRequestedGeneration += 1
      val generation = focusShieldCalibrationRequestedGeneration
      handler.post transition@{
        synchronized(focusShieldCalibrationTransitionLock) {
          if (generation != focusShieldCalibrationRequestedGeneration) return@transition
          operation(generation)
        }
      }
    }
  }

  private fun enqueueFocusShieldCalibrationTransition(
    ownerEpoch: Long,
    operation: (Long) -> Unit
  ) {
    synchronized(focusShieldCalibrationTransitionLock) {
      val currentOwnerEpoch = focusShieldCalibrationOwnerEpoch
      if (
        ownerEpoch != currentOwnerEpoch &&
        FreedFocusShieldCalibrationBridge.isCurrentOwner(this, currentOwnerEpoch)
      ) {
        handler.post {
          synchronized(focusShieldCalibrationTransitionLock) {
            disposeFocusShieldCalibrationSessionForOwner(ownerEpoch)
          }
        }
        return
      }
      focusShieldCalibrationRequestedGeneration += 1
      val generation = focusShieldCalibrationRequestedGeneration
      handler.post transition@{
        synchronized(focusShieldCalibrationTransitionLock) {
          if (generation != focusShieldCalibrationRequestedGeneration) return@transition
          operation(generation)
        }
      }
    }
  }

  private fun disposeFocusShieldCalibrationSessionForOwner(ownerEpoch: Long) {
    if (focusShieldCalibrationSessionOwnerEpoch != ownerEpoch) return
    focusShieldCalibrationSession?.disposeWithoutResult()
    focusShieldCalibrationSession = null
    focusShieldCalibrationSessionOwnerEpoch = 0L
  }

  private var appGroupCheckRunnable: Runnable? = null

  private fun recheckAppGroups(eventForeground: String? = null) {
    appGroupCheckRunnable?.let(handler::removeCallbacks)
    appGroupCheckRunnable = null
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this) || !isScreenInteractiveAndUnlocked()) return
    val foreground = liveScheduleForegroundPackage() ?: eventForeground ?: return
    val targets = FreedAppGroupStore.potentialPackages(this)
    if (foreground !in targets) return
    trackForegroundUsage(foreground)
    FreedAppGroupStore.blockingGroup(this, foreground)?.let { group ->
      launchAppIntervention(foreground, reason = "A selected app group rule is active.",
        matchedRule = "app-group:${group["id"]}:${group["revision"]}", appGroup = group)
    }
    val epoch = scheduleConnectionEpoch
    lateinit var callback: Runnable
    callback = Runnable {
      if (ownsConnectedRuntime() && scheduleConnectionEpoch == epoch && appGroupCheckRunnable === callback) recheckAppGroups()
    }
    appGroupCheckRunnable = callback
    handler.postDelayed(callback, 1_000L)
  }

  private fun isConfiguredBlockedApp(packageName: String): Boolean {
    if (!FreedProtectionConfiguration.interceptionEnabled(this)) return false
    if (packageName == applicationContext.packageName) return false
    val normalized = packageName.lowercase(Locale.US)
    if (normalized !in FreedInstalledApplications.eligible(this)) return false
    return blockedAppPackages().contains(normalized) || FreedAppScheduleStore.snapshot(this).activePackages.contains(normalized) ||
      (FreedAppScheduleStore.read(this).strictGuard && normalized in SUPPORTED_BLOCKED_APP_PACKAGES) ||
      normalized in FreedAppGroupStore.potentialPackages(this)
  }

  private fun appGuardShouldInterrupt(packageName: String, ignoreGrant: Boolean = false): Boolean {
    if (packageName.lowercase(Locale.US) !in FreedInstalledApplications.eligible(this)) return false
    val configuration = FreedAppScheduleStore.read(this)
    val mode = FreedAppGuardModeStore.read(this)
    return FreedAppGuardModePolicy.shouldInterrupt(packageName, blockedAppPackages(),
      FreedAppSchedulePolicy.evaluate(configuration, System.currentTimeMillis()), mode, configuration.strictGuard,
      mode == FreedAppGuardModePolicy.DAILY_LIMIT && isManuallyBlockedApp(packageName) && isDailyAppLimitReached(packageName),
      !ignoreGrant && isEarnedUnlockActiveForPackage(packageName), FreedProtectionConfiguration.interceptionEnabled(this))
  }

  private fun currentBlockingPackagesFor(packageName: String): Set<String> =
    if (appGuardShouldInterrupt(packageName, ignoreGrant = true)) setOf(packageName) else emptySet()

  private fun isManuallyBlockedApp(packageName: String): Boolean {
    if (!FreedProtectionConfiguration.interceptionEnabled(this)) return false
    return packageName != applicationContext.packageName && blockedAppPackages().contains(packageName.lowercase(Locale.US))
  }

  private fun blockedAppPackages(): Set<String> {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .getString(BLOCKED_APP_PACKAGES, "")
      .orEmpty()
      .split(",")
      .map { it.trim().lowercase(Locale.US) }
      .filter { it.isNotBlank() }
      .filter { FreedInstalledAppPolicy.validPackage(it) && it != applicationContext.packageName }
      .toSet().intersect(FreedInstalledApplications.eligible(this))
  }

  private fun ownsConnectedRuntime(): Boolean = serviceConnected && connectedService === this

  private fun isScreenInteractiveAndUnlocked(): Boolean {
    val power = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
    val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager ?: return false
    return power.isInteractive && !keyguard.isKeyguardLocked
  }

  /** Only current window package evidence can authorize a timer-triggered intervention. */
  private fun liveScheduleForegroundPackage(): String? {
    if (!ownsConnectedRuntime() || !isScreenInteractiveAndUnlocked()) return null
    val root = runCatching { rootInActiveWindow }.getOrNull() ?: return null
    return try {
      root.packageName?.toString()?.trim()?.lowercase(Locale.US)?.takeIf { it.isNotBlank() }
    } finally {
      @Suppress("DEPRECATION")
      root.recycle()
    }
  }

  private fun postAppScheduleRecheck() {
    val ownerEpoch = scheduleConnectionEpoch
    handler.post {
      if (ownsConnectedRuntime() && ownerEpoch == scheduleConnectionEpoch) recheckAppSchedules()
    }
  }

  private fun recheckAppSchedules() {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this)) {
      cancelAppScheduleCheck()
      return
    }
    if (!isScreenInteractiveAndUnlocked()) {
      lastScheduleForegroundPackage = null
      cancelAppScheduleCheck()
      return
    }
    val configuration = FreedAppScheduleStore.read(this)
    val manual = blockedAppPackages()
    val potentialTargets = manual + configuration.potentialPackages
    // Never fall back to LAST_FOREGROUND_PACKAGE after reconnect/reboot: it may be stale.
    val foreground = liveScheduleForegroundPackage()
    if (foreground != null) {
      lastScheduleForegroundPackage = foreground
      trackForegroundUsage(foreground)
      if (foreground in potentialTargets) {
        val snapshot = FreedAppSchedulePolicy.evaluate(configuration, System.currentTimeMillis())
        val earnedUnlock = isEarnedUnlockActiveForPackage(foreground)
        if (appGuardShouldInterrupt(foreground)) {
          launchAppIntervention(foreground, reason = if (configuration.strictGuard || FreedAppGuardModeStore.read(this) == FreedAppGuardModePolicy.BEFORE_USE) {
            FreedNativeCopy.text(this, R.string.freed_start_recovery)
          } else if (foreground in snapshot.activePackages) {
            "Configured app schedule is active."
          } else "Configured app limit reached.")
        } else if (earnedUnlock && isConfiguredBlockedApp(foreground)) {
          cancelAppLimitCheck(foreground)
          clearShortFormSession()
          scheduleEarnedUnlockRelock(foreground)
        } else {
          cancelEarnedUnlockRelock()
          if (foreground in manual) {
            scheduleAppLimitCheck(foreground)
          } else {
            cancelAppLimitCheck(foreground)
            clearShortFormSession()
          }
        }
      } else {
        cancelAnyAppLimitCheck()
        cancelEarnedUnlockRelock()
        clearShortFormSession()
      }
    }
    armAppScheduleCheck()
  }

  private fun armAppScheduleCheck() {
    cancelAppScheduleCheck()
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this) || !isScreenInteractiveAndUnlocked()) return
    val foreground = lastScheduleForegroundPackage ?: return
    if (foreground !in (blockedAppPackages() + FreedAppScheduleStore.read(this).potentialPackages)) return
    val ownerEpoch = scheduleConnectionEpoch
    lateinit var callback: Runnable
    callback = Runnable {
      if (!ownsConnectedRuntime() || ownerEpoch != scheduleConnectionEpoch || appScheduleCheckRunnable !== callback) return@Runnable
      appScheduleCheckRunnable = null
      recheckAppSchedules()
    }
    appScheduleCheckRunnable = callback
    // Handler uses uptime, so sleep may defer a check. Screen-on/user-present always re-evaluates wall time.
    val delay = (60_000L - Math.floorMod(System.currentTimeMillis(), 60_000L) + 50L).coerceIn(250L, 60_050L)
    handler.postDelayed(callback, delay)
  }

  private fun cancelAppScheduleCheck() {
    appScheduleCheckRunnable?.let { handler.removeCallbacks(it) }
    appScheduleCheckRunnable = null
  }

  private fun cancelAppGroupCheck() {
    appGroupCheckRunnable?.let(handler::removeCallbacks)
    appGroupCheckRunnable = null
  }

  private fun disconnectAppScheduleRuntime() {
    eligibleWebHandlers?.disconnect()
    eligibleWebHandlers = null
    cancelAppGroupCheck()
    if (ownsConnectedRuntime()) finishForegroundUsageSegment()
    serviceConnected = false
    scheduleConnectionEpoch += 1
    if (connectedService === this) connectedService = null
    lastScheduleForegroundPackage = null
    cancelAppScheduleCheck()
    cancelAnyAppLimitCheck()
    clearShortFormSession()
    cancelEarnedUnlockRelock()
    if (scheduleReceiverRegistered) {
      unregisterReceiver(scheduleClockReceiver)
      scheduleReceiverRegistered = false
    }
    if (schedulePreferencesRegistered) {
      getSharedPreferences(PREFS_NAME, MODE_PRIVATE).unregisterOnSharedPreferenceChangeListener(schedulePreferencesListener)
      schedulePreferencesRegistered = false
    }
  }

  private fun clearOwnedProtectionRuntime(): Boolean {
    cancelAppGroupCheck()
    scheduleConnectionEpoch += 1
    lastScheduleForegroundPackage = null
    foregroundUsageOwnerScope = null
    cancelAppScheduleCheck()
    cancelAnyAppLimitCheck()
    clearShortFormSession()
    cancelEarnedUnlockRelock()
    synchronized(focusShieldCalibrationTransitionLock) {
      focusShieldCalibrationRequestedGeneration += 1
      focusShieldCalibrationSession?.disposeWithoutResult()
      focusShieldCalibrationSession = null
      focusShieldCalibrationSessionOwnerEpoch = 0L
    }
    lastLaunchElapsedMs = 0L
    lastBlockedKey = ""
    return appGroupCheckRunnable == null && appScheduleCheckRunnable == null && scheduledLimitPackage == null &&
      shortFormPackage == null && scheduledEarnedUnlockRelockPackage == null && focusShieldCalibrationSession == null
  }

  private class PrivateUsageScope(val owner: String?)
  private val privateUsageCallbackScope = ThreadLocal<PrivateUsageScope>()
  // This live session is never rebound to a different account by reading persisted foreground markers.
  private var foregroundUsageOwnerScope: String? = null

  private fun capturePrivateUsageScope(): String? {
    val callback = privateUsageCallbackScope.get()
    return if (callback == null) FreedAppGroupStore.capturePolicyScope(this) else callback.owner
  }

  private fun trackForegroundUsage(packageName: String, ownerScope: String? = capturePrivateUsageScope()): Unit = synchronized(FreedNativeUnlockStore.lock) {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this) ||
      !FreedAppGroupStore.ownerScopeCurrent(ownerScope)) return@synchronized
    val normalizedPackage = packageName.lowercase(Locale.US)
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    if (!ensureDailyUsageWindow(prefs, ownerScope)) return@synchronized

    val now = SystemClock.elapsedRealtime()
    val sameOwner = foregroundUsageOwnerScope == ownerScope
    val lastPackage = if (sameOwner) prefs.getString(LAST_FOREGROUND_PACKAGE, null)?.lowercase(Locale.US) else null
    val lastStartedAt = if (sameOwner) prefs.getLong(LAST_FOREGROUND_ELAPSED_MS, 0L) else 0L
    val hasValidStart = lastStartedAt in 1..now

    if (lastPackage == normalizedPackage && hasValidStart) return@synchronized

    val editor = prefs.edit()
    if (!lastPackage.isNullOrBlank() && lastPackage != normalizedPackage && hasValidStart && isConfiguredBlockedApp(lastPackage)) {
      val elapsedMs = (now - lastStartedAt).coerceIn(0L, MAX_FOREGROUND_SEGMENT_MS)
      if (elapsedMs > 0L) {
        editor.putLong(usageKey(lastPackage), prefs.getLong(usageKey(lastPackage), 0L) + elapsedMs)
      }
    }

    if (!ownsConnectedRuntime() || !FreedAppGroupStore.ownerScopeCurrent(ownerScope)) return@synchronized
    editor
      .putString(LAST_FOREGROUND_PACKAGE, normalizedPackage)
      .putLong(LAST_FOREGROUND_ELAPSED_MS, now)
      .apply()
    foregroundUsageOwnerScope = ownerScope
  }

  private fun finishForegroundUsageSegment(ownerScope: String? = foregroundUsageOwnerScope): Unit = synchronized(FreedNativeUnlockStore.lock) {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this) ||
      ownerScope != foregroundUsageOwnerScope || !FreedAppGroupStore.ownerScopeCurrent(ownerScope)) return@synchronized
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    if (!ensureDailyUsageWindow(prefs, ownerScope)) return@synchronized
    val packageName = prefs.getString(LAST_FOREGROUND_PACKAGE, null)?.lowercase(Locale.US)
    val startedAt = prefs.getLong(LAST_FOREGROUND_ELAPSED_MS, 0L)
    val elapsedNow = SystemClock.elapsedRealtime()
    val editor = prefs.edit().remove(LAST_FOREGROUND_PACKAGE).remove(LAST_FOREGROUND_ELAPSED_MS)
    if (packageName != null && isConfiguredBlockedApp(packageName) && startedAt in 1..elapsedNow) {
      val segment = (elapsedNow - startedAt).coerceIn(0L, MAX_FOREGROUND_SEGMENT_MS)
      editor.putLong(usageKey(packageName), prefs.getLong(usageKey(packageName), 0L) + segment)
    }
    if (!ownsConnectedRuntime() || !FreedAppGroupStore.ownerScopeCurrent(ownerScope)) return@synchronized
    editor.apply()
    foregroundUsageOwnerScope = null
  }

  private fun isDailyAppLimitReached(packageName: String): Boolean {
    return currentDailyUsageMs(packageName) >= dailyLimitMinutes() * 60_000L
  }

  private fun scheduleAppLimitCheck(packageName: String) {
    val normalizedPackage = packageName.lowercase(Locale.US)
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this) ||
      !isManuallyBlockedApp(normalizedPackage) ||
      FreedAppGuardModeStore.read(this) != FreedAppGuardModePolicy.DAILY_LIMIT ||
      liveScheduleForegroundPackage() != normalizedPackage || isEarnedUnlockActiveForPackage(normalizedPackage)) {
      cancelAppLimitCheck(normalizedPackage)
      return
    }

    val remainingMs = dailyLimitMinutes() * 60_000L - currentDailyUsageMs(normalizedPackage)
    if (remainingMs <= 0L) {
      cancelAppLimitCheck(normalizedPackage)
      // The fallback may run after a foreground, mode, grant or reset change.
      if (liveScheduleForegroundPackage() == normalizedPackage && appGuardShouldInterrupt(normalizedPackage)) {
        launchAppIntervention(normalizedPackage)
      }
      return
    }

    scheduledLimitPackage = normalizedPackage
    handler.removeCallbacks(appLimitRunnable)
    handler.postDelayed(appLimitRunnable, remainingMs.coerceIn(1_000L, 15 * 60_000L))
  }

  private fun cancelAppLimitCheck(packageName: String) {
    if (scheduledLimitPackage == packageName.lowercase(Locale.US)) {
      scheduledLimitPackage = null
      handler.removeCallbacks(appLimitRunnable)
    }
  }

  private fun cancelAnyAppLimitCheck() {
    scheduledLimitPackage = null
    handler.removeCallbacks(appLimitRunnable)
  }

  private fun scheduleEarnedUnlockRelock(packageName: String) {
    if (!ownsConnectedRuntime()) return
    val normalizedPackage = packageName.lowercase(Locale.US)
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val sourcePackage = earnedUnlockSourcePackage(prefs)
    if (sourcePackage == null) {
      clearEarnedUnlockPrefs(prefs)
      cancelEarnedUnlockRelock()
      return
    }

    if (sourcePackage != normalizedPackage) {
      cancelEarnedUnlockRelock()
      return
    }

    val expiresAt = prefs.getString(EARNED_UNLOCK_EXPIRES_AT, null)
    if (expiresAt == null) {
      clearEarnedUnlockPrefs(prefs)
      cancelEarnedUnlockRelock()
      return
    }

    val expiryMs = parseIsoMillis(expiresAt)
    if (expiryMs == null) {
      clearEarnedUnlockPrefs(prefs)
      cancelEarnedUnlockRelock()
      return
    }
    val remainingMs = expiryMs - System.currentTimeMillis()
    if (remainingMs <= 0L) {
      clearEarnedUnlockPrefs(prefs)
      if (FreedAppSchedulePolicy.shouldRelock(
        normalizedPackage,
        currentBlockingPackagesFor(normalizedPackage),
        liveScheduleForegroundPackage(),
        false
      )) {
        launchAppIntervention(
          normalizedPackage,
          reason = "Earned unlock expired. FREED is relocking the selected app."
        )
      }
      return
    }

    scheduledEarnedUnlockRelockPackage = normalizedPackage
    handler.removeCallbacks(earnedUnlockRelockRunnable)
    handler.postDelayed(earnedUnlockRelockRunnable, remainingMs.coerceIn(1_000L, MAX_EARNED_UNLOCK_MINUTES * 60_000L))
  }

  private fun cancelEarnedUnlockRelock() {
    scheduledEarnedUnlockRelockPackage = null
    handler.removeCallbacks(earnedUnlockRelockRunnable)
  }

  private fun beginOrContinueShortFormSession(packageName: String, rule: String) {
    if (!ownsConnectedRuntime()) return
    val normalizedPackage = packageName.lowercase(Locale.US)
    val now = SystemClock.elapsedRealtime()
    if (shortFormPackage != normalizedPackage || shortFormRule != rule || shortFormStartedElapsedMs <= 0L) {
      shortFormPackage = normalizedPackage
      shortFormRule = rule
      shortFormStartedElapsedMs = now
    }

    val remainingMs = shortFormThresholdMs() - (now - shortFormStartedElapsedMs)
    handler.removeCallbacks(shortFormRunnable)
    handler.postDelayed(shortFormRunnable, remainingMs.coerceIn(1_000L, shortFormThresholdMs()))
  }

  private fun cancelShortFormSession(packageName: String) {
    if (shortFormPackage == packageName.lowercase(Locale.US)) {
      clearShortFormSession()
    }
  }

  private fun clearShortFormSession() {
    shortFormPackage = null
    shortFormRule = null
    shortFormStartedElapsedMs = 0L
    shortFormScrollPackage = null
    shortFormScrollRule = null
    shortFormScrollWindowStartedElapsedMs = 0L
    shortFormScrollCount = 0
    handler.removeCallbacks(shortFormRunnable)
  }

  private fun currentDailyUsageMs(packageName: String): Long {
    val normalizedPackage = packageName.lowercase(Locale.US)
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    ensureDailyUsageWindow(prefs)

    val storedUsageMs = prefs.getLong(usageKey(normalizedPackage), 0L)
    val lastPackage = prefs.getString(LAST_FOREGROUND_PACKAGE, null)?.lowercase(Locale.US)
    val lastStartedAt = prefs.getLong(LAST_FOREGROUND_ELAPSED_MS, 0L)
    val now = SystemClock.elapsedRealtime()
    val platformUsageMs = queryUsageStatsTodayMs(normalizedPackage) ?: 0L
    if (lastPackage != normalizedPackage || lastStartedAt !in 1..now) return maxOf(storedUsageMs, platformUsageMs)

    val activeSessionMs = (now - lastStartedAt).coerceIn(0L, MAX_FOREGROUND_SEGMENT_MS)
    return maxOf(storedUsageMs + activeSessionMs, platformUsageMs)
  }

  private fun currentForegroundSessionMs(packageName: String): Long {
    val normalizedPackage = packageName.lowercase(Locale.US)
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val lastPackage = prefs.getString(LAST_FOREGROUND_PACKAGE, null)?.lowercase(Locale.US)
    val lastStartedAt = prefs.getLong(LAST_FOREGROUND_ELAPSED_MS, 0L)
    val now = SystemClock.elapsedRealtime()
    if (lastPackage != normalizedPackage || lastStartedAt !in 1..now) return 0L
    return (now - lastStartedAt).coerceIn(0L, MAX_FOREGROUND_SEGMENT_MS)
  }

  private fun queryUsageStatsTodayMs(packageName: String): Long? {
    if (!isUsageStatsAuthorized()) return null

    val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
    val calendar = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    val stats = usageStatsManager.queryUsageStats(
      UsageStatsManager.INTERVAL_DAILY,
      calendar.timeInMillis,
      System.currentTimeMillis()
    ).orEmpty()

    return stats
      .filter { item -> item.packageName?.lowercase(Locale.US) == packageName.lowercase(Locale.US) }
      .sumOf { item -> item.totalTimeInForeground }
  }

  private fun isUsageStatsAuthorized(): Boolean {
    val appOps = getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager ?: return false
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      applicationContext.packageName
    )

    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun currentForegroundPackage(): String? {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .getString(LAST_FOREGROUND_PACKAGE, null)
      ?.lowercase(Locale.US)
  }

  private fun dailyLimitMinutes(): Int {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .getInt(DAILY_LIMIT_MINUTES, DEFAULT_DAILY_LIMIT_MINUTES)
      .coerceIn(5, 240)
  }

  private fun shortFormThresholdMs(): Long {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .getInt(SHORT_FORM_THRESHOLD_SECONDS, DEFAULT_SHORT_FORM_THRESHOLD_SECONDS)
      .coerceIn(30, 300)
      .toLong() * 1_000L
  }

  private fun ensureDailyUsageWindow(prefs: SharedPreferences, ownerScope: String? = capturePrivateUsageScope()): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    if (!ownsConnectedRuntime() || !FreedProtectionConfiguration.interceptionEnabled(this) ||
      !FreedAppGroupStore.ownerScopeCurrent(ownerScope)) return@synchronized false
    val today = appUsageDateKey()
    if (prefs.getString(APP_USAGE_DATE_KEY, null) == today) return@synchronized true

    val editor = prefs.edit()
    prefs.all.keys
      .filter { key ->
        key.startsWith(APP_USAGE_PREFIX) ||
          key == LAST_FOREGROUND_PACKAGE ||
          key == LAST_FOREGROUND_ELAPSED_MS
      }
      .forEach { key -> editor.remove(key) }
    if (!ownsConnectedRuntime() || !FreedAppGroupStore.ownerScopeCurrent(ownerScope)) return@synchronized false
    editor.putString(APP_USAGE_DATE_KEY, today).apply()
    true
  }

  private fun usageKey(packageName: String): String {
    return APP_USAGE_PREFIX + packageName.lowercase(Locale.US)
  }

  private fun appUsageDateKey(): String {
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
      timeZone = TimeZone.getDefault()
    }.format(Date())
  }

  private fun isEarnedUnlockActiveForPackage(packageName: String): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val configuration = FreedAppScheduleStore.read(this)
    if (FreedAppGuardModePolicy.hardGuardActive(packageName.lowercase(Locale.US),
      FreedAppSchedulePolicy.evaluate(configuration, System.currentTimeMillis()), configuration.strictGuard)) {
      // Preserve the native receipt. Its original expiry still applies after the hard window ends.
      return@synchronized false
    }
    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val expiresAt = prefs.getString(EARNED_UNLOCK_EXPIRES_AT, null) ?: return@synchronized false
    val expiryMs = parseIsoMillis(expiresAt)

    if (expiryMs != null && expiryMs > System.currentTimeMillis()) {
      val sourcePackage = earnedUnlockSourcePackage(prefs)
      if (sourcePackage == null || !FreedNativeUnlockStore.hasActivePackageGrant(this, sourcePackage, expiryMs)) {
        clearEarnedUnlockPrefs(prefs)
        return@synchronized false
      }
      return@synchronized sourcePackage == packageName.lowercase(Locale.US)
    }

    clearEarnedUnlockPrefs(prefs)
    return@synchronized false
  }

  private fun clearEarnedUnlockPrefs(prefs: SharedPreferences) {
    val editor = prefs.edit().remove(EARNED_UNLOCK_EXPIRES_AT).remove(EARNED_UNLOCK_SOURCE_PACKAGE)
    FreedNativeUnlockStore.clearPackageReceipt(editor)
    editor.apply()
  }

  private fun earnedUnlockSourcePackage(prefs: SharedPreferences): String? {
    val sourcePackage = prefs.getString(EARNED_UNLOCK_SOURCE_PACKAGE, null)
      ?.trim()
      ?.lowercase(Locale.US)
      .orEmpty()
    return sourcePackage.takeIf { SUPPORTED_BLOCKED_APP_PACKAGES.contains(it) }
  }

  private fun parseIsoMillis(value: String): Long? {
    val formats = listOf(
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
    )

    return formats.firstNotNullOfOrNull { pattern ->
      try {
        SimpleDateFormat(pattern, Locale.US).apply {
          timeZone = TimeZone.getTimeZone("UTC")
        }.parse(value)?.time
      } catch (_: Exception) {
        null
      }
    }
  }

  private fun extractUrlCandidates(packageName: String, event: AccessibilityEvent): List<String> {
    val candidates = linkedSetOf<String>()
    val root = rootInActiveWindow

    browserUrlViewIds[packageName].orEmpty().forEach { viewId ->
      root
        ?.findAccessibilityNodeInfosByViewId(viewId)
        .orEmpty()
        .mapNotNull { node -> node.text?.toString()?.trim() }
        .filter { text -> text.isNotBlank() }
        .forEach { text -> candidates.add(text) }
    }

    collectLikelyFocusedUrlText(packageName, root, candidates, depth = 0)

    if (shouldTrustEventText(packageName, event)) {
      event.text
        ?.mapNotNull { item -> item?.toString()?.trim() }
        ?.filter { text -> text.isNotBlank() }
        ?.forEach { text -> candidates.add(text) }
    }

    return candidates.toList()
  }

  private fun isWebViewContext(event: AccessibilityEvent): Boolean {
    val className = event.className?.toString().orEmpty()
    if (className.contains("WebView", ignoreCase = true)) return true
    return containsWebViewNode(rootInActiveWindow, depth = 0)
  }

  private fun containsWebViewNode(node: AccessibilityNodeInfo?, depth: Int): Boolean {
    if (node == null || depth > 6) return false
    val className = node.className?.toString().orEmpty()
    if (className.contains("android.webkit.WebView", ignoreCase = true) || className.contains("WebView", ignoreCase = true)) {
      return true
    }

    for (index in 0 until node.childCount) {
      if (containsWebViewNode(node.getChild(index), depth + 1)) return true
    }

    return false
  }

  private fun shouldTrustEventText(packageName: String, event: AccessibilityEvent): Boolean {
    val source = event.source
    val sourceLooksEditable = source?.isEditable == true || source?.isFocused == true || source?.isAccessibilityFocused == true
    val sourceHasUrlFieldSignal =
      sourceIsKnownBrowserUrlField(packageName, source) ||
        nodeLooksLikeUrlOrSearchField(source)
    val eventText = event.text
      ?.mapNotNull { item -> item?.toString()?.trim() }
      ?.filter { text -> text.isNotBlank() }
      .orEmpty()
    return event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
      sourceLooksEditable &&
      sourceHasUrlFieldSignal &&
      eventText.any { text -> looksLikeUrlOrSearch(text) || looksLikeBoundedFocusedSearchText(text) }
  }

  private fun shortFormRuleForEvent(packageName: String, event: AccessibilityEvent): String? {
    if (!FreedFocusShieldRollout.enabled(this) || !FreedFocusShieldRules.hasEnabledPresetRulesForPackage(this, packageName)) return null
    if (event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) return null

    if (packageName == YOUTUBE_PACKAGE && isYouTubeShortsSurface(event)) {
      return YOUTUBE_SHORTS_RULE
    }
    if (
      packageName == YOUTUBE_PACKAGE &&
      isSustainedShortFormScroll(packageName, YOUTUBE_SHORTS_RULE, event, requireSelectedSurfaceSignal = true)
    ) {
      return YOUTUBE_SHORTS_RULE
    }

    if (packageName == INSTAGRAM_PACKAGE) {
      if (isInstagramReelsSurface(event)) return INSTAGRAM_REELS_RULE
      if (isSustainedShortFormScroll(packageName, INSTAGRAM_REELS_RULE, event, requireSelectedSurfaceSignal = true)) return INSTAGRAM_REELS_RULE
    }

    if (
      TIKTOK_PACKAGES.contains(packageName) &&
      isTikTokFeedSurface(event)
    ) {
      return TIKTOK_FEED_RULE
    }
    if (
      TIKTOK_PACKAGES.contains(packageName) &&
      isSustainedShortFormScroll(packageName, TIKTOK_FEED_RULE, event, requireSelectedSurfaceSignal = true)
    ) {
      return TIKTOK_FEED_RULE
    }

    return null
  }

  private fun isYouTubeShortsSurface(event: AccessibilityEvent): Boolean {
    val eventLabels = linkedSetOf<String>()
    event.text
      ?.mapNotNull { item -> item?.toString()?.trim() }
      ?.filter { text -> text.isNotBlank() }
      ?.forEach { text -> eventLabels.add(text) }
    event.contentDescription?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let { eventLabels.add(it) }

    val eventSource = event.source
    val eventSourceSelected = eventSource?.isSelected == true || eventSource?.isFocused == true || eventSource?.isAccessibilityFocused == true
    if (
      eventSourceSelected &&
      eventLabels.any { label -> label.equals("shorts", ignoreCase = true) || label.contains("youtube shorts", ignoreCase = true) }
    ) {
      return true
    }

    return containsSelectedShortsNode(rootInActiveWindow, depth = 0)
  }

  private fun isInstagramReelsSurface(event: AccessibilityEvent): Boolean {
    val eventLabels = linkedSetOf<String>()
    event.text
      ?.mapNotNull { item -> item?.toString()?.trim() }
      ?.filter { text -> text.isNotBlank() }
      ?.forEach { text -> eventLabels.add(text) }
    event.contentDescription?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let { eventLabels.add(it) }

    val eventSource = event.source
    val eventSourceSelected = eventSource?.isSelected == true || eventSource?.isFocused == true || eventSource?.isAccessibilityFocused == true
    if (
      eventSourceSelected &&
      eventLabels.any { label -> label.equals("reels", ignoreCase = true) || label.contains("instagram reels", ignoreCase = true) }
    ) {
      return true
    }

    return containsSelectedReelsNode(rootInActiveWindow, depth = 0)
  }

  private fun isTikTokFeedSurface(event: AccessibilityEvent): Boolean {
    val eventLabels = linkedSetOf<String>()
    event.text
      ?.mapNotNull { item -> item?.toString()?.trim() }
      ?.filter { text -> text.isNotBlank() }
      ?.forEach { text -> eventLabels.add(text) }
    event.contentDescription?.toString()?.trim()?.takeIf { it.isNotBlank() }?.let { eventLabels.add(it) }

    val eventSource = event.source
    val eventSourceSelected = eventSource?.isSelected == true || eventSource?.isFocused == true || eventSource?.isAccessibilityFocused == true
    if (
      eventSourceSelected &&
      eventLabels.any { label -> label.equals("for you", ignoreCase = true) || label.contains("tiktok for you", ignoreCase = true) }
    ) {
      return true
    }

    return containsSelectedTikTokFeedNode(rootInActiveWindow, depth = 0)
  }

  private fun isSustainedShortFormScroll(
    packageName: String,
    rule: String,
    event: AccessibilityEvent,
    requireSelectedSurfaceSignal: Boolean
  ): Boolean {
    if (event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return false
    if (requireSelectedSurfaceSignal && !hasSelectedShortFormSurfaceSignal(rule, event)) return false

    val now = SystemClock.elapsedRealtime()
    if (
      shortFormScrollPackage != packageName ||
      shortFormScrollRule != rule ||
      shortFormScrollWindowStartedElapsedMs <= 0L ||
      now - shortFormScrollWindowStartedElapsedMs > SHORT_FORM_SCROLL_WINDOW_MS
    ) {
      shortFormScrollPackage = packageName
      shortFormScrollRule = rule
      shortFormScrollWindowStartedElapsedMs = now
      shortFormScrollCount = 0
    }

    shortFormScrollCount += 1
    return shortFormScrollCount >= MIN_SHORT_FORM_SCROLL_EVENTS
  }

  private fun hasSelectedShortFormSurfaceSignal(rule: String, event: AccessibilityEvent): Boolean {
    return when (rule) {
      YOUTUBE_SHORTS_RULE -> isYouTubeShortsSurface(event)
      INSTAGRAM_REELS_RULE -> isInstagramReelsSurface(event)
      TIKTOK_FEED_RULE -> isTikTokFeedSurface(event)
      else -> hasShortFormSurfaceSignal(rule, event)
    }
  }

  private fun isCurrentShortFormSurface(packageName: String, rule: String): Boolean {
    if (!FreedFocusShieldRollout.enabled(this) || !FreedFocusShieldRules.hasEnabledPresetRulesForPackage(this, packageName)) return false
    return when (rule) {
      YOUTUBE_SHORTS_RULE -> packageName == YOUTUBE_PACKAGE && containsSelectedShortsNode(rootInActiveWindow, depth = 0)
      INSTAGRAM_REELS_RULE -> packageName == INSTAGRAM_PACKAGE && containsSelectedReelsNode(rootInActiveWindow, depth = 0)
      TIKTOK_FEED_RULE -> TIKTOK_PACKAGES.contains(packageName) && containsSelectedTikTokFeedNode(rootInActiveWindow, depth = 0)
      else -> false
    }
  }

  private fun hasShortFormSurfaceSignal(rule: String, event: AccessibilityEvent): Boolean {
    val labelSignals = shortFormLabelSignals(rule)
    val viewIdSignals = shortFormViewIdSignals(rule)
    if (labelSignals.isEmpty() && viewIdSignals.isEmpty()) return false

    event.text
      ?.mapNotNull { item -> item?.toString()?.trim() }
      ?.filter { text -> text.isNotBlank() }
      ?.any { text -> textMatchesShortFormSignal(text, labelSignals) }
      ?.let { matched -> if (matched) return true }

    event.contentDescription
      ?.toString()
      ?.trim()
      ?.takeIf { it.isNotBlank() }
      ?.let { description -> if (textMatchesShortFormSignal(description, labelSignals)) return true }

    val source = event.source
    if (nodeMatchesShortFormSignal(source, labelSignals, viewIdSignals)) return true
    return containsShortFormSignalNode(rootInActiveWindow, depth = 0, labelSignals, viewIdSignals)
  }

  private fun shortFormLabelSignals(rule: String): Set<String> {
    return when (rule) {
      YOUTUBE_SHORTS_RULE -> setOf("shorts", "youtube shorts")
      INSTAGRAM_REELS_RULE -> setOf("reels", "reel", "instagram reels")
      TIKTOK_FEED_RULE -> setOf("for you", "tiktok")
      else -> emptySet()
    }
  }

  private fun shortFormViewIdSignals(rule: String): Set<String> {
    return when (rule) {
      YOUTUBE_SHORTS_RULE -> setOf("shorts")
      INSTAGRAM_REELS_RULE -> setOf("reels", "reel", "clips")
      TIKTOK_FEED_RULE -> setOf("feed", "foryou")
      else -> emptySet()
    }
  }

  private fun containsShortFormSignalNode(
    node: AccessibilityNodeInfo?,
    depth: Int,
    labelSignals: Set<String>,
    viewIdSignals: Set<String>
  ): Boolean {
    if (node == null || depth > 7) return false
    if (nodeMatchesShortFormSignal(node, labelSignals, viewIdSignals)) return true

    for (index in 0 until node.childCount) {
      if (containsShortFormSignalNode(node.getChild(index), depth + 1, labelSignals, viewIdSignals)) return true
    }

    return false
  }

  private fun nodeMatchesShortFormSignal(
    node: AccessibilityNodeInfo?,
    labelSignals: Set<String>,
    viewIdSignals: Set<String>
  ): Boolean {
    if (node == null) return false
    val text = node.text?.toString()?.trim().orEmpty()
    val description = node.contentDescription?.toString()?.trim().orEmpty()
    val viewId = node.viewIdResourceName.orEmpty().lowercase(Locale.US)
    return textMatchesShortFormSignal(text, labelSignals) ||
      textMatchesShortFormSignal(description, labelSignals) ||
      viewIdSignals.any { signal -> viewId.contains(signal) }
  }

  private fun textMatchesShortFormSignal(value: String, labelSignals: Set<String>): Boolean {
    val normalized = value.trim().lowercase(Locale.US)
    if (normalized.isBlank()) return false
    return labelSignals.any { signal ->
      normalized == signal ||
        normalized.contains(signal)
    }
  }

  private fun containsSelectedShortsNode(node: AccessibilityNodeInfo?, depth: Int): Boolean {
    return containsSelectedShortFormNode(
      node = node,
      depth = depth,
      labelSignals = setOf("shorts"),
      viewIdSignals = setOf("shorts")
    )
  }

  private fun containsSelectedReelsNode(node: AccessibilityNodeInfo?, depth: Int): Boolean {
    return containsSelectedShortFormNode(
      node = node,
      depth = depth,
      labelSignals = setOf("reels", "reel"),
      viewIdSignals = setOf("reels", "reel", "clips")
    )
  }

  private fun containsSelectedTikTokFeedNode(node: AccessibilityNodeInfo?, depth: Int): Boolean {
    return containsSelectedShortFormNode(
      node = node,
      depth = depth,
      labelSignals = setOf("for you", "tiktok for you"),
      viewIdSignals = setOf("foryou", "for_you")
    )
  }

  private fun containsSelectedShortFormNode(
    node: AccessibilityNodeInfo?,
    depth: Int,
    labelSignals: Set<String>,
    viewIdSignals: Set<String>
  ): Boolean {
    if (node == null || depth > 7) return false

    val text = node.text?.toString()?.trim().orEmpty()
    val description = node.contentDescription?.toString()?.trim().orEmpty()
    val viewId = node.viewIdResourceName.orEmpty()
    val normalizedText = text.lowercase(Locale.US)
    val normalizedDescription = description.lowercase(Locale.US)
    val normalizedViewId = viewId.lowercase(Locale.US)
    val labelLooksLikeShortForm =
      labelSignals.any { signal ->
        normalizedText == signal ||
          normalizedDescription == signal ||
          normalizedDescription.contains(signal) ||
          normalizedViewId.contains(signal)
      } ||
        viewIdSignals.any { signal -> normalizedViewId.contains(signal) }

    if (labelLooksLikeShortForm && (node.isSelected || node.isFocused || node.isAccessibilityFocused)) {
      return true
    }

    for (index in 0 until node.childCount) {
      if (containsSelectedShortFormNode(node.getChild(index), depth + 1, labelSignals, viewIdSignals)) return true
    }

    return false
  }

  private fun collectLikelyFocusedUrlText(
    packageName: String,
    node: AccessibilityNodeInfo?,
    output: MutableSet<String>,
    depth: Int
  ) {
    if (node == null || depth > 6) return

    val text = node.text?.toString()?.trim()
    val nodeLooksEditable = node.isEditable || node.isFocused || node.isAccessibilityFocused
    if (nodeLooksEditable && !text.isNullOrBlank() && shouldCollectFocusedCandidateText(packageName, node, text)) {
      output.add(text)
    }

    for (index in 0 until node.childCount) {
      collectLikelyFocusedUrlText(packageName, node.getChild(index), output, depth + 1)
    }
  }

  private fun shouldCollectFocusedCandidateText(packageName: String, node: AccessibilityNodeInfo, text: String): Boolean {
    val nodeHasUrlFieldSignal =
      sourceIsKnownBrowserUrlField(packageName, node) ||
        nodeLooksLikeUrlOrSearchField(node)
    if (!nodeHasUrlFieldSignal) return false
    return looksLikeUrlOrSearch(text) || looksLikeBoundedFocusedSearchText(text)
  }

  private fun sourceIsKnownBrowserUrlField(packageName: String, node: AccessibilityNodeInfo?): Boolean {
    val viewId = node?.viewIdResourceName ?: return false
    return browserUrlViewIds[packageName].orEmpty().contains(viewId)
  }

  private fun nodeLooksLikeUrlOrSearchField(node: AccessibilityNodeInfo?): Boolean {
    if (node == null) return false
    val viewId = node.viewIdResourceName.orEmpty().lowercase(Locale.US)
    val className = node.className?.toString().orEmpty().lowercase(Locale.US)
    val description = node.contentDescription?.toString().orEmpty().lowercase(Locale.US)
    val hint = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      node.hintText?.toString().orEmpty().lowercase(Locale.US)
    } else {
      ""
    }
    val fieldText = listOf(viewId, description, hint).joinToString(" ")
    val fieldSignals = listOf("url", "address", "location", "omnibar", "omnibox", "search", "awesome_bar")
    return (node.isEditable || className.contains("edittext")) &&
      fieldSignals.any { signal -> fieldText.contains(signal) }
  }

  private fun looksLikeBoundedFocusedSearchText(text: String): Boolean {
    val normalized = text.trim()
    if (normalized.isBlank() || normalized.length > 120) return false
    if (normalized.contains('\n') || normalized.contains('\r') || normalized.contains('\t')) return false
    val words = normalized.split(Regex("\\s+")).filter { it.isNotBlank() }
    return words.size in 1..12
  }

  private fun looksLikeUrlOrSearch(text: String): Boolean {
    val normalized = text.lowercase()
    if (normalized.length > 250) return false
    if (normalized.any { it.isWhitespace() } && !normalized.contains("search?q=") && !normalized.contains("search_query=")) {
      return false
    }
    return normalized.contains(".") ||
      normalized.startsWith("http://") ||
      normalized.startsWith("https://") ||
      normalized.contains("search?q=") ||
      normalized.contains("search_query=")
  }

  private fun requestWebsiteRecovery(id: String, configurationEpoch: Long, connectionEpoch: Long, vpnCurrent: () -> Boolean) {
    synchronized(FreedNativeUnlockStore.lock) {
      val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      FreedWebsiteRecoveryHandoff.requestOnce(id, SystemClock.elapsedRealtime(), {
        ownsConnectedRuntime() && scheduleConnectionEpoch == connectionEpoch && vpnCurrent() &&
          configurationEpoch == FreedProtectionConfiguration.epoch(this) && FreedWebsiteRecoveryHandoff.previewEnabled(this) &&
          isScreenInteractiveAndUnlocked() && eligibleWebHandlers?.contains(liveScheduleForegroundPackage()) == true &&
          prefs.getString(PENDING_SOURCE_PACKAGE, null) == "android-dns" && FreedWebsiteRecoveryHandoff.current(this, prefs.all, id)
      }, {
        val snapshot = prefs.all
        val intent = buildAccessibilityInterventionIntent("android-dns", snapshot[PENDING_URL] as? String ?: "",
          snapshot[PENDING_HOST] as? String ?: "", snapshot[PENDING_RULE] as? String ?: "")
        intent.putExtra(FreedProtectionConfiguration.INTENT_EPOCH, configurationEpoch)
        intent.putExtra(FreedInterventionActivity.INTERVENTION_ID_EXTRA, id)
        startActivity(intent)
      })
    }
  }

  private fun launchIntervention(url: String, sourcePackage: String, result: FreedClassification, adultGeneration: Pair<Long?, Long>): Unit = FreedAdultProtectionState.guarded(this) {
    if (!FreedAdultProtectionState.permitsClassification(this, adultGeneration)) return@guarded
    synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedProtectionConfiguration.interceptionEnabled(this)) return@synchronized
    val now = SystemClock.elapsedRealtime()
    val host = FreedUrlClassifier.normalizeHostForStorage(result.host).ifBlank { "redacted.freed.local" }
    val key = "$host:${result.matchedRule}"
    if (key == lastBlockedKey && now - lastLaunchElapsedMs < 4_000) return@synchronized
    lastBlockedKey = key
    lastLaunchElapsedMs = now
    val redactedUrl = "https://$host"
    val interventionId = UUID.randomUUID().toString()

    val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
    val published = FreedWebsiteRecoveryHandoff.publish(this, prefs, interventionId) {
      putString(PENDING_INTERVENTION_ID, interventionId)
      putString(PENDING_URL, redactedUrl)
      putString(PENDING_HOST, host)
      putString(PENDING_SOURCE_PACKAGE, sourcePackage)
      putString(PENDING_REASON, result.reason)
      putString(PENDING_RULE, result.matchedRule)
      putString(PENDING_DETECTED_AT, nowIsoString())
    }
    if (!published) return@synchronized
    val intent = buildAccessibilityInterventionIntent(sourcePackage, redactedUrl, host, result.matchedRule)
    runCatching { showAccessibilityInterventionNotification(
      title = FreedNativeCopy.text(this@FreedAccessibilityService, R.string.freed_recovery_channel),
      sourceLabel = host, sourcePackage = sourcePackage, redactedUrl = redactedUrl,
      host = host, matchedRule = result.matchedRule
    ) }
    FreedWebsiteRecoveryHandoff.requestOnce(interventionId, now, {
      FreedAdultProtectionState.permitsClassification(this, adultGeneration) && ownsConnectedRuntime() && isScreenInteractiveAndUnlocked() && liveScheduleForegroundPackage() == sourcePackage &&
        FreedWebsiteRecoveryHandoff.current(this, prefs.all, interventionId)
    }, { startActivity(intent) })
    Unit
    }
  }

  private fun launchAppIntervention(
    packageName: String,
    reason: String = "Configured app limit reached.",
    matchedRule: String? = null,
    hostOverride: String? = null,
    focusShieldRuleId: String? = null,
    sessionDurationSeconds: Long = (currentForegroundSessionMs(packageName) / 1_000L).coerceAtLeast(0L),
    appGroup: Map<String, Any?>? = null
  ): Unit = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedProtectionConfiguration.interceptionEnabled(this) || packageName !in FreedInstalledApplications.eligible(this)) return@synchronized
    val now = SystemClock.elapsedRealtime()
    val rule = matchedRule ?: "configured-app:${packageName.lowercase(Locale.US)}"
    if (rule == lastBlockedKey && now - lastLaunchElapsedMs < 4_000) return@synchronized

    lastBlockedKey = rule
    lastLaunchElapsedMs = now
    val host = FreedUrlClassifier.normalizeHostForStorage(hostOverride ?: appHostForPackage(packageName)).ifBlank { "redacted.freed.local" }
    val redactedUrl = "https://$host"
    val interventionId = UUID.randomUUID().toString()

    val pendingEditor = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
    if (appGroup != null && !FreedAppGroupStore.issue(this, appGroup, packageName, interventionId, pendingEditor)) return@synchronized
    pendingEditor
      .putString(PENDING_INTERVENTION_ID, interventionId)
      .putString(PENDING_URL, redactedUrl)
      .putString(PENDING_HOST, host)
      .putString(PENDING_SOURCE_PACKAGE, packageName)
      .putString(PENDING_REASON, reason)
      .putString(PENDING_RULE, rule)
      .putString(PENDING_DETECTED_AT, nowIsoString())
      .apply {
        if (focusShieldRuleId != null) {
          putString(PENDING_FOCUS_SHIELD_RULE_ID, focusShieldRuleId)
        } else {
          remove(PENDING_FOCUS_SHIELD_RULE_ID)
        }
        if (sessionDurationSeconds > 0L) {
          putLong(PENDING_SESSION_DURATION_SECONDS, sessionDurationSeconds.coerceAtMost(MAX_FOREGROUND_SEGMENT_MS / 1_000L))
        } else {
          remove(PENDING_SESSION_DURATION_SECONDS)
        }
      }
      .apply()

    val intent = buildAccessibilityInterventionIntent(packageName, redactedUrl, host, rule, focusShieldRuleId)
    runCatching { showAccessibilityInterventionNotification(
      title = FreedNativeCopy.text(this@FreedAccessibilityService, R.string.freed_recovery_channel),
      sourceLabel = host,
      sourcePackage = packageName,
      redactedUrl = redactedUrl,
      host = host,
      matchedRule = rule,
      focusShieldRuleId = focusShieldRuleId
    ) }
    runCatching { startActivity(intent) }
    Unit
  }

  private fun launchShortFormIntervention(packageName: String, rule: String) {
    val sessionDurationSeconds = if (shortFormPackage == packageName.lowercase(Locale.US) && shortFormRule == rule && shortFormStartedElapsedMs > 0L) {
      ((SystemClock.elapsedRealtime() - shortFormStartedElapsedMs).coerceIn(0L, MAX_FOREGROUND_SEGMENT_MS) / 1_000L).coerceAtLeast(0L)
    } else {
      0L
    }
    clearShortFormSession()
    launchAppIntervention(
      packageName,
      reason = "Sustained short-form session detected. FREED is redirecting to an earned-reset challenge.",
      matchedRule = rule,
      hostOverride = shortFormHostForRule(rule),
      sessionDurationSeconds = sessionDurationSeconds
    )
  }

  private fun launchFocusShieldIntervention(
    packageName: String,
    shortFormRule: String,
    focusShieldRule: FreedFocusShieldRule
  ) {
    clearShortFormSession()
    launchAppIntervention(
      packageName = packageName,
      reason = "Focus Shield matched a configured surface rule.",
      matchedRule = "focus-shield:${focusShieldRule.id}",
      hostOverride = shortFormHostForRule(shortFormRule),
      focusShieldRuleId = focusShieldRule.id
    )
  }

  private fun shortFormHostForRule(rule: String): String {
    return FreedDoomscrollApps.shortFormHostForRule(rule)
  }

  private fun appHostForPackage(packageName: String): String {
    val normalized = packageName
      .lowercase(Locale.US)
      .replace(Regex("[^a-z0-9.]+"), "-")
      .trim('.')
      .ifBlank { "app" }
    return "$normalized.app.freed.local"
  }

  private fun buildAccessibilityInterventionIntent(
    sourcePackage: String,
    redactedUrl: String,
    host: String,
    matchedRule: String,
    focusShieldRuleId: String? = null
  ): Intent {
    return Intent(this, FreedInterventionActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      putExtra(FreedProtectionConfiguration.INTENT_EPOCH, FreedProtectionConfiguration.epoch(this@FreedAccessibilityService))
      putExtra(FreedInterventionActivity.INTERVENTION_ID_EXTRA,
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(PENDING_INTERVENTION_ID, null))
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra("freed_intervention_source", sourcePackage)
      putExtra("freed_intervention_url", redactedUrl)
      putExtra("freed_intervention_host", host)
      putExtra("freed_intervention_rule", matchedRule)
      focusShieldRuleId?.let { putExtra("freed_focus_shield_rule_id", it) }
    }
  }

  private fun showAccessibilityInterventionNotification(
    title: String,
    sourceLabel: String,
    sourcePackage: String,
    redactedUrl: String,
    host: String,
    matchedRule: String,
    focusShieldRuleId: String? = null
  ) {
    if (focusShieldRuleId == null && FreedWebsiteRecoveryHandoff.isWebsite(mapOf(
        PENDING_SOURCE_PACKAGE to sourcePackage, PENDING_RULE to matchedRule))) {
      FreedWebsiteRecoveryNotification.show(this, INTERVENTION_NOTIFICATION_CHANNEL_ID, INTERVENTION_NOTIFICATION_ID)
      return
    }
    val notificationManager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          INTERVENTION_NOTIFICATION_CHANNEL_ID,
          FreedNativeCopy.text(this@FreedAccessibilityService, R.string.freed_recovery_channel),
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = FreedNativeCopy.text(this@FreedAccessibilityService, R.string.freed_browser_channel_description)
        }
      )
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      INTERVENTION_NOTIFICATION_ID,
      buildAccessibilityInterventionIntent(sourcePackage, redactedUrl, host, matchedRule, focusShieldRuleId),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_lock_lock
    val message = FreedNativeCopy.text(this@FreedAccessibilityService, R.string.freed_accessibility_notification)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, INTERVENTION_NOTIFICATION_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    builder
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(message)
      .setStyle(Notification.BigTextStyle().bigText(message + "\n" + FreedNativeCopy.text(this, R.string.freed_source_label, mapOf("host" to sourceLabel.take(80)))))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_STATUS)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_HIGH)
    }

    FreedRetainedAdultProtection.publishPrivateNotice(this, INTERVENTION_NOTIFICATION_ID) {
      notificationManager.notify(INTERVENTION_NOTIFICATION_ID, builder.build())
    }
  }

  private fun nowIsoString(): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
  }
}
