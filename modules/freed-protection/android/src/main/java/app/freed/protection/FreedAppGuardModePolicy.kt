package app.freed.protection

/** Selected static rules, native timed rules and hard strict guards remain independent. */
internal object FreedAppGuardModePolicy {
  const val DAILY_LIMIT = "daily-limit"
  const val BEFORE_USE = "before-use"
  const val SCHEDULED = "scheduled"

  fun parse(value: String?): String? = value?.takeIf { it == DAILY_LIMIT || it == BEFORE_USE || it == SCHEDULED }
  fun fromStored(value: String?): String = parse(value) ?: DAILY_LIMIT
  fun packageSource(input: String?): String? = input?.trim()?.lowercase(java.util.Locale.US)
    ?.takeIf { it in FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES }

  /** Native strict and active timed package guards cannot be paused by an earned break. */
  fun hardGuardActive(packageName: String?, schedules: FreedAppScheduleSnapshot, strict: Boolean): Boolean =
    strict || (packageName != null && packageName in schedules.activePackages)

  fun shouldInterrupt(packageName: String, selected: Set<String>, schedules: FreedAppScheduleSnapshot,
    mode: String, strict: Boolean, dailyLimitReached: Boolean, earnedUnlockActive: Boolean, enabled: Boolean): Boolean {
    if (!enabled || !packageName.matches(Regex("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"))) return false
    if (packageName in schedules.activePackages || (strict && packageName in FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES)) return true
    if (earnedUnlockActive) return false
    if (packageName !in selected) return false
    return when (mode) {
      BEFORE_USE -> true
      DAILY_LIMIT -> dailyLimitReached
      SCHEDULED -> false // Only a configured native schedule supplies a timed target.
      else -> false
    }
  }

  /** Installed configuration/readiness, not a claim of an active window or measured blocking. */
  fun ready(mode: String, selectedCount: Int, enabled: Boolean, accessibility: Boolean,
    connected: Boolean, usageAuthorized: Boolean, selectedWindowsConfigured: Boolean): Boolean {
    if (parse(mode) == null || selectedCount <= 0 || !enabled || !accessibility || !connected) return false
    return when (mode) {
      BEFORE_USE -> true
      DAILY_LIMIT -> usageAuthorized
      SCHEDULED -> selectedWindowsConfigured
      else -> false
    }
  }
}
