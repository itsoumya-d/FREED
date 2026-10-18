package app.freed.protection

/** JVM boundary cases load the actual policy, including its initially missing native API. */
fun main() {
  val type = runCatching { Class.forName("app.freed.protection.FreedAppGuardModePolicy") }.getOrNull()
  check(type != null) { "Native selected-app guard mode policy is not installed" }
  val policy = type.getField("INSTANCE").get(null)
  val parse = type.getMethod("parse", String::class.java)
  val packageSource = type.getMethod("packageSource", String::class.java)
  val read = type.getMethod("fromStored", String::class.java)
  val block = type.getMethod("shouldInterrupt", String::class.java, Set::class.java,
    FreedAppScheduleSnapshot::class.java, String::class.java, Boolean::class.javaPrimitiveType,
    Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType)
  val ready = type.getMethod("ready", String::class.java, Int::class.javaPrimitiveType,
    Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType,
    Boolean::class.javaPrimitiveType, Boolean::class.javaPrimitiveType)
  val youtube = FreedDoomscrollApps.YOUTUBE_PACKAGE
  val instagram = FreedDoomscrollApps.INSTAGRAM_PACKAGE
  check(packageSource.invoke(policy, youtube) == youtube)
  for (invalid in listOf("youtube.com", "https://youtube.com/shorts/private", "ios-screen-time", "category", "com.google.android.youtube.app.freed.local")) {
    check(packageSource.invoke(policy, invalid) == null) { "Fresh native breaks accept an actual package only, never a URL/domain/category hint" }
  }
  val off = FreedAppScheduleSnapshot(emptyList(), emptySet())
  val active = FreedAppScheduleSnapshot(listOf("work"), setOf(youtube, instagram))
  fun decide(mode: String, selected: Set<String> = setOf(youtube), schedules: FreedAppScheduleSnapshot = off,
    target: String = youtube, strict: Boolean = false, reached: Boolean = false, grant: Boolean = false,
    enabled: Boolean = true): Boolean = block.invoke(policy, target, selected, schedules, mode, strict, reached, grant, enabled) as Boolean
  fun isReady(mode: String, targets: Int = 1, enabled: Boolean = true, os: Boolean = true,
    connected: Boolean = true, usage: Boolean = true, windows: Boolean = true): Boolean =
    ready.invoke(policy, mode, targets, enabled, os, connected, usage, windows) as Boolean
  check(read.invoke(policy, null) == "daily-limit") { "Missing legacy mode must retain daily-limit behavior" }
  for (mode in listOf("before-use", "daily-limit", "scheduled")) check(parse.invoke(policy, mode) == mode)
  for (invalid in listOf("off", "Before-use", " before-use", "daily-limit ", "", "selected-applications")) check(parse.invoke(policy, invalid) == null)
  check(decide("before-use")) { "Before-use must interrupt a selected target without a daily threshold" }
  check(!decide("daily-limit"))
  check(decide("daily-limit", reached = true))
  check(!decide("scheduled", reached = true)) { "An old reached daily budget cannot block outside selected scheduled windows" }
  check(decide("scheduled", schedules = active))
  check(!decide("scheduled", schedules = off, grant = false)) { "A ended window must not relock its quiet foreground target" }
  check(!decide("before-use", selected = emptySet()))
  check(!decide("daily-limit", selected = emptySet(), reached = true))
  check(!decide("scheduled", selected = emptySet()))
  check(!decide("before-use", target = instagram))
  check(decide("daily-limit", target = instagram, schedules = active)) { "Independent schedules still protect other configured targets" }
  for (mode in listOf("before-use", "daily-limit", "scheduled")) {
    check(decide(mode, schedules = active, reached = true, grant = true)) { "An active timed package guard must override an existing earned break" }
    check(!decide(mode, schedules = FreedAppScheduleSnapshot(listOf("work"), setOf(instagram)), reached = true, grant = true)) {
      "An unrelated scheduled package must not suppress this target's break"
    }
    check(decide(mode, strict = true, grant = true)) { "A prior earned break cannot bypass a hard independent strict guard" }
    check(decide(mode, selected = emptySet(), target = instagram, strict = true)) { "Strict targets must not be narrowed to the user's ordinary selected set" }
    check(!decide(mode, strict = true, reached = true, enabled = false)) { "Off/reset latches dominate all modes and strict guards" }
    check(!decide(mode, target = "app.freed.recovery", strict = true))
    check(!decide(mode, target = "youtube.com", strict = true))
    check(!decide(mode, target = "https://youtube.com/shorts/private", strict = true))
  }
  // The same installed callback must reevaluate current mode, not a captured reached budget.
  var mode = "daily-limit"
  val queuedDeadline = { decide(mode, reached = true) }
  check(queuedDeadline())
  mode = "scheduled"; check(!queuedDeadline())
  mode = "before-use"; check(queuedDeadline())
  check(!isReady("before-use", targets = 0))
  check(!isReady("before-use", enabled = false))
  check(!isReady("before-use", os = false))
  check(!isReady("before-use", connected = false))
  check(isReady("before-use", usage = false, windows = false))
  check(!isReady("daily-limit", usage = false))
  check(isReady("daily-limit", windows = false))
  check(!isReady("scheduled", windows = false))
  check(isReady("scheduled", usage = false))
  println("Android app guard modes: exact input, legacy limit, immediate use, schedules, hard strict, reset, target-only break, fresh callbacks and native readiness cases passed")
}
