package app.freed.protection

import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

internal data class FreedAppSchedule(
  val id: String,
  val enabled: Boolean,
  val startMinute: Int,
  val endMinute: Int,
  val days: Set<Int>,
  val packages: Set<String>,
  val allDay: Boolean
) {
  val effective: Boolean get() = enabled && days.isNotEmpty() && packages.isNotEmpty() && (allDay || startMinute != endMinute)
}

internal data class FreedAppScheduleConfiguration(val schedules: List<FreedAppSchedule>, val strictGuard: Boolean = false) {
  val configured: Boolean get() = schedules.any { it.effective }
  val potentialPackages: Set<String> get() = schedules.filter { it.effective }.flatMap { it.packages }.toSet() +
    if (strictGuard) FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES else emptySet()
}

internal data class FreedAppScheduleSnapshot(val activeScheduleIds: List<String>, val activePackages: Set<String>)

/** Minute precision, local wall-clock windows. Overnight windows belong to their start day. */
internal object FreedAppSchedulePolicy {
  private val ids = setOf("sleep", "work", "weekend")
  private val scheduleKeys = setOf("id", "enabled", "startMinute", "endMinute", "days", "packages", "allDay")
  val empty = FreedAppScheduleConfiguration(emptyList())

  fun parse(input: Map<String, *>, ownPackage: String, previousStrictGuard: Boolean = false,
    eligiblePackages: Set<String> = FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES): FreedAppScheduleConfiguration? {
    if (input.keys.any { it !in setOf("version", "schedules", "strictGuard") } || integer(input["version"]) != 1) return null
    val strict = if (input.containsKey("strictGuard")) input["strictGuard"] as? Boolean ?: return null else previousStrictGuard
    val values = input["schedules"] as? List<*> ?: return null
    if (values.size > ids.size) return null
    val schedules = ArrayList<FreedAppSchedule>()
    for (value in values) {
      val entry = value as? Map<*, *> ?: return null
      if (entry.keys.any { it !in scheduleKeys }) return null
      val id = entry["id"] as? String ?: return null
      if (id !in ids || schedules.any { it.id == id }) return null
      val enabled = entry["enabled"] as? Boolean ?: return null
      val start = integer(entry["startMinute"])?.takeIf { it in 0..1439 } ?: return null
      val end = integer(entry["endMinute"])?.takeIf { it in 0..1439 } ?: return null
      val rawDays = entry["days"] as? List<*> ?: return null
      if (rawDays.size > 7) return null
      val days = linkedSetOf<Int>()
      for (day in rawDays) days.add(integer(day)?.takeIf { it in 0..6 } ?: return null)
      val rawPackages = entry["packages"] as? List<*> ?: return null
      if (rawPackages.size > 32) return null
      val packages = linkedSetOf<String>()
      for (rawPackage in rawPackages) {
        val name = (rawPackage as? String)?.takeIf { it.length <= 255 }?.trim()?.lowercase(Locale.US) ?: return null
        if (name == ownPackage.lowercase(Locale.US)) continue
        if (!name.matches(Regex("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$")) || name !in eligiblePackages) return null
        packages.add(name)
      }
      val allDay = if (entry.containsKey("allDay")) entry["allDay"] as? Boolean ?: return null else false
      if (allDay && (id != "weekend" || days != setOf(0, 6))) return null
      if (enabled && (days.isEmpty() || packages.isEmpty())) return null
      if (enabled && id == "weekend" && (!allDay || days != setOf(0, 6))) return null
      schedules.add(FreedAppSchedule(id, enabled, start, end, days, packages, allDay))
    }
    return FreedAppScheduleConfiguration(schedules, strict)
  }

  fun evaluate(configuration: FreedAppScheduleConfiguration, nowMs: Long, timeZone: TimeZone = TimeZone.getDefault()): FreedAppScheduleSnapshot {
    val calendar = Calendar.getInstance(timeZone).apply { timeInMillis = nowMs }
    return evaluate(configuration, calendar)
  }

  private fun evaluate(configuration: FreedAppScheduleConfiguration, calendar: Calendar): FreedAppScheduleSnapshot {
    val day = calendar.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
    val minute = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
    val active = configuration.schedules.filter { schedule ->
      schedule.effective && when {
        schedule.allDay -> day in schedule.days
        schedule.startMinute < schedule.endMinute -> day in schedule.days && minute >= schedule.startMinute && minute < schedule.endMinute
        minute >= schedule.startMinute -> day in schedule.days
        minute < schedule.endMinute -> (day + 6) % 7 in schedule.days
        else -> false
      }
    }
    return FreedAppScheduleSnapshot(active.map { it.id }, active.flatMap { it.packages }.toSet())
  }

  fun effectivePackages(manualPackages: Set<String>, snapshot: FreedAppScheduleSnapshot): Set<String> = manualPackages + snapshot.activePackages

  fun shouldInterrupt(packageName: String, manualPackages: Set<String>, snapshot: FreedAppScheduleSnapshot,
    dailyLimitReached: Boolean, earnedUnlockActive: Boolean): Boolean {
    return !earnedUnlockActive && (packageName in snapshot.activePackages || (packageName in manualPackages && dailyLimitReached))
  }

  fun shouldRelock(packageName: String, effectivePackages: Set<String>, liveForegroundPackage: String?, earnedUnlockActive: Boolean): Boolean =
    packageName == liveForegroundPackage && packageName in effectivePackages && !earnedUnlockActive

  /** Scan real instants so skipped/repeated local minutes at DST transitions remain correct. Status only; no alarms. */
  fun nextBoundaryAt(configuration: FreedAppScheduleConfiguration, nowMs: Long, timeZone: TimeZone = TimeZone.getDefault()): Long? {
    if (!configuration.configured) return null
    val calendar = Calendar.getInstance(timeZone).apply { timeInMillis = nowMs }
    val current = evaluate(configuration, calendar).activeScheduleIds
    var candidate = nowMs - calendar.get(Calendar.SECOND) * 1_000L - calendar.get(Calendar.MILLISECOND) + 60_000L
    repeat(8 * 24 * 60) {
      calendar.timeInMillis = candidate
      if (evaluate(configuration, calendar).activeScheduleIds != current) return candidate
      candidate += 60_000L
    }
    return null
  }

  private fun integer(value: Any?): Int? {
    val number = value as? Number ?: return null
    val double = number.toDouble()
    return double.takeIf { it.isFinite() && it >= Int.MIN_VALUE && it <= Int.MAX_VALUE && it == it.toInt().toDouble() }?.toInt()
  }
}
