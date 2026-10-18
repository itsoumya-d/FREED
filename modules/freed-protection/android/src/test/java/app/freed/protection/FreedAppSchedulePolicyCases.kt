package app.freed.protection

import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

fun main() {
  val youtube = FreedDoomscrollApps.YOUTUBE_PACKAGE
  val instagram = FreedDoomscrollApps.INSTAGRAM_PACKAGE
  val reddit = FreedDoomscrollApps.REDDIT_PACKAGE
  val ownPackage = "app.freed"
  val utc = TimeZone.getTimeZone("UTC")
  fun at(value: String): Long = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
    timeZone = utc
    isLenient = false
  }.parse(value)!!.time
  fun schedule(id: String = "work", enabled: Boolean = true, start: Any = 9 * 60, end: Any = 17 * 60,
    days: List<Any> = listOf(1, 2, 3, 4, 5), packages: List<Any> = listOf(youtube), allDay: Any = false): Map<String, Any> =
    mapOf("id" to id, "enabled" to enabled, "startMinute" to start, "endMinute" to end,
      "days" to days, "packages" to packages, "allDay" to allDay)
  fun input(vararg schedules: Map<String, Any>): Map<String, Any> = mapOf("version" to 1, "schedules" to schedules.toList())
  fun parse(vararg schedules: Map<String, Any>) = FreedAppSchedulePolicy.parse(input(*schedules), ownPackage)
    ?: error("Valid schedule configuration was rejected")
  fun snapshot(config: FreedAppScheduleConfiguration, value: String, zone: TimeZone = utc) =
    FreedAppSchedulePolicy.evaluate(config, at(value), zone)
  check(FreedAppSchedulePolicy.parse(mapOf("version" to 1, "strictGuard" to true, "schedules" to emptyList<Any>()), ownPackage) != null) {
    "An explicit Boolean independent strict guard must be accepted without inventing a timed schedule"
  }
  val strictInput = mapOf("version" to 1, "strictGuard" to true, "schedules" to emptyList<Any>())
  check(FreedAppSchedulePolicy.parse(strictInput, ownPackage)?.strictGuard == true)
  check(FreedAppSchedulePolicy.parse(input(), ownPackage, previousStrictGuard = true)?.strictGuard == true) { "Omitted strict intent must retain installed strict" }
  check(FreedAppSchedulePolicy.parse(input() + ("strictGuard" to false), ownPackage, previousStrictGuard = true)?.strictGuard == false)
  for (bad in listOf("true", 1, null)) check(FreedAppSchedulePolicy.parse(input() + ("strictGuard" to bad), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input() + ("targetScope" to "selected-applications"), ownPackage) == null) { "iOS target scope is not an Android configuration" }
  check(FreedAppSchedulePolicy.parse(input(schedule() + ("targetScope" to "selected-applications")), ownPackage) == null)
  val work = parse(schedule())
  check(snapshot(work, "2026-10-05T08:59:59Z").activePackages.isEmpty())
  check(snapshot(work, "2026-10-05T09:00:00Z").activePackages == setOf(youtube))
  check(snapshot(work, "2026-10-05T16:59:59Z").activeScheduleIds == listOf("work"))
  check(snapshot(work, "2026-10-05T17:00:00Z").activePackages.isEmpty())
  check(snapshot(work, "2026-10-04T12:00:00Z").activePackages.isEmpty())
  check(FreedAppSchedulePolicy.nextBoundaryAt(work, at("2026-10-05T08:59:59Z"), utc) == at("2026-10-05T09:00:00Z"))
  check(FreedAppSchedulePolicy.nextBoundaryAt(work, at("2026-10-05T09:00:00Z"), utc) == at("2026-10-05T17:00:00Z"))
  val overlap = parse(schedule(start = 9 * 60, end = 12 * 60),
    schedule(id = "sleep", start = 11 * 60, end = 13 * 60, packages = listOf(youtube, instagram)))
  val active = snapshot(overlap, "2026-10-05T11:30:00Z")
  check(active.activeScheduleIds == listOf("work", "sleep"))
  check(active.activePackages == setOf(youtube, instagram))
  check(snapshot(overlap, "2026-10-05T12:00:00Z").activePackages == setOf(youtube, instagram))
  check(FreedAppSchedulePolicy.effectivePackages(setOf(reddit, youtube), snapshot(overlap, "2026-10-05T13:00:00Z")) == setOf(reddit, youtube))
  check(FreedAppSchedulePolicy.shouldInterrupt(youtube, setOf(reddit), active, false, false))
  check(!FreedAppSchedulePolicy.shouldInterrupt(youtube, setOf(reddit), active, false, true))
  check(!FreedAppSchedulePolicy.shouldInterrupt(youtube, setOf(reddit), snapshot(overlap, "2026-10-05T13:00:00Z"), true, false))
  check(FreedAppSchedulePolicy.shouldInterrupt(reddit, setOf(reddit), active, true, false))
  check(!FreedAppSchedulePolicy.shouldInterrupt(reddit, setOf(reddit), active, false, false))
  val manualAndSchedule = FreedAppSchedulePolicy.effectivePackages(setOf(youtube), active)
  check(FreedAppSchedulePolicy.shouldRelock(youtube, manualAndSchedule, youtube, false))
  check(!FreedAppSchedulePolicy.shouldRelock(youtube, manualAndSchedule, instagram, false))
  check(!FreedAppSchedulePolicy.shouldRelock(youtube, manualAndSchedule, null, false)) // No root, screen off or locked.
  check(!FreedAppSchedulePolicy.shouldRelock(youtube, manualAndSchedule, youtube, true))
  check(!FreedAppSchedulePolicy.shouldRelock(youtube, emptySet(), youtube, false)) // Schedule ended/removed, no manual target.
  val overnight = parse(schedule(id = "sleep", start = 22 * 60, end = 7 * 60, days = listOf(5)))
  check(snapshot(overnight, "2026-10-09T22:00:00Z").activePackages == setOf(youtube))
  check(snapshot(overnight, "2026-10-10T06:59:59Z").activePackages == setOf(youtube))
  check(snapshot(overnight, "2026-10-10T07:00:00Z").activePackages.isEmpty())
  check(snapshot(overnight, "2026-10-09T06:00:00Z").activePackages.isEmpty())
  check(snapshot(overnight, "2026-10-10T22:00:00Z").activePackages.isEmpty())
  val weekend = parse(schedule(id = "weekend", start = 0, end = 0, days = listOf(0, 6), allDay = true))
  check(snapshot(weekend, "2026-10-03T00:00:00Z").activePackages == setOf(youtube))
  check(snapshot(weekend, "2026-10-04T23:59:59Z").activePackages == setOf(youtube))
  check(snapshot(weekend, "2026-10-05T00:00:00Z").activePackages.isEmpty())
  check(FreedAppSchedulePolicy.nextBoundaryAt(weekend, at("2026-10-03T12:00:00Z"), utc) == at("2026-10-05T00:00:00Z"))
  val disabled = parse(schedule(enabled = false), schedule(id = "sleep", start = 1, end = 1),
    schedule(id = "weekend", enabled = false, days = emptyList()))
  check(!disabled.configured)
  check(snapshot(disabled, "2026-10-05T12:00:00Z").activePackages.isEmpty())
  check(FreedAppSchedulePolicy.nextBoundaryAt(disabled, at("2026-10-05T12:00:00Z"), utc) == null)
  check(parse().schedules.isEmpty())
  val normalized = parse(schedule(packages = listOf("  COM.GOOGLE.ANDROID.YOUTUBE  ", youtube, ownPackage)))
  check(normalized.schedules.single().packages == setOf(youtube))
  check(FreedAppSchedulePolicy.parse(input(schedule(packages = listOf("com.unsupported.app"))), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(packages = listOf(1))), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(packages = emptyList())), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(days = emptyList())), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(id = "weekend", days = listOf(0, 6))), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(start = -1)), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(end = 1440)), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(start = 1.5)), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(start = Double.NaN)), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(days = listOf(7))), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(days = listOf(1.1))), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(id = "unknown")), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(), schedule()), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(allDay = true)), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(id = "weekend", days = listOf(6), allDay = true)), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(allDay = "true")), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(mapOf("version" to 2, "schedules" to emptyList<Any>()), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(mapOf("version" to 1, "schedules" to "invalid"), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule()) + ("unexpected" to true), ownPackage) == null)
  check(FreedAppSchedulePolicy.parse(input(schedule(), schedule(id = "sleep"), schedule(id = "weekend"), schedule()), ownPackage) == null)
  // Fresh wall-clock/time-zone evaluation, without any cached JS active state.
  check(snapshot(work, "2026-10-05T05:00:00Z", TimeZone.getTimeZone("Asia/Kolkata")).activePackages == setOf(youtube))
  check(snapshot(work, "2026-10-05T05:00:00Z", utc).activePackages.isEmpty())
  check(snapshot(work, "2026-10-05T18:00:00Z").activePackages.isEmpty())
  check(snapshot(work, "2026-10-05T10:00:00Z").activePackages == setOf(youtube))
  val newYork = TimeZone.getTimeZone("America/New_York")
  val spring = parse(schedule(start = 2 * 60 + 30, end = 3 * 60 + 30, days = listOf(0)))
  check(snapshot(spring, "2026-03-08T06:59:59Z", newYork).activePackages.isEmpty())
  check(snapshot(spring, "2026-03-08T07:00:00Z", newYork).activePackages == setOf(youtube))
  check(snapshot(spring, "2026-03-08T07:30:00Z", newYork).activePackages.isEmpty())
  check(FreedAppSchedulePolicy.nextBoundaryAt(spring, at("2026-03-08T06:59:59Z"), newYork) == at("2026-03-08T07:00:00Z"))
  val fall = parse(schedule(start = 60 + 15, end = 60 + 45, days = listOf(0)))
  check(snapshot(fall, "2026-11-01T05:20:00Z", newYork).activePackages == setOf(youtube))
  check(snapshot(fall, "2026-11-01T05:50:00Z", newYork).activePackages.isEmpty())
  check(snapshot(fall, "2026-11-01T06:20:00Z", newYork).activePackages == setOf(youtube))
  check(FreedAppSchedulePolicy.nextBoundaryAt(fall, at("2026-11-01T05:50:00Z"), newYork) == at("2026-11-01T06:15:00Z"))
  println("Native app schedules: validation, exact boundaries, overlaps, manual union, earned unlock, overnight, weekend, clock, timezone and DST cases passed")
}
