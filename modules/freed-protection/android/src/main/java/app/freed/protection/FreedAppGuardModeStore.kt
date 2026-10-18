package app.freed.protection

import android.content.Context

internal data class FreedAppGuardModeSaveResult(val accepted: Boolean, val error: String? = null)

/** Mode writes never reactivate protection, replace selections, change limits, or mint access. */
internal object FreedAppGuardModeStore {
  const val MODE_KEY = "app_guard_mode_v1"
  private fun prefs(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
  fun read(context: Context): String = FreedAppGuardModePolicy.fromStored(prefs(context).all[MODE_KEY] as? String)
  fun valid(context: Context): Boolean {
    val stored = prefs(context).all
    return !stored.containsKey(MODE_KEY) || FreedAppGuardModePolicy.parse(stored[MODE_KEY] as? String) != null
  }
  fun save(context: Context, input: String): FreedAppGuardModeSaveResult = synchronized(FreedNativeUnlockStore.lock) {
    val mode = FreedAppGuardModePolicy.parse(input)
      ?: return@synchronized FreedAppGuardModeSaveResult(false, "app-guard-mode-invalid")
    if (!FreedProtectionConfiguration.interceptionEnabled(context)) {
      return@synchronized FreedAppGuardModeSaveResult(false, "protection-disabled")
    }
    val storage = prefs(context)
    val previous = storage.all[MODE_KEY]
    if (!storage.edit().putString(MODE_KEY, mode).commit()) {
      // Failed commits may already change memory. Roll back this key alone.
      val rollback = storage.edit()
      if (previous is String) rollback.putString(MODE_KEY, previous) else rollback.remove(MODE_KEY)
      rollback.apply()
      return@synchronized FreedAppGuardModeSaveResult(false, "app-guard-mode-save-failed")
    }
    FreedAppGuardModeSaveResult(true)
  }
}
