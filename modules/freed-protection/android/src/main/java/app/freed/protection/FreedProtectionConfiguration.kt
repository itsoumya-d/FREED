package app.freed.protection

import android.app.NotificationManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** Only FREED's private protection state. OS permission grants and Private DNS are never written. */
internal object FreedProtectionConfiguration {
  const val INTERCEPTION_DISABLED = "protection_interception_disabled_v1"
  const val CONFIGURATION_EPOCH = "protection_configuration_epoch_v1"
  const val INTENT_EPOCH = "freed_protection_configuration_epoch"
  private val resetLock = Any()
  @Volatile var resetInProgress = false
    private set
  private fun prefs(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)

  fun epoch(context: Context): Long = (prefs(context).all[CONFIGURATION_EPOCH] as? Number)?.toLong()?.coerceAtLeast(0L) ?: 0L

  fun interceptionEnabled(context: Context): Boolean = FreedProtectionResetPolicy.interceptionEnabled(
    if (prefs(context).contains(INTERCEPTION_DISABLED)) prefs(context).getBoolean(INTERCEPTION_DISABLED, false) else null,
    resetInProgress
  )

  /** Explicit positive reconfiguration only. Never restore a claim/receipt from before deletion. */
  fun activate(context: Context): Boolean = FreedAdultProtectionState.guarded(context) {
    synchronized(FreedNativeUnlockStore.lock) {
    if (resetInProgress) return@synchronized false
    if (!FreedProtectionResetPolicy.shouldReactivate(true, !interceptionEnabled(context))) return@synchronized true
    if (!FreedVpnService.ownedRuntimeCanReactivate()) return@synchronized false
    try { FreedAdultMutationBoundary.requireUnenrolled(context, FriendLockAction.RESET_ADULT_PROTECTION) }
    catch (_: Exception) { return@synchronized false }
    FreedAdultProtectionState.repairFence(context, "mixed-activate")
    val storage = prefs(context)
    val editor = storage.edit()
    FreedNativeUnlockStore.clearAllAuthority(editor)
    editor.remove(FreedFocusShieldRules.FOCUS_SHIELD_UNLOCKS)
    storage.all.keys.filter { it.startsWith("pending_") || it.startsWith(FreedAccessibilityService.APP_USAGE_PREFIX) ||
      it == FreedAccessibilityService.APP_USAGE_DATE_KEY || it == FreedAccessibilityService.LAST_FOREGROUND_PACKAGE ||
      it == FreedAccessibilityService.LAST_FOREGROUND_ELAPSED_MS }.forEach(editor::remove)
    val accepted = editor.putBoolean(INTERCEPTION_DISABLED, false).commit()
    if (!accepted) storage.edit().putBoolean(INTERCEPTION_DISABLED, true).apply()
    accepted
    }
  }

  fun reset(context: Context): FreedProtectionResetResult = synchronized(resetLock) {
    try { FreedAdultMutationBoundary.requireUnenrolled(context, FriendLockAction.RESET_ADULT_PROTECTION) }
    catch (failure: FreedAdultMutationFailure) { return@synchronized FreedProtectionResetResult(false, failure.code) }
    resetInProgress = true
    var nextEpoch = 0L
    try {
      FreedProtectionResetPolicy.reset(listOf(
        { FreedAdultProtectionState.guarded(context) { synchronized(FreedNativeUnlockStore.lock) {
          FreedAdultMutationBoundary.requireUnenrolled(context, FriendLockAction.RESET_ADULT_PROTECTION)
          FreedAdultProtectionState.repairFence(context, "mixed-reset")
          nextEpoch = epoch(context) + 1L
          prefs(context).edit().clear().putBoolean(INTERCEPTION_DISABLED, true).putLong(CONFIGURATION_EPOCH, nextEpoch).commit()
        } } },
        { FreedEncryptedDnsConfig.clearOwnedConfiguration(context) },
        { FreedFocusShieldRollout.clearOwnedConfiguration(context) }
      ), {
        // Do not hold the grant lock while waiting on Android's main thread.
        val accessibilityStopped = FreedAccessibilityService.clearOwnedRuntimeForReset()
        val interventionStopped = FreedInterventionActivity.clearOwnedRuntimeForReset()
        val vpnStopped = FreedVpnService.stopOwnedRuntimeForReset(context)
        val notificationsCleared = runCatching {
          val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return@runCatching false
          listOf(9402, 9403, 9404).forEach(notifications::cancel)
          true
        }.getOrDefault(false)
        accessibilityStopped && interventionStopped && vpnStopped && notificationsCleared
      }, {
        synchronized(FreedNativeUnlockStore.lock) {
          val state = prefs(context).all
          state.keys == setOf(INTERCEPTION_DISABLED, CONFIGURATION_EPOCH) && state[INTERCEPTION_DISABLED] == true &&
            state[CONFIGURATION_EPOCH] == nextEpoch &&
            FreedEncryptedDnsConfig.ownedConfigurationEmpty(context) &&
            FreedFocusShieldRollout.ownedConfigurationEmpty(context) && !FreedVpnService.isRunning
        }
      })
    } finally {
      resetInProgress = false
    }
  }

  /** Completion means the main-thread teardown ran; a queued request alone is never success. */
  fun runOnMainForReset(operation: () -> Boolean): Boolean {
    if (Looper.myLooper() == Looper.getMainLooper()) return runCatching(operation).getOrDefault(false)
    val handler = Handler(Looper.getMainLooper())
    val complete = CountDownLatch(1)
    val accepted = AtomicBoolean(false)
    val cancelled = AtomicBoolean(false)
    val callback = Runnable {
      if (!cancelled.get()) accepted.set(runCatching(operation).getOrDefault(false))
      complete.countDown()
    }
    if (!handler.post(callback)) return false
    val finished = runCatching { complete.await(5, TimeUnit.SECONDS) }.getOrDefault(false)
    if (!finished) {
      cancelled.set(true)
      handler.removeCallbacks(callback)
    }
    return finished && accepted.get()
  }
}
