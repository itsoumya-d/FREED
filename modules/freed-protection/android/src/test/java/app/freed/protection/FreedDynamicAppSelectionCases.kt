package app.freed.protection

fun main() {
  val reader = "org.example.reader"
  val off = FreedAppScheduleSnapshot(emptyList(), emptySet())
  check(FreedAppGuardModePolicy.shouldInterrupt(reader, setOf(reader), off, "before-use", false, false, false, true))
  check(!FreedAppGuardModePolicy.shouldInterrupt(reader, emptySet(), off, "before-use", true, true, false, true)) { "Legacy strict cannot expand to every installed package" }
  check(FreedAppGuardModePolicy.packageSource(reader) == null) { "Old source hints must retain the legacy unlock allowlist" }
  val type = FreedAppSchedulePolicy.javaClass
  val parse = type.methods.firstOrNull { it.name == "parse" && it.parameterCount == 4 }
  check(parse != null) { "Native schedules lack actual installed selection eligibility" }
  val input = mapOf("version" to 1, "schedules" to listOf(mapOf("id" to "work", "enabled" to true,
    "startMinute" to 540, "endMinute" to 720, "days" to listOf(1), "packages" to listOf(reader))))
  val configuration = parse.invoke(FreedAppSchedulePolicy, input, "app.freed", false, setOf(reader)) as? FreedAppScheduleConfiguration
  check(configuration?.potentialPackages == setOf(reader))
  check(parse.invoke(FreedAppSchedulePolicy, input, "app.freed", false, emptySet<String>()) == null)
  println("Dynamic selected native app guard/schedule cases: eligible arbitrary package, unchanged legacy strict scope and unlock allowlist, unavailable package rejection passed")
}
